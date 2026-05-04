from __future__ import annotations

import sqlite3
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent
BACKEND_DIR = APP_DIR.parent
DATA_DIR = BACKEND_DIR / "data"
DATASET_DIR = DATA_DIR / "ml-latest-small"
DB_PATH = DATA_DIR / "movielens.db"


def get_connection(require_existing: bool = True) -> sqlite3.Connection:
    if require_existing and not DB_PATH.exists():
        raise FileNotFoundError(
            f"Database not found at {DB_PATH}. Run backend/scripts/init_db.py first."
        )

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def rows_to_dicts(rows: list[sqlite3.Row]) -> list[dict]:
    return [dict(row) for row in rows]
