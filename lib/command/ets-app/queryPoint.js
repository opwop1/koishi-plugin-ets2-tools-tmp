module.exports = async (ctx, cfg, session, targetQQ) => {
  const { url, token, logOutput } = cfg.mainSettings;
  let queryQQ = targetQQ;
  if (!queryQQ) {
    queryQQ = session.userId;
  } else {
    if (queryQQ.startsWith("<at ")) {
      if (queryQQ.startsWith('<at ')) {
        queryQQ = queryQQ.replace('<at ', '');
      }
      let id = '';
      const idStart = queryQQ.indexOf('id="');
      if (idStart !== -1) {
        const valueStart = idStart + 4;
        const valueEnd = queryQQ.indexOf('"', valueStart);
        if (valueEnd !== -1) {
          id = queryQQ.substring(valueStart, valueEnd);
        }
      }
      queryQQ = id;
    }
    if (!/^\d+$/.test(queryQQ)) {
      return "QQ号格式不正确，请输入纯数字QQ号";
    }
  }
  try {
    if (logOutput) {
      ctx.logger.info(`开始查询用户 ${queryQQ} 的积分`);
    }
    const userInfoUrl = `https://${url}/api/user/info/list?token=${token}&page=0&limit=7&tmpId=&tmpName=&teamId=&qq=${queryQQ}&state=0&teamRole=`;
    if (logOutput) {
      ctx.logger.info(`请求用户信息: ${userInfoUrl}`);
    }
    const userInfoResponse = await ctx.http.post(userInfoUrl);
    if (logOutput) {
      ctx.logger.info(`用户信息响应: ${JSON.stringify(userInfoResponse)}`);
    }
    if (userInfoResponse.code !== 0) {
      return `获取用户信息失败: ${userInfoResponse.msg || "未知错误"}`;
    }
    const userList = userInfoResponse.page?.list || [];
    if (userList.length === 0) {
      return `未找到QQ号 ${queryQQ} 关联的用户信息`;
    }
    const userInfo = userList[0];
    const rewardPoints = userInfo.rewardPoints || 0;
    const tmpName = userInfo.tmpName || "未知用户";
    const teamRole = userInfo.teamRole || "未知职位";
    const teamId = userInfo.teamId || "未知编号";
    let message = `🚛 晚风车队平台 - 积分查询🚚
`;
    message += `👤 用户: ${tmpName}
`;
    message += `🆔 车队编号: ${teamId}
`;
    message += `📧 QQ: ${queryQQ}
`;
    message += `🏆 职位: ${teamRole}
`;
    message += `⭐ 当前积分: ${rewardPoints}
`;
    message += `📅 加入日期: ${userInfo.joinDate || "未知"}`;
    return message;
  } catch (error) {
    ctx.logger.error(`积分查询过程出错: ${error}`);
    if (error.response) {
      return `请求失败: ${error.response.status} ${error.response.statusText}`;
    } else if (error.code) {
      return `网络错误: ${error.code}`;
    } else {
      return "系统错误，请稍后重试";
    }
  }
};