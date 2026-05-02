# CLAUDE.md — Roundtable (圆桌)

Multi-agent chat/discussion application. React 19 frontend + Python/FastAPI backend + SQLite.

## Project Layout

```
roundtable/
├── index.tsx            # Entry point with router + AuthProvider
├── App.tsx              # Main app (state machine, discussion loop)
├── types.ts             # Shared TypeScript types
├── contexts/            # React context providers
│   └── AuthContext.tsx  # Auth state (JWT, user, login/logout)
├── components/          # React components
│   ├── ChatBubble.tsx       # Chat message bubble
│   ├── InputArea.tsx        # User input with @mention
│   ├── ParticipantCard.tsx  # Guest card (swap, rename)
│   ├── SummaryModal.tsx     # Discussion summary modal
│   ├── OnboardingForm.tsx   # Post-login profile setup
│   ├── LoginPage.tsx        # Login (Google, GitHub, email)
│   ├── RegisterPage.tsx     # Email/password registration
│   ├── HistoryList.tsx      # Past discussions list
│   ├── DiscussionDetail.tsx # View/continue saved discussion
│   └── AdminPage.tsx        # Admin panel (users + all discussions)
├── services/            # Frontend API layer
│   ├── geminiService.ts     # AI turn generation API
│   └── discussionService.ts # Discussion CRUD API
├── lib/                 # Utilities
│   └── router.ts        # Hash router with :param support
├── backend/
│   ├── main.py              # FastAPI server (all endpoints)
│   ├── db.py                # SQLite database (users, discussions, messages)
│   ├── auth_utils.py        # JWT, bcrypt, OAuth verification
│   ├── routes_auth.py       # Auth + admin user endpoints
│   ├── routes_discussions.py # Discussion + admin discussion endpoints
│   ├── test_auth.py         # 13 auth tests
│   ├── test_discussions.py  # 11 discussion tests
│   ├── venv/                # Python virtual env
│   └── .env                 # Backend env vars
├── docs/superpowers/    # Design specs and implementation plans
│   ├── specs/
│   │   ├── 2026-05-02-auth-design.md
│   │   └── 2026-05-02-discussion-history-design.md
│   └── plans/
│       ├── 2026-05-02-auth-implementation.md
│       └── 2026-05-02-discussion-history-plan.md
├── vite.config.ts       # Vite config (port 3000, 0.0.0.0, @ alias)
├── tsconfig.json        # TypeScript config
└── package.json         # Dependencies
```

## Commands

```bash
# Frontend dev server (port 3000)
npm run dev

# Backend (from worktree root, port 3001)
PYTHONPATH=. backend/venv/bin/python -m uvicorn backend.main:app --reload --port 3001 --host 0.0.0.0

# Run backend tests
cd backend && source venv/bin/activate && python -m pytest test_auth.py test_discussions.py -v

# TypeScript check
npx tsc --noEmit
```

## Routes

```
/login              LoginPage (Google, GitHub, email)
/register           RegisterPage (email/password)
/onboarding         OnboardingForm (post-login profile)
/                   Landing → Panel Review → Discussion
/history            Past discussions list
/discussion/:id     View/continue a discussion
/admin              Admin panel (Users + All Discussions tabs)
```

## Frontend Conventions

- **React 19** with function components, hooks
- **TypeScript ~5.8** with bundler module resolution
- **Vite 6** dev server, bound to `0.0.0.0:3000`
- Path alias: `@/*` → project root
- Icons: `lucide-react`
- No CSS framework — Material Design 3 dark theme with CSS variables
- Auth: JWT stored in localStorage, auto-attached to API calls

## Backend Conventions

- **FastAPI** with lifespan-managed httpx client and SQLite connection
- **SQLite + aiosqlite** for persistence (users, discussions, messages)
- **PyJWT** for stateless auth tokens (HS256, 7-day expiry)
- **bcrypt** for password hashing (12 rounds)
- **authlib** for OAuth provider integration
- **MiniMax API** via Anthropic-compatible endpoint for AI generation
- Pydantic v2 models for request validation
- CORS configured from `ALLOWED_ORIGINS` env var

## API Endpoints

### Auth (`/api/auth/*`)
| Method | Path | Auth |
|--------|------|------|
| POST | /register | No |
| POST | /login | No |
| POST | /google | No |
| POST | /github | No |
| GET | /me | JWT |
| PUT | /me | JWT |

### Admin Users (`/api/auth/admin/*`)
| Method | Path | Auth |
|--------|------|------|
| GET | /users | Admin |
| POST | /users | Admin |
| PUT | /users/{id} | Admin |
| DELETE | /users/{id} | Admin |

### Discussions (`/api/discussions/*`)
| Method | Path | Auth |
|--------|------|------|
| POST | / | JWT |
| GET | / | JWT |
| GET | /{id} | JWT |
| POST | /{id}/messages | JWT |
| PUT | /{id} | JWT |
| DELETE | /{id} | JWT |

### Admin Discussions (`/api/admin/discussions/*`)
| Method | Path | Auth |
|--------|------|------|
| GET | / | Admin |
| GET | /{id} | Admin |
| POST | /{id}/messages | Admin |
| PUT | /{id} | Admin |
| DELETE | /{id} | Admin |

### AI Generation (`/api/*`)
| Method | Path | Auth |
|--------|------|------|
| POST | /generate_random_topic | JWT |
| POST | /generate_panel | JWT |
| POST | /generate_single_participant | JWT |
| POST | /predict_next_speaker | JWT |
| POST | /generate_turn | JWT |
| POST | /generate_summary | JWT |

## Key Types (types.ts)

- `Participant`, `Message`, `Summary` — core data models
- `AppState` — 6-stage state machine
- `UserContext` — user profile (derived from AuthContext)

## Env Vars

### Backend (`backend/.env`)
```
ANTHROPIC_API_KEY=sk-xxx
ANTHROPIC_BASE_URL=https://api.minimaxi.com/anthropic/v1
ALLOWED_ORIGINS=http://localhost:3000
JWT_SECRET=<random-32-char-string>
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx
```

### Frontend (`.env`)
```
VITE_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
VITE_GITHUB_CLIENT_ID=xxx
```

## Notes

- Don't commit `.env` files or API keys
- `backend/data/` is gitignored (SQLite database files)
- First registered user is automatically admin
- Admin can ghost into any user's discussion (language/name overrides preserve original context)
- Discussion messages auto-save each turn; summaries auto-save on generation
