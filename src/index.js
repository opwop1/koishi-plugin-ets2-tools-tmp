"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Config = exports.inject = exports.name = void 0;
exports.apply = apply;
const koishi_1 = require("koishi");
const model = require('./database/model');
const { MileageRankingType } = require('./util/constant');
const tmpQuery = require('./command/tmpQuery/tmpQuery');
const tmpServer = require('./command/tmpServer');
const tmpBind = require('./command/tmpBind');
const tmpTraffic = require('./command/tmpTraffic/tmpTraffic');
const tmpPosition = require('./command/tmpPosition');
const tmpVersion = require('./command/tmpVersion');
const tmpDlcMap = require('./command/tmpDlcMap');
const tmpMileageRanking = require('./command/tmpMileageRanking');
const resetPassword = require('./command/ets-app/resetPassword');
const queryPoint = require('./command/ets-app/queryPoint');
const tmpVtc = require('./command/tmpVtc');

exports.name = 'tmp-bot';
exports.inject = {
    required: ['database'],
    optional: ['puppeteer']
};
exports.Config = koishi_1.Schema.intersect([
    koishi_1.Schema.object({
        baiduTranslateEnable: koishi_1.Schema.boolean().default(false).description('启用百度翻译'),
        baiduTranslateAppId: koishi_1.Schema.string().description('百度翻译APP ID'),
        baiduTranslateKey: koishi_1.Schema.string().description('百度翻译秘钥'),
        baiduTranslateCacheEnable: koishi_1.Schema.boolean().default(false).description('启用百度翻译缓存')
    }).description('基本配置'),
    koishi_1.Schema.object({
        queryShowAvatarEnable: koishi_1.Schema.boolean().default(false).description('查询指令展示头像，部分玩家的擦边头像可能导致封号'),
        tmpTrafficType: koishi_1.Schema.union([
            koishi_1.Schema.const(1).description('文字'),
            koishi_1.Schema.const(2).description('热力图')
        ]).default(1).description('路况信息展示方式'),
        tmpQueryType: koishi_1.Schema.union([
            koishi_1.Schema.const(1).description('文字'),
            koishi_1.Schema.const(2).description('图片')
        ]).default(1).description('玩家信息展示方式'),
    }).description('指令配置'),
    koishi_1.Schema.object({
        mainSettings: koishi_1.Schema.object({
            url: koishi_1.Schema.string().description("API服务器地址").required(),
            token: koishi_1.Schema.string().description("API认证令牌").required(),
            logOutput: koishi_1.Schema.boolean().description("是否输出日志").default(true)
        }).description("车队平台设置")
    }),
    koishi_1.Schema.object({
        resetPassword: koishi_1.Schema.object({
            adminUsers: koishi_1.Schema.array(koishi_1.Schema.string()).description("管理员用户ID（拥有重置任意teamId权限）").default([])
        }).description("重置密码设置")
    }),
]);
function apply(ctx, cfg) {
    // 初始化数据表
    model(ctx);
    // 注册指令
    ctx.command('查询 <tmpId>').action(async ({ session }, tmpId) => await tmpQuery(ctx, cfg, session, tmpId));
    ctx.command('美卡服务器').action(async () => await tmpServer(ctx, cfg, 'ATS'));
    ctx.command('欧卡服务器').action(async () => await tmpServer(ctx, cfg, 'ETS2'));
    ctx.command('绑定 <tmpId>').action(async ({ session }, tmpId) => await tmpBind(ctx, cfg, session, tmpId));
    ctx.command('路况 <serverName>').action(async ({ session }, serverName) => await tmpTraffic(ctx, cfg, serverName));
    ctx.command('定位 <tmpId>').action(async ({ session }, tmpId) => await tmpPosition(ctx, cfg, session, tmpId));
    ctx.command('tmp版本').action(async () => await tmpVersion(ctx));
    ctx.command('地图dlc价格').action(async ({ session }) => await tmpDlcMap(ctx, session));
    ctx.command('里程排行榜').action(async ({ session }) => await tmpMileageRanking(ctx, session, MileageRankingType.total));
    ctx.command('今日里程排行榜').action(async ({ session }) => await tmpMileageRanking(ctx, session, MileageRankingType.today));

    ctx.command('vtc查询 <vtcid>').action(async ({ session }, vtcid) => await tmpVtc(ctx, cfg, session, vtcid));
    ctx.command(`重置密码 [targetTeamId:string]`, "重置欧卡车队平台密码").usage("重置自己的密码，或管理员重置指定teamId的密码").example(`重置密码new - 重置自己的密码`).example(`重置密码new 123 - 管理员重置指定teamId的密码`).action(async ({ session }, targetTeamId) => await resetPassword(ctx, cfg, session, targetTeamId));
    ctx.command(`查询积分 [targetQQ:string]`, "查询欧卡车队平台积分").usage("查询自己或指定QQ号的积分，在群聊中可@他人查询").example(`查询积分 - 查询自己的积分`).example(`查询积分 - 查询指定QQ号的积分`).action(async ({ session }, targetQQ) => await queryPoint(ctx, cfg, session, targetQQ));
    ctx.command('规则查询').action(async ({ session }) => { return 'https://truckersmp.com/knowledge-base/article/746' })
}
