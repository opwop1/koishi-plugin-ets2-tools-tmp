const BASE_API = 'https://tracker.ets2map.com';
module.exports = {
    /**
     * 区域查询玩家
     */
    async area(http, serverId, x1, y1, x2, y2) {
        let result = null;
        try {
            result = await http.get(`${BASE_API}/v3/area?x1=${x1}&y1=${y1}&x2=${x2}&y2=${y2}&server=${serverId}`);
        }
        catch {
            return {
                error: true
            };
        }
        // 拼接返回数据
        let data = {
            error: !result || !result.Success
        };
        if (!data.error) {
            data.data = result.Data;
        }
        return data;
    }
};
