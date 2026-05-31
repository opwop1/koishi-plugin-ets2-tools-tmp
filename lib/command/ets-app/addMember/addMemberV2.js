const dayjs = require("dayjs");

module.exports = async (ctx, cfg, session, tmpId, qq, teamNumber) => {
    const { url, token, logOutput } = cfg.mainSettings?.settings || {};
    const { adminUsers, teamNumberGenerateEnable } = cfg.addMember?.settings || {};
    const currentUserQQ = session.userId;
    const isAdmin = adminUsers.includes(currentUserQQ);

    const log = (msg) => logOutput && ctx.logger.info(msg);

    const parseAtQQ = (raw) => {
        if (!raw?.startsWith("<at ")) return raw;
        const idStart = raw.indexOf('id="');
        if (idStart === -1) return "";
        const idEnd = raw.indexOf('"', idStart + 4);
        if (idEnd === -1) return "";
        return raw.substring(idStart + 4, idEnd);
    };

    try {
        if (!isAdmin) {
            return "您没有权限使用新增成员功能，请联系管理员";
        }

        if (!token) return "未配置车队平台V2.0 API认证令牌";

        if (!tmpId) {
            return "请输入TMP ID";
        }

        if (!qq) {
            return "请输入QQ号或@群成员";
        }

        const parsedQQ = parseAtQQ(qq) || qq;
        if (!/^\d+$/.test(parsedQQ)) {
            return "QQ号格式不正确，请输入纯数字QQ号";
        }

        const autoGenerate = teamNumberGenerateEnable !== false;
        if (!autoGenerate && !teamNumber) {
            return "自动生成车队编号已关闭，请输入车队编号";
        }

        const baseUrl = url || "open.vtcm.link";
        const email = `${parsedQQ}@qq.com`;
        const joinDate = dayjs().format("YYYY-MM-DD");

        const requestBody = {
            tmpId: Number(tmpId),
            teamNumberGenerateEnable: autoGenerate ? 1 : 0,
            qq: parsedQQ,
            email,
            joinDate,
            state: 1
        };

        if (!autoGenerate) {
            requestBody.teamNumber = Number(teamNumber);
        }

        const saveUrl = `https://${baseUrl}/members/save`;
        log(`[V2] 新增成员请求: ${saveUrl}, body: ${JSON.stringify(requestBody)}`);
        const response = await ctx.http.post(saveUrl, requestBody, { headers: { token } });
        log(`[V2] 新增成员响应: ${JSON.stringify(response)}`);

        if (response.code !== 200) {
            return response.msg || "新增成员失败";
        }

        let result = `新增成员成功！\n`;
        result += `TMP ID: ${tmpId}\n`;
        result += `QQ: ${parsedQQ}\n`;
        result += `邮箱: ${email}\n`;
        result += `加入日期: ${joinDate}\n`;
        if (!autoGenerate) {
            result += `车队编号: ${teamNumber}\n`;
        } else {
            result += `车队编号: 自动生成\n`;
        }
        return result;

    } catch (error) {
        ctx.logger.error(`[V2] 新增成员错误: ${error.message}`);
        if (error.response) {
            return `请求失败: ${error.response.status} ${error.response.statusText}`;
        } else if (error.code) {
            return `网络错误: ${error.code}`;
        } else {
            return "系统错误，请稍后重试";
        }
    }
};
