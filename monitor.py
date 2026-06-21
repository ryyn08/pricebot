import sys, time, subprocess, json

proxies = {
    "Canada": "98.142.250.14",
    "Singapore": "98.142.250.14",
    "USA, Los Angeles": "98.142.250.14",
    "India, Hyderabad": "172.67.162.58"
}

def get_ms(ip):
    try:
        res = subprocess.check_output(f"ping -c 1 -W 2 {ip}", shell=True).decode()
        return float(res.split("time=")[1].split(" ")[0])
    except: return 999.0

while True:
    for name, ip in proxies.items():
        ms = get_ms(ip)
        status = "OK" if ms < 150 else "DISCONNECT"
        print(json.dumps({"name": name, "ip": ip, "ms": ms, "status": status}))
        sys.stdout.flush()
    time.sleep(5)
