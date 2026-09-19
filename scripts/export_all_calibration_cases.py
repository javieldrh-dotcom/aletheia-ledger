import lightkurve as lk
import pandas as pd
from lightkurve import LightCurveCollection
import json
import os

os.makedirs("public/case-studies", exist_ok=True)

sample = pd.read_csv("test-data/calibration/sample_manifest.csv")

with open("test-data/calibration/calibration_results.json") as f:
    calib_results = json.load(f)

results_by_name = {r["kepoi_name"]: r for r in calib_results if "error" not in r}

already_done = {
    "K03384.02", "K00369.01", "K07524.01", "K01042.02", "K06033.01", "K00515.01",
}

with open("public/case-studies/manifest.json") as f:
    manifest = json.load(f)

existing_ids = {m["id"] for m in manifest}

for idx, row in sample.iterrows():
    kepoi_name = row["kepoi_name"]
    case_id = kepoi_name.lower().replace(".", "-")

    if case_id in existing_ids or kepoi_name in already_done:
        print(f"Ya existe, omitiendo: {kepoi_name}")
        continue

    kepid = int(row["kepid"])
    csv_file = f"{case_id}.csv"

    print(f"Descargando {kepoi_name} (KIC {kepid})...")
    try:
        search_result = lk.search_lightcurve(f"KIC {kepid}", mission="Kepler")
        lc_collection = search_result.download_all()
        if lc_collection is None or len(lc_collection) == 0:
            print(f"  Sin datos, omitiendo.")
            continue

        flattened = []
        for lc in lc_collection:
            lc_clean = lc.remove_nans()
            if len(lc_clean) > 500:
                flattened.append(lc_clean.flatten(window_length=401))

        if len(flattened) == 0:
            print(f"  Sin trimestres validos, omitiendo.")
            continue

        stitched = LightCurveCollection(flattened).stitch()
        stitched = stitched.remove_outliers(sigma=5)

        df = pd.DataFrame({
            "time": stitched.time.value,
            "flux": stitched.flux.value,
            "flux_err": stitched.flux_err.value,
            "quality": 0
        })

        output_path = f"public/case-studies/{csv_file}"
        df.to_csv(output_path, index=False)
        print(f"  Guardado: {output_path} ({len(df)} puntos)")

        calib = results_by_name.get(kepoi_name)
        note = None
        if calib is not None:
            note = "Motor acerto" if calib["correct"] else "Motor fallo (Fase 2.5)"

        manifest.append({
            "id": case_id,
            "name": kepoi_name,
            "kepid": kepid,
            "csvFile": csv_file,
            "disposition": row["koi_disposition"],
            "periodDays": float(row["koi_period"]),
            "epochBjd": float(row["koi_time0bk"]),
            "durationHours": float(row["koi_duration"]),
            "pointCount": len(df),
            "note": note
        })

    except Exception as e:
        print(f"  ERROR: {e}")
        continue

with open("public/case-studies/manifest.json", "w") as f:
    json.dump(manifest, f, indent=2)

print(f"\nManifiesto actualizado. Total de casos: {len(manifest)}")