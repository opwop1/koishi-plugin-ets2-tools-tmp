function apply(ctx, config) {
  let todayActivities = [];
  let todayTMPEvents = [];
  const sentReminders = /* @__PURE__ */ new Set();
  const timers = [];
  const logger = {
    debug: /* @__PURE__ */ __name((message, ...args) => {
      if (config.debugMode) {
        ctx.logger.debug(`[DEBUG] ${message}`, ...args);
      }
    }, "debug"),
    info: /* @__PURE__ */ __name((message, ...args) => {
      ctx.logger.info(message, ...args);
    }, "info"),
    warn: /* @__PURE__ */ __name((message, ...args) => {
      ctx.logger.warn(message, ...args);
    }, "warn"),
    error: /* @__PURE__ */ __name((message, ...args) => {
      ctx.logger.error(message, ...args);
    }, "error"),
    api: /* @__PURE__ */ __name((message, data) => {
      if (config.logApiResponses) {
        ctx.logger.info(`[API] ${message}`, data ? JSON.stringify(data, null, 2) : "");
      }
    }, "api"),
    timing: /* @__PURE__ */ __name((message, data) => {
      if (config.logTimingDetails) {
        ctx.logger.info(`[TIMING] ${message}`, data || "");
      }
    }, "timing"),
    matching: /* @__PURE__ */ __name((message, data) => {
      if (config.logActivityMatching) {
        ctx.logger.info(`[MATCHING] ${message}`, data || "");
      }
    }, "matching"),
    message: /* @__PURE__ */ __name((message, data) => {
      if (config.logMessageSending) {
        ctx.logger.info(`[MESSAGE] ${message}`, data || "");
      }
    }, "message")
  };
  setupDailyTasks();
  function getNextTime(hours, minutes) {
    const now = /* @__PURE__ */ new Date();
    const target = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      hours,
      minutes,
      0,
      0
    );
    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
    }
    return target.getTime() - now.getTime();
  }
  __name(getNextTime, "getNextTime");
  function resetDailyData() {
    const previousActivityCount = todayActivities.length;
    const previousTMPCount = todayTMPEvents.length;
    const previousReminderCount = sentReminders.size;
    todayActivities = [];
    todayTMPEvents = [];
    sentReminders.clear();
    logger.debug(`每日数据已重置: 活动${previousActivityCount}→0, TMP${previousTMPCount}→0, 提醒${previousReminderCount}→0`);
    updateActivityData();
  }
  __name(resetDailyData, "resetDailyData");
  function setupDailyTasks() {
    logger.timing("开始设置每日定时任务");
    const resetHour = 2;
    const resetMinute = 0;
    const resetDelay = getNextTime(resetHour, resetMinute);
    const resetTimer = setTimeout(() => {
      logger.timing("执行每日数据重置");
      resetDailyData();
      const dailyResetTimer = setInterval(() => {
        logger.timing("执行每日数据重置");
        resetDailyData();
      }, import_koishi.Time.day);
      timers.push(dailyResetTimer);
    }, resetDelay);
    timers.push(resetTimer);
    logger.timing(`设置数据重置定时器: ${resetHour}:${resetMinute.toString().padStart(2, "0")}, 延迟: ${resetDelay}ms`);
    config.adminCheckTimes.forEach((timeStr, index) => {
      const [hours, minutes] = timeStr.split(":").map(Number);
      const setupTimer = /* @__PURE__ */ __name(() => {
        const delay = getNextTime(hours, minutes);
        const timer = setTimeout(() => {
          logger.timing(`执行定时检查任务 #${index + 1} (${timeStr})`);
          updateActivityData();
          const dailyTimer = setInterval(() => {
            logger.timing(`执行每日检查任务 #${index + 1} (${timeStr})`);
            updateActivityData();
          }, import_koishi.Time.day);
          timers.push(dailyTimer);
        }, delay);
        timers.push(timer);
        logger.timing(`设置检查定时器 #${index + 1}: ${timeStr}, 延迟: ${delay}ms`);
      }, "setupTimer");
      setupTimer();
    });
    config.adminSendTimes.forEach((timeStr, index) => {
      const [hours, minutes] = timeStr.split(":").map(Number);
      const setupTimer = /* @__PURE__ */ __name(() => {
        const delay = getNextTime(hours, minutes);
        const timer = setTimeout(() => {
          logger.timing(`执行定时发送任务 #${index + 1} (${timeStr})`);
          checkAndSendProfileReminders();
          const dailyTimer = setInterval(() => {
            logger.timing(`执行每日发送任务 #${index + 1} (${timeStr})`);
            checkAndSendProfileReminders();
          }, import_koishi.Time.day);
          timers.push(dailyTimer);
        }, delay);
        timers.push(timer);
        logger.timing(`设置发送定时器 #${index + 1}: ${timeStr}, 延迟: ${delay}ms`);
      }, "setupTimer");
      setupTimer();
    });
    const minuteTimer = setInterval(async () => {
      await checkAndSendActivityReminders();
    }, import_koishi.Time.minute);
    timers.push(minuteTimer);
    logger.timing("设置每分钟检查定时器");
    logger.debug("启动时立即更新活动数据");
    updateActivityData();
  }
  __name(setupDailyTasks, "setupDailyTasks");
  async function updateActivityData() {
    try {
      logger.debug("开始更新活动数据");
      const startTime = Date.now();
      await updateTodayActivities();
      await updateTodayTMPEvents();
      const duration = Date.now() - startTime;
      logger.info(`活动数据更新完成，耗时: ${duration}ms`);
      logger.debug(`今日活动数量: ${todayActivities.length}, TMP活动数量: ${todayTMPEvents.length}`);
    } catch (error) {
      logger.error("更新活动数据失败:", error);
    }
  }
  __name(updateActivityData, "updateActivityData");
  async function updateTodayActivities() {
    try {
      const protocol = config.adminUseHttps ? "https://" : "http://";
      const fullUrl = `${protocol}${config.adminApiUrl}/api/activity/info/list?token=${config.adminApiToken}&page=1&limit=50&themeName=`;
      logger.api(`请求车队平台API: ${fullUrl.replace(config.adminApiToken, "***")}`);
      const startTime = Date.now();
      const response = await ctx.http.get(fullUrl);
      const duration = Date.now() - startTime;
      logger.api(`车队平台API响应耗时: ${duration}ms, 状态码: ${response.code}`);
      if (config.logApiResponses) {
        logger.api("车队平台API响应详情:", {
          code: response.code,
          totalCount: response.data?.totalCount,
          listCount: response.data?.list?.length
        });
      }
      if (response.code === 0) {
        const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
        const originalCount = response.data.list.length;
        todayActivities = response.data.list.filter((activity) => {
          const activityDate = activity.startTime.split(" ")[0];
          return activityDate === today;
        });
        logger.info(`从车队平台找到 ${todayActivities.length}/${originalCount} 个今日活动`);
        logger.debug("今日活动列表:", todayActivities.map((a) => ({
          id: a.id,
          name: a.themeName,
          time: a.startTime,
          hasProfile: !!a.profileFile
        })));
      } else {
        logger.error(`车队平台API返回错误: ${response.msg} (代码: ${response.code})`);
      }
    } catch (error) {
      logger.error("获取活动列表失败:", error);
    }
  }
  __name(updateTodayActivities, "updateTodayActivities");
  async function updateTodayTMPEvents() {
    try {
      const tmpApiUrl = `https://api.truckersmp.com/v2/vtc/${config.adminVtcId}/events/attending/`;
      logger.api(`请求TMP API: ${tmpApiUrl}`);
      const startTime = Date.now();
      const response = await ctx.http.get(tmpApiUrl);
      const duration = Date.now() - startTime;
      logger.api(`TMP API响应耗时: ${duration}ms, 错误状态: ${response.error}`);
      if (!response.error) {
        const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
        const originalCount = response.response.length;
        todayTMPEvents = response.response.filter((event) => {
          const eventDate = event.start_at.split(" ")[0];
          return eventDate === today;
        });
        logger.info(`从TMP找到 ${todayTMPEvents.length}/${originalCount} 个今日活动`);
        if (config.logApiResponses) {
          logger.debug("TMP活动列表:", todayTMPEvents.map((e) => ({
            id: e.id,
            name: e.name,
            time: e.start_at,
            server: e.server.name
          })));
        }
      } else {
        logger.error("TMP API返回错误状态");
      }
    } catch (error) {
      logger.error("获取TMP活动失败:", error);
    }
  }
  __name(updateTodayTMPEvents, "updateTodayTMPEvents");
  async function checkAndSendProfileReminders() {
    if (todayActivities.length === 0) {
      logger.debug("今日没有活动，跳过档位检查");
      return;
    }
    logger.debug(`开始检查 ${todayActivities.length} 个活动的档位状态`);
    for (const activity of todayActivities) {
      const hasProfile = !!activity.profileFile;
      const message = hasProfile ? config.adminProfileUploadedMessage : config.adminProfileNotUploadedMessage;
      const fullMessage = `活动 "${activity.themeName}" - ${message}`;
      logger.message(`活动档位检查: "${activity.themeName}" - ${hasProfile ? "已上传" : "未上传"}`);
      for (const groupId of config.adminGroups) {
        try {
          await sendToGroup(groupId, fullMessage, "管理群组");
          logger.message(`已发送档位提醒到管理群组 ${groupId}: ${activity.themeName}`);
        } catch (error) {
          logger.error(`发送消息到管理群组 ${groupId} 失败:`, error);
        }
      }
    }
  }
  __name(checkAndSendProfileReminders, "checkAndSendProfileReminders");
  async function checkAndSendActivityReminders() {
    const now = /* @__PURE__ */ new Date();
    let remindersSent = 0;
    logger.debug(`检查 ${todayActivities.length} 个活动的提醒时间`);
    for (const activity of todayActivities) {
      const activityStartTime = new Date(activity.startTime);
      const timeDiff = activityStartTime.getTime() - now.getTime();
      const minutesLeft = Math.floor(timeDiff / (1e3 * 60));
      logger.debug(`活动 "${activity.themeName}" 剩余时间: ${minutesLeft} 分钟`);
      for (const reminderTime of config.mainActivityReminderTimes) {
        if (minutesLeft <= reminderTime && minutesLeft > reminderTime - 1) {
          const reminderKey = `${activity.id}_${reminderTime}`;
          if (!sentReminders.has(reminderKey)) {
            logger.debug(`触发提醒: ${activity.themeName} - ${reminderTime} 分钟前`);
            await sendActivityReminder(activity, minutesLeft);
            sentReminders.add(reminderKey);
            remindersSent++;
          } else {
            logger.debug(`提醒已发送过: ${activity.themeName} - ${reminderTime} 分钟前`);
          }
        }
      }
    }
    if (remindersSent > 0) {
      logger.debug(`本轮发送了 ${remindersSent} 个活动提醒`);
    }
  }
  __name(checkAndSendActivityReminders, "checkAndSendActivityReminders");
  async function sendActivityReminder(activity, minutesLeft) {
    const tmpEvent = todayTMPEvents.find(
      (event) => event.name.includes(activity.themeName) || activity.themeName.includes(event.name)
    );
    logger.matching(`活动匹配: "${activity.themeName}" - 找到TMP匹配: ${!!tmpEvent}`);
    if (tmpEvent && config.logActivityMatching) {
      logger.matching("TMP活动详情:", {
        tmpName: tmpEvent.name,
        activityName: activity.themeName,
        server: tmpEvent.server.name,
        departure: `${tmpEvent.departure.location} - ${tmpEvent.departure.city}`,
        arrive: `${tmpEvent.arrive.location} - ${tmpEvent.arrive.city}`
      });
    }
    const replacements = {
      name: activity.themeName,
      distance: activity.distance.toString(),
      timeLeft: minutesLeft.toString()
    };
    if (config.adminServerSource === "tmp" && tmpEvent) {
      replacements.server = tmpEvent.server.name;
      logger.debug(`使用TMP服务器信息: ${tmpEvent.server.name}`);
    } else {
      replacements.server = activity.serverName || "未知服务器";
      logger.debug(`使用平台服务器信息: ${replacements.server}`);
    }
    if (config.adminStartPointSource === "tmp" && tmpEvent) {
      replacements.startingPoint = `${tmpEvent.departure.location} - ${tmpEvent.departure.city}`;
      logger.debug(`使用TMP起点信息: ${replacements.startingPoint}`);
    } else {
      replacements.startingPoint = activity.startingPoint;
      logger.debug(`使用平台起点信息: ${replacements.startingPoint}`);
    }
    if (config.adminEndPointSource === "tmp" && tmpEvent) {
      replacements.terminalPoint = `${tmpEvent.arrive.location} - ${tmpEvent.arrive.city}`;
      logger.debug(`使用TMP终点信息: ${replacements.terminalPoint}`);
    } else {
      replacements.terminalPoint = activity.terminalPoint;
      logger.debug(`使用平台终点信息: ${replacements.terminalPoint}`);
    }
    if (config.adminShowBanner && tmpEvent && tmpEvent.banner) {
      replacements.banner = tmpEvent.banner;
      logger.debug(`使用活动横幅: ${tmpEvent.banner}`);
    } else {
      replacements.banner = "无";
      logger.debug("未使用活动横幅");
    }
    let message = config.mainActivityReminderMessage;
    for (const [key, value] of Object.entries(replacements)) {
      message = message.replace(new RegExp(`{${key}}`, "g"), value);
    }
    if (!config.adminShowBanner) {
      message = message.replace(/活动横幅:.*?\n?/, "");
    }
    message = message.replace(/\\n/g, "\n");
    const fullMessage = `@全体成员
${message}`;
    logger.message(`准备发送活动提醒: ${activity.themeName} (${minutesLeft}分钟前)`);
    logger.debug("完整消息内容:", fullMessage);
    for (const groupId of config.mainGroups) {
      try {
        await sendToGroup(groupId, fullMessage, "主群组");
        logger.message(`已发送活动提醒到主群组 ${groupId}: ${activity.themeName}`);
      } catch (error) {
        logger.error(`发送活动提醒到主群组 ${groupId} 失败:`, error);
      }
    }
  }
  __name(sendActivityReminder, "sendActivityReminder");
  async function sendToGroup(groupId, message, groupType) {
    const availableBots = ctx.bots.filter((bot) => {
      if (bot.platform === "mail") return false;
      const unsupportedPlatforms = ["mail", "telegram", "discord"];
      if (unsupportedPlatforms.includes(bot.platform)) return false;
      return true;
    });
    if (availableBots.length === 0) {
      throw new Error(`没有可用的聊天平台适配器，当前只有邮件适配器`);
    }
    let lastError = null;
    logger.debug(`尝试通过 ${availableBots.length} 个适配器发送消息到${groupType} ${groupId}`);
    for (const bot of availableBots) {
      try {
        await bot.sendMessage(groupId, message);
        logger.debug(`已通过 ${bot.platform} 适配器发送消息到${groupType} ${groupId}`);
        return;
      } catch (error) {
        lastError = error;
        logger.warn(`通过 ${bot.platform} 适配器发送消息到${groupType} ${groupId} 失败: ${error.message}`);
      }
    }
    throw lastError || new Error(`所有适配器都无法发送消息到${groupType} ${groupId}`);
  }
  __name(sendToGroup, "sendToGroup");
  ctx.command("活动查询", "手动检查今日活动").action(async () => {
    logger.debug("手动执行活动检查命令");
    await updateActivityData();
    const result = `检查完成！您的车队平台写入的今日活动: ${todayActivities.length} 个, 您的TMP今日参与了 ${todayTMPEvents.length} 个活动`;
    logger.debug(result);
    return result;
  });
  ctx.command("活动DEBUG", "查看插件调试信息").action(() => {
    const state = {
      todayActivities: todayActivities.length,
      todayTMPEvents: todayTMPEvents.length,
      sentReminders: sentReminders.size,
      timers: timers.length,
      config: {
        debugMode: config.debugMode,
        logApiResponses: config.logApiResponses,
        logTimingDetails: config.logTimingDetails,
        logActivityMatching: config.logActivityMatching,
        logMessageSending: config.logMessageSending
      }
    };
    let message = "插件调试信息:\n";
    message += `今日活动: ${state.todayActivities} 个
`;
    message += `TMP活动: ${state.todayTMPEvents} 个
`;
    message += `已发送提醒: ${state.sentReminders} 个
`;
    message += `活跃定时器: ${state.timers} 个
`;
    message += `调试模式: ${state.config.debugMode ? "开启" : "关闭"}
`;
    message += `日志选项: API=${state.config.logApiResponses}, 定时=${state.config.logTimingDetails}, 匹配=${state.config.logActivityMatching}, 消息=${state.config.logMessageSending}`;
    return message;
  });
  ctx.command("重置数据", "手动重置今日数据").action(() => {
    logger.debug("手动执行数据重置命令");
    resetDailyData();
    return "活动数据已重置";
  });
  ctx.on("dispose", () => {
    logger.debug("插件卸载，开始清理资源");
    todayActivities = [];
    todayTMPEvents = [];
    sentReminders.clear();
    timers.forEach((timer) => {
      clearTimeout(timer);
      clearInterval(timer);
    });
    timers.length = 0;
    logger.debug("资源清理完成");
  });
}
__name(apply, "apply");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Config,
  apply,
  name
});