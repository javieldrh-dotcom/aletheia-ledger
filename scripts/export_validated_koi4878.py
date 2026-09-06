import lightkurve as lk
import pandas as pd
from lightkurve import LightCurveCollection

print("Descargando y aplanando por trimestre (mismo metodo que dio 8.43 sigma)...")
search_result = lk.search_lightcurve("KOI-4878", mission="Kepler")
lc_collection = search_result.download_all()

flattened_quarters = []
for lc in lc_collection:
    lc_clean = lc.remove_nans()
    if len(lc_clean) > 500:
        flat = lc_clean.flatten(window_length=401)
        flattened_quarters.append(flat)

stitched = LightCurveCollection(flattened_quarters).stitch()
stitched = stitched.remove_outliers(sigma=5)

df = pd.DataFrame({
    "time": stitched.time.value,
    "flux": stitched.flux.value,
    "flux_err": stitched.flux_err.value,
    "quality": 0
})

output_path = "test-data/koi-4878-validated.csv"
df.to_csv(output_path, index=False)

print(f"Guardado: {output_path}")
print(f"Total de filas: {len(df)}")
print(df.head())