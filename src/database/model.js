/**
 * 数据表声明
 */
const modelArray = {
    tmp_guild_bind: {
        id: {
            type: 'unsigned',
            length: 10,
            nullable: false,
            comment: '主键'
        },
        platform: {
            type: 'string',
            length: 50,
            nullable: false,
            comment: '所属平台'
        },
        user_id: {
            type: 'string',
            length: 50,
            nullable: false,
            comment: '用户编号'
        },
        tmp_id: {
            type: 'unsigned',
            length: 50,
            nullable: false,
            comment: 'TMP ID'
        }
    },
    tmp_translate_cache: {
        id: {
            type: 'unsigned',
            length: 10,
            nullable: false,
            comment: '主键'
        },
        content: {
            type: 'string',
            nullable: false,
            length: 200,
            comment: '原文文本'
        },
        content_md5: {
            type: 'string',
            nullable: false,
            length: 32,
            comment: '原文文本md5'
        },
        translate_content: {
            type: 'string',
            nullable: false,
            length: 200,
            comment: '翻译文本'
        }
    }
};
/**
 * 初始化数据库
 */
module.exports = (ctx) => {
    for (let modelName in modelArray) {
        ctx.model.extend(modelName, modelArray[modelName], { autoInc: true });
    }
};
