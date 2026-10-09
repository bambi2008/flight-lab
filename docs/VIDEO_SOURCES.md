# 视频来源接入

## 2026-10-09 实际测试结果

- YouTube：现有 Real Engineering 频道的订阅此前读到 15 条，这次通过本地后台重新检查返回 HTTP 404；属于间歇性异常，不能保证及时读取。`/xml/feeds/videos.xml` 返回 200 但只有静态订阅说明，已明确排除，不能算连接正常。
- YouTube Data API：服务端接口、缓存、限额冷却和 RSS 回退已实现。当前 `.env.local` 没有 API Key，因此 **尚未验证真实 API 调用**；自动化测试使用模拟响应，不能代替实际调用。
- B站：从公开视频页面核对“无人机工坊”UID 为 `525644756`（[验证页面](https://www.bilibili.com/video/BV15P4zeZE7o/)）。RSSHub 公共演示服务返回 403；SSD 项目内安装独立 RSSHub `1.0.0-master.5117089` 做试验，浏览器组件下载超时，系统 Chrome 的独立实例也未能启动。**尚未读取到该 UP 主的真实投稿订阅**，不能据此断言 B站上游 API 本身被封锁。
- 本地数据库已添加关闭的 B站样本；没有凭模拟测试启用或发布内容。试验用 RSSHub 进程已停止，运行环境留在被 Git 忽略的 `work/rsshub`。主应用不依赖它；目前仍可手动添加 B站公开视频链接。

## YouTube 配置

在 Google 项目启用 YouTube Data API v3，再把 Key 填入项目 `.env.local` 的 `YOUTUBE_API_KEY=`。不要使用 `VITE_` 前缀，也不要把 Key 发到聊天或提交 Git。

本地 API 每次加载配置，保存后在来源页检查 Real Engineering 即可。成功结果会标明 `YouTube Data API`，或明确标明 RSS 回退；仅有 RSS 成功不能证明 API 通过。云端以后需单独设置同名服务端 secret。

实现按 `channels.list` 获取真实上传列表（内存缓存 6 小时），再用 `playlistItems.list` 和 `videos.list` 最多读取 20 个公开视频，不使用全站搜索。采用视频本身的发布时间，忽略删除、私有或不属于目标频道的结果。403/429 后对相同 Key 冷却 15 分钟；一次读取总时间最多 12 秒，失败保留原有入库内容，不清空站点。Key 仅放请求头，错误正文不进入后台或日志。

数据为标题、公开视频说明和封面，摘要依据为“视频说明”；没有下载、观看或转写视频。能否自动发布仍经过原有内容、安全、相关性和质量检查。

参考：[Google 官方入门](https://developers.google.com/youtube/v3/getting-started)、[上传列表](https://developers.google.com/youtube/v3/docs/channels)、[视频时间字段](https://developers.google.com/youtube/v3/docs/playlistItems)、[API Key 请求头](https://docs.cloud.google.com/apis/docs/system-parameters)。

## B站配置

需要一个可运行的自建 RSSHub 实例；服务端 `.env.local` 配置 `RSSHUB_BASE_URL=https://你的实例域名`。限根地址，不带路径、账号、查询参数或片段；本机开发仅支持 `http://127.0.0.1:1200` 或同端口 localhost。生产服务请使用 HTTPS 独立实例，不依赖公共演示服务。

后台“添加来源”选 B站，输入 UP 主主页中的数字 UID。系统只构造 `/bilibili/user/video/UID/0` 的固定投稿路由，不接受用户填任意抓取 URL，也不跟随跳转。订阅必须标明同一 UP 主主页，条目链接必须为公开 B站视频地址。每小时轮询，最多处理 20 条；标题、简介进入现有去重和摘要流程，资料不足留待人工补充。

新样本保持关闭。先“检查连接”，读到真实标题和条目后再启用。当前缺少可工作的 RSSHub 浏览器运行环境，此项仍需实际验证；公共实例 403 或本地实例 503 都不能显示为正常。

桥接地址只由服务端配置；Google、GitHub 的密钥不会传给 RSSHub。当前应用没有读取或保存 B站登录 Cookie。以后若实例要求授权或登录，应在该实例内单独配置，不能把 Cookie 写到公开仓库。

参考：[RSSHub 官方投稿路由源码](https://github.com/DIYgod/RSSHub/blob/master/lib/routes/bilibili/video.ts)。官方开放平台的视频接口涉及创作者授权，不能当成任意 UP 主的全站公开订阅接口：[单视频接口说明](https://openhome.bilibili.com/doc/4/d9554788-dcef-f139-6217-b487d41c3826)。

## 验证范围

41 项测试通过，涵盖 API 缓存、限额回退、错误脱敏、订阅身份校验、异常响应拒绝、B站来源数据库约束和管理员权限；生产构建通过。这里的模拟测试不代表上述未完成的真实平台接入已经成功。
