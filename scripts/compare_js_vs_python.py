import lightkurve as lk
import pandas as pd
import numpy as np
from lightkurve import LightCurveCollection

print("Descargando y aplanando con Python (metodo validado Fase 2)...")
search_result = lk.search_lightcurve("KIC 5816811", mission="Kepler")
lc_collection = search_result.download_all()

flattened = []
for lc in lc_collection:
    lc_clean = lc.remove_nans()
    if len(lc_clean) > 500:
        flattened.append(lc_clean.flatten(window_length=401))

stitched = LightCurveCollection(flattened).stitch()

df_python = pd.DataFrame({
    "time": stitched.time.value,
    "flux": stitched.flux.value,
})

df_js = pd.read_csv("test-data/kic5816811-from-javascript.csv")

print(f"Puntos Python: {len(df_python)}, Puntos JS: {len(df_js)}")

df_python["time_r"] = df_python["time"].round(4)
df_js["time_r"] = df_js["time"].round(4)

merged = pd.merge(df_python, df_js, on="time_r", suffixes=("_py", "_js"))
print(f"Puntos emparejados por tiempo: {len(merged)}")

if len(merged) > 0:
    print("Columnas disponibles:", list(merged.columns))
    diff = merged["flux_py"] - merged["flux_js"]
    print(f"Diferencia media de flujo (Python - JS): {diff.mean():.6f}")
    print(f"Diferencia std: {diff.std():.6f}")
    print(f"Correlacion: {merged['flux_py'].corr(merged['flux_js']):.6f}")
    print("\nPrimeras 5 filas comparadas:")
    print(merged[["time_r", "flux_py", "flux_js"]].head())