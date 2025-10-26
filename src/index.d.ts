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
}
export declare const Config: Schema<Config>;
export declare function apply(ctx: Context, cfg: Config): void;
