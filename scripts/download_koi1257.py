import lightkurve as lk
from lightkurve import LightCurveCollection
import pandas as pd

target_name = "KOI-1257"

print(f"Buscando curvas de luz para {target_name} en MAST...")
search_result = lk.search_lightcurve(target_name, mission="Kepler")
print(f"Se encontraron {len(search_result)} observaciones.")

print("Descargando...")
lc_collection = search_result.download_all()

print("Aplanando por trimestre individual (mismo metodo validado con KOI-4878)...")
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

output_path = "test-data/koi-1257-validated.csv"
df.to_csv(output_path, index=False)

print(f"\nGuardado: {output_path}")
print(f"Total de filas: {len(df)}")
print(df.head())