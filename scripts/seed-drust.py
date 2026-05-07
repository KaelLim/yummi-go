"""Seed drust collections with content data — rate-limit aware."""
import csv, json, time, urllib.request, urllib.error
from pathlib import Path

BASE = "https://tool.tzuchi-org.tw/drust/t/fec8119d-0231-40f7-a7d6-c580ad312e96"
TOKEN = "drust_GaKEqSNtWqoo9fMofnbxZn2ymDZPDVrXFYhfkmDbv3M"
TECHFILE = Path(r"C:/Users/User/Desktop/yummi go/techfile")

DELAY = 0.25  # seconds between inserts


def request(method, path, body=None):
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(
        f"{BASE}{path}", data=data, method=method,
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read()) if resp.status != 204 else None
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def insert_with_retry(collection: str, data: dict, max_retries=5):
    for attempt in range(max_retries):
        status, body = request("POST", f"/records/{collection}", {"data": data})
        if status == 200 or status == 201:
            time.sleep(DELAY)
            return body
        if status == 429 or (isinstance(body, str) and "RATE_LIMITED" in body):
            wait = 8 + attempt * 2
            print(f"  rate limited, sleeping {wait}s...")
            time.sleep(wait)
            continue
        return {"error": body, "status": status}
    return {"error": "max retries exceeded"}


def list_records(collection):
    status, body = request("GET", f"/records/{collection}?limit=500")
    if status == 200:
        return body.get("records", []) if isinstance(body, dict) else body
    return []


def delete_record(collection, record_id):
    status, _ = request("DELETE", f"/records/{collection}/{record_id}")
    return status == 204


# ---------- 1. Quiz ----------
def seed_quiz():
    csv_path = TECHFILE / "Yummi Go Content Database.xlsx - Quiz Database Default (Traditional CH).csv"
    # Get already inserted questions to skip dupes
    existing = list_records("quiz_questions")
    existing_qs = {r.get("question") for r in existing if isinstance(r, dict)}
    print(f"Already in DB: {len(existing_qs)} questions")

    inserted = 0
    skipped = 0
    failed = 0
    with open(csv_path, encoding="utf-8") as f:
        reader = csv.reader(f)
        next(reader)
        for row in reader:
            if len(row) < 9 or not row[3].strip():
                continue
            q = row[3].strip()
            if q in existing_qs:
                skipped += 1
                continue
            data = {
                "source": row[0].strip(),
                "category": row[2].strip(),
                "question": q,
                "option_a": row[4].strip(),
                "option_b": row[5].strip(),
                "option_c": row[6].strip(),
                "correct_answer": row[7].strip(),
                "explanation": row[8].strip(),
            }
            r = insert_with_retry("quiz_questions", data)
            if isinstance(r, dict) and "error" in r:
                failed += 1
            else:
                inserted += 1
    print(f"quiz_questions: inserted={inserted}, skipped={skipped}, failed={failed}")


# ---------- 2. Challenge ----------
def seed_challenge():
    # First clean up: delete all existing rows so we re-insert cleanly
    existing = list_records("challenge_scripts")
    if existing:
        print(f"Cleaning {len(existing)} existing rows...")
        for r in existing:
            if isinstance(r, dict) and "id" in r:
                delete_record("challenge_scripts", r["id"])
                time.sleep(0.1)

    csv_path = TECHFILE / "Yummi Go Content Database.xlsx - 30天挑戰腳本與每日任務.csv"
    inserted = 0
    failed = 0
    seen_days = set()
    with open(csv_path, encoding="utf-8") as f:
        reader = csv.reader(f)
        next(reader)
        for row in reader:
            if len(row) < 5:
                continue
            day_label = row[1].strip()
            if not day_label.startswith("Day"):
                continue
            try:
                day_num = int(day_label.replace("Day", "").strip())
            except ValueError:
                continue
            if day_num in seen_days:
                continue
            color_field = row[2].strip()
            task_field = row[3].strip()
            # Skip rows where both color & task are empty (Day 36-45 in CSV)
            if not color_field and not task_field:
                continue
            seen_days.add(day_num)
            lucky_color = ""
            greeting = ""
            if color_field:
                lines = [l.strip() for l in color_field.split("\n") if l.strip()]
                if lines:
                    lucky_color = lines[0]
                    greeting = " ".join(lines[1:]) if len(lines) > 1 else ""
            action_type = ""
            task_description = ""
            bonus_challenge = ""
            fog_reduction = 0
            if task_field:
                lines = [l.strip() for l in task_field.split("\n") if l.strip()]
                if lines:
                    action_type = lines[0]
                    for line in lines[1:]:
                        if line.startswith("任務"):
                            task_description = line.split("：", 1)[-1].split(":", 1)[-1].strip()
                        elif line.startswith("加分挑戰"):
                            bonus_challenge = line.split("：", 1)[-1].split(":", 1)[-1].strip()
                        elif "灰霧" in line:
                            import re
                            m = re.search(r"-(\d+)%", line)
                            if m:
                                fog_reduction = int(m.group(1))
            data = {
                "day_number": day_num,
                "lucky_color": lucky_color,
                "greeting": greeting,
                "action_type": action_type,
                "task_description": task_description,
                "bonus_challenge": bonus_challenge,
                "fog_reduction_pct": fog_reduction,
            }
            r = insert_with_retry("challenge_scripts", data)
            if isinstance(r, dict) and "error" in r:
                failed += 1
            else:
                inserted += 1
    print(f"challenge_scripts: inserted={inserted}, failed={failed}")


# ---------- 3. Restaurants ----------
RESTAURANTS = [
    {"name":"蓮香齋","address":"台北市中正區羅斯福路一段18號","lat":25.0339,"lng":121.5197,"place_type":"chinese","pin_color":"green","is_partner":False},
    {"name":"Veganday 純素之日","address":"台北市大安區忠孝東路四段181巷7-1號","lat":25.0418,"lng":121.5526,"place_type":"western","pin_color":"green","is_partner":True,"partner_discount":"8 折"},
    {"name":"小小樹食 大安店","address":"台北市大安區四維路14巷6號","lat":25.0353,"lng":121.5480,"place_type":"western","pin_color":"green","is_partner":False},
    {"name":"Plants 純植物餐廳","address":"台北市大安區安和路一段21巷23號","lat":25.0375,"lng":121.5494,"place_type":"western","pin_color":"green","is_partner":True,"partner_discount":"免費飲品"},
    {"name":"禪風茶樓","address":"台北市信義區松壽路11號","lat":25.0364,"lng":121.5683,"place_type":"chinese","pin_color":"gray","is_partner":False},
    {"name":"草盛園","address":"台北市中山區雙城街9-1號","lat":25.0641,"lng":121.5238,"place_type":"chinese","pin_color":"green","is_partner":False},
    {"name":"Ooh Cha Cha 自然食","address":"台北市中正區羅斯福路二段102號","lat":25.0289,"lng":121.5184,"place_type":"cafe","pin_color":"green","is_partner":True,"partner_discount":"9 折"},
    {"name":"麵食主義 信義店","address":"台北市信義區信義路四段30巷","lat":25.0335,"lng":121.5523,"place_type":"chinese","pin_color":"gray","is_partner":False},
    {"name":"養心茶樓","address":"台北市中山區松江路128號","lat":25.0531,"lng":121.5328,"place_type":"chinese","pin_color":"green","is_partner":False},
    {"name":"About Animals","address":"台北市大安區光復南路180巷5號","lat":25.0426,"lng":121.5577,"place_type":"cafe","pin_color":"gray","is_partner":False},
    {"name":"鈺善閣 素養生宴","address":"台北市中正區北平東路14號","lat":25.0463,"lng":121.5223,"place_type":"chinese","pin_color":"green","is_partner":False},
    {"name":"松山素食家","address":"台北市松山區八德路四段692號","lat":25.0498,"lng":121.5773,"place_type":"chinese","pin_color":"green","is_partner":True,"partner_discount":"加贈飲品"},
]

def seed_restaurants():
    existing = list_records("restaurants")
    if existing:
        print(f"Restaurants already seeded ({len(existing)} rows), skipping.")
        return
    inserted = 0
    failed = 0
    for r in RESTAURANTS:
        result = insert_with_retry("restaurants", r)
        if isinstance(result, dict) and "error" in result:
            failed += 1
        else:
            inserted += 1
    print(f"restaurants: inserted={inserted}, failed={failed}")


if __name__ == "__main__":
    print("=== restaurants ===")
    seed_restaurants()
    print("\n=== challenge_scripts ===")
    seed_challenge()
    print("\n=== quiz_questions ===")
    seed_quiz()
    print("\nDone.")
