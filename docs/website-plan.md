# Codex / ChatGPT Desktop 皮肤站网站方案

完整实施方案已整理至：

[`docs/superpowers/plans/2026-07-18-codex-skin-archive-website.md`](superpowers/plans/2026-07-18-codex-skin-archive-website.md)

文档覆盖：

- 产品定位、用户角色和范围边界
- 科技感皮肤商店视觉系统与 Pinterest 瀑布流
- Payload CMS + Cloudflare Workers / D1 / R2 技术架构
- 皮肤 ZIP 契约、`theme.json`、安全校验
- 技能端签名上传、管理员审核、发布状态机（网站不提供 Submit 页面）
- 隐私条款页与公开创作者信息边界
- GitHub 检索和许可证记录
- 公共 API、管理员 API 和下载接口
- `codex-skin-studio` P0 契约级对接与 P1 本机一键导入
- Skill 上传 API 的 HMAC 密钥必须通过 Cloudflare Secret 和本地环境变量分别配置，禁止写入技能包
- Cloudflare Access、SEO、性能、安全和版权策略
- 分阶段实施任务、测试计划和验收标准
