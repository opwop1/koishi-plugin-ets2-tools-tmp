let mapConfig = {
  ets: {
    tileUrl: 'https://ets_tiles.114512.xyz/20260903/tmp-ets-yellow/Tiles/{z}/{x}/{y}.png',
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
    tileUrl: 'https://ets_tiles.114512.xyz/20260903/tmp-promods-yellow/Tiles/{z}/{x}/{y}.png',
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
  // 美卡（ATS）：换算参数来自瓦片导出配置 TileMapInfo.json（tmp-ats-promods）
  // （游戏坐标 x∈[-120835.742, 41880.945] y∈[-87127.17, 75589.516] 线性铺满 131072 网格）
  ats: {
    tileUrl: 'https://ets_tiles.114512.xyz/20260903/tmp-ats-promods-yellow/Tiles/{z}/{x}/{y}.png',
    multipliers: {
      x: 97335.94,
      y: 70182.92
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
        x / 1.2414298 + mapConfig.ats.multipliers.x,
        y / 1.2414298 + mapConfig.ats.multipliers.y
      ];
    }
  }
}

// 动态瓦片参数覆盖：由插件从服务器上的 TileMapInfo.json 实时计算后传入
// 用法：applyTileParams({ ets: {scale, offsetX, offsetY, maxZoom, minZoom}, ... })
// 传了就覆盖上面的内置参数，这样以后更新地图只需上传新的 TileMapInfo.json，无需改代码
function applyTileParams(params) {
  if (!params || typeof params !== 'object') return;
  for (const key of Object.keys(params)) {
    const p = params[key];
    if (!p || !mapConfig[key]) continue;
    const scale = p.scale;
    mapConfig[key].multipliers = { x: p.offsetX, y: p.offsetY };
    if (Number.isFinite(p.maxZoom)) mapConfig[key].maxZoom = p.maxZoom;
    if (Number.isFinite(p.minZoom)) mapConfig[key].minZoom = p.minZoom;
    mapConfig[key].calculateMapCoordinate = function (x, y) {
      return [x / scale + p.offsetX, y / scale + p.offsetY];
    };
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
