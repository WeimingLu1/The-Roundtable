# The Roundtable (圆桌) 🎙️

一个高品质的智力圆桌讨论平台。在这里，你可以作为主持人，与 AI 模拟的世界级专家进行深度辩论和思想碰撞。

## 🌟 项目简介

**The Roundtable (圆桌)** 旨在模拟真实的学术沙龙或高端访谈。通过 Google Gemini AI 的强大能力，系统会根据你选择的主题，自动“邀请”最适合的 3 位当代专家（如 Elon Musk, Yuval Noah Harari 等）进行多轮深度对话。

你可以参与其中，引导话题，挑战专家的观点，或者只是旁听这场跨学科的思想盛宴。

## ✨ 核心功能

- **智能开场**: 根据讨论主题，AI 自动挑选 3 位具有代表性、观点多元的当代专家。
- **灵活定制**: 你可以通过姓名或描述（如“一个激进的 AI 批评者”）随时更换嘉宾，AI 会自动识别并赋予其真实的身份和立场。
- **深度辩论逻辑**:
  - **开场陈述**: 每位专家首先进行简明扼要的观点阐述。
  - **动态发言预测**: AI 会根据对话上下文、@提到的人、以及讨论的激烈程度，自动决定下一位发言者。
  - **收敛与发散**: AI 会在深入钻研当前逻辑（Depth）和切换新视角（Breadth）之间取得平衡。
- **立场与强度**: 每一条发言都带有明确的立场标签（赞同、反对、中立、转向）和情绪强度（1-5级）。
- **实时总结**: 讨论结束后，AI 会生成一份包含各方核心观点和未来开放性问题的总结报告。
- **多语言支持**: 支持中文、英文等多种语言。

## 🛠️ 技术栈

- **前端框架**: React 19 + TypeScript
- **构建工具**: Vite
- **UI 样式**: Tailwind CSS + Material Design 3 (Dark Theme)
- **AI 引擎**: Google Gemini API (`@google/genai`)
- **图标库**: Lucide React
- **动画**: CSS 微交互与脉冲效果

## 📂 项目结构

```text
├── components/             # UI 组件库
│   ├── ChatBubble.tsx      # 聊天气泡（展示立场与强度）
│   ├── InputArea.tsx       # 主持人输入区
│   ├── OnboardingForm.tsx  # 用户信息设置
│   ├── ParticipantCard.tsx # 专家卡片（支持编辑与更换）
│   └── SummaryModal.tsx    # 讨论总结弹窗
├── services/
│   └── geminiService.ts    # AI 核心逻辑（提示词工程、API 调用）
├── App.tsx                 # 主程序逻辑与状态管理（讨论循环控制）
├── types.ts                # TypeScript 类型定义
├── index.html              # 入口 HTML（包含 Tailwind 配置与 MD3 主题）
└── vite.config.ts          # Vite 配置文件
```

## 🚀 运行逻辑

1. **用户入场 (Onboarding)**: 设置你的昵称、身份（如“好奇的大学生”或“资深记者”）和语言。
2. **确定主题 (Landing)**: 输入你感兴趣的话题，或让 AI 随机生成一个跨学科的有趣题目。
3. **专家阵容 (Panel Review)**: AI 推荐 3 位专家。你可以点击卡片修改他们的名字，或输入描述让 AI 重新匹配一位嘉宾。
4. **开场陈述 (Opening)**: 专家们依次发言，建立讨论基调。
5. **自由讨论 (Discussion)**:
   - 专家之间会自动互动、挑战对方。
   - 讨论几轮后，AI 会主动将话语权交还给你（主持人）。
   - 你可以随时插话，提问或引导新的方向。
6. **总结陈词 (Summary)**: 随时结束讨论，查看 AI 生成的深度总结。

## ⚙️ 环境配置

项目需要 Google Gemini API Key 才能运行。

1. 在项目根目录创建 `.env` 文件。
2. 添加你的 API Key:
   ```env
   GEMINI_API_KEY=你的_API_KEY
   ```

## 📦 安装与启动

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

## 📝 提示词工程 (Prompt Engineering)

本项目在 `services/geminiService.ts` 中实现了复杂的提示词逻辑，包括：
- **Anti-Cluster Pivot**: 防止讨论陷入单一逻辑死循环。
- **Implicit Cue**: 识别主持人的隐含指令。
- **Intellectual Flexibility**: 鼓励 AI 专家在逻辑被说服时改变立场，而非死板坚持。

---

*由 Google AI Studio Build 驱动开发。*
