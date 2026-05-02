from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field
from backend.db import get_user_by_email, get_user_by_provider, create_user, update_user, get_user_by_id, list_users, delete_user
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


class AdminUpdateUserRequest(BaseModel):
    name: str | None = None
    is_admin: bool | None = None
    is_active: bool | None = None


class AdminCreateUserRequest(BaseModel):
    email: str
    password: str = Field(min_length=8)
    name: str


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


# --- Auth Endpoints ---

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
    if not user.get("is_active"):
        raise HTTPException(status_code=401, detail="Account is deactivated")
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

    if not user.get("is_active"):
        raise HTTPException(status_code=401, detail="Account is deactivated")

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

    if not user.get("is_active"):
        raise HTTPException(status_code=401, detail="Account is deactivated")

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


# --- Admin: user management (requires admin) ---

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
    # Check user exists (including inactive)
    from backend.db import get_connection
    db = await get_connection()
    async with db.execute("SELECT * FROM users WHERE id = ?", (user_id,)) as cursor:
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User not found")

    updates = {}
    if req.name is not None:
        updates["name"] = req.name
    if req.is_admin is not None:
        updates["is_admin"] = 1 if req.is_admin else 0
    if req.is_active is not None:
        updates["is_active"] = 1 if req.is_active else 0

    # Allow admin fields + identity/language
    allowed = {"name", "is_admin", "is_active"}
    updates = {k: v for k, v in updates.items() if k in allowed}

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
