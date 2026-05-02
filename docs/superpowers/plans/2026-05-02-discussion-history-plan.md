# Discussion History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist roundtable discussions to SQLite, show history list, enable viewing and continuing past discussions, and give admins access to all users' discussions.

**Architecture:** Two new SQLite tables (`discussions` + `messages`), a new backend router (`routes_discussions.py`), two new frontend pages (`HistoryList`, `DiscussionDetail`), and integration points in `App.tsx` for automatic save during discussion.

**Tech Stack:** Python 3.11+, aiosqlite, FastAPI, React 19, TypeScript 5.8

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `backend/db.py` | Add discussions/messages tables to schema, 7 new CRUD functions |
| Create | `backend/routes_discussions.py` | User + admin discussion API endpoints |
| Modify | `backend/main.py` | Mount discussions router, add tables to init_db |
| Create | `backend/test_discussions.py` | Backend tests |
| Modify | `lib/router.ts` | Add `:param` path support |
| Create | `services/discussionService.ts` | Frontend API calls for discussions |
| Create | `components/HistoryList.tsx` | User's history list page |
| Create | `components/DiscussionDetail.tsx` | View/continue a saved discussion |
| Modify | `App.tsx` | Auto-save: create discussion on start, append messages each turn, save summary |
| Modify | `index.tsx` | Register `/history` and `/discussion/:id` routes |
| Modify | `components/AdminPage.tsx` | Add "All Discussions" tab with admin discussion list |

---

### Task 1: Add Discussion Tables + CRUD to `backend/db.py`

**Files:**
- Modify: `backend/db.py`

Work from: `/Users/weiminglu/Projects/roundtable/.worktrees/auth-system`

- [ ] **Step 1: Add tables to `init_db()`**

In `init_db()`, append after the users table creation:

```python
    await db.executescript("""
        CREATE TABLE IF NOT EXISTS discussions (
            id                TEXT PRIMARY KEY,
            user_id           TEXT NOT NULL,
            topic             TEXT NOT NULL,
            participants_json TEXT NOT NULL,
            summary_json      TEXT,
            status            TEXT DEFAULT 'active',
            message_count     INTEGER DEFAULT 0,
            created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS messages (
            id                 TEXT PRIMARY KEY,
            discussion_id      TEXT NOT NULL,
            sender_id          TEXT NOT NULL,
            text               TEXT NOT NULL,
            stance             TEXT,
            stance_intensity   INTEGER,
            action_description TEXT,
            timestamp          INTEGER NOT NULL,
            FOREIGN KEY (discussion_id) REFERENCES discussions(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_discussions_user ON discussions(user_id, updated_at DESC);
        CREATE INDEX IF NOT EXISTS idx_discussions_updated ON discussions(updated_at DESC);
        CREATE INDEX IF NOT EXISTS idx_messages_discussion ON messages(discussion_id, timestamp);
    """)
```

- [ ] **Step 2: Add CRUD functions at the end of `backend/db.py`**

```python
# --- Discussion CRUD ---

import json


async def create_discussion(user_id: str, topic: str, participants_json: str) -> dict:
    db = await get_connection()
    disc_id = str(uuid.uuid4())
    await db.execute(
        """INSERT INTO discussions (id, user_id, topic, participants_json, message_count)
           VALUES (?, ?, ?, ?, 0)""",
        (disc_id, user_id, topic, participants_json)
    )
    await db.commit()
    return await get_discussion(disc_id)


async def get_discussion(discussion_id: str) -> dict | None:
    db = await get_connection()
    async with db.execute(
        "SELECT * FROM discussions WHERE id = ? AND status != 'archived'",
        (discussion_id,)
    ) as cursor:
        row = await cursor.fetchone()
        if not row:
            return None
        d = dict(row)
        d["participants"] = json.loads(d.pop("participants_json"))
        if d.get("summary_json"):
            d["summary"] = json.loads(d.pop("summary_json"))
        else:
            d.pop("summary_json", None)
            d["summary"] = None
        return d


async def list_discussions(user_id: str) -> list[dict]:
    db = await get_connection()
    async with db.execute(
        """SELECT id, user_id, topic, participants_json, summary_json, status, message_count, created_at, updated_at
           FROM discussions WHERE user_id = ? AND status != 'archived'
           ORDER BY updated_at DESC""",
        (user_id,)
    ) as cursor:
        rows = await cursor.fetchall()
        result = []
        for row in rows:
            d = dict(row)
            d["participants"] = json.loads(d.pop("participants_json"))
            d.pop("summary_json", None)
            result.append(d)
        return result


async def list_all_discussions(search: str = "") -> list[dict]:
    """Admin: list all discussions across all users with owner name/email."""
    db = await get_connection()
    if search:
        async with db.execute(
            """SELECT d.*, u.name as user_name, u.email as user_email
               FROM discussions d JOIN users u ON d.user_id = u.id
               WHERE d.topic LIKE ? OR u.name LIKE ? OR u.email LIKE ?
               ORDER BY d.updated_at DESC""",
            (f"%{search}%", f"%{search}%", f"%{search}%")
        ) as cursor:
            rows = await cursor.fetchall()
    else:
        async with db.execute(
            """SELECT d.*, u.name as user_name, u.email as user_email
               FROM discussions d JOIN users u ON d.user_id = u.id
               ORDER BY d.updated_at DESC"""
        ) as cursor:
            rows = await cursor.fetchall()
    result = []
    for row in rows:
        d = dict(row)
        d["participants"] = json.loads(d.pop("participants_json"))
        d.pop("summary_json", None)
        result.append(d)
    return result


async def get_discussion_messages(discussion_id: str) -> list[dict]:
    db = await get_connection()
    async with db.execute(
        "SELECT * FROM messages WHERE discussion_id = ? ORDER BY timestamp ASC",
        (discussion_id,)
    ) as cursor:
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]


async def insert_messages(discussion_id: str, messages: list[dict]) -> int:
    """Insert batch of messages. Returns new message_count."""
    db = await get_connection()
    for msg in messages:
        await db.execute(
            """INSERT OR IGNORE INTO messages (id, discussion_id, sender_id, text, stance, stance_intensity, action_description, timestamp)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (msg["id"], discussion_id, msg["senderId"], msg["text"],
             msg.get("stance"), msg.get("stanceIntensity"), msg.get("actionDescription"), msg["timestamp"])
        )
    count = len(messages)
    await db.execute(
        "UPDATE discussions SET message_count = message_count + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (count, discussion_id)
    )
    await db.commit()
    async with db.execute("SELECT message_count FROM discussions WHERE id = ?", (discussion_id,)) as cursor:
        row = await cursor.fetchone()
        return row["message_count"] if row else 0


async def update_discussion(discussion_id: str, **fields) -> dict | None:
    if not fields:
        return await get_discussion(discussion_id)
    db = await get_connection()
    # Serialize JSON fields
    if "summary" in fields and fields["summary"] is not None:
        fields["summary_json"] = json.dumps(fields.pop("summary"))
    elif "summary" in fields:
        fields.pop("summary")
    if "participants" in fields:
        fields["participants_json"] = json.dumps(fields.pop("participants"))

    allowed = {"topic", "participants_json", "summary_json", "status", "message_count"}
    fields = {k: v for k, v in fields.items() if k in allowed}
    if not fields:
        return await get_discussion(discussion_id)

    set_clause = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [discussion_id]
    await db.execute(
        f"UPDATE discussions SET {set_clause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        values
    )
    await db.commit()
    return await get_discussion(discussion_id)


async def archive_discussion(discussion_id: str) -> bool:
    result = await update_discussion(discussion_id, status="archived")
    return result is not None
```

- [ ] **Step 3: Verify**

```bash
cd ~/Projects/roundtable/.worktrees/auth-system/backend && source venv/bin/activate && python -c "
import asyncio
from db import init_db, close_db
asyncio.run(init_db())
asyncio.run(close_db())
print('DB with discussions OK')
"
```

Expected: `DB with discussions OK`

- [ ] **Step 4: Commit**

```bash
cd ~/Projects/roundtable/.worktrees/auth-system && git add backend/db.py && git commit -m "feat: add discussions and messages tables with CRUD"
```

---

### Task 2: Discussion Routes (`backend/routes_discussions.py`)

**Files:**
- Create: `backend/routes_discussions.py`

- [ ] **Step 1: Write `backend/routes_discussions.py`**

```python
import json
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field
from typing import List, Optional

from backend.db import (
    create_discussion, get_discussion, list_discussions, list_all_discussions,
    get_discussion_messages, insert_messages, update_discussion, archive_discussion
)
from backend.routes_auth import get_current_user, require_admin

router = APIRouter(prefix="/api/discussions", tags=["discussions"])


class CreateDiscussionRequest(BaseModel):
    topic: str = Field(min_length=1, max_length=500)
    participants: list[dict]


class AppendMessagesRequest(BaseModel):
    messages: list[dict]  # list of Message objects


class UpdateDiscussionRequest(BaseModel):
    summary: Optional[dict] = None
    status: Optional[str] = None


# --- User Endpoints (own discussions only) ---

@router.post("")
async def create_discussion_endpoint(req: CreateDiscussionRequest, user: dict = Depends(get_current_user)):
    disc = await create_discussion(
        user_id=user["id"],
        topic=req.topic,
        participants_json=json.dumps(req.participants)
    )
    return disc


@router.get("")
async def list_discussions_endpoint(user: dict = Depends(get_current_user)):
    discussions = await list_discussions(user["id"])
    return {"discussions": discussions}


@router.get("/{discussion_id}")
async def get_discussion_endpoint(discussion_id: str, user: dict = Depends(get_current_user)):
    disc = await get_discussion(discussion_id)
    if not disc or disc["user_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Discussion not found")
    messages = await get_discussion_messages(discussion_id)
    # Map DB column names to camelCase
    disc["messages"] = [{
        "id": m["id"],
        "senderId": m["sender_id"],
        "text": m["text"],
        "stance": m.get("stance"),
        "stanceIntensity": m.get("stance_intensity"),
        "actionDescription": m.get("action_description"),
        "timestamp": m["timestamp"],
    } for m in messages]
    return disc


@router.post("/{discussion_id}/messages")
async def append_messages_endpoint(discussion_id: str, req: AppendMessagesRequest, user: dict = Depends(get_current_user)):
    disc = await get_discussion(discussion_id)
    if not disc or disc["user_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Discussion not found")
    if len(req.messages) > 50:
        raise HTTPException(status_code=400, detail="Maximum 50 messages per request")
    count = await insert_messages(discussion_id, req.messages)
    return {"message_count": count}


@router.put("/{discussion_id}")
async def update_discussion_endpoint(discussion_id: str, req: UpdateDiscussionRequest, user: dict = Depends(get_current_user)):
    disc = await get_discussion(discussion_id)
    if not disc or disc["user_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Discussion not found")
    updates = {}
    if req.summary is not None:
        updates["summary"] = req.summary
    if req.status is not None:
        if req.status not in ("active", "archived"):
            raise HTTPException(status_code=400, detail="Status must be 'active' or 'archived'")
        updates["status"] = req.status
    result = await update_discussion(discussion_id, **updates)
    return result


@router.delete("/{discussion_id}")
async def delete_discussion_endpoint(discussion_id: str, user: dict = Depends(get_current_user)):
    disc = await get_discussion(discussion_id)
    if not disc or disc["user_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Discussion not found")
    await archive_discussion(discussion_id)
    return {"detail": "Discussion archived"}


# --- Admin Endpoints (all discussions) ---

admin_router = APIRouter(prefix="/api/admin/discussions", tags=["admin-discussions"])


@admin_router.get("")
async def admin_list_discussions(search: str = "", admin: dict = Depends(require_admin)):
    discussions = await list_all_discussions(search)
    return {"discussions": discussions}


@admin_router.get("/{discussion_id}")
async def admin_get_discussion(discussion_id: str, admin: dict = Depends(require_admin)):
    from backend.db import get_connection
    db = await get_connection()
    async with db.execute(
        """SELECT d.*, u.name as user_name, u.email as user_email
           FROM discussions d JOIN users u ON d.user_id = u.id
           WHERE d.id = ?""",
        (discussion_id,)
    ) as cursor:
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Discussion not found")
        disc = dict(row)
        disc["participants"] = json.loads(disc.pop("participants_json"))
        if disc.get("summary_json"):
            disc["summary"] = json.loads(disc.pop("summary_json"))
        else:
            disc.pop("summary_json", None)
            disc["summary"] = None

    messages = await get_discussion_messages(discussion_id)
    disc["messages"] = [{
        "id": m["id"],
        "senderId": m["sender_id"],
        "text": m["text"],
        "stance": m.get("stance"),
        "stanceIntensity": m.get("stance_intensity"),
        "actionDescription": m.get("action_description"),
        "timestamp": m["timestamp"],
    } for m in messages]
    return disc


@admin_router.post("/{discussion_id}/messages")
async def admin_append_messages(discussion_id: str, req: AppendMessagesRequest, admin: dict = Depends(require_admin)):
    from backend.db import get_connection
    db = await get_connection()
    async with db.execute("SELECT * FROM discussions WHERE id = ?", (discussion_id,)) as cursor:
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Discussion not found")
    if len(req.messages) > 50:
        raise HTTPException(status_code=400, detail="Maximum 50 messages per request")
    count = await insert_messages(discussion_id, req.messages)
    return {"message_count": count}


@admin_router.put("/{discussion_id}")
async def admin_update_discussion(discussion_id: str, req: UpdateDiscussionRequest, admin: dict = Depends(require_admin)):
    updates = {}
    if req.summary is not None:
        updates["summary"] = req.summary
    if req.status is not None:
        updates["status"] = req.status
    result = await update_discussion(discussion_id, **updates)
    if not result:
        raise HTTPException(status_code=404, detail="Discussion not found")
    return result


@admin_router.delete("/{discussion_id}")
async def admin_delete_discussion(discussion_id: str, admin: dict = Depends(require_admin)):
    success = await archive_discussion(discussion_id)
    if not success:
        raise HTTPException(status_code=404, detail="Discussion not found")
    return {"detail": "Discussion archived"}
```

- [ ] **Step 2: Commit**

```bash
cd ~/Projects/roundtable/.worktrees/auth-system && git add backend/routes_discussions.py && git commit -m "feat: add discussion API routes with user and admin endpoints"
```

---

### Task 3: Mount Discussions Router in `backend/main.py`

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Add import and mount router**

Add after the existing auth router import:
```python
from backend.routes_discussions import router as discussions_router, admin_router as discussions_admin_router
```

Add after `app.include_router(auth_router)`:
```python
app.include_router(discussions_router)
app.include_router(discussions_admin_router)
```

- [ ] **Step 2: Verify syntax**

```bash
cd ~/Projects/roundtable/.worktrees/auth-system/backend && source venv/bin/activate && python -c "import ast; ast.parse(open('main.py').read()); print('Syntax OK')"
```

Expected: `Syntax OK`

- [ ] **Step 3: Commit**

```bash
cd ~/Projects/roundtable/.worktrees/auth-system && git add backend/main.py && git commit -m "feat: mount discussions router in main.py"
```

---

### Task 4: Backend Tests

**Files:**
- Create: `backend/test_discussions.py`

- [ ] **Step 1: Write `backend/test_discussions.py`**

```python
import pytest
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from fastapi.testclient import TestClient

TEST_DB_PATH = ":memory:"


@pytest.fixture
def client():
    from backend import db as db_module
    from backend import auth_utils as auth_utils_module
    original_path = db_module.DB_PATH
    original_jwt = auth_utils_module.JWT_SECRET
    db_module.DB_PATH = TEST_DB_PATH
    db_module._connection = None
    auth_utils_module.JWT_SECRET = "test-secret-key-for-testing-32chars+"

    from backend.main import app
    with TestClient(app) as c:
        yield c

    db_module.DB_PATH = original_path
    db_module._connection = None
    auth_utils_module.JWT_SECRET = original_jwt


def _register_and_get_token(client, email="disc_test@example.com", name="Disc User"):
    resp = client.post("/api/auth/register", json={
        "email": email, "password": "test1234", "name": name
    })
    return resp.json()["token"]


class TestDiscussionEndpoints:

    def test_create_discussion(self, client):
        token = _register_and_get_token(client)
        resp = client.post("/api/discussions", json={
            "topic": "Test Topic",
            "participants": [{"id": "expert_0", "name": "Alice", "title": "Scientist", "stance": "Pro", "color": "#FF0000", "roleType": "expert"}]
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["topic"] == "Test Topic"
        assert data["message_count"] == 0
        assert "id" in data

    def test_list_discussions(self, client):
        token = _register_and_get_token(client)
        client.post("/api/discussions", json={
            "topic": "Topic A", "participants": []
        }, headers={"Authorization": f"Bearer {token}"})
        client.post("/api/discussions", json={
            "topic": "Topic B", "participants": []
        }, headers={"Authorization": f"Bearer {token}"})
        resp = client.get("/api/discussions", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert len(resp.json()["discussions"]) == 2

    def test_get_discussion_with_messages(self, client):
        token = _register_and_get_token(client)
        disc = client.post("/api/discussions", json={
            "topic": "Topic", "participants": []
        }, headers={"Authorization": f"Bearer {token}"}).json()

        client.post(f"/api/discussions/{disc['id']}/messages", json={
            "messages": [{"id": "1", "senderId": "user", "text": "Hello", "timestamp": 1000}]
        }, headers={"Authorization": f"Bearer {token}"})

        resp = client.get(f"/api/discussions/{disc['id']}", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["messages"]) == 1
        assert data["messages"][0]["text"] == "Hello"

    def test_append_messages(self, client):
        token = _register_and_get_token(client)
        disc = client.post("/api/discussions", json={
            "topic": "Topic", "participants": []
        }, headers={"Authorization": f"Bearer {token}"}).json()

        resp = client.post(f"/api/discussions/{disc['id']}/messages", json={
            "messages": [
                {"id": "1", "senderId": "expert_0", "text": "Point A", "stance": "AGREE", "stanceIntensity": 4, "actionDescription": "nods", "timestamp": 1000},
                {"id": "2", "senderId": "expert_1", "text": "Point B", "timestamp": 2000}
            ]
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["message_count"] == 2

    def test_update_discussion_summary(self, client):
        token = _register_and_get_token(client)
        disc = client.post("/api/discussions", json={
            "topic": "Topic", "participants": []
        }, headers={"Authorization": f"Bearer {token}"}).json()

        resp = client.put(f"/api/discussions/{disc['id']}", json={
            "summary": {"topic": "Topic", "summary": "Great discussion", "conclusion": "Agreed"}
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["summary"]["conclusion"] == "Agreed"

    def test_archive_discussion(self, client):
        token = _register_and_get_token(client)
        disc = client.post("/api/discussions", json={
            "topic": "Topic", "participants": []
        }, headers={"Authorization": f"Bearer {token}"}).json()

        resp = client.delete(f"/api/discussions/{disc['id']}", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200

        # Archived discussion should not appear in list
        list_resp = client.get("/api/discussions", headers={"Authorization": f"Bearer {token}"})
        assert len(list_resp.json()["discussions"]) == 0

    def test_cannot_access_other_users_discussion(self, client):
        token_a = _register_and_get_token(client, "a@test.com", "User A")
        token_b = _register_and_get_token(client, "b@test.com", "User B")

        disc = client.post("/api/discussions", json={
            "topic": "A's Topic", "participants": []
        }, headers={"Authorization": f"Bearer {token_a}"}).json()

        resp = client.get(f"/api/discussions/{disc['id']}", headers={"Authorization": f"Bearer {token_b}"})
        assert resp.status_code == 404


class TestAdminDiscussionEndpoints:

    def _setup(self, client):
        """Create admin + regular user with a discussion. Returns (admin_token, user_disc_id)."""
        admin_token = _register_and_get_token(client, "admin@test.com", "Admin")
        # Admin is first user, should be auto-admin
        user_token = _register_and_get_token(client, "user@test.com", "User")
        disc = client.post("/api/discussions", json={
            "topic": "User's Topic", "participants": [{"id": "expert_0", "name": "Bob", "title": "Prof", "stance": "Yes", "color": "#000", "roleType": "expert"}]
        }, headers={"Authorization": f"Bearer {user_token}"}).json()
        return admin_token, disc["id"]

    def test_admin_list_all_discussions(self, client):
        admin_token, disc_id = self._setup(client)
        resp = client.get("/api/admin/discussions", headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["discussions"]) >= 1
        assert data["discussions"][0]["user_name"] == "User"

    def test_admin_get_any_discussion(self, client):
        admin_token, disc_id = self._setup(client)
        resp = client.get(f"/api/admin/discussions/{disc_id}", headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.status_code == 200
        assert resp.json()["user_name"] == "User"

    def test_admin_append_messages(self, client):
        admin_token, disc_id = self._setup(client)
        resp = client.post(f"/api/admin/discussions/{disc_id}/messages", json={
            "messages": [{"id": "99", "senderId": "user", "text": "Admin speaking as host", "timestamp": 5000}]
        }, headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.status_code == 200
        assert resp.json()["message_count"] == 1

    def test_non_admin_cannot_use_admin_endpoints(self, client):
        admin_token, disc_id = self._setup(client)
        # Get a regular user token (not admin)
        resp = client.post("/api/auth/register", json={
            "email": "regular@test.com", "password": "test1234", "name": "Regular"
        })
        regular_token = resp.json()["token"]

        resp = client.get("/api/admin/discussions", headers={"Authorization": f"Bearer {regular_token}"})
        assert resp.status_code == 403
```

- [ ] **Step 2: Run tests**

```bash
cd ~/Projects/roundtable/.worktrees/auth-system/backend && source venv/bin/activate && python -m pytest test_discussions.py -v
```

Expected: 10 tests pass.

- [ ] **Step 3: Commit**

```bash
cd ~/Projects/roundtable/.worktrees/auth-system && git add backend/test_discussions.py && git commit -m "test: add discussion history API tests"
```

---

### Task 5: Enhance Router with Param Support

**Files:**
- Modify: `lib/router.ts`

- [ ] **Step 1: Read current router, then replace with enhanced version**

Read `/Users/weiminglu/Projects/roundtable/.worktrees/auth-system/lib/router.ts`, then replace with:

```typescript
import React from 'react';

type RouteHandler = (params: Record<string, string>) => React.ReactNode;
type RouteEntry = { pattern: string; regex: RegExp; paramNames: string[]; handler: RouteHandler };

const routes: RouteEntry[] = [];
let currentPath: string = window.location.hash.slice(1) || '/';
const listeners: Set<() => void> = new Set();

export function addRoute(pattern: string, handler: RouteHandler) {
  const paramNames: string[] = [];
  const regexStr = pattern.replace(/:([a-zA-Z0-9_]+)/g, (_, name) => {
    paramNames.push(name);
    return '([^/]+)';
  });
  routes.push({
    pattern,
    regex: new RegExp(`^${regexStr}$`),
    paramNames,
    handler
  });
}

export function navigate(path: string) {
  window.location.hash = path;
}

export function getCurrentPath(): string {
  return currentPath;
}

function matchRoute(path: string): { handler: RouteHandler; params: Record<string, string> } | null {
  for (const entry of routes) {
    const match = path.match(entry.regex);
    if (match) {
      const params: Record<string, string> = {};
      entry.paramNames.forEach((name, i) => {
        params[name] = match[i + 1];
      });
      return { handler: entry.handler, params };
    }
  }
  return null;
}

window.addEventListener('hashchange', () => {
  currentPath = window.location.hash.slice(1) || '/';
  listeners.forEach(fn => fn());
});

export function Router() {
  const [path, setPath] = React.useState(currentPath);

  React.useEffect(() => {
    const unsub = subscribe(() => setPath(currentPath));
    return unsub;
  }, []);

  const match = matchRoute(path);
  if (match) {
    return React.createElement(React.Fragment, null, match.handler(match.params));
  }

  if (routes.length > 0 && routes.some(r => r.pattern === '/login')) {
    navigate('/login');
    return null;
  }
  return null;
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd ~/Projects/roundtable/.worktrees/auth-system && npx tsc --noEmit 2>&1 | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd ~/Projects/roundtable/.worktrees/auth-system && git add lib/router.ts && git commit -m "feat: add path parameter support to router"
```

---

### Task 6: Discussion Service (`services/discussionService.ts`)

**Files:**
- Create: `services/discussionService.ts`

- [ ] **Step 1: Write `services/discussionService.ts`**

```typescript
import { Participant, Message, Summary } from '../types';

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:3001';

function getToken(): string | null {
  return localStorage.getItem('roundtable_token');
}

async function apiCall<T>(method: string, path: string, body?: any): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export interface DiscussionSummary {
  id: string;
  user_id?: string;
  topic: string;
  participants: Participant[];
  message_count: number;
  status: string;
  created_at: string;
  updated_at: string;
  user_name?: string;
  user_email?: string;
}

export interface DiscussionDetail extends DiscussionSummary {
  messages: Message[];
  summary: Summary | null;
}

export async function createDiscussion(topic: string, participants: Participant[]): Promise<DiscussionSummary> {
  return apiCall('POST', '/api/discussions', { topic, participants });
}

export async function listDiscussions(): Promise<DiscussionSummary[]> {
  const data = await apiCall<{ discussions: DiscussionSummary[] }>('GET', '/api/discussions');
  return data.discussions;
}

export async function getDiscussion(id: string): Promise<DiscussionDetail> {
  return apiCall('GET', `/api/discussions/${id}`);
}

export async function appendMessages(discussionId: string, messages: Message[]): Promise<{ message_count: number }> {
  return apiCall('POST', `/api/discussions/${discussionId}/messages`, { messages });
}

export async function updateDiscussion(discussionId: string, data: { summary?: Summary; status?: string }): Promise<DiscussionSummary> {
  return apiCall('PUT', `/api/discussions/${discussionId}`, data);
}

export async function archiveDiscussion(discussionId: string): Promise<void> {
  return apiCall('DELETE', `/api/discussions/${discussionId}`);
}

// Admin endpoints
export async function adminListDiscussions(search: string = ''): Promise<DiscussionSummary[]> {
  const params = search ? `?search=${encodeURIComponent(search)}` : '';
  const data = await apiCall<{ discussions: DiscussionSummary[] }>('GET', `/api/admin/discussions${params}`);
  return data.discussions;
}

export async function adminGetDiscussion(id: string): Promise<DiscussionDetail & { user_name: string; user_email: string }> {
  return apiCall('GET', `/api/admin/discussions/${id}`);
}

export async function adminAppendMessages(discussionId: string, messages: Message[]): Promise<{ message_count: number }> {
  return apiCall('POST', `/api/admin/discussions/${discussionId}/messages`, { messages });
}

export async function adminUpdateDiscussion(discussionId: string, data: { summary?: Summary; status?: string }): Promise<DiscussionSummary> {
  return apiCall('PUT', `/api/admin/discussions/${discussionId}`, data);
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd ~/Projects/roundtable/.worktrees/auth-system && npx tsc --noEmit 2>&1 | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd ~/Projects/roundtable/.worktrees/auth-system && git add services/discussionService.ts && git commit -m "feat: add discussion API service layer"
```

---

### Task 7: HistoryList Page

**Files:**
- Create: `components/HistoryList.tsx`

- [ ] **Step 1: Write `components/HistoryList.tsx`**

```typescript
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { navigate } from '../lib/router';
import { listDiscussions, DiscussionSummary } from '../services/discussionService';
import { ArrowLeft, MessageCircle, Clock, Loader2 } from 'lucide-react';

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function HistoryList() {
  const { user, loading: authLoading } = useAuth();
  const [discussions, setDiscussions] = useState<DiscussionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) { navigate('/login'); return; }
    if (!user) return;
    listDiscussions()
      .then(setDiscussions)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [user, authLoading]);

  const participantNames = (d: DiscussionSummary) =>
    (d.participants || []).map(p => p.name).join(', ') || 'No participants';

  return (
    <div className="min-h-screen bg-md-surface p-6 animate-fade-in">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate('/')} className="p-2 rounded-full hover:bg-white/10 text-md-primary">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-2xl font-bold text-md-primary">Past Discussions</h1>
        </div>

        {loading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="animate-spin text-md-accent" size={32} />
          </div>
        ) : error ? (
          <div className="text-center p-12 text-red-400">{error}</div>
        ) : discussions.length === 0 ? (
          <div className="text-center p-12">
            <p className="text-md-secondary text-lg mb-4">No discussions yet.</p>
            <button onClick={() => navigate('/')}
              className="px-6 py-3 bg-md-accent text-black rounded-full font-medium text-sm hover:opacity-90">
              Start your first roundtable
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {discussions.map(d => (
              <button
                key={d.id}
                onClick={() => navigate(`/discussion/${d.id}`)}
                className="w-full text-left bg-md-surface-container rounded-2xl p-5 border border-white/5 hover:border-white/10 hover:bg-white/[0.02] transition-all shadow-sm"
              >
                <h3 className="font-bold text-md-primary text-lg mb-1">{d.topic}</h3>
                <p className="text-sm text-md-secondary mb-3 truncate">{participantNames(d)}</p>
                <div className="flex items-center gap-4 text-xs text-md-outline">
                  <span className="flex items-center gap-1"><MessageCircle size={12} /> {d.message_count} msgs</span>
                  <span className="flex items-center gap-1"><Clock size={12} /> {relativeTime(d.updated_at)}</span>
                  {d.status === 'active' && (
                    <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-[10px] font-bold uppercase">Active</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd ~/Projects/roundtable/.worktrees/auth-system && npx tsc --noEmit 2>&1 | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd ~/Projects/roundtable/.worktrees/auth-system && git add components/HistoryList.tsx && git commit -m "feat: add HistoryList page for past discussions"
```

---

### Task 8: DiscussionDetail Page

**Files:**
- Create: `components/DiscussionDetail.tsx`

This is the largest new component. It loads a discussion and lets users view or continue it. It runs its own discussion loop (similar to App.tsx but simpler).

- [ ] **Step 1: Write `components/DiscussionDetail.tsx`**

The full code is ~350 lines. Key functions:
- Load discussion from API by `id` param
- Render all messages via `ChatBubble`
- If continuing: run AI turn loop using `predictNextSpeaker` + `generateTurnForSpeaker`
- Save new messages to discussion via `appendMessages`
- Show summary if present

```typescript
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { navigate } from '../lib/router';
import { getDiscussion, appendMessages as saveMessages, updateDiscussion, DiscussionDetail as DiscDetail } from '../services/discussionService';
import { adminGetDiscussion, adminAppendMessages } from '../services/discussionService';
import { predictNextSpeaker, generateTurnForSpeaker } from '../services/geminiService';
import { ChatBubble } from './ChatBubble';
import { InputArea } from './InputArea';
import { SummaryModal } from './SummaryModal';
import { Participant, Message, Summary } from '../types';
import { ArrowLeft, Loader2, Play } from 'lucide-react';

interface Props {
  id: string;
  adminMode?: boolean;
}

export function DiscussionDetail({ id, adminMode = false }: Props) {
  const { user, loading: authLoading } = useAuth();
  const [discussion, setDiscussion] = useState<DiscDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [thinkingSpeakerId, setThinkingSpeakerId] = useState<string | null>(null);
  const [isWaitingForUser, setIsWaitingForUser] = useState(false);
  const [isContinuing, setIsContinuing] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [autoDebateCount, setAutoDebateCount] = useState(0);
  const [currentRoundLimit, setCurrentRoundLimit] = useState(3);
  const turnInProgressRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load discussion
  useEffect(() => {
    if (!user) return;
    const fetcher = adminMode ? adminGetDiscussion : getDiscussion;
    fetcher(id)
      .then(d => {
        setDiscussion(d);
        setMessages(d.messages || []);
        setParticipants(d.participants || []);
        setSummary(d.summary);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, user, adminMode]);

  // If continuing, run AI turn loop
  useEffect(() => {
    if (!isContinuing || isTyping || thinkingSpeakerId || turnInProgressRef.current) return;
    if (!participants.length || !discussion) return;

    const runTurn = async () => {
      if (!discussion) return;
      turnInProgressRef.current = true;
      setIsTyping(true);
      try {
        const nextSpeakerId = await predictNextSpeaker(
          discussion.topic, participants, messages, autoDebateCount,
          abortControllerRef.current?.signal
        );
        setThinkingSpeakerId(nextSpeakerId);

        const result = await generateTurnForSpeaker(
          nextSpeakerId, discussion.topic, participants, messages,
          autoDebateCount, currentRoundLimit, false, undefined,
          abortControllerRef.current?.signal
        );

        const newMessage: Message = {
          id: Date.now().toString(),
          senderId: nextSpeakerId,
          text: result.text,
          stance: result.stance,
          stanceIntensity: result.stanceIntensity,
          actionDescription: result.actionDescription,
          timestamp: Date.now()
        };

        setMessages(prev => [...prev, newMessage]);

        // Save to backend
        const saver = adminMode ? adminAppendMessages : saveMessages;
        saver(id, [newMessage]).catch(console.error);

        if (result.shouldWaitForUser) {
          setIsWaitingForUser(true);
          setAutoDebateCount(0);
        } else {
          setAutoDebateCount(prev => prev + 1);
        }
      } catch (e) {
        console.error('Discussion turn error:', e);
        setIsWaitingForUser(true);
      } finally {
        setThinkingSpeakerId(null);
        setIsTyping(false);
        turnInProgressRef.current = false;
      }
    };

    runTurn();
  }, [isContinuing, isTyping, thinkingSpeakerId, autoDebateCount, messages.length]);

  const handleUserMessage = (text: string) => {
    const userMsg: Message = {
      id: Date.now().toString(),
      senderId: 'user',
      text,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsWaitingForUser(false);
    setAutoDebateCount(0);
    setCurrentRoundLimit(Math.floor(Math.random() * 5) + 1);
  };

  const handleStartContinue = () => {
    setIsContinuing(true);
    setIsWaitingForUser(true);
    abortControllerRef.current = new AbortController();
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-md-surface flex items-center justify-center">
        <Loader2 className="animate-spin text-md-accent" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-md-surface flex flex-col items-center justify-center p-6">
        <p className="text-red-400 mb-4">{error}</p>
        <button onClick={() => navigate('/history')} className="text-md-accent hover:underline">Back to History</button>
      </div>
    );
  }

  if (!discussion) return null;

  return (
    <div className="relative min-h-screen bg-md-surface">
      <header className="fixed top-0 left-0 right-0 h-16 bg-md-surface/80 backdrop-blur-md px-4 py-3 flex items-center justify-between shadow-sm z-50 border-b border-white/5">
        <button onClick={() => adminMode ? navigate('/admin') : navigate('/history')} className="p-2 rounded-full hover:bg-white/10 text-md-primary">
          <ArrowLeft size={24} />
        </button>
        <div className="text-center">
          <span className="text-sm font-bold text-md-primary truncate max-w-[200px] block">{discussion.topic}</span>
        </div>
        <div className="w-10" />
      </header>

      <div className="px-4 md:px-8 pt-24 pb-48 bg-md-surface">
        <div className="max-w-4xl mx-auto">
          {messages.map(msg => (
            <ChatBubble
              key={msg.id}
              message={msg}
              sender={participants.find(p => p.id === msg.senderId)}
              participants={participants}
              hostName={adminMode ? discussion.user_name : user?.name}
            />
          ))}

          {isTyping && thinkingSpeakerId && (
            <div className="flex items-center gap-3 bg-md-surface-container px-4 py-2 rounded-full shadow-sm animate-pulse border border-white/10 mt-4">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: participants.find(p => p.id === thinkingSpeakerId)?.color || '#fff' }}></div>
              <span className="text-xs font-bold text-md-secondary">
                {participants.find(p => p.id === thinkingSpeakerId)?.name || 'Guest'} is typing...
              </span>
            </div>
          )}

          {!isContinuing && summary && (
            <div className="mt-8 bg-md-surface-container rounded-2xl p-6 border border-white/5">
              <h3 className="font-bold text-lg text-md-primary mb-4">Summary</h3>
              <p className="text-md-secondary text-sm leading-relaxed mb-4">{summary.summary}</p>
              {summary.conclusion && (
                <p className="text-md-primary text-sm italic">{summary.conclusion}</p>
              )}
              <button onClick={handleStartContinue}
                className="mt-6 flex items-center gap-2 px-6 py-3 bg-md-accent text-black rounded-full font-medium text-sm hover:opacity-90">
                <Play size={16} fill="currentColor" /> Continue Discussion
              </button>
            </div>
          )}

          {!isContinuing && !summary && (
            <div className="mt-8 text-center">
              <button onClick={handleStartContinue}
                className="flex items-center gap-2 mx-auto px-6 py-3 bg-md-accent text-black rounded-full font-medium hover:opacity-90">
                <Play size={16} fill="currentColor" /> Continue Discussion
              </button>
            </div>
          )}
        </div>
      </div>

      {isContinuing && (
        <InputArea
          onSendMessage={handleUserMessage}
          onSummarize={async () => {}}
          isDiscussing={true}
          isWaitingForUser={isWaitingForUser}
          participants={participants}
          disabled={!isWaitingForUser}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd ~/Projects/roundtable/.worktrees/auth-system && npx tsc --noEmit 2>&1 | head -20
```

Fix any type errors. Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd ~/Projects/roundtable/.worktrees/auth-system && git add components/DiscussionDetail.tsx && git commit -m "feat: add DiscussionDetail page with view and continue support"
```

---

### Task 9: Register Routes + Modify App.tsx Save Lifecycle

**Files:**
- Modify: `index.tsx`
- Modify: `App.tsx`

- [ ] **Step 1: Add routes to `index.tsx`**

Add imports:
```typescript
import { HistoryList } from './components/HistoryList';
import { DiscussionDetail } from './components/DiscussionDetail';
```

Add routes (after existing addRoute calls):
```typescript
addRoute('/history', () => React.createElement(HistoryList));
addRoute('/discussion/:id', (params: Record<string, string>) => React.createElement(DiscussionDetail, { id: params.id }));
```

- [ ] **Step 2: Modify `App.tsx` — add discussion save lifecycle**

Three changes:

**2a. Add `discussionId` state:**
```typescript
const [discussionId, setDiscussionId] = useState<string | null>(null);
```

**2b. Create discussion on start — modify `handleConfirmPanel`:**
```typescript
const handleConfirmPanel = async () => {
  setAppState(AppState.OPENING_STATEMENTS);
  setOpeningSpeakerIndex(0);
  setMessages([]);
  const shuffled = [...participants.map(p => p.id)].sort(() => Math.random() - 0.5);
  setOpeningSpeakerOrder(shuffled);

  // Create discussion in backend
  if (user) {
    try {
      const disc = await createDiscussion(topic, participants);
      setDiscussionId(disc.id);
    } catch (e) {
      console.error('Failed to create discussion record:', e);
    }
  }
};
```

Import `createDiscussion` from discussionService:
```typescript
import { createDiscussion, appendMessages } from './services/discussionService';
```

**2c. Save messages after each turn — modify the discussion effect:**

In the `.then(({ nextSpeakerId, result })` block, after `setMessages(prev => [...prev, newMessage])`, add:
```typescript
// Save to backend
if (discussionId) {
  appendMessages(discussionId, [newMessage]).catch(e => console.error('Save message error:', e));
}
```

**2d. Save summary — modify `handleSummarize`:**

After `setSummary(s)`, add:
```typescript
if (discussionId) {
  updateDiscussion(discussionId, { summary: s }).catch(e => console.error('Save summary error:', e));
}
```

Import `updateDiscussion`:
```typescript
import { createDiscussion, appendMessages, updateDiscussion } from './services/discussionService';
```

- [ ] **Step 3: Add History button to Landing page JSX**

After the "Summon Guests" button in the Landing view, add:
```tsx
<button
  onClick={() => navigate('/history')}
  className="w-full text-md-secondary text-sm font-medium py-3 rounded-full hover:bg-white/5 transition-colors flex items-center justify-center gap-2 mt-3"
>
  View Past Discussions →
</button>
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd ~/Projects/roundtable/.worktrees/auth-system && npx tsc --noEmit 2>&1 | head -30
```

Fix any errors. Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd ~/Projects/roundtable/.worktrees/auth-system && git add index.tsx App.tsx && git commit -m "feat: integrate discussion save lifecycle and routes"
```

---

### Task 10: AdminPage — All Discussions Tab

**Files:**
- Modify: `components/AdminPage.tsx`

- [ ] **Step 1: Add tab state and admin discussions list**

Add a `tab` state at the top of AdminPage:
```typescript
const [tab, setTab] = useState<'users' | 'discussions'>('users');
```

Add discussions state:
```typescript
const [allDiscussions, setAllDiscussions] = useState<any[]>([]);
const [discLoading, setDiscLoading] = useState(false);
```

Add fetch function and useEffect:
```typescript
const fetchAllDiscussions = useCallback(async () => {
  if (!token) return;
  setDiscLoading(true);
  try {
    const data = await adminListDiscussions();
    setAllDiscussions(data);
  } catch (e) { console.error(e); }
  finally { setDiscLoading(false); }
}, [token]);

useEffect(() => {
  if (tab === 'discussions') fetchAllDiscussions();
}, [tab, fetchAllDiscussions]);
```

Import `adminListDiscussions` from discussionService.

- [ ] **Step 2: Add tab UI at top of return JSX**

Replace the current single-purpose header with tabs:
```tsx
<div className="flex items-center gap-2 mb-8">
  <button onClick={() => setTab('users')}
    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${tab === 'users' ? 'bg-md-accent text-black' : 'text-md-secondary hover:bg-white/5'}`}>
    Users
  </button>
  <button onClick={() => setTab('discussions')}
    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${tab === 'discussions' ? 'bg-md-accent text-black' : 'text-md-secondary hover:bg-white/5'}`}>
    All Discussions
  </button>
</div>
```

Wrap the existing users content in `{tab === 'users' && (...)}`.

- [ ] **Step 3: Add discussions list UI**

```tsx
{tab === 'discussions' && (
  <>
    {discLoading ? (
      <div className="flex justify-center p-12"><Loader2 className="animate-spin text-md-accent" size={32} /></div>
    ) : allDiscussions.length === 0 ? (
      <div className="text-center p-12 text-md-secondary">No discussions yet.</div>
    ) : (
      <div className="space-y-3">
        {allDiscussions.map((d: any) => (
          <div key={d.id} className="bg-md-surface-container rounded-2xl p-5 border border-white/5 hover:border-white/10 transition-all">
            <div className="flex items-start justify-between mb-2">
              <div>
                <span className="text-xs text-md-accent font-medium">{d.user_name || 'Unknown'}</span>
                <span className="text-xs text-md-outline ml-2">{d.user_email || ''}</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${d.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                {d.status}
              </span>
            </div>
            <h3 className="font-bold text-md-primary mb-1">{d.topic}</h3>
            <p className="text-sm text-md-secondary mb-3">
              {(d.participants || []).map((p: any) => p.name).join(', ')}
            </p>
            <div className="flex items-center gap-4 text-xs text-md-outline">
              <span>{d.message_count} messages</span>
              <span>{new Date(d.updated_at).toLocaleDateString()}</span>
            </div>
            <button onClick={() => navigate(`/discussion/${d.id}`)}
              className="mt-3 text-xs text-md-accent hover:underline font-medium">
              View Discussion →
            </button>
          </div>
        ))}
      </div>
    )}
  </>
)}
```

Make sure `navigate` and `Loader2` are already imported.

- [ ] **Step 4: Verify TypeScript**

```bash
cd ~/Projects/roundtable/.worktrees/auth-system && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd ~/Projects/roundtable/.worktrees/auth-system && git add components/AdminPage.tsx && git commit -m "feat: add All Discussions tab to admin panel"
```

---

### Task 11: End-to-End Verification

- [ ] **Step 1: Run all backend tests**

```bash
cd ~/Projects/roundtable/.worktrees/auth-system/backend && source venv/bin/activate && python -m pytest test_auth.py test_discussions.py -v
```

Expected: all 23 tests pass (13 auth + 10 discussions).

- [ ] **Step 2: Full TypeScript check**

```bash
cd ~/Projects/roundtable/.worktrees/auth-system && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Start services and manually test**

```bash
# Terminal 1: backend
cd ~/Projects/roundtable/.worktrees/auth-system && PYTHONPATH=. backend/venv/bin/python -m uvicorn backend.main:app --reload --port 3001 --host 0.0.0.0

# Terminal 2: frontend
cd ~/Projects/roundtable/.worktrees/auth-system && npm run dev
```

Manual checklist:
1. Register → onboarding → start new discussion
2. AI speaks a few turns → interact → summarize
3. Go back to Landing → click "View Past Discussions" → should see the discussion
4. Click discussion → view messages + summary
5. Click "Continue Discussion" → AI continues → new messages save
6. Go to /admin → "All Discussions" tab → see discussion
7. Click into discussion as admin → view all messages

- [ ] **Step 4: Commit any fixups, final commit**

---

## Plan Self-Review

1. **Spec coverage**: Each spec requirement mapped to tasks: DB tables (T1), CRUD (T1), user endpoints (T2), admin endpoints (T2), router mount (T3), tests (T4), router params (T5), service layer (T6), HistoryList (T7), DiscussionDetail (T8), App.tsx save (T9), Landing button (T9), Admin discussions tab (T10), routes (T9), verification (T11).

2. **No placeholders**: All code shown inline, all commands with expected output.

3. **Type consistency**: `DiscussionSummary` and `DiscussionDetail` types in T6 match what T7/T8 use. DB functions in T1 match route usage in T2. Router param types match T8 usage.
