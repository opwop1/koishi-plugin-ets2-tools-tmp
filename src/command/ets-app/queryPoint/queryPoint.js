const queryPointV1 = require("./queryPointV1");

module.exports = async (ctx, cfg, session, targetQQ) => {
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

  return await queryPointV1(ctx, cfg, queryQQ);
};
