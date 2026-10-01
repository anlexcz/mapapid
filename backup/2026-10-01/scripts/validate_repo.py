#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"


def load_json(path: Path):
    try:
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as exc:
        raise SystemExit(f"Invalid JSON {path.relative_to(ROOT)}: {exc}") from exc


def main():
    # Parse every checked-in JSON file so malformed generated/catalog data cannot deploy.
    for path in sorted(DATA.rglob("*.json")):
        load_json(path)

    manifest_path = DATA / "vehicles" / "index.json"
    manifest = load_json(manifest_path)
    files = manifest.get("files")
    if not isinstance(files, list):
        raise SystemExit("data/vehicles/index.json: 'files' must be an array")

    seen_files = set()
    seen_sa_ids = {}
    seen_vehicle_keys = {}
    count = 0

    for filename in files:
        if not isinstance(filename, str) or not filename.strip():
            raise SystemExit("data/vehicles/index.json contains an invalid filename")
        if filename in seen_files:
            raise SystemExit(f"Duplicate manifest entry: {filename}")
        seen_files.add(filename)

        path = DATA / "vehicles" / filename
        if not path.is_file():
            raise SystemExit(f"Manifest points to missing file: data/vehicles/{filename}")

        doc = load_json(path)
        default_operator = doc.get("operator", "")
        vehicles = doc.get("vehicles", [])
        if not isinstance(vehicles, list):
            raise SystemExit(f"{path.relative_to(ROOT)}: 'vehicles' must be an array")

        for idx, vehicle in enumerate(vehicles):
            if not isinstance(vehicle, dict):
                raise SystemExit(f"{path.relative_to(ROOT)} vehicle #{idx + 1} is not an object")
            operator = str(vehicle.get("operator") or default_operator or "").strip()
            traction = str(vehicle.get("traction") or "").strip().lower()
            ev = str(vehicle.get("ev") if vehicle.get("ev") is not None else "").strip()
            if not operator or not traction or not ev:
                raise SystemExit(
                    f"{path.relative_to(ROOT)} vehicle #{idx + 1}: operator, traction and ev are required"
                )

            key = (operator.casefold(), traction.casefold(), ev.casefold())
            where = f"{path.relative_to(ROOT)} vehicle #{idx + 1}"
            if key in seen_vehicle_keys:
                raise SystemExit(f"Duplicate vehicle key {key}: {seen_vehicle_keys[key]} and {where}")
            seen_vehicle_keys[key] = where

            sa_id = vehicle.get("sa_id")
            if sa_id not in (None, ""):
                sid = str(sa_id).strip()
                if sid in seen_sa_ids:
                    raise SystemExit(f"Duplicate sa_id {sid}: {seen_sa_ids[sid]} and {where}")
                seen_sa_ids[sid] = where
            count += 1

    print(f"Validation OK: {len(files)} vehicle files, {count} vehicle identities, all JSON parseable.")


if __name__ == "__main__":
    main()
