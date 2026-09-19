"""
Expande la galeria de casos de estudio descargando candidatos reales
adicionales desde el catalogo de Kepler (via NASA Exoplanet Archive + MAST).

Uso:
    python scripts/expand_case_studies.py --n 100

Es seguro correrlo varias veces: nunca sobrescribe el manifest existente,
solo agrega casos nuevos que no esten ya presentes (por kepid).
Guarda progreso despues de cada caso exitoso.
"""

import argparse
import json
import os
import random
import time

import lightkurve as lk
import pandas as pd
from astroquery.ipac.nexsci.nasa_exoplanet_archive import NasaExoplanetArchive
from lightkurve import LightCurveCollection

MANIFEST_PATH = "public/case-studies/manifest.json"
OUTPUT_DIR = "public/case-studies"
FAILED_LOG_PATH = "public/case-studies/_failed_downloads.json"


def load_existing_manifest():
    if not os.path.exists(MANIFEST_PATH):
        return []
    with open(MANIFEST_PATH, "r") as f:
        return json.load(f)


def save_manifest(manifest):
    with open(MANIFEST_PATH, "w") as f:
        json.dump(manifest, f, indent=2)


def load_failed_log():
    if not os.path.exists(FAILED_LOG_PATH):
        return []
    with open(FAILED_LOG_PATH, "r") as f:
        return json.load(f)


def save_failed_log(failed):
    with open(FAILED_LOG_PATH, "w") as f:
        json.dump(failed, f, indent=2)


def fetch_koi_catalog():
    """Consulta en vivo el catalogo completo de KOIs desde el NASA Exoplanet Archive."""
    print("Consultando el NASA Exoplanet Archive (catalogo KOI completo)...")
    table = NasaExoplanetArchive.query_criteria(
        table="cumulative",
        select="kepoi_name,kepid,koi_disposition,koi_period,koi_time0bk,koi_duration",
    )
    df = table.to_pandas()
    df = df.dropna(subset=["kepid", "koi_period", "koi_time0bk", "koi_duration"])
    print(f"  {len(df)} candidatos disponibles en el catalogo.")
    return df


def select_new_candidates(catalog_df, existing_kepids, n):
    """Selecciona N candidatos nuevos, balanceando CONFIRMED y FALSE POSITIVE."""
    available = catalog_df[~catalog_df["kepid"].isin(existing_kepids)]

    confirmed = available[available["koi_disposition"] == "CONFIRMED"]
    false_pos = available[available["koi_disposition"] == "FALSE POSITIVE"]

    n_confirmed = n // 2
    n_fp = n - n_confirmed

    picked_confirmed = confirmed.sample(n=min(n_confirmed, len(confirmed)), random_state=None)
    picked_fp = false_pos.sample(n=min(n_fp, len(false_pos)), random_state=None)

    picked = pd.concat([picked_confirmed, picked_fp]).sample(frac=1).reset_index(drop=True)
    return picked


def download_and_process_one(row):
    """Descarga y procesa la curva de luz de un candidato. Devuelve (df, pointCount) o None si falla."""
    kepid = int(row["kepid"])
    search_result = lk.search_lightcurve(f"KIC {kepid}", mission="Kepler")
    if len(search_result) == 0:
        raise RuntimeError("Sin datos disponibles en MAST para este KIC")

    lc_collection = search_result.download_all()
    flattened = []
    for lc in lc_collection:
        lc_clean = lc.remove_nans()
        if len(lc_clean) > 500:
            flattened.append(lc_clean.flatten(window_length=401))

    if not flattened:
        raise RuntimeError("Datos insuficientes tras el filtrado de calidad")

    stitched = LightCurveCollection(flattened).stitch()
    stitched = stitched.remove_outliers(sigma=5)

    df = pd.DataFrame({
        "time": stitched.time.value,
        "flux": stitched.flux.value,
        "flux_err": stitched.flux_err.value,
        "quality": 0,
    })
    return df


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--n", type=int, default=100, help="Cuantos casos nuevos agregar")
    args = parser.parse_args()

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    manifest = load_existing_manifest()
    existing_kepids = {c["kepid"] for c in manifest}
    print(f"Manifest actual: {len(manifest)} casos ya guardados.")

    failed = load_failed_log()
    already_failed_kepids = {f["kepid"] for f in failed}

    catalog = fetch_koi_catalog()
    candidates = select_new_candidates(catalog, existing_kepids | already_failed_kepids, args.n)
    print(f"Se intentaran descargar {len(candidates)} candidatos nuevos.\n")

    success_count = 0
    for progress_i, (i, row) in enumerate(candidates.iterrows(), start=1):
        kepoi_name = row["kepoi_name"]
        kepid = int(row["kepid"])
        print(f"[{progress_i}/{len(candidates)}] {kepoi_name} (KIC {kepid})...", end=" ")

        try:
            df = download_and_process_one(row)

            safe_id = kepoi_name.lower().replace(".", "-").replace(" ", "-")
            csv_file = f"{safe_id}.csv"
            output_path = os.path.join(OUTPUT_DIR, csv_file)
            df.to_csv(output_path, index=False)

            manifest.append({
                "id": safe_id,
                "name": kepoi_name,
                "kepid": kepid,
                "csvFile": csv_file,
                "disposition": row["koi_disposition"],
                "periodDays": float(row["koi_period"]),
                "epochBjd": float(row["koi_time0bk"]),
                "durationHours": float(row["koi_duration"]),
                "pointCount": len(df),
            })

            # Guarda progreso inmediatamente -- no se pierde nada si se corta a la mitad
            save_manifest(manifest)
            success_count += 1
            print(f"OK ({len(df)} puntos). Total en manifest: {len(manifest)}")

        except Exception as e:
            failed.append({"kepoi_name": kepoi_name, "kepid": kepid, "error": str(e)})
            save_failed_log(failed)
            print(f"FALLO ({e})")

        time.sleep(1)  # cortesia con los servidores de MAST

    print(f"\nListo. {success_count} casos nuevos agregados exitosamente.")
    print(f"{len(failed)} fallaron en total (ver {FAILED_LOG_PATH}).")
    print(f"Manifest final: {len(manifest)} casos.")


if __name__ == "__main__":
    main()
