const apiLog = require('../util/apiLog')
const BASE_APIS = ['https://evmapi.cxnnn.cn']

async function requestWithFallback(http, path) {
    let lastError = null
    for (const baseUrl of BASE_APIS) {
        try {
            const result = await apiLog.get(http, `evm${path}`, `${baseUrl}${path}`)
            // 业务层错误码日志（如 10001 玩家不存在等，仅调试模式输出）
            if (result && result.code !== undefined && result.code !== 200) {
                apiLog.debug(`evm${path}`, `业务响应错误码: code=${result.code}, msg=${result.msg || '无'}`)
            }
            return result
        } catch (e) {
            lastError = e
        }
    }
    throw lastError
}

module.exports = {
    /**
     * 查询服务器列表
     */
    async serverList(http, game) {
        let result = null
        try {
            result = game === 'ATS'
                ? await apiLog.get(http, 'evm.proxy.truckersmp.servers', `${BASE_APIS[0]}/proxy/truckersmp/servers`)
                : await requestWithFallback(http, `/server/list`)
        } catch {
            return {
                error: true
            }
        }

        if (game === 'ATS') {
            const servers = result?.response
            const isError = result?.error === true || !Array.isArray(servers)
            return {
                error: isError,
                ...(isError ? {} : {
                    data: servers
                        .filter(server => server.game === 'ATS')
                        .map(server => ({
                            serverName: server.name,
                            isOnline: server.online ? 1 : 0,
                            playerCount: server.players,
                            maxPlayer: server.maxplayers,
                            queueCount: server.queue || 0,
                            afkEnable: server.afkenabled ? 1 : 0,
                            collisionsEnable: server.collisions ? 1 : 0,
                            policeCarEnable: server.policecarsforplayers ? 1 : 0,
                            speedLimiterEnable: server.speedlimiter > 0 ? 1 : 0,
                            playerHistory: []
                        }))
                })
            }
        }

        // 拼接返回数据
        let data = {
            error: result.code !== 200
        }
        if (!data.error) {
            data.data = result.data
        }

        return data
    },
    /**
     * 查询在线玩家
     */
    async mapPlayerList(http, serverId, ax, ay, bx, by) {
        let result = null
        try {
            result = await requestWithFallback(http, `/map/playerList?aAxisX=${ax}&aAxisY=${ay}&bAxisX=${bx}&bAxisY=${by}&serverId=${serverId}`)
        } catch {
            return {
                error: true
            }
        }

        // 拼接返回数据
        let data = {
            error: result.code !== 200
        }
        if (!data.error) {
            data.data = result.data
        }
        return data
    },
    /**
     * 查询玩家信息
     */
    async playerInfo(http, tmpId) {
        let result = null
        try {
            result = await requestWithFallback(http, `/player/info?tmpId=${tmpId}`)
        } catch {
            return {
                error: true
            }
        }

        // 拼接返回数据
        let data = {
            code: result.code,
            error: result.code !== 200
        }
        if (!data.error) {
            data.data = result.data
        }
        return data
    },
    /**
     * DLC列表
     */
    async dlcList(http, type) {
        let result = null
        try {
            result = await requestWithFallback(http, `/dlc/list?type=${type}`)
        } catch (e) {
            return {
                error: true
            }
        }

        // 拼接返回数据
        let data = {
            error: result.code !== 200
        }
        if (!data.error) {
            data.data = result.data
        }
        return data
    },
    /**
     * 玩家里程排行
     */
    async mileageRankingList(http, rankingType, tmpId) {
        let result = null
        try {
            result = await requestWithFallback(http, `/statistics/mileageRankingList?rankingType=${rankingType}&tmpId=${tmpId || ''}&rankingCount=10`)
        } catch (e) {
            return {
                error: true
            }
        }

        // 拼接返回数据
        let data = {
            error: result.code !== 200
        }
        if (!data.error) {
            data.data = result.data
        }
        return data
    },
    /**
     * VTC成员里程排行
     */
    async vtcMileageRankingList(http, rankingType, vtcId) {
        let result = null
        try {
            result = await requestWithFallback(http, `/statistics/VTCmileageRankingList?rankingType=${rankingType}&vtcId=${vtcId}`)
        } catch (e) {
            return {
                error: true
            }
        }

        // 拼接返回数据
        let data = {
            error: result.code !== 200
        }
        if (!data.error) {
            data.data = result.data
        }
        return data
    },
    /**
     * 查询玩家历史数据
     */
    async mapPlayerHistory(http, tmpId, serverId, startTime, endTime) {
        let result = null
        try {
            result = await requestWithFallback(http, `/map/playerHistory?tmpId=${tmpId || ''}&serverId=${serverId || ''}&startTime=${startTime || ''}&endTime=${endTime || ''}`)
        } catch {
            return {
                error: true
            }
        }

        // 拼接返回数据
        let data = {
            error: result.code !== 200
        }
        if (!data.error) {
            data.data = result.data
        }
        return data
    },
    /**
     * VTC在线成员
     */
    async vtcOnlineList(http, vtcId) {
        let result = null
        try {
            result = await requestWithFallback(http, `/vtc/memberOnline?vtcId=${vtcId}`)
        } catch (e) {
            return {
                error: true
            }
        }

        // 拼接返回数据
        let data = {
            error: result.code !== 200
        }
        if (!data.error) {
            data.data = result.data
        }
        return data
    },
    /**
     * 查询 Steam 游戏时长（ETS2 227300 / ATS 270880）
     * 通过代理访问 Steam IPlayerService，返回格式化后的 { ets2, ats } 字符串
     * 未配置 apiKey 或请求失败时对应字段为 null
     */
    async steamGameTime(http, steamApiKey, steamId) {
        if (!steamApiKey || !steamId) {
            return { ets2: null, ats: null }
        }
        const path = `/proxy/steam/IPlayerService/GetOwnedGames/v1?key=${encodeURIComponent(steamApiKey)}&steamid=${steamId}&appids_filter[0]=227300&appids_filter[1]=270880&include_played_free_games=1`
        let response
        try {
            response = await apiLog.get(http, 'evm.steam.gameTime', `${BASE_APIS[0]}${path}`)
        } catch {
            return { ets2: null, ats: null }
        }
        const result = { ets2: null, ats: null }
        if (response?.response?.game_count > 0 && Array.isArray(response.response.games)) {
            for (const game of response.response.games) {
                const minutes = game.playtime_forever
                if (minutes == null) continue
                const h = Math.floor(minutes / 60)
                const m = minutes % 60
                const playtime = `${h}小时${m}分钟`
                if (game.appid === 227300) result.ets2 = playtime
                else if (game.appid === 270880) result.ats = playtime
            }
        }
        return result
    },
}
