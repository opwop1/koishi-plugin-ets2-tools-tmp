const resetPasswordV1 = require("./resetPasswordV1");
const resetPasswordV2 = require("./resetPasswordV2");

module.exports = async (ctx, cfg, session, targetTeamId, password) => {
  const { platformVersion } = cfg.mainSettings?.settings || {};
  const platform = (platformVersion || "v1").toLowerCase();

  switch (platform) {
    case "v2": {
      let actualPassword = password;
      if (targetTeamId && !password && !/^\d+$/.test(targetTeamId)) {
        actualPassword = targetTeamId;
        targetTeamId = undefined;
      }
      return await resetPasswordV2(ctx, cfg, session, actualPassword);
    }
    default:
      return await resetPasswordV1(ctx, cfg, session, targetTeamId, password);
  }
};
