# The Roundtable (圆桌) 🎙️

一个高品质的智力圆桌讨论平台。在这里，你可以作为主持人，与 AI 模拟的世界级专家进行深度辩论和思想碰撞。

## 🌟 项目简介

**The Roundtable (圆桌)** 旨在模拟真实的学术沙龙或高端访谈。通过 MiniMax AI 的强大能力，系统会根据你选择的主题，自动"邀请"最适合的 3 位当代专家（如 Sam Altman, Yuval Noah Harari 等）进行多轮深度对话。

你可以参与其中，引导话题，挑战专家的观点，或者只是旁听这场跨学科的思想盛宴。

## ✨ 核心功能

- **智能开场**: 根据讨论主题，AI 自动挑选 3 位具有代表性、观点多元的当代专家。
- **灵活定制**: 你可以通过姓名或描述（如"一个激进的 AI 批评者"）随时更换嘉宾，AI 会自动识别并赋予其真实的身份和立场。
- **深度辩论逻辑**:
  - **开场陈述**: 每位专家首先进行简明扼要的观点阐述。
  - **动态发言预测**: AI 会根据对话上下文、@提到的人、以及讨论的激烈程度，自动决定下一位发言者。
  - **收敛与发散**: AI 会在深入钻研当前逻辑（Depth）和切换新视角（Breadth）之间取得平衡。
- **立场与强度**: 每一条发言都带有明确的立场标签（赞同、反对、中立、转向）和情绪强度（1-5级）。
- **实时总结**: 讨论结束后，AI 会生成一份包含各方核心观点和未来开放性问题的总结报告。
- **多语言支持**: 支持中文、英文、日文、西班牙文等多种语言。

## 🛠️ 技术栈

- **前端框架**: React 19 + TypeScript
- **构建工具**: Vite
- **UI 样式**: Tailwind CSS v4 + shadcn/ui (Dark Theme)
- **AI 引擎**: MiniMax API (Anthropic compatible format)
- **图标库**: Lucide React
- **动画**: Framer Motion
- **状态管理**: Zustand with persist middleware
- **持久化**: IndexedDB

## 📂 项目结构

```
├── src/
│   ├── App.tsx                 # 主程序逻辑与状态管理
│   ├── components/
│   │   ├── chat/              # 聊天气泡相关 (ChatBubble, ChatList, StanceBadge, TypingIndicator)
│   │   ├── discussion/         # 讨论区组件 (DiscussionHeader, InputArea, SpeedControl)
│   │   ├── layout/            # 布局组件 (AppShell)
│   │   ├── onboarding/       # 用户设置 (OnboardingForm)
│   │   ├── participants/     # 专家卡片 (ParticipantCard, ParticipantAvatar)
│   │   ├── summary/           # 总结弹窗 (SummaryModal)
│   │   └── ui/                # 基础 UI 组件 (button, card, dialog, dropdown-menu, select, textarea)
│   ├── services/
│   │   ├── minimaxService.ts   # AI 核心逻辑（API 调用）
│   │   ├── promptTemplates.ts  # 提示词模板
│   │   └── exportService.ts    # 导出服务 (Markdown/PDF)
│   ├── stores/
│   │   ├── useAppStore.ts     # 主状态管理 (Zustand)
│   │   └── useSettingsStore.ts # 设置状态 (主题、速度)
│   ├── hooks/                  # 自定义 Hooks
│   ├── types.ts               # TypeScript 类型定义
│   └── styles/                # 全局样式
├── server.js                   # Express 代理服务器 (端口 3001)
├── vite.config.ts             # Vite 配置
└── tsconfig.json              # TypeScript 配置
```

## 🚀 运行逻辑

1. **用户入场 (Onboarding)**: 设置你的昵称、身份（如"好奇的大学生"或"资深记者"）和语言。
2. **确定主题 (Landing)**: 输入你感兴趣的话题，或让 AI 随机生成一个跨学科的有趣题目。
3. **专家阵容 (Panel Review)**: AI 推荐 3 位专家。你可以点击卡片修改他们的名字，或输入描述让 AI 重新匹配一位嘉宾。
4. **开场陈述 (Opening)**: 专家们依次发言，建立讨论基调。
5. **自由讨论 (Discussion)**:
   - 专家之间会自动互动、挑战对方。
   - 讨论几轮后，AI 会主动将话语权交还给你（主持人）。
   - 你可以随时插话，提问或引导新的方向。
6. **总结陈词 (Summary)**: 随时结束讨论，查看 AI 生成的深度总结。

## ⚙️ 环境配置

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 API Key

在项目根目录创建 `.env` 文件：

```env
ANTHROPIC_API_KEY=你的_MiniMax_API_Key
```

> 注意：MiniMax API Key 需要从 [MiniMax Platform](https://platform.minimaxi.com/) 获取。

### 3. 启动开发服务器

```bash
npm run dev
```

这会同时启动：
- 前端开发服务器 (http://localhost:5173)
- 后端代理服务器 (http://localhost:3001)

### 4. 构建生产版本

```bash
npm run build
```

构建产物会输出到 `dist/` 目录。

## 📝 提示词工程 (Prompt Engineering)

本项目在 `src/services/promptTemplates.ts` 中实现了复杂的提示词逻辑：

### 核心策略

| 策略 | 描述 |
|------|------|
| **Anti-Cluster Pivot** | 防止讨论陷入单一逻辑死循环，当检测到重复时会强制切换话题维度 |
| **Implicit Cue** | 识别主持人的隐含指令，如 @ 提及时自动让被提及者发言 |
| **Intellectual Flexibility** | 鼓励 AI 专家在逻辑被说服时改变立场，而非死板坚持 |
| **PIVOT Strategy** | 随机 25% 概率切换到新话题维度，增加讨论的多样性 |

### 消息格式

AI 响应使用 `||` 分隔的格式：
```
STANCE||INTENSITY||MESSAGE||ACTION
```

例如：
```
DISAGREE||4||I strongly reject this premise because...||CONTINUE
```

### 立场类型

- `AGREE` - 同意
- `DISAGREE` - 反对
- `PARTIAL` - 部分同意
- `PIVOT` - 转向新话题
- `NEUTRAL` - 中立

## 🐛 已知问题 (Known Issues)

以下问题已修复：

| # | 问题 | 描述 | 状态 |
|---|------|------|------|
| 1 | 讨论状态异常回滚 | React StrictMode 导致面板生成完成后状态回滚 | ✅ 已修复 |
| 2 | 辩论重复启动 | 严格模式下 debateController 重复调用导致消息重复 | ✅ 已修复 |
| 3 | 消息显示格式前缀 | partial 事件中显示 `\|\|` 等原始格式字符 | ✅ 已修复 |

待修复问题：

| # | 问题 | 描述 | 状态 |
|---|------|------|------|
| 4 | 第三方发言截断 | 第三位专家的开场白有时显示 "..." 占位符 | 待修复 |
| 5 | Random 按钮无加载提示 | 点击随机生成话题时没有视觉反馈 | 待修复 |
| 6 | @ 提及自动完成 | 输入 @ 时没有弹出参与者姓名自动完成 | 待修复 |
| 7 | AI 输出非流式 | AI 响应是一次性显示而非逐字显示 | 待修复 |

## 🎨 截图预览

（截图待添加）

## 📄 License

MIT License

---

*由 MiniMax AI 驱动开发。*
