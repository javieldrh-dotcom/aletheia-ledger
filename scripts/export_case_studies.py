import lightkurve as lk
import pandas as pd
from lightkurve import LightCurveCollection
import json
import os

os.makedirs("public/case-studies", exist_ok=True)

cases = [
    {"kepoi_name": "K03384.02", "kepid": 8644365, "file": "k03384-confirmed-correct.csv"},
    {"kepoi_name": "K00369.01", "kepid": 7175184, "file": "k00369-confirmed-correct.csv"},
    {"kepoi_name": "K07524.01", "kepid": 12353720, "file": "k07524-fp-correctly-vetoed.csv"},
    {"kepoi_name": "K01042.02", "kepid": 5816811, "file": "k01042-fp-correctly-vetoed.csv"},
    {"kepoi_name": "K06033.01", "kepid": 7219906, "file": "k06033-fp-missed-limitation.csv"},
    {"kepoi_name": "K00515.01", "kepid": 7812179, "file": "k00515-fp-missed-limitation.csv"},
]

sample = pd.read_csv("test-data/calibration/sample_manifest.csv")

manifest = []

for case in cases:
    print(f"Descargando {case['kepoi_name']} (KIC {case['kepid']})...")
    row = sample[sample["kepoi_name"] == case["kepoi_name"]].iloc[0]

    search_result = lk.search_lightcurve(f"KIC {case['kepid']}", mission="Kepler")
    lc_collection = search_result.download_all()

    flattened = []
    for lc in lc_collection:
        lc_clean = lc.remove_nans()
        if len(lc_clean) > 500:
            flattened.append(lc_clean.flatten(window_length=401))

    stitched = LightCurveCollection(flattened).stitch()
    stitched = stitched.remove_outliers(sigma=5)

    df = pd.DataFrame({
        "time": stitched.time.value,
        "flux": stitched.flux.value,
        "flux_err": stitched.flux_err.value,
        "quality": 0
    })

    output_path = f"public/case-studies/{case['file']}"
    df.to_csv(output_path, index=False)
    print(f"  Guardado: {output_path} ({len(df)} puntos)")

    manifest.append({
        "id": case["kepoi_name"].lower().replace(".", "-"),
        "name": case["kepoi_name"],
        "kepid": case["kepid"],
        "csvFile": case["file"],
        "disposition": row["koi_disposition"],
        "periodDays": float(row["koi_period"]),
        "epochBjd": float(row["koi_time0bk"]),
        "durationHours": float(row["koi_duration"]),
        "pointCount": len(df)
    })

with open("public/case-studies/manifest.json", "w") as f:
    json.dump(manifest, f, indent=2)

print("\nManifiesto guardado: public/case-studies/manifest.json")