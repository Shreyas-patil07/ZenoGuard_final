"""Apply incremental schema changes for an existing PostgreSQL ZenoGuard database."""

from sqlalchemy import inspect, text

from app.database import Base, engine
from app import models  # noqa: F401 - registers all ORM models with Base


COLUMN_MIGRATIONS = {
    "riders": {
        "phone": "TEXT",
        "razorpay_contact_id": "TEXT",
        "razorpay_fund_account_id": "TEXT",
    },
    "policies": {
        "blockchain_policy_id": "INTEGER",
        "purchase_tx_hash": "TEXT",
        "blockchain_status": "TEXT DEFAULT 'NOT_LINKED'",
    },
    "claims": {
        "blockchain_claim_id": "INTEGER",
        "submit_tx_hash": "TEXT",
        "payout_tx_hash": "TEXT",
        "blockchain_status": "TEXT DEFAULT 'NOT_LINKED'",
    },
    "payouts": {
        "status": "TEXT NOT NULL DEFAULT 'PENDING'",
    },
}


def migrate() -> None:
    if engine.dialect.name != "postgresql":
        raise RuntimeError(
            f"Expected PostgreSQL, but SQLAlchemy detected '{engine.dialect.name}'. "
            "Use migrate_razorpay.py only for legacy SQLite databases."
        )

    # Create tables that do not exist yet. This does not alter existing tables.
    Base.metadata.create_all(bind=engine)

    inspector = inspect(engine)

    with engine.begin() as connection:
        for table_name, columns in COLUMN_MIGRATIONS.items():
            if not inspector.has_table(table_name):
                raise RuntimeError(
                    f"Required table '{table_name}' does not exist after create_all()."
                )

            existing = {column["name"] for column in inspector.get_columns(table_name)}

            for column_name, definition in columns.items():
                if column_name in existing:
                    continue

                connection.execute(
                    text(
                        f'ALTER TABLE "{table_name}" '
                        f'ADD COLUMN "{column_name}" {definition}'
                    )
                )
                print(f"Added {table_name}.{column_name}")

    print("PostgreSQL Razorpay/blockchain migration complete.")


if __name__ == "__main__":
    migrate()
