/**
 * 多绑定选择器：需要选 tmpId 时列出序号让用户回复选择（支持多选）。
 * 原理：需要选择的指令先回复编号列表并挂起（pending），由前置中间件捕获用户下一条
 * "纯序号"消息后解析并继续执行；超时/取消/其他内容均视为放弃。
 *
 * 归属：挂起只认**发起指令的人**。@别人 查询时列表显示被 @ 的人（以及对方的绑定），
 * 但回复序号仍必须由发起者本人来发；被 @ 的人或群里其他人回复不会被当作选择。
 */
const MAX_PICK = 5;            // 单次多选上限
const PICK_TIMEOUT = 60_000;   // 等待回复时长（毫秒）
/** 「全部」哨兵：回复 all / 全部，或把 all 当作参数传入时使用 */
const ALL = Symbol('tmpIdPicker.ALL');
const guildBind = require('../database/guildBind');

/**
 * 判断一个参数是不是「全部」写法（all 大小写不敏感，也接受「全部」）
 */
function isAllArg(value) {
    if (typeof value !== 'string') return false;
    const v = value.trim();
    return /^all$/i.test(v) || v === '全部';
}

/**
 * 把「全部绑定」解析成 tmpId 数组。截断规则与多选一致（最多 MAX_PICK 个）。
 * @returns { ids: string[], total: number, truncated: boolean }
 */
function resolveAll(bindings, max = MAX_PICK) {
    const list = bindings || [];
    const ids = list.slice(0, max).map(b => String(b.tmp_id));
    return { ids, total: list.length, truncated: list.length > ids.length };
}

/**
 * 供指令层处理 `xxx all` 写法：统一取「本人全部绑定」并补全名字。
 * @returns {
 *   ids: string[],           要逐个查询的 tmpId（已截断到 MAX_PICK）
 *   total: number,           绑定总数
 *   truncated: boolean,      是否因上限被截断
 *   hint: string|null,       需要附加提示时的文案（截断 / 无绑定），无则 null
 * }
 */
async function pickAll(ctx, session, bindingRows) {
    const list = bindingRows || [];
    if (list.length === 0) {
        return { ids: [], total: 0, truncated: false, hint: null };
    }
    // 补全旧数据缺失的玩家名（复用列表展示那套逻辑，保证提示文案准确）
    await guildBind.ensureNames(ctx, list);
    const { ids, total, truncated } = resolveAll(list);
    return {
        ids,
        total,
        truncated,
        hint: truncated ? `共 ${total} 个绑定，本次查询前 ${ids.length} 个` : null,
    };
}

/**
 * key: `${platform}:${channelId}:${userId}` → { bindings, allowMulti, max, finish }
 * 按平台+频道+用户隔离，避免群里其他人误触发。
 */
const pending = new Map();

/**
 * 被 @ 的成员 id → { platform:id → 展示名 }。会话文本里的 @ 段通常带 name，
 * 缺失时（纯 <at id="..."/>）从事件成员列表兜底拿昵称。
 */
const atNameCache = new Map();

/** QQ 号与 koishi 的 `qq:` 前缀可能不一致，统一成纯数字做 key */
function normalizeId(id) {
    return String(id == null ? '' : id).replace(/^[a-z]+:/i, '');
}

/**
 * 从消息文本/元素数组里遍历出所有被 @ 的人。
 * 解析失败时返回 { failed: true }，由调用方决定是否降级为默认绑定。
 * @returns {Array<{ id: string, name: string }> | { failed: true }}
 */
function parseAt(target) {
    if (target == null) return { failed: true };
    if (Array.isArray(target)) {
        const els = target.filter(el => el && typeof el === 'object' && el.type === 'at' && el.attrs && el.attrs.id != null);
        if (els.length === 0) return { failed: true };
        return els.map(el => ({ id: String(el.attrs.id), name: el.attrs.name || '' }));
    }
    const text = String(target);
    if (!text.includes('<at ')) return [];
    const out = [];
    const re = /<at\s+([^>]*)>/g;
    let m;
    while ((m = re.exec(text)) !== null) {
        const attrs = m[1];
        const idm = /\bid\s*=\s*"([^"]*)"/.exec(attrs);
        const nm = /\bname\s*=\s*"([^"]*)"/.exec(attrs);
        if (idm && idm[1]) out.push({ id: idm[1], name: nm ? nm[1] : '' });
    }
    // 有 <at 标记却一个都没解析出来 → 格式异常，交调用方降级
    if (out.length === 0) return { failed: true };
    return out;
}

/**
 * 取 @ 对象的展示名（仅用于 @别人 时把对方名字写进列表标题）
 */
function displayName(session, at) {
    if (at.name) return at.name;
    for (const key of ['member', 'author', 'user']) {
        const obj = session[key];
        if (obj && normalizeId(obj.id) === normalizeId(at.id) && (obj.nick || obj.name)) {
            return obj.nick || obj.name;
        }
    }
    if (session.event && Array.isArray(session.event.member)) {
        const hit = session.event.member.find(mm => normalizeId(mm.user && mm.user.id) === normalizeId(at.id));
        if (hit && hit.user && (hit.user.nick || hit.user.name)) {
            return hit.user.nick || hit.user.name;
        }
    }
    const sk = session.platform + ':' + normalizeId(at.id);
    const cached = atNameCache.get(sk);
    return cached || normalizeId(at.id);
}

function keyOf(session) {
    return `${session.platform}:${session.channelId || 'private'}:${session.userId}`;
}

/**
 * 注册选择器中间件（在插件 apply 中调用一次，前置执行）
 *
 * 归属规则：挂起记录只挂在**发起指令的那个人**的 key 上（keyOf 里的 session.userId）。
 * 所以「A 发 查询 @B」时，只有 A 回复序号才算数；B 或群里其他人回复一律放行给原指令，
 * 不会替 A 做选择。
 */
function register(ctx) {
    ctx.middleware((session, next) => {
        const key = keyOf(session);
        const record = pending.get(key);
        if (!record) return next();
        const content = (session.content || '').trim();
        // 取消
        if (/^取消$/.test(content)) {
            record.finish(null);
            return;
        }
        // 「全部」：选中全部绑定（同样受 max 截断，超出时提示）
        // 不发图/重负载的指令（如足迹）会把 allowAll 置 false，此分支退回按普通内容处理
        if (record.allowAll !== false && isAllArg(content)) {
            const { ids, total, truncated } = resolveAll(record.bindings, record.allowMulti ? record.max : 1);
            if (ids.length === 0) {
                record.finish(null);
                session.send('没有可查询的绑定，已取消').catch(() => { });
                return;
            }
            if (truncated) {
                session.send(`共 ${total} 个绑定，本次查询前 ${ids.length} 个`).catch(() => { });
            }
            record.finish(ids);
            return;
        }
        // 纯序号消息（支持 1,3 / 1 3 / 1、3 等分隔写法）
        if (/^\d{1,6}(?:\s*[,，、 ]\s*\d{1,6})*$/.test(content)) {
            const indexes = [...content.matchAll(/\d{1,6}/g)].map(m => parseInt(m[0], 10));
            const picked = [...new Set(indexes)]
                .filter(i => i >= 1 && i <= record.bindings.length)
                .slice(0, record.allowMulti ? record.max : 1)
                .map(i => String(record.bindings[i - 1].tmp_id));
            if (picked.length === 0) {
                record.finish(null);
                session.send('没有有效的序号，已取消').catch(() => { });
                return;
            }
            record.finish(picked);
            return;
        }
        // 其他内容：视为放弃挂起，消息继续按正常流程处理
        record.finish(null);
        return next();
    }, true);
}

/**
 * 需要绑定 tmpId 的指令调用：绑定数 ≤1 时直接返回不打扰，≥2 时列出序号并等待选择。
 * 挂起只认调用本方法的会话（发起者），别人回复无效。
 * @param bindings guildBind.list() / listOf() 的结果
 * @param opts {
 *   allowMulti?: boolean,   是否允许多选（默认允许）
 *   allowAll?: boolean,     是否允许回复 all 一次选全部（默认允许）；
 *                           出图/重负载指令（足迹）传 false —— 避免一次请求打满服务器
 *   ownerName?: string,     列表标题里显示的名字（@别人 查询时用；仅影响文案）
 * }
 * @returns 选中的 tmpId 字符串数组；返回 null 表示已在等待用户回复，调用方应直接 return
 */
async function pick(ctx, session, bindings, opts = {}) {
    if (!bindings || bindings.length === 0) return [];
    // 旧绑定的行没有名字：先查接口补全并写回，避免列表显示"未知"
    await guildBind.ensureNames(ctx, bindings);
    if (bindings.length === 1) return [String(bindings[0].tmp_id)];
    const allowMulti = opts.allowMulti !== false;
    const allowAll = opts.allowAll !== false;
    const max = allowMulti ? MAX_PICK : 1;
    // @别人 查询：对方的名字（提到过就复用，否则用 id 代替）
    let ownerName = opts.ownerName || '';
    if (!ownerName && opts.ownerKey && String(opts.ownerKey) !== session.userId) {
        ownerName = atNameCache.get(session.platform + ':' + normalizeId(opts.ownerKey)) || normalizeId(opts.ownerKey);
    }
    const lines = bindings.map((b, i) => `${i + 1}. ${b.tmp_name || '未知'} (${b.tmp_id})`);
    const tip = allowMulti
        ? `请回复序号选择（最多 ${max} 个，多选用逗号分隔，如 1,3）`
        + (allowAll ? '，或回复 all 查询全部' : '')
        : '请回复一个序号';
    const prefix = ownerName ? `@${ownerName} 绑定了多个编号：` : '您绑定了多个编号：';
    await session.send(`${prefix}\n${lines.join('\n')}\n${tip}\n回复"取消"放弃，60 秒内有效`);
    return await new Promise(resolve => {
        // key 里带的是 session.userId（发起者），所以只有发起者能回复
        const key = keyOf(session);
        const record = {
            bindings,
            allowMulti,
            allowAll,
            max,
            timer: null,
            finish(result) {
                clearTimeout(record.timer);
                pending.delete(key);
                resolve(result);
            }
        };
        record.timer = setTimeout(() => {
            if (pending.get(key) === record) {
                pending.delete(key);
                resolve(null);
                session.send('选择超时，已取消').catch(() => { });
            }
        }, PICK_TIMEOUT);
        pending.set(key, record);
    });
}

module.exports = {
    register, pick, MAX_PICK, PICK_TIMEOUT,
    parseAt, normalizeId,
    isAllArg, resolveAll, ALL, pickAll,
    cacheAtName(platform, id, name) {
        if (platform && id != null && name) atNameCache.set(platform + ':' + normalizeId(id), name);
    },
};
