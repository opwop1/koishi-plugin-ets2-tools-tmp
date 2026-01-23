let mapConfig = {
  ets: {
    tileUrl: 'https://ets-map.oss-cn-beijing.aliyuncs.com/ets2/05102019/{z}/{x}/{y}.png',
    multipliers: {
      x: 70272,
      y: 76157
    },
    breakpoints: {
      uk: {
        x: -31056.8,
        y: -5832.867
      }
    },
    bounds: {
      y: 131072,
      x: 131072
    },
    maxZoom: 8,
    minZoom: 2,
    // 游戏地转地图坐标
    calculateMapCoordinate (x, y) {
      return [
        x / 1.609055 + mapConfig.ets.multipliers.x,
        y / 1.609055 + mapConfig.ets.multipliers.y
      ];
    }
  },
  promods: {
    tileUrl: 'https://ets-map.oss-cn-beijing.aliyuncs.com/promods/05102019/{z}/{x}/{y}.png',
    multipliers: {
      x: 51953,
      y: 76024
    },
    breakpoints: {
      uk: {
        x: -31056.8,
        y: -5832.867
      }
    },
    bounds: {
      y: 131072,
      x: 131072
    },
    maxZoom: 8,
    minZoom: 2,
    // 游戏地转地图坐标
    calculateMapCoordinate (x, y) {
      return [
        x / 2.598541 + mapConfig.promods.multipliers.x,
        y / 2.598541 + mapConfig.promods.multipliers.y
      ]
    }
  }
}

// 定义地图
let map = L.map('map', {
  attributionControl: false,
  crs: L.CRS.Simple,
  zoomControl: false,
  zoomSnap: 0.2,
  zoomDelta: 0.2
});
