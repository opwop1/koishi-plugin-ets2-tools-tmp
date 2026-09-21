module.exports = {
  /**
   * 路况信息展示方式
   */
  TmpTrafficType: {
    text: 1, // 文本
    heatMap: 2, // 热力图
  },
  /**
   * 里程排行榜类型
   */
  MileageRankingType: {
    total: 1,
    today: 2
  },
  /**
   * 服务器别名映射ID
   */
  ServerAliasToId: {
    's1': 2,
    's2': 41,
    'p': 50,
    'a': 7
  },
  /**
   * P服务器ID集合
   */
  PromodsIds: [50, 51],
  /**
   * 服务器类型
   */
  ServerType: {
    ets: 1,
    promods: 2
  },
  /**
   * 联运部接龙：每天发布的时间
   */
  LeadRoleCallTime: { hour: 15, minute: 0 },
  /**
   * 联运部接龙：默认消息模板，支持变量 {date} 日期、{name} 活动名称
   */
  LeadRoleCallMessage: [
    '@全体成员 {date}{name}接龙',
    '头车：',
    '备头：',
    '中车：',
    '备尾：',
    '尾车：',
    '中途档：'
  ].join('\n')
}