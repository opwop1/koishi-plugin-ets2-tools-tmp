const apiLog = require('../util/apiLog');
const BASE_API = 'https://evmapi.cxnnn.cn/proxy/truckersmp';
// const BASE_API = 'https://api.truckersmp.com/v2';

// 解析 TMP 接口的 error 字段；响应结构异常时记录日志并按错误处理，避免 JSON.parse 直接崩溃
function parseError(result, tag) {
    try {
        return !!JSON.parse(result?.error)
    } catch {
        apiLog.error(tag, `响应结构异常: ${JSON.stringify(result).slice(0, 300)}`)
        return true
    }
}

module.exports = {
    /**
     * 查询玩家信息
     */
    async player(http, tmpId) {
        let result = null;
        try {
            result = await apiLog.get(http, 'tmp.player', `${BASE_API}/player/${tmpId}`);
        }
        catch {
            return {
                error: true
            };
        }
        // 拼接返回数据
        let data = {
            error: parseError(result, 'tmp.player')
        };
        if (!data.error) {
            data.data = result.response;
        }
        return data;
    },
    /**
     * 查询服务器列表
     */
    async servers(http) {
        let result = null;
        try {
            result = await apiLog.get(http, 'tmp.servers', `${BASE_API}/servers`);
        }
        catch {
            return {
                error: true
            };
        }
        // 拼接返回数据
        let data = {
            error: parseError(result, 'tmp.servers')
        };
        if (!data.error) {
            data.data = result.response;
        }
        return data;
    },
    /**
     * 查询玩家封禁信息
     */
    async bans(http, tmpId) {
        let result = null;
        try {
            result = await apiLog.get(http, 'tmp.bans', `${BASE_API}/bans/${tmpId}`);
        }
        catch {
            return {
                error: true
            };
        }
        // 拼接返回数据
        let data = {
            error: parseError(result, 'tmp.bans')
        };
        if (!data.error) {
            data.data = result.response;
        }
        return data;
    },
    /**
     * 游戏版本
     */
    async version(http) {
        let result = null;
        try {
            result = await apiLog.get(http, 'tmp.version', `${BASE_API}/version`);
        }
        catch {
            return {
                error: true
            };
        }
        // 拼接返回数据
        return {
            error: false,
            data: result
        };
    },
    /**
     * 查询车队成员信息
     */
    async vtcMember(http, vtcId, memberId) {
        let result = null;
        try {
            result = await apiLog.get(http, 'tmp.vtcMember', `${BASE_API}/vtc/${vtcId}/member/${memberId}`);
        }
        catch {
            return {
                error: true
            };
        }
        // 拼接返回数据
        let data = {
            error: parseError(result, 'tmp.vtcMember')
        };
        if (!data.error) {
            data.data = result.response;
        }
        return data;
    },
    /*
  * 查询vtc信息
  */
    async vtc(http, vtcId) {
        let result = null
        try {
            result = await apiLog.get(http, 'tmp.vtc', `${BASE_API}/vtc/${vtcId}`)
        } catch {
            return {
                error: true
            }
        }

        // 拼接返回数据
        let data = {
            error: parseError(result, 'tmp.vtc')
        }
        if (!data.error) {
            data.data = result.response
        }

        return data
    }
};
