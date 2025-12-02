"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Config = exports.inject = exports.name = void 0;
exports.apply = apply;

const koishi_1 = require("koishi");
const model = require('./database/model');
const { MileageRankingType } = require('./util/constant');

const commands = {
    tmpQuery: require('./command/tmpQuery/tmpQuery'),
    tmpServer: require('./command/tmpServer'),
    tmpBind: require('./command/tmpBind'),
    tmpTraffic: require('./command/tmpTraffic/tmpTraffic'),
    tmpPosition: require('./command/tmpPosition'),
    tmpVersion: require('./command/tmpVersion'),
    tmpDlcMap: require('./command/tmpDlcMap'),
    tmpMileageRanking: require('./command/tmpMileageRanking'),
    resetPassword: require('./command/ets-app/resetPassword'),
    queryPoint: require('./command/ets-app/queryPoint'),
    tmpVtc: require('./command/tmpVtc')
};
const { ActivityService } = require('./command/tmpActivityService');

const __defProp = Object.defineProperty;
const __getOwnPropDesc = Object.getOwnPropertyDescriptor;
const __getOwnPropNames = Object.getOwnPropertyNames;
const __hasOwnProp = Object.prototype.hasOwnProperty;
const __name = (target, value) => __defProp(target, "name", { value, configurable: true });
const __export = (target, all) => {
    for (const name2 in all)
        __defProp(target, name2, { get: all[name2], enumerable: true });
};
const __copyProps = (to, from, except, desc) => {
    if (from && (typeof from === "object" || typeof from === "function")) {
        for (const key of __getOwnPropNames(from))
            if (!__hasOwnProp.call(to, key) && key !== except)
                __defProp(to, key, {
                    get: () => from[key],
                    enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
                });
    }
    return to;
};
const __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

const src_exports = {};
__export(src_exports, {
    Config: () => Config,
    apply: () => apply,
    name: () => name
});

exports.name = 'tmp-bot';
exports.inject = {
    required: ['database'],
    optional: ['puppeteer']
};

exports.Config = koishi_1.Schema.intersect([
    koishi_1.Schema.object({
        debugMode: koishi_1.Schema.boolean().default(false).description('启用调试模式（输出详细日志）')
    }).description('基本配置'),
    koishi_1.Schema.object({
        commands: koishi_1.Schema.object({
            tmpQuery: koishi_1.Schema.boolean().default(true).description('是否启用查询功能'),
            tmpTraffic: koishi_1.Schema.boolean().default(true).description('是否启用路况查询'),
            tmpServer: koishi_1.Schema.boolean().default(true).description('是否启用服务器查询'),
            tmpBind: koishi_1.Schema.boolean().default(true).description('是否启用绑定功能'),
            tmpPosition: koishi_1.Schema.boolean().default(true).description('是否启用定位功能'),
            tmpVersion: koishi_1.Schema.boolean().default(true).description('是否启用版本查询'),
            tmpDlcMap: koishi_1.Schema.boolean().default(true).description('是否启用DLC地图查询'),
            tmpMileageRanking: koishi_1.Schema.boolean().default(true).description('是否启用里程排行榜'),
            tmpVtc: koishi_1.Schema.boolean().default(true).description('是否启用VTC查询'),
            mainSettings: koishi_1.Schema.boolean().default(false).description('是否启用车队平台功能'),
            resetPassword: koishi_1.Schema.boolean().default(false).description('是否启用重置密码功能'),
            tmpActivityService: koishi_1.Schema.boolean().default(false).description('是否启用活动查询')
        }).description('指令配置'),
        baiduTranslate: koishi_1.Schema.object({
            enable: koishi_1.Schema.boolean().default(false).description('是否启用百度翻译'),
            appId: koishi_1.Schema.string().description('百度翻译APP ID'),
            key: koishi_1.Schema.string().description('百度翻译秘钥'),
            enableCache: koishi_1.Schema.boolean().default(false).description('是否启用翻译缓存')
        }).description('百度翻译配置'),
        tmpQuery: koishi_1.Schema.object({
            showAvatar: koishi_1.Schema.boolean().default(false).description('是否显示玩家头像（部分玩家的擦边头像可能导致封号）'),
            type: koishi_1.Schema.union([
                koishi_1.Schema.const(1).description('文字'),
                koishi_1.Schema.const(2).description('图片')
            ]).default(1).description('玩家信息展示方式'),
        }).description('玩家查询配置'),
        tmpTraffic: koishi_1.Schema.object({
            type: koishi_1.Schema.union([
                koishi_1.Schema.const(1).description('文字'),
                koishi_1.Schema.const(2).description('热力图')
            ]).default(1).description('路况信息展示方式'),
        }).description('路况查询配置'),
        mainSettings: koishi_1.Schema.object({
            settings: koishi_1.Schema.object({
                url: koishi_1.Schema.string().description("API服务器地址"),
                token: koishi_1.Schema.string().description("API认证令牌"),
                logOutput: koishi_1.Schema.boolean().description("是否输出日志").default(true)
            })
        }).description("车队平台配置"),
        resetPassword: koishi_1.Schema.object({
            settings: koishi_1.Schema.object({
                adminUsers: koishi_1.Schema.array(koishi_1.Schema.string()).description("管理员用户ID（拥有重置任意teamId权限）").default([])
            })
        }).description("重置密码功能配置"),
        tmpActivityService: koishi_1.Schema.object({
            api: koishi_1.Schema.object({
                useHttps: koishi_1.Schema.boolean().description("使用HTTPS协议").default(true),
                url: koishi_1.Schema.string().description("车队平台URL（不包含协议）").default(""),
                token: koishi_1.Schema.string().description("车队平台TOKEN").default(""),
                vtcId: koishi_1.Schema.string().description("VTC ID（用于TMP API）").default("")
            }).description("API配置"),
            admin: koishi_1.Schema.object({
                checkTimes: koishi_1.Schema.array(koishi_1.Schema.string()).role("table").description("活动检查时间（HH:mm格式）").default(["08:00", "12:00", "14:00", "20:00"]),
                sendTimes: koishi_1.Schema.array(koishi_1.Schema.string()).role("table").description("信息发送时间（HH:mm格式）").default(["08:05", "12:05", "14:05", "20:05"]),
                groups: koishi_1.Schema.array(koishi_1.Schema.string()).role("table").description("管理群组ID列表").default([])
            }).description("管理群配置"),
            dataSource: koishi_1.Schema.object({
                serverSource: koishi_1.Schema.union([
                    koishi_1.Schema.const("platform").description("车队平台API"),
                    koishi_1.Schema.const("tmp").description("TMP API")
                ]).description("服务器信息来源").default("tmp"),
                startPointSource: koishi_1.Schema.union([
                    koishi_1.Schema.const("platform").description("车队平台API"),
                    koishi_1.Schema.const("tmp").description("TMP API")
                ]).description("起点信息来源").default("tmp"),
                endPointSource: koishi_1.Schema.union([
                    koishi_1.Schema.const("platform").description("车队平台API"),
                    koishi_1.Schema.const("tmp").description("TMP API")
                ]).description("终点信息来源").default("tmp"),
                showBanner: koishi_1.Schema.boolean().description("是否显示活动横幅").default(false)
            }).description("数据源配置"),
            messages: koishi_1.Schema.object({
                profileUploaded: koishi_1.Schema.string().description("活动档已上传时的消息").default("今日活动档已做/上传"),
                profileNotUploaded: koishi_1.Schema.string().description("活动档未上传时的消息").default("今日活动档还没做，请负责的管理注意！")
            }).description("管理群消息配置"),
            noActivity: koishi_1.Schema.object({
                enable: koishi_1.Schema.boolean().description("启用今日无活动通知").default(false),
                time: koishi_1.Schema.string().description("今日无活动通知发送时间（HH:mm格式）").default("09:00"),
                message: koishi_1.Schema.string().description("今日无活动通知消息").default("今日没活动")
            }).description("无活动通知配置"),
            mainGroup: koishi_1.Schema.object({
                groups: koishi_1.Schema.array(koishi_1.Schema.string()).role("table").description("主群群号列表").default([]),
                activityReminderMessage: koishi_1.Schema.string().description("活动提醒消息模板，支持变量：{name}, {server}, {startingPoint}, {terminalPoint}, {distance}, {banner}, {timeLeft}").default("活动 {name} 还有 {timeLeft} 分钟就要开始啦!\n服务器: {server}\n起点: {startingPoint}\n终点: {terminalPoint}\n距离: {distance}KM"),
                activityStartReminderMessage: koishi_1.Schema.string().description("活动开始提醒消息模板，支持变量：{name}, {server}, {startingPoint}, {terminalPoint}, {distance}, {banner}").default("活动 {name} 现在开始集合啦!\n服务器: {server}\n起点: {startingPoint}\n终点: {terminalPoint}\n距离: {distance}KM\n活动将于20:30分开始！"),
                activityReminderTimes: koishi_1.Schema.array(koishi_1.Schema.number()).role("table").description("活动开始前提醒时间（分钟）").default([60, 30, 15])
            }).description("主群配置"),
            debug: koishi_1.Schema.object({
                debugMode: koishi_1.Schema.boolean().description("启用调试模式").default(false),
                logApiResponses: koishi_1.Schema.boolean().description("记录API响应详情").default(false),
                logTimingDetails: koishi_1.Schema.boolean().description("记录定时任务执行详情").default(false),
                logActivityMatching: koishi_1.Schema.boolean().description("记录活动匹配过程").default(false),
                logMessageSending: koishi_1.Schema.boolean().description("记录消息发送详情").default(false)
            }).description("开发者选项")
        }).description("活动查询配置")
    }).description('功能配置')
]);

function registerBaseCommands(ctx, cfg) {
    if (cfg.commands?.tmpQuery) {
        ctx.command('查询 <tmpId>')
            .usage("查询TMP玩家信息")
            .action(async ({ session }, tmpId) => await commands.tmpQuery(ctx, cfg, session, tmpId));
    }

    if (cfg.commands?.tmpServer) {
        ctx.command('美卡服务器')
            .usage("查询美国卡车模拟器TMP服务器信息")
            .action(async () => await commands.tmpServer(ctx, cfg, 'ATS'));

        ctx.command('欧卡服务器')
            .usage("查询欧洲卡车模拟2TMP服务器信息")
            .action(async () => await commands.tmpServer(ctx, cfg, 'ETS2'));
    }

    if (cfg.commands?.tmpBind) {
        ctx.command('绑定 <tmpId>')
            .usage("绑定TmpId")
            .action(async ({ session }, tmpId) => await commands.tmpBind(ctx, cfg, session, tmpId));
    }

    if (cfg.commands?.tmpTraffic) {
        ctx.command('路况 <serverName>')
            .usage("查询欧洲卡车模拟2服务器路况")
            .example("路况 - s1")
            .action(async ({ session }, serverName) => await commands.tmpTraffic(ctx, cfg, serverName));
    }

    if (cfg.commands?.tmpPosition) {
        ctx.command('定位 <tmpId>')
            .usage("定位玩家线上位置")
            .action(async ({ session }, tmpId) => await commands.tmpPosition(ctx, cfg, session, tmpId));
    }

    if (cfg.commands?.tmpVersion) {
        ctx.command('tmp版本')
            .usage("查询TruckersMP支持的游戏版本")
            .action(async () => await commands.tmpVersion(ctx));
    }

    if (cfg.commands?.tmpDlcMap) {
        ctx.command('地图dlc价格')
            .usage("查询欧洲卡车模拟2地图dlc价格")
            .action(async ({ session }) => await commands.tmpDlcMap(ctx, session));
    }

    if (cfg.commands?.tmpMileageRanking) {
        ctx.command('里程排行榜')
            .usage("查询欧洲卡车模拟2里程排行榜")
            .action(async ({ session }) => await commands.tmpMileageRanking(ctx, session, MileageRankingType.total));

        ctx.command('今日里程排行榜')
            .usage("查询欧洲卡车模拟2今日里程排行榜")
            .action(async ({ session }) => await commands.tmpMileageRanking(ctx, session, MileageRankingType.today));
    }

    if (cfg.commands?.tmpVtc) {
        ctx.command('vtc查询 <vtcid>')
            .usage("查询TruckersMP VTC信息")
            .action(async ({ session }, vtcid) => await commands.tmpVtc(ctx, cfg, session, vtcid));
    }

    if (cfg.commands?.resetPassword) {
        ctx.command(`重置密码 [targetTeamId:string]`, "重置欧卡车队平台密码")
            .usage("重置自己的密码，或管理员重置指定teamId的密码")
            .example(`重置密码 - 重置自己的密码`)
            .example(`重置密码 - 管理员重置指定teamId的密码`)
            .action(async ({ session }, targetTeamId) => await commands.resetPassword(ctx, cfg, session, targetTeamId));
    }

    if (cfg.commands?.mainSettings) {
        ctx.command(`查询积分 [targetQQ:string]`, "查询欧卡车队平台积分")
            .usage("查询自己或指定QQ号的积分，在群聊中可@他人查询")
            .example(`查询积分 - 查询自己的积分`)
            .example(`查询积分 123456 - 查询指定QQ号的积分`)
            .action(async ({ session }, targetQQ) => await commands.queryPoint(ctx, cfg, session, targetQQ));
    }

    ctx.command('规则查询')
        .action(async () => 'TruckersMP官方规则链接：https://truckersmp.com/knowledge-base/article/746');
}

function apply(ctx, cfg) {
    try {
        model(ctx);
        if (cfg.debugMode) {
            ctx.logger.debug("[TMP-BOT] 数据库模型初始化成功");
        }
    } catch (error) {
        ctx.logger.error("[TMP-BOT] 数据库模型初始化失败:", error.message);
        return;
    }

    registerBaseCommands(ctx, cfg);

    if (cfg.commands?.tmpActivityService) {
        const activityConfig = {
            ...cfg.tmpActivityService,
            debugMode: cfg.debugMode,
            debug: cfg.tmpActivityService.debug
        };
        const activityService = new ActivityService(ctx, activityConfig);
        activityService.start();
    } else if (cfg.debugMode) {
        ctx.logger.debug("[TMP-BOT] 活动查询功能已禁用");
    }
}
__name(apply, "apply");
0 && (module.exports = {
    Config,
    apply,
    name
});