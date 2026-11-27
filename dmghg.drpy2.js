// 动漫共和国 (dmghg) — drpy2 规则, 供 TVBox / FongMi / OK影视 等内置 drpy2 引擎的壳子使用
// 上游: http://bkbfdm.cenmo.fun
// 接口: /pc/channel、/pc/video/list、/pc/video/search、/pc/video/detail、/pc/video/play
// 移植自猫爪源 dmghg 模块: 请求头 AES 加密认证 + 响应 RSA+AES 加密 + 播放多步签名
//
// 为什么之前在电视上是空白:
//  1. 站点写法错了: drpy2 的站点条目里 api 必须是引擎文件(drpy2.min.js), 规则文件地址要放 ext;
//     之前把规则文件地址直接写进了 api, 引擎根本没加载。
//  2. 规则形态错了: drpy2 引擎里 一级/搜索/二级/lazy 必须是字符串, 自定义逻辑用 js: 前缀;
//     之前写的是 async 函数, 引擎遇到非字符串直接返回空对象, 分类页自然是空白。
//     (drpy2.min.js v3.9.43: categoryParse 里 `if(!p||typeof p!=="string"){return"{}"}`;
//      detailParse 要求二级是 js: 开头的字符串, playParse 要求 lazy 是字符串且须配 play_parse。)
//  本版把四处都改成 js: 字符串, 请求改同步 (drpy2 的 request 本来就是同步返回字符串, 不能 await)。
//  共享逻辑放在 globalThis.__dmghg 上, 保证每段 js: 代码 eval 时都能拿到, 不依赖 eval 的作用域。
//
// 站点写法 (wulii.json):
// {"key":"dmghg","name":"动漫共和国","type":3,
//  "api":"https://raw.githubusercontent.com/yw88075/tvbox/5df857abc263fda3c3e6cb1c285229f4d5e02230/dr/lib/drpy2.min.js",
//  "ext":"https://raw.githubusercontent.com/q1azq1a/catpaw/main/dmghg.js",
//  "searchable":1,"quickSearch":1,"filterable":0}
//
// 注意:
//  1. 本文件含该源内建的认证密钥与 RSA 私钥参数(与分发的猫爪包内完全一致), 不含它爬虫跑不起来;
//     密钥本来就在公开分发的猫爪包里, 不是你的个人凭证, 但放到公开仓库即等于公开, 自行知晓。
//  2. 分类为 /pc/channel 实测的 8 个频道: 日漫 20、国漫 21、剧场 22、美漫 23、特摄 25、少儿 32、动态漫 26、猜你想看 27。
//  3. 仍待电视实测: 引擎用 BigInt 做 RSA 解密, 电视端 QuickJS 是否支持 BigInt 与 1n 字面量,
//     以及引擎相对引用(./模板.js、./gbk.js 与 assets://js/lib/…) 在 OK影视里能否正常加载, 只能以电视为准。

var rule = {
    title: '动漫共和国',
    host: 'http://bkbfdm.cenmo.fun',
    url: '/pc/video/list?channel=fyclass&page=fypage&limit=24',
    searchUrl: '/pc/video/search?key=**&page=fypage&limit=24',
    detailUrl: '/pc/video/detail?id=fyid',
    searchable: 2,
    quickSearch: 1,
    filterable: 0,
    double: false,
    class_name: '日漫&国漫&剧场&美漫&特摄&少儿&动态漫&猜你想看',
    class_url: '20&21&22&23&25&32&26&27',
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-version': '2024-09-24',
        'appid': '4150439554430627',
        'system': '3'
    },
    timeout: 15000,
    play_parse: true,

    // 一级: 分类列表 (drpy2 会先把 url 里的 fyclass/fypage 换成 MY_CATE/MY_PAGE, 再 eval 这段代码; input 就是拼好的列表地址)
    一级: `js:
var data = __dmghg.apiGetUrl(input);
var items = (data && Array.isArray(data.items) ? data.items : []).map(__dmghg.mapItem).filter(Boolean);
setResult(items.map(function (o) { return {title: o.vod_name, url: o.vod_id, desc: o.vod_remarks, pic_url: o.vod_pic, img: o.vod_pic, content: ''}; }));
`,

    // 搜索 (drpy2 会先把 searchUrl 里的 ** 换成 KEY、fypage 换成 MY_PAGE; input 就是拼好的搜索地址)
    搜索: `js:
var data = __dmghg.apiGetUrl(input);
var items = (data && Array.isArray(data.items) ? data.items : []).map(__dmghg.mapItem).filter(Boolean);
setResult(items.map(function (o) { return {title: o.vod_name, url: o.vod_id, desc: o.vod_remarks, pic_url: o.vod_pic, img: o.vod_pic, content: ''}; }));
`,

    // 二级: 详情 (input 是拼好的详情地址; 执行完须给全局 VOD 赋值)
    二级: `js:
var m = input.match(/id=(\\d+)/);
var id = m ? m[1] : '';
var s = __dmghg.apiGet('/pc/video/detail', {id: id});
var from = [], urls = [];
(Array.isArray(s.parts) ? s.parts : []).forEach(function (u) {
    if (!u.play || !Array.isArray(u.part)) return;
    var eps = u.part.filter(function (l) { return typeof l === 'string' && l.trim(); }).map(function (l) {
        var d = __dmghg.b64UrlEncodeUtf8(JSON.stringify({id: id, play: u.play, part: l}));
        return __dmghg.clean(l) + '$dmghg:' + d;
    });
    if (eps.length) { from.push(__dmghg.clean(u.play_zh || u.play)); urls.push(eps.join('#')); }
});
VOD = {vod_id: String(s.id), vod_name: String(s.name || ''), vod_pic: s.pic || '', vod_year: String(s.year || ''), vod_area: String(s.area || ''), type_name: String(s.type || ''), vod_actor: String(s.actor || ''), vod_director: String(s.director || ''), vod_content: String(s.content || ''), vod_play_from: from.join('$$$'), vod_play_url: urls.join('$$$')};
`,

    // 播放: 解析出直链 (input 是二级里拼的 dmghg: 播放 id; 执行完须把 input 重写为 {parse:0, url, header})
    lazy: `js:
var p = input;
if (p.indexOf('dmghg:') !== 0) { throw new Error('播放 ID 无效'); }
var obj = JSON.parse(__dmghg.b64UrlDecodeToUtf8(p.slice(6)));
var lines = __dmghg.apiGet('/pc/video/play', {id: obj.id, play: obj.play, part: obj.part});
var out = [], lastErr = null;
for (var i = 0; i < (Array.isArray(lines) ? lines.length : 0); i++) {
    try { out = out.concat(__dmghg.resolvePlayLine(lines[i])); } catch (e) { lastErr = e; }
}
var seen = {}, uniq = [];
out.forEach(function (x) { if (x && x.url && !seen[x.url]) { seen[x.url] = 1; uniq.push(x); } });
if (!uniq.length) { throw lastErr || new Error('此剧集暂无可用线路'); }
var first = uniq[0];
input = {parse: 0, url: first.url, header: first.headers || {}};
`
};

// ===== 共享逻辑 (挂在 globalThis 上, 供上面四段 js: 代码调用) =====
globalThis.__dmghg = (function () {
var BASE = 'http://bkbfdm.cenmo.fun';
var PAGE_SIZE = 24;
var AUTH_KEY = 'ziISjqkXPsGUMRNGyWigxDGtJbfTdcGv'; // 32 字节 AES key(源内建)
var AUTH_IV = 'WonrnVkxeIxDcFbv';                   // 16 字节 AES iv(源内建)
var RSA_N_HEX = 'bdb1e04c2ec2e43729b1cec63c366d0f967da905e884e6f9743bf2b760319059cc3454ac4c5aefb30ff98e405010da311651c936e0ff9bcb22b4d593f1e08612db4eab0223aa14df2cbd3c692790787c0eb63d61e33b7839a1a9933279552d8c478c016c06ec77dfa2996181be1778b67c641294af31d166f05bb4a2458b52cb36f3a1aca6c5cf4394f4bbec321332fb71f7bda9f1364e5b008d988055ac958828f89ee543d224c4418b873a2abe39f3f56f822ce77aefc91140c8dee0bdfb7133d38c6a2a31a9d588cb570640e6c1ac5eac2566d85be351933ce97b8cf91498b29cff8bace433dfabb99834b1e8b4ab63052ea093d1f63f166f012bcab2791d'; // RSA n (2048-bit, 源内建 responseKey)
var RSA_D_HEX = '11b2607c7af84f961ddbaab0afb95c1f5228d2f5ec2549ef07baf7ffc7879831e86d116129966a3a48493dce1e2a1450f40619417768213ea8343aa09cb6178bf6cdb602731550f12919566370ff775e0b7950ecaae847650901eaeb908a33bf9c852134d4c886be644aeedfcdbe1ed2d773f68fcc70575ac51da912626e8700a8e68844ff3d4ea3e3c2d8e1a25d1b95a019b819672405d3e2d57c8aff99c83667049173750340e72f3aa548c052caa156cf792541c2972bd285a038cb2f49216b552acb3e58bf9603fed19e0bb8c366b2e67d2ac93973855da1d95d7879c9f90bada851933e625c43f43ea815a6ee0b1ad55142d9df6c590b90d332c630c279'; // RSA d (2048-bit, 源内建 responseKey)

function clean(s) { return String(s == null ? '' : s).replace(/[$#]/g, ' ').trim(); }

function b64UrlEncodeUtf8(str) {
    var b64 = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(str));
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64UrlDecodeToUtf8(b64url) {
    var b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    return CryptoJS.enc.Base64.parse(b64).toString(CryptoJS.enc.Utf8);
}
function randHex(n) {
    var s = '', c = '0123456789abcdef';
    for (var i = 0; i < n; i++) s += c[Math.floor(Math.random() * 16)];
    return s;
}
function modexp(b, e, m) {
    var r = 1n; b = b % m;
    while (e > 0n) { if (e & 1n) r = (r * b) % m; e >>= 1n; b = (b * b) % m; }
    return r;
}
function hexToBytes(hex) {
    var a = [];
    for (var i = 0; i < hex.length; i += 2) a.push(parseInt(hex.substr(i, 2), 16));
    return a;
}
function bytesToHex(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += ('0' + bytes[i].toString(16)).slice(-2);
    return s;
}

// AES-CBC 加密, 输出 base64(与 Node createCipheriv('aes-*-cbc') 一致, 无 Salted__ 头)
function aesEncryptB64(plain, keyStr, ivStr) {
    var c = CryptoJS.AES.encrypt(CryptoJS.enc.Utf8.parse(plain), CryptoJS.enc.Utf8.parse(keyStr), {iv: CryptoJS.enc.Utf8.parse(ivStr)});
    return c.ciphertext.toString(CryptoJS.enc.Base64);
}
// AES-CBC 解密, 输入 base64, 输出 utf8 字符串
function aesDecryptToUtf8(b64, keyWA, ivWA) {
    var dec = CryptoJS.AES.decrypt({ciphertext: CryptoJS.enc.Base64.parse(b64)}, keyWA, {iv: ivWA});
    return dec.toString(CryptoJS.enc.Utf8);
}

// RSA 私钥解密一个 base64 块, 取出其中 16 字节 AES key(返回 32 位 hex)
// 块格式 PKCS#1 v1.5: 0x00 0x02 [非零填充...] 0x00 [16 字节 key]
function rsaDecryptKeyHex(b64) {
    var hex = CryptoJS.enc.Hex.stringify(CryptoJS.enc.Base64.parse(b64));
    var m = modexp(BigInt('0x' + hex), BigInt('0x' + RSA_D_HEX), BigInt('0x' + RSA_N_HEX));
    var mhex = m.toString(16).padStart(512, '0');
    var bytes = hexToBytes(mhex);
    var j = 2;
    while (j < bytes.length && bytes[j] !== 0) j++;
    return bytesToHex(bytes.slice(j + 1));
}

// 响应解密: 明文 JSON 直接返回; 否则按 base64(RSA 加密的 key).base64(AES 加密的体) 解
function apiDecrypt(body) {
    var txt = (typeof body === 'string') ? body : JSON.stringify(body);
    txt = txt.trim();
    try { return JSON.parse(txt); } catch (e) {}
    var parts = txt.split('.');
    if (parts.length !== 2) throw new Error('接口响应解密失败');
    var keyHex = rsaDecryptKeyHex(parts[0]);
    var keyWA = CryptoJS.enc.Hex.parse(keyHex);
    var ivWA = CryptoJS.enc.Hex.parse(keyHex.match(/../g).reverse().join(''));
    return JSON.parse(aesDecryptToUtf8(parts[1], keyWA, ivWA));
}

// 带认证头的 GET(同步返回解密后的 data; drpy2 的 request 本来就是同步的)
function getWithAuth(url) {
    var ts = String(Date.now());
    // 原模块: 明文先 base64 再 AES 加密 (少了这层 base64, 服务端会报 code 30000“解码异常”)
    var plainB64 = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse('0.1.0-' + ts + '-3-1.0.0-win32'));
    var auth = aesEncryptB64(plainB64, AUTH_KEY, AUTH_IV);
    var res = request(url, {headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-version': '2024-09-24',
        'appid': '4150439554430627',
        'system': '3',
        'requrl': BASE,
        'ts': ts,
        'authentication': auth
    }, timeout: 15000});
    var txt = (typeof res === 'string') ? res : JSON.stringify(res);
    var obj = apiDecrypt(txt);
    if (Number(obj && obj.code) !== 20000) throw new Error('接口请求未成功(code ' + (obj && obj.code) + ')');
    return obj.data;
}

function apiGet(path, params) {
    var url = BASE + path;
    var qs = [];
    for (var k in params) {
        var v = params[k];
        if (v !== null && v !== undefined && v !== '') qs.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(v)));
    }
    if (qs.length) url += '?' + qs.join('&');
    return getWithAuth(url);
}

function apiGetUrl(url) { return getWithAuth(url); }

function mapItem(o) {
    if (!o || !o.id || !o.name) return null;
    return {vod_id: String(o.id), vod_name: String(o.name), vod_pic: o.pic || '', vod_remarks: String(o.continu || '')};
}

// 从 Lua 解析规则文本里取值: KEY = "value" 或 KEY = 123
function Sd(str, key) {
    var m = String(str).match(new RegExp('\\b' + key + '\\s*=\\s*["\']([^"\']*)["\']'));
    if (m) return m[1];
    var m2 = String(str).match(new RegExp('\\b' + key + '\\s*=\\s*([^,\\s\\}]+)'));
    return m2 ? m2[1] : '';
}
// 取 KEY = {...} 的花括号内文
function ndt(str, key) {
    var m = String(str).match(new RegExp('\\b' + key + '\\s*=\\s*\\{([\\s\\S]*?)\\}'));
    if (!m) throw new Error('播放规则缺少配置 ' + key);
    return m[1];
}
// 取 KEY = 数字, 无则取默认值
function iUr(str, key, def) {
    var m = String(str).match(new RegExp('\\b' + key + '\\s*=\\s*(\\d+)'));
    return m ? parseInt(m[1], 10) : def;
}

// 解析单条播放线路。直接给直链的走直链; 否则按 Lua 解析规则做多步签名再请求上游。
function resolvePlayLine(t) {
    var parseStr = String(t.parse || '');
    var url = String(t.url || '').trim();
    if (!url) throw new Error('该线路未提供播放地址');
    if (Number(t.ps) === 0 && /^https?:\/\//i.test(url)) {
        return [{name: clean(t.resolution || '') || '默认', url: url, headers: t.lua_header || {}}];
    }
    if (parseStr.indexOf('wrap_md5_id') < 0 || parseStr.indexOf('build_api_client_headers') < 0 || !/^(?:new-)?[a-f0-9]{32}$/i.test(url)) {
        throw new Error('暂不支持此线路的播放解析规则');
    }
    var aesKey = Sd(parseStr, 'MD5_AES_KEY'), aesIv = Sd(parseStr, 'MD5_AES_IV');
    if (aesKey.length !== 16 || aesIv.length !== 16) throw new Error('播放规则的 AES 参数无效');
    var authCfg = ndt(parseStr, 'API_AUTH_CONFIG');
    var headCfg = ndt(parseStr, 'API_HEADER_AUTH');
    var path = '/' + Sd(authCfg, 'PATH').replace(/^\/+|\/+$/g, '');
    var c = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    var u = url.replace(/^new-/, '').toLowerCase().split('').reverse().join('');
    var x = CryptoJS.MD5(c + ':' + u + ':' + aesKey + ':' + aesIv).toString(CryptoJS.enc.Hex).slice(0, 2);
    var l = aesEncryptB64(c + '-' + u.slice(0, 16) + x + u.slice(16), aesKey, aesIv);
    var d = Math.floor(Date.now() / 1000);
    var f = d + iUr(authCfg, 'EXPIRE', 600);
    var p = randHex(16);
    var h = CryptoJS.MD5([path, f, p, '0', Sd(authCfg, 'KEY')].join('-')).toString(CryptoJS.enc.Hex);
    var m = 'sign=' + [f, p, '0', h].join('-');
    function g(k, O, P) {
        var B = randHex(20);
        var q = P ? d + P : 0;
        var G = [path, l, m].concat(q ? [q] : []).concat(O).concat([B, k]);
        return 'v1:' + (q ? q + ':' : '') + B + ':' + CryptoJS.MD5(G.join('|')).toString(CryptoJS.enc.Hex);
    }
    var y = g(Sd(headCfg, 'KEY'), [], iUr(headCfg, 'EXPIRE', 600));
    var b = g(Sd(headCfg, 'EXTRA_KEY'), [y]);
    var A = g(Sd(headCfg, 'CHECK_KEY'), [y, b]);
    var E = Sd(parseStr, 'API_ENDPOINT') + encodeURIComponent(l) + '&' + m;
    if (!/^https?:\/\//i.test(E)) throw new Error('播放解析地址无效');
    var headers = {'Accept': '*/*'};
    headers[Sd(headCfg, 'HEADER')] = y;
    headers[Sd(headCfg, 'EXTRA_HEADER')] = b;
    headers[Sd(headCfg, 'PROBE_HEADER')] = Sd(headCfg, 'PROBE_KEY');
    headers[Sd(headCfg, 'CHECK_HEADER')] = A;
    var res = request(E, {headers: headers, timeout: 15000});
    var txt = (typeof res === 'string') ? res : JSON.stringify(res);
    var C;
    try { C = JSON.parse(txt); } catch (e) { throw new Error('播放解析响应格式异常'); }
    if (Number(C && C.code) !== 0 || !Array.isArray(C.data && C.data.playAddr)) throw new Error('上游未返回可播放的媒体地址');
    // 字段可能是 AES 加密的(key=MD5_AES_IV, iv=MD5_AES_KEY), 解不开就按明文用
    function decField(v) {
        try {
            var out = aesDecryptToUtf8(v, CryptoJS.enc.Utf8.parse(aesIv), CryptoJS.enc.Utf8.parse(aesKey));
            return out || v;
        } catch (e) { return v; }
    }
    var T = [];
    C.data.playAddr.forEach(function (k) {
        try {
            if (typeof k.m3u8FileDomain !== 'string' || typeof k.addr !== 'string') return;
            var O = decField(k.m3u8FileDomain) + decField(k.addr);
            if (!/^https?:\/\//i.test(O)) return;
            T.push({name: clean([k.desc, k.title].filter(Boolean).join(' ')) || '默认', url: O, headers: {'User-Agent': ''}});
        } catch (e) {}
    });
    if (!T.length) throw new Error('上游未返回可播放的媒体地址');
    return T;
}

return {
    clean: clean,
    b64UrlEncodeUtf8: b64UrlEncodeUtf8,
    b64UrlDecodeToUtf8: b64UrlDecodeToUtf8,
    apiGet: apiGet,
    apiGetUrl: apiGetUrl,
    mapItem: mapItem,
    resolvePlayLine: resolvePlayLine,
    PAGE_SIZE: PAGE_SIZE
};
})();
