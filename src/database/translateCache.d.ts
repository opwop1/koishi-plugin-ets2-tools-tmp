/**
 * 查询翻译
 * @param db 数据源
 * @param contentMd5 文本MD5
 */
export function getTranslate(db: any, contentMd5: any): Promise<any>;
/**
 * 保存翻译缓存信息
 * @param db 数据源
 * @param contentMd5 原文文本MD5
 * @param content 原文文本
 * @param translateContent 翻译文本
 */
export function save(db: any, contentMd5: any, content: any, translateContent: any): void;
