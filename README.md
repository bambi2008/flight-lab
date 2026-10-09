# 飞行实验室 · Flight Lab

一个专业又有趣的航空探索站。从空气动力学、飞机设计到实验飞行器、模拟游戏和开源工具，发现值得研究的内容。

React 18 + TypeScript + Vite + Tailwind CSS；Supabase Postgres、Auth、Edge Functions 与 Cron；前端部署到 Vercel。读者无需登录，管理员负责精选、编辑和下架。

## 本地运行

需要 Node.js 22.12 或更新版本。当前采用可保存数据的本地试运行方式，无需 Docker 或 Supabase 云账号。先安装依赖，再开两个终端：

```sh
npm ci
npm run local:api
```

另一个终端运行：

```sh
npm run local
```

打开 http://127.0.0.1:5173/；编辑台 http://127.0.0.1:5173/admin 可通过“进入本地编辑台”建立本机会话。本地服务只绑定 127.0.0.1，检查 Host / Origin，并使用 HttpOnly / SameSite cookie；该入口仅用于可信的个人电脑，云端继续使用 Supabase 管理员邮箱密码登录。

数据库使用 PGlite PostgreSQL 引擎，真实执行同一套迁移和 RLS；持久数据位于项目 `.local-data/postgres/`。后台的编辑、发布、精选、来源启停会保存，重启后保留。`.local-data/` 与 `.env.local` 均被 Git 忽略。备份数据库前先停止本地 API，保留整个 `.local-data/postgres/` 目录；不要同时启动多个进程打开同一数据库。

在 `.env.local` 填写 `DEEPSEEK_API_KEY`，可参考 `.env.example` 的模型和用量配置。每次采集都重新读取配置，无需重启 API；密钥不得写进任何 VITE_ 变量或发进聊天。密钥为空时只采集入库，保留待处理内容，不调用模型、不自动发布；管理员仍可依据原始来源人工整理与发布。

API 运行期间每 10 分钟触发采集，编辑台也可点击“运行采集”。RSS / YouTube / GitHub 的各自限频与云端共用。电脑休眠、关机或服务停止时暂停检查，不等于全天候云端运行。首次运行先手动检查来源与记录；完整的一周摘要试运行从配置有效模型密钥后计时。

来源页（`http://127.0.0.1:5173/admin?section=sources`）可逐个“检查连接”，显示本次读取数量、最新条目或接口错误。检查只读取已保存的来源，不调用模型、不入库、不改变轮询时间；结果仅保留在当前页面。上次采集错误会继续单独显示，直到正常采集更新状态。YouTube 配置服务端 `YOUTUBE_API_KEY` 后优先用官方 Data API；失败时回退频道订阅。B站可添加数字 UID，需配置自建 RSSHub 的 `RSSHUB_BASE_URL`，每小时检查一次。连接方案和本次实际测试限制见 [视频来源接入](docs/VIDEO_SOURCES.md)。

新机追踪将最近 300 条已发布资讯按明确的机型名称关联到 X-59、A350F 和 F/A-XX 档案，每份档案显示最近 8 条相关资讯。包含 NASA Quesst 的 X-59 专项订阅；标题和标签匹配不会把同厂商的其他机型或摘要里的偶然提及归入档案。公开页面可见时每分钟刷新一次，也可以手动刷新。参数、研制阶段与时间线仍由编辑核对，不由摘要自动改写。精确来源时间显示为北京时间，无时区的来源只显示日期。

编辑台的“机型档案”支持新增机型、保存草稿、发布和转回草稿，也可以直接打开 `http://127.0.0.1:5173/admin?section=aircraft`。先填写公开来源，再为每项参数和进展选择依据；“研制目标”与“试飞实测”分别记录。新增机型可以填写常见名称，自动关联已发布资讯。档案保存到同一份本地数据库，启动时只初始化一次三个旧档案，不会覆盖后续编辑。多人或多窗口同时修改同一档案时，旧版本不能直接覆盖新版本；网址名称创建后固定。草稿只有管理员能读取，匿名读者不能修改档案；当前列表最多读取 200 份。

`npm run dev` 仍用于原有云端模式：配置前端 Supabase 环境变量后读取云数据库，未配置则展示样例。`npm run build` 默认生成云端/样例构建，不会自动打开本地入口。

```sh
npm run build
npm test
npm run source-check
```

测试覆盖去重、筛选、异常模型输出、用量记录、数据库权限、任务锁，以及本地 HTTP 访问边界、实际入库、发布和磁盘重启持久化。模型测试使用隔离响应，不能作为真实 DeepSeek 调用通过的证据。`source-check` 访问真实公开来源，需要联网。

## 接通 Supabase

1. 创建**本项目独立的** Supabase 项目，核实组织、区域与费用。不要在其他应用的数据库里执行这些 SQL。
2. 通过 Supabase CLI 应用 `supabase/migrations/` 内的迁移，或者在新项目 SQL Editor 执行迁移内容；之后执行 `supabase/seed.sql` 初始化来源。
3. Dashboard → Authentication → Settings 中关闭新用户注册。创建一个管理员用户，由管理员本人设置密码。
4. 在 SQL Editor 将该用户加入管理员表：

```sql
insert into public.admin_roles (user_id)
values ('REPLACE_WITH_ADMIN_USER_UUID');
```

5. 将 `.env.example` 复制为 `.env.local`，只为前端填入 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_PUBLISHABLE_KEY`；重启开发服务。
6. 测试管理员登录、手动添加链接、编辑、发布、精选和下架。匿名访问只能读取已发布内容。

公开页面使用 publishable key。服务端密钥与 DeepSeek key 不得写进任何 `VITE_` 变量，不得提交到 Git 或发进聊天。

CLI 命令执行前可以查看 `npm run supabase -- --help`。受限制环境下，如果遥测文件不可写，可设置 `DO_NOT_TRACK=1`；本项目不需要改动用户的主目录。

## 自动采集与 DeepSeek

```text
公开来源 → 链接/标题去重 → 入库待处理
→ DeepSeek 中文摘要、分类、参考评分和内容筛选
→ 正常且资料充分：自动发布
→ 资料不足、敏感、低置信度或失败：待审
→ 明确不适合的内容：拒绝发布
→ 编辑精选、修改或下架
```

部署 `supabase/functions/ingest`，它通过自定义鉴权校验管理员身份或独立 cron secret，所以配置 `verify_jwt=false`。**这不意味着公开允许调用**：没有有效的管理员 token 或 cron secret 会返回 401。

在本项目 Edge Function Secrets 配置：

| 变量                                                                 | 用途                                          |
| -------------------------------------------------------------------- | --------------------------------------------- |
| `DEEPSEEK_API_KEY`                                                   | 模型 API key，由用户在服务端直接填写          |
| `DEEPSEEK_MODEL`                                                     | 默认 `deepseek-flash`；按官方当前模型目录核实 |
| `INGEST_CRON_SECRET`                                                 | 随机的定时调用密钥，和 Vault 中的值一致       |
| `PUBLIC_SITE_URL`                                                    | 实际网站 origin，用于允许管理员后台跨域调用   |
| `INGEST_BATCH_SIZE`                                                  | 默认每批最多 12 条，最大 20 条                |
| `GITHUB_TOKEN`                                                       | 可选，改善 GitHub 接口的访问额度              |
| `DEEPSEEK_MONTHLY_LIMIT_USD`                                         | 可选估算费用停止线，首周可留空                |
| `DEEPSEEK_INPUT_USD_PER_MILLION` / `DEEPSEEK_OUTPUT_USD_PER_MILLION` | 用量估算单价，按实际模型更新                  |

Edge Functions 自带 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY` 环境变量，不需将它们提供给浏览器。配置完成后，可在后台点“运行采集”。

如果想在本地执行流水线，在 `.env.local` 的**非 VITE** 变量中配置本项目服务端密钥和模型密钥，然后运行：

```sh
npm run ingest
```

没有模型 key 时，只收集内容进待审队列，不自动发布英文原始标题。模型失败最多尝试 3 个采集周期，每次 HTTP 重试有界；失败内容保留待审。一个任务持有数据库租约，阻止并发采集造成重复付费。编辑已作出的状态修改不会被采集任务覆盖。

当前摘要依据是视频简介或 RSS/仓库摘录。不会下载整段视频，也不会自动取得所有字幕。简介包含广告或信息不足时需要人工判断，不能保证所有视频都能自动产出有用摘要。

## 来源

| 来源                        | 首版方式               | 说明                                             |
| --------------------------- | ---------------------- | ------------------------------------------------ |
| Real Engineering            | YouTube 频道 Atom 订阅 | 默认频道可替换；广泛工程内容由模型筛选航空相关性 |
| NASA Aeronautics            | 官方 RSS               | 偏航空工程与研究进展                             |
| NASA Quesst / X-59 | 官方 RSS | 专项追踪低声爆研究飞机的公开试飞进展 |
| Airbus 民用 / Defence / Innovation | 官方 RSS | 覆盖民用飞机、公开军用技术与创新项目；订单等无关信息仍筛除 |
| Boeing 官方公告 | 官方 RSS + 正文摘录 | 覆盖民用与军用项目；标题不足时读取同站点新闻正文 |
| Lockheed Martin 官方公告 | 官方 RSS + 正文摘录 | 涵盖航空及公开研制消息，筛除财报、订单及无关产品 |
| 美国空军官方新闻 | 官方 RSS + 正文摘录 | 覆盖新机试飞及研制进展；作战、政治争议及敏感内容继续待审 |
| Joby 官方公告 | 官方 RSS + 正文摘录 | 跟踪电动垂直起降与试飞；公司其他机型按实际型号关联 |
| GitHub `topic:aerodynamics` | 官方仓库搜索接口       | 仓库说明只是介绍，不能作为项目质量已验证的证据   |
| 哔哩哔哩 / Besiege 作品     | 管理员手动收录         | 先填链接、中文介绍和研究点，再人工发布           |

RSS 抓取只允许代码中列出的可信域名。最多跟随两次同源 HTTPS 跳转；跨站、降级到 HTTP、携带凭据或端口的跳转均拒绝。来源与正文读取都有超时和流式大小限制。网站只呈现短摘要与链接，不复制完整来源文章或重传视频。

Boeing RSS 的官方文章地址从 HTTP 规范化为 HTTPS，正文只摘录新闻容器。正文不足时留待审核，不付费调用模型来补猜。Airbus 的无时区订阅日期保存为 `published_precision=date`，不能用于分钟级时效计算。新增来源须核实地址与日期格式。

Lockheed Martin、美国空军和 Joby 的订阅摘要少于 1,500 字符时，优先读取相应官方报道正文，最长 6,000 字符；其余官方来源维持原有短摘录补全规则。HTTP 200 返回的页面如果不是可识别的 RSS，也会记录为来源异常，避免将访问检查页当成正常订阅。新增种子来源只在首次添加时写入，后续启动保留编辑的启停与检查状态。

## 定时任务

在本项目启用 Cron、pg_net 和 Vault。按照 `docs/schedule-template.sql` 配置 URL 和随机密钥；不要提交填写真实密钥后的 SQL。模板每 10 分钟触发一次，实际 RSS 检查间隔为 10 分钟，YouTube 为 30 分钟，GitHub 为 6 小时。来源按最近检查时间轮转，抓取并发最多 3 个，每轮最多检查 12 个来源；新发布内容优先处理，失败项按冷却时间重试。

先部署并手动验证采集成功，再开启 Cron。定时任务运行结果可以在后台运行记录和 Supabase Cron 日志中核对。

## 部署 Vercel

导入这个仓库，Framework 选 Vite，Build Command 为 `npm run build`，Output Directory 为 `dist`。设置前端公开环境变量，部署后检查 `/`、`/categories`、`/about`、`/admin` 的直接访问。`vercel.json` 已包含 SPA 路由与基本响应头。

后端位于 Supabase，不依赖 Vercel 高频 Cron。重新构建才会更新 Vite 的公开环境变量。部署 URL 改变后同步更新 Edge Function 的 `PUBLIC_SITE_URL`。

## 首周试运行

从真实采集开始运行的那一天算一周，不从预览页面发布算起。后台展示最近 7 天处理量和**估算费用**；完整用量保存在 `ai_usage`，每次已返回的付费请求都会记账，包括解析失败的模型输出。网络超时可能无法取得 token 数，需要和模型平台账单核对。

费用估算按配置的每百万 token 单价计算，没有计入缓存或时段折扣，不是平台的实际扣费保证。可选月限额也是估算停止线，单次请求仍可能超出剩余额度。不要把“免费部署方案”理解为模型调用永远免费。

当前前端和后台一次加载最近 300 条内容；后台运行明细请求近 7 天最多 2000 条（项目 API 的行数上限可能更低）。近 7 天处理数和估算费用由数据库聚合，不依赖明细行数上限。延迟 P50/P95 则明确标注为当前加载内容中近 72 小时的自动发布样本，排除人工内容、仅有日期及时间关系不一致的记录。

## 文档与依据

- [讨论后的项目范围](docs/PROJECT_BRIEF.md)
- [Supabase Password Auth](https://supabase.com/docs/guides/auth/passwords)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Cron](https://supabase.com/docs/guides/cron/quickstart)
- [DeepSeek API 输出格式](https://api-docs.deepseek.com/guides/json_mode/)
- [DeepSeek 当前模型与价格](https://api-docs.deepseek.com/quick_start/pricing/)
- [哔哩哔哩官方开放平台](https://openhome.bilibili.com/doc)

应用代码采用 MIT 协议。第三方来源、视频缩略图和原作内容属于其原作者，应用代码许可证不授予这些内容的转载权。
