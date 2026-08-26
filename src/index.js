"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Config = exports.inject = exports.name = void 0;
exports.apply = apply;

const koishi_1 = require("koishi");
const model = require('./database/model');
const { ServerType } = require('./util/constant');
const { MileageRankingType } = require('./util/constant');

const commands = {
    tmpQuery: require('./command/tmpQuery/tmpQuery'),
    tmpServer: require('./command/tmpServer/tmpServer'),
    tmpBind: require('./command/tmpBind'),
    tmpTraffic: require('./command/tmpTraffic/tmpTraffic'),
    tmpPosition: require('./command/tmpPosition'),
    tmpVersion: require('./command/tmpVersion'),
    tmpDlcMap: require('./command/tmpDlcMap'),
    tmpMileageRanking: require('./command/tmpMileageRanking'),
    tmpVtcMileageRanking: require('./command/tmpVtcMileageRanking'),
    resetPassword: require('./command/ets-app/resetPassword/resetPassword'),
    queryPoint: require('./command/ets-app/queryPoint/queryPoint'),
    changePoint: require('./command/ets-app/changePoint/changePoint'),
    addMember: require('./command/ets-app/addMember/addMemberV2'),
    pointRanking: require('./command/ets-app/pointRanking/pointRanking'),
    tmpVtc: require('./command/tmpVtc'),
    tmpVtcOnline: require('./command/tmpVtcOnline/tmpVtcOnline'),
    tmpFootprint: require('./command/tmpFootprint')
};
const { ActivityService } = require('./command/tmpActivityService');
const apiLog = require('./util/apiLog');

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
        debugMode: koishi_1.Schema.boolean().default(false).description('启用调试模式（输出详细日志）'),
        apiRetryCount: koishi_1.Schema.number().default(2).min(0).max(10).step(1).description('API请求失败时的重试次数（0=不重试，默认2次）')
    }).description('基本配置'),
    koishi_1.Schema.object({
        commands: koishi_1.Schema.object({
            tmpQuery: koishi_1.Schema.boolean().default(true).description('是否启用查询功能'),
            tmpQueryHistory: koishi_1.Schema.boolean().default(true).description('是否启用查询历史车队功能'),
            tmpTraffic: koishi_1.Schema.boolean().default(true).description('是否启用路况查询'),
            tmpServer: koishi_1.Schema.boolean().default(true).description('是否启用服务器查询'),
            tmpPosition: koishi_1.Schema.boolean().default(true).description('是否启用定位功能'),
            tmpVersion: koishi_1.Schema.boolean().default(true).description('是否启用版本查询'),
            tmpDlcMap: koishi_1.Schema.boolean().default(true).description('是否启用DLC地图查询'),
            tmpMileageRanking: koishi_1.Schema.boolean().default(true).description('是否启用里程排行榜'),
            tmpVtcMileageRanking: koishi_1.Schema.boolean().default(true).description('是否启用VTC里程排行榜'),
            pointRanking: koishi_1.Schema.boolean().default(false).description('是否启用积分排行榜'),
            tmpVtc: koishi_1.Schema.boolean().default(true).description('是否启用VTC查询'),
            tmpVtcOnline: koishi_1.Schema.boolean().default(false).description('是否启用车队在线成员查询功能'),
            tmpFootprint: koishi_1.Schema.boolean().default(true).description('是否启用足迹查询'),
            mainSettings: koishi_1.Schema.boolean().default(false).description('是否启用车队平台积分查询功能'),
            resetPassword: koishi_1.Schema.boolean().default(false).description('是否启用车队平台重置密码功能'),
            changePoint: koishi_1.Schema.boolean().default(false).description('是否启用车队平台积分修改功能'),
            addMember: koishi_1.Schema.boolean().default(false).description('是否启用车队平台新增成员功能'),
            tmpActivityService: koishi_1.Schema.boolean().default(false).description('是否启用车队活动查询'),
            tmpVersionCheck: koishi_1.Schema.boolean().default(false).description('是否启用TMP版本更新查询'),
            tmpQueryGameTime: koishi_1.Schema.boolean().default(true).description('是否启用游戏时长查询功能'),
            tmpQuerySponsor: koishi_1.Schema.boolean().default(true).description('是否启用Patreon支持者查询')
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
        tmpServer: koishi_1.Schema.object({
            type: koishi_1.Schema.union([
                koishi_1.Schema.const(1).description('文字'),
                koishi_1.Schema.const(2).description('图片')
            ]).default(1).description('服务器信息展示方式'),
        }).description('服务器查询配置'),
        tmpVtcOnline: koishi_1.Schema.object({
            type: koishi_1.Schema.union([
                koishi_1.Schema.const(1).description('文字'),
                koishi_1.Schema.const(2).description('图片')
            ]).default(1).description('车队在线成员展示方式')
        }).description('车队在线成员查询'),

        tmpVersionCheck: koishi_1.Schema.object({
            checkInterval: koishi_1.Schema.number().description("版本检查间隔（分钟）").default(30),
            groups: koishi_1.Schema.array(koishi_1.Schema.string()).role("table").description("接收版本更新通知的群组ID列表").default([])
        }).description("TMP版本更新查询配置"),
        steamApi: koishi_1.Schema.object({
            key: koishi_1.Schema.string().description("Steam API Key，用于查询游戏时长")
        }).description("Steam API配置"),
        mainSettings: koishi_1.Schema.object({
            settings: koishi_1.Schema.object({
                Name: koishi_1.Schema.string().description("车队名称"),
                platformVersion: koishi_1.Schema.union([
                    koishi_1.Schema.const("v1").description("车队平台V1.0"),
                    koishi_1.Schema.const("v2").description("车队平台V2.0")
                ]).default("v1").description("车队平台版本"),
                url: koishi_1.Schema.string().description("API服务器地址（不含协议）"),
                token: koishi_1.Schema.string().description("API认证令牌"),
                logOutput: koishi_1.Schema.boolean().description("是否输出日志").default(true),
                mailEnabled: koishi_1.Schema.boolean().description("【V2.0】重置密码后发送邮件（需启用 adapter-mail）").default(false),
                mailTo: koishi_1.Schema.string().description("【V2.0】重置密码通知邮箱（自定义邮箱地址）").default(""),
                mailSubject: koishi_1.Schema.string().description("【V2.0】重置密码邮件标题").default("重置密码通知"),
                mailTemplate: koishi_1.Schema.string().description("【V2.0】重置密码邮件内容模板，支持变量：{uid} {qq} {password} {psw}").default("我们已将您平台的密码进行重置，您的账号:{uid},新的密码为：{psw} 请妥善保管好您的密码，以防泄露"),
                mailFromName: koishi_1.Schema.string().description("【V2.0】重置密码邮件发件人名字（覆盖 adapter-mail 的 name）").default(""),
            }).description("车队平台配置")
        }).description("车队平台配置"),
        resetPassword: koishi_1.Schema.object({
            settings: koishi_1.Schema.object({
                adminUsers: koishi_1.Schema.array(koishi_1.Schema.string()).description("管理员用户ID（拥有重置任意teamId权限）").default([])
            })
        }).description("重置密码功能配置"),
        changePoint: koishi_1.Schema.object({
            settings: koishi_1.Schema.object({
                adminUsers: koishi_1.Schema.array(koishi_1.Schema.string()).description("管理员用户ID（拥有积分修改权限）").default([])
            })
        }).description("积分修改功能配置"),
        addMember: koishi_1.Schema.object({
            settings: koishi_1.Schema.object({
                adminUsers: koishi_1.Schema.array(koishi_1.Schema.string()).description("管理员用户ID（拥有新增成员权限）").default([]),
                teamNumberGenerateEnable: koishi_1.Schema.boolean().default(true).description("自动生成车队编号（关闭后需手动输入车队编号）")
            })
        }).description("新增成员功能配置"),
        tmpActivityService: koishi_1.Schema.object({
            api: koishi_1.Schema.object({
                vtcId: koishi_1.Schema.string().description("VTC ID（用于TMP API）").default("")
            }).description("API配置"),
            admin: koishi_1.Schema.object({
                checkTimes: koishi_1.Schema.array(koishi_1.Schema.string()).role("table").description("活动检查时间（HH:mm格式）").default(["08:00", "12:00", "14:00", "20:00"]),
                sendTimes: koishi_1.Schema.array(koishi_1.Schema.string()).role("table").description("信息发送时间（HH:mm格式）").default(["08:05", "12:05", "14:05", "20:05"]),
                autoClockCheckTimes: koishi_1.Schema.array(koishi_1.Schema.string()).role("table").description("自动打卡检查时间（HH:mm格式）").default(["09:00"]),
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
            onlineCheck: koishi_1.Schema.object({
                enable: koishi_1.Schema.boolean().description("启用今日有活动时的在线成员检查").default(false),
                time: koishi_1.Schema.string().description("在线成员检查发送时间（HH:mm格式）").default("20:30"),
                apiUrl: koishi_1.Schema.string().description("在线成员查询API地址（含vtcId参数）")
            }).description("在线成员检查配置"),
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


function logDisabledCommands(ctx, cfg) {
    const commandFlags = cfg.commands || {};
    const enabled = [];
    const commandList = [
        { key: 'tmpQuery', label: '查询/绑定' },
        { key: 'tmpServer', label: '美卡/欧卡服务器' },
        { key: 'tmpTraffic', label: '路况' },
        { key: 'tmpPosition', label: '定位' },
        { key: 'tmpVersion', label: 'tmp版本' },
        { key: 'tmpDlcMap', label: '地图dlc价格' },
        { key: 'tmpMileageRanking', label: '里程排行榜/今日里程排行榜' },
        { key: 'tmpVtcMileageRanking', label: 'vtc里程排行榜/vtc今日里程排行榜' },
        { key: 'pointRanking', label: '积分排行榜' },
        { key: 'tmpVtc', label: 'vtc查询' },
        { key: 'tmpVtcOnline', label: '车队在线成员' },
        { key: 'tmpFootprint', label: '足迹查询' },
        { key: 'resetPassword', label: '重置密码' },
        { key: 'mainSettings', label: '查询积分' },
        { key: 'tmpActivityService', label: '车队活动查询' },
        { key: 'tmpVersionCheck', label: 'TMP版本更新查询' },
        { key: 'tmpQueryGameTime', label: '游戏时长查询' }
    ];
    for (const item of commandList) {
        if (commandFlags[item.key] !== false) enabled.push(item.label);
    }
    if (enabled.length) {
        ctx.logger.info(`[TMP-BOT] 已启用以下功能: ${enabled.join(', ')}`);
    }
}

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

    if (cfg.commands?.tmpQuery) {
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

    if (cfg.commands?.tmpVtcMileageRanking) {
        ctx.command('vtc里程排行榜')
            .usage("查询车队总里程排行榜")
            .action(async ({ session }) => await commands.tmpVtcMileageRanking(ctx, cfg, session, MileageRankingType.total));

        ctx.command('vtc今日里程排行榜')
            .usage("查询车队今日里程排行榜")
            .action(async ({ session }) => await commands.tmpVtcMileageRanking(ctx, cfg, session, MileageRankingType.today));
    }

    if (cfg.commands?.pointRanking) {
        ctx.command('积分排行')
            .usage("查询车队积分排行榜（仅限总群和管理群使用）")
            .action(async ({ session }) => await commands.pointRanking(ctx, cfg, session));
    }

    if (cfg.commands?.tmpVtc) {
        ctx.command('vtc查询 <vtcid>')
            .usage("查询TruckersMP VTC信息")
            .action(async ({ session }, vtcid) => await commands.tmpVtc(ctx, cfg, session, vtcid));
    }

    if (cfg.commands?.tmpVtcOnline) {
        ctx.command('车队在线成员')
            .usage('查询车队在线成员列表')
            .action(async () => await commands.tmpVtcOnline(ctx, cfg));
    }

    if (cfg.commands?.tmpFootprint) {
        ctx.command('近一年足迹 [tmpId:string]')
            .usage("查询ETS服务器今日足迹")
            .example("近一年足迹")
            .example("近一年足迹 12345")
            .action(async ({ session }, tmpId) => await commands.tmpFootprint(ctx, session, ServerType.ets, tmpId, 'year'));

        ctx.command('近一年足迹p [tmpId:string]')
            .usage("查询Promods服务器今日足迹")
            .example("近一年足迹p")
            .example("近一年足迹p 12345")
            .action(async ({ session }, tmpId) => await commands.tmpFootprint(ctx, session, ServerType.promods, tmpId, 'year'));

        ctx.command('近一个月足迹 [tmpId:string]')
            .usage("查询ETS服务器今日足迹")
            .example("近一个月足迹")
            .example("近一个月足迹 12345")
            .action(async ({ session }, tmpId) => await commands.tmpFootprint(ctx, session, ServerType.ets, tmpId, 'month'));

        ctx.command('近一个月足迹p [tmpId:string]')
            .usage("查询Promods服务器今日足迹")
            .example("近一个月足迹p")
            .example("近一个月足迹p 12345")
            .action(async ({ session }, tmpId) => await commands.tmpFootprint(ctx, session, ServerType.promods, tmpId, 'month'));

        ctx.command('近七日足迹 [tmpId:string]')
            .usage("查询ETS服务器今日足迹")
            .example("近七日足迹")
            .example("近七日足迹 12345")
            .action(async ({ session }, tmpId) => await commands.tmpFootprint(ctx, session, ServerType.ets, tmpId, 'sevenday'));

        ctx.command('近七日足迹p [tmpId:string]')
            .usage("查询Promods服务器今日足迹")
            .example("近七日足迹p")
            .example("近七日足迹p 12345")
            .action(async ({ session }, tmpId) => await commands.tmpFootprint(ctx, session, ServerType.promods, tmpId, 'sevenday'));

        ctx.command('昨日足迹 [tmpId:string]')
            .usage("查询ETS服务器今日足迹")
            .example("昨日足迹")
            .example("昨日足迹 12345")
            .action(async ({ session }, tmpId) => await commands.tmpFootprint(ctx, session, ServerType.ets, tmpId, 'yesterday'));

        ctx.command('昨日足迹p [tmpId:string]')
            .usage("查询Promods服务器今日足迹")
            .example("昨日足迹p")
            .example("昨日足迹p 12345")
            .action(async ({ session }, tmpId) => await commands.tmpFootprint(ctx, session, ServerType.promods, tmpId, 'yesterday'));

        ctx.command('今日足迹 [tmpId:string]')
            .usage("查询ETS服务器今日足迹")
            .example("今日足迹")
            .example("今日足迹 12345")
            .action(async ({ session }, tmpId) => await commands.tmpFootprint(ctx, session, ServerType.ets, tmpId, 'today'));

        ctx.command('今日足迹p [tmpId:string]')
            .usage("查询Promods服务器今日足迹")
            .example("今日足迹p")
            .example("今日足迹p 12345")
            .action(async ({ session }, tmpId) => await commands.tmpFootprint(ctx, session, ServerType.promods, tmpId, 'today'));
    }

    if (cfg.commands?.resetPassword) {
        ctx.command(`重置密码 [targetTeamId:string] [password:string]`, "重置欧卡车队平台密码")
            .usage("V1.0使用teamId，V2.0使用QQ号；管理员可用 uid=12345；V2.0可指定新密码")
            .example(`重置密码 - 重置自己的密码`)
            .example(`重置密码 789 - 管理员重置指定teamId的密码`)
            .example(`重置密码 123456 Abc123def4 - V2.0指定QQ与新密码`)
            .action(async ({ session }, targetTeamId, password) => await commands.resetPassword(ctx, cfg, session, targetTeamId, password));
    }

    if (cfg.commands?.mainSettings) {
        ctx.command(`查询积分 [targetQQ:string]`, "查询欧卡车队平台积分")
            .usage("查询自己或指定QQ号的积分，在群聊中可@他人查询")
            .example(`查询积分 - 查询自己的积分`)
            .example(`查询积分 123456 - 查询指定QQ号的积分`)
            .action(async ({ session }, targetQQ) => await commands.queryPoint(ctx, cfg, session, targetQQ));
    }

    if (cfg.commands?.changePoint) {
        ctx.command(`积分修改 <target:string> <changeType:string> <quantity:string> <reason:string>`, "修改欧卡车队平台积分")
            .usage("管理员专用。changeType: 增加 或 减少。target可输入车队编号(V1)或UID(V2)或@群成员。reason为备注原因(V1必填)")
            .example(`积分修改 @某人 增加 10 活动奖励 - 增加@某人10积分，备注活动奖励`)
            .example(`积分修改 5 减少 5 违规扣分 - 减少车队编号5的用户5积分，备注违规扣分`)
            .action(async ({ session }, target, changeType, quantity, reason) => await commands.changePoint(ctx, cfg, session, target, changeType, quantity, reason));
    }

    if (cfg.commands?.addMember) {
        ctx.command(`新增成员 <tmpId:string> <qq:string> [teamNumber:string]`, "新增车队平台成员")
            .usage("管理员专用。qq可输入QQ号或@群成员。若关闭自动生成车队编号则需手动输入teamNumber")
            .example(`新增成员 12345 79887143 - 自动生成车队编号`)
            .example(`新增成员 12345 @某人 5 - 手动指定车队编号为5`)
            .action(async ({ session }, tmpId, qq, teamNumber) => await commands.addMember(ctx, cfg, session, tmpId, qq, teamNumber));
    }

    ctx.command('规则查询')
        .action(async () => 'TruckersMP官方规则链接：https://truckersmp.com/knowledge-base/article/746');
}

function apply(ctx, cfg) {
    // 初始化 API 请求日志（调试模式开启后，truckersmp/trucky 等接口会输出请求与错误日志）
    apiLog.init(ctx, cfg.debugMode, cfg.apiRetryCount);

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

    logDisabledCommands(ctx, cfg);

    if (cfg.commands?.tmpActivityService) {
        const activityConfig = {
            ...cfg.tmpActivityService,
            debugMode: cfg.debugMode,
            debug: cfg.tmpActivityService.debug,
            mainSettings: cfg.mainSettings?.settings || {}
        };
        const activityService = new ActivityService(ctx, activityConfig);
        activityService.start();
    } else if (cfg.debugMode) {
        ctx.logger.debug("[TMP-BOT] 活动查询功能已禁用");
    }

    if (cfg.commands?.tmpVersionCheck) {
        const { VersionCheckService } = require('./command/tmpVersionCheck');
        const versionCheckConfig = {
            checkInterval: cfg.tmpVersionCheck.checkInterval,
            groups: cfg.tmpVersionCheck.groups,
            debugMode: cfg.debugMode,
            debug: cfg.tmpActivityService?.debug
        };
        const versionCheckService = new VersionCheckService(ctx, versionCheckConfig);
        versionCheckService.start();
    } else if (cfg.debugMode) {
        ctx.logger.debug("[TMP-BOT] TMP版本更新查询功能已禁用");
    }
}
__name(apply, "apply");
0 && (module.exports = {
    Config,
    apply,
    name
});
