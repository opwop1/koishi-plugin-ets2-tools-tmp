/**
 * 查询线上信息
 */
export function online(http: any, tmpId: any): Promise<{
    error: any;
}>;
/**
 * 查询热门交通数据
 */
export function trafficTop(http: any, serverName: any): Promise<{
    error: boolean;
}>;
