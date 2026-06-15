#!/usr/bin/env python3
import os
import sqlite3
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv

load_dotenv()

SQLITE_DB = "shop.db"
DATABASE_URL = os.environ.get("DATABASE_URL")

if not DATABASE_URL:
    print("❌ DATABASE_URL not set")
    exit(1)

def migrate():
    print("🔄 Starting migration...")
    
    # Connect to SQLite
    sqlite_conn = sqlite3.connect(SQLITE_DB)
    sqlite_conn.row_factory = sqlite3.Row
    
    # Connect to PostgreSQL
    pg_conn = psycopg2.connect(DATABASE_URL)
    pg_cursor = pg_conn.cursor()
    
    # Get all tables from SQLite
    cursor = sqlite_conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    tables = [row[0] for row in cursor.fetchall()]
    
    print(f"Found tables: {', '.join(tables)}")
    
    # Migrate each table
    for table in tables:
        print(f"\n→ Migrating {table}...")
        
        # Get column names
        cursor.execute(f"PRAGMA table_info({table})")
        columns = [col[1] for col in cursor.fetchall()]
        columns_str = ', '.join([f'"{col}"' for col in columns])
        placeholders = ', '.join(['%s'] * len(columns))
        
        # Read data from SQLite
        cursor.execute(f'SELECT {", ".join(columns)} FROM "{table}"')
        rows = cursor.fetchall()
        
        if rows:
            # Insert into PostgreSQL
            insert_query = f'INSERT INTO "{table}" ({columns_str}) VALUES ({placeholders}) ON CONFLICT DO NOTHING'
            data = [tuple(row) for row in rows]
            execute_values(pg_cursor, insert_query, data, page_size=100)
            pg_conn.commit()
            print(f"  ✅ Migrated {len(rows)} rows")
        else:
            print(f"  ℹ No data")
    
    sqlite_conn.close()
    pg_conn.close()
    print("\n✅ Migration complete!")

if __name__ == "__main__":
    migrate()
