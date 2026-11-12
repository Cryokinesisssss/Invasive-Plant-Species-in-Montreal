import ast
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
NOTEBOOK_PATH = ROOT / "notebooks" / "ChecksPassed.ipynb"
CSV_PATH = ROOT / "data" / "obs_H_M_L.csv"
PHOTO_LICENSES_PATH = ROOT / "data" / "photo_licenses.json"
REFRESH_METADATA_PATH = ROOT / "data" / "refresh_metadata.json"
API_URL = "https://api.inaturalist.org/v1/observations"
PLACE_ID = 27630
PAGE_SIZE = 200
PAGE_DELAY_SECONDS = 1.1
RISK_TAXON_SETS = {
    "HIGH_RISK_TAXON_IDS",
    "MODERATE_RISK_TAXON_IDS",
    "LOW_RISK_TAXON_IDS",
}
CSV_COLUMNS = [
    "id",
    "observed_on",
    "time_observed_at",
    "user_login",
    "license",
    "url",
    "image_url",
    "place_guess",
    "latitude",
    "longitude",
    "positional_accuracy",
    "public_positional_accuracy",
    "taxon_geoprivacy",
    "coordinates_obscured",
    "place_town_name",
    "species_guess",
    "scientific_name",
    "common_name",
    "iconic_taxon_name",
    "taxon_id",
]
PHOTO_ID_PATTERN = re.compile(r"/photos/(\d+)/")


def risk_taxon_ids():
    notebook = json.loads(NOTEBOOK_PATH.read_text(encoding="utf-8"))
    taxon_ids = set()
    for cell in notebook.get("cells", []):
        if cell.get("cell_type") != "code":
            continue
        tree = ast.parse("".join(cell.get("source", [])))
        for node in tree.body:
            if not isinstance(node, ast.Assign):
                continue
            if any(
                isinstance(target, ast.Name) and target.id in RISK_TAXON_SETS
                for target in node.targets
            ):
                taxon_ids.update(str(value) for value in ast.literal_eval(node.value))
    if not taxon_ids:
        raise ValueError(f"No risk taxon IDs found in {NOTEBOOK_PATH}")
    return sorted(taxon_ids, key=int)


# Two separate queries, each kept under iNaturalist's 10,000-result paging limit:
#   "known":   positional accuracy recorded and under 100 m (shown by default)
#   "unknown": no positional accuracy recorded at all (hidden on the map unless
#              the reader turns on "Include records with unknown accuracy")
ACCURACY_QUERIES = {
    "known": ("acc_below", "100"),
    "unknown": ("acc", "false"),
}


def fetch_page(taxon_ids, page, accuracy="known"):
    query = urllib.parse.urlencode([
        ("place_id", str(PLACE_ID)),
        ("taxon_id", ",".join(taxon_ids)),
        ("quality_grade", "research"),
        ACCURACY_QUERIES[accuracy],
        ("order_by", "id"),
        ("order", "asc"),
        ("per_page", str(PAGE_SIZE)),
        ("page", str(page)),
    ])
    request = urllib.request.Request(
        f"{API_URL}?{query}",
        headers={
            "Accept-Encoding": "gzip",
            "User-Agent": "MontrealInvasivePlantMap/1.0 (scheduled data refresh)",
        },
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        body = response.read()
        if response.headers.get("Content-Encoding") == "gzip":
            body = gzip.decompress(body)
    return json.loads(body)


def normalize_license(code):
    return str(code or "").strip().upper().replace("_", "-")


def format_time_observed(value):
    if not value:
        return ""
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")


def photo_image_url(photo):
    url = str(photo.get("url") or "")
    return re.sub(r"/square\.", "/medium.", url)


def observation_row(observation, photo_licenses):
    taxon = observation.get("taxon") or {}
    user = observation.get("user") or {}
    coordinates = (observation.get("geojson") or {}).get("coordinates") or []
    photo = next(iter(observation.get("photos") or []), None)
    image_url = photo_image_url(photo) if photo else ""
    license_code = normalize_license(observation.get("license_code"))
    observation_id = str(observation["id"])

    photo_id = str(photo.get("id")) if photo else ""
    photo_match = (
        PHOTO_ID_PATTERN.search(image_url)
        if image_url
        else None
    )
    photo_licenses[observation_id] = {
        "photo_id": photo_id,
        "image_url": image_url,
        "license_code": photo.get("license_code") if photo else None,
        "attribution": photo.get("attribution", "") if photo else "",
        "verified": bool(photo and photo_match and photo_match.group(1) == photo_id),
    }

    return {
        "id": observation_id,
        "observed_on": observation.get("observed_on") or "",
        "time_observed_at": format_time_observed(observation.get("time_observed_at")),
        "user_login": user.get("login") or "",
        "license": license_code,
        "url": observation.get("uri") or f"https://www.inaturalist.org/observations/{observation_id}",
        "image_url": image_url,
        "place_guess": observation.get("place_guess") or "",
        "latitude": coordinates[1] if len(coordinates) >= 2 else "",
        "longitude": coordinates[0] if len(coordinates) >= 2 else "",
        "positional_accuracy": (
            observation.get("positional_accuracy")
            if observation.get("positional_accuracy") is not None
            else ""
        ),
        "public_positional_accuracy": (
            observation.get("public_positional_accuracy")
            if observation.get("public_positional_accuracy") is not None
            else ""
        ),
        "taxon_geoprivacy": observation.get("taxon_geoprivacy") or "",
        "coordinates_obscured": str(bool(observation.get("obscured"))).lower(),
        "place_town_name": "",
        "species_guess": observation.get("species_guess") or "",
        "scientific_name": taxon.get("name") or "",
        "common_name": taxon.get("preferred_common_name") or "",
        "iconic_taxon_name": taxon.get("iconic_taxon_name") or "",
        "taxon_id": taxon.get("id") or "",
    }


def fetch_all(taxon_ids, accuracy, label):
    first_page = fetch_page(taxon_ids, 1, accuracy)
    total_results = int(first_page.get("total_results", 0))
    if total_results >= 10000:
        raise RuntimeError(
            f"iNaturalist returned {total_results} matches ({label}); the API result "
            "limit may truncate this query, so refusing to write incomplete data."
        )

    observations = list(first_page.get("results", []))
    total_pages = (total_results + PAGE_SIZE - 1) // PAGE_SIZE
    print(
        f"iNaturalist query: place {PLACE_ID}, {len(taxon_ids)} risk taxa, "
        f"Research Grade, {label}; {total_results} records",
        flush=True,
    )

    for page in range(2, total_pages + 1):
        time.sleep(PAGE_DELAY_SECONDS)
        payload = fetch_page(taxon_ids, page, accuracy)
        observations.extend(payload.get("results", []))
        print(f"Downloaded page {page}/{total_pages} ({label})", flush=True)

    if len(observations) != total_results:
        raise RuntimeError(
            f"Expected {total_results} observations ({label}), received "
            f"{len(observations)}; refusing to overwrite the current data."
        )
    return observations


def main():
    previous_observation_ids = set()
    if CSV_PATH.exists():
        with CSV_PATH.open("r", encoding="utf-8", newline="") as source:
            previous_observation_ids = {
                row["id"] for row in csv.DictReader(source)
            }

    taxon_ids = risk_taxon_ids()
    observations = []
    for accuracy, label in (
        ("known", "accuracy under 100 m"),
        ("unknown", "no accuracy recorded"),
    ):
        observations.extend(fetch_all(taxon_ids, accuracy, label))
    total_results = len(observations)

    # acc_below filters on the observer's private GPS accuracy. Observations whose
    # coordinates iNaturalist obscures (observer or taxon geoprivacy) still pass it,
    # but the public coordinates are randomized within a ~27 km cell, so drop them.
    unique_ids = {observation.get("id") for observation in observations}
    if len(unique_ids) != total_results:
        raise RuntimeError(
            f"Received duplicate observation IDs: {len(unique_ids)} unique of {total_results}."
        )
    public_observations = [
        observation for observation in observations
        if not observation.get("obscured")
    ]
    obscured_skipped = len(observations) - len(public_observations)
    print(f"Skipped {obscured_skipped} observations with obscured coordinates", flush=True)

    rows_by_id = {}
    photo_licenses = {}
    for observation in public_observations:
        row = observation_row(observation, photo_licenses)
        rows_by_id[row["id"]] = row
    rows = sorted(rows_by_id.values(), key=lambda row: int(row["id"]))
    new_observations = sum(
        row["id"] not in previous_observation_ids for row in rows
    )

    photo_license_data = {
        "source": "iNaturalist API observation photo metadata",
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "photos": photo_licenses,
    }
    temporary_csv = CSV_PATH.with_suffix(CSV_PATH.suffix + ".tmp")
    temporary_photo_licenses = PHOTO_LICENSES_PATH.with_suffix(
        PHOTO_LICENSES_PATH.suffix + ".tmp"
    )
    with temporary_csv.open("w", encoding="utf-8", newline="") as destination:
        writer = csv.DictWriter(
            destination,
            fieldnames=CSV_COLUMNS,
            extrasaction="ignore",
            lineterminator="\n",
        )
        writer.writeheader()
        writer.writerows(rows)
    with temporary_photo_licenses.open(
        "w",
        encoding="utf-8",
        newline="\n",
    ) as destination:
        json.dump(photo_license_data, destination, ensure_ascii=False, indent=2)
    temporary_csv.replace(CSV_PATH)
    temporary_photo_licenses.replace(PHOTO_LICENSES_PATH)
    temporary_refresh_metadata = REFRESH_METADATA_PATH.with_suffix(
        REFRESH_METADATA_PATH.suffix + ".tmp"
    )
    with temporary_refresh_metadata.open(
        "w",
        encoding="utf-8",
        newline="\n",
    ) as destination:
        json.dump(
            {
                "source": "GitHub Actions daily iNaturalist refresh",
                "last_updated": datetime.now(timezone.utc).isoformat(),
                "new_observations": new_observations,
            },
            destination,
            indent=2,
        )
        destination.write("\n")
    temporary_refresh_metadata.replace(REFRESH_METADATA_PATH)
    print(
        f"Saved {len(rows)} observations and {len(photo_licenses)} photo-license "
        f"records to {CSV_PATH.parent}; {new_observations} new qualifying "
        "observations since the previous refresh",
        flush=True,
    )


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, urllib.error.URLError, json.JSONDecodeError) as error:
        print(f"iNaturalist refresh failed: {error}", file=sys.stderr)
        raise
