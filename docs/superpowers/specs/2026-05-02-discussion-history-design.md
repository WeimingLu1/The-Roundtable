# Discussion History Design — Roundtable (圆桌)

Date: 2026-05-02
Status: Approved

## Overview

Persist roundtable discussions so users can view their history, revisit past discussions, and continue them. Each discussion saves the topic, participants, all messages, and summary to SQLite.

## Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Data model | Normalized: `discussions` + `messages` tables | Proper relational design, incremental message appends, queryable |
| Participants storage | JSON column in discussions | Fixed small array, always read/written together |
| Summary storage | JSON column | Matches frontend `Summary` type 1:1 |
| Continue behavior | Append messages to existing discussion | Single continuous thread per topic |
| History entry | Landing page button → `/history` route | Natural placement alongside "Start New" |
| Soft delete | `status = 'archived'` | Preserves data, consistent with users table pattern |

## Data Model

```sql
CREATE TABLE discussions (
    id                TEXT PRIMARY KEY,
    user_id           TEXT NOT NULL,
    topic             TEXT NOT NULL,
    participants_json TEXT NOT NULL,   -- JSON array of Participant
    summary_json      TEXT,            -- JSON Summary object, nullable
    status            TEXT DEFAULT 'active',  -- 'active' | 'archived'
    message_count     INTEGER DEFAULT 0,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE messages (
    id                 TEXT PRIMARY KEY,     -- same as frontend Message.id
    discussion_id      TEXT NOT NULL,
    sender_id          TEXT NOT NULL,
    text               TEXT NOT NULL,
    stance             TEXT,                 -- nullable
    stance_intensity   INTEGER,             -- nullable, 1-5
    action_description TEXT,                 -- nullable
    timestamp          INTEGER NOT NULL,     -- unix milliseconds
    FOREIGN KEY (discussion_id) REFERENCES discussions(id) ON DELETE CASCADE
);

CREATE INDEX idx_discussions_user ON discussions(user_id, updated_at DESC);
CREATE INDEX idx_messages_discussion ON messages(discussion_id, timestamp);
```

`participants_json` stores the full `Participant[]` array: `[{"id":"expert_0","name":"姚明","title":"篮球运动员","stance":"...","color":"#EF4444","roleType":"expert"}, ...]`.

## Backend API

All endpoints require JWT auth via `get_current_user` dependency.

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/discussions` | Create new discussion |
| `GET` | `/api/discussions` | List user's discussions (no messages, ordered by updated_at DESC) |
| `GET` | `/api/discussions/{id}` | Get full discussion with all messages |
| `POST` | `/api/discussions/{id}/messages` | Append messages (batch of new Message objects) |
| `PUT` | `/api/discussions/{id}` | Update discussion (summary, status) |
| `DELETE` | `/api/discussions/{id}` | Archive discussion (sets status='archived') |

### Request/Response Shapes

**POST /api/discussions** request:
```json
{
  "topic": "AI是否拥有意识？",
  "participants": [{"id":"expert_0","name":"姚明",...}, ...]
}
```
Response: full discussion object with `id`, `message_count: 0`.

**GET /api/discussions** response:
```json
{
  "discussions": [{
    "id": "uuid",
    "topic": "AI是否拥有意识？",
    "participants": [...],
    "message_count": 24,
    "status": "active",
    "created_at": "2026-05-02T10:00:00",
    "updated_at": "2026-05-02T10:30:00"
  }]
}
```

**GET /api/discussions/{id}** response: same as above but includes `"messages": [...]` and `"summary": {...}`.

**POST /api/discussions/{id}/messages** request:
```json
{
  "messages": [
    {"id":"1734567890123","senderId":"expert_1","text":"...","stance":"AGREE","stanceIntensity":4,"actionDescription":"...","timestamp":1734567890123}
  ]
}
```
Backend increments `message_count` by len(messages) and updates `updated_at`.

**PUT /api/discussions/{id}** request:
```json
{
  "summary": {"topic":"...","summary":"...","core_viewpoints":[...],...},
  "status": "active"
}
```

### Discussion Ownership

Regular users can only access their own discussions (`user_id = current_user.id`).

**Admin superuser**: Admins (`is_admin = true`) can access ALL users' discussions. When admin accesses a discussion, the `user_id` filter is skipped. Additionally, admin can impersonate the discussion owner to continue the discussion on their behalf.

### Admin Discussion Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/admin/discussions` | List ALL discussions across all users (with owner name) |
| `GET` | `/api/admin/discussions/{id}` | Get any discussion with all messages |
| `POST` | `/api/admin/discussions/{id}/messages` | Append messages as the discussion owner (impersonation) |
| `PUT` | `/api/admin/discussions/{id}` | Update any discussion |
| `DELETE` | `/api/admin/discussions/{id}` | Archive any discussion |

Admin discussion list includes the owner's name and email for identification:
```json
{
  "discussions": [{
    "id": "uuid",
    "user_name": "张三",
    "user_email": "zhang@example.com",
    "topic": "AI是否拥有意识？",
    "participants": [...],
    "message_count": 24,
    "status": "active",
    "created_at": "...",
    "updated_at": "..."
  }]
}
```

When admin posts messages via the admin endpoint, the `sender_id = 'user'` messages are stored under the original discussion owner's identity, but the backend records `sender_id = 'user'` as usual — the impersonation is transparent (admin is effectively acting as the host of that discussion).

## Backend Implementation

### New file: `backend/routes_discussions.py`

FastAPI router with prefix `/api/discussions`. Uses `get_current_user` dependency from `routes_auth.py`.

### Modified file: `backend/db.py`

Add functions:
- `create_discussion(user_id, topic, participants_json) -> dict`
- `get_discussion(discussion_id) -> dict | None`
- `list_discussions(user_id) -> list[dict]` (no messages column)
- `get_discussion_messages(discussion_id) -> list[dict]`
- `insert_messages(discussion_id, messages: list[dict]) -> None`
- `update_discussion(discussion_id, **fields) -> dict | None`
- `archive_discussion(discussion_id) -> bool`

### Modified file: `backend/main.py`

Mount the new router: `app.include_router(discussions_router)`

### Schema migration

Add `CREATE TABLE IF NOT EXISTS` for discussions and messages in `init_db()`. No migration framework needed — `IF NOT EXISTS` handles existing databases.

## Frontend

### New files

| File | Purpose |
|---|---|
| `components/HistoryList.tsx` | History list page at `/history` |
| `components/DiscussionDetail.tsx` | View/continue discussion at `/discussion/:id` |
| `services/discussionService.ts` | API calls for discussion CRUD |

### Modified files

| File | Change |
|---|---|
| `App.tsx` | Discussion lifecycle: create on start, append messages each turn, save summary |
| `lib/router.ts` | Add path parameter support (`/discussion/:id`) |
| `index.tsx` | Register `/history` and `/discussion/:id` routes |
| `backend/db.py` | Add discussion + message CRUD functions |
| `backend/main.py` | Mount discussions router, add tables to init_db |
| `components/AdminPage.tsx` | **Modify** — add "All Discussions" tab showing every user's discussions |

### HistoryList Page

Card-based list layout. Each card shows:
- Topic (bold, primary text)
- Participant names (comma-separated, secondary text)
- Message count + relative time ("3 days ago")
- Click navigates to `/discussion/:id`

Empty state: "No discussions yet. Start your first roundtable!"

### DiscussionDetail Page

Self-contained component that loads a discussion from API and either displays it (read-only with summary) or continues it (live discussion loop).

**Read-only view**: For discussions with a saved summary. Shows messages via `ChatBubble`, renders summary at the bottom. "Continue Discussion" button transitions to live mode.

**Live continuation**: If status is `active` and no summary yet, or user clicks "Continue", runs the full discussion loop:
- Same speaker prediction + turn generation logic as `App.tsx` (extracted to a shared `useDiscussionLoop` hook or duplicated in DiscussionDetail)
- New messages append to the existing discussion via `POST /api/discussions/{id}/messages`
- InputArea for user intervention, same as App.tsx

This keeps DiscussionDetail independent from App.tsx's state machine — cleaner separation.

### Router Enhancement

Current router maps exact paths. Need to support `:id` parameter:
- `addRoute('/discussion/:id', (params) => <DiscussionDetail id={params.id} />)`
- Implementation: try exact match first, fall back to pattern match that extracts `:param` segments. Store extracted params in the handler argument.

### App.tsx Integration Points

Changes to existing `App.tsx` — new discussion lifecycle:

1. **Create discussion on start**: In `handleConfirmPanel`, before entering OPENING_STATEMENTS, call `POST /api/discussions` with topic + participants. Store returned `discussionId` in a new state variable.

2. **Save messages each turn**: In the discussion effect, after `setMessages(prev => [...prev, newMessage])`, call `POST /api/discussions/{discussionId}/messages` with the new message. Fire-and-forget (don't block the UI).

3. **Save summary**: After `generateSummary` returns, call `PUT /api/discussions/{discussionId}` with the summary JSON.

### Landing Page

Add a "History" button below the "Summon Guests" button:
```tsx
<button onClick={() => navigate('/history')} 
  className="w-full text-md-secondary text-sm font-medium py-3 rounded-full hover:bg-white/5 transition-colors">
  View Past Discussions →
</button>
```

### Admin All-Discussions View

AdminPage gets a second tab "All Discussions" next to "Users". Shows a table/card list of ALL discussions across all users:

```
┌──────────────────────────────────────────────────┐
│  Admin Panel                                     │
│  [Users]  [All Discussions]                      │
│                                                  │
│  ┌──────────────────────────────────────────┐    │
│  │ 张三 · AI是否拥有意识？                    │    │
│  │ 姚明, Elon Musk, 迪丽热巴                │    │
│  │ 24 msgs · 2 days ago · active      [→]   │    │
│  ├──────────────────────────────────────────┤    │
│  │ 李四 · 全民基本收入可行吗？               │    │
│  │ Taylor Swift, Gordon Ramsay, 李开复     │    │
│  │ 18 msgs · 5 days ago · archived   [→]   │    │
│  └──────────────────────────────────────────┘    │
└──────────────────────────────────────────────────┘
```

Each card shows: owner name, topic, participants, message count, status badge, time. Click → `/discussion/:id` with admin context. When admin continues a discussion, messages are posted via the admin endpoint, impersonating the original user as host.

## Discussion Continue Flow

1. User clicks a discussion in HistoryList
2. Router navigates to `/discussion/:id`  
3. DiscussionDetail loads full discussion (participants, messages, summary)
4. User types in InputArea → triggers same discussion loop as in App.tsx
5. New messages append to existing discussion ID
6. User can also view the saved summary

## Security

- All `/api/discussions/*` endpoints filter by `user_id` from JWT — users can only access their own discussions
- All `/api/admin/discussions/*` endpoints require `require_admin` dependency
- Input validation: topic max 500 chars, participants array 1-10 items
- Messages batch size limited to 50 per request
- Admin impersonation is transparent — the original discussion owner's identity is preserved

## Testing Strategy

- Backend: pytest tests for all 6 discussion endpoints (create, list, get, append messages, update, delete) plus ownership validation
- Frontend: TypeScript compilation, manual flow testing (create → view history → continue → save summary)
