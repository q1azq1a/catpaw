# catpaw

映匣用源：猫爪源 JS + TVBox 配置，二选一或两个都导。

## 1. 猫爪源（56 个内容站，含动漫共和国）

在映匣里导入这个链接：

```
https://raw.githubusercontent.com/q1azq1a/catpaw/main/index.js.md5
```

- `index.js`：CatPawPlay 的猫爪源包（61 个爬虫模块，减去网页入口/Emby/Alist、配置、推送 5 个非内容项，可用 56 个，含「直」动漫共和国 dmghg）。
- `index.js.md5`：校验文件，映匣导入时用。
- `index.config.js`：猫爪源配套配置文件。

## 2. TVBox 配置（wulii，29 个站）

在映匣/TVBox 里导入这个链接：

```
https://raw.githubusercontent.com/q1azq1a/catpaw/main/wulii.json
```

- 来源：https://wulii.indevs.in/（2026-11-22 镜像），原 28 站。
- 新增 **动漫共和国**（`dmghg.js`，drpy 规则，排在第一个）：上游 `bkbfdm.cenmo.fun`，按猫爪源 dmghg 模块移植——请求头 AES 加密认证、响应 RSA+AES 加密、播放多步签名；分类目前只放了一个“全部”（频道 20）。
- 其余 28 站全是 type 3（csp jar）：片单精选（豆瓣）、哔哩哔哩、鱼鱼盘搜、玩偶/花卷/木偶/指南/蜗牛/虎斑/观影/多多/光鸭等网盘 4K 站、4 个有声站、红果短剧/漫剧、推送接收。
- spider jar 走七牛直链，不走 jsDelivr（jsDelivr 不分发 .jar）。

## 3. 动漫共和国 drpy（`dmghg.js`）说明

- 需壳子支持 drpy（映匣/FongMi TV）。文件含该源内建的认证密钥与 RSA 私钥参数（与分发的猫爪包内完全一致），仅用于让爬虫跑起来。
- 未在真机实测：加解密逻辑已按原模块逐行移植，并用 Node 校验过 RSA（BigInt modexp）与 AES 加解密构造及响应解密全流程；但上游接口未从本机验证通过，播放签名的 Lua 解析规则是按原模块正则推断的，**以映匣实测为准**，打不开或播不了请把报错原样发回来再调。
- `catpawplay.json`（另备）：仅含 CMS 源「电影饭堂」的极简 TVBox 配置，给 FongMi TVBox 用，映匣不需要。
