from __future__ import annotations

import io
import json
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from PIL import Image, ImageFilter, ImageOps

SOURCE_COMMIT = "a873c04bcd2a170c9dd35cc3239bcfb5c171e2d9"
SOURCE_TEMPLATE = (
    "https://raw.githubusercontent.com/sotonnasa-glitch/Azim-abzar/"
    f"{SOURCE_COMMIT}/catalog_site_mapping_908/images/{{id}}.jpg"
)
UPLOAD_URL = "https://lzkrwtnylkordkwkdyzp.supabase.co/functions/v1/catalog-image-migrator?action=upload"
OUT_DIR = Path("/tmp/azim-image-enhancement-work")
WORKERS = 4
EXPECTED_EXISTING_IMAGES = 880


def fetch_bytes(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "Azim-Abzar-image-enhancer/1.0"})
    with urllib.request.urlopen(request, timeout=120) as response:
        return response.read()


def enhance(raw: bytes) -> bytes:
    with Image.open(io.BytesIO(raw)) as image:
        image = ImageOps.exif_transpose(image).convert("RGB")
        w, h = image.size
        nw, nh = int(round(w * 2.0)), int(round(h * 2.0))
        max_dim = 1800
        if max(nw, nh) > max_dim:
            scale = max_dim / max(w, h)
            nw, nh = max(1, int(round(w * scale))), max(1, int(round(h * scale)))
        image = image.resize((nw, nh), Image.Resampling.LANCZOS)
        image = image.filter(ImageFilter.UnsharpMask(radius=1.15, percent=135, threshold=3))
        output = io.BytesIO()
        image.save(output, "JPEG", quality=90, optimize=True, progressive=True, subsampling=0)
        return output.getvalue()


def upload(image_id: str, body: bytes, github_token: str) -> None:
    request = urllib.request.Request(
        UPLOAD_URL,
        data=body,
        method="POST",
        headers={
            "x-github-token": github_token,
            "x-image-id": image_id,
            "content-type": "image/jpeg",
            "User-Agent": "Azim-Abzar-image-enhancer/1.0",
        },
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        payload = json.loads(response.read().decode("utf-8"))
    if payload.get("ok") is not True:
        raise RuntimeError(f"upload response was not ok: {payload}")


def process_one(n: int, github_token: str) -> tuple[str, str, str]:
    image_id = f"P{n:04d}"
    url = SOURCE_TEMPLATE.format(id=image_id)
    last_error = None
    for attempt in range(1, 6):
        try:
            raw = fetch_bytes(url)
            enhanced = enhance(raw)
            upload(image_id, enhanced, github_token)
            return image_id, "ok", str(len(enhanced))
        except urllib.error.HTTPError as exc:
            if exc.code == 404:
                return image_id, "missing", "404"
            last_error = f"HTTP {exc.code}"
        except Exception as exc:
            last_error = repr(exc)
        time.sleep(min(2 * attempt, 10))
    return image_id, "failed", last_error or "unknown error"


def main() -> int:
    import os

    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        raise SystemExit("GITHUB_TOKEN is required")

    OUT_DIR.mkdir(exist_ok=True)
    results: list[tuple[str, str, str]] = []
    with ThreadPoolExecutor(max_workers=WORKERS) as executor:
        futures = [executor.submit(process_one, n, token) for n in range(1, 909)]
        for index, future in enumerate(as_completed(futures), start=1):
            result = future.result()
            results.append(result)
            if index % 25 == 0 or result[1] == "failed":
                ok = sum(r[1] == "ok" for r in results)
                missing = sum(r[1] == "missing" for r in results)
                failed = sum(r[1] == "failed" for r in results)
                print(f"PROGRESS completed={index}/908 ok={ok} missing={missing} failed={failed}", flush=True)

    results.sort()
    (OUT_DIR / "results.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    ok = sum(r[1] == "ok" for r in results)
    missing = sum(r[1] == "missing" for r in results)
    failed = sum(r[1] == "failed" for r in results)
    print(f"SUMMARY ok={ok} missing={missing} failed={failed}")
    if ok != EXPECTED_EXISTING_IMAGES or missing != (908 - EXPECTED_EXISTING_IMAGES) or failed != 0:
        print(f"Expected exactly {EXPECTED_EXISTING_IMAGES} processed, {908 - EXPECTED_EXISTING_IMAGES} missing, 0 failed.")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
