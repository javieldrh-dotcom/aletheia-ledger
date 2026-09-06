import lightkurve as lk
import numpy as np
import pandas as pd
import json
from datetime import datetime, timezone
from lightkurve import LightCurveCollection

print("Descargando y aplanando por trimestre (igual que el paso anterior)...")
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

time = stitched.time.value
flux = stitched.flux.value

published_period = 449.015
duration_days = 12.5 / 24

def evaluate_period(period, t0_guess):
    """Pliega con este periodo/t0 y devuelve significancia del oscurecimiento
    (positivo = oscurecimiento real, como se espera de un transito)."""
    phase = ((time - t0_guess + period / 2) % period) - period / 2
    in_mask = np.abs(phase) < (duration_days / 2)
    out_mask = ~in_mask

    if in_mask.sum() < 20:
        return None

    baseline = np.nanmedian(flux[out_mask])
    in_transit = np.nanmedian(flux[in_mask])
    depth_ppm = (baseline - in_transit) * 1e6

    baseline_err = np.nanstd(flux[out_mask]) / np.sqrt(out_mask.sum())
    in_err = np.nanstd(flux[in_mask]) / np.sqrt(in_mask.sum())
    combined_err_ppm = np.sqrt(baseline_err**2 + in_err**2) * 1e6

    significance = depth_ppm / combined_err_ppm if combined_err_ppm > 0 else 0
    return depth_ppm, combined_err_ppm, significance, in_mask.sum()

print("Buscando t0 optimo para el periodo publicado (barrido de epoca)...")
t0_candidates = np.linspace(time.min(), time.min() + published_period, 400)
best_t0_result = None
best_t0 = None

for t0 in t0_candidates:
    result = evaluate_period(published_period, t0)
    if result is None:
        continue
    depth_ppm, err_ppm, sig, n = result
    if best_t0_result is None or sig > best_t0_result[2]:
        best_t0_result = (depth_ppm, err_ppm, sig, n)
        best_t0 = t0

print(f"Mejor t0 encontrado: {best_t0:.4f} (significancia: {best_t0_result[2]:.2f} sigma)")

print("\nRefinando periodo alrededor del valor publicado, usando ese t0...")
period_candidates = np.linspace(published_period - 0.05, published_period + 0.05, 2000)
best_period_result = None
best_period = None

for p in period_candidates:
    result = evaluate_period(p, best_t0)
    if result is None:
        continue
    depth_ppm, err_ppm, sig, n = result
    if best_period_result is None or sig > best_period_result[2]:
        best_period_result = (depth_ppm, err_ppm, sig, n)
        best_period = p

depth_ppm, err_ppm, sig, n = best_period_result
published_depth_ppm = 94.0
diff_pct = abs(depth_ppm - published_depth_ppm) / published_depth_ppm * 100

report = {
    "reportType": "aletheia-refined-period-reconciliation-v1",
    "generatedAt": datetime.now(timezone.utc).isoformat(),
    "target": "KOI-4878 (kplr011804437)",
    "method": "Busqueda fina de t0 y periodo maximizando significancia estadistica del oscurecimiento medido directamente (no potencia BLS generica), restringida a una ventana estrecha alrededor del periodo publicado.",
    "publishedPeriodDays": published_period,
    "refinedPeriodDays": round(float(best_period), 6),
    "refinedT0": round(float(best_t0), 6),
    "measuredDepthPpm": round(float(depth_ppm), 2),
    "measurementErrorPpm": round(float(err_ppm), 2),
    "significanceSigma": round(float(sig), 2),
    "inTransitPointCount": int(n),
    "publishedDepthPpm": published_depth_ppm,
    "percentDiffFromPublished": round(float(diff_pct), 2),
    "interpretation": (
        f"Tras refinar t0 y periodo maximizando significancia real, se detecto oscurecimiento de {depth_ppm:.1f} ppm ({sig:.2f} sigma), {'consistente' if diff_pct < 50 and depth_ppm > 0 else 'aun sin concordar'} con el valor publicado de {published_depth_ppm} ppm."
    )
}

with open("test-data/koi-4878-refined-reconciliation.json", "w") as f:
    json.dump(report, f, indent=2)

print("\n=== REPORTE REFINADO ===")
print(json.dumps(report, indent=2))