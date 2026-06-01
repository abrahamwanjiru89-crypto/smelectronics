import urllib.request, sys

url = 'http://127.0.0.1:8000/api/repair/services'
try:
    with urllib.request.urlopen(url, timeout=6) as resp:
        data = resp.read().decode('utf-8', errors='replace')
        print('HTTP', resp.getcode())
        print(data[:8000])
except Exception as e:
    print('ERROR', repr(e))
    sys.exit(2)
