import sqlite3
from pathlib import Path
p = Path(__file__).resolve().parent.parent / 'shop.db'
print('DB path:', p)
if not p.exists():
    print('DB not found')
    raise SystemExit(1)
conn = sqlite3.connect(p)
c = conn.cursor()
try:
    c.execute('SELECT COUNT(*) FROM device_models')
    print('device_models count =', c.fetchone()[0])
    c.execute('SELECT brand, model FROM device_models LIMIT 10')
    for r in c.fetchall():
        print(r)
except Exception as e:
    print('ERROR', e)
finally:
    conn.close()
