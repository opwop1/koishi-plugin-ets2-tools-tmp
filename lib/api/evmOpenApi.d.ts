/**
 * 查询服务器列表
 */
export function serverList(http: any): Promise<{
    error: boolean;
}>;
/**
 * 查询在线玩家
 */
export function mapPlayerList(http: any, serverId: any, ax: any, ay: any, bx: any, by: any): Promise<{
    error: boolean;
}>;
/**
 * 查询玩家信息
 */
export function playerInfo(http: any, tmpId: any): Promise<{
    code: any;
    error: boolean;
} | {
    error: boolean;
}>;
/**
 * DLC列表
 */
export function dlcList(http: any, type: any): Promise<{
    error: boolean;
}>;
/**
 * 玩家里程排行
 */
export function mileageRankingList(http: any, rankingType: any, tmpId: any): Promise<{
    error: boolean;
}>;
