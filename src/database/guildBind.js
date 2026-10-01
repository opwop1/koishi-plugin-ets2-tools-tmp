const evmOpenApi = require('../api/evmOpenApi');
/**
 * TMP ID 绑定（支持一人绑定多个）
 * 表 tmp_guild_bind：一个绑定一行，同一 (platform, user_id) 可有多行；
 * get() 返回第一行（默认绑定），保持与旧版行为兼容。
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
    /**
     * 获取默认绑定（第一行，兼容旧逻辑）
     * @param db 数据源
     * @param platform 平台
     * @param userId 用户编号
     */
    async get(db, platform, userId) {
        const guildBindList = await db.get('tmp_guild_bind', {
            platform,
            user_id: userId
        });
        if (guildBindList && guildBindList.length > 0) {
            return guildBindList[0];
        }
        return null;
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
     * 追加绑定（同一 tmpId 重复绑定时不会重复入库）
     * @param tmpId TMP ID
     * @param tmpName TMP 玩家名称（用于多绑定列表展示，可为 null）
     * @returns { exists, row } exists=true 表示该 tmpId 已绑定过
     */
    async add(db, platform, userId, tmpId, tmpName) {
        const guildBindList = await this.list(db, platform, userId);
        const existed = guildBindList.find(row => String(row.tmp_id) === String(tmpId));
        if (existed) {
            return { exists: true, row: existed };
        }
        const row = await db.create('tmp_guild_bind', {
            platform: platform,
            user_id: userId,
            tmp_id: tmpId,
            tmp_name: tmpName || null
        });
        return { exists: false, row };
    },
    /**
     * 删除指定主键的绑定
     */
    async remove(db, id) {
        await db.remove('tmp_guild_bind', id);
    },
    /**
     * 删除指定用户的全部绑定
     */
    async removeAll(db, platform, userId) {
        await db.remove('tmp_guild_bind', {
            platform,
            user_id: userId
        });
    }
};
