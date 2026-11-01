import csv
import gzip
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "data" / "obs_H_M_L.csv"
OUTPUT_PATH = ROOT / "data" / "photo_licenses.json"
API_URL = "https://api.inaturalist.org/v1/observations"
BATCH_SIZE = 200
PHOTO_ID_PATTERN = re.compile(r"/photos/(\d+)/")


def load_exported_photos():
    with CSV_PATH.open(encoding="utf-8-sig", newline="") as source:
        rows = csv.DictReader(source)
        photos = {}
        for row in rows:
            observation_id = (row.get("id") or "").strip()
            image_url = (row.get("image_url") or "").strip()
            if not image_url:
                continue
            match = PHOTO_ID_PATTERN.search(image_url)
            if not observation_id or not match:
                raise ValueError(f"Cannot identify observation/photo from CSV row: {observation_id!r}")
            photos[observation_id] = {
                "photo_id": match.group(1),
                "image_url": image_url,
            }
    return photos


def fetch_batch(observation_ids):
    query = urllib.parse.urlencode([
        ("id", ",".join(observation_ids)),
        ("per_page", str(BATCH_SIZE)),
    ])
    request = urllib.request.Request(
        f"{API_URL}?{query}",
        headers={
            "Accept-Encoding": "gzip",
            "User-Agent": "MontrealInvasivePlantMap/1.0 (photo license verification)",
        },
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        body = response.read()
        if response.headers.get("Content-Encoding") == "gzip":
            body = gzip.decompress(body)
    return json.loads(body)


def main():
    exported_photos = load_exported_photos()
    observation_ids = list(exported_photos)
    results = {}
    missing_observations = []

    for offset in range(0, len(observation_ids), BATCH_SIZE):
        batch = observation_ids[offset:offset + BATCH_SIZE]
        payload = fetch_batch(batch)
        observations = payload.get("results", [])
        returned = {str(observation.get("id")): observation for observation in observations}
        if len(returned) != len(batch):
            missing_observations.extend(observation_id for observation_id in batch if observation_id not in returned)

        for observation_id in batch:
            observation = returned.get(observation_id)
            exported = exported_photos[observation_id]
            matched_photo = None
            if observation:
                matched_photo = next(
                    (
                        photo for photo in observation.get("photos", [])
                        if str(photo.get("id")) == exported["photo_id"]
                    ),
                    None,
                )
            results[observation_id] = {
                "photo_id": exported["photo_id"],
                "image_url": exported["image_url"],
                "license_code": matched_photo.get("license_code") if matched_photo else None,
                "attribution": matched_photo.get("attribution", "") if matched_photo else "",
                "verified": matched_photo is not None,
            }

        completed = min(offset + len(batch), len(observation_ids))
        print(f"Checked {completed}/{len(observation_ids)} photo records", flush=True)
        if completed < len(observation_ids):
            time.sleep(1.1)

    missing_photos = [
        observation_id for observation_id, item in results.items()
        if not item["verified"]
    ]
    output = {
        "source": "iNaturalist API observation photo metadata",
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "photos": results,
    }

    temporary_path = OUTPUT_PATH.with_suffix(".json.tmp")
    temporary_path.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary_path.replace(OUTPUT_PATH)

    print(f"Saved {len(results)} photo license records to {OUTPUT_PATH}")
    print(f"Photo IDs not returned by iNaturalist: {len(missing_photos)}")
    print(f"Observation IDs not returned by iNaturalist: {len(missing_observations)}")
    if missing_photos:
        print("Unverified photo observations:", ", ".join(missing_photos[:20]))
    if missing_observations:
        print("Unreturned observations:", ", ".join(missing_observations[:20]))

    if missing_observations:
        raise RuntimeError("The API did not return every requested observation; review the mapping before use.")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, urllib.error.URLError, json.JSONDecodeError) as error:
        print(f"Photo license lookup failed: {error}", file=sys.stderr)
        raise
