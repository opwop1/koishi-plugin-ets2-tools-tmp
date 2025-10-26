const BASE_API = 'https://api.truckersmp.com/v2';
module.exports = {
    /**
     * 查询玩家信息
     */
    async player(http, tmpId) {
        let result = null;
        try {
            result = await http.get(`${BASE_API}/player/${tmpId}`);
        }
        catch {
            return {
                error: true
            };
        }
        // 拼接返回数据
        let data = {
            error: JSON.parse(result.error)
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
            result = await http.get(`${BASE_API}/servers`);
        }
        catch {
            return {
                error: true
            };
        }
        // 拼接返回数据
        let data = {
            error: JSON.parse(result.error)
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
            result = await http.get(`${BASE_API}/bans/${tmpId}`);
        }
        catch {
            return {
                error: true
            };
        }
        // 拼接返回数据
        let data = {
            error: JSON.parse(result.error)
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
            result = await http.get(`${BASE_API}/version`);
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
            result = await http.get(`${BASE_API}/vtc/${vtcId}/member/${memberId}`);
        }
        catch {
            return {
                error: true
            };
        }
        // 拼接返回数据
        let data = {
            error: JSON.parse(result.error)
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
            result = await http.get(`${BASE_API}/vtc/${vtcId}`)
        } catch {
            return {
                error: true
            }
        }

        // 拼接返回数据
        let data = {
            error: JSON.parse(result.error)
        }
        if (!data.error) {
            data.data = result.response
        }

        return data
    }
};
