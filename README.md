# The Roundtable (圆桌) 🎙️

**The Roundtable (圆桌)** 是一个基于 MiniMax M2 AI 驱动的高品质智力讨论平台。它模拟了一个高端学术沙龙或跨学科辩论赛，允许用户作为"主持人"与多位 AI 模拟的世界级专家进行深度思想碰撞。

---

## 🚀 核心逻辑与流程 (Core Logic & Workflow)

本项目采用状态机模式管理讨论的生命周期，完整流程如下：

### 1. 用户入场 (Onboarding)
*   **逻辑**: 收集主持人的基本信息（昵称、身份背景、首选语言）。
*   **目的**: AI 会根据主持人的身份调整其称呼和讨论的专业深度。

### 2. 确定议题 (Landing & Topic Selection)
*   **逻辑**: 用户可以输入自定义话题，或点击随机生成。
*   **AI 策略**: 随机生成的话题倾向于“跨学科结合”（例如：烹饪与哲学、生物学与建筑），以激发非同寻常的讨论。

### 3. 专家阵容构建 (Panel Review)
*   **逻辑**: AI 根据话题自动挑选 3 位最适合的当代专家。
*   **动态更换**: 用户可以点击专家卡片进行“精准替换”。
    *   支持输入具体姓名（如 "Elon Musk"）。
    *   支持输入模糊描述（如 "一个激进的环保主义者"），AI 会自动匹配最符合的真实人物。

### 4. 开场陈述阶段 (Opening Statements)
*   **逻辑**: 讨论开始后，每位专家依次进行 50 字以内的观点阐述。
*   **目的**: 建立各方的初始立场，为后续辩论铺垫。

### 5. 自由辩论循环 (Discussion Loop) - **核心机制**
这是项目最复杂的部分，由以下子逻辑驱动：
*   **发言预测 (Speaker Prediction)**: 每一轮结束后，AI 会分析上下文：
    *   是否有 @ 提到某人？
    *   主持人是否刚说完话？（隐含指令）
    *   谁的观点最对立？
*   **深度与广度平衡 (Depth vs Breadth)**:
    *   **收敛 (Converge)**: 深入钻研前一位发言者的逻辑漏洞。
    *   **发散 (Diverge/Pivot)**: 突然切换视角（如从“伦理”转向“经济”），防止讨论陷入死胡同。
*   **立场元数据**: 每条消息包含 `STANCE` (立场) 和 `INTENSITY` (强度)，UI 会据此展示不同的视觉反馈。

### 6. 总结与复盘 (Summary)
*   **逻辑**: 讨论结束后，AI 提取转录文本，生成包含“各方核心观点”和“未来开放性问题”的 JSON 报告。

---

## 🛠️ 技术实现 (Technical Implementation)

### AI 提示词工程 (Prompt Engineering)
*   **Intellectual Flexibility**: 提示词要求 AI 专家具备“智力灵活性”，如果被说服，允许其改变立场，增加真实感。
*   **Strict Formatting**: 使用 `||` 分隔符（如 `STANCE||INTENSITY||MESSAGE||ACTION`）确保 AI 输出的结构化数据可被前端解析。

### 前端架构
*   **React 19 + TypeScript**: 严格的类型检查确保数据流（Participant, Message, AppState）的稳定性。
*   **Material Design 3 (Dark Theme)**: 采用深色模式，利用海拔（Elevation）和阴影（Glow）营造高端沙龙的沉浸感。
*   **Lucide React**: 提供直观的交互图标。

---

## 📖 使用方法 (How to Use)

### 1. 环境准备
确保你拥有 MiniMax API Key。在 `.env` 文件中配置：

```env
ANTHROPIC_API_KEY=***
```

### 2. 交互指南
*   **引导讨论**: 在输入框中使用 `@专家名` 可以强制指定下一位发言者。
*   **控制节奏**: 默认情况下，AI 专家会在讨论 3-4 轮后自动将话语权交还给主持人。
*   **调整阵容**: 在“专家预览”页面，如果你觉得阵容不够平衡，可以通过描述性文字（如“来一个持怀疑态度的科学家”）来优化面板。

### 3. 开发指令
```bash
# 安装依赖
npm install

# 启动开发环境
npm run dev

# 生产环境构建
npm run build
```

---

## 📂 目录结构说明

*   `/services/`: AI 服务层
    *   `geminiService.ts`: AI 交互逻辑（前端调用后端）
    *   `backend/main.py`: MiniMax M2.7 API 后端服务（FastAPI）
*   `/App.tsx`: 顶层状态机，控制讨论的阶段切换。
*   `/components/`: 纯 UI 组件，负责气泡渲染、卡片展示等。
*   `/types.ts`: 定义了整个系统的核心数据模型。

### 后端启动

```bash
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 3001
```

---

*本项目探索生成式 AI 在模拟复杂人类社交与智力互动中的潜力。*
