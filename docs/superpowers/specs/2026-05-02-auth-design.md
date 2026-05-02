# Auth System Design — Roundtable (圆桌)

Date: 2026-05-02
Status: Approved

## Overview

Add complete authentication to the Roundtable app:
- Google OAuth login
- GitHub OAuth login
- Email/password registration and login
- Admin panel (same app, `/admin` route) for user management

## Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Database | SQLite + aiosqlite | Zero-config, self-contained, matches project simplicity |
| Session | JWT (HS256) | Stateless, no server-side session storage |
| Admin | Same app + `is_admin` flag | Simple, no separate deploy |
| Auth flow | Login first → onboarding → landing | Returning users skip onboarding |
| Router | Minimal hash router (hand-written) | Avoid react-router overhead |
| OAuth frontend | Popup or redirect, frontend callback | No backend OAuth redirect flow needed |

## Architecture

```
Frontend (React 19, :3000)
  ├─ AuthProvider (Context): user, token, login/logout
  ├─ Minimal hash router
  ├─ /login      LoginPage (OAuth + email/password)
  ├─ /register   RegisterPage
  ├─ /onboarding OnboardingForm (auth-gated)
  ├─ /admin      AdminPage (admin-gated)
  └─ /           Existing App.tsx (auth-gated)

Backend (FastAPI, :3001)
  ├─ POST /api/auth/register
  ├─ POST /api/auth/login
  ├─ POST /api/auth/google
  ├─ POST /api/auth/github
  ├─ GET  /api/auth/me
  ├─ PUT  /api/auth/me
  ├─ GET  /api/admin/users        (admin only)
  ├─ PUT  /api/admin/users/{id}   (admin only)
  ├─ DELETE /api/admin/users/{id} (admin only)
  └─ Existing /api/* endpoints (auth-gated, user context from DB)
```

## Data Model

```sql
CREATE TABLE users (
    id            TEXT PRIMARY KEY,
    email         TEXT UNIQUE,
    password_hash TEXT,
    name          TEXT NOT NULL,
    avatar_url    TEXT,
    identity      TEXT DEFAULT '',
    language      TEXT DEFAULT 'Chinese',
    auth_provider TEXT DEFAULT 'email',  -- 'email' | 'google' | 'github'
    provider_id   TEXT,
    is_admin      INTEGER DEFAULT 0,
    is_active     INTEGER DEFAULT 1,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

- `password_hash` is NULL for OAuth-only accounts (password login disabled)
- OAuth users matched by `auth_provider + provider_id`
- First user to register is automatically set as admin (`is_admin = 1` when users table is empty). Subsequent admins are managed via the admin panel.
- `is_active = 0` implements soft-delete. Inactive users cannot log in, but their discussion history and data are preserved.

## Backend Middleware

```
Request pipeline:
  /api/auth/*       → no auth required
  /api/admin/*      → JWT validation → is_admin check
  /api/* (existing) → JWT validation → user context from DB
```

- `get_current_user`: FastAPI dependency, extracts Bearer token, decodes JWT, returns user dict
- `require_admin`: extends `get_current_user`, checks `is_admin` flag, returns 403 if not
- Existing API endpoints get user context from DB instead of request body; `UserContext` field in request models becomes optional

## Libraries (Backend)

| Package | Purpose |
|---|---|
| `aiosqlite` | Async SQLite access |
| `PyJWT` | JWT encode/decode |
| `bcrypt` | Password hashing (4.0+) |
| `authlib` | OAuth provider integration |

## OAuth Flows

### Google

1. Frontend: user clicks "Sign in with Google" → `@react-oauth/google` CredentialResponse
2. Frontend: POST `/api/auth/google` with `{credential}` (Google JWT)
3. Backend: verify Google JWT with Google public keys → extract email/name/picture → find or create user → return app JWT

### GitHub

1. Frontend: redirect to `https://github.com/login/oauth/authorize?client_id=...`
2. GitHub redirects back to frontend `/login?code=xxx`
3. Frontend: POST `/api/auth/github` with `{code}`
4. Backend: exchange code for access_token → fetch user info from GitHub API → find or create user → return app JWT

### OAuth Account Merging

If a user logs in via Google/GitHub and an account with matching email already exists, link the OAuth provider to the existing account (set `auth_provider` + `provider_id`) instead of creating a duplicate.

## Frontend Components

### New Files

| File | Purpose |
|---|---|
| `components/LoginPage.tsx` | Login form: email/password fields, Google button, GitHub button, link to register |
| `components/RegisterPage.tsx` | Register form: name, email, password, confirm password |
| `components/AdminPage.tsx` | User table with search, edit modal, add modal |
| `contexts/AuthContext.tsx` | AuthProvider + useAuth hook |
| `lib/router.ts` | Minimal hash-based router (~30 lines) |

### Modified Files

| File | Change |
|---|---|
| `App.tsx` | Wrap in AuthProvider; remove UserContext state → read from AuthContext; add auth gate |
| `index.tsx` | Add router, route definitions |
| `services/geminiService.ts` | `apiCall` auto-attaches Authorization header |
| `backend/main.py` | Add auth/admin routes, DB init, middleware; remove UserContext from request models |

## Admin Page Features

- User table: name, email, auth_provider, is_admin badge, is_active status, created_at
- Search/filter by name or email
- Edit modal: toggle is_admin, is_active, edit name
- Delete = soft delete (set is_active=0)
- Add user modal (create email/password account manually)

## Integration with Existing Flow

Existing flow: ONBOARDING → LANDING → GENERATING_PANEL → PANEL_REVIEW → DISCUSSION → SUMMARY

New flow:
- App loads → AuthProvider checks stored JWT → valid? → redirect based on profile completeness
  - No token: redirect to `/login`
  - Has token, no identity set: redirect to `/onboarding`
  - Has token, identity set: redirect to `/` (Landing)
- OnboardingForm saves `identity` and `language` via `PUT /api/auth/me` instead of local state
- All existing API calls no longer send `userContext` — backend reads from DB

## Security Considerations

- JWT secret stored in `backend/.env` (JWT_SECRET), minimum 32 chars
- Passwords hashed with bcrypt cost factor 12
- Admin-only endpoints protected by `require_admin` dependency
- Input validation: email format, password min 8 chars, name max 100 chars
- JWT expiry: 7 days (configurable)
- OAuth state parameter for CSRF protection (GitHub flow)

## Testing Strategy

- Backend: pytest with aiosqlite in-memory database, test each auth endpoint
- Frontend: manual testing (login, register, OAuth flows, admin CRUD)
- Test coverage targets: auth endpoints (register, login, me, OAuth), admin endpoints (CRUD), middleware (unauthorized, forbidden)
