"""
Fase 2.5 (Ronda 3) - Ampliacion de la calibracion estadistica con 50
candidatos reales adicionales (25 confirmados + 25 falsos positivos),
excluyendo los 60 ya usados en las Rondas 1 y 2, para llegar a una
muestra combinada de ~128 candidatos reales.

Reproducible: semilla fija (44, distinta a las rondas anteriores).
"""

import lightkurve as lk
import numpy as np
import pandas as pd
import json
import time
import os
from lightkurve import LightCurveCollection
from astroquery.ipac.nexsci.nasa_exoplanet_archive import NasaExoplanetArchive

np.random.seed(44)

N_PER_CLASS = 25
OUTPUT_DIR = "test-data/calibration_v3"
os.makedirs(OUTPUT_DIR, exist_ok=True)

PREVIOUS_SAMPLE_PATHS = [
    "test-data/calibration/sample_manifest.csv",
    "test-data/calibration_v2/sample_manifest_v2.csv",
]


def get_sample():
    print("Consultando NASA Exoplanet Archive (tabla cumulative)...")
    table = NasaExoplanetArchive.query_criteria(
        table="cumulative",
        select="kepoi_name,kepid,koi_disposition,koi_period,koi_time0bk,koi_duration,koi_depth"
    ).to_pandas()

    table = table.dropna(subset=["koi_period", "koi_time0bk", "koi_duration"])

    excluded_names = set()
    for path in PREVIOUS_SAMPLE_PATHS:
        if os.path.exists(path):
            previous = pd.read_csv(path)
            excluded_names.update(previous["kepoi_name"].tolist())
    print(f"Excluyendo {len(excluded_names)} candidatos ya usados en Rondas 1 y 2.")

    table = table[~table["kepoi_name"].isin(excluded_names)]

    confirmed = table[table["koi_disposition"] == "CONFIRMED"]
    false_pos = table[table["koi_disposition"] == "FALSE POSITIVE"]

    print(f"Confirmados disponibles (tras exclusion): {len(confirmed)}, Falsos positivos: {len(false_pos)}")

    sample_confirmed = confirmed.sample(n=N_PER_CLASS, random_state=44)
    sample_fp = false_pos.sample(n=N_PER_CLASS, random_state=44)

    sample = pd.concat([sample_confirmed, sample_fp]).reset_index(drop=True)
    sample.to_csv(f"{OUTPUT_DIR}/sample_manifest_v3.csv", index=False)
    print(f"Muestra nueva guardada: {len(sample)} candidatos ({N_PER_CLASS} + {N_PER_CLASS})")
    return sample


def download_and_flatten(kepid):
    search_result = lk.search_lightcurve(f"KIC {int(kepid)}", mission="Kepler")
    if len(search_result) == 0:
        return None

    lc_collection = search_result.download_all()
    if lc_collection is None or len(lc_collection) == 0:
        return None

    flattened = []
    for lc in lc_collection:
        lc_clean = lc.remove_nans()
        if len(lc_clean) > 500:
            flattened.append(lc_clean.flatten(window_length=401))

    if len(flattened) == 0:
        return None

    stitched = LightCurveCollection(flattened).stitch()
    stitched = stitched.remove_outliers(sigma=5)
    return stitched


def median(arr):
    return float(np.median(arr))


def mad_std(arr):
    med = median(arr)
    return 1.4826 * median(np.abs(arr - med))


def evaluate_candidate(time, flux, flux_err, period, epoch_bkjd, duration_hours):
    """Misma logica de 6 criterios + veto que las rondas 1 y 2, ya con
    el filtrado de calidad correcto (solo NaN, sin excluir por
    bandera) validado en la sesion de integracion FITS-en-navegador."""
    duration_days = duration_hours / 24
    criteria = {}

    def phase_offset(t, ref_epoch):
        phase = (t - ref_epoch) / period
        return (phase - np.round(phase)) * period

    offset = phase_offset(time, epoch_bkjd)
    in_transit = np.abs(offset) < duration_days / 2

    cycle = np.floor((time - epoch_bkjd) / period)
    odd_mask = in_transit & (cycle % 2 != 0)
    even_mask = in_transit & (cycle % 2 == 0)
    if odd_mask.sum() > 2 and even_mask.sum() > 2:
        odd_depth = 1 - median(flux[odd_mask])
        even_depth = 1 - median(flux[even_mask])
        asym = abs(odd_depth - even_depth) / max(abs(odd_depth), abs(even_depth), 1e-9)
    else:
        asym = 1.0
    criteria["odd_even"] = {"value": float(asym), "passed": bool(asym < 0.15)}

    if in_transit.sum() > 5:
        in_flux = flux[in_transit]
        min_flux = np.min(in_flux)
        depth_range = 1 - min_flux
        near_bottom = np.sum(in_flux <= (min_flux + depth_range * 0.1))
        flat_frac = near_bottom / in_transit.sum()
    else:
        flat_frac = 0.0
    criteria["shape"] = {"value": float(flat_frac), "passed": bool(flat_frac > 0.15)}

    out_transit = ~in_transit
    if out_transit.sum() > 10:
        noise_ratio = mad_std(flux[out_transit]) / np.median(flux_err[out_transit])
    else:
        noise_ratio = 999
    criteria["noise"] = {"value": float(noise_ratio), "passed": bool(noise_ratio < 3.0)}

    baseline = median(flux)
    noise = mad_std(flux)
    flare_thresh = baseline + 4 * noise
    flare_ratio = np.sum(flux > flare_thresh) / len(flux)
    criteria["flare"] = {"value": float(flare_ratio), "passed": bool(flare_ratio < 0.02)}

    time_span = time.max() - time.min()
    n_transits = int(time_span / period)
    pts_per_transit = in_transit.sum() / max(n_transits, 1)
    sufficiency = (min(n_transits / 4, 1) + min(pts_per_transit / 15, 1)) / 2
    criteria["sufficiency"] = {"value": float(sufficiency), "passed": bool(n_transits >= 4 and pts_per_transit >= 15)}

    secondary_epoch = epoch_bkjd + period / 2
    sec_offset = phase_offset(time, secondary_epoch)
    in_secondary = np.abs(sec_offset) < duration_days / 2
    far_from_both = (~in_transit) & (~in_secondary)
    if in_secondary.sum() > 10 and far_from_both.sum() > 10:
        base_med = median(flux[far_from_both])
        sec_med = median(flux[in_secondary])
        depth_ppm = (base_med - sec_med) * 1e6
        base_err = mad_std(flux[far_from_both]) / np.sqrt(far_from_both.sum()) * 1e6
        sec_err = mad_std(flux[in_secondary]) / np.sqrt(in_secondary.sum()) * 1e6
        combined_err = np.sqrt(base_err**2 + sec_err**2)
        significance = depth_ppm / combined_err if combined_err > 0 else 0
    else:
        significance = 0
    criteria["secondary"] = {"value": float(significance), "passed": bool(significance < 3.0)}

    resolution_factor = criteria["sufficiency"]["value"]
    odd_even_w = 0.25 * resolution_factor
    shape_w = 0.15 * resolution_factor
    secondary_w = 0.2 * resolution_factor
    redistributed = (0.25 - odd_even_w) + (0.15 - shape_w) + (0.2 - secondary_w)
    noise_w = 0.2 + redistributed * 0.5
    flare_w = 0.2 + redistributed * 0.5

    weights = {"odd_even": odd_even_w, "shape": shape_w, "secondary": secondary_w, "noise": noise_w, "flare": flare_w}
    total_w = sum(weights.values())
    confidence = sum(weights[k] for k in weights if criteria[k]["passed"]) / total_w if total_w > 0 else 0

    veto = (not criteria["secondary"]["passed"]) and (criteria["secondary"]["value"] > 6.0)
    is_false_positive = bool(veto or confidence < 0.6)

    return {
        "criteria": {k: v for k, v in criteria.items()},
        "confidence": float(confidence),
        "isFalsePositive": is_false_positive,
        "vetoed": bool(veto),
    }


def main():
    sample = get_sample()
    results = []

    for idx, row in sample.iterrows():
        kepoi_name = row["kepoi_name"]
        kepid = row["kepid"]
        disposition = row["koi_disposition"]
        print(f"\n[{idx+1}/{len(sample)}] Procesando {kepoi_name} (KIC {kepid}, {disposition})...")

        try:
            lc = download_and_flatten(kepid)
            if lc is None:
                print("  Sin datos disponibles, omitiendo.")
                results.append({"kepoi_name": kepoi_name, "disposition": disposition, "error": "no_data"})
                continue

            time_arr = lc.time.value
            flux_arr = lc.flux.value
            flux_err_arr = lc.flux_err.value

            valid = ~(np.isnan(time_arr) | np.isnan(flux_arr) | np.isnan(flux_err_arr))
            time_arr, flux_arr, flux_err_arr = time_arr[valid], flux_arr[valid], flux_err_arr[valid]

            if len(time_arr) < 50:
                print("  Muy pocos puntos validos, omitiendo.")
                results.append({"kepoi_name": kepoi_name, "disposition": disposition, "error": "insufficient_points"})
                continue

            period = float(row["koi_period"])
            epoch = float(row["koi_time0bk"])
            duration = float(row["koi_duration"])

            verdict = evaluate_candidate(time_arr, flux_arr, flux_err_arr, period, epoch, duration)
            verdict["kepoi_name"] = kepoi_name
            verdict["kepid"] = int(kepid)
            verdict["disposition"] = disposition
            verdict["n_points"] = int(len(time_arr))

            predicted = "FALSE POSITIVE" if verdict["isFalsePositive"] else "CANDIDATE/CONFIRMED"
            actual = "FALSE POSITIVE" if disposition == "FALSE POSITIVE" else "CANDIDATE/CONFIRMED"
            verdict["correct"] = bool(predicted == actual)

            print(f"  Confianza: {verdict['confidence']:.2f}, Veredicto: {predicted}, Real: {actual}, Correcto: {verdict['correct']}")
            results.append(verdict)

        except Exception as e:
            print(f"  ERROR: {e}")
            results.append({"kepoi_name": kepoi_name, "disposition": disposition, "error": str(e)})

        time.sleep(1)

    with open(f"{OUTPUT_DIR}/calibration_results_v3.json", "w") as f:
        json.dump(results, f, indent=2)

    print(f"\n\nResultados guardados en {OUTPUT_DIR}/calibration_results_v3.json")
    print_confusion_matrix(results)


def print_confusion_matrix(results):
    valid_results = [r for r in results if "error" not in r]
    print(f"\n=== MATRIZ DE CONFUSION - RONDA 3 ({len(valid_results)} de {len(results)} candidatos procesados) ===")

    tp = sum(1 for r in valid_results if r["disposition"] == "FALSE POSITIVE" and r["isFalsePositive"])
    fn = sum(1 for r in valid_results if r["disposition"] == "FALSE POSITIVE" and not r["isFalsePositive"])
    fp = sum(1 for r in valid_results if r["disposition"] == "CONFIRMED" and r["isFalsePositive"])
    tn = sum(1 for r in valid_results if r["disposition"] == "CONFIRMED" and not r["isFalsePositive"])

    print(f"Verdaderos positivos (FP detectado correctamente): {tp}")
    print(f"Falsos negativos (FP no detectado): {fn}")
    print(f"Falsos positivos (Confirmado marcado como FP): {fp}")
    print(f"Verdaderos negativos (Confirmado correctamente aprobado): {tn}")

    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0
    accuracy = (tp + tn) / len(valid_results) if len(valid_results) > 0 else 0

    print(f"\nPrecision (para deteccion de falsos positivos): {precision:.2%}")
    print(f"Exhaustividad/Recall: {recall:.2%}")
    print(f"Exactitud global: {accuracy:.2%}")


if __name__ == "__main__":
    main()
