import lightkurve as lk
import sys

target_name = "KOI-4878"

print(f"Buscando curvas de luz para {target_name} en MAST...")
search_result = lk.search_lightcurve(target_name, mission="Kepler")

if len(search_result) == 0:
    print(f"No se encontraron resultados para {target_name}.")
    sys.exit(1)

print(f"Se encontraron {len(search_result)} observaciones:")
print(search_result)

print("\nDescargando la coleccion completa...")
lc_collection = search_result.download_all()

if lc_collection is None or len(lc_collection) == 0:
    print("La descarga no devolvio datos.")
    sys.exit(1)

print(f"Descargadas {len(lc_collection)} curvas de luz (quarters).")

print("Combinando en una sola curva de luz (stitch)...")
lc = lc_collection.stitch()

print("Removiendo puntos con NaN...")
lc = lc.remove_nans()

print(f"Total de puntos tras limpieza basica: {len(lc)}")

df = lc.to_pandas()

output_columns = {}
output_columns["time"] = df.index if df.index.name == "time" else df["time"]
output_columns["flux"] = df["flux"]
output_columns["flux_err"] = df["flux_err"] if "flux_err" in df.columns else 0.0001
output_columns["quality"] = df["quality"] if "quality" in df.columns else 0

import pandas as pd
output_df = pd.DataFrame(output_columns)

output_path = "test-data/koi-4878-real-kepler.csv"
output_df.to_csv(output_path, index=False)

print(f"\nGuardado en: {output_path}")
print(f"Total de filas: {len(output_df)}")
print(output_df.head())