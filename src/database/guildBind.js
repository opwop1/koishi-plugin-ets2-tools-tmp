const evmOpenApi = require('../api/evmOpenApi');
/**
 * TMP ID 绑定（支持一人绑定多个 + 默认绑定）
 * 表 tmp_guild_bind：一个绑定一行，同一 (platform, user_id) 可有多行；
 * is_default=1 的那行是默认绑定（同一用户至多一个），排行榜等指令优先使用它。
 * get() 返回默认绑定（无默认时退回第一行），保持与旧版行为兼容。
 */
module.exports = {
    /**
     * 刷新玩家名（**总是查接口**，用于玩家改名后的及时同步）：
     * - 并发查询传入的所有行（含缺名的旧数据）；
     * - 名字确实变了才写库，避免无谓的写操作；
     * - 单个查询失败保留旧名（不把已有名字清空），下次再刷新。
     * 注意：只在**要显示名字**的地方调用（我的绑定 / 序号列表 / 解绑·设为默认文案），
     * 不显示名字的路径（如 pickAll、排行榜）不要调用，省接口。
     * @returns 原数组（行对象已被就地更新）
     */
    async refreshNames(ctx, rows) {
        const list = (rows || []).filter(r => r && r.tmp_id != null);
        if (list.length === 0) {
            return rows;
        }
        await Promise.all(list.map(async (row) => {
            try {
                const info = await evmOpenApi.playerInfo(ctx.http, row.tmp_id);
                if (!info.error && info.data && info.data.name) {
                    const name = info.data.name;
                    if (row.tmp_name !== name) {
                        row.tmp_name = name;
                        await ctx.database.set('tmp_guild_bind', row.id, { tmp_name: name });
                    }
                }
            } catch { } // 查询失败保留旧名，下次再刷新
        }));
        return rows;
    },
    /** 是否默认绑定（is_default 兼容 1 / '1' / true 存法） */
    isDefault(row) {
        if (!row) return false;
        return row.is_default === 1 || row.is_default === '1' || row.is_default === true;
    },
    /**
     * 获取默认绑定：优先 is_default=1 的那行，没有则退回第一行（兼容旧数据）。
     * @param db 数据源
     * @param platform 平台
     * @param userId 用户编号
     */
    async get(db, platform, userId) {
        const rows = await this.list(db, platform, userId);
        if (rows.length === 0) {
            return null;
        }
        return rows.find(r => this.isDefault(r)) || rows[0];
    },
    /**
     * 获取全部绑定（按绑定先后排序）
     * @returns 绑定行数组，可能为空数组
     */
    async list(db, platform, userId) {
        const guildBindList = await db.get('tmp_guild_bind', {
            platform,
            user_id: userId
        });
        if (!guildBindList || guildBindList.length === 0) {
            return [];
        }
        return guildBindList.sort((a, b) => a.id - b.id);
    },
    /**
     * 获取绑定列表，**带跨群兜底**（QQ 官方机器人专用能力）。
     *
     * 背景：QQ 官方机器人在不同群下发的 openid 可能不同，
     * 所以 (platform, user_id) 查不到时，再用 union_id 兜一次 —— 用户只要在任意一个群绑定过，
     * 换群后依然能查到自己的绑定。
     *
     * onebot 完全不受影响：
     * - onebot 的 session 没有 unionId，`identity` 传 null，走的就是原 list()；
     * - 原有 `list()` 保持不变，仍然按 (platform, user_id) 精确查。
     *
     * @param {object} db 数据源
     * @param {string} platform 平台
     * @param {string} userId 用户编号（onebot=QQ号，qq=openid）
     * @param {object} [identity] QQ 官方身份 {openid, unionId}；onebot 传 null/不传
     * @returns 绑定行数组（按 id 排序）
     */
    async listWithUnion(db, platform, userId, identity) {
        const own = await this.list(db, platform, userId);
        if (own.length > 0) {
            return own;
        }
        // 没有 union 身份（onebot / 未申请权限）→ 与 list() 完全一致，不产生额外查询
        const unionId = identity && identity.unionId;
        if (!unionId) {
            return own;
        }
        const crossRows = await this.listByUnionId(db, unionId);
        if (crossRows.length === 0) {
            return own;
        }
        // 只取同一平台的，避免 qq 与 onebot 的数据互相串
        return crossRows
            .filter(r => String(r.platform) === String(platform))
            .sort((a, b) => a.id - b.id);
    },
    /**
     * 获取默认绑定，带跨群兜底（语义同 listWithUnion）。
     */
    async getWithUnion(db, platform, userId, identity) {
        const rows = await this.listWithUnion(db, platform, userId, identity);
        if (rows.length === 0) return null;
        return rows.find(r => this.isDefault(r)) || rows[0];
    },
    /**
     * 获取指定用户（可含平台前缀，如 qq:123）的全部绑定。
     * 用于 @别人 查询：内部统一去掉 `qq:` 这类前缀再匹配，兼容库里两种存法。
     */
    async listOf(db, platform, userId) {
        const bare = String(userId == null ? '' : userId).replace(/^[a-z]+:/i, '');
        const rows = await db.get('tmp_guild_bind', { platform });
        return (rows || [])
            .filter(r => {
                const uid = String(r.user_id == null ? '' : r.user_id).replace(/^[a-z]+:/i, '');
                return uid === bare;
            })
            .sort((a, b) => a.id - b.id);
    },
    /**
     * 取默认绑定的 tmpId（无绑定时返回 null）
     * @returns {string|null}
     */
    async getDefaultTmpId(db, platform, userId) {
        const row = await this.get(db, platform, userId);
        return row ? String(row.tmp_id) : null;
    },
    /**
     * 把某个绑定设为该用户的默认绑定。同一用户的其他行会被清掉 is_default，
     * 保证「至多一个默认」；若此前没有任何默认，默认绑定位本身就包含「第一条」。
     * @param id 绑定行主键
     * @returns { row, changed } changed=false 表示本来就是默认
     */
    async setDefault(ctx, db, platform, userId, id) {
        const rows = await this.list(db, platform, userId);
        const target = rows.find(r => r.id === id);
        if (!target) {
            return { row: null, changed: false };
        }
        if (this.isDefault(target)) {
            return { row: target, changed: false };
        }
        // 并发清掉其他行的默认标记（含历史脏数据里可能存在的多个默认）
        await Promise.all(rows
            .filter(r => r.id !== id && this.isDefault(r))
            .map(r => db.set('tmp_guild_bind', r.id, { is_default: 0 })));
        await db.set('tmp_guild_bind', id, { is_default: 1 });
        target.is_default = 1;
        for (const r of rows) {
            if (r.id !== id) r.is_default = 0;
        }
        return { row: target, changed: true };
    },
    /**
     * 按序号把该用户的某个绑定设为默认（序号即「我的绑定」列表里的序号）
     * @returns { row, changed } row=null 表示序号越界
     */
    async setDefaultByIndex(ctx, db, platform, userId, index) {
        const rows = await this.list(db, platform, userId);
        const idx = parseInt(index, 10);
        if (isNaN(idx) || idx < 1 || idx > rows.length) {
            return { row: null, changed: false, total: rows.length };
        }
        const result = await this.setDefault(ctx, db, platform, userId, rows[idx - 1].id);
        return { ...result, total: rows.length };
    },
    /**
     * 按序号设为默认（跨群安全版）：直接用「已查到的行」，不再按 (platform,user_id) 反查。
     * @param rows 调用方已查到的绑定行（顺序即展示顺序）
     */
    async setDefaultByIndexFromRows(db, rows, index) {
        const list = Array.isArray(rows) ? rows : [];
        const idx = parseInt(index, 10);
        if (isNaN(idx) || idx < 1 || idx > list.length) {
            return { row: null, changed: false, total: list.length };
        }
        const target = list[idx - 1];
        if (this.isDefault(target)) {
            return { row: target, changed: false, total: list.length };
        }
        // 同一批行里其他默认标记清掉，保证「至多一个默认」
        await Promise.all(list
            .filter(r => r.id !== target.id && this.isDefault(r))
            .map(r => db.set('tmp_guild_bind', r.id, { is_default: 0 })));
        await db.set('tmp_guild_bind', target.id, { is_default: 1 });
        target.is_default = 1;
        for (const r of list) {
            if (r.id !== target.id) r.is_default = 0;
        }
        return { row: target, changed: true, total: list.length };
    },
    /**
     * 追加绑定（同一 tmpId 重复绑定时不会重复入库）
     * 第一个绑定自动成为默认绑定。
     * @param tmpId TMP ID
     * @param tmpName TMP 玩家名称（用于多绑定列表展示，可为 null）
     * @returns { exists, row, isDefault } exists=true 表示该 tmpId 已绑定过
     */
    /**
     * 新增绑定。
     * @param {object} [identity] QQ 官方机器人身份 {openid, unionId}；
     *        传了就会一并写入 openid / union_id 列（onebot 下不传，保持为 null）
     */
    async add(db, platform, userId, tmpId, tmpName, identity) {
        const guildBindList = await this.list(db, platform, userId);
        const existed = guildBindList.find(row => String(row.tmp_id) === String(tmpId));
        if (existed) {
            // 已绑定过：顺带补齐 openid / union_id（老数据升级路径）
            await this.fillIdentity(db, existed, identity);
            return { exists: true, row: existed, isDefault: this.isDefault(existed) };
        }
        // 还没有任何默认绑定（含首次绑定、以及历史数据全无标记）时，新绑定即默认
        const needDefault = !guildBindList.some(r => this.isDefault(r));
        const row = await db.create('tmp_guild_bind', {
            platform: platform,
            user_id: userId,
            openid: (identity && identity.openid) || null,
            union_id: (identity && identity.unionId) || null,
            tmp_id: tmpId,
            tmp_name: tmpName || null,
            is_default: needDefault ? 1 : 0
        });
        return { exists: false, row, isDefault: needDefault };
    },
    /**
     * 给已有绑定补齐 openid / union_id（只在拿到新值且与库里不同时才写）。
     */
    async fillIdentity(db, row, identity) {
        if (!row || !identity) return row;
        const patch = {};
        if (identity.openid && row.openid !== identity.openid) patch.openid = identity.openid;
        if (identity.unionId && row.union_id !== identity.unionId) patch.union_id = identity.unionId;
        if (Object.keys(patch).length === 0) return row;
        await db.set('tmp_guild_bind', row.id, patch);
        Object.assign(row, patch);
        return row;
    },
    /**
     * 按 union_id 查全部绑定（跨群统一身份）。
     *
     * 场景：QQ 官方机器人在不同群下发的 openid 可能不同，但 union_id 一致。
     * 用户在 A 群绑定过，去 B 群用同一个 union_id 就能直接认出来。
     *
     * @returns 绑定行数组，可能为空数组
     */
    async listByUnionId(db, unionId) {
        if (!unionId) return [];
        const rows = await db.get('tmp_guild_bind', { union_id: String(unionId) });
        return rows || [];
    },
    /**
     * 按 openid 查绑定（同群内身份）。
     */
    async listByOpenid(db, openid) {
        if (!openid) return [];
        const rows = await db.get('tmp_guild_bind', { openid: String(openid) });
        return rows || [];
    },
    /**
     * 按「已查到的绑定行」删除（跨群安全版）。
     *
     * 跨群场景下 user_id 是对方群的 openid，不能再用 (platform,user_id) 反查，
     * 所以直接把「用户看到的那批行」传进来，删的正是他眼前那一条。
     *
     * @param rows 调用方已经查到的绑定行（顺序即展示顺序）
     * @param id 要删除的行主键
     * @returns { removedDefault, promoted } 语义同 remove()
     */
    async removeFromRows(db, rows, id) {
        const list = Array.isArray(rows) ? rows : [];
        const target = list.find(r => r.id === id);
        const wasDefault = this.isDefault(target);
        await db.remove('tmp_guild_bind', id);
        if (!wasDefault) {
            return { removedDefault: false, promoted: null };
        }
        const rest = list.filter(r => r.id !== id);
        if (rest.length === 0) {
            return { removedDefault: true, promoted: null };
        }
        await db.set('tmp_guild_bind', rest[0].id, { is_default: 1 });
        rest[0].is_default = 1;
        return { removedDefault: true, promoted: rest[0] };
    },
    /**
     * 删除「已查到的绑定行」全部（跨群安全版）。
     * @returns 实际删除的条数
     */
    async removeAllFromRows(db, rows) {
        const list = Array.isArray(rows) ? rows : [];
        for (const row of list) {
            await db.remove('tmp_guild_bind', row.id);
        }
        return list.length;
    },
    /**
     * 删除指定主键的绑定；若删掉的正是默认绑定，自动把剩下的第一条顶为默认，
     * 避免「有绑定却没有默认」的空档。
     * @returns { removedDefault, promoted } promoted=被顶为默认的那行（无则 null）
     */
    async remove(db, platform, userId, id) {
        const rows = await this.list(db, platform, userId);
        const target = rows.find(r => r.id === id);
        const wasDefault = this.isDefault(target);
        await db.remove('tmp_guild_bind', id);
        if (!wasDefault) {
            return { removedDefault: false, promoted: null };
        }
        const rest = rows.filter(r => r.id !== id);
        if (rest.length === 0) {
            return { removedDefault: true, promoted: null };
        }
        await db.set('tmp_guild_bind', rest[0].id, { is_default: 1 });
        rest[0].is_default = 1;
        return { removedDefault: true, promoted: rest[0] };
    },
    /**
     * 删除指定用户的全部绑定（默认标记随行一起删掉，无需额外清理）
     */
    async removeAll(db, platform, userId) {
        await db.remove('tmp_guild_bind', {
            platform,
            user_id: userId
        });
    }
};
