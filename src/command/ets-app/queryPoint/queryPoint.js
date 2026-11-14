const queryPointV1 = require("./queryPointV1");
const tmpIdPicker = require("../../../util/tmpIdPicker");
const qqOfficial = require("../../../util/qqOfficial");

module.exports = async (ctx, cfg, session, targetQQ) => {
  // QQ 官方机器人只能拿到 unionid，没有 QQ 号
  if (qqOfficial.isQQOfficial(session)) {
    const ident = qqOfficial.getQQIdentity(session);
    // 指定了目标（@某人 / QQ号）时官方机器人无法解析，明确提示而不是静默失败
    if (targetQQ) {
      return "QQ 官方机器人暂不支持查询他人积分，请让对方自己发送「查询积分」";
    }
    if (!ident.unionId) {
      return "未获取到你的 unionid，无法查询积分。请确认机器人已开通 unionid 权限";
    }
    return await queryPointV1(ctx, cfg, { unionid: ident.unionId });
  }

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

  return await queryPointV1(ctx, cfg, { qq: queryQQ });
};
