import os
import sqlite3


def migrate_sqlite():
    database_url = os.getenv("DATABASE_URL", "sqlite:///./zenguard.db")
    if not database_url.startswith("sqlite"):
        print("Non-SQLite DATABASE_URL detected; use Alembic for the existing database.")
        return

    path = database_url.replace("sqlite:///", "", 1)
    connection = sqlite3.connect(path)
    try:
        cursor = connection.cursor()
        rider_columns = {row[1] for row in cursor.execute("PRAGMA table_info(riders)")}
        for name, sql_type in [
            ("phone", "TEXT"),
            ("razorpay_contact_id", "TEXT"),
            ("razorpay_fund_account_id", "TEXT"),
        ]:
            if name not in rider_columns:
                cursor.execute(f"ALTER TABLE riders ADD COLUMN {name} {sql_type}")

        tables = {row[0] for row in cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if "payments" not in tables:
            cursor.execute(
                """CREATE TABLE payments (
                    id INTEGER PRIMARY KEY,
                    rider_id INTEGER NOT NULL,
                    policy_id INTEGER,
                    payment_type TEXT NOT NULL,
                    amount_inr REAL NOT NULL,
                    status TEXT NOT NULL DEFAULT 'CREATED',
                    razorpay_order_id TEXT UNIQUE,
                    razorpay_payment_id TEXT UNIQUE,
                    razorpay_payout_id TEXT UNIQUE,
                    upi_id TEXT,
                    webhook_event_id TEXT UNIQUE,
                    failure_reason TEXT,
                    created_at DATETIME NOT NULL,
                    updated_at DATETIME NOT NULL,
                    FOREIGN KEY(rider_id) REFERENCES riders(id),
                    FOREIGN KEY(policy_id) REFERENCES policies(id)
                )"""
            )

        if "payouts" in tables:
            payout_columns = {row[1] for row in cursor.execute("PRAGMA table_info(payouts)")}
            if "status" not in payout_columns:
                cursor.execute("ALTER TABLE payouts ADD COLUMN status TEXT NOT NULL DEFAULT 'PENDING'")

        connection.commit()
        print("Razorpay SQLite migration complete.")
    finally:
        connection.close()


if __name__ == "__main__":
    migrate_sqlite()
