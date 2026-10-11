"""Save a 7-day hourly forecast for every area in manifest.json (runs in GitHub Actions; stdlib only)."""
import json
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
VARS = "temperature_2m,precipitation,precipitation_probability,wind_speed_10m,wind_direction_10m,wind_gusts_10m,surface_pressure"

for a in json.loads((ROOT / "manifest.json").read_text())["areas"]:
    url = (f"https://api.open-meteo.com/v1/forecast?latitude={a['lat']}&longitude={a['lon']}&hourly={VARS}"
           "&daily=sunrise,sunset&wind_speed_unit=mph&temperature_unit=fahrenheit&precipitation_unit=inch"
           "&timezone=America%2FChicago&past_days=2&forecast_days=8")
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=60) as r:
                d = json.load(r)
            break
        except Exception as e:
            print(f"{a['key']}: attempt {attempt + 1} failed: {e}")
            time.sleep(10)
    else:
        continue
    d["generated_at"] = datetime.now(timezone.utc).isoformat()
    (ROOT / "weather").mkdir(exist_ok=True)
    (ROOT / "weather" / f"{a['key']}.json").write_text(json.dumps(d, separators=(",", ":")))
    print(f"{a['key']}: saved {len(d['hourly']['time'])} hours")
