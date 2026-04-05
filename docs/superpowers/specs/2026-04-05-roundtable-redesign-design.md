# The Roundtable - 完整重构设计文档

## 概述

将 AI 辩论平台从 React+Express 迁移到 React+Python FastAPI 架构，实现更稳定的生产和更好的流式输出体验。

## 技术栈

### 前端
- React 18.2.x (从 19 降级)
- Vite 5.x
- Tailwind CSS 3.4 (从 4 降级)
- Zustand 4.5.x (从 5 降级)
- Framer Motion 11.x (从 12 降级)
- Radix UI (保持)

### 后端
- Python 3.11+
- FastAPI 0.115+
- Uvicorn (ASGI 服务器)
- SQLite (轻量数据库)
- Anthropic Python SDK

### 共享
- IndexedDB (前端缓存)
- SSE (Server-Sent Events) 流式输出

## 项目结构

```
roundtable/
├── frontend/                    # React 前端
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/            # 基础 UI 组件
│   │   │   ├── chat/          # 聊天相关
│   │   │   ├── participants/  # 嘉宾卡片
│   │   │   ├── discussion/    # 辩论控制
│   │   │   ├── onboarding/    # 引导流程
│   │   │   └── summary/       # 总结
│   │   ├── hooks/             # 自定义 hooks
│   │   ├── stores/            # Zustand store
│   │   ├── services/          # API 调用
│   │   ├── types/             # TypeScript 类型
│   │   └── App.tsx
│   └── index.html
│
├── backend/                     # Python 后端
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py            # FastAPI 入口
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   ├── topics.py      # 话题相关
│   │   │   ├── panel.py       # 嘉宾生成
│   │   │   └── debate.py      # 辩论 API
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── llm.py         # Anthropic API
│   │   │   └── debate.py      # 辩论逻辑
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   └── schemas.py     # Pydantic 模型
│   │   └── db.py              # SQLite
│   ├── requirements.txt
│   └── run.py
│
└── shared/                      # 共享类型定义
    └── types.ts
```

## 数据模型

### Participant
```typescript
interface Participant {
  id: string;
  name: string;
  title: string;
  stance: string;       // 20字内
  color: string;        // #RRGGBB
}
```

### Message
```typescript
interface Message {
  id: string;
  participantId: string;
  content: string;
  stance?: 'AGREE' | 'DISAGREE' | 'PARTIAL' | 'PIVOT' | 'NEUTRAL';
  intensity?: number;   // 1-5
  timestamp: number;
}
```

### Debate
```typescript
interface Debate {
  id: string;
  topic: string;
  participants: Participant[];
  messages: Message[];
  status: 'pending' | 'active' | 'completed';
  createdAt: number;
}
```

## API 设计

### POST /api/topics/random
生成随机辩论话题
- Response: `{ topic: string, description?: string }`

### POST /api/panel/generate
根据话题生成三位辩论嘉宾
- Request: `{ topic: string }`
- Response: `{ participants: Participant[] }`

### POST /api/debate/start
开始辩论，生成开场陈述
- Request: `{ topic: string, participants: Participant[] }`
- Response: SSE 流，每个发言分块发送

### POST /api/debate/turn
生成下一轮发言
- Request: `{ debateId: string, history: Message[], participants: Participant[], turnCount: number }`
- Response: SSE 流，单条消息

### POST /api/debate/summarize
生成辩论总结
- Request: `{ debateId: string, history: Message[], participants: Participant[] }`
- Response: `{ topic: string, viewpoints: Record<string, string>, openQuestions: string[] }`

## 前端状态机

```
ONBOARDING → LANDING → GENERATING_PANEL → PANEL_REVIEW → DEBATING → SUMMARY
```

### 状态说明
- **ONBOARDING**: 用户输入昵称（单次，后续可扩展多用户）
- **LANDING**: 输入或随机生成辩论话题
- **GENERATING_PANEL**: 调用后端生成 3 位嘉宾
- **PANEL_REVIEW**: 用户可编辑嘉宾名称/替换单个嘉宾
- **DEBATING**: 顺序发言，AI 自动辩论
- **SUMMARY**: 辩论结束，显示总结，可导出

## Bug 修复清单

| # | 问题 | 修复方案 |
|---|------|---------|
| 1 | 第三人消息截断 | 后端 SSE 流式返回，前端逐步接收，60s 超时 |
| 2 | Random 按钮无 loading | 增加 isLoading 状态 + Tailwind spinner |
| 3 | @ 提及无自动补全 | 简化为快速选择列表，点击或 / 触发 |
| 4 | AI 输出不流式 | FastAPI + SSE 实现真正流式 |

## 辩论逻辑

### 发言规则
1. 三位嘉宾按顺序轮流发言
2. 不能连续两次是同一个发言者
3. 每轮 1-3 回合后等待用户输入（或自动继续）
4. 发言格式: `STANCE||INTENSITY||MESSAGE||ACTION`
   - STANCE: AGREE/DISAGREE/PARTIAL/PIVOT/NEUTRAL
   - INTENSITY: 1-5
   - ACTION: CONTINUE/WAIT

### 策略
- 25% 概率 PIVOT（拓展话题）
- 75% 概率 CONVERGE（深入当前话题）
- 每条消息最大 500 tokens

## 测试策略

### 前端 (Vitest + Playwright)
- 组件单元测试
- E2E 测试关键流程：引导 → 生成话题 → 辩论 → 总结

### 后端 (pytest)
- API 路由测试
- LLM 服务 mock 测试
- 流式输出测试

## 依赖版本

### 前端 (package.json)
```json
{
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "zustand": "^4.5.0",
  "framer-motion": "^11.0.0",
  "tailwindcss": "^3.4.0",
  "@tailwindcss/vite": "^3.4.0",
  "vite": "^5.4.0",
  "typescript": "^5.4.0"
}
```

### 后端 (requirements.txt)
```
fastapi>=0.115.0
uvicorn[standard]>=0.30.0
anthropic>=0.38.0
python-dotenv>=1.0.0
pydantic>=2.0
pytest>=8.0
pytest-asyncio>=0.24
httpx>=0.27
```

## 设计决策

1. **SQLite 而非 PostgreSQL**: 轻量级个人使用，无需额外服务
2. **SSE 而非 WebSocket**: 简单够用，FastAPI 原生支持
3. **保持 Zustand**: 状态管理清晰，无需引入 Redux
4. **共享 types/ 目录**: TS 类型与 Python Pydantic 模型对应
