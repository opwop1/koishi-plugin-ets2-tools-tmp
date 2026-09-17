const changePointV1 = require("./changePointV1");

module.exports = async (ctx, cfg, session, target, changeType, quantity, reason) => {
  return await changePointV1(ctx, cfg, session, target, changeType, quantity, reason);
};
