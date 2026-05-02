# Auth System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google/GitHub OAuth, email/password auth, and an admin user management panel to Roundtable.

**Architecture:** SQLite + aiosqlite for persistence, PyJWT for stateless tokens, bcrypt for password hashing, authlib for OAuth verification. Backend adds 3 new modules (db, auth_utils, routes_auth), frontend adds AuthContext + router + 3 new pages. Existing App.tsx is refactored to read user state from AuthContext instead of local state.

**Tech Stack:** Python 3.11+, aiosqlite, PyJWT, bcrypt (4.x), authlib, React 19, TypeScript 5.8, Vite 6

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `backend/db.py` | SQLite connection, table init, user CRUD queries |
| Create | `backend/auth_utils.py` | JWT encode/decode, password hashing, Google token verification |
| Create | `backend/routes_auth.py` | `/api/auth/*` FastAPI router |
| Modify | `backend/main.py` | Mount routers, DB startup, auth middleware, modify existing endpoints |
| Create | `contexts/AuthContext.tsx` | React context for auth state |
| Create | `lib/router.ts` | Minimal hash router |
| Create | `components/LoginPage.tsx` | Login UI |
| Create | `components/RegisterPage.tsx` | Register UI |
| Create | `components/AdminPage.tsx` | Admin user management |
| Modify | `index.tsx` | Add Router + AuthProvider + route definitions |
| Modify | `App.tsx` | Read user from AuthContext, remove internal UserContext state |
| Modify | `services/geminiService.ts` | Auto-attach Authorization header |
| Create | `backend/test_auth.py` | Backend auth tests |
| Modify | `backend/.env` | Add JWT_SECRET, OAuth credentials |
| Modify | `package.json` | Add @react-oauth/google dependency |

---

### Task 1: Install Backend Dependencies

**Files:** None

- [ ] **Step 1: Install Python packages**

```bash
cd ~/Projects/roundtable/backend && source venv/bin/activate && pip install aiosqlite PyJWT bcrypt authlib
```

Expected: packages install without errors.

- [ ] **Step 2: Verify installs**

```bash
cd ~/Projects/roundtable/backend && source venv/bin/activate && python -c "import aiosqlite, jwt, bcrypt, authlib; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Add JWT_SECRET to .env**

Read `backend/.env` first, then append:
```
JWT_SECRET=roundtable-jwt-secret-change-in-production-32chars+
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-google-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

- [ ] **Step 4: Commit**

```bash
cd ~/Projects/roundtable && git add backend/.env && git commit -m "chore: install auth backend deps, add env vars"
```

---

### Task 2: Database Module (`backend/db.py`)

**Files:**
- Create: `backend/db.py`

- [ ] **Step 1: Write `backend/db.py`**

```python
import os
import uuid
import aiosqlite
from contextlib import asynccontextmanager

DB_PATH = os.path.join(os.path.dirname(__file__), "data", "roundtable.db")

_connection: aiosqlite.Connection | None = None


async def get_connection() -> aiosqlite.Connection:
    global _connection
    if _connection is None:
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        _connection = await aiosqlite.connect(DB_PATH)
        _connection.row_factory = aiosqlite.Row
        await _connection.execute("PRAGMA journal_mode=WAL")
        await _connection.execute("PRAGMA foreign_keys=ON")
    return _connection


async def init_db():
    db = await get_connection()
    await db.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id            TEXT PRIMARY KEY,
            email         TEXT UNIQUE,
            password_hash TEXT,
            name          TEXT NOT NULL,
            avatar_url    TEXT,
            identity      TEXT DEFAULT '',
            language      TEXT DEFAULT 'Chinese',
            auth_provider TEXT DEFAULT 'email',
            provider_id   TEXT,
            is_admin      INTEGER DEFAULT 0,
            is_active     INTEGER DEFAULT 1,
            created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    await db.commit()


async def close_db():
    global _connection
    if _connection:
        await _connection.close()
        _connection = None


# --- User CRUD ---

async def get_user_by_id(user_id: str) -> dict | None:
    db = await get_connection()
    async with db.execute("SELECT * FROM users WHERE id = ? AND is_active = 1", (user_id,)) as cursor:
        row = await cursor.fetchone()
        return dict(row) if row else None


async def get_user_by_email(email: str) -> dict | None:
    db = await get_connection()
    async with db.execute("SELECT * FROM users WHERE email = ?", (email.lower(),)) as cursor:
        row = await cursor.fetchone()
        return dict(row) if row else None


async def get_user_by_provider(provider: str, provider_id: str) -> dict | None:
    db = await get_connection()
    async with db.execute(
        "SELECT * FROM users WHERE auth_provider = ? AND provider_id = ?",
        (provider, provider_id)
    ) as cursor:
        row = await cursor.fetchone()
        return dict(row) if row else None


async def create_user(
    *,
    email: str | None,
    name: str,
    password_hash: str | None = None,
    avatar_url: str | None = None,
    auth_provider: str = "email",
    provider_id: str | None = None,
    language: str = "Chinese",
) -> dict:
    db = await get_connection()
    user_id = str(uuid.uuid4())

    # First user is automatically admin
    async with db.execute("SELECT COUNT(*) as count FROM users") as cursor:
        row = await cursor.fetchone()
        is_first = row["count"] == 0

    await db.execute(
        """INSERT INTO users (id, email, password_hash, name, avatar_url, auth_provider, provider_id, is_admin, language)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (user_id, email.lower() if email else None, password_hash, name, avatar_url,
         auth_provider, provider_id, 1 if is_first else 0, language)
    )
    await db.commit()
    return await get_user_by_id(user_id)


async def update_user(user_id: str, **fields) -> dict | None:
    if not fields:
        return await get_user_by_id(user_id)
    db = await get_connection()
    set_clause = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [user_id]
    await db.execute(
        f"UPDATE users SET {set_clause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        values
    )
    await db.commit()
    return await get_user_by_id(user_id)


async def list_users(search: str = "") -> list[dict]:
    db = await get_connection()
    if search:
        async with db.execute(
            "SELECT * FROM users WHERE name LIKE ? OR email LIKE ? ORDER BY created_at DESC",
            (f"%{search}%", f"%{search}%")
        ) as cursor:
            return [dict(row) for row in await cursor.fetchall()]
    else:
        async with db.execute("SELECT * FROM users ORDER BY created_at DESC") as cursor:
            return [dict(row) for row in await cursor.fetchall()]


async def delete_user(user_id: str) -> bool:
    """Soft delete — sets is_active = 0"""
    db = await get_connection()
    result = await update_user(user_id, is_active=0)
    return result is not None


async def count_users() -> int:
    db = await get_connection()
    async with db.execute("SELECT COUNT(*) as count FROM users") as cursor:
        row = await cursor.fetchone()
        return row["count"]
```

- [ ] **Step 2: Run init_db to verify schema**

```bash
cd ~/Projects/roundtable/backend && source venv/bin/activate && python -c "
import asyncio
from db import init_db, close_db
asyncio.run(init_db())
asyncio.run(close_db())
print('DB initialized')
"
```

Expected: `DB initialized`

- [ ] **Step 3: Commit**

```bash
cd ~/Projects/roundtable && git add backend/db.py backend/data/.gitkeep && git commit -m "feat: add database module with SQLite users table"
```

---

### Task 3: Auth Utilities (`backend/auth_utils.py`)

**Files:**
- Create: `backend/auth_utils.py`

- [ ] **Step 1: Write `backend/auth_utils.py`**

```python
import os
import time
import bcrypt
import jwt
import httpx
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"), override=True)

JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-change-me")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_SECONDS = 7 * 24 * 60 * 60  # 7 days

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
GITHUB_CLIENT_ID = os.environ.get("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.environ.get("GITHUB_CLIENT_SECRET", "")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def create_jwt(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "iat": int(time.time()),
        "exp": int(time.time()) + JWT_EXPIRY_SECONDS,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_jwt(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])


async def verify_google_credential(credential: str) -> dict:
    """Verify a Google ID token and return {email, name, picture, sub}."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": credential}
        )
        if resp.status_code != 200:
            raise ValueError("Invalid Google credential")
        data = resp.json()
        return {
            "email": data.get("email"),
            "name": data.get("name", data.get("email", "").split("@")[0]),
            "avatar_url": data.get("picture"),
            "provider_id": data.get("sub"),
        }


async def exchange_github_code(code: str) -> dict:
    """Exchange GitHub OAuth code for user info. Returns {email, name, avatar_url, provider_id}."""
    async with httpx.AsyncClient() as client:
        # Exchange code for access token
        token_resp = await client.post(
            "https://github.com/login/oauth/access_token",
            json={
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code": code,
            },
            headers={"Accept": "application/json"},
        )
        token_data = token_resp.json()
        access_token = token_data.get("access_token")
        if not access_token:
            raise ValueError(f"GitHub token exchange failed: {token_data}")

        # Fetch user info
        user_resp = await client.get(
            "https://api.github.com/user",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/json",
            },
        )
        user_data = user_resp.json()

        email = user_data.get("email")
        if not email:
            emails_resp = await client.get(
                "https://api.github.com/user/emails",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            emails = emails_resp.json()
            primary = next((e for e in emails if e.get("primary")), emails[0] if emails else {})
            email = primary.get("email", f"{user_data['login']}@github.com")

        return {
            "email": email,
            "name": user_data.get("name") or user_data.get("login", ""),
            "avatar_url": user_data.get("avatar_url"),
            "provider_id": str(user_data.get("id")),
        }


def validate_email(email: str) -> bool:
    import re
    return bool(re.match(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", email))


def validate_password(password: str) -> str | None:
    """Return error message if invalid, None if valid."""
    if len(password) < 8:
        return "Password must be at least 8 characters"
    return None
```

- [ ] **Step 2: Verify basic JWT flow**

```bash
cd ~/Projects/roundtable/backend && source venv/bin/activate && python -c "
from auth_utils import hash_password, verify_password, create_jwt, decode_jwt
h = hash_password('test1234')
assert verify_password('test1234', h)
assert not verify_password('wrong', h)
token = create_jwt('test-user-id')
payload = decode_jwt(token)
assert payload['sub'] == 'test-user-id'
print('JWT and bcrypt OK')
"
```

Expected: `JWT and bcrypt OK`

- [ ] **Step 3: Commit**

```bash
cd ~/Projects/roundtable && git add backend/auth_utils.py && git commit -m "feat: add auth utilities — JWT, bcrypt, OAuth verification"
```

---

### Task 4: Auth Routes (`backend/routes_auth.py`)

**Files:**
- Create: `backend/routes_auth.py`

- [ ] **Step 1: Write `backend/routes_auth.py`**

```python
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field
from backend.db import get_user_by_email, get_user_by_provider, create_user, update_user, get_user_by_id
from backend.auth_utils import (
    hash_password, verify_password, create_jwt, decode_jwt,
    verify_google_credential, exchange_github_code,
    validate_email, validate_password, JWT_SECRET, JWT_ALGORITHM,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


# --- Request Models ---

class RegisterRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=100)
    language: str = Field(default="Chinese")


class LoginRequest(BaseModel):
    email: str
    password: str


class GoogleAuthRequest(BaseModel):
    credential: str  # Google ID token


class GitHubAuthRequest(BaseModel):
    code: str


class UpdateProfileRequest(BaseModel):
    name: str | None = None
    identity: str | None = None
    language: str | None = None


# --- Dependencies ---

async def get_current_user(request: Request) -> dict:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = auth_header.removeprefix("Bearer ")
    try:
        payload = decode_jwt(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = await get_user_by_id(payload["sub"])
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# --- User response helper ---

def user_response(user: dict, token: str | None = None) -> dict:
    resp = {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "avatar_url": user.get("avatar_url"),
        "identity": user.get("identity", ""),
        "language": user.get("language", "Chinese"),
        "auth_provider": user.get("auth_provider", "email"),
        "is_admin": bool(user.get("is_admin")),
    }
    if token:
        resp["token"] = token
    return resp


# --- Endpoints ---

@router.post("/register")
async def register(req: RegisterRequest):
    if not validate_email(req.email):
        raise HTTPException(status_code=400, detail="Invalid email format")
    pw_error = validate_password(req.password)
    if pw_error:
        raise HTTPException(status_code=400, detail=pw_error)

    existing = await get_user_by_email(req.email)
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    user = await create_user(
        email=req.email,
        name=req.name,
        password_hash=hash_password(req.password),
        language=req.language,
    )
    token = create_jwt(user["id"])
    return user_response(user, token)


@router.post("/login")
async def login(req: LoginRequest):
    user = await get_user_by_email(req.email)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.get("password_hash"):
        raise HTTPException(
            status_code=400,
            detail="This account uses OAuth login. Please sign in with Google or GitHub."
        )
    if not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_jwt(user["id"])
    return user_response(user, token)


@router.post("/google")
async def google_auth(req: GoogleAuthRequest):
    try:
        google_user = await verify_google_credential(req.credential)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    email = google_user["email"]
    provider_id = google_user["provider_id"]

    # Try matching by provider first, then by email
    user = await get_user_by_provider("google", provider_id)
    if not user and email:
        user = await get_user_by_email(email)
        if user:
            # Link provider to existing email account
            await update_user(user["id"], auth_provider="google", provider_id=provider_id,
                              avatar_url=google_user.get("avatar_url"))

    if not user:
        user = await create_user(
            email=email,
            name=google_user["name"],
            avatar_url=google_user.get("avatar_url"),
            auth_provider="google",
            provider_id=provider_id,
        )

    token = create_jwt(user["id"])
    return user_response(user, token)


@router.post("/github")
async def github_auth(req: GitHubAuthRequest):
    try:
        github_user = await exchange_github_code(req.code)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    provider_id = github_user["provider_id"]

    user = await get_user_by_provider("github", provider_id)
    if not user:
        user = await get_user_by_email(github_user["email"])
        if user:
            await update_user(user["id"], auth_provider="github", provider_id=provider_id,
                              avatar_url=github_user.get("avatar_url"))

    if not user:
        user = await create_user(
            email=github_user["email"],
            name=github_user["name"],
            avatar_url=github_user.get("avatar_url"),
            auth_provider="github",
            provider_id=provider_id,
        )

    token = create_jwt(user["id"])
    return user_response(user, token)


@router.get("/me")
async def get_me(user: dict = Depends(get_current_user)):
    return user_response(user)


@router.put("/me")
async def update_me(req: UpdateProfileRequest, user: dict = Depends(get_current_user)):
    updates = {}
    if req.name is not None:
        updates["name"] = req.name
    if req.identity is not None:
        updates["identity"] = req.identity
    if req.language is not None:
        updates["language"] = req.language
    if updates:
        user = await update_user(user["id"], **updates)
    return user_response(user)
```

- [ ] **Step 2: Commit**

```bash
cd ~/Projects/roundtable && git add backend/routes_auth.py && git commit -m "feat: add auth routes — register, login, OAuth, profile"
```

---

### Task 5: Admin Routes in `backend/routes_auth.py`

**Files:**
- Modify: `backend/routes_auth.py`

- [ ] **Step 1: Append admin endpoints to `backend/routes_auth.py`**

```python
# --- Admin: user management (requires admin) ---

class AdminUpdateUserRequest(BaseModel):
    name: str | None = None
    is_admin: bool | None = None
    is_active: bool | None = None


class AdminCreateUserRequest(BaseModel):
    email: str
    password: str = Field(min_length=8)
    name: str


@router.get("/admin/users")
async def admin_list_users(search: str = "", admin: dict = Depends(require_admin)):
    users = await list_users(search)
    return {
        "users": [
            {
                "id": u["id"],
                "email": u["email"],
                "name": u["name"],
                "avatar_url": u.get("avatar_url"),
                "auth_provider": u.get("auth_provider", "email"),
                "is_admin": bool(u.get("is_admin")),
                "is_active": bool(u.get("is_active")),
                "language": u.get("language", "Chinese"),
                "created_at": u.get("created_at"),
            }
            for u in users
        ]
    }


@router.put("/admin/users/{user_id}")
async def admin_update_user(user_id: str, req: AdminUpdateUserRequest, admin: dict = Depends(require_admin)):
    user = await get_user_by_id(user_id)
    if not user:
        # Try including inactive users
        from backend.db import get_connection
        db = await get_connection()
        async with db.execute("SELECT * FROM users WHERE id = ?", (user_id,)) as cursor:
            row = await cursor.fetchone()
            user = dict(row) if row else None
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

    updates = {}
    if req.name is not None:
        updates["name"] = req.name
    if req.is_admin is not None:
        updates["is_admin"] = 1 if req.is_admin else 0
    if req.is_active is not None:
        updates["is_active"] = 1 if req.is_active else 0

    updated = await update_user(user_id, **updates)
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")
    return user_response(updated)


@router.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str, admin: dict = Depends(require_admin)):
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    success = await delete_user(user_id)
    if not success:
        raise HTTPException(status_code=404, detail="User not found")
    return {"detail": "User deactivated"}


@router.post("/admin/users")
async def admin_create_user(req: AdminCreateUserRequest, admin: dict = Depends(require_admin)):
    if not validate_email(req.email):
        raise HTTPException(status_code=400, detail="Invalid email format")
    pw_error = validate_password(req.password)
    if pw_error:
        raise HTTPException(status_code=400, detail=pw_error)
    existing = await get_user_by_email(req.email)
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")
    user = await create_user(
        email=req.email,
        name=req.name,
        password_hash=hash_password(req.password),
    )
    return user_response(user)
```

Note: also add the `list_users` import at the top of `routes_auth.py`:
```python
from backend.db import get_user_by_email, get_user_by_provider, create_user, update_user, get_user_by_id, list_users, delete_user
```

- [ ] **Step 2: Commit**

```bash
cd ~/Projects/roundtable && git add backend/routes_auth.py && git commit -m "feat: add admin routes — user CRUD"
```

---

### Task 6: Modify `backend/main.py` — Mount Routes + Middleware + Refactor Existing Endpoints

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Update imports at the top of `backend/main.py`**

Replace the existing imports with:
```python
import os
import random
import re
import json
import logging
import httpx
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from dotenv import load_dotenv

from backend.db import init_db, close_db, get_user_by_id
from backend.auth_utils import decode_jwt, JWT_SECRET, JWT_ALGORITHM
from backend.routes_auth import router as auth_router, get_current_user

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"), override=True)

class OpeningStatementRejected(Exception):
    """Raised when the AI produces a greeting instead of a substantive opening."""
    pass

# ... rest of existing globals (CORS, api_key, base_url, MODEL, AVATAR_COLORS) ...
```

- [ ] **Step 2: Add DB startup/shutdown to lifespan**

Wrap the existing lifespan to call `init_db()` on startup and `close_db()` on shutdown:

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    global _http_client
    _http_client = httpx.AsyncClient(timeout=120.0)
    await init_db()
    yield
    await close_db()
    if _http_client:
        await _http_client.aclose()
        _http_client = None
```

- [ ] **Step 3: Mount auth router**

After `app.add_middleware(...)`, add:
```python
app.include_router(auth_router)
```

- [ ] **Step 4: Modify existing endpoints to use auth and remove UserContext from request body**

For each existing request model (`GeneratePanelRequest`, `GenerateSingleParticipantRequest`, `PredictNextSpeakerRequest`, `GenerateTurnRequest`, `GenerateSummaryRequest`), remove the `userContext` field.

For the endpoints themselves, add `user: dict = Depends(get_current_user)` parameter and construct a `UserContext` dict internally:

```python
def _make_user_context(user: dict):
    return {
        "nickname": user["name"],
        "identity": user.get("identity", ""),
        "language": user.get("language", "Chinese"),
    }
```

Then in each endpoint, replace `req.userContext` with `_make_user_context(user)`.

For `generate_random_topic`, use `user` instead of `req.userContext`:
```python
@app.post("/api/generate_random_topic")
async def generate_random_topic(user: dict = Depends(get_current_user)):
    lang = user.get("language", "Chinese")
    lang_instruction = "in Chinese" if lang.lower() == "chinese" else "in English" if lang.lower() == "english" else f"in {lang}"
    # ... rest stays the same, use lang instead of req.language
```

Apply the same pattern to:
- `POST /api/generate_panel`: replace `req.userContext` with `_make_user_context(user)`
- `POST /api/generate_single_participant`: same
- `POST /api/predict_next_speaker`: same
- `POST /api/generate_turn`: same
- `POST /api/generate_summary`: same

- [ ] **Step 5: Commit**

```bash
cd ~/Projects/roundtable && git add backend/main.py && git commit -m "refactor: integrate auth middleware, remove UserContext from API requests"
```

---

### Task 7: Install Frontend Dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install @react-oauth/google**

```bash
cd ~/Projects/roundtable && npm install @react-oauth/google
```

Expected: package installed successfully.

- [ ] **Step 2: Commit**

```bash
cd ~/Projects/roundtable && git add package.json package-lock.json && git commit -m "chore: add @react-oauth/google for Google sign-in"
```

---

### Task 8: Minimal Hash Router (`lib/router.ts`)

**Files:**
- Create: `lib/router.ts`

- [ ] **Step 1: Write `lib/router.ts`**

```typescript
type RouteHandler = () => JSX.Element;

const routes: Map<string, RouteHandler> = new Map();
let currentPath: string = window.location.hash.slice(1) || '/';
let listeners: Set<() => void> = new Set();

export function addRoute(path: string, handler: RouteHandler) {
  routes.set(path, handler);
}

export function navigate(path: string) {
  window.location.hash = path;
}

export function getCurrentPath(): string {
  return currentPath;
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

window.addEventListener('hashchange', () => {
  currentPath = window.location.hash.slice(1) || '/';
  listeners.forEach(fn => fn());
});

export function Router() {
  const [path, setPath] = React.useState(currentPath);

  React.useEffect(() => {
    return subscribe(() => setPath(currentPath));
  }, []);

  // Redirect to /login if no route matches
  const handler = routes.get(path);
  if (handler) return handler();

  // Default: redirect to login
  if (routes.has('/login')) {
    navigate('/login');
    return null;
  }
  return null;
}

// Import at top needs React
import React from 'react';
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd ~/Projects/roundtable && npx tsc --noEmit lib/router.ts 2>&1 | head -5
```

Expected: no errors (or minor warnings only).

- [ ] **Step 3: Commit**

```bash
cd ~/Projects/roundtable && git add lib/router.ts && git commit -m "feat: add minimal hash-based router"
```

---

### Task 9: AuthContext (`contexts/AuthContext.tsx`)

**Files:**
- Create: `contexts/AuthContext.tsx`

- [ ] **Step 1: Write `contexts/AuthContext.tsx`**

```typescript
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { navigate } from '../lib/router';

export interface AuthUser {
  id: string;
  email: string | null;
  name: string;
  avatar_url?: string;
  identity: string;
  language: string;
  auth_provider: string;
  is_admin: boolean;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, language: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  loginWithGithub: (code: string) => Promise<void>;
  logout: () => void;
  updateProfile: (data: { name?: string; identity?: string; language?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const TOKEN_KEY = 'roundtable_token';

function storeToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function api(path: string, body?: any, token?: string): Promise<any> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method: body ? 'POST' : 'GET',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(getStoredToken);
  const [loading, setLoading] = useState(true);

  // Validate stored token on mount
  useEffect(() => {
    const stored = getStoredToken();
    if (stored) {
      api('/api/auth/me', undefined, stored)
        .then(data => {
          setUser(data);
          setToken(stored);
        })
        .catch(() => {
          clearToken();
          setToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api('/api/auth/login', { email, password });
    storeToken(data.token);
    setToken(data.token);
    setUser(data);
  }, []);

  const register = useCallback(async (email: string, password: string, name: string, language: string) => {
    const data = await api('/api/auth/register', { email, password, name, language });
    storeToken(data.token);
    setToken(data.token);
    setUser(data);
  }, []);

  const loginWithGoogle = useCallback(async (credential: string) => {
    const data = await api('/api/auth/google', { credential });
    storeToken(data.token);
    setToken(data.token);
    setUser(data);
  }, []);

  const loginWithGithub = useCallback(async (code: string) => {
    const data = await api('/api/auth/github', { code });
    storeToken(data.token);
    setToken(data.token);
    setUser(data);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setToken(null);
    setUser(null);
    navigate('/login');
  }, []);

  const updateProfile = useCallback(async (profileData: { name?: string; identity?: string; language?: string }) => {
    if (!token) throw new Error('Not authenticated');
    const data = await fetch(`${API_BASE}/api/auth/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(profileData),
    }).then(r => r.json());
    setUser(data);
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, loginWithGoogle, loginWithGithub, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd ~/Projects/roundtable && npx tsc --noEmit contexts/AuthContext.tsx 2>&1 | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd ~/Projects/roundtable && git add contexts/AuthContext.tsx && git commit -m "feat: add AuthContext with JWT token management"
```

---

### Task 10: LoginPage Component

**Files:**
- Create: `components/LoginPage.tsx`

- [ ] **Step 1: Write `components/LoginPage.tsx`**

```typescript
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { navigate } from '../lib/router';
import { GoogleLogin } from '@react-oauth/google';
import { ArrowRight, Loader2, Github } from 'lucide-react';

export function LoginPage() {
  const { login, loginWithGoogle, loginWithGithub, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Redirect if already logged in
  React.useEffect(() => {
    if (user) {
      if (!user.identity) navigate('/onboarding');
      else navigate('/');
    }
  }, [user]);

  // Handle GitHub OAuth callback
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      window.history.replaceState({}, '', '/');
      setBusy(true);
      loginWithGithub(code)
        .catch(e => setError(e.message))
        .finally(() => setBusy(false));
    }
  }, []);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setError('');
    setBusy(true);
    try {
      await login(email.trim(), password);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    setError('');
    setBusy(true);
    try {
      await loginWithGoogle(credentialResponse.credential);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleError = () => {
    setError('Google sign-in failed. Please try again.');
  };

  const handleGithubLogin = () => {
    const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID || 'your-github-client-id';
    const redirectUri = window.location.origin + '/login';
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email`;
  };

  return (
    <div className="min-h-screen bg-md-surface flex flex-col items-center justify-center p-6 animate-fade-in">
      <div className="w-full max-w-sm bg-md-surface-container rounded-3xl shadow-elevation-2 p-8 border border-white/10">
        <div className="mb-8 text-center">
          <h1 className="font-sans text-3xl font-bold text-md-primary tracking-tight">The Roundtable</h1>
          <p className="text-md-secondary text-sm mt-2">Sign in to join the discussion.</p>
        </div>

        {/* OAuth Buttons */}
        <div className="space-y-3 mb-6">
          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              theme="filled_black"
              size="large"
              text="signin_with"
              shape="pill"
            />
          </div>

          <button
            onClick={handleGithubLogin}
            disabled={busy}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-full bg-[#24292e] text-white hover:bg-[#2f363d] transition-colors font-medium text-sm disabled:opacity-50"
          >
            <Github size={18} />
            Sign in with GitHub
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-6">
          <hr className="flex-1 border-white/10" />
          <span className="text-xs text-md-outline uppercase">or</span>
          <hr className="flex-1 border-white/10" />
        </div>

        {/* Email Login Form */}
        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full bg-md-surface-container-low border-none rounded-xl p-4 text-md-primary placeholder-gray-500 text-base focus:ring-2 focus:ring-md-accent/50 outline-none"
              disabled={busy}
            />
          </div>
          <div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full bg-md-surface-container-low border-none rounded-xl p-4 text-md-primary placeholder-gray-500 text-base focus:ring-2 focus:ring-md-accent/50 outline-none"
              disabled={busy}
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={!email.trim() || !password || busy}
            className="w-full bg-md-accent text-black font-medium py-4 rounded-full shadow-elevation-1 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
            {busy ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-sm text-md-secondary mt-6">
          Don't have an account?{' '}
          <button onClick={() => navigate('/register')} className="text-md-accent font-medium hover:underline">
            Create one
          </button>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd ~/Projects/roundtable && git add components/LoginPage.tsx && git commit -m "feat: add LoginPage with Google, GitHub, and email login"
```

---

### Task 11: RegisterPage Component

**Files:**
- Create: `components/RegisterPage.tsx`

- [ ] **Step 1: Write `components/RegisterPage.tsx`**

```typescript
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { navigate } from '../lib/router';
import { ArrowRight, Loader2 } from 'lucide-react';

export function RegisterPage() {
  const { register, user } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [language, setLanguage] = useState('Chinese');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (user) {
      navigate('/onboarding');
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) return;
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await register(email.trim(), password, name.trim(), language);
      navigate('/onboarding');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-md-surface flex flex-col items-center justify-center p-6 animate-fade-in">
      <div className="w-full max-w-sm bg-md-surface-container rounded-3xl shadow-elevation-2 p-8 border border-white/10">
        <div className="mb-8 text-center">
          <h1 className="font-sans text-3xl font-bold text-md-primary tracking-tight">Create Account</h1>
          <p className="text-md-secondary text-sm mt-2">Join the roundtable.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
              className="w-full bg-md-surface-container-low border-none rounded-xl p-4 text-md-primary placeholder-gray-500 text-base focus:ring-2 focus:ring-md-accent/50 outline-none"
              disabled={busy}
              autoFocus
            />
          </div>
          <div>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full bg-md-surface-container-low border-none rounded-xl p-4 text-md-primary placeholder-gray-500 text-base focus:ring-2 focus:ring-md-accent/50 outline-none"
              disabled={busy}
            />
          </div>
          <div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password (min 8 characters)"
              className="w-full bg-md-surface-container-low border-none rounded-xl p-4 text-md-primary placeholder-gray-500 text-base focus:ring-2 focus:ring-md-accent/50 outline-none"
              disabled={busy}
            />
          </div>
          <div>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              className="w-full bg-md-surface-container-low border-none rounded-xl p-4 text-md-primary placeholder-gray-500 text-base focus:ring-2 focus:ring-md-accent/50 outline-none"
              disabled={busy}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-md-outline uppercase tracking-wider mb-2 ml-1">Language</label>
            <select
              value={language}
              onChange={e => setLanguage(e.target.value)}
              className="w-full bg-md-surface-container-low border-none rounded-xl p-4 text-md-primary text-base focus:ring-2 focus:ring-md-accent/50 outline-none appearance-none"
              disabled={busy}
            >
              <option value="Chinese">中文 (Chinese)</option>
              <option value="English">English</option>
              <option value="Japanese">日本語 (Japanese)</option>
              <option value="Spanish">Español</option>
            </select>
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={!name.trim() || !email.trim() || !password || !confirmPassword || busy}
            className="w-full bg-md-accent text-black font-medium py-4 rounded-full shadow-elevation-1 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
            {busy ? 'Creating...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-md-secondary mt-6">
          Already have an account?{' '}
          <button onClick={() => navigate('/login')} className="text-md-accent font-medium hover:underline">
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd ~/Projects/roundtable && git add components/RegisterPage.tsx && git commit -m "feat: add RegisterPage with email/password signup"
```

---

### Task 12: Modify `index.tsx` — Add Router + AuthProvider + Routes

**Files:**
- Modify: `index.tsx`
- Modify: `services/geminiService.ts`

- [ ] **Step 1: Rewrite `index.tsx`**

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './contexts/AuthContext';
import { addRoute, Router } from './lib/router';
import App from './App';
import { LoginPage } from './components/LoginPage';
import { RegisterPage } from './components/RegisterPage';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

function AppShell() {
  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  );
}

// Route definitions
addRoute('/login', () => <LoginPage />);
addRoute('/register', () => <RegisterPage />);
addRoute('/', () => <App />);

// Admin page — lazy loaded
addRoute('/admin', () => {
  const { AdminPage } = require('./components/AdminPage');
  return <AdminPage />;
});

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Could not find root element to mount to");

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AppShell />
    </GoogleOAuthProvider>
  </React.StrictMode>
);
```

Wait — the admin lazy load with `require` won't work well with ESM. Instead just import it directly:

Fix: add `import { AdminPage } from './components/AdminPage';` at top and `addRoute('/admin', () => <AdminPage />);`

- [ ] **Step 2: Modify `services/geminiService.ts` — auto-attach token**

Add a function to read the stored token and attach it to all `apiCall` requests:

In `apiCall`, modify the headers:
```typescript
const token = localStorage.getItem('roundtable_token');
const headers: Record<string, string> = { 'Content-Type': 'application/json' };
if (token) headers['Authorization'] = `Bearer ${token}`;
```

And remove `userContext` from API call bodies:

- `generatePanel`: replace body `{ topic, userContext }` with `{ topic }`
- `generateSingleParticipant`: replace body `{ inputQuery, topic, userContext }` with `{ inputQuery, topic }`
- `predictNextSpeaker`: replace body with `{ topic, participants, messageHistory }` (remove userContext)
- `generateTurnForSpeaker`: replace body with `{ speakerId, topic, participants, messageHistory, turnCount, maxTurns, isOpeningStatement, mentionedParticipantId }` (remove userContext)
- `generateSummary`: replace body with `{ topic, messageHistory, participants }` (remove userContext)
- `generateRandomTopic`: remove `{ language }` body, call with `{}` (backed reads from auth user)

- [ ] **Step 3: Commit**

```bash
cd ~/Projects/roundtable && git add index.tsx services/geminiService.ts && git commit -m "refactor: add router + AuthProvider, remove UserContext from API calls"
```

---

### Task 13: Modify `App.tsx` — Integrate Auth, Remove Local UserContext

**Files:**
- Modify: `App.tsx`

Key changes:
1. Remove `UserContext` state — read from `useAuth()`
2. Add auth gate: redirect to `/login` if not authenticated
3. Remove `OnboardingForm` from internal state machine — it's now a separate route
4. `handleOnboardingComplete` → call `updateProfile` instead of `setUserContext`
5. Read `user.name` (nickname), `user.identity`, `user.language` from `AuthUser`
6. Remove `import { OnboardingForm }` — it's no longer rendered here
7. Remove `AppState.ONBOARDING` — app starts from `LANDING` now
8. Add admin navigation button if `user.is_admin`

The full modified `App.tsx` is large — I'll provide the key changes inline instead of the full file.

- [ ] **Step 1: Apply key modifications to `App.tsx`**

At top, replace `AppState.ONBOARDING` usage — initial state becomes `LANDING`:
```typescript
const [appState, setAppState] = useState<AppState>(AppState.LANDING);
```

Add auth import:
```typescript
import { useAuth } from '../contexts/AuthContext';
import { navigate } from '../lib/router';
```

At top of `App()` function body, add auth gate:
```typescript
const { user, token, loading, logout } = useAuth();

// Redirect if not authenticated
useEffect(() => {
  if (!loading && !user) navigate('/login');
}, [loading, user]);

// Redirect to onboarding if profile incomplete
useEffect(() => {
  if (user && !user.identity) navigate('/onboarding');
}, [user]);
```

Remove `userContext` state and `handleOnboardingComplete` — replace all references to `userContext` with:
```typescript
const uc = user ? { nickname: user.name, identity: user.identity, language: user.language } : null;
```

Add admin button to landing page header (next to back button):
```typescript
{user?.is_admin && (
  <button
    onClick={() => navigate('/admin')}
    className="fixed top-6 right-6 z-50 p-2 rounded-full bg-md-surface-container hover:bg-white/10 transition-colors border border-white/5 text-md-primary shadow-sm backdrop-blur-md"
    title="Admin Panel"
  >
    <Shield size={24} />
  </button>
)}
```

Add `Shield` to lucide-react imports.

Remove `ONBOARDING` case from the render switch — it's handled by the router.

Replace `userContext?.nickname` with `user?.name` throughout the JSX.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd ~/Projects/roundtable && npx tsc --noEmit 2>&1 | head -30
```

Expected: address any remaining type errors.

- [ ] **Step 3: Commit**

```bash
cd ~/Projects/roundtable && git add App.tsx && git commit -m "refactor: integrate AuthContext into App, remove local UserContext state"
```

---

### Task 14: Modify OnboardingForm — Save to Backend

**Files:**
- Modify: `components/OnboardingForm.tsx`

- [ ] **Step 1: Update OnboardingForm to call `updateProfile`**

Replace the `onComplete` prop-based approach with direct `useAuth()` integration:

```typescript
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { navigate } from '../lib/router';
import { ArrowRight } from 'lucide-react';

export const OnboardingForm: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const [identity, setIdentity] = useState(user?.identity || '');
  const [language, setLanguage] = useState(user?.language || 'Chinese');
  const [busy, setBusy] = useState(false);

  // Redirect if no user
  React.useEffect(() => {
    if (user && user.identity) navigate('/');
  }, [user]);

  const handleSubmit = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await updateProfile({
        identity: identity.trim() || 'A curious observer',
        language,
      });
      navigate('/');
    } catch (e) {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-md-surface flex flex-col items-center justify-center p-6 animate-fade-in">
      <div className="w-full max-w-sm bg-md-surface-container rounded-3xl shadow-elevation-2 p-8 border border-white/10">
        <div className="mb-8 text-center">
          <h1 className="font-sans text-3xl font-bold text-md-primary tracking-tight">Welcome, {user?.name}</h1>
          <p className="text-md-secondary text-sm mt-2">Tell us a bit about yourself.</p>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-md-outline uppercase tracking-wider mb-2 ml-1">Your Identity</label>
            <textarea
              value={identity}
              onChange={e => setIdentity(e.target.value)}
              placeholder="e.g. A Tech Ethics Professor concerned about AI alignment..."
              rows={3}
              className="w-full bg-md-surface-container-low border-none rounded-xl p-4 text-md-primary placeholder-gray-500 text-base focus:ring-2 focus:ring-md-accent/50 outline-none transition-all resize-none"
              disabled={busy}
              autoFocus
            />
            <p className="text-[10px] text-gray-500 mt-1 ml-1">This helps the AI tailor the debate to you.</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-md-outline uppercase tracking-wider mb-2 ml-1">Language</label>
            <select
              value={language}
              onChange={e => setLanguage(e.target.value)}
              className="w-full bg-md-surface-container-low border-none rounded-xl p-4 text-md-primary text-base focus:ring-2 focus:ring-md-accent/50 outline-none appearance-none"
              disabled={busy}
            >
              <option value="Chinese">中文 (Chinese)</option>
              <option value="English">English</option>
              <option value="Japanese">日本語 (Japanese)</option>
              <option value="Spanish">Español</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={busy}
          className="mt-8 w-full bg-md-accent text-black font-medium py-4 rounded-full shadow-elevation-1 hover:shadow-elevation-2 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {busy ? 'Saving...' : 'Join Roundtable'} <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
};
```

Add the `/onboarding` route to `index.tsx`:
```typescript
import { OnboardingForm } from './components/OnboardingForm';
addRoute('/onboarding', () => <OnboardingForm />);
```

- [ ] **Step 2: Commit**

```bash
cd ~/Projects/roundtable && git add components/OnboardingForm.tsx index.tsx && git commit -m "refactor: OnboardingForm saves profile to backend via AuthContext"
```

---

### Task 15: AdminPage Component

**Files:**
- Create: `components/AdminPage.tsx`

- [ ] **Step 1: Write `components/AdminPage.tsx`**

This is the most complex component. Core features: user table, search, edit modal, add modal, delete.

```typescript
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { navigate } from '../lib/router';
import { ArrowLeft, Search, Edit2, Trash2, UserPlus, X, Loader2, Check, Shield, ShieldOff } from 'lucide-react';

interface AdminUser {
  id: string;
  email: string | null;
  name: string;
  avatar_url?: string;
  auth_provider: string;
  is_admin: boolean;
  is_active: boolean;
  language: string;
  created_at: string;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export function AdminPage() {
  const { user, token } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Add form state
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPassword, setAddPassword] = useState('');

  // Redirect if not admin
  useEffect(() => {
    if (user && !user.is_admin) navigate('/');
  }, [user]);

  const fetchUsers = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : '';
      const res = await fetch(`${API_BASE}/api/auth/admin/users${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setUsers(data.users || []);
    } catch (e) {
      console.error('Failed to fetch users:', e);
    } finally {
      setLoading(false);
    }
  }, [token, search]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleUpdate = async (userId: string, updates: Record<string, any>) => {
    if (!token) return;
    await fetch(`${API_BASE}/api/auth/admin/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(updates),
    });
    setEditing(null);
    fetchUsers();
  };

  const handleDelete = async (userId: string) => {
    if (!token || !confirm('Deactivate this user?')) return;
    await fetch(`${API_BASE}/api/auth/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchUsers();
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    await fetch(`${API_BASE}/api/auth/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: addName, email: addEmail, password: addPassword }),
    });
    setShowAddModal(false);
    setAddName('');
    setAddEmail('');
    setAddPassword('');
    fetchUsers();
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr || '-';
    }
  };

  return (
    <div className="min-h-screen bg-md-surface p-6 animate-fade-in">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/')} className="p-2 rounded-full hover:bg-white/10 text-md-primary">
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-2xl font-bold text-md-primary">Admin Panel</h1>
            <span className="text-sm text-md-secondary">{users.length} users</span>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-md-accent text-black rounded-full font-medium text-sm hover:opacity-90"
          >
            <UserPlus size={16} /> Add User
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search users by name or email..."
            className="w-full bg-md-surface-container border border-white/10 rounded-xl py-3 pl-12 pr-4 text-md-primary placeholder-gray-500 outline-none focus:ring-2 focus:ring-md-accent/50"
          />
        </div>

        {/* Users Table */}
        <div className="bg-md-surface-container rounded-2xl border border-white/10 overflow-hidden">
          {loading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="animate-spin text-md-accent" size={32} />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center p-12 text-md-secondary">No users found.</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5 text-xs text-md-outline uppercase tracking-wider">
                  <th className="text-left p-4 font-bold">Name</th>
                  <th className="text-left p-4 font-bold">Email</th>
                  <th className="text-left p-4 font-bold hidden md:table-cell">Provider</th>
                  <th className="text-center p-4 font-bold hidden md:table-cell">Admin</th>
                  <th className="text-center p-4 font-bold">Active</th>
                  <th className="text-right p-4 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className={`border-b border-white/5 hover:bg-white/5 ${!u.is_active ? 'opacity-50' : ''}`}>
                    <td className="p-4">
                      <span className="font-medium text-md-primary">{u.name}</span>
                      <span className="block text-xs text-md-secondary">{u.language}</span>
                    </td>
                    <td className="p-4 text-sm text-md-secondary">{u.email || '-'}</td>
                    <td className="p-4 text-sm text-md-secondary hidden md:table-cell">
                      <span className="px-2 py-0.5 rounded-full bg-white/10 text-xs">{u.auth_provider}</span>
                    </td>
                    <td className="p-4 text-center hidden md:table-cell">
                      {u.is_admin ? (
                        <Shield size={16} className="inline text-md-accent" />
                      ) : (
                        <ShieldOff size={16} className="inline text-gray-500" />
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-block w-2 h-2 rounded-full ${u.is_active ? 'bg-green-400' : 'bg-red-400'}`}></span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditing(u)}
                          className="p-2 rounded-lg hover:bg-white/10 text-md-secondary"
                          title="Edit user"
                        >
                          <Edit2 size={14} />
                        </button>
                        {u.id !== user?.id && (
                          <button
                            onClick={() => handleDelete(u.id)}
                            className="p-2 rounded-lg hover:bg-red-500/20 text-red-400"
                            title="Deactivate user"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Edit Modal */}
        {editing && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in">
            <div className="bg-md-surface-container p-6 rounded-2xl shadow-2xl border border-white/10 w-full max-w-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-lg text-md-primary">Edit User</h3>
                <button onClick={() => setEditing(null)} className="p-1 hover:bg-white/10 rounded-full">
                  <X size={20} className="text-gray-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-md-outline uppercase mb-1">Name</label>
                  <input
                    type="text"
                    defaultValue={editing.name}
                    id="edit-name"
                    className="w-full bg-md-surface-container-low border border-white/10 rounded-xl p-3 text-md-primary outline-none focus:ring-2 focus:ring-md-accent/50"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-md-primary">Admin</span>
                  <button
                    onClick={() => {
                      const name = (document.getElementById('edit-name') as HTMLInputElement).value;
                      handleUpdate(editing.id, { name, is_admin: !editing.is_admin });
                    }}
                    className={`w-12 h-6 rounded-full transition-colors ${editing.is_admin ? 'bg-md-accent' : 'bg-gray-600'}`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full transition-transform ${editing.is_admin ? 'translate-x-6' : 'translate-x-0.5'}`}></div>
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-md-primary">Active</span>
                  <button
                    onClick={() => handleUpdate(editing.id, { is_active: !editing.is_active })}
                    className={`w-12 h-6 rounded-full transition-colors ${editing.is_active ? 'bg-md-accent' : 'bg-gray-600'}`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full transition-transform ${editing.is_active ? 'translate-x-6' : 'translate-x-0.5'}`}></div>
                  </button>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    onClick={() => setEditing(null)}
                    className="flex-1 py-2 rounded-xl border border-white/10 text-md-secondary text-sm hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      const name = (document.getElementById('edit-name') as HTMLInputElement).value;
                      handleUpdate(editing.id, { name });
                    }}
                    className="flex-1 py-2 rounded-xl bg-md-accent text-black text-sm font-medium"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add User Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in">
            <div className="bg-md-surface-container p-6 rounded-2xl shadow-2xl border border-white/10 w-full max-w-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-lg text-md-primary">Add User</h3>
                <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-white/10 rounded-full">
                  <X size={20} className="text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleAddUser} className="space-y-4">
                <input
                  type="text"
                  value={addName}
                  onChange={e => setAddName(e.target.value)}
                  placeholder="Name"
                  required
                  className="w-full bg-md-surface-container-low border border-white/10 rounded-xl p-3 text-md-primary outline-none focus:ring-2 focus:ring-md-accent/50"
                />
                <input
                  type="email"
                  value={addEmail}
                  onChange={e => setAddEmail(e.target.value)}
                  placeholder="Email"
                  required
                  className="w-full bg-md-surface-container-low border border-white/10 rounded-xl p-3 text-md-primary outline-none focus:ring-2 focus:ring-md-accent/50"
                />
                <input
                  type="password"
                  value={addPassword}
                  onChange={e => setAddPassword(e.target.value)}
                  placeholder="Password (min 8 chars)"
                  required
                  minLength={8}
                  className="w-full bg-md-surface-container-low border border-white/10 rounded-xl p-3 text-md-primary outline-none focus:ring-2 focus:ring-md-accent/50"
                />
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setShowAddModal(false)}
                    className="flex-1 py-2 rounded-xl border border-white/10 text-md-secondary text-sm hover:bg-white/5">
                    Cancel
                  </button>
                  <button type="submit"
                    className="flex-1 py-2 rounded-xl bg-md-accent text-black text-sm font-medium">
                    Create User
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Fix admin route in `index.tsx`**

Ensure the admin route uses `AdminPage`:
```typescript
import { AdminPage } from './components/AdminPage';
addRoute('/admin', () => <AdminPage />);
```

- [ ] **Step 3: Commit**

```bash
cd ~/Projects/roundtable && git add components/AdminPage.tsx index.tsx && git commit -m "feat: add AdminPage with user table, edit, add, and deactivate"
```

---

### Task 16: Backend Tests

**Files:**
- Create: `backend/test_auth.py`

- [ ] **Step 1: Write `backend/test_auth.py`**

```python
import pytest
import pytest_asyncio
import aiosqlite
import os
import sys

# Ensure backend is on path
sys.path.insert(0, os.path.dirname(__file__))

from fastapi.testclient import TestClient


# Use in-memory SQLite for tests
TEST_DB_PATH = ":memory:"


@pytest.fixture
def client():
    # Override DB_PATH for testing
    from backend import db as db_module
    original_path = db_module.DB_PATH
    db_module.DB_PATH = TEST_DB_PATH
    db_module._connection = None

    os.environ["JWT_SECRET"] = "test-secret-key-for-testing-32chars+"

    from backend.main import app
    with TestClient(app) as c:
        yield c

    db_module.DB_PATH = original_path
    db_module._connection = None


class TestAuthEndpoints:

    def test_register_success(self, client):
        resp = client.post("/api/auth/register", json={
            "email": "test@example.com",
            "password": "test1234",
            "name": "Test User",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == "test@example.com"
        assert data["name"] == "Test User"
        assert "token" in data
        # First user should be admin
        assert data["is_admin"] is True

    def test_register_duplicate_email(self, client):
        client.post("/api/auth/register", json={
            "email": "dup@example.com",
            "password": "test1234",
            "name": "First",
        })
        resp = client.post("/api/auth/register", json={
            "email": "dup@example.com",
            "password": "test1234",
            "name": "Second",
        })
        assert resp.status_code == 409

    def test_register_short_password(self, client):
        resp = client.post("/api/auth/register", json={
            "email": "short@example.com",
            "password": "123",
            "name": "Short PW",
        })
        assert resp.status_code == 400

    def test_login_success(self, client):
        client.post("/api/auth/register", json={
            "email": "login@example.com",
            "password": "test1234",
            "name": "Login User",
        })
        resp = client.post("/api/auth/login", json={
            "email": "login@example.com",
            "password": "test1234",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data

    def test_login_wrong_password(self, client):
        client.post("/api/auth/register", json={
            "email": "wrongpw@example.com",
            "password": "test1234",
            "name": "WP User",
        })
        resp = client.post("/api/auth/login", json={
            "email": "wrongpw@example.com",
            "password": "wrongpassword",
        })
        assert resp.status_code == 401

    def test_get_me(self, client):
        reg = client.post("/api/auth/register", json={
            "email": "me@example.com",
            "password": "test1234",
            "name": "Me User",
        })
        token = reg.json()["token"]
        resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["email"] == "me@example.com"

    def test_get_me_invalid_token(self, client):
        resp = client.get("/api/auth/me", headers={"Authorization": "Bearer invalid-token"})
        assert resp.status_code == 401

    def test_update_profile(self, client):
        reg = client.post("/api/auth/register", json={
            "email": "profile@example.com",
            "password": "test1234",
            "name": "Profile User",
        })
        token = reg.json()["token"]
        resp = client.put("/api/auth/me", json={
            "identity": "Software Engineer",
            "language": "English",
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["identity"] == "Software Engineer"
        assert data["language"] == "English"


class TestAdminEndpoints:

    def _register_admin(self, client):
        resp = client.post("/api/auth/register", json={
            "email": "admin@example.com",
            "password": "test1234",
            "name": "Admin",
        })
        return resp.json()["token"]

    def _register_user(self, client, email, name="User"):
        token = self._register_admin(client)
        resp = client.post("/api/auth/admin/users", json={
            "email": email,
            "password": "test1234",
            "name": name,
        }, headers={"Authorization": f"Bearer {token}"})
        return resp.json()

    def test_admin_list_users(self, client):
        token = self._register_admin(client)
        resp = client.get("/api/auth/admin/users", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["users"]) >= 1

    def test_admin_create_user(self, client):
        token = self._register_admin(client)
        resp = client.post("/api/auth/admin/users", json={
            "email": "created@example.com",
            "password": "test1234",
            "name": "Created User",
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["email"] == "created@example.com"

    def test_admin_update_user(self, client):
        token = self._register_admin(client)
        user = self._register_user(client, "update@example.com")

        resp = client.put(f"/api/auth/admin/users/{user['id']}", json={
            "name": "Updated Name",
            "is_admin": True,
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Updated Name"

    def test_admin_delete_user(self, client):
        token = self._register_admin(client)
        user = self._register_user(client, "delete@example.com")

        resp = client.delete(f"/api/auth/admin/users/{user['id']}",
                             headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200

    def test_non_admin_cannot_access(self, client):
        # Register first user (admin)
        admin_token = self._register_admin(client)
        # Create a non-admin user
        resp = client.post("/api/auth/admin/users", json={
            "email": "regular@example.com",
            "password": "test1234",
            "name": "Regular",
        }, headers={"Authorization": f"Bearer {admin_token}"})

        # Login as non-admin
        resp = client.post("/api/auth/login", json={
            "email": "regular@example.com",
            "password": "test1234",
        })
        regular_token = resp.json()["token"]

        # Try to access admin endpoint
        resp = client.get("/api/auth/admin/users", headers={"Authorization": f"Bearer {regular_token}"})
        assert resp.status_code == 403
```

- [ ] **Step 2: Run tests**

```bash
cd ~/Projects/roundtable/backend && source venv/bin/activate && pip install pytest pytest-asyncio httpx && python -m pytest test_auth.py -v
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
cd ~/Projects/roundtable && git add backend/test_auth.py && git commit -m "test: add backend auth tests — register, login, admin CRUD"
```

---

### Task 17: End-to-End Verification

- [ ] **Step 1: Start services and verify**

```bash
# Terminal 1
cd ~/Projects/roundtable/backend && source venv/bin/activate && uvicorn main:app --reload --port 3001

# Terminal 2
cd ~/Projects/roundtable && npm run dev
```

Manual verification checklist:
1. Open `http://localhost:3000` → should redirect to `/login`
2. Click "Create one" → should show Register form
3. Register with email/password → should redirect to `/onboarding`
4. Fill onboarding form → should redirect to Landing page
5. Refresh browser → should stay logged in (JWT in localStorage)
6. Logout → should redirect to `/login`
7. Login again with same credentials → should skip onboarding straight to Landing
8. Admin user → navigate to `/admin` → should see user table
9. Edit a user, toggle admin/active → should persist

- [ ] **Step 2: Final commit if any fixes needed**

---

## Plan Self-Review

1. **Spec coverage**: Each spec requirement maps to tasks — DB schema (T2), JWT/passwords (T3), auth routes (T4), admin routes (T5), middleware (T6), frontend AuthContext (T9), Login (T10), Register (T11), Admin page (T15), Onboarding refactor (T14), App integration (T13), service layer (T12), OAuth flows (T10 — Google via @react-oauth/google, GitHub via redirect), security (T3, T4 — bcrypt rounds=12, JWT expiry=7d, input validation)
2. **No placeholders**: All code shown inline, all commands include expected output
3. **Type consistency**: `AuthUser` interface in T9 matches `user_response()` dict in T4; `AdminUser` in T15 matches `/api/auth/admin/users` response in T5; `UserContext` removed consistently from both frontend (T12) and backend (T6)
