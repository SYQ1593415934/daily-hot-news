# 今日热闻

**一个汇集国内平台热点的中文网站。** 将微博、抖音、知乎和 B 站榜单放在一起，按事件合并并排序，帮助读者快速了解当下受到关注的话题。

线上网站：[news.smoothcockatoo2.chatgpt.site](https://news.smoothcockatoo2.chatgpt.site/) · [Agent 接入说明](https://news.smoothcockatoo2.chatgpt.site/skill)

## 灵感来源

本项目的产品构想参考了 [数字生命卡兹克的 AIHOT](https://github.com/KKKKhazix/AIHOT)，感谢原作者开源分享。两者都关注信息聚合、事件归并和热点摘要，但面向的内容和实现方式不同。

当前项目使用 Vinext、Cloudflare Workers 和 D1；现有记录不足以确认代码从 AIHOT 仓库直接派生，因此本仓库不代表 AIHOT 官方版本或直接分支。AIHOT 的名称与标志归其权利人所有，本项目使用独立名称。

## 功能一览

| 功能 | 能做什么 | 需要了解的限制 |
| --- | --- | --- |
| 今日综合热点 | 汇总四个平台的有效榜单，合并相似话题并按站内热度排序。 | 标题匹配和已关联事件仍可能漏合并或误合并，建议查看原始来源。 |
| 各平台榜单 | 分别查看微博、抖音、知乎、B 站的榜单、原始名次及链接。 | 上游可能限流、失效或变更格式；部分数据来自第三方快照。 |
| 搜索热点 | 按关键词搜索综合榜或所选平台的当前榜单。 | 只搜索当前可用数据，不是全网历史搜索。 |
| 重点摘要与事件详情 | 综合榜前三条优先展示已有的事件摘要；已整理事件提供来源和详情。 | 摘要需要先核对来源并保存；不是每条热点都已有摘要。 |
| 昨日总榜 | 汇总北京时间昨日 00:00—24:00 已采集的榜单快照，展示话题排名及平台。 | 只能统计实际采集到的时段，缺少快照时不能还原完整全天数据。 |
| 每日简报 | 展示已保存的热点简报和来源，可查看已有往期。 | 页面负责读取和展示，简报需要另行整理并写入；空数据库不会自动生成。 |
| Agent 接入 | 提供 Skill 下载和 MCP 接入说明，支持读取榜单和简报等操作。 | 客户端需要支持 MCP，且必须具备相应授权；具体可用性取决于部署。 |
| 手动更新 | 点击首页“更新榜单”，请求各平台数据并保存结果及快照。 | 不调用模型生成摘要；平台请求可能失败，失败时会显示状态或保留上次数据。 |

## 工作原理

### 1. 采集和存储

`lib/sources.ts` 获取并解析数据：微博使用公开的第三方快照；抖音、知乎和 B 站请求相应榜单接口，B 站另有免费备用来源。`lib/collect.ts` 按平台独立处理结果，将热榜条目、采集状态和每次采集快照保存至 D1。某个平台失败不会删除其他平台的数据。

来源更新时间过旧或数据格式变化时，榜单可能暂不可用。数据可用性依赖外部站点，使用者应遵守相应平台的服务条款与适用规则。

### 2. 事件归并和综合排序

`lib/ranking.ts` 先筛选当前有效的榜单，再根据规范化标题、文本相似度和已有事件关联合并话题。综合榜按照**平台覆盖情况和各平台名次**计算站内分数；同一平台重复话题只取较好名次。这个分数用于站内比较，不是把不同平台的阅读量、播放量直接相加，也不是官方热度。

### 3. 重点摘要、简报和历史榜

事件摘要与来源保存在数据库中，页面读取已整理的数据。MCP 接口提供读取榜单、准备整理候选、保存事件与简报等工具；候选分组不是已经核实的事实，保存摘要前应查阅可靠来源。

昨日总榜从历史采集快照中计算；每日简报从已保存的简报记录中读取。项目源码本身不会凭空补回历史数据，也不保证独立部署后会自动生成每日简报。要无人值守更新，需要另行配置具备相应权限的任务和数据源。

## 技术栈与目录

- **页面和服务端**：React、Vinext、TypeScript、Tailwind CSS。
- **运行环境**：Cloudflare Workers；**数据库**：Cloudflare D1、Drizzle ORM。
- **页面**：`app/page.tsx`（首页）、`app/yesterday/`（昨日总榜）、`app/daily/`（简报）、`app/story/`（事件详情）、`app/skill/`（Agent 接入说明）。
- **核心逻辑**：`lib/sources.ts`（来源解析）、`lib/collect.ts`（采集）、`lib/ranking.ts`（综合排序）、`lib/yesterday.ts`（昨日总榜）。
- **数据与接入**：`db/`（数据库定义）、`drizzle/`（迁移）、`app/mcp/route.ts`（MCP 工具）。

## 本地运行

### 环境要求

- Node.js **22.13 或更高版本**，以及 npm。
- Git；能够访问依赖仓库及需要使用的数据源的网络。
- 以下命令在项目根目录运行。代码使用 Sites 提供的 Vinext 模板和 Cloudflare 本地开发工具。

### 1. 获取源码并安装依赖

```bash
git clone https://github.com/SYQ1593415934/daily-hot-news.git
cd daily-hot-news
npm ci
```

### 2. 构建并初始化本地数据库

先构建，生成本地数据库工具所需的配置：

```bash
npm run build
```

对**新建的本地数据库**依次执行下列迁移；命令不会修改线上数据库。已经执行过的迁移不要重复执行：

```bash
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_flawless_magik.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_tearful_miek.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_youthful_nocturne.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0003_tranquil_demogoblin.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0004_yielding_longshot.sql
```

### 3. 启动网站

```bash
npm run dev
```

在浏览器打开终端显示的本地地址。首次打开时数据库为空，可点击首页“更新榜单”尝试采集；能否成功受网络和各平台接口状态影响。昨日总榜需要先积累前一日快照；事件摘要和简报需要另外整理并保存。

## 部署与安全

此仓库是从原网站整理出的独立源码快照，不包含原站数据库、密钥或专属托管身份。部署者需要自行创建并配置 Workers、D1 和访问权限；现有构建与托管配置源自 Sites 模板，不应假定复制后即可在任意平台直接上线。来源和抓取稳定性需要在目标环境单独测试。

**MCP 接口包含采集及写入工具。** 原部署依赖托管平台管理身份与访问。独立部署到公网之前，必须实现并验证写入权限保护；不要直接公开没有认证的管理接口，也不要上传令牌、个人数据或数据库文件。

站点抓取榜单本身不调用大模型；如果另行使用 AI Agent 搜索、核实或生成摘要，会消耗所用模型或服务的额度。托管服务也可能有其用量限制，实际以服务商当前规则为准。

## 开源许可

本项目按 [MIT 许可证](LICENSE) 发布。`scripts/vite/sites-vite-plugin.LICENSE` 和 `vendor/` 中保留第三方代码的许可；各平台新闻和内容归相应权利人所有。
