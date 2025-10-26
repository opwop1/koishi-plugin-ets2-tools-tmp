module.exports = async (ctx, cfg, session, targetTeamId) => {
    const { url, token, logOutput } = cfg.mainSettings;
    const { adminUsers } = cfg.resetPassword;
    const currentUserQQ = session.userId;
    const isAdmin = adminUsers.includes(currentUserQQ);
    if (session.channelId !== `private:${session.userId}`) {
        let qq = targetTeamId;
        try {
            if (!isAdmin) {
                return "您没有权限重置其他用户的密码，请联系管理员重置";
            }
            if (qq.startsWith("<at ")) {    
                if (qq.startsWith('<at ')) {
                    qq = qq.replace('<at ', '');
                }
                let id = '';
                const idStart = qq.indexOf('id="');
                if (idStart !== -1) {
                    const valueStart = idStart + 4;
                    const valueEnd = qq.indexOf('"', valueStart);
                    if (valueEnd !== -1) {
                        id = qq.substring(valueStart, valueEnd);
                    }
                }
                queryQQ = id;
                if (!/^\d+$/.test(queryQQ)) {
                    return "获取qq号错误，请使用车队编号重置";
                }
                if (logOutput) {
                    ctx.logger.info(`管理员 ${currentUserQQ} 请求重置 qq号 ${queryQQ} 的密码`);
                }
                const verifyUrl = `https://${url}/api/user/info/list?token=${token}&page=0&limit=1&tmpId=&tmpName=&teamId=&qq=${queryQQ}&state=0&teamRole=`;
                const verifyResponse = await ctx.http.post(verifyUrl);
                if (verifyResponse.code !== 0 || !verifyResponse.page?.list?.length) {
                    return `未找到qq号为 ${queryQQ} 的用户信息`;
                }
                const userInfo = verifyResponse.page.list[0];
                if (logOutput) {
                    ctx.logger.info(`目标用户信息: ${userInfo.tmpName} (QQ: ${userInfo.qq})`);
                }
                const teamId = userInfo.teamId;
                const resetPasswordUrl = `https://${url}/api/user/info/resetPasswordWithTeamId?token=${token}&teamId=${teamId}`;
                if (logOutput) {
                    ctx.logger.info(`请求重置密码: ${resetPasswordUrl}`);
                }
                const resetResponse = await ctx.http.post(resetPasswordUrl);
                if (logOutput) {
                    ctx.logger.info(`重置密码响应: ${JSON.stringify(resetResponse)}`);
                }
                if (resetResponse.code === 0) {
                    if (targetTeamId) {
                        return `管理员操作：车队编号 ${teamId} 的密码重置成功！新密码已发送到用户邮箱。`;
                    } else {
                        return "密码重置成功！新密码已发送到您的邮箱，请查收。";
                    }
                } else {
                    return `密码重置失败: ${resetResponse.msg || "未知错误"}`;
                }
            }
            let teamId = qq;
            if (logOutput) {
                ctx.logger.info(`管理员 ${currentUserQQ} 请求重置 车队编号 ${teamId} 的密码`);
            }
            const verifyUrl = `https://${url}/api/user/info/list?token=${token}&page=0&limit=1&tmpId=&tmpName=&teamId=${teamId}&qq=&state=0&teamRole=`;
            const verifyResponse = await ctx.http.post(verifyUrl);
            if (verifyResponse.code !== 0 || !verifyResponse.page?.list?.length) {
                return `未找到车队编号为 ${teamId} 的用户信息`;
            }
            const userInfo = verifyResponse.page.list[0];
            if (logOutput) {
                ctx.logger.info(`目标用户信息: ${userInfo.tmpName} (QQ: ${userInfo.qq})`);
            }
            const resetPasswordUrl = `https://${url}/api/user/info/resetPasswordWithTeamId?token=${token}&teamId=${teamId}`;
            if (logOutput) {
                ctx.logger.info(`请求重置密码: ${resetPasswordUrl}`);
            }
            const resetResponse = await ctx.http.post(resetPasswordUrl);
            if (logOutput) {
                ctx.logger.info(`重置密码响应: ${JSON.stringify(resetResponse)}`);
            }
            if (resetResponse.code === 0) {
                if (targetTeamId) {
                    return `管理员操作：车队编号 ${teamId} 的密码重置成功！新密码已发送到用户邮箱。`;
                } else {
                    return "密码重置成功！新密码已发送到您的邮箱，请查收。";
                }
            } else {
                return `密码重置失败: ${resetResponse.msg || "未知错误"}`;
            }
        } catch (error) {
            ctx.logger.error(`密码重置过程出错: ${error}`);
            if (error.response) {
                return `请求失败: ${error.response.status} ${error.response.statusText}`;
            } else if (error.code) {
                return `网络错误: ${error.code}`;
            } else {
                return "系统错误，请稍后重试";
            }
        }
    }
    try {
        let teamId;
        if (!targetTeamId) {
            if (logOutput) {
                ctx.logger.info(`开始处理用户 ${currentUserQQ} 的密码重置请求`);
            }
            const userInfoUrl = `https://${url}/api/user/info/list?token=${token}&page=0&limit=7&tmpId=&tmpName=&teamId=&qq=${currentUserQQ}&state=0&teamRole=`;
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
                return "未找到与该QQ号关联的用户信息";
            }
            teamId = userList[0].teamId;
            if (!teamId) {
                return "在平台中未找到您的信息，请联系管理员重置密码";
            }
            if (logOutput) {
                ctx.logger.info(`找到用户 车队编号: ${teamId}`);
            }
        } else {
            if (!isAdmin) {
                return "您没有权限重置其他成员的密码，请联系管理员";
            }
            teamId = targetTeamId;
            if (logOutput) {
                ctx.logger.info(`管理员 ${currentUserQQ} 请求重置 车队编号 ${teamId} 的密码`);
            }
            const verifyUrl = `https://${url}/api/user/info/list?token=${token}&page=0&limit=1&tmpId=&tmpName=&teamId=${teamId}&qq=&state=0&teamRole=`;
            const verifyResponse = await ctx.http.post(verifyUrl);
            if (verifyResponse.code !== 0 || !verifyResponse.page?.list?.length) {
                return `未找到车队编号为 ${teamId} 的用户信息`;
            }
            const userInfo = verifyResponse.page.list[0];
            if (logOutput) {
                ctx.logger.info(`目标用户信息: ${userInfo.tmpName} (QQ: ${userInfo.qq})`);
            }
        }
        const resetPasswordUrl = `https://${url}/api/user/info/resetPasswordWithTeamId?token=${token}&teamId=${teamId}`;
        if (logOutput) {
            ctx.logger.info(`请求重置密码: ${resetPasswordUrl}`);
        }
        const resetResponse = await ctx.http.post(resetPasswordUrl);
        if (logOutput) {
            ctx.logger.info(`重置密码响应: ${JSON.stringify(resetResponse)}`);
        }
        if (resetResponse.code === 0) {
            if (targetTeamId) {
                return `管理员操作：车队编号 ${teamId} 的密码重置成功！新密码已发送到用户邮箱。`;
            } else {
                return "密码重置成功！新密码已发送到您的邮箱，请查收。";
            }
        } else {
            return `密码重置失败: ${resetResponse.msg || "未知错误"}`;
        }
    } catch (error) {
        ctx.logger.error(`密码重置过程出错: ${error}`);
        if (error.response) {
            return `请求失败: ${error.response.status} ${error.response.statusText}`;
        } else if (error.code) {
            return `网络错误: ${error.code}`;
        } else {
            return "系统错误，请稍后重试";
        }
    }
};