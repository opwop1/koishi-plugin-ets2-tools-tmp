/**
 * 多绑定选择器：用户绑定了多个 tmpId 时，列出序号让用户回复选择（支持多选）。
 * 原理：需要选择的指令先回复编号列表并挂起（pending），由前置中间件捕获用户下一条
 * "纯序号"消息后解析并继续执行；超时/取消/其他内容均视为放弃。
 */
const MAX_PICK = 5;            // 单次多选上限
const PICK_TIMEOUT = 60_000;   // 等待回复时长（毫秒）

/**
 * key: `${platform}:${channelId}:${userId}` → { bindings, allowMulti, max, finish }
 * 按平台+频道+用户隔离，避免群里其他人误触发。
 */
const pending = new Map();

function keyOf(session) {
    return `${session.platform}:${session.channelId || 'private'}:${session.userId}`;
}

/**
 * 注册选择器中间件（在插件 apply 中调用一次，前置执行）
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
 * @param bindings guildBind.list() 的结果
 * @param opts { allowMulti?: boolean } 是否允许多选（默认允许）
 * @returns 选中的 tmpId 字符串数组；返回 null 表示已在等待用户回复，调用方应直接 return
 */
async function pick(ctx, session, bindings, opts = {}) {
    if (!bindings || bindings.length === 0) return [];
    if (bindings.length === 1) return [String(bindings[0].tmp_id)];
    const allowMulti = opts.allowMulti !== false;
    const max = allowMulti ? MAX_PICK : 1;
    const lines = bindings.map((b, i) => `${i + 1}. ${b.tmp_name || '未知'} (${b.tmp_id})`);
    const tip = allowMulti
        ? `请回复序号选择（最多 ${max} 个，多选用逗号分隔，如 1,3）`
        : '请回复一个序号';
    await session.send(`您绑定了多个编号：\n${lines.join('\n')}\n${tip}\n回复"取消"放弃，60 秒内有效`);
    return await new Promise(resolve => {
        const key = keyOf(session);
        const record = {
            bindings,
            allowMulti,
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

module.exports = { register, pick, MAX_PICK, PICK_TIMEOUT };
