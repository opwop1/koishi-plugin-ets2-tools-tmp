const truckyAppApi = require('../../api/truckyAppApi');
const evmOpenApi = require('../../api/evmOpenApi');
const baiduTranslate = require('../../util/baiduTranslate');
const { resolve } = require("path");
const common = require("../../util/common");
const { segment } = require("koishi");
/**
 * 服务器别名
 */
const serverAlias = {
    's1': {
        name: 'sim1',
        mapType: 'ets',
        serverId: 2,
        bounds: [[-94189, 93775], [79264, -78999]]
    },
    's2': {
        name: 'sim2',
        mapType: 'ets',
        serverId: 41,
        bounds: [[-94189, 93775], [79264, -78999]]
    },
    'p': {
        name: 'eupromods1',
        mapType: 'promods',
        serverId: 50,
        bounds: [[-96355, 16381], [205581, -70750]]
    },
    'a': {
        name: 'arc1',
        mapType: 'ets',
        serverId: 7,
        bounds: [[-94189, 93775], [79264, -78999]]
    }
};
/**
 * 路况程度转中文
 */
const severityToZh = {
    'Fluid': {
        text: '畅通',
        color: '#00d26a'
    },
    'Moderate': {
        text: '正常',
        color: '#ff6723'
    },
    'Congested': {
        text: '缓慢',
        color: '#f8312f'
    },
    'Heavy': {
        text: '拥堵',
        color: '#8d67c5'
    }
};
/**
 * 位置类型转中文
 */
const typeToZh = {
    'City': '城市',
    'Road': '公路',
    'Intersection': '十字路口'
};
/**
 * 查询路况
 */
module.exports = async (ctx, cfg, serverName) => {
    if (!ctx.puppeteer) {
        return '未启用 puppeteer 服务';
    }
    // 根据别名获取服务器信息
    let serverInfo = serverAlias[serverName];
    if (!serverInfo) {
        return '请输入正确的服务器名称 (s1, s2, p, a)';
    }
    // 查询路况信息
    let trafficData = await truckyAppApi.trafficTop(ctx.http, serverInfo.name);
    if (trafficData.error) {
        return '查询路况信息失败';
    }
    // 查询地图玩家数据
    let mapData = await evmOpenApi.mapPlayerList(ctx.http, serverInfo.serverId, serverInfo.bounds[0][0], serverInfo.bounds[0][1], serverInfo.bounds[1][0], serverInfo.bounds[1][1]);

    switch (serverName) {
        case 's1':
        case 's2':
        case 'a': {
            // 使用块级作用域包裹，避免变量重复声明
            // 构建路况数据
            let data = {
                mapType: serverInfo.mapType,
                trafficList: [],
                playerCoordinateList: mapData.error && mapData.data ? [] : mapData.data.map(item => [item.axisX, item.axisY])
            };
            for (const traffic of trafficData.data) {
                data.trafficList.push({
                    country: await baiduTranslate(ctx, cfg, traffic.country),
                    province: await baiduTranslate(ctx, cfg, traffic.name.substring(0, traffic.name.lastIndexOf('(') - 1)),
                    playerCount: traffic.players,
                    severity: severityToZh[traffic.newSeverity] || { text: '未知', color: '#ffffff' }
                });
            }
            let page;
            try {
                page = await ctx.puppeteer.page();
                await page.setViewport({ width: 1000, height: 1000 });
                await page.goto(`file:///${resolve(__dirname, '../../resource/traffic.html')}`);
                await page.evaluate(`setData(${JSON.stringify(data)})`);
                await common.sleep(100);
                await page.waitForNetworkIdle();
                const element = await page.$("#container");
                return (segment.image(await element.screenshot({
                    encoding: "binary"
                }), "image/jpg"));
            }
            catch {
                return '渲染异常，请重试';
            }
            finally {
                if (page) {
                    await page.close();
                }
            }
            break;
        }
        case 'p': {
            // 使用块级作用域包裹，避免变量重复声明
            // 构建路况数据
            let data = {
                mapType: serverInfo.mapType,
                trafficList: [],
                playerCoordinateList: mapData.error && mapData.data ? [] : mapData.data.map(item => [item.axisX, item.axisY])
            };
            for (const traffic of trafficData.data) {
                data.trafficList.push({
                    country: await baiduTranslate(ctx, cfg, traffic.country),
                    province: await baiduTranslate(ctx, cfg, traffic.name.substring(0, traffic.name.lastIndexOf('(') - 1)),
                    playerCount: traffic.players,
                    severity: severityToZh[traffic.newSeverity] || { text: '未知', color: '#ffffff' }
                });
            }
            let page;
            try {
                page = await ctx.puppeteer.page();
                await page.setViewport({ width: 1200, height: 1200 });
                await page.goto(`file:///${resolve(__dirname, '../../resource/traffic.html')}`);
                await page.evaluate(`setData(${JSON.stringify(data)})`);
                await common.sleep(100);
                await page.waitForNetworkIdle();
                const element = await page.$("#container");
                return (segment.image(await element.screenshot({
                    encoding: "binary"
                }), "image/jpg"));
            }
            catch {
                return '渲染异常，请重试';
            }
            finally {
                if (page) {
                    await page.close();
                }
            }
            break;
        }
    }
};
