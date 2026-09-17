const resetPasswordV1 = require("./resetPasswordV1");

module.exports = async (ctx, cfg, session, targetTeamId, password) => {
  return await resetPasswordV1(ctx, cfg, session, targetTeamId, password);
};
