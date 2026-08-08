from app.database import SessionLocal, engine
from app.models import Rider
from sqlalchemy import text

def test_connection():
    try:
        db = SessionLocal()
        # Test basic connection
        db.execute(text("SELECT 1"))
        print("✅ Database connection successful!")
        
        # Test if tables exist
        riders = db.query(Rider).limit(1).all()
        print("✅ Tables are present and accessible!")
        
    except Exception as e:
        print("❌ Database connection failed!")
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    test_connection()
