import { Context, Schema } from 'koishi';
export declare const name = "tmp-bot";
export declare const inject: {
    required: string[];
    optional: string[];
};
export interface Config {
    baiduTranslateEnable: boolean;
    baiduTranslateAppId: string;
    baiduTranslateKey: string;
    baiduTranslateCacheEnable: boolean;
    adminUseHttps: boolean;
    adminApiUrl: string;
    adminApiToken: string;
    adminVtcId: string;
    adminCheckTimes: string[];
    adminSendTimes: string[];
    adminGroups: string[];
    adminServerSource: string;
    adminStartPointSource: string;
    adminEndPointSource: string;
    adminShowBanner: boolean;
    adminProfileUploadedMessage: string;
    adminProfileNotUploadedMessage: string;
    mainGroups: string[];
    mainActivityReminderMessage: string;
    mainActivityReminderTimes: number[];
    debugMode: boolean;
    logApiResponses: boolean;
    logTimingDetails: boolean;
    logActivityMatching: boolean;
    logMessageSending: boolean;
}
export declare const Config: Schema<Config>;
export declare function apply(ctx: Context, cfg: Config): void;
