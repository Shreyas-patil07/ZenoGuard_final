"""Add blockchain synchronization columns to an existing ZenoGuard database.

Run once from the backend directory after pulling the new models:
    python scripts/migrate_blockchain_sync.py

This is intentionally a small SQLite/PostgreSQL-compatible migration for the
prototype. New installations do not need it because SQLAlchemy creates the
columns from the models.
"""

import os
import sqlite3
from pathlib import Path


def sqlite_migrate(db_path: str) -> None:
    conn = sqlite3.connect(db_path)
    try:
        tables = {
            row[0]
            for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
        }
        if "policies" in tables:
            columns = {row[1] for row in conn.execute("PRAGMA table_info(policies)")}
            additions = {
                "blockchain_policy_id": "INTEGER",
                "purchase_tx_hash": "TEXT",
                "blockchain_status": "TEXT DEFAULT 'NOT_LINKED'",
            }
            for name, definition in additions.items():
                if name not in columns:
                    conn.execute(f"ALTER TABLE policies ADD COLUMN {name} {definition}")

        if "claims" in tables:
            columns = {row[1] for row in conn.execute("PRAGMA table_info(claims)")}
            additions = {
                "blockchain_claim_id": "INTEGER",
                "submit_tx_hash": "TEXT",
                "payout_tx_hash": "TEXT",
                "blockchain_status": "TEXT DEFAULT 'NOT_LINKED'",
            }
            for name, definition in additions.items():
                if name not in columns:
                    conn.execute(f"ALTER TABLE claims ADD COLUMN {name} {definition}")

        conn.commit()
    finally:
        conn.close()


def main() -> None:
    database_url = os.getenv("DATABASE_URL", "sqlite:///./zenguard.db")
    if not database_url.startswith("sqlite"):
        raise SystemExit(
            "This helper handles the local SQLite database only. "
            "Use your PostgreSQL migration tool for a deployed database."
        )

    raw_path = database_url.replace("sqlite:///", "", 1)
    db_path = Path(raw_path)
    if not db_path.is_absolute():
        db_path = Path(__file__).resolve().parents[1] / db_path

    if not db_path.exists():
        raise SystemExit(f"Database not found: {db_path}")

    sqlite_migrate(str(db_path))
    print(f"Blockchain synchronization columns migrated: {db_path}")


if __name__ == "__main__":
    main()
