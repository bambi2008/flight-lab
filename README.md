# 飞行实验室 · Flight Lab

一个专业又有趣的航空探索站。从空气动力学、飞机设计到实验飞行器、模拟游戏和开源工具，发现值得研究的内容。

React 18 + TypeScript + Vite + Tailwind CSS；Supabase Postgres、Auth、Edge Functions 与 Cron；前端部署到 Vercel。读者无需登录，管理员负责精选、编辑和下架。

## 本地运行

需要 Node.js 22.12 或更新版本。

```sh
npm ci
npm run dev
```

打开终端显示的本地链接。未配置 Supabase 时进入明确标注的预览模式，展示根据真实来源整理的样例；后台预览中的修改不会保存。样例不代表当天自动生成的资讯，也不计入运营数据。

```sh
npm run build
npm test
npm run source-check
```

测试覆盖链接去重、标题相似度、内容筛选、异常模型输出、重试、用量记录，以及在真实 PostgreSQL 引擎中验证的数据库权限和并发任务锁。`source-check` 访问真实公开来源，需要联网。

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
| GitHub `topic:aerodynamics` | 官方仓库搜索接口       | 仓库说明只是介绍，不能作为项目质量已验证的证据   |
| 哔哩哔哩 / Besiege 作品     | 管理员手动收录         | 先填链接、中文介绍和研究点，再人工发布           |

RSS 抓取只允许代码中列出的可信域名，禁止重定向和任意内部地址。新增 RSS 域名需要审阅来源后修改 `rssHosts`。网站只呈现短摘要与链接，不复制完整来源文章或重传视频。

## 定时任务

在本项目启用 Cron、pg_net 和 Vault。按照 `docs/schedule-template.sql` 配置 URL 和随机密钥；不要提交填写真实密钥后的 SQL。默认每日 3 次：北京时间 09:00、17:00、次日 01:00。按实际资源情况调整。

先部署并手动验证采集成功，再开启 Cron。定时任务运行结果可以在后台运行记录和 Supabase Cron 日志中核对。

## 部署 Vercel

导入这个仓库，Framework 选 Vite，Build Command 为 `npm run build`，Output Directory 为 `dist`。设置前端公开环境变量，部署后检查 `/`、`/categories`、`/about`、`/admin` 的直接访问。`vercel.json` 已包含 SPA 路由与基本响应头。

后端位于 Supabase，不依赖 Vercel 高频 Cron。重新构建才会更新 Vite 的公开环境变量。部署 URL 改变后同步更新 Edge Function 的 `PUBLIC_SITE_URL`。

## 首周试运行

从真实采集开始运行的那一天算一周，不从预览页面发布算起。后台展示最近 7 天处理量和**估算费用**；完整用量保存在 `ai_usage`，每次已返回的付费请求都会记账，包括解析失败的模型输出。网络超时可能无法取得 token 数，需要和模型平台账单核对。

费用估算按配置的每百万 token 单价计算，没有计入缓存或时段折扣，不是平台的实际扣费保证。可选月限额也是估算停止线，单次请求仍可能超出剩余额度。不要把“免费部署方案”理解为模型调用永远免费。

当前前端一次加载最近 300 条；后台同样显示最近 300 条内容和 近 7 天最多 300 次运行。规模增长后应改为服务端分页。

## 文档与依据

- [讨论后的项目范围](docs/PROJECT_BRIEF.md)
- [Supabase Password Auth](https://supabase.com/docs/guides/auth/passwords)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Cron](https://supabase.com/docs/guides/cron/quickstart)
- [DeepSeek API 输出格式](https://api-docs.deepseek.com/guides/json_mode/)
- [DeepSeek 当前模型与价格](https://api-docs.deepseek.com/quick_start/pricing/)
- [哔哩哔哩官方开放平台](https://openhome.bilibili.com/doc)

应用代码采用 MIT 协议。第三方来源、视频缩略图和原作内容属于其原作者，应用代码许可证不授予这些内容的转载权。
