import http.client, json
conn = http.client.HTTPConnection('127.0.0.1',8000, timeout=6)
payload = json.dumps({'email':'admin@smdynamics.com','password':'admin123'})
conn.request('POST','/api/auth/management-login', payload, {'Content-Type':'application/json'})
res = conn.getresponse()
print(res.status, res.reason)
for k,v in res.getheaders():
    print(k+':', v)
print('\nBODY:\n')
print(res.read().decode()[:2000])
