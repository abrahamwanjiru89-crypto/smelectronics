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
DB_PATH = ROOT / "shop.db"
UPLOAD_DIR = ROOT / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
SESSIONS = {}

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
    "Elgeyo-Marakwet": {
        "constituencies": ["Marakwet East", "Marakwet West", "Keiyo North", "Keiyo South"],
        "locations": ["Iten", "Kapsowar", "Chebiemit", "Tambach", "Flax", "Chepkorio"],
    },
    "Embu": {
        "constituencies": ["Manyatta", "Runyenjes", "Mbeere South", "Mbeere North"],
        "locations": ["Embu Town", "Runyenjes", "Siakago", "Kiritiri", "Manyatta", "Ishiara"],
    },
    "Garissa": {
        "constituencies": ["Garissa Township", "Balambala", "Lagdera", "Dadaab", "Fafi", "Ijara"],
        "locations": ["Garissa Town", "Balambala Town", "Dadaab", "Modogashe", "Bura East", "Masalani", "Hulugho"],
    },
    "Homa Bay": {
        "constituencies": ["Kasipul", "Kabondo Kasipul", "Karachuonyo", "Rangwe", "Homa Bay Town", "Ndhiwa", "Mbita", "Suba"],
        "locations": ["Homa Bay Town Centre", "Oyugis", "Kendu Bay", "Mbita Town", "Ndhiwa Town", "Rangwe Town", "Sindo"],
    },
    "Isiolo": {
        "constituencies": ["Isiolo North", "Isiolo South"],
        "locations": ["Isiolo Town", "Garbatulla", "Merti", "Kinna", "Oldonyiro", "Sericho"],
    },
    "Kajiado": {
        "constituencies": ["Kajiado North", "Kajiado Central", "Kajiado East", "Kajiado West", "Kajiado South"],
        "locations": ["Kajiado Town", "Kitengela", "Ngong", "Ongata Rongai", "Isinya", "Loitokitok", "Namanga", "Mashuuru"],
    },
    "Kakamega": {
        "constituencies": ["Lugari", "Likuyani", "Malava", "Lurambi", "Navakholo", "Mumias West", "Mumias East", "Matungu", "Butere", "Khwisero", "Shinyalu", "Ikolomani"],
        "locations": ["Kakamega Town", "Mumias", "Butere Town", "Khayega", "Malava Town", "Shianda", "Shinyalu"],
    },
    "Kericho": {
        "constituencies": ["Kipkelion East", "Kipkelion West", "Ainamoi", "Bureti", "Belgut", "Sigowet/Soin"],
        "locations": ["Kericho Town", "Litein", "Londiani", "Kipkelion", "Kapsuser", "Sosiot", "Kapsoit"],
    },
    "Kiambu": {
        "constituencies": ["Gatundu South", "Gatundu North", "Juja", "Thika Town", "Ruiru", "Githunguri", "Kiambu", "Kiambaa", "Kabete", "Kikuyu", "Limuru", "Lari"],
        "locations": ["Kiambu Town", "Thika", "Ruiru Town", "Kikuyu Town", "Limuru Town", "Githunguri", "Juja Town", "Ruaka", "Wangige"],
    },
    "Kilifi": {
        "constituencies": ["Kilifi North", "Kilifi South", "Kaloleni", "Rabai", "Ganze", "Malindi", "Magarini"],
        "locations": ["Kilifi Town", "Malindi Town", "Mtwapa", "Watamu", "Mariakani", "Kaloleni Town", "Ganze Town", "Rabai"],
    },
    "Kirinyaga": {
        "constituencies": ["Mwea", "Gichugu", "Ndia", "Kirinyaga Central"],
        "locations": ["Kerugoya", "Kutus", "Wanguru", "Sagana", "Kianyaga", "Baricho"],
    },
    "Kisii": {
        "constituencies": ["Bonchari", "South Mugirango", "Bomachoge Borabu", "Bobasi", "Bomachoge Chache", "Nyaribari Masaba", "Nyaribari Chache", "Kitutu Chache North", "Kitutu Chache South"],
        "locations": ["Kisii Town", "Ogembo", "Suneka", "Keroka", "Nyamache", "Tabaka", "Marani", "Keumbu"],
    },
    "Kisumu": {
        "constituencies": ["Kisumu East", "Kisumu West", "Kisumu Central", "Seme", "Nyando", "Muhoroni", "Nyakach"],
        "locations": ["Kisumu City", "Ahero", "Maseno", "Muhoroni Town", "Katito", "Kombewa", "Nyamasaria", "Mamboleo"],
    },
    "Kitui": {
        "constituencies": ["Mwingi North", "Mwingi West", "Mwingi Central", "Kitui West", "Kitui Rural", "Kitui Central", "Kitui East", "Kitui South"],
        "locations": ["Kitui Town", "Mwingi Town", "Mutomo", "Kabati", "Ikutha", "Tseikuru", "Kyuso"],
    },
    "Kwale": {
        "constituencies": ["Msambweni", "Lunga Lunga", "Matuga", "Kinango"],
        "locations": ["Kwale Town", "Diani", "Ukunda", "Msambweni Town", "Kinango Town", "Lunga Lunga", "Samburu", "Matuga"],
    },
    "Laikipia": {
        "constituencies": ["Laikipia West", "Laikipia East", "Laikipia North"],
        "locations": ["Nanyuki", "Nyahururu", "Rumuruti", "Dol Dol", "Wiyumiririe", "Lamuria"],
    },
    "Lamu": {
        "constituencies": ["Lamu East", "Lamu West"],
        "locations": ["Lamu Town", "Mpeketoni", "Faza", "Kiunga", "Hindi", "Witu"],
    },
    "Machakos": {
        "constituencies": ["Masinga", "Yatta", "Kangundo", "Matungulu", "Kathiani", "Mavoko", "Machakos Town", "Mwala"],
        "locations": ["Machakos Town Centre", "Athi River", "Kangundo Town", "Tala", "Matuu", "Masii", "Mlolongo"],
    },
    "Makueni": {
        "constituencies": ["Mbooni", "Kilome", "Kaiti", "Makueni", "Kibwezi West", "Kibwezi East"],
        "locations": ["Wote", "Mtito Andei", "Makindu", "Sultan Hamud", "Emali", "Kibwezi", "Tawa"],
    },
    "Mandera": {
        "constituencies": ["Mandera West", "Banissa", "Mandera North", "Mandera South", "Mandera East", "Lafey"],
        "locations": ["Mandera Town", "Rhamu", "Elwak", "Takaba", "Banissa Town", "Arabia", "Lafey Town"],
    },
    "Marsabit": {
        "constituencies": ["Moyale", "North Horr", "Saku", "Laisamis"],
        "locations": ["Marsabit Town", "Moyale Town", "Sololo", "North Horr Town", "Loiyangalani", "Laisamis Town"],
    },
    "Meru": {
        "constituencies": ["Igembe South", "Igembe Central", "Igembe North", "Tigania West", "Tigania East", "North Imenti", "Buuri", "Central Imenti", "South Imenti"],
        "locations": ["Meru Town", "Maua", "Nkubu", "Timau", "Mikinduri", "Laare", "Kianjai"],
    },
    "Migori": {
        "constituencies": ["Rongo", "Awendo", "Suna East", "Suna West", "Uriri", "Nyatike", "Kuria West", "Kuria East"],
        "locations": ["Migori Town", "Awendo Town", "Rongo Town", "Isebania", "Kehancha", "Suna", "Macalder", "Nyatike"],
    },
    "Mombasa": {
        "constituencies": ["Changamwe", "Jomvu", "Kisauni", "Nyali", "Likoni", "Mvita"],
        "locations": ["Port Reitz", "Kipevu", "Airport", "Bamburi", "Tudor", "Majengo", "Ganjoni", "Kongowea"],
    },
    "Murang'a": {
        "constituencies": ["Kangema", "Mathioya", "Kiharu", "Kigumo", "Maragua", "Kandara", "Gatanga"],
        "locations": ["Murang'a Town", "Kenol", "Maragua Town", "Kangema Town", "Kandara Town", "Gatanga Town", "Kiria-ini"],
    },
    "Nairobi": {
        "constituencies": ["Westlands", "Dagoretti North", "Dagoretti South", "Lang'ata", "Kibra", "Roysambu", "Kasarani", "Ruaraka", "Embakasi South", "Embakasi North", "Embakasi Central", "Embakasi East", "Embakasi West", "Makadara", "Kamukunji", "Starehe", "Mathare"],
        "locations": ["Parklands", "Kilimani", "Kileleshwa", "Lavington", "Karen", "South B", "South C", "Buruburu", "Eastleigh", "Pangani", "Umoja", "Donholm", "Kayole", "Pipeline", "Dandora", "Kariobangi", "Githurai 44", "CBD", "Upper Hill", "Industrial Area"],
    },
    "Nakuru": {
        "constituencies": ["Molo", "Njoro", "Naivasha", "Gilgil", "Kuresoi South", "Kuresoi North", "Subukia", "Rongai", "Bahati", "Nakuru West", "Nakuru East"],
        "locations": ["Bondeni", "Kivumbini", "Flamingo", "Menengai", "Free Area", "Kaptembwo", "Rhonda", "Shabab", "London", "Kapkures", "Mai Mahiu", "Karagita", "Lake View", "Olkaria", "Hells Gate", "Elburgon", "Mariashoni", "Turi", "Molo Town", "Mau Narok", "Mauche", "Nessuit", "Lare", "Solai", "Soin", "Mosop", "Visoi"],
    },
    "Nandi": {
        "constituencies": ["Tinderet", "Aldai", "Nandi Hills", "Chesumei", "Emgwen", "Mosop"],
        "locations": ["Kapsabet", "Nandi Hills Town", "Kabiyet", "Mosoriot", "Kilibwoni", "Lessos"],
    },
    "Narok": {
        "constituencies": ["Kilgoris", "Emurua Dikirr", "Narok North", "Narok East", "Narok South", "Narok West"],
        "locations": ["Narok Town", "Kilgoris Town", "Ololulunga", "Mulot", "Suswa", "Emurua Dikirr Town", "Lolgorian"],
    },
    "Nyamira": {
        "constituencies": ["Kitutu Masaba", "West Mugirango", "North Mugirango", "Borabu"],
        "locations": ["Nyamira Town", "Keroka", "Ekerenyo", "Manga", "Nyansiongo", "Sironga"],
    },
    "Nyandarua": {
        "constituencies": ["Kinangop", "Kipipiri", "Ol Kalou", "Ol Jorok", "Ndaragwa"],
        "locations": ["Ol Kalou Town", "Engineer", "Njabini", "Ndaragwa Town", "Mairo Inya", "Ol Joro Orok"],
    },
    "Nyeri": {
        "constituencies": ["Tetu", "Kieni", "Mathira", "Othaya", "Mukurweini", "Nyeri Town"],
        "locations": ["Nyeri Town Centre", "Karatina", "Othaya Town", "Mukurweini Town", "Naro Moru", "Kiganjo", "Chaka"],
    },
    "Samburu": {
        "constituencies": ["Samburu West", "Samburu North", "Samburu East"],
        "locations": ["Maralal", "Baragoi", "Wamba", "Archers Post", "South Horr", "Suguta Marmar"],
    },
    "Siaya": {
        "constituencies": ["Ugenya", "Ugunja", "Alego Usonga", "Gem", "Bondo", "Rarieda"],
        "locations": ["Siaya Town", "Bondo Town", "Ugunja Town", "Yala", "Usenge", "Ukwala", "Sega"],
    },
    "Taita-Taveta": {
        "constituencies": ["Taveta", "Wundanyi", "Mwatate", "Voi"],
        "locations": ["Voi Town", "Taveta Town", "Wundanyi Town", "Mwatate Town", "Bura Station", "Maungu"],
    },
    "Tana River": {
        "constituencies": ["Garsen", "Galole", "Bura"],
        "locations": ["Hola", "Garsen Town", "Bura Town", "Madogo", "Kipini", "Bangale"],
    },
    "Tharaka-Nithi": {
        "constituencies": ["Maara", "Chuka/Igambang'ombe", "Tharaka"],
        "locations": ["Chuka", "Marimanti", "Chogoria", "Kathwana", "Gatunga", "Chiakariga"],
    },
    "Trans Nzoia": {
        "constituencies": ["Kwanza", "Endebess", "Saboti", "Kiminini", "Cherangany"],
        "locations": ["Kitale", "Kiminini Town", "Endebess Town", "Kwanza Town", "Cherangany", "Sikhendu", "Sibanga"],
    },
    "Turkana": {
        "constituencies": ["Turkana North", "Turkana West", "Turkana Central", "Loima", "Turkana South", "Turkana East"],
        "locations": ["Lodwar", "Lokichoggio", "Kakuma", "Lokichar", "Kalokol", "Lokitaung", "Lokori"],
    },
    "Uasin Gishu": {
        "constituencies": ["Soy", "Turbo", "Moiben", "Ainabkoi", "Kapseret", "Kesses"],
        "locations": ["Eldoret", "Turbo Town", "Moiben Town", "Burnt Forest", "Kesses Town", "Kapseret", "Ziwa"],
    },
    "Vihiga": {
        "constituencies": ["Vihiga", "Sabatia", "Hamisi", "Luanda", "Emuhaya"],
        "locations": ["Mbale", "Luanda Town", "Chavakali", "Majengo", "Kaimosi", "Hamisi Town"],
    },
    "Wajir": {
        "constituencies": ["Wajir North", "Wajir East", "Tarbaj", "Wajir West", "Eldas", "Wajir South"],
        "locations": ["Wajir Town", "Habaswein", "Griftu", "Buna", "Bute", "Eldas Town", "Tarbaj Town"],
    },
    "West Pokot": {
        "constituencies": ["Kapenguria", "Sigor", "Kacheliba", "Pokot South"],
        "locations": ["Kapenguria Town", "Makutano", "Chepareria", "Sigor Town", "Kacheliba Town", "Ortum", "Alale"],
    },
}

DEFAULT_SPARE_PARTS = [
    ("sp1", "LCD Screen", "Samsung", "Screen", 4999, 15, "/uploads/screen-samsung.jpg", "Original LCD replacement for Samsung Galaxy series"),
    ("sp2", "AMOLED Display", "Samsung", "Screen", 8999, 10, "/uploads/amoled-samsung.jpg", "Premium AMOLED screen for Galaxy flagships"),
    ("sp3", "Battery 5000mAh", "Samsung", "Battery", 2999, 25, "/uploads/battery-samsung.jpg", "High capacity replacement battery for Galaxy devices"),
    ("sp4", "Charging Port", "Samsung", "Charging Port", 1799, 30, "/uploads/charging-port.jpg", "USB-C charging port assembly"),
    ("sp5", "Rear Camera Module", "Samsung", "Camera", 3499, 12, "/uploads/rear-camera.jpg", "48MP rear camera module"),
    ("sp6", "Front Camera", "Samsung", "Camera", 1599, 20, "/uploads/front-camera.jpg", "Front camera module 12MP"),
    ("sp7", "Speaker Module", "Samsung", "Speaker", 1299, 18, "/uploads/speaker.jpg", "Loud speaker replacement"),
    ("sp8", "Microphone", "Samsung", "Microphone", 899, 25, "/uploads/microphone.jpg", "Microphone component"),
    ("sp9", "Back Glass Panel", "Samsung", "Back Cover", 2499, 12, "/uploads/back-glass.jpg", "Back glass panel with logo"),
    ("sp10", "LCD Screen", "Apple", "Screen", 6999, 15, "/uploads/screen-apple.jpg", "Retina LCD screen for iPhone"),
    ("sp11", "OLED Screen", "Apple", "Screen", 12999, 10, "/uploads/screen-oled.jpg", "Super Retina OLED for iPhone Pro"),
    ("sp12", "Battery 3000mAh", "Apple", "Battery", 3499, 20, "/uploads/battery-apple.jpg", "Original Apple battery replacement"),
    ("sp13", "Charging Lightning Port", "Apple", "Charging Port", 2199, 25, "/uploads/lightning-port.jpg", "Lightning connector port assembly"),
    ("sp14", "Rear Camera Module", "Apple", "Camera", 4999, 10, "/uploads/camera-apple.jpg", "12MP/48MP rear camera"),
    ("sp15", "Face ID Module", "Apple", "Camera", 5999, 8, "/uploads/faceid.jpg", "TrueDepth Face ID sensor"),
    ("sp16", "Speaker", "Apple", "Speaker", 1599, 15, "/uploads/speaker-apple.jpg", "Stereo speaker module"),
    ("sp17", "Battery 5000mAh", "Tecno", "Battery", 1999, 30, "/uploads/battery-tecno.jpg", "Large capacity battery for Tecno devices"),
    ("sp18", "LCD Screen", "Tecno", "Screen", 2999, 20, "/uploads/screen-tecno.jpg", "LCD replacement for Tecno Spark/Camon"),
    ("sp19", "Charging Port", "Tecno", "Charging Port", 999, 30, "/uploads/charging-tecno.jpg", "USB port for Tecno devices"),
    ("sp20", "Rear Camera", "Tecno", "Camera", 1599, 20, "/uploads/camera-tecno.jpg", "13MP-48MP camera module"),
    ("sp21", "Battery 4000mAh", "Infinix", "Battery", 1899, 30, "/uploads/battery-infinix.jpg", "Infinix Note/Hot series battery"),
    ("sp22", "LCD Screen", "Infinix", "Screen", 2499, 25, "/uploads/screen-infinix.jpg", "LCD display for Infinix Hot/Note"),
    ("sp23", "Charging Port", "Infinix", "Charging Port", 899, 35, "/uploads/charging-infinix.jpg", "Micro USB charging port"),
    ("sp24", "Rear Camera", "Infinix", "Camera", 1399, 22, "/uploads/camera-infinix.jpg", "Rear camera module"),
    ("sp25", "Battery 5000mAh", "Xiaomi", "Battery", 2499, 25, "/uploads/battery-xiaomi.jpg", "Xiaomi Redmi battery replacement"),
    ("sp26", "LCD Screen", "Xiaomi", "Screen", 3499, 18, "/uploads/screen-xiaomi.jpg", "LCD for Xiaomi Redmi/Poco"),
    ("sp27", "Charging Port", "Xiaomi", "Charging Port", 1299, 28, "/uploads/charging-xiaomi.jpg", "USB-C charging port"),
    ("sp28", "Rear Camera", "Xiaomi", "Camera", 2199, 15, "/uploads/camera-xiaomi.jpg", "48MP/64MP camera module"),
    ("sp29", "Battery 4000mAh", "Vivo", "Battery", 2299, 22, "/uploads/battery-vivo.jpg", "Vivo battery replacement"),
    ("sp30", "LCD Screen", "Vivo", "Screen", 3299, 16, "/uploads/screen-vivo.jpg", "Vivo LCD display"),
    ("sp31", "Charging Port", "Vivo", "Charging Port", 1199, 26, "/uploads/charging-vivo.jpg", "USB-C for Vivo"),
    ("sp32", "Rear Camera", "Vivo", "Camera", 1999, 14, "/uploads/camera-vivo.jpg", "64MP camera module"),
    ("sp33", "Battery 4500mAh", "Oppo", "Battery", 2399, 20, "/uploads/battery-oppo.jpg", "Oppo A/Reno series battery"),
    ("sp34", "LCD Screen", "Oppo", "Screen", 3599, 15, "/uploads/screen-oppo.jpg", "Oppo LCD replacement"),
    ("sp35", "Charging Port", "Oppo", "Charging Port", 1399, 24, "/uploads/charging-oppo.jpg", "USB-C for Oppo"),
    ("sp36", "Rear Camera", "Oppo", "Camera", 2099, 13, "/uploads/camera-oppo.jpg", "48MP/64MP camera module"),
    ("sp37", "Battery 3500mAh", "Nokia", "Battery", 1699, 28, "/uploads/battery-nokia.jpg", "Nokia battery replacement"),
    ("sp38", "LCD Screen", "Nokia", "Screen", 2299, 22, "/uploads/screen-nokia.jpg", "Nokia LCD display"),
    ("sp39", "Charging Port", "Nokia", "Charging Port", 799, 32, "/uploads/charging-nokia.jpg", "Micro USB port"),
    ("sp40", "Rear Camera", "Nokia", "Camera", 1199, 18, "/uploads/camera-nokia.jpg", "Camera module for Nokia"),
    ("sp41", "Charging Cable", "Samsung", "Cables", 499, 50, "/uploads/cable-samsung.jpg", "USB-C charging cable"),
    ("sp42", "Charging Cable", "Apple", "Cables", 699, 40, "/uploads/cable-apple.jpg", "Lightning charging cable"),
    ("sp43", "Screen Protector Glass", "Universal", "Accessories", 299, 100, "/uploads/protector.jpg", "Tempered glass screen protector"),
    ("sp44", "Phone Case", "Universal", "Accessories", 399, 80, "/uploads/case.jpg", "Protective phone case"),
    ("sp45", "Charging Plate", "Universal", "Charging Port", 1299, 25, "/uploads/charging-plate.jpg", "Charging dock connector plate"),
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
          county TEXT,
          constituency TEXT,
          street TEXT,
          deposit_amount REAL,
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
        if conn.execute("SELECT COUNT(*) FROM products").fetchone()[0] == 0:
            conn.executemany(
                """INSERT INTO products
                (id,name,cat,price,was,rating,reviews,badge,img,desc,in_stock,created_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
                [(*p, now) for p in DEFAULT_PRODUCTS],
            )
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
        # seed device models
        if conn.execute("SELECT COUNT(*) FROM device_models").fetchone()[0] == 0:
            rows = []
            now = datetime.now(timezone.utc).isoformat()
            for brand, models in DEFAULT_DEVICE_MODELS.items():
                for m in models:
                    rows.append(("m-" + secrets.token_hex(8), brand, m, now))
            conn.executemany("INSERT INTO device_models (id,brand,model,created_at) VALUES (?,?,?,?)", rows)
        # seed spare parts
        if conn.execute("SELECT COUNT(*) FROM spare_parts").fetchone()[0] == 0:
            conn.executemany(
                "INSERT INTO spare_parts (id,name,brand,category,price,stock,image_path,description,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
                [(*p, now) for p in DEFAULT_SPARE_PARTS],
            )
        seed_county_locations(conn, now)


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
    return {
        "id": row["id"],
        "userId": row["user_id"],
        "customer": user["name"] if user else "Unknown",
        "email": user["email"] if user else "Unknown",
        "total": row["total"],
        "status": row["status"],
        "createdAt": row["created_at"],
        "items": [{"id": i["product_id"], "name": i["name"], "price": i["price"], "qty": i["qty"], "img": i["img"]} for i in items],
        "location": {"county": row["county"], "constituency": row["constituency"], "street": row["street"]},
        "depositAmount": row["deposit_amount"],
        "depositMpesa": row["deposit_mpesa"]
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
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        if not length:
            return {}
        return json.loads(self.rfile.read(length).decode())

    def read_multipart(self):
        length = int(self.headers.get("Content-Length", "0"))
        content_type = self.headers.get("Content-Type", "")
        raw = self.rfile.read(length)
        message = BytesParser(policy=default).parsebytes(
            f"Content-Type: {content_type}\r\nMIME-Version: 1.0\r\n\r\n".encode() + raw
        )
        fields, files = {}, {}
        for part in message.iter_parts():
            disposition = part.get_params(header="content-disposition", failobj=[])
            params = {k: v for k, v in disposition if k}
            name = params.get("name")
            if not name:
                continue
            filename = params.get("filename")
            payload = part.get_payload(decode=True) or b""
            if filename:
                files[name] = {"filename": filename, "content": payload}
            else:
                fields[name] = payload.decode(errors="replace")
        return fields, files

    def current_user(self):
        jar = cookies.SimpleCookie(self.headers.get("Cookie"))
        sid = jar.get("sid")
        uid = SESSIONS.get(sid.value) if sid else None
        if not uid:
            return None
        with db() as conn:
            return conn.execute("SELECT * FROM users WHERE id = ?", (uid,)).fetchone()

    def set_session(self, user_id):
        sid = secrets.token_urlsafe(32)
        SESSIONS[sid] = user_id
        self.send_header("Set-Cookie", f"sid={sid}; HttpOnly; SameSite=Lax; Path=/")

    def clear_session(self):
        jar = cookies.SimpleCookie(self.headers.get("Cookie"))
        sid = jar.get("sid")
        if sid:
            SESSIONS.pop(sid.value, None)
        self.send_header("Set-Cookie", "sid=; Max-Age=0; HttpOnly; SameSite=Lax; Path=/")

    def require(self, roles):
        user = self.current_user()
        if not user or user["role"] not in roles:
            self.send_json({"error": "Forbidden"}, 403)
            return None
        return user

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") if parsed.path != "/" else "/"
        print('Incoming GET', path)
        query = parse_qs(parsed.query)
        if path == "/api/repair/categories":
            with db() as conn:
                rows = conn.execute("SELECT id,name,slug FROM repair_categories ORDER BY name").fetchall()
                self.send_json({"categories": [{"id": r["id"], "name": r["name"], "slug": r["slug"]} for r in rows]})
            return
        if path == "/api/locations/counties":
            with db() as conn:
                rows = conn.execute("SELECT id, name FROM counties ORDER BY name").fetchall()
                self.send_json({"counties": [dict(r) for r in rows]})
            return
        if path == "/api/locations/sublocations":
            cid = query.get("countyId", [None])[0]
            with db() as conn:
                if cid:
                    rows = conn.execute(
                        "SELECT id, county_id AS countyId, name, delivery_zone_id AS deliveryZoneId FROM sub_locations WHERE county_id = ? ORDER BY name",
                        (cid,),
                    ).fetchall()
                else:
                    rows = conn.execute(
                        "SELECT id, county_id AS countyId, name, delivery_zone_id AS deliveryZoneId FROM sub_locations ORDER BY name"
                    ).fetchall()
                self.send_json({"subLocations": [dict(r) for r in rows]})
            return
        if path == "/api/admin/delivery-rates":
            if not self.require({"admin"}): return
            with db() as conn:
                rows = conn.execute("SELECT dr.*, dz.name as zone_name FROM delivery_rates dr JOIN delivery_zones dz ON dr.delivery_zone_id = dz.id").fetchall()
                self.send_json({"rates": [dict(r) for r in rows]})
            return
        if path == "/api/repair/categories":
            with db() as conn:
                rows = conn.execute("SELECT id,name,slug FROM repair_categories ORDER BY name").fetchall()
                self.send_json({"categories": [{"id": r["id"], "name": r["name"], "slug": r["slug"]} for r in rows]})
            return
        if path == "/api/repair/statuses":
            with db() as conn:
                rows = conn.execute("SELECT status,sequence FROM repair_statuses ORDER BY sequence").fetchall()
                self.send_json({"statuses": [{"status": r["status"], "sequence": r["sequence"]} for r in rows]})
            return
        if path == "/api/repair/technicians":
            with db() as conn:
                rows = conn.execute("SELECT * FROM repair_technicians ORDER BY name").fetchall()
                self.send_json({"technicians": [row_repair_technician(r) for r in rows]})
            return
        if path == "/api/repair/services":
            with db() as conn:
                q = "SELECT r.*, c.name AS category_name FROM repair_services r LEFT JOIN repair_categories c ON r.category_id = c.id"
                filters = []
                params = []
                if query.get("brand"):
                    filters.append("LOWER(r.brand) = LOWER(?)")
                    params.append(query["brand"][0])
                if query.get("repairType"):
                    filters.append("LOWER(r.repair_type) = LOWER(?)")
                    params.append(query["repairType"][0])
                if query.get("category"):
                    filters.append("r.category_id = ?")
                    params.append(query["category"][0])
                if query.get("available"):
                    filters.append("r.available = ?")
                    params.append(1 if query["available"][0].lower() in {"1","true","yes"} else 0)
                if query.get("search"):
                    filters.append("(LOWER(r.title) LIKE ? OR LOWER(r.brand) LIKE ? OR LOWER(r.repair_type) LIKE ? OR LOWER(r.description) LIKE ?)")
                    term = f"%{query['search'][0].lower()}%"
                    params.extend([term, term, term, term])
                if filters:
                    q += " WHERE " + " AND ".join(filters)
                q += " ORDER BY r.created_at DESC"
                rows = conn.execute(q, params).fetchall()
                self.send_json({"services": [row_repair_service(r) for r in rows]})
            return
        if path == "/api/repair/models":
            brand = query.get("brand", [""])[0]
            q = query.get("q", [""])[0].strip().lower()
            with db() as conn:
                if q:
                    term = f"%{q}%"
                    if brand:
                        rows = conn.execute("SELECT DISTINCT model FROM device_models WHERE LOWER(model) LIKE ? AND brand = ? ORDER BY model LIMIT 50", (term, brand)).fetchall()
                    else:
                        rows = conn.execute("SELECT DISTINCT model FROM device_models WHERE LOWER(model) LIKE ? ORDER BY model LIMIT 50", (term,)).fetchall()
                else:
                    if brand:
                        rows = conn.execute("SELECT DISTINCT model FROM device_models WHERE brand = ? ORDER BY model LIMIT 50", (brand,)).fetchall()
                    else:
                        rows = conn.execute("SELECT DISTINCT model FROM device_models ORDER BY model LIMIT 50").fetchall()
                self.send_json({"models": [r[0] for r in rows]})
            return
        if path == "/api/repair/bookings/track":
            booking_id = query.get("bookingId", [""])[0]
            email = query.get("email", [""])[0]
            if not booking_id or not email:
                self.send_json({"error": "Missing bookingId or email"}, 400)
                return
            with db() as conn:
                row = conn.execute("SELECT * FROM repair_bookings WHERE id = ? AND LOWER(email) = LOWER(?)", (booking_id, email)).fetchone()
                if not row:
                    self.send_json({"error": "Booking not found"}, 404)
                    return
                self.send_json({"booking": row_repair_booking(conn, row)})
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
        if path == "/api/admin/repair-analytics":
            if not self.require({"admin"}):
                return
            with db() as conn:
                bookings = conn.execute("SELECT * FROM repair_bookings").fetchall()
                count_by_status = {}
                revenue = 0
                for b in bookings:
                    count_by_status[b["status"]] = count_by_status.get(b["status"], 0) + 1
                    if b["repair_service_id"]:
                        service = conn.execute("SELECT price FROM repair_services WHERE id = ?", (b["repair_service_id"],)).fetchone()
                        if service:
                            revenue += service["price"]
                most_requested = conn.execute("SELECT repair_type, COUNT(*) AS count FROM repair_bookings GROUP BY repair_type ORDER BY count DESC LIMIT 1").fetchone()
                self.send_json({
                    "totalBookings": len(bookings),
                    "statusCounts": count_by_status,
                    "mostRequested": most_requested["repair_type"] if most_requested else "-",
                    "revenue": revenue,
                })
            return
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
        if path == "/api/spare-parts/brands":
            with db() as conn:
                rows = conn.execute("SELECT DISTINCT brand FROM spare_parts ORDER BY brand").fetchall()
                self.send_json({"brands": [r[0] for r in rows]})
            return
            if path == "/api/places/autocomplete":
                # Proxy to Google Places Autocomplete. Requires env var GOOGLE_MAPS_API_KEY
                q = query.get('q', [''])[0]
                kind = query.get('type', ['sublocation'])[0]  # 'sublocation' or 'street' or 'address'
                county_name = query.get('countyName', [''])[0]
                api_key = os.environ.get('GOOGLE_MAPS_API_KEY')
                if not api_key:
                    self.send_json({"error": "Google API key not configured. Set GOOGLE_MAPS_API_KEY env var."}, 400)
                    return
                # Build input; if county provided, bias the input by prefixing it
                inp = (county_name + ' ' + q).strip() if county_name else q
                params = {'input': inp, 'key': api_key, 'components': 'country:ke'}
                # choose types: use address for street suggestions, geocode/regions for localities
                if kind == 'street' or kind == 'address':
                    params['types'] = 'address'
                else:
                    params['types'] = '(regions)'
                url = 'https://maps.googleapis.com/maps/api/place/autocomplete/json?' + urlencode(params)
                try:
                    with urllib.request.urlopen(url, timeout=10) as resp:
                        body = resp.read().decode()
                        data = json.loads(body)
                except Exception as e:
                    self.send_json({"error": "Failed to contact Google Places: " + str(e)}, 502)
                    return
                # Return a simplified list of predictions
                preds = []
                for p in data.get('predictions', []):
                    preds.append({
                        'description': p.get('description'),
                        'place_id': p.get('place_id'),
                        'structured_formatting': p.get('structured_formatting', {})
                    })
                self.send_json({'predictions': preds})
                return
        if path == "/api/spare-parts/categories":
            brand = query.get("brand", [""])[0]
            with db() as conn:
                if brand:
                    rows = conn.execute("SELECT DISTINCT category FROM spare_parts WHERE brand = ? ORDER BY category", (brand,)).fetchall()
                else:
                    rows = conn.execute("SELECT DISTINCT category FROM spare_parts ORDER BY category").fetchall()
                self.send_json({"categories": [r[0] for r in rows]})
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
        if path == "/api/orders/my":
            user = self.require({"customer"})
            if not user:
                return
            with db() as conn:
                rows = conn.execute("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC", (user["id"],)).fetchall()
                self.send_json({"orders": [row_order(conn, r) for r in rows]})
            return
        if path == "/api/management/orders/placed":
            user = self.require({"staff", "admin"})
            if not user:
                return
            with db() as conn:
                rows = conn.execute("SELECT * FROM orders WHERE status = 'Placed' ORDER BY created_at DESC").fetchall()
                self.send_json({"orders": [row_order(conn, r) for r in rows]})
            return
        if path == "/api/admin/staff":
            if not self.require({"admin"}):
                return
            with db() as conn:
                rows = conn.execute("SELECT * FROM users WHERE role = 'staff' ORDER BY created_at DESC").fetchall()
                self.send_json({"staff": [public_user(r) for r in rows]})
            return
        if path == "/api/admin/analytics":
            if not self.require({"admin"}):
                return
            with db() as conn:
                orders = conn.execute("SELECT * FROM orders").fetchall()
                products = conn.execute("SELECT COUNT(*) FROM products").fetchone()[0]
                total_sales = sum(r["total"] for r in orders)
                delivered = len([r for r in orders if r["status"] == "Delivered"])
                today = datetime.now(timezone.utc).date()
                days = []
                for i in range(6, -1, -1):
                    day = today - timedelta(days=i)
                    sales = sum(r["total"] for r in orders if str(r["created_at"]).startswith(day.isoformat()))
                    count = len([r for r in orders if str(r["created_at"]).startswith(day.isoformat())])
                    days.append({"label": day.strftime("%a"), "sales": sales, "orders": count})
                self.send_json({"totalSales": total_sales, "totalOrders": len(orders), "delivered": delivered, "products": products, "days": days})
            return
        self.serve_static(path)

    def do_POST(self):
        path = urlparse(self.path).path
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
        if path in {"/api/auth/login", "/api/auth/management-login"}:
            data = self.read_json()
            email, password = data.get("email", "").strip().lower(), data.get("password", "")
            with db() as conn:
                user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
            if not user or not verify_password(password, user["password_hash"]):
                self.send_json({"error": "Invalid login details"}, 401)
                return
            if path.endswith("management-login") and user["role"] not in {"admin", "staff"}:
                self.send_json({"error": "Only admin and staff can access this page"}, 403)
                return
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.set_session(user["id"])
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
        if path == "/api/delivery/calculate":
            data = self.read_json()
            sl_id = data.get("subLocationId")
            weight = float(data.get("weight") or 0)
            distance_km = float(data.get("distanceKm") or 0)
            if not sl_id:
                self.send_json({"fee": 600, "breakdown": {"base": 600}}) # Default fallback
                return
            with db() as conn:
                rate = conn.execute("""
                    SELECT dr.base_fee, dr.weight_multiplier, dr.distance_multiplier, dz.name as zone_name
                    FROM delivery_rates dr
                    JOIN delivery_zones dz ON dr.delivery_zone_id = dz.id
                    JOIN sub_locations sl ON sl.delivery_zone_id = dz.id
                    WHERE sl.id = ?
                """, (sl_id,)).fetchone()
                if not rate:
                    base = 600
                    wm = 0
                    dm = 0
                    zone = None
                else:
                    base = rate['base_fee']
                    wm = rate['weight_multiplier'] or 0
                    dm = rate['distance_multiplier'] or 0
                    zone = rate['zone_name']
                # Simple fee engine: base + weight * wm + distanceKm * dm
                fee = base + (weight * wm) + (distance_km * dm)
                fee = int(round(fee))
                breakdown = {"base": base, "weight": weight, "weightMultiplier": wm, "distanceKm": distance_km, "distanceMultiplier": dm, "zone": zone}
                self.send_json({"fee": fee, "breakdown": breakdown})
            return
        if path == "/api/payments/stk-push":
            # Mock M-Pesa STK Push and create a payments record
            data = self.read_json()
            phone = data.get("phone")
            amount = data.get("amount")
            order_id = data.get("orderId")
            if not phone or not amount:
                self.send_json({"error": "Phone and amount required"}, 400)
                return
            checkout_id = secrets.token_hex(16)
            pay_id = "pay-" + secrets.token_hex(8)
            now = datetime.now(timezone.utc).isoformat()
            with db() as conn:
                conn.execute("INSERT INTO payments (id,order_id,checkout_request_id,phone,amount,status,created_at) VALUES (?,?,?,?,?,?,?)",
                             (pay_id, order_id, checkout_id, phone, float(amount), 'PENDING', now))
            # Note: In production you'd call Daraja API and return its response
            self.send_json({
                "CheckoutRequestID": checkout_id,
                "PaymentId": pay_id,
                "CustomerMessage": f"An STK Push was sent to {phone} for KES {amount}.",
                "ResponseDescription": "STK_SENT"
            })
            return
        if path == "/api/payments/confirm":
            # Endpoint to confirm payment (for testing / webhook simulation)
            data = self.read_json()
            checkout_id = data.get("checkoutRequestId") or data.get("checkoutId")
            status = data.get("status", "COMPLETED")
            if not checkout_id:
                self.send_json({"error": "Missing checkoutRequestId"}, 400)
                return
            now = datetime.now(timezone.utc).isoformat()
            with db() as conn:
                pay = conn.execute("SELECT * FROM payments WHERE checkout_request_id = ?", (checkout_id,)).fetchone()
                if not pay:
                    self.send_json({"error": "Payment not found"}, 404)
                    return
                conn.execute("UPDATE payments SET status = ? WHERE id = ?", (status, pay['id']))
                # If payment linked to an order, mark order as Paid and notify admin
                if pay['order_id']:
                    conn.execute("UPDATE orders SET status = ? WHERE id = ?", ('Paid', pay['order_id']))
                    note_id = 'on-' + secrets.token_hex(8)
                    message = f"Payment received for order {pay['order_id']} (KES {pay['amount']})"
                    conn.execute("INSERT INTO order_notifications (id,order_id,message,is_read,created_at) VALUES (?,?,?,?,?)", (note_id, pay['order_id'], message, 0, now))
                    # For simplicity, also echo notification in server console
                    print('NOTIFY ADMIN:', message)
            self.send_json({"ok": True, "status": status})
            return
        if path == "/api/repair/bookings":
            content_type = self.headers.get("Content-Type", "")
            if content_type.startswith("multipart/form-data"):
                data, files = self.read_multipart()
            else:
                data = self.read_json()
                files = {}
            name = (data.get("name") or "").strip()
            email = (data.get("email") or "").strip()
            phone = (data.get("phone") or "").strip()
            brand = (data.get("brand") or "").strip()
            model = (data.get("model") or "").strip()
            repair_type = (data.get("repairType") or "").strip()
            description = (data.get("description") or "").strip()
            pickup_dropoff = (data.get("pickupDropoff") or "Pickup").strip()
            preferred_at = (data.get("preferredAt") or "").strip()
            service_id = (data.get("serviceId") or "").strip() or None
            if not name or not email or not phone or not brand or not model or not repair_type or not description or not preferred_at:
                self.send_json({"error": "Please fill all required booking fields."}, 400)
                return
            image_path = None
            image = files.get("image")
            if image:
                ext = Path(image["filename"]).suffix.lower() or ".jpg"
                filename = secrets.token_hex(12) + ext
                target = UPLOAD_DIR / filename
                with target.open("wb") as f:
                    f.write(image["content"])
                image_path = f"/uploads/{filename}"
            booking_id = "RB-" + secrets.token_hex(5).upper()
            user = self.current_user()
            with db() as conn:
                conn.execute(
                    "INSERT INTO repair_bookings (id,user_id,name,email,phone,brand,model,repair_service_id,repair_type,description,image_path,pickup_dropoff,preferred_at,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    (
                        booking_id,
                        user["id"] if user else None,
                        name,
                        email,
                        phone,
                        brand,
                        model,
                        service_id,
                        repair_type,
                        description,
                        image_path,
                        pickup_dropoff,
                        preferred_at,
                        "Pending",
                        datetime.now(timezone.utc).isoformat(),
                    ),
                )
                conn.execute(
                    "INSERT INTO repair_notifications (id,booking_id,message,is_read,created_at) VALUES (?,?,?,?,?)",
                    ("n-" + secrets.token_hex(8), booking_id, "New booking received.", 0, datetime.now(timezone.utc).isoformat()),
                )
                row = conn.execute("SELECT * FROM repair_bookings WHERE id = ?", (booking_id,)).fetchone()
                self.send_json({"booking": row_repair_booking(conn, row)})
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
                order_id = "ORD-" + secrets.token_hex(4).upper()
                total = 0
                rows = []
                for item in data.get("items", []):
                    pid = str(item.get("id"))
                    product = conn.execute("SELECT id, name, price, in_stock, img FROM products WHERE id = ?", (pid,)).fetchone()
                    if not product:
                        # Fallback to check spare parts table
                        product = conn.execute("SELECT id, name, price, stock as in_stock, image_path as img FROM spare_parts WHERE id = ?", (pid,)).fetchone()
                    
                    qty = int(item.get("qty", 1))
                    if not product or not product["in_stock"] or qty < 1:
                        self.send_json({"error": f"Product {pid} is unavailable"}, 400)
                        return
                    total += product["price"] * qty
                    rows.append((order_id, product["id"], product["name"], product["price"], qty, product["img"]))
                
                conn.execute(
                    "INSERT INTO orders (id, user_id, total, county, constituency, street, deposit_amount, deposit_mpesa, status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
                    (order_id, user["id"], total, data.get("county"), data.get("constituency"), data.get("street"), 
                     float(data.get("depositAmount", 0)), data.get("depositMpesa"), "Placed", datetime.now(timezone.utc).isoformat())
                )
                conn.executemany("INSERT INTO order_items (order_id,product_id,name,price,qty,img) VALUES (?,?,?,?,?,?)", rows)
                order = conn.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
                self.send_json({"order": row_order(conn, order)})
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
            price = float(data.get("price") or 0) if data.get("price") else 0.0
            stock = int(data.get("stock") or 1) if data.get("stock") else 1
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
            form, files = self.read_multipart()
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
            with db() as conn:
                conn.execute(
                    "INSERT INTO products (id,name,cat,price,was,rating,reviews,badge,img,desc,in_stock,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                    (
                        product_id,
                        form.get("name", "").strip(),
                        form.get("cat", "phones"),
                        float(form.get("price", "0")),
                        None,
                        4.6,
                        0,
                        "new",
                        f"/uploads/{filename}",
                        form.get("desc", "").strip(),
                        1,
                        datetime.now(timezone.utc).isoformat(),
                    ),
                )
            self.send_json({"ok": True})
            return
        # Admin: add county
        if path == "/api/admin/locations/counties":
            if not self.require({"admin"}):
                return
            data = self.read_json()
            name = (data.get("name") or "").strip()
            if not name:
                self.send_json({"error": "County name required"}, 400)
                return
            cid = "c-" + secrets.token_hex(6)
            with db() as conn:
                try:
                    conn.execute("INSERT INTO counties (id,name) VALUES (?,?)", (cid, name))
                except Exception as e:
                    self.send_json({"error": str(e)}, 400)
                    return
            self.send_json({"ok": True, "id": cid})
            return
        # Admin: add sub-location
        if path == "/api/admin/locations/sublocations":
            if not self.require({"admin"}):
                return
            data = self.read_json()
            county_id = data.get("countyId")
            name = (data.get("name") or "").strip()
            zone_id = data.get("deliveryZoneId")
            if not county_id or not name or not zone_id:
                self.send_json({"error": "countyId, deliveryZoneId and name required"}, 400)
                return
            sid = "sl-" + secrets.token_hex(6)
            with db() as conn:
                conn.execute("INSERT INTO sub_locations (id,county_id,name,delivery_zone_id) VALUES (?,?,?,?)", (sid, county_id, name, zone_id))
            self.send_json({"ok": True, "id": sid})
            return
        # Admin: add delivery zone
        if path == "/api/admin/delivery-zones":
            if not self.require({"admin"}):
                return
            data = self.read_json()
            name = (data.get("name") or "").strip()
            desc = (data.get("description") or "").strip()
            if not name:
                self.send_json({"error": "Zone name required"}, 400)
                return
            zid = "z-" + secrets.token_hex(6)
            with db() as conn:
                conn.execute("INSERT INTO delivery_zones (id,name,description) VALUES (?,?,?)", (zid, name, desc))
            self.send_json({"ok": True, "id": zid})
            return
        # Admin: add delivery rate
        if path == "/api/admin/delivery-rates":
            if not self.require({"admin"}):
                return
            data = self.read_json()
            zone_id = data.get("deliveryZoneId")
            base_fee = float(data.get("baseFee") or 0)
            weight_mul = float(data.get("weightMultiplier") or 0)
            dist_mul = float(data.get("distanceMultiplier") or 0)
            if not zone_id or base_fee <= 0:
                self.send_json({"error": "deliveryZoneId and baseFee required"}, 400)
                return
            drid = "dr-" + secrets.token_hex(6)
            now = datetime.now(timezone.utc).isoformat()
            with db() as conn:
                conn.execute("INSERT OR REPLACE INTO delivery_rates (id,delivery_zone_id,base_fee,weight_multiplier,distance_multiplier,created_at) VALUES (?,?,?,?,?,?)", (drid, zone_id, base_fee, weight_mul, dist_mul, now))
            self.send_json({"ok": True, "id": drid})
            return
        self.send_json({"error": "Not found"}, 404)

    def do_PUT(self):
        path = urlparse(self.path).path.rstrip("/")
        if path.startswith("/api/management/repair-services/"):
            if not self.require({"admin"}):
                return
            service_id = path.rsplit("/", 1)[-1]
            content_type = self.headers.get("Content-Type", "")
            if content_type.startswith("multipart/form-data"):
                form, files = self.read_multipart()
            else:
                form = self.read_json()
                files = {}
            title = form.get("title", "").strip()
            brand = form.get("brand", "").strip()
            repair_type = form.get("repairType", "").strip()
            price = float(form.get("price", "0") or 0)
            duration = form.get("duration", "").strip()
            warranty = form.get("warranty", "").strip()
            description = form.get("description", "").strip()
            available = 1 if form.get("available", "1") in ("1", "true", "on") else 0
            category_id = form.get("categoryId")
            img = files.get("image")
            img_path = None
            if img:
                ext = Path(img["filename"]).suffix.lower() or ".jpg"
                filename = secrets.token_hex(12) + ext
                target = UPLOAD_DIR / filename
                with target.open("wb") as f:
                    f.write(img["content"])
                img_path = f"/uploads/{filename}"
            with db() as conn:
                if img_path:
                    conn.execute(
                        "UPDATE repair_services SET title = ?, brand = ?, repair_type = ?, price = ?, duration = ?, warranty = ?, description = ?, available = ?, category_id = ?, image = ? WHERE id = ?",
                        (title, brand, repair_type, price, duration, warranty, description, available, category_id, img_path, service_id),
                    )
                else:
                    conn.execute(
                        "UPDATE repair_services SET title = ?, brand = ?, repair_type = ?, price = ?, duration = ?, warranty = ?, description = ?, available = ?, category_id = ? WHERE id = ?",
                        (title, brand, repair_type, price, duration, warranty, description, available, category_id, service_id),
                    )
            self.send_json({"ok": True})
            return
        if path.startswith("/api/management/repair-bookings/"):
            if not self.require({"staff", "admin"}):
                return
            booking_id = path.rsplit("/", 1)[-1]
            data = self.read_json()
            status = data.get("status")
            technician_id = data.get("technicianId")
            notes = data.get("technicianNotes")
            with db() as conn:
                if status:
                    conn.execute("UPDATE repair_bookings SET status = ? WHERE id = ?", (status, booking_id))
                    conn.execute("INSERT INTO repair_notifications (id,booking_id,message,is_read,created_at) VALUES (?,?,?,?,?)", ("n-" + secrets.token_hex(8), booking_id, f"Status updated to {status}.", 0, datetime.now(timezone.utc).isoformat()))
                if technician_id is not None:
                    conn.execute("UPDATE repair_bookings SET technician_id = ? WHERE id = ?", (technician_id, booking_id))
                if notes is not None:
                    conn.execute("UPDATE repair_bookings SET technician_notes = ? WHERE id = ?", (notes, booking_id))
            self.send_json({"ok": True})
            return
        if path.startswith("/api/admin/products/"):
            if not self.require({"admin"}):
                return
            product_id = path.rsplit("/", 1)[-1]
            content_type = self.headers.get("Content-Type", "")
            if content_type.startswith("multipart/form-data"):
                form, files = self.read_multipart()
                name = form.get("name", "").strip()
                cat = form.get("cat", "phones")
                price = float(form.get("price", "0") or 0)
                in_stock = 1 if form.get("inStock", "true") in ("true", "1", "on") else 0
                desc = form.get("desc", "")
                img = files.get("img")
                img_path = None
                if img:
                    ext = Path(img["filename"]).suffix.lower() or ".jpg"
                    filename = secrets.token_hex(12) + ext
                    target = UPLOAD_DIR / filename
                    with target.open("wb") as f:
                        f.write(img["content"])
                    img_path = f"/uploads/{filename}"
                with db() as conn:
                    if img_path:
                        conn.execute(
                            "UPDATE products SET name = ?, price = ?, in_stock = ?, cat = ?, desc = ?, img = ? WHERE id = ?",
                            (name, price, in_stock, cat, desc, img_path, product_id),
                        )
                    else:
                        conn.execute(
                            "UPDATE products SET name = ?, price = ?, in_stock = ?, cat = ?, desc = ? WHERE id = ?",
                            (name, price, in_stock, cat, desc, product_id),
                        )
                self.send_json({"ok": True})
                return
            data = self.read_json()
            with db() as conn:
                conn.execute(
                    "UPDATE products SET name = ?, price = ?, in_stock = ?, cat = ? WHERE id = ?",
                    (data.get("name", "").strip(), float(data.get("price", 0)), 1 if data.get("inStock") else 0, data.get("cat", "phones"), product_id),
                )
            self.send_json({"ok": True})
            return
        if path.startswith("/api/admin/spare-parts/"):
            if not self.require({"admin"}):
                return
            spare_id = path.split("/")[-1]
            if path.endswith("/update"):
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
                with db() as conn:
                    part = conn.execute("SELECT * FROM spare_parts WHERE id = ?", (spare_id,)).fetchone()
                    if not part:
                        self.send_json({"error": "Spare part not found"}, 404)
                        return
                    image_path = part["image_path"]
                    image = files.get("image")
                    if image:
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
        self.send_json({"error": "Not found"}, 404)

    def do_DELETE(self):
        path = urlparse(self.path).path.rstrip("/")
        if path.startswith("/api/management/repair-services/"):
            if not self.require({"admin"}):
                return
            service_id = path.rsplit("/", 1)[-1]
            with db() as conn:
                conn.execute("DELETE FROM repair_services WHERE id = ?", (service_id,))
            self.send_json({"ok": True})
            return
        if path.startswith("/api/management/repair-technicians/"):
            if not self.require({"admin"}):
                return
            tech_id = path.rsplit("/", 1)[-1]
            with db() as conn:
                conn.execute("DELETE FROM repair_technicians WHERE id = ?", (tech_id,))
            self.send_json({"ok": True})
            return
        if path.startswith("/api/admin/products/"):
            if not self.require({"admin"}):
                return
            product_id = path.rsplit("/", 1)[-1]
            with db() as conn:
                conn.execute("DELETE FROM products WHERE id = ?", (product_id,))
            self.send_json({"ok": True})
            return
        if path.startswith("/api/admin/spare-parts/"):
            if not self.require({"admin"}):
                return
            spare_id = path.rsplit("/", 1)[-1]
            with db() as conn:
                conn.execute("DELETE FROM spare_parts WHERE id = ?", (spare_id,))
            self.send_json({"ok": True})
            return
        if path.startswith("/api/admin/staff/"):
            if not self.require({"admin"}):
                return
            user_id = path.rsplit("/", 1)[-1]
            with db() as conn:
                conn.execute("DELETE FROM users WHERE id = ? AND role = 'staff'", (user_id,))
            self.send_json({"ok": True})
            return
        if path.startswith("/api/admin/locations/counties/"):
            if not self.require({"admin"}):
                return
            cid = path.rsplit("/", 1)[-1]
            with db() as conn:
                conn.execute("DELETE FROM sub_locations WHERE county_id = ?", (cid,))
                conn.execute("DELETE FROM counties WHERE id = ?", (cid,))
            self.send_json({"ok": True})
            return
        if path.startswith("/api/admin/locations/sublocations/"):
            if not self.require({"admin"}):
                return
            sid = path.rsplit("/", 1)[-1]
            with db() as conn:
                conn.execute("DELETE FROM sub_locations WHERE id = ?", (sid,))
            self.send_json({"ok": True})
            return
        if path.startswith("/api/admin/delivery-zones/"):
            if not self.require({"admin"}):
                return
            zid = path.rsplit("/", 1)[-1]
            with db() as conn:
                conn.execute("DELETE FROM delivery_rates WHERE delivery_zone_id = ?", (zid,))
                conn.execute("DELETE FROM sub_locations WHERE delivery_zone_id = ?", (zid,))
                conn.execute("DELETE FROM delivery_zones WHERE id = ?", (zid,))
            self.send_json({"ok": True})
            return
        if path.startswith("/api/admin/delivery-rates/"):
            if not self.require({"admin"}):
                return
            drid = path.rsplit("/", 1)[-1]
            with db() as conn:
                conn.execute("DELETE FROM delivery_rates WHERE id = ?", (drid,))
            self.send_json({"ok": True})
            return
        self.send_json({"error": "Not found"}, 404)

    def serve_static(self, path):
        if path == "/":
            path = "/index.html"
        target = (ROOT / unquote(path).lstrip("/")).resolve()
        if not str(target).startswith(str(ROOT)) or not target.exists() or target.is_dir():
            self.send_error(404)
            return
        body = target.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", mimetypes.guess_type(str(target))[0] or "application/octet-stream")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        print("%s - %s" % (self.address_string(), fmt % args))


if __name__ == "__main__":
    init_db()
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "8000"))
    bind = (host, port)
    print(f"S.M Dynamics server running at http://{host}:{port}")
    ThreadingHTTPServer(bind, Handler).serve_forever()
