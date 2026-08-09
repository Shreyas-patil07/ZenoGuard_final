"""Apply incremental schema changes for an existing PostgreSQL ZenoGuard database."""

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import inspect, text
from app import models  # noqa: F401
from app.database import Base, engine

COLUMN_MIGRATIONS = {
    "riders": {"phone": "TEXT", "razorpay_contact_id": "TEXT", "razorpay_fund_account_id": "TEXT"},
    "policies": {"blockchain_policy_id": "INTEGER", "purchase_tx_hash": "TEXT", "blockchain_status": "TEXT DEFAULT 'NOT_LINKED'"},
    "claims": {"blockchain_claim_id": "INTEGER", "submit_tx_hash": "TEXT", "payout_tx_hash": "TEXT", "blockchain_status": "TEXT DEFAULT 'NOT_LINKED'"},
    "payouts": {"status": "TEXT NOT NULL DEFAULT 'PENDING'"},
    "rider_profiles": {
        "ai_document_status": "TEXT DEFAULT 'pending'",
        "ai_document_confidence": "DOUBLE PRECISION",
        "ai_document_type": "TEXT",
        "ai_extracted_name": "TEXT",
        "ai_extracted_dob": "TEXT",
        "ai_extracted_id_number": "TEXT",
        "ai_verification_note": "TEXT",
        "secondary_id_type": "TEXT",
        "secondary_id_number": "TEXT",
        "secondary_id_document_url": "TEXT",
        "secondary_ai_document_status": "TEXT DEFAULT 'pending'",
        "secondary_ai_document_confidence": "DOUBLE PRECISION",
        "secondary_ai_document_type": "TEXT",
        "secondary_ai_extracted_name": "TEXT",
        "secondary_ai_extracted_id_number": "TEXT",
        "secondary_ai_verification_note": "TEXT",
    },
}


def migrate() -> None:
    if engine.dialect.name != "postgresql":
        raise RuntimeError(f"Expected PostgreSQL, but SQLAlchemy detected '{engine.dialect.name}'.")
    Base.metadata.create_all(bind=engine)
    inspector = inspect(engine)
    with engine.begin() as connection:
        for table_name, columns in COLUMN_MIGRATIONS.items():
            if not inspector.has_table(table_name):
                raise RuntimeError(f"Required table '{table_name}' does not exist after create_all().")
            existing = {column["name"] for column in inspector.get_columns(table_name)}
            for column_name, definition in columns.items():
                if column_name in existing:
                    continue
                connection.execute(text(f'ALTER TABLE "{table_name}" ADD COLUMN "{column_name}" {definition}'))
                print(f"Added {table_name}.{column_name}")
    print("PostgreSQL incremental migration complete.")


if __name__ == "__main__":
    migrate()
