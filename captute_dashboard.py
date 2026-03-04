import os
import sys
import base64
import io
import time
from datetime import datetime
from PIL import Image

from selenium import webdriver
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.common.exceptions import WebDriverException

# ===== FORCE UTF-8 (Windows emoji safe) =====
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    os.environ["PYTHONIOENCODING"] = "utf-8"

# ===== CONFIG =====
DASHBOARDS = [
    {
        "key": "ST3_Curing_PVSA",
        "url": "http://172.20.245.28/GRIO/CPPVA.php",
        "wait": 15,
        # this is the fixed "latest" file name (overwritten each run)
        "latest_name": "ST3_CP_PVSA.png",
    },

    {
        "key": "ST3_User_Level_Breakdown_8",
        "url": "http://172.20.245.28/GRIO/CPEmp8.php",
        "wait": 15,
        # this is the fixed "latest" file name (overwritten each run)
        "latest_name": "ST3_User_Level_Breakdown_8.png",
    },

]

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
HISTORY_DIR = os.path.join(BASE_DIR, "screenshots")  # keeps history


def ensure_dir(p: str):
    os.makedirs(p, exist_ok=True)


def capture_one(driver, url: str, wait_s: int, out_path: str, retries: int = 3) -> str:
    last_err = None

    for attempt in range(1, retries + 1):
        try:
            driver.get(url)
            time.sleep(wait_s)

            # Stop further loading/refresh (helps avoid detached frame)
            try:
                driver.execute_script("window.stop();")
            except Exception:
                pass

            result = driver.execute_cdp_cmd(
                "Page.captureScreenshot",
                {"format": "png", "captureBeyondViewport": True}
            )

            png_data = base64.b64decode(result["data"])
            img = Image.open(io.BytesIO(png_data)).convert("RGB")
            img.save(out_path, "PNG")
            return out_path

        except WebDriverException as e:
            last_err = e
            msg = str(e).lower()

            if "detached frame" in msg or "frame was detached" in msg:
                print(f"⚠ Detached frame (attempt {attempt}/{retries}). Retrying...")
                time.sleep(2)
                continue

            raise

    raise RuntimeError(f"Failed to capture after {retries} attempts. Last error: {last_err}")


def capture_all_dashboards():
    ts = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    date_folder = datetime.now().strftime("%Y-%m-%d")

    print("📸 Capturing dashboards...")

    options = ChromeOptions()
    options.add_argument("--headless=new")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")

    driver = webdriver.Chrome(options=options)
    saved_history = []

    try:
        for d in DASHBOARDS:
            key = d["key"]
            url = d["url"]
            wait_s = int(d.get("wait", 15))
            latest_name = d["latest_name"]

            # History path: screenshots/<key>/<YYYY-MM-DD>/<key>_<timestamp>.png
            hist_dir = os.path.join(HISTORY_DIR, key, date_folder)
            ensure_dir(hist_dir)
            hist_path = os.path.join(hist_dir, f"{key}_{ts}.png")

            print(f"➡ Capturing {key} ...")
            final_hist_path = capture_one(driver, url, wait_s, hist_path, retries=3)
            print(f"✅ History saved: {final_hist_path}")
            saved_history.append(final_hist_path)

            # Overwrite latest fixed filename (for WhatsApp sender)
            latest_path = os.path.join(BASE_DIR, latest_name)
            img = Image.open(final_hist_path).convert("RGB")
            img.save(latest_path, "PNG")
            print(f"✅ Latest saved: {latest_path}")

        return saved_history

    finally:
        driver.quit()


if __name__ == "__main__":
    paths = capture_all_dashboards()
    print("\n🎉 All done:")
    for p in paths:
        print(" -", p)