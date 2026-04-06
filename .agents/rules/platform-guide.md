---
trigger: manual
---

请按下面这套统一架构开发网站。除非我明确要求，否则不要偏离这套结构。

目标：
- 网站部署在 Cloudflare 体系内
- 前端部署到 Cloudflare Pages
- 后端 API 部署到 Cloudflare Workers / Pages Functions
- 优先使用 Cloudflare 原生能力
- 架构要适合中国大陆用户访问稳定性
- 前端使用 React + Vite
- 客户端本地缓存使用 IndexedDB

一、部署架构
1. 前端
- 使用 React + Vite
- 部署到 Cloudflare Pages

2. 后端
- API 部署到 Cloudflare Workers 或 Pages Functions

3. 静态资源
- 网站静态资源优先放在 Pages
- 大 JSON / 图片 / 音频等按合适存储方案拆分

二、前端要求
1. 所有业务 API 统一走同源 `/api/*`
2. 前端把必要静态数据缓存在 IndexedDB
3. 用户数据可做本地缓存与离线恢复
4. 用户操作先更新前端状态，再写本地缓存，再按策略同步后端

三、后端要求
1. Cloudflare 后端负责全部业务 API
2. API 返回统一 JSON：
- 成功：`{ ok: true, ... }`
- 失败：`{ ok: false, error: '...' }`
3. 公共逻辑统一拆分：
- 鉴权
- 数据库访问
- 存储访问
- HTTP 工具
- CORS
4. 不要把所有逻辑都堆在一个 Worker 文件里
5. 目录结构保持清晰，便于未来扩展

四、鉴权要求
1. 优先评估 Cloudflare 自带能力是否足够
2. 如果 Cloudflare 没有成熟、稳定、易用的终端用户身份系统，就继续使用 Clerk
3. 鉴权必须支持：
- 邮箱登录/注册
- 会话管理
- 前端获取当前用户
- 服务端校验用户身份
4. 所有用户写操作必须从服务端鉴权身份推导，不信任前端传入 user_id

五、数据库与存储要求
请优先按以下思路选型，并说明理由：

1. 主业务数据库推荐选型
优先推荐：
- Cloudflare D1：适合轻量应用、结构简单、低成本、Cloudflare 原生
- Neon Postgres：适合需要 PostgreSQL 能力、关系更复杂、SQL 更强
- Supabase Postgres：适合希望数据库 + 后台工具 + 对象存储一体化

请根据业务复杂度选择：
- 小型/中小型、读写压力不高：优先评估 D1
- 关系复杂、需要 Postgres 能力：优先用 Neon
- 需要更强后台管理体验：可考虑 Supabase

2. JSON 数据文件存储推荐
如果是静态公开 JSON：
- 优先放 `public/data/` 并由 Cloudflare Pages 直接托管
- 如果文件大、需要独立更新，可放 Cloudflare R2

如果是大 JSON、频繁更新、按 key 读取：
- 推荐 Cloudflare R2
- 如需超低延迟 key-value 读取，可评估 Workers KV，但不要用于强一致业务数据

3. 用户图片存储推荐
优先推荐：
- Cloudflare R2
- Supabase Storage
- Cloudinary（如果重视图片处理、缩略图、CDN 转换）

默认建议：
- 一般业务：Cloudflare R2
- 若图片处理需求强：Cloudinary

4. 用户音频存储推荐
优先推荐：
- Cloudflare R2
- Supabase Storage

默认建议：
- 用户上传音频文件：Cloudflare R2
- 如需后续转码/处理，再补专门音频处理链路

六、CORS 与安全要求
1. 同源部署时，优先避免跨域
2. 如有跨域需求，必须白名单控制
3. 所有服务端接口都要校验登录态和资源权限
4. 不允许前端直接决定数据库写入对象
5. 上传接口必须校验文件类型、大小、用户身份

七、本地缓存与同步要求
1. 使用 IndexedDB 缓存：
- 静态 JSON
- 用户快照
- 待同步操作
2. 支持：
- 页面刷新后恢复状态
- 防抖同步
- 关键操作立即同步
3. 不把 IndexedDB 设计成权威数据源
4. 服务端数据库仍是最终权威源

八、目录结构要求
请优先按下面组织：

- `src/`
- `src/lib/`
- `functions/` 或 `worker/`
- `server/lib/` 或 `worker/lib/`
- `public/data/`
- `scripts/`

如果使用 Cloudflare Workers 路由，可保持：
- `functions/api/`
或
- `worker/routes/`

九、文档要求
开发完成后，请同步输出：
1. 项目结构说明
2. API 表格
- API
- 描述
- 输入
- 输出
3. Cloudflare 环境变量说明
4. 本地开发方式
5. Cloudflare Pages / Workers 部署说明
6. 数据库与存储选型说明
7. IndexedDB 缓存与同步策略说明

十、开发原则
1. 优先使用 Cloudflare 原生能力
2. 但不要为了“全原生”而牺牲成熟度和开发效率
3. 如果 Cloudflare 原生鉴权能力不足，继续使用 Clerk
4. 数据库、图片、音频、JSON 存储请根据实际场景选最稳妥方案
5. 所有改动需要保持架构一致
6. 输出时优先给出可直接落地的文件修改方案

请基于以上架构进行开发。