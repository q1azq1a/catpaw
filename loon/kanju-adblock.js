// 看剧AI去广告 - Loon http-response 脚本
// 拦截 /v1/runtime/bootstrap，把 app_experience.placements 里各广告位的
// 数组（items / banner_items / grid_items）全部清空，页面便无广告可渲染。
// 其余配置（片库、统计、轮播等）原样保留。
try {
  var o = JSON.parse($response.body);
  var p = o && o.app_experience && o.app_experience.placements;
  if (p) {
    for (var k in p) {
      var q = p[k];
      if (q) {
        for (var j in q) {
          if (Array.isArray(q[j])) q[j] = [];
        }
      }
    }
  }
  $done({ body: JSON.stringify(o) });
} catch (e) {
  $done({});
}
