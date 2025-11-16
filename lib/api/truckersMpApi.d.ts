/**
 * 查询玩家信息
 */
export function player(http: any, tmpId: any): Promise<{
    error: any;
}>;
/**
 * 查询服务器列表
 */
export function servers(http: any): Promise<{
    error: any;
}>;
/**
 * 查询玩家封禁信息
 */
export function bans(http: any, tmpId: any): Promise<{
    error: any;
}>;
/**
 * 游戏版本
 */
export function version(http: any): Promise<{
    error: boolean;
    data?: undefined;
} | {
    error: boolean;
    data: any;
}>;
/**
 * 查询车队成员信息
 */
export function vtcMember(http: any, vtcId: any, memberId: any): Promise<{
    error: any;
}>;
