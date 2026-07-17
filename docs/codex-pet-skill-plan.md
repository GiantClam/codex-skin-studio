# ChatGPT Desktop Codex Pet Skill 方案

> 状态：独立扩展设计稿
> 研究日期：2026-07-17
> 目标平台：ChatGPT Desktop macOS 和 Windows
> 关联项目：`codex-skin-studio`
> 产品边界：Pet 是独立的浮动 Overlay，不是主窗口 CSS 皮肤，也不是 `app.asar` 修改方案。

## 1. 结论

Pet 能力应作为 `codex-skin-studio` 的独立扩展，不直接并入主界面换肤 Runtime。

推荐架构：

```text
Codex Pet Skill
  -> 理解人物或物体参考图
  -> 调用 Codex 原生 Image Generation
  -> 生成卡通化动作素材
  -> 本地确定性裁切、对齐和拼图
  -> 生成并校验 pet.json
  -> 安装到 ~/.codex/pets/<pet-id>/
  -> ChatGPT Desktop Settings > Pets > Refresh
```

核心原则：

1. Codex Image Generation 负责角色设计、动作设计和视觉一致性。
2. Node.js 脚本负责尺寸、透明通道、图集布局、文件路径和校验。
3. ChatGPT Desktop 原生负责 Pet Overlay、任务状态和动画状态切换。
4. 不修改 `app.asar`、应用签名、官方 JavaScript 或内置 Pet 资源。
5. 不通过主窗口 CDP CSS 注入控制 Pet Overlay；Pet Overlay 是独立的窗口和渲染路径。

## 2. 不可降级的视觉标准

每一个 Pet 必须满足以下条件，否则不能进入安装阶段。

### 2.1 造型方向

Pet 必须是：

- 卡通化，而不是写实人物或照片；
- 拟人化，能够通过表情、姿态和动作表达工作状态；
- 大头小身体，头部是第一视觉焦点；
- 轮廓清晰，缩小后仍能识别；
- 适合桌面陪伴，不使用惊悚、血腥、攻击性或过度复杂的视觉语言。

### 2.2 比例标准

默认角色比例：

```text
头部高度：占角色总高度约 45%-60%
身体高度：占角色总高度约 40%-55%
头宽：不小于肩宽的 1.1 倍
脚部和手部：允许简化，但必须保持可识别姿态
角色占单帧高度：约 72%-90%
四周安全边距：至少 6%，不得裁切头发、耳朵、道具或脚部
```

这些数值是生成和 QA 的默认范围，不是要求每个角色具有相同的精确比例。特殊物体型 Pet 可以改变身体结构，但仍必须保留明显的“大头、小身体、拟人动作”视觉意图。

### 2.3 角色一致性

所有动作帧必须保持：

- 发型、脸型、眼睛和主要表情特征；
- 服装主色、材质、徽记和标志性配件；
- 头身比例和身体轮廓；
- 角色朝向逻辑；
- 透明背景和统一光照方向。

不得出现：

- 写实照片风格；
- 每帧不同脸型或不同服装；
- 多余角色；
- 文字、Logo、水印、对话框或 UI；
- 被裁切的头部和脚部；
- 复杂背景、地面、投影或不可去除的阴影。

## 3. 是否可以调用 Codex 生图

可以，但调用边界必须明确。

### 3.1 调用方式

Pet Skill 由 Codex Agent 调用原生 Image Generation。Node.js 脚本不直接调用 Image Generation API，也不要求用户配置额外的 `OPENAI_API_KEY`。

Image Generation 不可用时，Skill 必须报告原始错误并停止，不得假装生成完成，也不得自动切换到外部图像服务。

### 3.2 不建议单次生成最终图集

不建议让模型一次生成完整的 `8 × 9` 精灵图。常见风险：

- 网格线和单元格尺寸漂移；
- 每帧人物比例不一致；
- 脸部、服装和配件逐帧变化；
- 动作超出单元格；
- 背景无法真正透明；
- 出现文字、装饰线或额外角色。

推荐分两步：

```text
Image Generation 生成角色基准图
        ↓
Image Generation 生成动作帧或动作参考
        ↓
本地脚本统一尺寸和透明边缘
        ↓
本地脚本拼接 8 × 9 图集
```

### 3.3 推荐生图批次

第一批生成一张角色基准图，锁定：

- 大头小身体比例；
- 发型、脸部、服装和配件；
- 卡通化和拟人化程度；
- 主色和轮廓；
- 透明化所需的纯色背景。

第二批按动作状态生成素材。默认状态集合为：

```text
idle
running-right
running-left
waving
jumping
failed
waiting
running
review
```

实际行顺序和动画语义必须以当前 `hatch-pet` Skill 生成的契约为准。不要仅凭旧社区示例自行假定永久稳定的行映射。

## 4. 图集生成流程

### 4.1 输入分类

每张输入图必须明确角色：

- `subject/object`：保留人物或物体身份；
- `style-reference`：只继承色彩、材质和画风；
- `brand/logo`：只有用户明确授权时才使用。

如果用户提供的是人物主体，必须优先保持身份和标志性特征，再进行卡通化和拟人化。不要把风格参考图中的人物错误地当作主体复制。

### 4.2 动作提示词模板

```text
Create a cute anthropomorphic cartoon desktop pet based on the approved character reference.

Visual requirements:
- large head and small body;
- friendly expressive face;
- simplified readable silhouette;
- consistent hairstyle, outfit colors, accessories, and proportions;
- compact mascot scale suitable for a desktop overlay;
- no photorealism, no text, no logo, no watermark, no extra characters.

Action: <one action only>
Pose: <specific pose>
Expression: <specific expression>
Motion direction: <left, right, or front>
Background: perfectly flat #00FF00 chroma-key color;
no shadows, gradients, floor, texture, reflection, or background objects.
Keep the entire character inside the canvas with generous transparent-safe padding.
```

每次只生成一个动作或一个受控动作变体。不要在同一提示中混合多个动作状态。

### 4.3 透明化

默认使用纯色 chroma-key 背景：

```text
Codex Image Generation
  -> flat #00FF00 background
  -> local chroma-key removal
  -> alpha validation
  -> WebP output
```

本地去背景后必须检查：

- 四角 alpha 为 0；
- 角色主体 alpha 覆盖率合理；
- 头发、耳朵、手指和道具边缘没有明显绿边；
- 角色内部没有误删透明洞；
- 没有残留地面阴影。

复杂毛发、半透明材质、烟雾或玻璃等内容如无法通过 chroma-key 保留边缘，必须单独说明需要原生透明图像路径，不得默默降低质量。

### 4.4 本地确定性处理

建议使用 Node.js 和 `sharp` 完成：

1. 读取每张动作素材。
2. 去除或验证透明背景。
3. 按同一比例缩放角色。
4. 将角色居中放置到统一帧画布。
5. 对左右移动帧保持一致的脚底基线。
6. 对不含方向性配件的动作允许镜像生成反向帧。
7. 将帧填入当前 Pet 契约要求的 `8 × 9` 图集。
8. 导出 RGBA WebP。
9. 输出 contact sheet 供 Vision 检查。

图集总宽度必须能被 8 整除，总高度必须能被 9 整除。社区示例使用过 `1536 × 1872` 的 RGBA WebP，但尺寸不是本 Skill 的永久硬编码值；实际尺寸由当前 Pet 渲染契约和生成质量共同决定。

## 5. Pet 文件契约

```text
~/.codex/pets/<pet-id>/
├── pet.json
└── spritesheet.webp
```

最低 manifest 示例：

```json
{
  "id": "my-pet",
  "displayName": "My Pet",
  "description": "A cute anthropomorphic desktop companion.",
  "spritesheetPath": "spritesheet.webp"
}
```

MVP 不应自行添加未经当前应用验证的 `animation`、`chains` 或事件字段。社区已有提案希望让这些字段可配置，但当前应用仍主要负责动画行和事件映射。[OpenAI Codex Issue #20863](https://github.com/openai/codex/issues/20863)

## 6. 建议的 Skill 文件结构

```text
skill/codex-skin-studio/
├── SKILL.md
├── scripts/
│   ├── create-pet.mjs
│   ├── validate-pet.mjs
│   └── install-pet.mjs
├── templates/
│   └── pet.json
└── examples/
    └── pets/
        └── mascot/
            └── pet.json
```

### `create-pet.mjs`

负责将已确认的动作素材组装成完整 Pet：

- 读取最终动作图片；
- 统一尺寸、缩放和基线；
- 生成 `spritesheet.webp`；
- 写入 `pet.json`；
- 输出 contact sheet；
- 不调用外部网络服务。

### `validate-pet.mjs`

负责阻止不合格 Pet 进入安装目录：

- `id`、名称和路径合法；
- manifest 引用的精灵图存在且在 Pet 目录内；
- 图片为 WebP 或 PNG；
- 图像有 RGBA alpha 通道；
- 图集尺寸可被 8 和 9 整除；
- 每个动作行至少包含有效帧；
- 角色没有被明显裁切；
- 四角透明；
- 帧间头身比例和脚底基线稳定。

### `install-pet.mjs`

负责：

- 将经过校验的 Pet 原子复制到 `~/.codex/pets/<pet-id>/`；
- 不覆盖其他 Pet；
- 失败时回滚旧版本；
- 输出安装目录和 manifest；
- 提示用户在 ChatGPT Desktop 的 Pets 设置中 Refresh。

## 7. 用户体验

目标流程：

```text
用户：用这张图片生成一个大头小身体的日漫 Pet

Codex：分析主体和风格
Codex：生成卡通化基准角色
Codex：生成 idle / running / waiting / review 等动作
Codex：拼接并校验 8 × 9 图集
Codex：安装到本地 Pet 目录

用户：Settings > Pets > Refresh
用户：选择新 Pet，并使用 /pet 唤醒
```

Skill 必须报告：

- Pet 名称和 ID；
- 生成模式和输入图角色；
- 图集尺寸和单帧尺寸；
- 校验结果；
- 安装路径；
- 是否需要 Refresh 或重启。

## 8. 自动切换边界

### 8.1 MVP 支持

- 同一个 Pet 内部根据 ChatGPT 任务状态自动切换动画；
- Pet 在 Running、Waiting、Review、Failed 等状态之间切换对应帧；
- 用户手动在 Settings > Pets 中切换不同 Pet。

### 8.2 MVP 不支持

- 根据项目自动切换不同 Pet 包；
- 根据时间、模型或工作区自动切换 Pet；
- 通过主窗口 CDP CSS 控制独立 Pet Overlay；
- 修改应用包以重写内置 Pet 选择逻辑。

如果未来要做“不同 Pet 包自动切换”，应作为独立的实验性 Worker：使用 macOS Accessibility 或 Windows UI Automation 操作 Pets 设置，而不是改写应用内部数据。该方案依赖 UI 结构，更新后容易失效，不列入 MVP。

## 9. 质量和安全验收

### 视觉验收

- 大头小身体在 100% 和缩略尺寸下都明显；
- 角色具有清晰眼睛、表情和拟人姿态；
- 9 行动作风格一致；
- 角色不超出任何单元格；
- 不出现写实照片、文字、水印和多余人物；
- contact sheet 可人工快速检查所有动作；
- 最终 Pet 在浅色和深色桌面上都可辨认。

### 工程验收

- `pet.json` 与精灵图路径一致；
- 图集 alpha 和尺寸验证通过；
- 安装使用原子写入；
- 安装失败不破坏已有 Pet；
- 不修改 `app.asar` 或应用签名；
- 不上传用户参考图或生成中间图；
- 外部社区 Pet 必须检查许可证和安装脚本。

## 10. 实施阶段

### P0：验证官方契约

1. 安装或调用当前 `hatch-pet` Skill。
2. 生成一个大头小身体测试 Pet。
3. 保存官方生成的 `pet.json` 和图集。
4. 记录实际行顺序、尺寸和应用行为。

### P1：加入 Skill Agent 流程

1. 在英文 `SKILL.md` 中加入 Pet 生成模式。
2. 强制提示词包含 cartoon、anthropomorphic、large head、small body。
3. 由 Codex 原生 Image Generation 生成基准图和动作素材。
4. 由本地脚本拼接、校验和安装。

### P2：增强质量工具

1. 自动生成 contact sheet。
2. 自动测量角色占比、alpha 覆盖率和脚底基线。
3. 增加逐帧视觉 QA 报告。
4. 支持用户确认后重生成单个失败动作。

### P3：实验性自动选择

只在官方提供选择接口后实现。若没有官方接口，不把 UI 自动化或应用包补丁作为稳定产品能力。

## 11. 推荐结论

第一版 Pet 能力采用：

```text
Codex 原生 Image Generation
  + 大头小身体卡通拟人角色规范
  + 多动作单帧生成
  + Sharp 本地确定性图集处理
  + pet.json 校验
  + ~/.codex/pets 原子安装
  + ChatGPT Desktop 原生状态动画
```

这条路线能最大化利用 Codex 的 Vision 和生图能力，同时把最容易出错的尺寸、透明度、边界和文件安装交给确定性脚本。它不会依赖修改 ChatGPT Desktop，也不会把 Pet Overlay 和主界面皮肤耦合在一起。

## 12. 研究依据

- [OpenAI ChatGPT Pets documentation](https://learn.chatgpt.com/docs/pets?surface=app)
- [OpenAI ChatGPT Desktop Settings](https://learn.chatgpt.com/docs/reference/settings)
- [OpenAI Codex Issue #20863: configurable pet animation](https://github.com/openai/codex/issues/20863)
- [Mimi Codex Pet reference package](https://github.com/Spacebody/mimi-codex-pet)
- [codex-pet CLI and package documentation](https://codex-pet.com/docs)
