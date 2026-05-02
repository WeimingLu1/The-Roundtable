import os
import asyncio
import uuid
import aiosqlite

DB_PATH = os.path.join(os.path.dirname(__file__), "data", "roundtable.db")

_connection: aiosqlite.Connection | None = None
_lock = asyncio.Lock()


async def get_connection() -> aiosqlite.Connection:
    global _connection
    if _connection is None:
        async with _lock:
            if _connection is None:
                if DB_PATH != ":memory:":
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

    await db.execute(
        """INSERT INTO users (id, email, password_hash, name, avatar_url, auth_provider, provider_id, is_admin, language)
           SELECT ?, ?, ?, ?, ?, ?, ?, CASE WHEN (SELECT COUNT(*) FROM users) = 0 THEN 1 ELSE 0 END, ?""",
        (user_id, email.lower() if email else None, password_hash, name, avatar_url,
         auth_provider, provider_id, language)
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
    cursor = await db.execute(
        "UPDATE users SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (user_id,)
    )
    await db.commit()
    return cursor.rowcount > 0


async def count_users() -> int:
    db = await get_connection()
    async with db.execute("SELECT COUNT(*) as count FROM users") as cursor:
        row = await cursor.fetchone()
        return row["count"]
