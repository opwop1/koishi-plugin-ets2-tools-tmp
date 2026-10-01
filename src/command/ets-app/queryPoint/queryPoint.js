const queryPointV1 = require("./queryPointV1");
const tmpIdPicker = require("../../../util/tmpIdPicker");

module.exports = async (ctx, cfg, session, targetQQ) => {
  let queryQQ = targetQQ;
  if (!queryQQ) {
    queryQQ = session.userId;
  } else {
    if (String(queryQQ).includes("<at ")) {
      const ats = tmpIdPicker.parseAt(queryQQ);
      const atUser = (Array.isArray(ats) && ats.length > 0) ? ats[0] : null;
      if (!atUser || !atUser.id) {
        return "无法识别@的用户，请输入纯数字QQ号";
      }
      queryQQ = atUser.id;
    }
    if (!/^\d+$/.test(String(queryQQ))) {
      return "QQ号格式不正确，请输入纯数字QQ号";
    }
  }

  return await queryPointV1(ctx, cfg, queryQQ);
};
