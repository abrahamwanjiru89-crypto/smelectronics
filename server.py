import hashlib
import hmac
import json
import mimetypes
import os
import re
import secrets
import shutil
import sqlite3
from email.parser import BytesParser
from email.policy import default
from datetime import datetime, timezone, timedelta
from http import cookies
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import unquote, urlparse, parse_qs, urlencode
import urllib.request

ROOT = Path(__file__).parent.resolve()
DATA_DIR = Path(os.environ.get("DATA_DIR", str(ROOT)))
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "shop.db"
UPLOAD_DIR = DATA_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Cache for static files to improve loading speed
STATIC_CACHE = {}
CACHE_TTL = 3600

DEFAULT_PRODUCTS = [
    ("p1", "Nova Phone 16 Pro", "phones", 1299, 1499, 4.9, 1283, "hot", "/shop/hero-phone.jpg", "A flagship redefined. Titanium frame, 6.7\" OLED 120Hz display and the new A18X bionic chip.", 1),
    ("p2", "Aura Studio Pro", "audio", 449, 549, 4.8, 842, "sale", "/shop/headphones.jpg", "Reference-grade over-ear with adaptive noise cancellation and 60h battery.", 1),
    ("p3", "Nova Book X1", "laptops", 2199, None, 4.9, 512, "new", "/shop/laptop.jpg", "Carbon-fiber chassis, 14\" mini-LED, 32GB RAM and 18-hour battery.", 1),
    ("p4", "Orbit Watch Ultra", "wearables", 599, 699, 4.7, 301, "sale", "/shop/watch.jpg", "Sapphire crystal, dual-frequency GPS and 7-day battery in titanium.", 1),
    ("p5", "Vision Lens VR", "gaming", 899, None, 4.6, 178, "new", "/shop/vr.jpg", "4K-per-eye micro-OLED with 120Hz tracking. The future of immersion.", 1),
    ("p6", "Echo Buds 3", "audio", 179, 229, 4.7, 921, "sale", "/shop/earbuds.jpg", "Hi-Res certified earbuds with hybrid ANC and 32h total battery.", 1),
    ("p7", "Lumen R7 Camera", "wearables", 1499, None, 4.8, 215, "", "/shop/camera.jpg", "45MP full-frame mirrorless with 8K video and AI subject tracking.", 1),
    ("p8", "Apex Pad Ultra", "gaming", 79, None, 4.6, 1502, "hot", "/shop/console.jpg", "Pro-grade wireless controller with haptic triggers and RGB.", 1),
    ("p9", "Glide Tab 12", "laptops", 899, None, 4.5, 402, "", "/shop/tablet.jpg", "12.4\" 2K tablet with pressure-sensitive stylus, perfect for creators.", 1),
    ("p10", "Pulse Sound 360", "home", 249, 299, 4.7, 687, "sale", "/shop/speaker.jpg", "360 degree smart speaker with built-in voice assistant and room calibration.", 1),
    ("p11", "Falcon Drone 4K", "gaming", 1199, None, 4.8, 243, "new", "/shop/drone.jpg", "4K stabilized drone with 40-minute flight time and obstacle avoidance.", 1),
    ("p12", "Nest Hub Mini", "home", 129, None, 4.5, 1109, "", "/shop/hub.jpg", "Smart home command center with ambient display and voice control.", 1),
    ("p13", "Forge Keyboard RGB", "gaming", 189, 229, 4.7, 534, "sale", "/shop/keyboard.jpg", "Mechanical RGB keyboard with hot-swap switches and aluminum frame.", 1),
]

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

DEFAULT_REPAIR_SERVICES = [
    ("r1", "Galaxy Screen Refresh", "Samsung", "Screen replacement", 12999, "45 minutes", "6 months", "/shop/hero-phone.jpg", "Fast Samsung screen replacement with premium glass.", 1, "cat-screen"),
    ("r2", "iPhone Battery Upgrade", "Apple", "Battery replacement", 7999, "30 minutes", "6 months", "/shop/hero-phone.jpg", "Genuine Apple battery replacement and performance tune-up.", 1, "cat-battery"),
    ("r3", "Xiaomi Charging Port Fix", "Xiaomi", "Charging port repair", 3499, "30 minutes", "3 months", "/shop/hero-phone.jpg", "Charging and USB port repair for Xiaomi models.", 1, "cat-port"),
    ("r4", "Oppo Camera Calibration", "Oppo", "Camera repair", 4999, "1 hour", "3 months", "/shop/camera.jpg", "Front and rear camera repair with calibration.", 1, "cat-camera"),
    ("r5", "Huawei Speaker Tune-Up", "Huawei", "Speaker repair", 2999, "30 minutes", "3 months", "/shop/speaker.jpg", "Audio and speaker repair for clear call quality.", 1, "cat-speaker"),
    ("r6", "Tecno Mic Recovery", "Tecno", "Microphone repair", 2799, "30 minutes", "3 months", "/shop/headphones.jpg", "Microphone repair for voice and call clarity.", 1, "cat-microphone"),
    ("r7", "Infinix Software Restore", "Infinix", "Software / OS issues", 2499, "1 hour", "1 month", "/shop/hero-phone.jpg", "Software recovery, OS update and malware cleanup.", 1, "cat-software"),
    ("r8", "Water Damage Rescue", "All brands", "Water damage repair", 7499, "2 days", "6 months", "/shop/hero-phone.jpg", "Water damage diagnostics and repair for wet devices.", 1, "cat-water"),
    ("r9", "Motherboard Repair", "All brands", "Motherboard repair", 15999, "3 days", "6 months", "/shop/console.jpg", "Full motherboard repair and component replacement.", 1, "cat-motherboard"),
    ("r10", "Back Glass Replacement", "All brands", "Back glass replacement", 4999, "1 hour", "3 months", "/shop/hero-phone.jpg", "Premium back glass replacement with safe finish.", 1, "cat-backglass"),
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

DEFAULT_SPARE_PARTS = [
    ("sp1", "LCD Screen", "Samsung", "Screen", 4999, 15, "/uploads/screen-samsung.jpg", "Original LCD replacement for Samsung Galaxy series"),
    ("sp2", "AMOLED Display", "Samsung", "Screen", 8999, 10, "/uploads/amoled-samsung.jpg", "Premium AMOLED screen for Galaxy flagships"),
    ("sp3", "Battery 5000mAh", "Samsung", "Battery", 2999, 25, "/uploads/battery-samsung.jpg", "High capacity replacement battery for Galaxy devices"),
    ("sp4", "Charging Port", "Samsung", "Charging Port", 1799, 30, "/uploads/charging-port.jpg", "USB-C charging port assembly"),
    ("sp5", "LCD Screen", "Apple", "Screen", 6999, 15, "/uploads/screen-apple.jpg", "Retina LCD screen for iPhone"),
    ("sp6", "Battery 3000mAh", "Apple", "Battery", 3499, 20, "/uploads/battery-apple.jpg", "Original Apple battery replacement"),
    ("sp7", "Charging Port", "Apple", "Charging Port", 2199, 25, "/uploads/lightning-port.jpg", "Lightning connector port assembly"),
    ("sp8", "LCD Screen", "Tecno", "Screen", 2999, 20, "/uploads/screen-tecno.jpg", "LCD replacement for Tecno Spark/Camon"),
    ("sp9", "Battery 5000mAh", "Tecno", "Battery", 1999, 30, "/uploads/battery-tecno.jpg", "Large capacity battery for Tecno devices"),
    ("sp10", "Charging Port", "Tecno", "Charging Port", 999, 30, "/uploads/charging-tecno.jpg", "USB port for Tecno devices"),
    ("sp11", "LCD Screen", "Infinix", "Screen", 2499, 25, "/uploads/screen-infinix.jpg", "LCD display for Infinix Hot/Note"),
    ("sp12", "Battery 4000mAh", "Infinix", "Battery", 1899, 30, "/uploads/battery-infinix.jpg", "Infinix Note/Hot series battery"),
    ("sp13", "Charging Port", "Infinix", "Charging Port", 899, 35, "/uploads/charging-infinix.jpg", "Micro USB charging port"),
    ("sp14", "LCD Screen", "Xiaomi", "Screen", 3499, 18, "/uploads/screen-xiaomi.jpg", "LCD for Xiaomi Redmi/Poco"),
    ("sp15", "Battery 5000mAh", "Xiaomi", "Battery", 2499, 25, "/uploads/battery-xiaomi.jpg", "Xiaomi Redmi battery replacement"),
    ("sp16", "Charging Port", "Xiaomi", "Charging Port", 1299, 28, "/uploads/charging-xiaomi.jpg", "USB-C charging port"),
]

REPAIR_STATUSES = [
    ("Pending", 10),
    ("Received", 20),
    ("Diagnosing", 30),
    ("Repairing", 40),
    ("Completed", 50),
    ("Ready for pickup", 60),
]

def county_id_for(name):
    return "c-" + name.lower().replace(" ", "-").replace("'", "")

def slug_id(value):
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")

def clean_area_name(value):
    return " ".join(str(value).strip().strip(".").split())

def seed_county_locations(conn, now):
    county_ids = {}
    for county_name in DEFAULT_COUNTIES:
        default_cid = county_id_for(county_name)
        conn.execute("INSERT OR IGNORE INTO counties (id, name) VALUES (?,?)", (default_cid, county_name))
        row = conn.execute("SELECT id FROM counties WHERE name = ?", (county_name,)).fetchone()
        cid = row["id"] if row else default_cid
        county_ids[county_name] = cid
        zid = f"z-{cid}"
        drid = f"dr-{cid}"
        conn.execute(
            "INSERT OR IGNORE INTO delivery_zones (id, name, description) VALUES (?,?,?)",
            (zid, f"{county_name} Zone", f"Default delivery zone for {county_name} County"),
        )
        conn.execute(
            "INSERT OR IGNORE INTO delivery_rates (id, delivery_zone_id, base_fee, weight_multiplier, distance_multiplier, created_at) VALUES (?,?,?,?,?,?)",
            (drid, zid, 650, 0.5, 0.0, now),
        )
        if cid != default_cid:
            conn.execute(
                "UPDATE sub_locations SET county_id = ?, delivery_zone_id = ? WHERE county_id = ?",
                (cid, zid, default_cid),
            )

    for county_name, groups in KENYA_COUNTY_AREAS.items():
        cid = county_ids.get(county_name, county_id_for(county_name))
        zid = f"z-{cid}"
        existing = {
            clean_area_name(row["name"]).lower()
            for row in conn.execute("SELECT name FROM sub_locations WHERE county_id = ?", (cid,)).fetchall()
        }
        area_names = [*groups.get("constituencies", []), *groups.get("locations", [])]
        for raw_name in area_names:
            name = clean_area_name(raw_name)
            if not name:
                continue
            key = name.lower()
            if key in existing:
                continue
            sid = f"sl-{cid}-{slug_id(name)}"
            conn.execute(
                "INSERT OR IGNORE INTO sub_locations (id, county_id, name, delivery_zone_id) VALUES (?,?,?,?)",
                (sid, cid, name, zid),
            )
            existing.add(key)

def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.isolation_level = None
    return conn

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
        conn.executescript("""
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

        now = datetime.now(timezone.utc).isoformat()
        if conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0:
            conn.executemany(
                "INSERT INTO users (id,name,email,password_hash,role,created_at) VALUES (?,?,?,?,?,?)",
                [
                    ("u-admin", "Store Admin", "admin@smdynamics.com", hash_password("admin123"), "admin", now),
                    ("u-staff", "Order Staff", "staff@smdynamics.com", hash_password("staff123"), "staff", now),
                ],
            )
        
        product_count = conn.execute("SELECT COUNT(*) FROM products").fetchone()[0]
        print(f"📊 Current product count in database: {product_count}")
        
        if product_count == 0:
            print("🌱 Seeding default products...")
            conn.executemany(
                """INSERT INTO products
                (id,name,cat,price,was,rating,reviews,badge,img,desc,in_stock,created_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
                [(*p, now) for p in DEFAULT_PRODUCTS],
            )
            print(f"✅ Seeded {len(DEFAULT_PRODUCTS)} default products")
        else:
            print(f"✅ Keeping existing {product_count} products (not reseeding)")
            
        if conn.execute("SELECT COUNT(*) FROM repair_categories").fetchone()[0] == 0:
            conn.executemany(
                "INSERT INTO repair_categories (id,name,slug,created_at) VALUES (?,?,?,?)",
                [(*c, now) for c in DEFAULT_REPAIR_CATEGORIES],
            )
        if conn.execute("SELECT COUNT(*) FROM repair_services").fetchone()[0] == 0:
            conn.executemany(
                "INSERT INTO repair_services (id,title,brand,repair_type,price,duration,warranty,image,description,available,category_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                [(*s, now) for s in DEFAULT_REPAIR_SERVICES],
            )
        if conn.execute("SELECT COUNT(*) FROM repair_statuses").fetchone()[0] == 0:
            conn.executemany(
                "INSERT INTO repair_statuses (status,sequence) VALUES (?,?)",
                REPAIR_STATUSES,
            )
        if conn.execute("SELECT COUNT(*) FROM device_models").fetchone()[0] == 0:
            rows = []
            now = datetime.now(timezone.utc).isoformat()
            for brand, models in DEFAULT_DEVICE_MODELS.items():
                for m in models:
                    rows.append(("m-" + secrets.token_hex(8), brand, m, now))
            conn.executemany("INSERT INTO device_models (id,brand,model,created_at) VALUES (?,?,?,?)", rows)
        if conn.execute("SELECT COUNT(*) FROM spare_parts").fetchone()[0] == 0:
            conn.executemany(
                "INSERT INTO spare_parts (id,name,brand,category,price,stock,image_path,description,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
                [(*p, now) for p in DEFAULT_SPARE_PARTS],
            )
        if conn.execute("SELECT COUNT(*) FROM settings").fetchone()[0] == 0:
            conn.execute("INSERT INTO settings (key, value) VALUES ('delivery_fee', '600')")
        seed_county_locations(conn, now)

        migrations = [
            ("orders", "delivery_fee",     "REAL DEFAULT 0"),
            ("orders", "deposit_amount",   "REAL DEFAULT 0"),
            ("orders", "remaining_amount", "REAL DEFAULT 0"),
            ("orders", "payment_status",   "TEXT DEFAULT 'Pending'"),
            ("orders", "county",           "TEXT"),
            ("orders", "constituency",     "TEXT"),
            ("orders", "street",           "TEXT"),
            ("orders", "deposit_mpesa",    "TEXT"),
        ]
        existing_cols = {}
        for table, col, col_def in migrations:
            if table not in existing_cols:
                existing_cols[table] = {r[1] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()}
            if col not in existing_cols[table]:
                conn.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_def}")
                existing_cols[table].add(col)


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
        "desc": row["desc"],
        "inStock": bool(row["in_stock"]),
        "specs": {"Category": row["cat"], "Warranty": "2 years", "Stock": "Available" if row["in_stock"] else "Out of stock"},
    }


def public_user(row):
    return {"id": row["id"], "name": row["name"], "email": row["email"], "role": row["role"]}


def row_order(conn, row):
    items = conn.execute("SELECT * FROM order_items WHERE order_id = ?", (row["id"],)).fetchall()
    user = conn.execute("SELECT name,email FROM users WHERE id = ?", (row["user_id"],)).fetchone()
    keys = row.keys()
    return {
        "id": row["id"],
        "userId": row["user_id"],
        "customer": user["name"] if user else "Unknown",
        "email": user["email"] if user else "Unknown",
        "total": row["total"],
        "deliveryFee": row["delivery_fee"] if "delivery_fee" in keys else 0,
        "depositAmount": row["deposit_amount"] if "deposit_amount" in keys else 0,
        "remainingAmount": row["remaining_amount"] if "remaining_amount" in keys else 0,
        "paymentStatus": row["payment_status"] if "payment_status" in keys else "Pending",
        "status": row["status"],
        "createdAt": row["created_at"],
        "items": [{"id": i["product_id"], "name": i["name"], "price": i["price"], "qty": i["qty"], "img": i["img"]} for i in items],
        "location": {
            "county": row["county"] if "county" in keys else "",
            "constituency": row["constituency"] if "constituency" in keys else "",
            "street": row["street"] if "street" in keys else ""
        },
        "depositMpesa": row["deposit_mpesa"] if "deposit_mpesa" in keys else None
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
        "description": row["description"],
        "available": bool(row["available"]),
        "categoryId": row["category_id"],
        "category": row["category_name"] if "category_name" in row.keys() else "",
    }

def row_repair_technician(row):
    return {
        "id": row["id"],
        "name": row["name"],
        "email": row["email"],
    }


def row_repair_booking(conn, row):
    service = None
    if row["repair_service_id"]:
        service = conn.execute("SELECT title FROM repair_services WHERE id = ?", (row["repair_service_id"],)).fetchone()
    tech = None
    if row["technician_id"]:
        tech = conn.execute("SELECT name FROM repair_technicians WHERE id = ?", (row["technician_id"],)).fetchone()
    return {
        "id": row["id"],
        "userId": row["user_id"],
        "customer": row["name"],
        "name": row["name"],
        "email": row["email"],
        "phone": row["phone"],
        "brand": row["brand"],
        "model": row["model"],
        "repairServiceId": row["repair_service_id"],
        "technicianId": row["technician_id"],
        "repairServiceTitle": service["title"] if service else "",
        "repairType": row["repair_type"],
        "description": row["description"],
        "imagePath": row["image_path"],
        "pickupDropoff": row["pickup_dropoff"],
        "preferredAt": row["preferred_at"],
        "status": row["status"],
        "technician": tech["name"] if tech else "",
        "technicianNotes": row["technician_notes"],
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
            session = conn.execute("SELECT user_id FROM sessions WHERE sid = ?", (sid.value,)).fetchone()
            if not session:
                return None
            return conn.execute("SELECT * FROM users WHERE id = ?", (session["user_id"],)).fetchone()

    def set_session(self, user_id):
        sid = secrets.token_urlsafe(32)
        with db() as conn:
            conn.execute(
                "INSERT INTO sessions (sid, user_id, created_at) VALUES (?,?,?)",
                (sid, user_id, datetime.now(timezone.utc).isoformat())
            )
            cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
            conn.execute("DELETE FROM sessions WHERE created_at < ?", (cutoff,))
        self.send_header("Set-Cookie", f"sid={sid}; HttpOnly; SameSite=Lax; Path=/")

    def clear_session(self):
        jar = cookies.SimpleCookie(self.headers.get("Cookie"))
        sid = jar.get("sid")
        if sid:
            with db() as conn:
                conn.execute("DELETE FROM sessions WHERE sid = ?", (sid.value,))
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
        
        # API endpoints
        if path == "/api/spare-parts":
            brand = query.get("brand", [""])[0]
            category = query.get("category", [""])[0]
            search = query.get("search", [""])[0].lower()
            with db() as conn:
                q = "SELECT * FROM spare_parts WHERE 1=1"
                params = []
                if brand:
                    q += " AND LOWER(brand) = LOWER(?)"
                    params.append(brand)
                if category:
                    q += " AND LOWER(category) = LOWER(?)"
                    params.append(category)
                if search:
                    q += " AND (LOWER(name) LIKE ? OR LOWER(description) LIKE ?)"
                    term = f"%{search}%"
                    params.extend([term, term])
                q += " ORDER BY brand, category, name"
                rows = conn.execute(q, params).fetchall()
                self.send_json({"spares": [{"id": r["id"], "name": r["name"], "brand": r["brand"], "category": r["category"], "price": r["price"], "stock": r["stock"], "image": r["image_path"], "description": r["description"]} for r in rows]})
            return
        
        if path == "/api/management/orders/placed":
            user = self.require({"staff", "admin"})
            if not user:
                return
            with db() as conn:
                rows = conn.execute("SELECT * FROM orders ORDER BY created_at DESC").fetchall()
                result = [row_order(conn, r) for r in rows]
            self.send_json({"orders": result})
            return
        
        if path == "/api/management/repair-bookings":
            if not self.require({"staff", "admin"}):
                return
            with db() as conn:
                rows = conn.execute("SELECT * FROM repair_bookings ORDER BY created_at DESC").fetchall()
                self.send_json({"bookings": [row_repair_booking(conn, r) for r in rows]})
            return
        
        if path == "/api/management/repair-services":
            if not self.require({"admin"}):
                return
            with db() as conn:
                rows = conn.execute("SELECT r.*, c.name AS category_name FROM repair_services r LEFT JOIN repair_categories c ON r.category_id = c.id ORDER BY r.created_at DESC").fetchall()
                self.send_json({"services": [row_repair_service(r) for r in rows]})
            return
        
        if path == "/api/admin/delivery-fee":
            if not self.require({"admin"}):
                return
            with db() as conn:
                setting = conn.execute("SELECT value FROM settings WHERE key = 'delivery_fee'").fetchone()
                fee = int(setting['value']) if setting else 600
                self.send_json({"fee": fee})
            return
        
        if path == "/api/repair/categories":
            with db() as conn:
                rows = conn.execute("SELECT id, name, slug FROM repair_categories ORDER BY name").fetchall()
                self.send_json({"categories": [{"id": r["id"], "name": r["name"], "slug": r["slug"]} for r in rows]})
            return

        if path == "/api/repair/services":
            with db() as conn:
                rows = conn.execute(
                    "SELECT r.*, c.name AS category_name FROM repair_services r "
                    "LEFT JOIN repair_categories c ON r.category_id = c.id "
                    "ORDER BY r.created_at DESC"
                ).fetchall()
                self.send_json({"services": [row_repair_service(r) for r in rows]})
            return

        if path == "/api/delivery-fee":
            with db() as conn:
                setting = conn.execute("SELECT value FROM settings WHERE key = 'delivery_fee'").fetchone()
                fee = int(setting['value']) if setting else 600
                self.send_json({"fee": fee})
            return

        if path == "/api/locations/counties":
            with db() as conn:
                rows = conn.execute("SELECT id, name FROM counties ORDER BY name").fetchall()
                self.send_json({"counties": [{"id": r["id"], "name": r["name"]} for r in rows]})
            return

        if path == "/api/admin/analytics":
            if not self.require({"admin"}):
                return
            with db() as conn:
                total_sales = conn.execute("SELECT COALESCE(SUM(total), 0) FROM orders").fetchone()[0]
                total_orders = conn.execute("SELECT COUNT(*) FROM orders").fetchone()[0]
                delivered = conn.execute("SELECT COUNT(*) FROM orders WHERE status = 'Delivered'").fetchone()[0]
                product_count = conn.execute("SELECT COUNT(*) FROM products").fetchone()[0]
                days_data = []
                for i in range(6, -1, -1):
                    day_label = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][(datetime.now(timezone.utc).weekday() - i) % 7]
                    offset = timedelta(days=i)
                    day_start = (datetime.now(timezone.utc) - offset).strftime("%Y-%m-%d")
                    day_sales = conn.execute(
                        "SELECT COALESCE(SUM(total), 0) FROM orders WHERE DATE(created_at) = ?", (day_start,)
                    ).fetchone()[0]
                    day_orders = conn.execute(
                        "SELECT COUNT(*) FROM orders WHERE DATE(created_at) = ?", (day_start,)
                    ).fetchone()[0]
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
                rows = conn.execute("SELECT * FROM products ORDER BY created_at DESC").fetchall()
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
                rows = conn.execute("SELECT * FROM users WHERE role = 'staff' ORDER BY created_at DESC").fetchall()
                self.send_json({"staff": [public_user(r) for r in rows]})
            return
        
        if path == "/api/repair/technicians":
            with db() as conn:
                rows = conn.execute("SELECT * FROM repair_technicians ORDER BY name").fetchall()
                self.send_json({"technicians": [row_repair_technician(r) for r in rows]})
            return
        
        # Serve static files
        file_path = unquote(path).lstrip("/")
        if ".." in file_path:
            self.send_error(403)
            return
        
        target = (ROOT / file_path).resolve()
        if not str(target).startswith(str(ROOT)):
            self.send_error(403)
            return
        
        if not target.exists() or target.is_dir():
            self.send_error(404)
            return
        
        body = target.read_bytes()
        self.send_response(200)
        if path.endswith(('.jpg', '.jpeg', '.png', '.gif', '.webp', '.ico')):
            self.send_header("Cache-Control", "public, max-age=86400")
        else:
            self.send_header("Cache-Control", "no-cache")
        self.send_header("Content-Type", mimetypes.guess_type(str(target))[0] or "application/octet-stream")
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
                user = conn.execute("SELECT * FROM users WHERE email = ? AND role IN ('admin', 'staff')", (email,)).fetchone()
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
                user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
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
                if conn.execute("SELECT 1 FROM users WHERE email = ?", (email,)).fetchone():
                    self.send_json({"error": "Email already exists"}, 409)
                    return
                user_id = "u-" + secrets.token_hex(8)
                conn.execute("INSERT INTO users VALUES (?,?,?,?,?,?)", (user_id, name, email, hash_password(password), "customer", datetime.now(timezone.utc).isoformat()))
                user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
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
                conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('delivery_fee', ?)", (str(fee),))
            self.send_json({"ok": True})
            return
        
        if path == "/api/admin/spare-parts":
            if not self.require({"admin"}):
                return
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
            image_path = None
            image = files.get("image")
            if image:
                ext = Path(image["filename"]).suffix.lower() or ".jpg"
                filename = f"spare_{secrets.token_hex(8)}{ext}"
                image_path = f"/uploads/{filename}"
                with (UPLOAD_DIR / filename).open("wb") as f:
                    f.write(image["content"])
            spare_id = "sp-" + secrets.token_hex(8)
            now = datetime.now(timezone.utc).isoformat()
            with db() as conn:
                conn.execute(
                    "INSERT INTO spare_parts (id,name,brand,category,price,stock,image_path,description,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
                    (spare_id, name, brand, category, price, stock, image_path, description, now),
                )
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
                if conn.execute("SELECT 1 FROM users WHERE email = ?", (email,)).fetchone():
                    self.send_json({"error": "Email already exists"}, 409)
                    return
                user_id = "u-" + secrets.token_hex(8)
                conn.execute("INSERT INTO users VALUES (?,?,?,?,?,?)", (user_id, name, email, hash_password(password), "staff", datetime.now(timezone.utc).isoformat()))
                self.send_json({"ok": True})
            return
        
        if path == "/api/admin/products":
            if not self.require({"admin"}):
                return
            print("📦 Received product submission")
            form, files = self.read_multipart()
            print(f"📝 Form fields: {list(form.keys())}")
            print(f"📎 Files: {list(files.keys())}")
            image = files.get("img")
            if not image:
                self.send_json({"error": "Product image is required"}, 400)
                return
            ext = Path(image["filename"]).suffix.lower() or ".jpg"
            filename = secrets.token_hex(12) + ext
            target = UPLOAD_DIR / filename
            with target.open("wb") as f:
                f.write(image["content"])
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
            with db() as conn:
                conn.execute(
                    "INSERT INTO products (id,name,cat,price,was,rating,reviews,badge,img,desc,in_stock,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                    (product_id, name, category, price, was_price, 4.6, 0, badge_value, f"/uploads/{filename}", desc, 1, datetime.now(timezone.utc).isoformat()),
                )
            print(f"✅ Product added: {product_id} - {name}")
            self.send_json({"ok": True, "id": product_id})
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
                if conn.execute("SELECT 1 FROM repair_technicians WHERE email = ?", (email,)).fetchone():
                    self.send_json({"error": "Technician already exists"}, 409)
                    return
                tech_id = "t-" + secrets.token_hex(8)
                conn.execute("INSERT INTO repair_technicians (id,name,email,created_at) VALUES (?,?,?,?)", (tech_id, name, email, datetime.now(timezone.utc).isoformat()))
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
                conn.execute(
                    "INSERT INTO repair_services (id,title,brand,repair_type,price,duration,warranty,image,description,available,category_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                    (
                        service_id,
                        form.get("title", "").strip(),
                        form.get("brand", "").strip(),
                        form.get("repairType", "").strip(),
                        float(form.get("price", "0") or 0),
                        form.get("duration", "").strip(),
                        form.get("warranty", "").strip(),
                        f"/uploads/{filename}",
                        form.get("description", "").strip(),
                        1,
                        form.get("categoryId", None),
                        datetime.now(timezone.utc).isoformat(),
                    ),
                )
            self.send_json({"ok": True})
            return
        
        # ============================================
        # REPAIR BOOKING ENDPOINT - FIXED
        # ============================================
        if path == "/api/repair/bookings":
            data = self.read_json()
            booking_id = "bk-" + secrets.token_hex(8)
            now = datetime.now(timezone.utc).isoformat()
            print(f"📝 New repair booking: {data.get('name')} - {data.get('repairType')}")
            with db() as conn:
                conn.execute("""
                    INSERT INTO repair_bookings 
                    (id, name, email, phone, brand, model, repair_service_id, repair_type, description, pickup_dropoff, preferred_at, status, created_at)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
                """, (
                    booking_id,
                    data.get("name"),
                    data.get("email"),
                    data.get("phone"),
                    data.get("brand"),
                    data.get("model"),
                    data.get("repairServiceId"),
                    data.get("repairType"),
                    data.get("description"),
                    data.get("pickupDropoff") or "Dropoff",
                    data.get("preferredAt") or datetime.now(timezone.utc).isoformat(),
                    "Pending",
                    now
                ))
            self.send_json({"ok": True, "id": booking_id})
            return
        
        # ============================================
        # GET USER ORDERS - FIXED
        # ============================================
        if path == "/api/orders/my":
            user = self.require({"customer"})
            if not user:
                return
            with db() as conn:
                rows = conn.execute("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC", (user["id"],)).fetchall()
                result = [row_order(conn, r) for r in rows]
            self.send_json({"orders": result})
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
                delivery_fee_setting = conn.execute("SELECT value FROM settings WHERE key = 'delivery_fee'").fetchone()
                delivery_fee = int(delivery_fee_setting['value']) if delivery_fee_setting else 600
                order_id = "ORD-" + secrets.token_hex(4).upper()
                total = 0
                rows = []
                for item in cart:
                    pid = str(item.get("id"))
                    product = conn.execute("SELECT id, name, price, in_stock, img FROM products WHERE id = ?", (pid,)).fetchone()
                    if not product:
                        product = conn.execute("SELECT id, name, price, stock as in_stock, image_path as img FROM spare_parts WHERE id = ?", (pid,)).fetchone()
                    qty = int(item.get("qty", 1))
                    if not product or not product["in_stock"] or qty < 1:
                        self.send_json({"error": f"Product {pid} is unavailable"}, 400)
                        return
                    total += product["price"] * qty
                    rows.append((order_id, product["id"], product["name"], product["price"], qty, product["img"]))
                deposit_amount = delivery_fee
                remaining_amount = total
                conn.execute(
                    """INSERT INTO orders 
                    (id, user_id, total, delivery_fee, deposit_amount, remaining_amount, payment_status, 
                     county, constituency, street, deposit_mpesa, status, created_at) 
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (order_id, user["id"], total, delivery_fee, deposit_amount, remaining_amount, "Deposit Paid",
                     data.get("county"), data.get("constituency"), data.get("street"), 
                     data.get("depositMpesa"), "Placed", datetime.now(timezone.utc).isoformat())
                )
                conn.executemany("INSERT INTO order_items (order_id,product_id,name,price,qty,img) VALUES (?,?,?,?,?,?)", rows)
                order = conn.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
                self.send_json({"order": row_order(conn, order)})
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
                part = conn.execute("SELECT * FROM spare_parts WHERE id = ?", (spare_id,)).fetchone()
                if not part:
                    self.send_json({"error": "Spare part not found"}, 404)
                    return
                image_path = part["image_path"]
                image = files.get("image")
                if image:
                    if image_path and not image_path.startswith('/shop/'):
                        old_file = UPLOAD_DIR / Path(image_path).name
                        if old_file.exists():
                            old_file.unlink()
                    ext = Path(image["filename"]).suffix.lower() or ".jpg"
                    filename = f"spare_{secrets.token_hex(8)}{ext}"
                    image_path = f"/uploads/{filename}"
                    with (UPLOAD_DIR / filename).open("wb") as f:
                        f.write(image["content"])
                conn.execute(
                    "UPDATE spare_parts SET name = ?, brand = ?, category = ?, price = ?, stock = ?, image_path = ?, description = ? WHERE id = ?",
                    (name, brand, category, price, stock, image_path, description, spare_id),
                )
            self.send_json({"ok": True})
            return
        
        if path.startswith("/api/management/repair-services/"):
            if not self.require({"admin"}):
                return
            service_id = path.split("/")[-1]
            data = self.read_json()
            with db() as conn:
                conn.execute(
                    "UPDATE repair_services SET title = ?, brand = ?, repair_type = ?, price = ?, duration = ?, warranty = ?, description = ?, available = ? WHERE id = ?",
                    (data.get("title"), data.get("brand"), data.get("repairType"), data.get("price"), data.get("duration"), data.get("warranty"), data.get("description"), 1 if data.get("available") else 0, service_id),
                )
            self.send_json({"ok": True})
            return
        
        # ============================================
        # PRODUCT UPDATE - CRITICAL FIX
        # ============================================
        if path.startswith("/api/admin/products/"):
            if not self.require({"admin"}):
                return
            product_id = path.split("/")[-1]
            data = self.read_json()
            
            print(f"📝 Updating product {product_id}")
            print(f"   Badge value: {data.get('badge')}")
            
            with db() as conn:
                existing = conn.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
                if not existing:
                    self.send_json({"error": "Product not found"}, 404)
                    return
                
                existing_badge = existing["badge"] if "badge" in existing.keys() else ""
                existing_rating = existing["rating"] if "rating" in existing.keys() else 4.6
                existing_reviews = existing["reviews"] if "reviews" in existing.keys() else 0
                existing_in_stock = existing["in_stock"] if "in_stock" in existing.keys() else 1
                existing_desc = existing["desc"] if "desc" in existing.keys() else ""
                
                try:
                    conn.execute("""
                        UPDATE products 
                        SET name = ?, 
                            price = ?, 
                            was = ?, 
                            badge = ?, 
                            img = ?, 
                            rating = ?, 
                            reviews = ?, 
                            in_stock = ?, 
                            cat = ?, 
                            desc = ? 
                        WHERE id = ?
                    """, (
                        data.get("name", existing["name"]),
                        float(data.get("price", existing["price"])),
                        data.get("was") if data.get("was") else None,
                        data.get("badge", existing_badge),
                        data.get("img", existing["img"]),
                        float(data.get("rating", existing_rating)),
                        int(data.get("reviews", existing_reviews)),
                        1 if data.get("inStock", existing_in_stock) else 0,
                        data.get("cat", existing["cat"]),
                        data.get("desc", existing_desc),
                        product_id
                    ))
                    
                    updated = conn.execute("SELECT badge FROM products WHERE id = ?", (product_id,)).fetchone()
                    print(f"✅ Product updated - new badge: {updated['badge']}")
                    
                except Exception as e:
                    print(f"❌ Database error: {e}")
                    self.send_json({"error": str(e)}, 500)
                    return
                
            self.send_json({"ok": True, "badge": data.get("badge", "")})
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
            self.send_json({"ok": True})
            return
        
        if path.startswith("/api/admin/spare-parts/"):
            if not self.require({"admin"}):
                return
            spare_id = path.split("/")[-1]
            with db() as conn:
                part = conn.execute("SELECT image_path FROM spare_parts WHERE id = ?", (spare_id,)).fetchone()
                if part and part["image_path"]:
                    filename = part["image_path"].split('/')[-1]
                    default_images = ['hero-phone.jpg', 'headphones.jpg', 'laptop.jpg', 'watch.jpg', 'vr.jpg', 'earbuds.jpg', 'camera.jpg', 'console.jpg', 'tablet.jpg', 'speaker.jpg', 'drone.jpg', 'hub.jpg', 'keyboard.jpg', 'brand logo.png']
                    if filename not in default_images:
                        target = UPLOAD_DIR / filename
                        if target.exists():
                            target.unlink()
                conn.execute("DELETE FROM spare_parts WHERE id = ?", (spare_id,))
            self.send_json({"ok": True})
            return
        
        if path.startswith("/api/admin/products/"):
            if not self.require({"admin"}):
                return
            product_id = path.split("/")[-1]
            with db() as conn:
                product = conn.execute("SELECT img FROM products WHERE id = ?", (product_id,)).fetchone()
                if product and product["img"] and not product["img"].startswith('/shop/'):
                    filename = product["img"].split('/')[-1]
                    target = UPLOAD_DIR / filename
                    if target.exists():
                        target.unlink()
                conn.execute("DELETE FROM products WHERE id = ?", (product_id,))
            self.send_json({"ok": True})
            return
        
        if path.startswith("/api/management/repair-services/"):
            if not self.require({"admin"}):
                return
            service_id = path.split("/")[-1]
            with db() as conn:
                service = conn.execute("SELECT image FROM repair_services WHERE id = ?", (service_id,)).fetchone()
                if service and service["image"] and not service["image"].startswith('/shop/'):
                    filename = service["image"].split('/')[-1]
                    target = UPLOAD_DIR / filename
                    if target.exists():
                        target.unlink()
                conn.execute("DELETE FROM repair_services WHERE id = ?", (service_id,))
            self.send_json({"ok": True})
            return
        
        if path.startswith("/api/admin/staff/"):
            if not self.require({"admin"}):
                return
            user_id = path.split("/")[-1]
            with db() as conn:
                conn.execute("DELETE FROM users WHERE id = ? AND role = 'staff'", (user_id,))
            self.send_json({"ok": True})
            return
        
        if path.startswith("/api/management/repair-technicians/"):
            if not self.require({"admin"}):
                return
            tech_id = path.split("/")[-1]
            with db() as conn:
                conn.execute("DELETE FROM repair_technicians WHERE id = ?", (tech_id,))
            self.send_json({"ok": True})
            return
        
        self.send_json({"error": "Not found"}, 404)


if __name__ == "__main__":
    init_db()
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "8000"))
    print(f"S.M Dynamics server running at http://{host}:{port}")
    ThreadingHTTPServer((host, port), Handler).serve_forever()
