# The Roundtable (圆桌)

**The Roundtable (圆桌)** 是一个基于 MiniMax M2 AI 驱动的高品质智力讨论平台。它模拟了一个高端学术沙龙或跨学科辩论赛，允许用户作为”主持人”与多位 AI 模拟的嘉宾进行深度思想碰撞。

---

## 核心逻辑与流程

本项目采用状态机模式管理讨论的生命周期：

### 1. 用户入场 (Onboarding)
收集主持人的基本信息（昵称、身份背景、首选语言），AI 会根据主持人的身份调整讨论的专业深度。

### 2. 确定议题 (Landing & Topic Selection)
用户可以输入自定义话题，或点击随机生成。随机话题从 20 个领域（政治、哲学、伦理、经济、教育、环境、文化、艺术、体育等）中随机抽取，确保每次讨论都有新鲜感。

### 3. 专家阵容构建 (Panel Review)
AI 根据话题自动挑选 3 位具有不同视角的真实人物。用户可以通过”精准替换”自定义嘉宾：
- 输入具体姓名（如 “迪丽热巴”、”Elon Musk”），AI 会识别该人物并构建其在话题上的合理立场
- 输入模糊描述（如 “百度CEO”、”激进的环保主义者”），AI 自动匹配最符合的真实人物
- 支持并发替换多个嘉宾，互不干扰

### 4. 开场陈述阶段 (Opening Statements)
每位嘉宾依次进行 50 字以内的观点阐述，建立初始立场。每位嘉宾的发言都配有生动的**动作描述**（如 “她微微前倾，双手交叠放在桌上，目光坚定而温和”），以电影舞台指示的形式展现在 UI 中。

### 5. 自由辩论循环 (Discussion Loop)
核心机制：
- **发言预测**: AI 分析上下文（@提及、主持人隐含指令、对立观点）决定下一位发言者
- **深度与广度平衡**: 收敛（深入逻辑漏洞）与发散（切换视角）交替，防止讨论陷入死胡同
- **角色真实语气**: 每位嘉宾按照自己的真实身份说话——艺人有情感直觉和文化引用，科学家用分析性精确语言，活动家带激情和紧迫感
- **动作描述**: 每轮发言附带电影级的动作描述（如 “姚明露出惊讶的表情，随即仰头爽朗大笑”）
- **立场元数据**: 每条消息包含 `STANCE`（12 种立场）和 `INTENSITY`（1-5 强度），UI 据此展示视觉反馈
- **12% 随机发言者替换**: 偶尔选择意外的人选，增加讨论的不可预测性

### 6. 总结与复盘 (Summary)
讨论结束后，AI 生成详细的 JSON 报告：
- 5-8 句叙事总结，涵盖讨论的完整脉络
- 每位嘉宾 + 主持人的核心观点（4 个关键点 + 令人难忘的语录）
- 3+ 个关键讨论转折时刻
- 3+ 个未解决的开放性问题及原因
- 综合结论

---

## 技术实现

### AI 提示词工程
- **Character Context**: 为每位嘉宾注入真实人格背景，确保语气不”AI 味”
- **Strict Formatting**: 讨论回合使用 `STANCE||INTENSITY||MESSAGE||ACTION||ACTION_DESCRIPTION` 五段分隔格式
- **开篇陈述**: 使用 `SPEECH|||ACTION_DESC` 合并格式，单次 API 调用同时生成对话和动作
- **Thinking 防护**: `thinking: {type: “disabled”}` + 三层提取回退（引号提取 → 逐行倒扫 → 兜底）
- **Intellectual Flexibility**: 允许 AI 嘉宾在被说服时改变立场

### 前端架构
- **React 19 + TypeScript**: 严格类型检查
- **Material Design 3 (Dark Theme)**: 深色模式，海拔和阴影营造高端沙龙的沉浸感
- **Lucide React**: 直观的交互图标
- **Vite**: 快速开发与构建

---

## 使用方法

### 环境准备
在 `backend/.env` 中配置 MiniMax API（兼容 Anthropic Messages API）：

```
ANTHROPIC_API_KEY=sk-cp-***
ANTHROPIC_BASE_URL=https://api.minimaxi.com/anthropic/v1
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

### 交互指南
- **引导讨论**: 在输入框中使用 `@专家名` 强制指定下一位发言者
- **控制节奏**: AI 专家在讨论数轮后自动将话语权交还给主持人
- **调整阵容**: 在专家预览页面通过描述性文字或具体姓名替换嘉宾
- **查看总结**: 讨论中随时点击总结按钮，生成会议纪要

### 开发指令
```bash
# 安装依赖
npm install

# 启动后端 (port 3001)
cd backend && python main.py

# 启动前端 (port 5173)
npm run dev

# 生产环境构建
npm run build
```

---

## 目录结构

| 文件/目录 | 说明 |
|-----------|------|
| `App.tsx` | 顶层状态机，控制 7 个阶段切换 |
| `types.ts` | 核心数据模型（Participant, Message, AppState, Summary, UserContext） |
| `services/geminiService.ts` | 前端 AI 服务层，封装 API 调用（重试、超时、fallback） |
| `backend/main.py` | FastAPI 后端，代理 MiniMax M2 API，处理所有 AI 生成逻辑 |
| `components/ChatBubble.tsx` | 对话气泡（含 @提及高亮、立场徽章、动作描述） |
| `components/InputArea.tsx` | 输入区域（含 @提及弹窗） |
| `components/ParticipantCard.tsx` | 嘉宾卡片（替换、重命名） |
| `components/SummaryModal.tsx` | 总结弹窗（复制、分享） |
| `components/OnboardingForm.tsx` | 用户入场表单 |
| `vite.config.ts` | Vite 配置（含 API 代理） |

