import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "roundtable.db"


def get_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS debates (
            id TEXT PRIMARY KEY,
            topic TEXT NOT NULL,
            participants TEXT NOT NULL,
            messages TEXT NOT NULL DEFAULT '[]',
            status TEXT NOT NULL DEFAULT 'pending',
            created_at INTEGER NOT NULL
        )
    """)
    conn.commit()
    conn.close()
