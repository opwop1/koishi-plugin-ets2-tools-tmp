const evmOpenApi = require('../api/evmOpenApi');
/**
 * TMP ID 绑定（支持一人绑定多个 + 默认绑定）
 * 表 tmp_guild_bind：一个绑定一行，同一 (platform, user_id) 可有多行；
 * is_default=1 的那行是默认绑定（同一用户至多一个），排行榜等指令优先使用它。
 * get() 返回默认绑定（无默认时退回第一行），保持与旧版行为兼容。
 */
module.exports = {
    /**
     * 补全缺失的玩家名（旧版本绑定的数据没有 tmp_name）：查接口并写回数据库。
     * 并发补查，单个失败保持未知（下次遇到再补）。
     * @returns 原数组（行对象已被就地更新）
     */
    async ensureNames(ctx, rows) {
        const missing = (rows || []).filter(r => !r.tmp_name);
        if (missing.length === 0) {
            return rows;
        }
        await Promise.all(missing.map(async (row) => {
            try {
                const info = await evmOpenApi.playerInfo(ctx.http, row.tmp_id);
                if (!info.error && info.data && info.data.name) {
                    row.tmp_name = info.data.name;
                    await ctx.database.set('tmp_guild_bind', row.id, { tmp_name: info.data.name });
                }
            } catch { } // 查询失败保持未知，下次遇到再补
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
     * 追加绑定（同一 tmpId 重复绑定时不会重复入库）
     * 第一个绑定自动成为默认绑定。
     * @param tmpId TMP ID
     * @param tmpName TMP 玩家名称（用于多绑定列表展示，可为 null）
     * @returns { exists, row, isDefault } exists=true 表示该 tmpId 已绑定过
     */
    async add(db, platform, userId, tmpId, tmpName) {
        const guildBindList = await this.list(db, platform, userId);
        const existed = guildBindList.find(row => String(row.tmp_id) === String(tmpId));
        if (existed) {
            return { exists: true, row: existed, isDefault: this.isDefault(existed) };
        }
        // 还没有任何默认绑定（含首次绑定、以及历史数据全无标记）时，新绑定即默认
        const needDefault = !guildBindList.some(r => this.isDefault(r));
        const row = await db.create('tmp_guild_bind', {
            platform: platform,
            user_id: userId,
            tmp_id: tmpId,
            tmp_name: tmpName || null,
            is_default: needDefault ? 1 : 0
        });
        return { exists: false, row, isDefault: needDefault };
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
