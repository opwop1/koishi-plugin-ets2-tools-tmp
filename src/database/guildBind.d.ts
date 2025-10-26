/**
 * 获取绑定信息
 * @param db 数据源
 * @param platform 平台
 * @param userId 用户编号
 */
export function get(db: any, platform: any, userId: any): Promise<any>;
/**
 * 新增或更新绑定信息
 * @param db 数据源
 * @param platform 平台
 * @param userId 用户编号
 * @param tmpId TMP ID
 */
export function saveOrUpdate(db: any, platform: any, userId: any, tmpId: any): void;
