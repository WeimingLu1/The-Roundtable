import os
import asyncio
import uuid
import json
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


# --- Discussion CRUD ---

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
