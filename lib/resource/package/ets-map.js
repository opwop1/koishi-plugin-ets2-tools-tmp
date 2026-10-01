let mapConfig = {
  ets: {
    tileUrl: 'https://ets_tiles.cnly.top/20260903/tmp-ets-yellow/Tiles/{z}/{x}/{y}.png',
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
    tileUrl: 'https://ets_tiles.cnly.top/20260903/tmp-promods-yellow/Tiles/{z}/{x}/{y}.png',
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
  },
  // 美卡（ATS）：换算参数来自瓦片导出配置 TileMapInfo.json
  // （游戏坐标 x∈[-120098.891, 41144.094] y∈[-79127.37, 82115.62] 线性铺满 131072 网格）
  ats: {
    tileUrl: 'https://ets_tiles.cnly.top/20260903/tmp-ats-yellow/Tiles/{z}/{x}/{y}.png',
    multipliers: {
      x: 97626.58,
      y: 64321.45
    },
    breakpoints: {},
    bounds: {
      y: 131072,
      x: 131072
    },
    maxZoom: 8,
    minZoom: 0,
    // 游戏地转地图坐标
    calculateMapCoordinate (x, y) {
      return [
        x / 1.230185 + mapConfig.ats.multipliers.x,
        y / 1.230185 + mapConfig.ats.multipliers.y
      ];
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
