module.exports = {
    /**
     * 查询翻译
     * @param db 数据源
     * @param contentMd5 文本MD5
     */
    async getTranslate(db, contentMd5) {
        const translateCacheList = await db.get('tmp_translate_cache', {
            content_md5: contentMd5
        });
        // 如果查询到了缓存，直接返回翻译文本
        if (translateCacheList && translateCacheList.length > 0) {
            return translateCacheList[0].translate_content;
        }
        return null;
    },
    /**
     * 保存翻译缓存信息
     * @param db 数据源
     * @param contentMd5 原文文本MD5
     * @param content 原文文本
     * @param translateContent 翻译文本
     */
    save(db, contentMd5, content, translateContent) {
        db.create('tmp_translate_cache', {
            content,
            content_md5: contentMd5,
            translate_content: translateContent
        });
    }
};
