const { segment } = require('koishi');
const { resolve } = require('path');
const common = require('../util/common');
const evmOpenApi = require('../api/evmOpenApi');
const guildBind = require('../database/guildBind');
const tmpIdPicker = require('../util/tmpIdPicker');
const messageRender = require('../util/messageRender');
const qqOfficial = require('../util/qqOfficial');
module.exports = async (ctx, cfg, session, rankingType, target) => {
    // 仅在图片模式下才需要 puppeteer；文本模式不拦截
    const wantImage = messageRender.wantImage(messageRender.readType(cfg, 'tmpMileageRanking.type'));
    if (wantImage && !ctx.puppeteer) {
        return '未启用 Puppeteer 功能';
    }
    // 查询排行榜信息
    let mileageRankingList = await evmOpenApi.mileageRankingList(ctx.http, rankingType, null);
    if (mileageRankingList.error) {
        return '查询排行榜信息失败';
    }
    else if (mileageRankingList.data.length === 0) {
        return '暂无数据';
    }
    // 支持 @别人 查询：拿对方的绑定来高亮（排行榜只高亮一个人）
    let ownerKey = session.userId;
    let ownerName = '';
    if (target && typeof target === 'string' && target.includes('<at ')) {
        const ats = tmpIdPicker.parseAt(target);
        const atUser = (Array.isArray(ats) && ats.length > 0) ? ats[0] : null;
        if (!atUser || !atUser.id) {
            return `无法识别@的用户`;
        }
        ownerKey = atUser.id;
        ownerName = atUser.name || '';
        if (ownerName) tmpIdPicker.cacheAtName(session.platform, ownerKey, ownerName);
    }
    // 排行榜只高亮一个人：直接用默认绑定，不弹序号询问
    // 这里只用 tmp_id，高亮名字来自排行榜接口返回的数据 → 不必刷新 tmp_name
    const bindings = await guildBind.listOf(ctx.database, session.platform, ownerKey);
    let bindTmpId = null;
    if (bindings.length > 0) {
        bindTmpId = String((bindings.find(b => guildBind.isDefault(b)) || bindings[0]).tmp_id);
    }
    let playerMileageRanking = null;
    if (bindTmpId) {
        let playerMileageRankingResult = await evmOpenApi.mileageRankingList(ctx.http, rankingType, bindTmpId);
        if (!playerMileageRankingResult.error && playerMileageRankingResult.data.length > 0) {
            playerMileageRanking = playerMileageRankingResult.data[0];
        }
    }
    // 拼接页面数据
    let data = {
        rankingType: rankingType,
        mileageRankingList: mileageRankingList.data,
        playerMileageRanking: playerMileageRanking
    };

    const buttons = buildRankingButtons(session, rankingType);
    const text = buildRankingText(data);

    return await messageRender.renderByType(ctx, session, cfg, 'tmpMileageRanking.type', {
        text,
        buttons,
        caption: (Number(rankingType) === 2 ? '今日' : '总') + '里程排行榜',
        alt: '里程排行榜',
        image: async () => {
            if (!ctx.puppeteer) return null;
            let page;
            try {
                page = await ctx.puppeteer.page();
                await page.setViewport({ width: 1000, height: 1000, deviceScaleFactor: 2 });
                await page.goto(`file:///${resolve(__dirname, '../resource/mileage-leaderboard.html')}`);
                await page.evaluate(`setData(${JSON.stringify(data)})`);
                await page.waitForNetworkIdle();
                await common.sleep(500);
                const element = await page.$("#container");
                return segment.image(await element.screenshot({ encoding: "binary" }), "image/jpeg");
            } catch (e) {
                console.info(e);
                return null;
            } finally {
                if (page) {
                    try { await page.close(); } catch { }
                }
            }
        }
    });
};

/**
 * 排行榜按钮（仅 QQ 官方机器人可见）。
 */
function buildRankingButtons(session, rankingType) {
    if (!qqOfficial.isQQOfficial(session)) return [];
    const rows = [];
    rows.push([qqOfficial.inputButton(
        Number(rankingType) === 2 ? '查看总榜' : '查看今日榜',
        Number(rankingType) === 2 ? '里程排行榜' : '今日里程排行榜',
        true
    )]);
    rows.push([qqOfficial.inputButton('我的绑定', '我的绑定')]);
    return rows;
}

/**
 * 排行榜文字版。
 */
function buildRankingText(data) {
    const typeText = Number(data.rankingType) === 2 ? '今日' : '总';
    const list = Array.isArray(data.mileageRankingList) ? data.mileageRankingList : [];
    const lines = [`## 里程排行榜（${typeText}）`, ''];
    list.slice(0, 10).forEach((p, i) => {
        lines.push(`${i + 1}. ${p.name || '未知'}  ${formatKm(p.mileage)}`);
    });
    if (data.playerMileageRanking) {
        const me = data.playerMileageRanking;
        const rank = list.indexOf(me) + 1;
        lines.push('', `**你的排名**：第 ${rank || '-'} 名  ${formatKm(me.mileage)}`);
    }
    return lines.join('\n');
}

function formatKm(v) {
    const n = Number(v);
    return Number.isFinite(n) ? `${n.toLocaleString('en-US')} km` : '-';
}
