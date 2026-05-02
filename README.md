# The Roundtable (圆桌)

**The Roundtable** is a MiniMax M2 AI-powered intellectual discussion platform. It simulates an elite salon or interdisciplinary debate where you act as the host, engaging with AI-simulated guests for deep intellectual exchange.

**圆桌** 是一个基于 MiniMax M2 AI 驱动的高品质智力讨论平台。它模拟了一个高端学术沙龙或跨学科辩论赛，允许用户作为主持人，与多位 AI 模拟的嘉宾进行深度思想碰撞。

## Screenshots / 界面预览

**Panel / 嘉宾阵容**

![Panel](docs/screenshots/02-panel-review.png)

**Discussion / 讨论**

![Discussion](docs/screenshots/01-discussion.png)

---

## Core Workflow / 核心流程

The project uses a state machine to manage the discussion lifecycle:

本项目采用状态机模式管理讨论的生命周期：

### 1. Login / 登录
Sign in with Google, GitHub, or email/password. First user becomes admin automatically.

支持 Google、GitHub 或邮箱密码登录。首个注册用户自动成为管理员。

### 2. Onboarding / 用户入场
Collect the host's basic info (nickname, identity, language). The AI adapts its tone and depth accordingly.

收集主持人的基本信息（昵称、身份背景、首选语言），AI 据此调整讨论的专业深度。

### 3. Topic Selection / 确定议题
Enter a custom topic or generate a random one. Random topics are drawn from **20 diverse domains** (politics, philosophy, ethics, economics, education, environment, culture, art, sports, etc.) — no repetitive AI themes.

输入自定义话题或随机生成。随机话题从 **20 个领域**（政治、哲学、伦理、经济、教育、环境、文化、艺术、体育等）中随机抽取。

### 3. Panel Building / 专家阵容构建
AI picks 3 real people with contrasting perspectives. Customize via "precision swap":
- **Specific name** (e.g. "Taylor Swift", "迪丽热巴") — AI identifies the person and builds a plausible stance
- **General description** (e.g. "a skeptical economist", "百度CEO") — AI matches the best real person
- Concurrent swaps supported without interference

AI 挑选 3 位真实人物。通过精准替换自定义嘉宾：具体姓名 AI 直接识别；模糊描述 AI 自动匹配；支持并发替换。

### 4. Opening Statements / 开场陈述
Each guest delivers a sub-50-word opening statement establishing their position. Every speech includes a vivid **action description** (e.g. "She leans forward, hands clasped on the table, her gaze steady and warm") displayed as cinematic stage directions in the UI.

每位嘉宾进行 50 字以内的观点阐述，配有生动的**动作描述**（如"她微微前倾，双手交叠放在桌上，目光坚定而温和"），以电影舞台指示的形式展现在 UI 中。

### 5. Discussion Loop / 自由辩论循环
Core mechanisms:
- **Speaker prediction**: AI analyzes context (@mentions, host cues, opposing views)
- **Depth vs. breadth**: Converge (drill into logic) and diverge (pivot perspective) alternate
- **Authentic character voices**: Each guest speaks as their real persona — entertainers use emotional intuition, scientists use analytical precision, activists bring fire and urgency
- **Action descriptions**: Every turn includes a cinematic stage direction (e.g. "Elon Musk leans forward, eyes blazing with intensity")
- **Stance metadata**: 12 stances (AGREE, DISAGREE, SURPRISED, INTRIGUED, CHALLENGED, CONCEDE, BUILD_ON, CLARIFY, QUESTION, etc.) with 1-5 intensity
- **12% random speaker override**: Occasionally picks an unexpected speaker for unpredictability

核心机制：**发言预测**（AI 分析上下文决定下一位发言者）、**深度与广度平衡**（收敛与发散交替）、**角色真实语气**（艺人情感直觉、科学家分析精确、活动家激情紧迫）、**动作描述**（每轮电影级舞台指示）、**12 种立场 + 1-5 强度元数据**、**12% 随机发言者替换**。

### 6. Summary / 总结与复盘
AI generates a detailed JSON report:
- 5-8 sentence narrative covering the full discussion arc
- Core viewpoints for every guest **plus the host** (4 key points + memorable quote each)
- 3+ key discussion turning points
- 3+ unresolved open questions with explanations
- Synthesis conclusion

AI 生成详细 JSON 报告：5-8 句叙事总结、每位嘉宾 + 主持人的核心观点、3+ 个关键转折时刻、3+ 个开放性问题及原因、综合结论。

### 7. History / 讨论历史
All discussions are automatically saved. Browse past discussions, view full transcripts, and continue any discussion from where it left off. Admin can access all users' discussions.

所有讨论自动保存。浏览历史讨论、查看完整记录、随时继续讨论。管理员可访问所有用户的讨论。

### 8. Admin Panel / 管理面板
User management (CRUD), admin/superuser controls, and full visibility into all platform discussions. Admins can ghost into any user's discussion to continue on their behalf.

用户管理（增删改查）、权限控制、全平台讨论可见。管理员可以 ghost 进入任意用户的讨论代为继续。

---

## Technical Implementation / 技术实现

### Prompt Engineering / 提示词工程
- **Character Context**: Injects real persona background so guests don't sound "AI-like"
- **Discussion format**: `STANCE||INTENSITY||MESSAGE||ACTION||ACTION_DESCRIPTION` (5-part pipe-delimited)
- **Opening format**: `SPEECH|||ACTION_DESC` (single API call for speech + action)
- **Thinking guard**: `thinking: {type: "disabled"}` in extra_body + 3-tier extraction fallback (quote extraction → line scan → raw)
- **Intellectual flexibility**: AI guests can change their stance when persuaded

### Frontend / 前端
- **React 19 + TypeScript**: Strict type safety
- **Material Design 3 (Dark Theme)**: Elevation and glow for an immersive salon atmosphere
- **Lucide React**: Icon library
- **Vite**: Fast dev server and builds

---

## How to Use / 使用方法

### Environment Setup / 环境准备
Configure MiniMax API (Anthropic Messages API compatible) in `backend/.env`:

在 `backend/.env` 中配置 MiniMax API（兼容 Anthropic Messages API）：

```
ANTHROPIC_API_KEY=sk-cp-***
ANTHROPIC_BASE_URL=https://api.minimaxi.com/anthropic/v1
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

### Interaction Tips / 交互指南
- Use `@GuestName` to force the next speaker / 使用 `@专家名` 强制指定下一位发言者
- AI yields back to the host after several rounds / AI 在数轮后自动交还话语权
- Replace guests by name or description on the panel review screen / 在专家预览页面替换嘉宾
- Click the summarize button anytime during discussion / 讨论中随时点击总结按钮

### Development / 开发指令
```bash
npm install                # Install dependencies / 安装依赖
cd backend && python main.py  # Start backend (port 3001) / 启动后端
npm run dev                # Start frontend (port 5173) / 启动前端
npm run build              # Production build / 生产环境构建
```

---

## Directory Structure / 目录结构

| File / 文件 | Description / 说明 |
|-------------|-------------------|
| `App.tsx` | Top-level state machine, 7 stages / 顶层状态机，7 个阶段 |
| `types.ts` | Core data models (Participant, Message, AppState, Summary, UserContext) |
| `services/geminiService.ts` | Frontend AI service layer (retry, timeout, fallback) / 前端 AI 服务层 |
| `backend/main.py` | FastAPI backend, MiniMax M2 API proxy / FastAPI 后端 |
| `components/ChatBubble.tsx` | Chat bubble (@mentions, stance badges, action descriptions) / 对话气泡 |
| `components/InputArea.tsx` | Input area with @mention popup / 输入区域 |
| `components/ParticipantCard.tsx` | Guest card (swap, rename) / 嘉宾卡片 |
| `components/SummaryModal.tsx` | Summary modal (copy, share) / 总结弹窗 |
| `components/OnboardingForm.tsx` | Host onboarding form / 用户入场表单 |
| `vite.config.ts` | Vite config with API proxy / Vite 配置 |
