import hashlib
import hmac
import json
import mimetypes
import os
import re
import secrets
import shutil
import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2.pool import SimpleConnectionPool
from datetime import datetime, timezone, timedelta
from http import cookies
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import unquote, urlparse, parse_qs
from contextlib import contextmanager
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

ROOT = Path(__file__).parent.resolve()

# Use the uploads folder in the project root
UPLOAD_DIR = ROOT / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# For compatibility, also ensure shop directory exists for default images
SHOP_DIR = ROOT / "shop"
SHOP_DIR.mkdir(parents=True, exist_ok=True)

DATA_DIR = Path(os.environ.get("DATA_DIR", str(ROOT)))
DATA_DIR.mkdir(parents=True, exist_ok=True)

logger.info(f"ROOT path: {ROOT}")
logger.info(f"UPLOAD_DIR path: {UPLOAD_DIR}")
logger.info(f"SHOP_DIR path: {SHOP_DIR}")
logger.info(f"Upload directory exists: {UPLOAD_DIR.exists()}")

# PostgreSQL connection
DATABASE_URL = os.environ.get("DATABASE_URL")
USE_POSTGRES = DATABASE_URL is not None

if USE_POSTGRES:
    pool = SimpleConnectionPool(minconn=1, maxconn=10, dsn=DATABASE_URL)
else:
    import sqlite3
    DB_PATH = DATA_DIR / "shop.db"

STATIC_CACHE = {}
CACHE_TTL = 3600

# ============================================
# NO DEFAULT PRODUCTS - Empty list
# ============================================
DEFAULT_PRODUCTS = []  # Empty - no default products

# NO DEFAULT REPAIR SERVICES - Empty list
DEFAULT_REPAIR_SERVICES = []  # Empty - no default repair services

DEFAULT_REPAIR_CATEGORIES = [
    ("cat-screen", "Screen replacement", "screen-replacement"),
    ("cat-battery", "Battery replacement", "battery-replacement"),
    ("cat-port", "Charging port repair", "charging-port-repair"),
    ("cat-camera", "Camera repair", "camera-repair"),
    ("cat-speaker", "Speaker repair", "speaker-repair"),
    ("cat-microphone", "Microphone repair", "microphone-repair"),
    ("cat-software", "Software / OS issues", "software-os-issues"),
    ("cat-water", "Water damage repair", "water-damage-repair"),
    ("cat-motherboard", "Motherboard repair", "motherboard-repair"),
    ("cat-backglass", "Back glass replacement", "back-glass-replacement"),
]

DEFAULT_DEVICE_MODELS = {
    "Samsung": ["Galaxy S23","Galaxy S23 Ultra","Galaxy S22","Galaxy S21","Galaxy A53","Galaxy Note 20"],
    "Apple": ["iPhone 14","iPhone 14 Pro","iPhone 13","iPhone 12","iPhone SE"],
    "Xiaomi": ["Redmi Note 12","Mi 11","Poco X5","Redmi 10"],
    "Oppo": ["Reno8","Find X5","A57"],
    "Huawei": ["P50","Mate 40","Y9a"],
    "Tecno": ["Spark 10","Camon 19","Phantom X"],
    "Infinix": ["Note 12","Zero 5G","Hot 12"],
}

DEFAULT_COUNTIES = [
    "Baringo","Bomet","Bungoma","Busia","Elgeyo-Marakwet","Embu","Garissa","Homa Bay",
    "Isiolo","Kajiado","Kakamega","Kericho","Kiambu","Kilifi","Kirinyaga","Kisii",
    "Kisumu","Kitui","Kwale","Laikipia","Lamu","Machakos","Makueni","Mandera",
    "Marsabit","Meru","Migori","Mombasa","Murang'a","Nairobi","Nakuru","Nandi",
    "Narok","Nyamira","Nyandarua","Nyeri","Samburu","Siaya","Taita-Taveta","Tana River",
    "Tharaka-Nithi","Trans Nzoia","Turkana","Uasin Gishu","Vihiga","Wajir","West Pokot",
]

KENYA_COUNTY_AREAS = {
    "Baringo": {
        "constituencies": ["Tiaty", "Baringo North", "Baringo Central", "Baringo South", "Mogotio", "Eldama Ravine"],
        "locations": ["Kabarnet", "Kabartonjo", "Marigat", "Mogotio Town", "Eldama Ravine Town", "Chemolingot", "Tenges"],
    },
    "Bomet": {
        "constituencies": ["Sotik", "Chepalungu", "Bomet East", "Bomet Central", "Konoin"],
        "locations": ["Bomet Town", "Sotik Town", "Longisa", "Mulot", "Silibwet", "Chebunyo", "Mogogosiek"],
    },
    "Bungoma": {
        "constituencies": ["Mt Elgon", "Sirisia", "Kabuchai", "Bumula", "Kanduyi", "Webuye East", "Webuye West", "Kimilili", "Tongaren"],
        "locations": ["Bungoma Town", "Webuye", "Kimilili", "Chwele", "Sirisia", "Malakisi", "Mayanja"],
    },
    "Busia": {
        "constituencies": ["Teso North", "Teso South", "Nambale", "Matayos", "Butula", "Funyula", "Budalangi"],
        "locations": ["Busia Town", "Malaba", "Nambale", "Port Victoria", "Bumala", "Funyula", "Butula"],
    },
    "Nairobi": {
        "constituencies": ["Westlands", "Dagoretti North", "Dagoretti South", "Lang'ata", "Kibra", "Roysambu", "Kasarani", "Ruaraka", "Embakasi South", "Embakasi North", "Embakasi Central", "Embakasi East", "Embakasi West", "Makadara", "Kamukunji", "Starehe", "Mathare"],
        "locations": ["Parklands", "Kilimani", "Kileleshwa", "Lavington", "Karen", "South B", "South C", "Buruburu", "Eastleigh", "Pangani", "Umoja", "Donholm", "Kayole", "Pipeline", "Dandora", "Kariobangi", "Githurai 44", "CBD", "Upper Hill", "Industrial Area"],
    },
    "Nakuru": {
        "constituencies": ["Molo", "Njoro", "Naivasha", "Gilgil", "Kuresoi South", "Kuresoi North", "Subukia", "Rongai", "Bahati", "Nakuru West", "Nakuru East"],
        "locations": ["Bondeni", "Kivumbini", "Flamingo", "Menengai", "Free Area", "Kaptembwo", "Rhonda", "Shabab", "London", "Kapkures", "Mai Mahiu", "Karagita", "Lake View", "Olkaria", "Hells Gate", "Elburgon", "Mariashoni", "Turi", "Molo Town", "Mau Narok", "Mauche", "Nessuit", "Lare", "Solai", "Soin", "Mosop", "Visoi"],
    },
}

DEFAULT_SPARE_PARTS = []  # Empty - no default spare parts

REPAIR_STATUSES = [
    ("Pending", 10),
    ("Received", 20),
    ("Diagnosing", 30),
    ("Repairing", 40),
    ("Completed", 50),
    ("Ready for pickup", 60),
]

# Transparent 1x1 GIF placeholder
TRANSPARENT_GIF = b'GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;'

@contextmanager
def db():
    conn = None
    try:
        if USE_POSTGRES:
            conn = pool.getconn()
            conn.cursor_factory = RealDictCursor
            yield conn
        else:
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA foreign_keys = ON")
            conn.execute("PRAGMA journal_mode = WAL")
            yield conn
    finally:
        if conn:
            if USE_POSTGRES:
                pool.putconn(conn)
            else:
                conn.close()

def county_id_for(name):
    return "c-" + name.lower().replace(" ", "-").replace("'", "")

def slug_id(value):
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")

def clean_area_name(value):
    return " ".join(str(value).strip().strip(".").split())

def seed_county_locations(conn, now):
    cursor = conn.cursor()
    county_ids = {}
    for county_name in DEFAULT_COUNTIES:
        default_cid = county_id_for(county_name)
        
        if USE_POSTGRES:
            cursor.execute("INSERT INTO counties (id, name) VALUES (%s, %s) ON CONFLICT (id) DO NOTHING", (default_cid, county_name))
        else:
            cursor.execute("INSERT OR IGNORE INTO counties (id, name) VALUES (?,?)", (default_cid, county_name))
        
        cursor.execute("SELECT id FROM counties WHERE name = %s" if USE_POSTGRES else "SELECT id FROM counties WHERE name = ?", (county_name,))
        row = cursor.fetchone()
        cid = row["id"] if row else default_cid
        county_ids[county_name] = cid
        zid = f"z-{cid}"
        drid = f"dr-{cid}"
        
        if USE_POSTGRES:
            cursor.execute("INSERT INTO delivery_zones (id, name, description) VALUES (%s, %s, %s) ON CONFLICT (id) DO NOTHING", (zid, f"{county_name} Zone", f"Default delivery zone for {county_name} County"))
            cursor.execute("INSERT INTO delivery_rates (id, delivery_zone_id, base_fee, weight_multiplier, distance_multiplier, created_at) VALUES (%s, %s, %s, %s, %s, %s) ON CONFLICT (id) DO NOTHING", (drid, zid, 650, 0.5, 0.0, now))
        else:
            cursor.execute("INSERT OR IGNORE INTO delivery_zones (id, name, description) VALUES (?,?,?)", (zid, f"{county_name} Zone", f"Default delivery zone for {county_name} County"))
            cursor.execute("INSERT OR IGNORE INTO delivery_rates (id, delivery_zone_id, base_fee, weight_multiplier, distance_multiplier, created_at) VALUES (?,?,?,?,?,?)", (drid, zid, 650, 0.5, 0.0, now))
        
        if cid != default_cid:
            cursor.execute("UPDATE sub_locations SET county_id = %s, delivery_zone_id = %s WHERE county_id = %s" if USE_POSTGRES else "UPDATE sub_locations SET county_id = ?, delivery_zone_id = ? WHERE county_id = ?", (cid, zid, default_cid))
    
    for county_name, groups in KENYA_COUNTY_AREAS.items():
        cid = county_ids.get(county_name, county_id_for(county_name))
        zid = f"z-{cid}"
        cursor.execute("SELECT name FROM sub_locations WHERE county_id = %s" if USE_POSTGRES else "SELECT name FROM sub_locations WHERE county_id = ?", (cid,))
        existing = {clean_area_name(row["name"]).lower() for row in cursor.fetchall()}
        area_names = [*groups.get("constituencies", []), *groups.get("locations", [])]
        for raw_name in area_names:
            name = clean_area_name(raw_name)
            if not name:
                continue
            key = name.lower()
            if key in existing:
                continue
            sid = f"sl-{cid}-{slug_id(name)}"
            if USE_POSTGRES:
                cursor.execute("INSERT INTO sub_locations (id, county_id, name, delivery_zone_id) VALUES (%s, %s, %s, %s) ON CONFLICT (id) DO NOTHING", (sid, cid, name, zid))
            else:
                cursor.execute("INSERT OR IGNORE INTO sub_locations (id, county_id, name, delivery_zone_id) VALUES (?,?,?,?)", (sid, cid, name, zid))
            existing.add(key)
    conn.commit()

def hash_password(password, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260000)
    return f"pbkdf2_sha256${salt}${digest.hex()}"

def verify_password(password, stored):
    try:
        _, salt, digest = stored.split("$", 2)
    except ValueError:
        return False
    return hmac.compare_digest(hash_password(password, salt), stored)

def init_db():
    with db() as conn:
        cursor = conn.cursor()
        
        if USE_POSTGRES:
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              email TEXT NOT NULL UNIQUE,
              password_hash TEXT NOT NULL,
              role TEXT NOT NULL CHECK(role IN ('customer','staff','admin')),
              created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS sessions (
              sid TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS products (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              cat TEXT NOT NULL,
              price REAL NOT NULL,
              was REAL,
              rating REAL DEFAULT 4.6,
              reviews INTEGER DEFAULT 0,
              badge TEXT DEFAULT '',
              img TEXT NOT NULL,
              "desc" TEXT NOT NULL,
              in_stock INTEGER NOT NULL DEFAULT 1,
              created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS orders (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              total REAL NOT NULL,
              delivery_fee REAL DEFAULT 0,
              deposit_amount REAL DEFAULT 0,
              remaining_amount REAL DEFAULT 0,
              payment_status TEXT DEFAULT 'Pending',
              county TEXT,
              constituency TEXT,
              street TEXT,
              deposit_mpesa TEXT,
              status TEXT NOT NULL DEFAULT 'Placed',
              created_at TEXT NOT NULL,
              delivery_fee_set INTEGER DEFAULT 0,
              delivery_date TEXT,
              FOREIGN KEY(user_id) REFERENCES users(id)
            );
            CREATE TABLE IF NOT EXISTS order_items (
              id SERIAL PRIMARY KEY,
              order_id TEXT NOT NULL,
              product_id TEXT NOT NULL,
              name TEXT NOT NULL,
              price REAL NOT NULL,
              qty INTEGER NOT NULL,
              img TEXT,
              FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
              FOREIGN KEY(product_id) REFERENCES products(id)
            );
            CREATE TABLE IF NOT EXISTS repair_categories (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              slug TEXT UNIQUE NOT NULL,
              created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS repair_services (
              id TEXT PRIMARY KEY,
              title TEXT NOT NULL,
              brand TEXT NOT NULL,
              repair_type TEXT NOT NULL,
              price REAL NOT NULL,
              duration TEXT NOT NULL,
              warranty TEXT NOT NULL,
              image TEXT NOT NULL,
              "description" TEXT NOT NULL,
              available INTEGER NOT NULL DEFAULT 1,
              category_id TEXT,
              created_at TEXT NOT NULL,
              FOREIGN KEY(category_id) REFERENCES repair_categories(id)
            );
            CREATE TABLE IF NOT EXISTS repair_statuses (
              status TEXT PRIMARY KEY,
              sequence INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS repair_technicians (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              email TEXT NOT NULL UNIQUE,
              created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS repair_bookings (
              id TEXT PRIMARY KEY,
              user_id TEXT,
              name TEXT NOT NULL,
              email TEXT NOT NULL,
              phone TEXT NOT NULL,
              brand TEXT NOT NULL,
              model TEXT NOT NULL,
              repair_service_id TEXT,
              repair_type TEXT NOT NULL,
              "description" TEXT NOT NULL,
              image_path TEXT,
              pickup_dropoff TEXT NOT NULL,
              preferred_at TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'Pending',
              technician_id TEXT,
              technician_notes TEXT,
              created_at TEXT NOT NULL,
              FOREIGN KEY(user_id) REFERENCES users(id),
              FOREIGN KEY(repair_service_id) REFERENCES repair_services(id),
              FOREIGN KEY(technician_id) REFERENCES repair_technicians(id),
              FOREIGN KEY(status) REFERENCES repair_statuses(status)
            );
            CREATE TABLE IF NOT EXISTS repair_notifications (
              id TEXT PRIMARY KEY,
              booking_id TEXT NOT NULL,
              message TEXT NOT NULL,
              is_read INTEGER NOT NULL DEFAULT 0,
              created_at TEXT NOT NULL,
              FOREIGN KEY(booking_id) REFERENCES repair_bookings(id)
            );
            CREATE TABLE IF NOT EXISTS device_models (
              id TEXT PRIMARY KEY,
              brand TEXT NOT NULL,
              model TEXT NOT NULL,
              created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS spare_parts (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              brand TEXT NOT NULL,
              category TEXT NOT NULL,
              price REAL NOT NULL,
              stock INTEGER NOT NULL DEFAULT 1,
              image_path TEXT,
              "description" TEXT,
              created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS counties (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL UNIQUE
            );
            CREATE TABLE IF NOT EXISTS delivery_zones (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              description TEXT
            );
            CREATE TABLE IF NOT EXISTS sub_locations (
              id TEXT PRIMARY KEY,
              county_id TEXT NOT NULL,
              name TEXT NOT NULL,
              delivery_zone_id TEXT NOT NULL,
              FOREIGN KEY(county_id) REFERENCES counties(id),
              FOREIGN KEY(delivery_zone_id) REFERENCES delivery_zones(id)
            );
            CREATE TABLE IF NOT EXISTS delivery_rates (
              id TEXT PRIMARY KEY,
              delivery_zone_id TEXT NOT NULL UNIQUE,
              base_fee REAL NOT NULL,
              weight_multiplier REAL DEFAULT 0,
              distance_multiplier REAL DEFAULT 0,
              created_at TEXT NOT NULL,
              FOREIGN KEY(delivery_zone_id) REFERENCES delivery_zones(id)
            );
            CREATE TABLE IF NOT EXISTS payments (
              id TEXT PRIMARY KEY,
              order_id TEXT,
              checkout_request_id TEXT,
              phone TEXT,
              amount REAL,
              status TEXT,
              created_at TEXT NOT NULL,
              FOREIGN KEY(order_id) REFERENCES orders(id)
            );
            CREATE TABLE IF NOT EXISTS order_notifications (
              id TEXT PRIMARY KEY,
              order_id TEXT NOT NULL,
              message TEXT NOT NULL,
              is_read INTEGER NOT NULL DEFAULT 0,
              created_at TEXT NOT NULL,
              FOREIGN KEY(order_id) REFERENCES orders(id)
            );
            CREATE TABLE IF NOT EXISTS settings (
              key TEXT PRIMARY KEY,
              value TEXT NOT NULL
            );
            """)
        else:
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              email TEXT NOT NULL UNIQUE,
              password_hash TEXT NOT NULL,
              role TEXT NOT NULL CHECK(role IN ('customer','staff','admin')),
              created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS sessions (
              sid TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS products (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              cat TEXT NOT NULL,
              price REAL NOT NULL,
              was REAL,
              rating REAL DEFAULT 4.6,
              reviews INTEGER DEFAULT 0,
              badge TEXT DEFAULT '',
              img TEXT NOT NULL,
              desc TEXT NOT NULL,
              in_stock INTEGER NOT NULL DEFAULT 1,
              created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS orders (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              total REAL NOT NULL,
              delivery_fee REAL DEFAULT 0,
              deposit_amount REAL DEFAULT 0,
              remaining_amount REAL DEFAULT 0,
              payment_status TEXT DEFAULT 'Pending',
              county TEXT,
              constituency TEXT,
              street TEXT,
              deposit_mpesa TEXT,
              status TEXT NOT NULL DEFAULT 'Placed',
              created_at TEXT NOT NULL,
              delivery_fee_set INTEGER DEFAULT 0,
              delivery_date TEXT,
              FOREIGN KEY(user_id) REFERENCES users(id)
            );
            CREATE TABLE IF NOT EXISTS order_items (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              order_id TEXT NOT NULL,
              product_id TEXT NOT NULL,
              name TEXT NOT NULL,
              price REAL NOT NULL,
              qty INTEGER NOT NULL,
              img TEXT,
              FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
              FOREIGN KEY(product_id) REFERENCES products(id)
            );
            CREATE TABLE IF NOT EXISTS repair_categories (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              slug TEXT UNIQUE NOT NULL,
              created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS repair_services (
              id TEXT PRIMARY KEY,
              title TEXT NOT NULL,
              brand TEXT NOT NULL,
              repair_type TEXT NOT NULL,
              price REAL NOT NULL,
              duration TEXT NOT NULL,
              warranty TEXT NOT NULL,
              image TEXT NOT NULL,
              description TEXT NOT NULL,
              available INTEGER NOT NULL DEFAULT 1,
              category_id TEXT,
              created_at TEXT NOT NULL,
              FOREIGN KEY(category_id) REFERENCES repair_categories(id)
            );
            CREATE TABLE IF NOT EXISTS repair_statuses (
              status TEXT PRIMARY KEY,
              sequence INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS repair_technicians (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              email TEXT NOT NULL UNIQUE,
              created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS repair_bookings (
              id TEXT PRIMARY KEY,
              user_id TEXT,
              name TEXT NOT NULL,
              email TEXT NOT NULL,
              phone TEXT NOT NULL,
              brand TEXT NOT NULL,
              model TEXT NOT NULL,
              repair_service_id TEXT,
              repair_type TEXT NOT NULL,
              description TEXT NOT NULL,
              image_path TEXT,
              pickup_dropoff TEXT NOT NULL,
              preferred_at TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'Pending',
              technician_id TEXT,
              technician_notes TEXT,
              created_at TEXT NOT NULL,
              FOREIGN KEY(user_id) REFERENCES users(id),
              FOREIGN KEY(repair_service_id) REFERENCES repair_services(id),
              FOREIGN KEY(technician_id) REFERENCES repair_technicians(id),
              FOREIGN KEY(status) REFERENCES repair_statuses(status)
            );
            CREATE TABLE IF NOT EXISTS repair_notifications (
              id TEXT PRIMARY KEY,
              booking_id TEXT NOT NULL,
              message TEXT NOT NULL,
              is_read INTEGER NOT NULL DEFAULT 0,
              created_at TEXT NOT NULL,
              FOREIGN KEY(booking_id) REFERENCES repair_bookings(id)
            );
            CREATE TABLE IF NOT EXISTS device_models (
              id TEXT PRIMARY KEY,
              brand TEXT NOT NULL,
              model TEXT NOT NULL,
              created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS spare_parts (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              brand TEXT NOT NULL,
              category TEXT NOT NULL,
              price REAL NOT NULL,
              stock INTEGER NOT NULL DEFAULT 1,
              image_path TEXT,
              description TEXT,
              created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS counties (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL UNIQUE
            );
            CREATE TABLE IF NOT EXISTS delivery_zones (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              description TEXT
            );
            CREATE TABLE IF NOT EXISTS sub_locations (
              id TEXT PRIMARY KEY,
              county_id TEXT NOT NULL,
              name TEXT NOT NULL,
              delivery_zone_id TEXT NOT NULL,
              FOREIGN KEY(county_id) REFERENCES counties(id),
              FOREIGN KEY(delivery_zone_id) REFERENCES delivery_zones(id)
            );
            CREATE TABLE IF NOT EXISTS delivery_rates (
              id TEXT PRIMARY KEY,
              delivery_zone_id TEXT NOT NULL UNIQUE,
              base_fee REAL NOT NULL,
              weight_multiplier REAL DEFAULT 0,
              distance_multiplier REAL DEFAULT 0,
              created_at TEXT NOT NULL,
              FOREIGN KEY(delivery_zone_id) REFERENCES delivery_zones(id)
            );
            CREATE TABLE IF NOT EXISTS payments (
              id TEXT PRIMARY KEY,
              order_id TEXT,
              checkout_request_id TEXT,
              phone TEXT,
              amount REAL,
              status TEXT,
              created_at TEXT NOT NULL,
              FOREIGN KEY(order_id) REFERENCES orders(id)
            );
            CREATE TABLE IF NOT EXISTS order_notifications (
              id TEXT PRIMARY KEY,
              order_id TEXT NOT NULL,
              message TEXT NOT NULL,
              is_read INTEGER NOT NULL DEFAULT 0,
              created_at TEXT NOT NULL,
              FOREIGN KEY(order_id) REFERENCES orders(id)
            );
            CREATE TABLE IF NOT EXISTS settings (
              key TEXT PRIMARY KEY,
              value TEXT NOT NULL
            );
            """)
        
        conn.commit()
        now = datetime.now(timezone.utc).isoformat()
        
        # Check users
        cursor.execute("SELECT COUNT(*) as count FROM users")
        result = cursor.fetchone()
        user_count = result["count"] if USE_POSTGRES else result[0]
        
        if user_count == 0:
            logger.info("Seeding default users...")
            if USE_POSTGRES:
                cursor.execute("INSERT INTO users (id,name,email,password_hash,role,created_at) VALUES (%s,%s,%s,%s,%s,%s)", ("u-admin", "Store Admin", "admin@smdynamics.com", hash_password("admin123"), "admin", now))
                cursor.execute("INSERT INTO users (id,name,email,password_hash,role,created_at) VALUES (%s,%s,%s,%s,%s,%s)", ("u-staff", "Order Staff", "staff@smdynamics.com", hash_password("staff123"), "staff", now))
            else:
                cursor.execute("INSERT INTO users (id,name,email,password_hash,role,created_at) VALUES (?,?,?,?,?,?)", ("u-admin", "Store Admin", "admin@smdynamics.com", hash_password("admin123"), "admin", now))
                cursor.execute("INSERT INTO users (id,name,email,password_hash,role,created_at) VALUES (?,?,?,?,?,?)", ("u-staff", "Order Staff", "staff@smdynamics.com", hash_password("staff123"), "staff", now))
            conn.commit()
        
        # Check products - NO DEFAULT PRODUCTS SEEDING
        cursor.execute("SELECT COUNT(*) as count FROM products")
        result = cursor.fetchone()
        product_count = result["count"] if USE_POSTGRES else result[0]
        
        if product_count == 0:
            logger.info("No products found. Products must be added via management panel.")
        else:
            logger.info(f"Products table has {product_count} existing products")
        
        # Check repair categories
        cursor.execute("SELECT COUNT(*) as count FROM repair_categories")
        result = cursor.fetchone()
        if (result["count"] if USE_POSTGRES else result[0]) == 0:
            logger.info("Seeding repair categories...")
            if USE_POSTGRES:
                for c in DEFAULT_REPAIR_CATEGORIES:
                    cursor.execute("INSERT INTO repair_categories (id,name,slug,created_at) VALUES (%s,%s,%s,%s)", (*c, now))
            else:
                cursor.executemany("INSERT INTO repair_categories (id,name,slug,created_at) VALUES (?,?,?,?)", [(*c, now) for c in DEFAULT_REPAIR_CATEGORIES])
            conn.commit()
        
        # Check repair services - NO DEFAULT REPAIR SERVICES SEEDING
        cursor.execute("SELECT COUNT(*) as count FROM repair_services")
        result = cursor.fetchone()
        if (result["count"] if USE_POSTGRES else result[0]) == 0:
            logger.info("No repair services found. Services must be added via management panel.")
        
        # Check repair statuses
        cursor.execute("SELECT COUNT(*) as count FROM repair_statuses")
        result = cursor.fetchone()
        if (result["count"] if USE_POSTGRES else result[0]) == 0:
            logger.info("Seeding repair statuses...")
            if USE_POSTGRES:
                for status, seq in REPAIR_STATUSES:
                    cursor.execute("INSERT INTO repair_statuses (status,sequence) VALUES (%s,%s) ON CONFLICT (status) DO NOTHING", (status, seq))
            else:
                cursor.executemany("INSERT INTO repair_statuses (status,sequence) VALUES (?,?)", REPAIR_STATUSES)
            conn.commit()
        
        # Check device models
        cursor.execute("SELECT COUNT(*) as count FROM device_models")
        result = cursor.fetchone()
        if (result["count"] if USE_POSTGRES else result[0]) == 0:
            logger.info("Seeding device models...")
            rows = []
            for brand, models in DEFAULT_DEVICE_MODELS.items():
                for m in models:
                    rows.append(("m-" + secrets.token_hex(8), brand, m, now))
            if USE_POSTGRES:
                for row in rows:
                    cursor.execute("INSERT INTO device_models (id,brand,model,created_at) VALUES (%s,%s,%s,%s)", row)
            else:
                cursor.executemany("INSERT INTO device_models (id,brand,model,created_at) VALUES (?,?,?,?)", rows)
            conn.commit()
        
        # Check spare parts - NO DEFAULT SPARE PARTS SEEDING
        cursor.execute("SELECT COUNT(*) as count FROM spare_parts")
        result = cursor.fetchone()
        if (result["count"] if USE_POSTGRES else result[0]) == 0:
            logger.info("No spare parts found. Spare parts must be added via management panel.")
        
        # Check settings
        cursor.execute("SELECT COUNT(*) as count FROM settings")
        result = cursor.fetchone()
        if (result["count"] if USE_POSTGRES else result[0]) == 0:
            if USE_POSTGRES:
                cursor.execute("INSERT INTO settings (key, value) VALUES (%s, %s) ON CONFLICT (key) DO NOTHING", ('delivery_fee', '600'))
            else:
                cursor.execute("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", ('delivery_fee', '600'))
            conn.commit()
        
        # Add delivery_date column if not exists
        if USE_POSTGRES:
            cursor.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='orders' AND column_name='delivery_date'
            """)
            if not cursor.fetchone():
                cursor.execute("ALTER TABLE orders ADD COLUMN delivery_date TEXT")
                conn.commit()
                logger.info("Added delivery_date column to orders table")
        else:
            cursor.execute("PRAGMA table_info(orders)")
            columns = [col[1] for col in cursor.fetchall()]
            if 'delivery_date' not in columns:
                cursor.execute("ALTER TABLE orders ADD COLUMN delivery_date TEXT")
                conn.commit()
                logger.info("Added delivery_date column to orders table")
        
        seed_county_locations(conn, now)
        logger.info("Database initialization complete")

def row_product(row):
    return {
        "id": row["id"],
        "name": row["name"],
        "cat": row["cat"],
        "price": row["price"],
        "was": row["was"],
        "rating": row["rating"],
        "reviews": row["reviews"],
        "badge": row["badge"],
        "img": row["img"],
        "desc": row["desc"] if "desc" in row else row.get("desc", ""),
        "inStock": bool(row["in_stock"]),
        "specs": {"Category": row["cat"], "Warranty": "2 years", "Stock": "Available" if row["in_stock"] else "Out of stock"},
    }

def public_user(row):
    return {"id": row["id"], "name": row["name"], "email": row["email"], "role": row["role"]}

def row_order(conn, row):
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM order_items WHERE order_id = %s" if USE_POSTGRES else "SELECT * FROM order_items WHERE order_id = ?", (row["id"],))
    items = cursor.fetchall()
    cursor.execute("SELECT name,email FROM users WHERE id = %s" if USE_POSTGRES else "SELECT name,email FROM users WHERE id = ?", (row["user_id"],))
    user = cursor.fetchone()
    cursor.execute("SELECT message, is_read, created_at FROM order_notifications WHERE order_id = %s ORDER BY created_at DESC" if USE_POSTGRES else "SELECT message, is_read, created_at FROM order_notifications WHERE order_id = ? ORDER BY created_at DESC", (row["id"],))
    notifications = cursor.fetchall()
    return {
        "id": row["id"],
        "userId": row["user_id"],
        "customer": user["name"] if user else "Unknown",
        "email": user["email"] if user else "Unknown",
        "total": row["total"],
        "deliveryFee": row.get("delivery_fee", 0),
        "deliveryFeeSet": bool(row.get("delivery_fee", 0) > 0),
        "depositAmount": row.get("deposit_amount", 0),
        "remainingAmount": row.get("remaining_amount", 0),
        "paymentStatus": row.get("payment_status", "Pending"),
        "status": row["status"],
        "createdAt": row["created_at"],
        "deliveryDate": row.get("delivery_date"),
        "items": [{"id": i["product_id"], "name": i["name"], "price": i["price"], "qty": i["qty"], "img": i["img"]} for i in items],
        "location": {"county": row.get("county", ""), "constituency": row.get("constituency", ""), "street": row.get("street", "")},
        "depositMpesa": row.get("deposit_mpesa"),
        "notifications": [{"message": n["message"], "isRead": bool(n["is_read"]), "createdAt": n["created_at"]} for n in notifications],
    }

def row_repair_service(row):
    return {
        "id": row["id"],
        "title": row["title"],
        "brand": row["brand"],
        "repairType": row["repair_type"],
        "price": row["price"],
        "duration": row["duration"],
        "warranty": row["warranty"],
        "image": row["image"],
        "description": row["description"] if "description" in row else row.get("description", ""),
        "available": bool(row["available"]),
        "categoryId": row.get("category_id"),
        "category": row.get("category_name", ""),
    }

def row_repair_technician(row):
    return {"id": row["id"], "name": row["name"], "email": row["email"]}

def row_repair_booking(conn, row):
    cursor = conn.cursor()
    service = None
    if row.get("repair_service_id"):
        cursor.execute("SELECT title FROM repair_services WHERE id = %s" if USE_POSTGRES else "SELECT title FROM repair_services WHERE id = ?", (row["repair_service_id"],))
        service = cursor.fetchone()
    tech = None
    if row.get("technician_id"):
        cursor.execute("SELECT name FROM repair_technicians WHERE id = %s" if USE_POSTGRES else "SELECT name FROM repair_technicians WHERE id = ?", (row["technician_id"],))
        tech = cursor.fetchone()
    return {
        "id": row["id"],
        "userId": row.get("user_id"),
        "customer": row["name"],
        "name": row["name"],
        "email": row["email"],
        "phone": row["phone"],
        "brand": row["brand"],
        "model": row["model"],
        "repairServiceId": row.get("repair_service_id"),
        "technicianId": row.get("technician_id"),
        "repairServiceTitle": service["title"] if service else "",
        "repairType": row["repair_type"],
        "description": row["description"] if "description" in row else row.get("description", ""),
        "imagePath": row.get("image_path"),
        "pickupDropoff": row["pickup_dropoff"],
        "preferredAt": row["preferred_at"],
        "status": row["status"],
        "technician": tech["name"] if tech else "",
        "technicianNotes": row.get("technician_notes"),
        "createdAt": row["created_at"],
    }

class Handler(BaseHTTPRequestHandler):
    server_version = "SMDynamics/1.0"

    def send_json(self, data, status=200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        if not length:
            return {}
        return json.loads(self.rfile.read(length).decode())

    def read_multipart(self):
        content_type = self.headers.get('Content-Type', '')
        if 'multipart/form-data' not in content_type:
            return {}, {}
        
        boundary = None
        for part in content_type.split(';'):
            part = part.strip()
            if part.startswith('boundary='):
                boundary = part[9:].strip('"')
                break
        
        if not boundary:
            return {}, {}
        
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length == 0:
            return {}, {}
        
        body = self.rfile.read(content_length)
        boundary_bytes = f'--{boundary}'.encode()
        parts = body.split(boundary_bytes)
        
        fields = {}
        files = {}
        
        for part in parts:
            if not part or part == b'--\r\n' or part == b'--':
                continue
            header_end = part.find(b'\r\n\r\n')
            if header_end == -1:
                continue
            headers = part[:header_end].decode('utf-8', errors='replace')
            content = part[header_end + 4:]
            if content.endswith(b'\r\n'):
                content = content[:-2]
            name = None
            filename = None
            for line in headers.split('\r\n'):
                if line.startswith('Content-Disposition:'):
                    name_match = re.search(r'name="([^"]+)"', line)
                    if name_match:
                        name = name_match.group(1)
                    filename_match = re.search(r'filename="([^"]+)"', line)
                    if filename_match:
                        filename = filename_match.group(1)
            if name:
                if filename:
                    files[name] = {'filename': filename, 'content': content}
                else:
                    try:
                        fields[name] = content.decode('utf-8', errors='replace').strip()
                    except:
                        fields[name] = content.decode('latin-1', errors='replace').strip()
        return fields, files

    def current_user(self):
        jar = cookies.SimpleCookie(self.headers.get("Cookie"))
        sid = jar.get("sid")
        if not sid:
            return None
        with db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT user_id FROM sessions WHERE sid = %s" if USE_POSTGRES else "SELECT user_id FROM sessions WHERE sid = ?", (sid.value,))
            session = cursor.fetchone()
            if not session:
                return None
            cursor.execute("SELECT * FROM users WHERE id = %s" if USE_POSTGRES else "SELECT * FROM users WHERE id = ?", (session["user_id"],))
            return cursor.fetchone()

    def set_session(self, user_id):
        sid = secrets.token_urlsafe(32)
        with db() as conn:
            cursor = conn.cursor()
            cursor.execute("INSERT INTO sessions (sid, user_id, created_at) VALUES (%s, %s, %s)" if USE_POSTGRES else "INSERT INTO sessions (sid, user_id, created_at) VALUES (?,?,?)", (sid, user_id, datetime.now(timezone.utc).isoformat()))
            cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
            cursor.execute("DELETE FROM sessions WHERE created_at < %s" if USE_POSTGRES else "DELETE FROM sessions WHERE created_at < ?", (cutoff,))
            conn.commit()
        self.send_header("Set-Cookie", f"sid={sid}; HttpOnly; SameSite=Lax; Path=/")

    def clear_session(self):
        jar = cookies.SimpleCookie(self.headers.get("Cookie"))
        sid = jar.get("sid")
        if sid:
            with db() as conn:
                cursor = conn.cursor()
                cursor.execute("DELETE FROM sessions WHERE sid = %s" if USE_POSTGRES else "DELETE FROM sessions WHERE sid = ?", (sid.value,))
                conn.commit()
        self.send_header("Set-Cookie", "sid=; Max-Age=0; HttpOnly; SameSite=Lax; Path=/")

    def require(self, roles):
        user = self.current_user()
        if not user or user["role"] not in roles:
            self.send_json({"error": "Forbidden"}, 403)
            return None
        return user

    def do_HEAD(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") if parsed.path != "/" else "/"
        if path == "/":
            path = "/index.html"
        target = (ROOT / unquote(path).lstrip("/")).resolve()
        if not str(target).startswith(str(ROOT)) or not target.exists() or target.is_dir():
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header("Content-Type", mimetypes.guess_type(str(target))[0] or "application/octet-stream")
        self.send_header("Content-Length", str(target.stat().st_size))
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") if parsed.path != "/" else "/"
        if path == "/":
            path = "/index.html"
        query = parse_qs(parsed.query)
        
        # Handle image requests with placeholder to stop infinite loop
        if path.startswith("/shop/") and path.endswith(('.jpg', '.jpeg', '.png', '.gif', '.webp')):
            filename = Path(path).name
            target = SHOP_DIR / filename
            
            if not target.exists():
                # Return transparent placeholder
                self.send_response(200)
                self.send_header("Content-Type", "image/gif")
                self.send_header("Content-Length", str(len(TRANSPARENT_GIF)))
                self.end_headers()
                self.wfile.write(TRANSPARENT_GIF)
                return

        if path.startswith("/uploads/") and path.endswith(('.jpg', '.jpeg', '.png', '.gif', '.webp')):
            filename = Path(path).name
            target = UPLOAD_DIR / filename
            
            if not target.exists():
                # Return transparent placeholder
                self.send_response(200)
                self.send_header("Content-Type", "image/gif")
                self.send_header("Content-Length", str(len(TRANSPARENT_GIF)))
                self.end_headers()
                self.wfile.write(TRANSPARENT_GIF)
                return
        
        # API endpoints
        if path == "/api/spare-parts":
            brand = query.get("brand", [""])[0]
            category = query.get("category", [""])[0]
            search = query.get("search", [""])[0].lower()
            with db() as conn:
                cursor = conn.cursor()
                q = "SELECT * FROM spare_parts WHERE 1=1"
                params = []
                if brand:
                    q += " AND LOWER(brand) = LOWER(%s)" if USE_POSTGRES else " AND LOWER(brand) = LOWER(?)"
                    params.append(brand)
                if category:
                    q += " AND LOWER(category) = LOWER(%s)" if USE_POSTGRES else " AND LOWER(category) = LOWER(?)"
                    params.append(category)
                if search:
                    q += " AND (LOWER(name) LIKE %s OR LOWER(\"description\") LIKE %s)" if USE_POSTGRES else " AND (LOWER(name) LIKE ? OR LOWER(description) LIKE ?)"
                    term = f"%{search}%"
                    params.extend([term, term])
                q += " ORDER BY brand, category, name"
                cursor.execute(q, params)
                rows = cursor.fetchall()
                result = []
                for r in rows:
                    result.append({
                        "id": r["id"],
                        "name": r["name"],
                        "brand": r["brand"],
                        "category": r["category"],
                        "price": r["price"],
                        "stock": r["stock"],
                        "image": r["image_path"],
                        "image_path": r["image_path"],
                        "description": r["description"] if "description" in r else r.get("description", "")
                    })
                self.send_json({"spares": result})
            return
        
        if path == "/api/management/orders/placed":
            if not self.require({"staff", "admin"}):
                return
            with db() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM orders ORDER BY created_at DESC")
                rows = cursor.fetchall()
                self.send_json({"orders": [row_order(conn, r) for r in rows]})
            return
        
        if path == "/api/management/repair-bookings":
            if not self.require({"staff", "admin"}):
                return
            with db() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM repair_bookings ORDER BY created_at DESC")
                rows = cursor.fetchall()
                self.send_json({"bookings": [row_repair_booking(conn, r) for r in rows]})
            return
        
        if path == "/api/management/repair-services":
            if not self.require({"admin"}):
                return
            with db() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT r.*, c.name AS category_name FROM repair_services r LEFT JOIN repair_categories c ON r.category_id = c.id ORDER BY r.created_at DESC")
                rows = cursor.fetchall()
                self.send_json({"services": [row_repair_service(r) for r in rows]})
            return
        
        if path == "/api/admin/delivery-fee":
            if not self.require({"admin"}):
                return
            with db() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT value FROM settings WHERE key = 'delivery_fee'")
                setting = cursor.fetchone()
                fee = int(setting['value']) if setting else 600
                self.send_json({"fee": fee})
            return
        
        if path == "/api/repair/categories":
            with db() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT id, name, slug FROM repair_categories ORDER BY name")
                rows = cursor.fetchall()
                self.send_json({"categories": [{"id": r["id"], "name": r["name"], "slug": r["slug"]} for r in rows]})
            return

        if path == "/api/repair/services":
            with db() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT r.*, c.name AS category_name FROM repair_services r LEFT JOIN repair_categories c ON r.category_id = c.id ORDER BY r.created_at DESC")
                rows = cursor.fetchall()
                self.send_json({"services": [row_repair_service(r) for r in rows]})
            return

        if path == "/api/delivery-fee":
            with db() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT value FROM settings WHERE key = 'delivery_fee'")
                setting = cursor.fetchone()
                fee = int(setting['value']) if setting else 600
                self.send_json({"fee": fee})
            return

        if path == "/api/locations/counties":
            with db() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT id, name FROM counties ORDER BY name")
                rows = cursor.fetchall()
                self.send_json({"counties": [{"id": r["id"], "name": r["name"]} for r in rows]})
            return

        # ============================================
        # FIXED: ANALYTICS ENDPOINT - PostgreSQL compatible
        # ============================================
        if path == "/api/admin/analytics":
            if not self.require({"admin"}):
                return
            with db() as conn:
                cursor = conn.cursor()
                
                # Get total sales
                cursor.execute("SELECT COALESCE(SUM(total), 0) as total FROM orders")
                result = cursor.fetchone()
                total_sales = result["total"] if USE_POSTGRES else result[0]
                
                # Get total orders
                cursor.execute("SELECT COUNT(*) as count FROM orders")
                result = cursor.fetchone()
                total_orders = result["count"] if USE_POSTGRES else result[0]
                
                # Get delivered count
                cursor.execute("SELECT COUNT(*) as count FROM orders WHERE status = 'Delivered'")
                result = cursor.fetchone()
                delivered = result["count"] if USE_POSTGRES else result[0]
                
                # Get product count
                cursor.execute("SELECT COUNT(*) as count FROM products")
                result = cursor.fetchone()
                product_count = result["count"] if USE_POSTGRES else result[0]
                
                days_data = []
                for i in range(6, -1, -1):
                    day_label = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][(datetime.now(timezone.utc).weekday() - i) % 7]
                    offset = timedelta(days=i)
                    day_start = (datetime.now(timezone.utc) - offset).strftime("%Y-%m-%d")
                    
                    if USE_POSTGRES:
                        cursor.execute("SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE DATE(created_at) = %s", (day_start,))
                        result = cursor.fetchone()
                        day_sales = result["total"]
                        
                        cursor.execute("SELECT COUNT(*) as count FROM orders WHERE DATE(created_at) = %s", (day_start,))
                        result = cursor.fetchone()
                        day_orders = result["count"]
                    else:
                        cursor.execute("SELECT COALESCE(SUM(total), 0) FROM orders WHERE DATE(created_at) = ?", (day_start,))
                        day_sales = cursor.fetchone()[0]
                        
                        cursor.execute("SELECT COUNT(*) FROM orders WHERE DATE(created_at) = ?", (day_start,))
                        day_orders = cursor.fetchone()[0]
                    
                    days_data.append({"label": day_label, "sales": day_sales, "orders": day_orders})
                
                self.send_json({
                    "totalSales": total_sales,
                    "totalOrders": total_orders,
                    "delivered": delivered,
                    "products": product_count,
                    "days": days_data
                })
            return

        if path == "/api/products":
            with db() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM products ORDER BY created_at DESC")
                rows = cursor.fetchall()
                self.send_json({"products": [row_product(r) for r in rows]})
            return
        
        if path == "/api/auth/me":
            user = self.current_user()
            self.send_json({"user": public_user(user) if user else None})
            return
        
        if path == "/api/admin/staff":
            if not self.require({"admin"}):
                return
            with db() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM users WHERE role = 'staff' ORDER BY created_at DESC")
                rows = cursor.fetchall()
                self.send_json({"staff": [public_user(r) for r in rows]})
            return
        
        if path == "/api/repair/technicians":
            with db() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM repair_technicians ORDER BY name")
                rows = cursor.fetchall()
                self.send_json({"technicians": [row_repair_technician(r) for r in rows]})
            return
        
        # ============================================
        # ORDERS MY ENDPOINT
        # ============================================
        if path == "/api/orders/my":
            user = self.require({"customer"})
            if not user:
                return
            with db() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM orders WHERE user_id = %s ORDER BY created_at DESC" if USE_POSTGRES else "SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC", (user["id"],))
                rows = cursor.fetchall()
                self.send_json({"orders": [row_order(conn, r) for r in rows]})
            return
        
        # STATIC FILE SERVING
        file_path = unquote(path).lstrip("/")
        if ".." in file_path:
            self.send_error(403)
            return
        
        possible_paths = []
        
        root_target = (ROOT / file_path).resolve()
        if str(root_target).startswith(str(ROOT)):
            possible_paths.append(root_target)
        
        if path.startswith("/shop/"):
            shop_target = (SHOP_DIR / Path(file_path).name).resolve()
            if str(shop_target).startswith(str(SHOP_DIR)):
                possible_paths.append(shop_target)
        
        if path.startswith("/uploads/"):
            upload_target = (UPLOAD_DIR / Path(file_path).name).resolve()
            if str(upload_target).startswith(str(UPLOAD_DIR)):
                possible_paths.append(upload_target)
        
        target = None
        for pt in possible_paths:
            if pt.exists() and not pt.is_dir():
                target = pt
                break
        
        if not target:
            self.send_error(404)
            return
        
        body = target.read_bytes()
        self.send_response(200)
        
        content_type = mimetypes.guess_type(str(target))[0]
        if not content_type:
            if path.endswith('.jpg') or path.endswith('.jpeg'):
                content_type = 'image/jpeg'
            elif path.endswith('.png'):
                content_type = 'image/png'
            elif path.endswith('.gif'):
                content_type = 'image/gif'
            elif path.endswith('.webp'):
                content_type = 'image/webp'
            else:
                content_type = 'application/octet-stream'
        
        if path.endswith(('.jpg', '.jpeg', '.png', '.gif', '.webp', '.ico', '.svg')):
            self.send_header("Cache-Control", "public, max-age=86400")
        else:
            self.send_header("Cache-Control", "no-cache")
        
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        path = urlparse(self.path).path.rstrip("/")
        
        if path == "/api/auth/management-login":
            data = self.read_json()
            email = data.get("email", "").strip().lower()
            password = data.get("password", "")
            with db() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM users WHERE email = %s AND role IN ('admin', 'staff')" if USE_POSTGRES else "SELECT * FROM users WHERE email = ? AND role IN ('admin', 'staff')", (email,))
                user = cursor.fetchone()
            if not user or not verify_password(password, user["password_hash"]):
                self.send_json({"error": "Invalid login details"}, 401)
                return
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.set_session(user["id"])
            self.end_headers()
            self.wfile.write(json.dumps({"user": public_user(user)}).encode())
            return
        
        if path == "/api/auth/login":
            data = self.read_json()
            email = data.get("email", "").strip().lower()
            password = data.get("password", "")
            with db() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM users WHERE email = %s" if USE_POSTGRES else "SELECT * FROM users WHERE email = ?", (email,))
                user = cursor.fetchone()
            if not user or not verify_password(password, user["password_hash"]):
                self.send_json({"error": "Invalid login details"}, 401)
                return
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.set_session(user["id"])
            self.end_headers()
            self.wfile.write(json.dumps({"user": public_user(user)}).encode())
            return
        
        if path == "/api/auth/register":
            data = self.read_json()
            name, email, password = data.get("name", "").strip(), data.get("email", "").strip().lower(), data.get("password", "")
            if len(name) < 2 or "@" not in email or len(password) < 4:
                self.send_json({"error": "Invalid registration details"}, 400)
                return
            with db() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT 1 FROM users WHERE email = %s" if USE_POSTGRES else "SELECT 1 FROM users WHERE email = ?", (email,))
                if cursor.fetchone():
                    self.send_json({"error": "Email already exists"}, 409)
                    return
                user_id = "u-" + secrets.token_hex(8)
                cursor.execute("INSERT INTO users VALUES (%s,%s,%s,%s,%s,%s)" if USE_POSTGRES else "INSERT INTO users VALUES (?,?,?,?,?,?)", (user_id, name, email, hash_password(password), "customer", datetime.now(timezone.utc).isoformat()))
                cursor.execute("SELECT * FROM users WHERE id = %s" if USE_POSTGRES else "SELECT * FROM users WHERE id = ?", (user_id,))
                user = cursor.fetchone()
                conn.commit()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.set_session(user_id)
            self.end_headers()
            self.wfile.write(json.dumps({"user": public_user(user)}).encode())
            return
        
        if path == "/api/auth/logout":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.clear_session()
            self.end_headers()
            self.wfile.write(b'{"ok": true}')
            return
        
        if path == "/api/admin/delivery-fee":
            if not self.require({"admin"}):
                return
            data = self.read_json()
            fee = int(data.get('fee', 600))
            with db() as conn:
                cursor = conn.cursor()
                if USE_POSTGRES:
                    cursor.execute("INSERT INTO settings (key, value) VALUES (%s, %s) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", ('delivery_fee', str(fee)))
                else:
                    cursor.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", ('delivery_fee', str(fee)))
                conn.commit()
            self.send_json({"ok": True})
            return
        
        if path == "/api/admin/spare-parts":
            if not self.require({"admin"}):
                return
            
            content_type = self.headers.get("Content-Type", "")
            
            if content_type.startswith("application/json"):
                data = self.read_json()
                
                name = data.get("name", "").strip()
                brand = data.get("brand", "").strip()
                category = data.get("category", "").strip()
                price = float(data.get("price", 0))
                stock = int(data.get("stock", 1))
                description = data.get("description", "").strip()
                image_url = data.get("image_url", "").strip()
                
                if not name or not brand or not category or price <= 0:
                    self.send_json({"error": "Invalid spare part details"}, 400)
                    return
                
                if not image_url:
                    self.send_json({"error": "Image URL is required"}, 400)
                    return
                
                spare_id = "sp-" + secrets.token_hex(8)
                
                with db() as conn:
                    cursor = conn.cursor()
                    if USE_POSTGRES:
                        cursor.execute("INSERT INTO spare_parts (id,name,brand,category,price,stock,image_path,\"description\",created_at) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)", 
                            (spare_id, name, brand, category, price, stock, image_url, description, datetime.now(timezone.utc).isoformat()))
                    else:
                        cursor.execute("INSERT INTO spare_parts (id,name,brand,category,price,stock,image_path,description,created_at) VALUES (?,?,?,?,?,?,?,?,?)", 
                            (spare_id, name, brand, category, price, stock, image_url, description, datetime.now(timezone.utc).isoformat()))
                    conn.commit()
                
                self.send_json({"ok": True, "id": spare_id})
                return
            
            else:
                form, files = self.read_multipart()
                name = (form.get("name") or "").strip()
                brand = (form.get("brand") or "").strip()
                category = (form.get("category") or "").strip()
                price = float(form.get("price", "0"))
                stock = int(form.get("stock", "1"))
                description = (form.get("description") or "").strip()
                
                if not name or not brand or not category or price <= 0:
                    self.send_json({"error": "Invalid spare part details"}, 400)
                    return
                
                image_path = None
                image = files.get("image")
                if image:
                    ext = Path(image["filename"]).suffix.lower() or ".jpg"
                    filename = f"spare_{secrets.token_hex(8)}{ext}"
                    image_path = f"/uploads/{filename}"
                    target = UPLOAD_DIR / filename
                    with target.open("wb") as f:
                        f.write(image["content"])
                    logger.info(f"✅ Saved spare part image: {filename}")
                
                spare_id = "sp-" + secrets.token_hex(8)
                
                with db() as conn:
                    cursor = conn.cursor()
                    if USE_POSTGRES:
                        cursor.execute("INSERT INTO spare_parts (id,name,brand,category,price,stock,image_path,\"description\",created_at) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)", 
                            (spare_id, name, brand, category, price, stock, image_path, description, datetime.now(timezone.utc).isoformat()))
                    else:
                        cursor.execute("INSERT INTO spare_parts (id,name,brand,category,price,stock,image_path,description,created_at) VALUES (?,?,?,?,?,?,?,?,?)", 
                            (spare_id, name, brand, category, price, stock, image_path, description, datetime.now(timezone.utc).isoformat()))
                    conn.commit()
                
                self.send_json({"ok": True, "id": spare_id})
                return
        
        if path == "/api/admin/staff":
            if not self.require({"admin"}):
                return
            data = self.read_json()
            name, email, password = data.get("name", "").strip(), data.get("email", "").strip().lower(), data.get("password", "")
            if len(name) < 2 or "@" not in email or len(password) < 4:
                self.send_json({"error": "Invalid staff details"}, 400)
                return
            with db() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT 1 FROM users WHERE email = %s" if USE_POSTGRES else "SELECT 1 FROM users WHERE email = ?", (email,))
                if cursor.fetchone():
                    self.send_json({"error": "Email already exists"}, 409)
                    return
                user_id = "u-" + secrets.token_hex(8)
                cursor.execute("INSERT INTO users VALUES (%s,%s,%s,%s,%s,%s)" if USE_POSTGRES else "INSERT INTO users VALUES (?,?,?,?,?,?)", (user_id, name, email, hash_password(password), "staff", datetime.now(timezone.utc).isoformat()))
                conn.commit()
                self.send_json({"ok": True})
            return
        
        # ============================================
        # PRODUCT ENDPOINT
        # ============================================
        if path == "/api/admin/products":
            if not self.require({"admin"}):
                return
            
            logger.info("=" * 50)
            logger.info("📦 Received product submission")
            
            content_type = self.headers.get("Content-Type", "")
            
            if content_type.startswith("application/json"):
                data = self.read_json()
                
                name = data.get("name", "").strip()
                category = data.get("cat", "phones")
                price = float(data.get("price", 0))
                was_price = data.get("was")
                if was_price:
                    try:
                        was_price = float(was_price)
                    except:
                        was_price = None
                badge_value = data.get("badge", "")
                desc = data.get("desc", "").strip()
                image_url = data.get("image_url", "").strip()
                
                logger.info(f"📝 Product data from JSON: name={name}, price={price}, image_url={image_url}")
                
                if not name or price <= 0:
                    self.send_json({"error": "Product name and valid price are required"}, 400)
                    return
                
                if not image_url:
                    self.send_json({"error": "Image URL is required"}, 400)
                    return
                
                product_id = "p-" + secrets.token_hex(8)
                
                with db() as conn:
                    cursor = conn.cursor()
                    if USE_POSTGRES:
                        cursor.execute("INSERT INTO products (id,name,cat,price,was,rating,reviews,badge,img,\"desc\",in_stock,created_at) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)", 
                            (product_id, name, category, price, was_price, 4.6, 0, badge_value, image_url, desc, 1, datetime.now(timezone.utc).isoformat()))
                    else:
                        cursor.execute("INSERT INTO products (id,name,cat,price,was,rating,reviews,badge,img,desc,in_stock,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", 
                            (product_id, name, category, price, was_price, 4.6, 0, badge_value, image_url, desc, 1, datetime.now(timezone.utc).isoformat()))
                    conn.commit()
                
                logger.info(f"✅ Product added: {product_id} - {name}")
                self.send_json({"ok": True, "id": product_id, "image_url": image_url})
                return
            
            else:
                form, files = self.read_multipart()
                
                logger.info(f"📝 Form fields: {list(form.keys())}")
                logger.info(f"📎 Files found: {list(files.keys())}")
                
                image = files.get("img") or files.get("image")
                if not image:
                    logger.error("❌ No image found!")
                    self.send_json({"error": "Product image is required. Field name should be 'img'."}, 400)
                    return
                
                logger.info(f"Image filename: {image['filename']}")
                logger.info(f"Image size: {len(image['content'])} bytes")
                
                try:
                    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
                    
                    ext = Path(image["filename"]).suffix.lower() or ".jpg"
                    filename = secrets.token_hex(12) + ext
                    target = UPLOAD_DIR / filename
                    
                    with target.open("wb") as f:
                        f.write(image["content"])
                    
                    logger.info(f"✅ Image saved: {filename}")
                    
                except Exception as e:
                    logger.error(f"❌ Failed to save image: {e}")
                    self.send_json({"error": f"Failed to save image: {str(e)}"}, 500)
                    return
                
                product_id = "p-" + secrets.token_hex(8)
                
                name = form.get("name", "").strip()
                category = form.get("cat", "phones")
                price = float(form.get("price", "0"))
                was_price = None
                was_input = form.get("was", "")
                if was_input and was_input.strip():
                    try:
                        was_price = float(was_input)
                    except:
                        was_price = None
                badge_value = form.get("badge", "")
                desc = form.get("desc", "").strip()
                
                if not name or price <= 0:
                    self.send_json({"error": "Product name and valid price are required"}, 400)
                    return
                
                image_url = f"/uploads/{filename}"
                
                with db() as conn:
                    cursor = conn.cursor()
                    if USE_POSTGRES:
                        cursor.execute("INSERT INTO products (id,name,cat,price,was,rating,reviews,badge,img,\"desc\",in_stock,created_at) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)", 
                            (product_id, name, category, price, was_price, 4.6, 0, badge_value, image_url, desc, 1, datetime.now(timezone.utc).isoformat()))
                    else:
                        cursor.execute("INSERT INTO products (id,name,cat,price,was,rating,reviews,badge,img,desc,in_stock,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", 
                            (product_id, name, category, price, was_price, 4.6, 0, badge_value, image_url, desc, 1, datetime.now(timezone.utc).isoformat()))
                    conn.commit()
                
                logger.info(f"✅ Product added: {product_id} - {name}")
                self.send_json({"ok": True, "id": product_id, "image_url": image_url})
                return
        
        if path == "/api/management/repair-technicians":
            if not self.require({"admin"}):
                return
            data = self.read_json()
            name = (data.get("name") or "").strip()
            email = (data.get("email") or "").strip().lower()
            if len(name) < 2 or "@" not in email:
                self.send_json({"error": "Invalid technician details"}, 400)
                return
            with db() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT 1 FROM repair_technicians WHERE email = %s" if USE_POSTGRES else "SELECT 1 FROM repair_technicians WHERE email = ?", (email,))
                if cursor.fetchone():
                    self.send_json({"error": "Technician already exists"}, 409)
                    return
                tech_id = "t-" + secrets.token_hex(8)
                cursor.execute("INSERT INTO repair_technicians (id,name,email,created_at) VALUES (%s,%s,%s,%s)" if USE_POSTGRES else "INSERT INTO repair_technicians (id,name,email,created_at) VALUES (?,?,?,?)", (tech_id, name, email, datetime.now(timezone.utc).isoformat()))
                conn.commit()
            self.send_json({"ok": True})
            return
        
        if path == "/api/management/repair-services":
            if not self.require({"admin"}):
                return
            form, files = self.read_multipart()
            image = files.get("image")
            if not image:
                self.send_json({"error": "Service image is required"}, 400)
                return
            ext = Path(image["filename"]).suffix.lower() or ".jpg"
            filename = secrets.token_hex(12) + ext
            target = UPLOAD_DIR / filename
            with target.open("wb") as f:
                f.write(image["content"])
            service_id = "rs-" + secrets.token_hex(8)
            with db() as conn:
                cursor = conn.cursor()
                if USE_POSTGRES:
                    cursor.execute("INSERT INTO repair_services (id,title,brand,repair_type,price,duration,warranty,image,\"description\",available,category_id,created_at) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)", 
                        (service_id, form.get("title", "").strip(), form.get("brand", "").strip(), form.get("repairType", "").strip(), 
                         float(form.get("price", "0") or 0), form.get("duration", "").strip(), form.get("warranty", "").strip(), 
                         f"/uploads/{filename}", form.get("description", "").strip(), 1, form.get("categoryId", None), 
                         datetime.now(timezone.utc).isoformat()))
                else:
                    cursor.execute("INSERT INTO repair_services (id,title,brand,repair_type,price,duration,warranty,image,description,available,category_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", 
                        (service_id, form.get("title", "").strip(), form.get("brand", "").strip(), form.get("repairType", "").strip(), 
                         float(form.get("price", "0") or 0), form.get("duration", "").strip(), form.get("warranty", "").strip(), 
                         f"/uploads/{filename}", form.get("description", "").strip(), 1, form.get("categoryId", None), 
                         datetime.now(timezone.utc).isoformat()))
                conn.commit()
            self.send_json({"ok": True})
            return
        
        if path == "/api/repair/bookings":
            data = self.read_json()
            booking_id = "bk-" + secrets.token_hex(8)
            with db() as conn:
                cursor = conn.cursor()
                if USE_POSTGRES:
                    cursor.execute("INSERT INTO repair_bookings (id, name, email, phone, brand, model, repair_service_id, repair_type, \"description\", pickup_dropoff, preferred_at, status, created_at) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)", 
                        (booking_id, data.get("name"), data.get("email"), data.get("phone"), data.get("brand"), data.get("model"), 
                         data.get("repairServiceId"), data.get("repairType"), data.get("description"), data.get("pickupDropoff") or "Dropoff", 
                         data.get("preferredAt") or datetime.now(timezone.utc).isoformat(), "Pending", datetime.now(timezone.utc).isoformat()))
                else:
                    cursor.execute("INSERT INTO repair_bookings (id, name, email, phone, brand, model, repair_service_id, repair_type, description, pickup_dropoff, preferred_at, status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", 
                        (booking_id, data.get("name"), data.get("email"), data.get("phone"), data.get("brand"), data.get("model"), 
                         data.get("repairServiceId"), data.get("repairType"), data.get("description"), data.get("pickupDropoff") or "Dropoff", 
                         data.get("preferredAt") or datetime.now(timezone.utc).isoformat(), "Pending", datetime.now(timezone.utc).isoformat()))
                conn.commit()
            self.send_json({"ok": True, "id": booking_id})
            return
        
        if path == "/api/orders":
            user = self.require({"customer"})
            if not user:
                return
            data = self.read_json()
            cart = data.get("items", [])
            if not cart:
                self.send_json({"error": "Cart is empty"}, 400)
                return
            with db() as conn:
                cursor = conn.cursor()
                order_id = "ORD-" + secrets.token_hex(4).upper()
                product_total = 0
                rows = []
                for item in cart:
                    pid = str(item.get("id"))
                    if USE_POSTGRES:
                        cursor.execute("SELECT id, name, price, in_stock, img FROM products WHERE id = %s", (pid,))
                        product = cursor.fetchone()
                        if not product:
                            cursor.execute("SELECT id, name, price, stock as in_stock, image_path as img FROM spare_parts WHERE id = %s", (pid,))
                            product = cursor.fetchone()
                    else:
                        cursor.execute("SELECT id, name, price, in_stock, img FROM products WHERE id = ?", (pid,))
                        product = cursor.fetchone()
                        if not product:
                            cursor.execute("SELECT id, name, price, stock as in_stock, image_path as img FROM spare_parts WHERE id = ?", (pid,))
                            product = cursor.fetchone()
                    qty = int(item.get("qty", 1))
                    if not product or not product["in_stock"] or qty < 1:
                        self.send_json({"error": f"Product {pid} is unavailable"}, 400)
                        return
                    product_total += product["price"] * qty
                    rows.append((order_id, product["id"], product["name"], product["price"], qty, product["img"]))
                
                cursor.execute("INSERT INTO orders (id, user_id, total, delivery_fee, deposit_amount, remaining_amount, payment_status, county, constituency, street, deposit_mpesa, status, created_at) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)" if USE_POSTGRES else "INSERT INTO orders (id, user_id, total, delivery_fee, deposit_amount, remaining_amount, payment_status, county, constituency, street, deposit_mpesa, status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", 
                    (order_id, user["id"], product_total, 0, product_total, 0, "Paid", data.get("county"), data.get("constituency"), data.get("street"), data.get("depositMpesa"), "Placed", datetime.now(timezone.utc).isoformat()))
                
                for row in rows:
                    cursor.execute("INSERT INTO order_items (order_id,product_id,name,price,qty,img) VALUES (%s,%s,%s,%s,%s,%s)" if USE_POSTGRES else "INSERT INTO order_items (order_id,product_id,name,price,qty,img) VALUES (?,?,?,?,?,?)", row)
                
                notif_id = "n-" + secrets.token_hex(8)
                cursor.execute("INSERT INTO order_notifications (id,order_id,message,is_read,created_at) VALUES (%s,%s,%s,%s,%s)" if USE_POSTGRES else "INSERT INTO order_notifications (id,order_id,message,is_read,created_at) VALUES (?,?,?,?,?)", 
                    (notif_id, order_id, f"Your order {order_id} has been placed! We will contact you shortly with delivery fee details.", 0, datetime.now(timezone.utc).isoformat()))
                
                cursor.execute("SELECT * FROM orders WHERE id = %s" if USE_POSTGRES else "SELECT * FROM orders WHERE id = ?", (order_id,))
                order = cursor.fetchone()
                conn.commit()
                self.send_json({"order": row_order(conn, order)})
            return
        
        if path == "/api/test-multipart":
            if not self.require({"admin"}):
                return
            form, files = self.read_multipart()
            self.send_json({"form_fields": list(form.keys()), "file_fields": list(files.keys()), "success": True})
            return
        
        if path == "/api/test-upload":
            if not self.require({"admin"}):
                return
            form, files = self.read_multipart()
            self.send_json({"form_fields": list(form.keys()), "file_fields": list(files.keys()), "received": True})
            return
        
        self.send_json({"error": "Not found"}, 404)

    def do_PUT(self):
        path = urlparse(self.path).path.rstrip("/")
        
        if path.startswith("/api/admin/spare-parts/"):
            if not self.require({"admin"}):
                return
            spare_id = path.split("/")[-1]
            content_type = self.headers.get("Content-Type", "")
            if content_type.startswith("multipart/form-data"):
                data, files = self.read_multipart()
            else:
                data = self.read_json()
                files = {}
            name = (data.get("name") or "").strip()
            brand = (data.get("brand") or "").strip()
            category = (data.get("category") or "").strip()
            price = float(data.get("price") or 0)
            stock = int(data.get("stock") or 1)
            description = (data.get("description") or "").strip()
            if not name or not brand or not category or price <= 0:
                self.send_json({"error": "Invalid spare part details"}, 400)
                return
            with db() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM spare_parts WHERE id = %s" if USE_POSTGRES else "SELECT * FROM spare_parts WHERE id = ?", (spare_id,))
                part = cursor.fetchone()
                if not part:
                    self.send_json({"error": "Spare part not found"}, 404)
                    return
                image_path = part["image_path"]
                image = files.get("image") if files else None
                if image:
                    if image_path and not image_path.startswith('/shop/'):
                        old_file = UPLOAD_DIR / Path(image_path).name
                        if old_file.exists():
                            old_file.unlink()
                    ext = Path(image["filename"]).suffix.lower() or ".jpg"
                    filename = f"spare_{secrets.token_hex(8)}{ext}"
                    image_path = f"/uploads/{filename}"
                    target = UPLOAD_DIR / filename
                    with target.open("wb") as f:
                        f.write(image["content"])
                if USE_POSTGRES:
                    cursor.execute("UPDATE spare_parts SET name = %s, brand = %s, category = %s, price = %s, stock = %s, image_path = %s, \"description\" = %s WHERE id = %s", 
                        (name, brand, category, price, stock, image_path, description, spare_id))
                else:
                    cursor.execute("UPDATE spare_parts SET name = ?, brand = ?, category = ?, price = ?, stock = ?, image_path = ?, description = ? WHERE id = ?", 
                        (name, brand, category, price, stock, image_path, description, spare_id))
                conn.commit()
            self.send_json({"ok": True})
            return
        
        if path.startswith("/api/management/repair-services/"):
            if not self.require({"admin"}):
                return
            service_id = path.split("/")[-1]
            data = self.read_json()
            with db() as conn:
                cursor = conn.cursor()
                if USE_POSTGRES:
                    cursor.execute("UPDATE repair_services SET title = %s, brand = %s, repair_type = %s, price = %s, duration = %s, warranty = %s, \"description\" = %s, available = %s WHERE id = %s", 
                        (data.get("title"), data.get("brand"), data.get("repairType"), data.get("price"), data.get("duration"), data.get("warranty"), data.get("description"), 1 if data.get("available") else 0, service_id))
                else:
                    cursor.execute("UPDATE repair_services SET title = ?, brand = ?, repair_type = ?, price = ?, duration = ?, warranty = ?, description = ?, available = ? WHERE id = ?", 
                        (data.get("title"), data.get("brand"), data.get("repairType"), data.get("price"), data.get("duration"), data.get("warranty"), data.get("description"), 1 if data.get("available") else 0, service_id))
                conn.commit()
            self.send_json({"ok": True})
            return
        
        import re as _re
        _df_match = _re.match(r"^/api/admin/orders/([^/]+)/delivery-fee$", path)
        if _df_match:
            admin = self.require({"admin"})
            if not admin:
                return
            order_id = _df_match.group(1)
            data = self.read_json()
            fee = data.get("deliveryFee")
            if fee is None or float(fee) < 0:
                self.send_json({"error": "Invalid delivery fee"}, 400)
                return
            fee = float(fee)
            with db() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM orders WHERE id = %s" if USE_POSTGRES else "SELECT * FROM orders WHERE id = ?", (order_id,))
                order = cursor.fetchone()
                if not order:
                    self.send_json({"error": "Order not found"}, 404)
                    return
                cursor.execute("UPDATE orders SET delivery_fee = %s, remaining_amount = %s, payment_status = %s, delivery_fee_set = 1 WHERE id = %s" if USE_POSTGRES else "UPDATE orders SET delivery_fee = ?, remaining_amount = ?, payment_status = ?, delivery_fee_set = 1 WHERE id = ?", 
                    (fee, fee, "Delivery Fee Pending", order_id))
                notif_id = "n-" + secrets.token_hex(8)
                product_total = order["total"]
                cursor.execute("SELECT name, email FROM users WHERE id = %s" if USE_POSTGRES else "SELECT name, email FROM users WHERE id = ?", (order["user_id"],))
                user = cursor.fetchone()
                customer_name = user["name"] if user else "Customer"
                msg = f"Hi {customer_name}! Your delivery fee for order {order_id} has been set to KES {int(fee):,}. Please pay via M-Pesa to complete your delivery."
                cursor.execute("INSERT INTO order_notifications (id,order_id,message,is_read,created_at) VALUES (%s,%s,%s,%s,%s)" if USE_POSTGRES else "INSERT INTO order_notifications (id,order_id,message,is_read,created_at) VALUES (?,?,?,?,?)", 
                    (notif_id, order_id, msg, 0, datetime.now(timezone.utc).isoformat()))
                cursor.execute("SELECT * FROM orders WHERE id = %s" if USE_POSTGRES else "SELECT * FROM orders WHERE id = ?", (order_id,))
                updated = cursor.fetchone()
                conn.commit()
            self.send_json({"ok": True, "order": row_order(conn, updated), "customerNotified": True})
            return

        _dd_match = _re.match(r"^/api/admin/orders/([^/]+)/delivery-date$", path)
        if _dd_match:
            admin = self.require({"admin"})
            if not admin:
                return
            order_id = _dd_match.group(1)
            data = self.read_json()
            delivery_date = data.get("deliveryDate")
            
            if not delivery_date:
                self.send_json({"error": "Delivery date is required"}, 400)
                return
            
            with db() as conn:
                cursor = conn.cursor()
                cursor.execute("UPDATE orders SET delivery_date = %s WHERE id = %s" if USE_POSTGRES else "UPDATE orders SET delivery_date = ? WHERE id = ?", (delivery_date, order_id))
                notif_id = "n-" + secrets.token_hex(8)
                cursor.execute("SELECT user_id FROM orders WHERE id = %s" if USE_POSTGRES else "SELECT user_id FROM orders WHERE id = ?", (order_id,))
                order = cursor.fetchone()
                if order:
                    formatted_date = datetime.strptime(delivery_date, "%Y-%m-%d").strftime("%B %d, %Y")
                    msg = f"🎉 Great news! Your order {order_id} is scheduled for delivery on {formatted_date}. Our team will contact you with more details."
                    cursor.execute("INSERT INTO order_notifications (id,order_id,message,is_read,created_at) VALUES (%s,%s,%s,%s,%s)" if USE_POSTGRES else "INSERT INTO order_notifications (id,order_id,message,is_read,created_at) VALUES (?,?,?,?,?)", 
                        (notif_id, order_id, msg, 0, datetime.now(timezone.utc).isoformat()))
                conn.commit()
            self.send_json({"ok": True})
            return

        if path.startswith("/api/admin/products/"):
            if not self.require({"admin"}):
                return
            product_id = path.split("/")[-1]
            data = self.read_json()
            logger.info(f"Updating product {product_id}")
            with db() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM products WHERE id = %s" if USE_POSTGRES else "SELECT * FROM products WHERE id = ?", (product_id,))
                existing = cursor.fetchone()
                if not existing:
                    self.send_json({"error": "Product not found"}, 404)
                    return
                
                img_path = data.get("img", existing["img"])
                
                if USE_POSTGRES:
                    cursor.execute("UPDATE products SET name = %s, price = %s, was = %s, badge = %s, img = %s, rating = %s, reviews = %s, in_stock = %s, cat = %s, \"desc\" = %s WHERE id = %s", 
                        (data.get("name", existing["name"]), 
                         float(data.get("price", existing["price"])), 
                         data.get("was") if data.get("was") else None, 
                         data.get("badge", existing.get("badge", "")), 
                         img_path,
                         float(data.get("rating", existing.get("rating", 4.6))), 
                         int(data.get("reviews", existing.get("reviews", 0))), 
                         1 if data.get("inStock", existing.get("in_stock", 1)) else 0, 
                         data.get("cat", existing["cat"]), 
                         data.get("desc", existing.get("desc", "")), 
                         product_id))
                else:
                    cursor.execute("UPDATE products SET name = ?, price = ?, was = ?, badge = ?, img = ?, rating = ?, reviews = ?, in_stock = ?, cat = ?, desc = ? WHERE id = ?", 
                        (data.get("name", existing["name"]), 
                         float(data.get("price", existing["price"])), 
                         data.get("was") if data.get("was") else None, 
                         data.get("badge", existing.get("badge", "")), 
                         img_path,
                         float(data.get("rating", existing.get("rating", 4.6))), 
                         int(data.get("reviews", existing.get("reviews", 0))), 
                         1 if data.get("inStock", existing.get("in_stock", 1)) else 0, 
                         data.get("cat", existing["cat"]), 
                         data.get("desc", existing.get("desc", "")), 
                         product_id))
                conn.commit()
                logger.info(f"Product {product_id} updated successfully")
            self.send_json({"ok": True})
            return
        
        self.send_json({"error": "Not found"}, 404)

    def do_DELETE(self):
        path = urlparse(self.path).path.rstrip("/")
        
        if path == "/api/admin/delete-image":
            if not self.require({"admin"}):
                return
            data = self.read_json()
            image_path = data.get("imagePath")
            if image_path:
                default_images = ['hero-phone.jpg', 'headphones.jpg', 'laptop.jpg', 'watch.jpg', 'vr.jpg', 'earbuds.jpg', 'camera.jpg', 'console.jpg', 'tablet.jpg', 'speaker.jpg', 'drone.jpg', 'hub.jpg', 'keyboard.jpg', 'brand logo.png']
                filename = image_path.split('/')[-1]
                if filename not in default_images:
                    target = UPLOAD_DIR / filename
                    if target.exists() and target.is_file():
                        target.unlink()
                        logger.info(f"Deleted image: {filename}")
            self.send_json({"ok": True})
            return
        
        if path.startswith("/api/admin/spare-parts/"):
            if not self.require({"admin"}):
                return
            spare_id = path.split("/")[-1]
            with db() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT image_path FROM spare_parts WHERE id = %s" if USE_POSTGRES else "SELECT image_path FROM spare_parts WHERE id = ?", (spare_id,))
                part = cursor.fetchone()
                if part and part["image_path"]:
                    filename = part["image_path"].split('/')[-1]
                    default_images = ['hero-phone.jpg', 'headphones.jpg', 'laptop.jpg', 'watch.jpg', 'vr.jpg', 'earbuds.jpg', 'camera.jpg', 'console.jpg', 'tablet.jpg', 'speaker.jpg', 'drone.jpg', 'hub.jpg', 'keyboard.jpg', 'brand logo.png']
                    if filename not in default_images:
                        target = UPLOAD_DIR / filename
                        if target.exists():
                            target.unlink()
                            logger.info(f"Deleted spare part image: {filename}")
                cursor.execute("DELETE FROM spare_parts WHERE id = %s" if USE_POSTGRES else "DELETE FROM spare_parts WHERE id = ?", (spare_id,))
                conn.commit()
            self.send_json({"ok": True})
            return
        
        if path.startswith("/api/admin/products/"):
            if not self.require({"admin"}):
                return
            product_id = path.split("/")[-1]
            with db() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT COUNT(*) as count FROM order_items WHERE product_id = %s" if USE_POSTGRES else "SELECT COUNT(*) as count FROM order_items WHERE product_id = ?", (product_id,))
                result = cursor.fetchone()
                order_count = result["count"] if USE_POSTGRES else result[0]
                cursor.execute("SELECT img FROM products WHERE id = %s" if USE_POSTGRES else "SELECT img FROM products WHERE id = ?", (product_id,))
                product = cursor.fetchone()
                
                if order_count > 0:
                    cursor.execute("UPDATE products SET in_stock = 0 WHERE id = %s" if USE_POSTGRES else "UPDATE products SET in_stock = 0 WHERE id = ?", (product_id,))
                    conn.commit()
                    logger.info(f"Product {product_id} has orders - marked as out of stock")
                    self.send_json({"ok": True, "warning": "Product has existing orders. Marked as out of stock instead of deleting."})
                    return
                
                if product and product["img"] and not product["img"].startswith('/shop/'):
                    filename = product["img"].split('/')[-1]
                    target = UPLOAD_DIR / filename
                    if target.exists():
                        target.unlink()
                        logger.info(f"Deleted product image: {filename}")
                
                cursor.execute("DELETE FROM order_items WHERE product_id = %s" if USE_POSTGRES else "DELETE FROM order_items WHERE product_id = ?", (product_id,))
                cursor.execute("DELETE FROM products WHERE id = %s" if USE_POSTGRES else "DELETE FROM products WHERE id = ?", (product_id,))
                conn.commit()
                logger.info(f"Product {product_id} deleted completely")
            self.send_json({"ok": True})
            return
        
        if path.startswith("/api/management/repair-services/"):
            if not self.require({"admin"}):
                return
            service_id = path.split("/")[-1]
            with db() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT image FROM repair_services WHERE id = %s" if USE_POSTGRES else "SELECT image FROM repair_services WHERE id = ?", (service_id,))
                service = cursor.fetchone()
                if service and service["image"] and not service["image"].startswith('/shop/'):
                    filename = service["image"].split('/')[-1]
                    target = UPLOAD_DIR / filename
                    if target.exists():
                        target.unlink()
                        logger.info(f"Deleted repair service image: {filename}")
                cursor.execute("DELETE FROM repair_services WHERE id = %s" if USE_POSTGRES else "DELETE FROM repair_services WHERE id = ?", (service_id,))
                conn.commit()
            self.send_json({"ok": True})
            return
        
        if path.startswith("/api/admin/staff/"):
            if not self.require({"admin"}):
                return
            user_id = path.split("/")[-1]
            with db() as conn:
                cursor = conn.cursor()
                cursor.execute("DELETE FROM users WHERE id = %s AND role = 'staff'" if USE_POSTGRES else "DELETE FROM users WHERE id = ? AND role = 'staff'", (user_id,))
                conn.commit()
            self.send_json({"ok": True})
            return
        
        if path.startswith("/api/management/repair-technicians/"):
            if not self.require({"admin"}):
                return
            tech_id = path.split("/")[-1]
            with db() as conn:
                cursor = conn.cursor()
                cursor.execute("DELETE FROM repair_technicians WHERE id = %s" if USE_POSTGRES else "DELETE FROM repair_technicians WHERE id = ?", (tech_id,))
                conn.commit()
            self.send_json({"ok": True})
            return
        
        self.send_json({"error": "Not found"}, 404)

if __name__ == "__main__":
    init_db()
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "8000"))
    logger.info(f"S.M Dynamics server running at http://{host}:{port}")
    if USE_POSTGRES:
        logger.info("Using PostgreSQL database")
    else:
        logger.info("Using SQLite database")
    
    if UPLOAD_DIR.exists():
        files = list(UPLOAD_DIR.glob("*"))
        logger.info(f"Files in uploads directory: {len(files)}")
        for f in files[:10]:
            logger.info(f"  - {f.name}")
    else:
        logger.warning(f"Uploads directory does not exist: {UPLOAD_DIR}")
    
    ThreadingHTTPServer((host, port), Handler).serve_forever()
