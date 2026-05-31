const changePointV1 = require("./changePointV1");
const changePointV2 = require("./changePointV2");

module.exports = async (ctx, cfg, session, target, changeType, quantity, reason) => {
  const { platformVersion } = cfg.mainSettings?.settings || {};
  const platform = (platformVersion || "v1").toLowerCase();

  switch (platform) {
    case "v2":
      return await changePointV2(ctx, cfg, session, target, changeType, quantity);
    default:
      return await changePointV1(ctx, cfg, session, target, changeType, quantity, reason);
  }
};
