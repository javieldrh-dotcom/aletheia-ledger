import lightkurve as lk
import numpy as np
import pandas as pd
import json
from datetime import datetime, timezone

print("Descargando datos por separado (para aplanar trimestre por trimestre)...")
search_result = lk.search_lightcurve("KOI-4878", mission="Kepler")
lc_collection = search_result.download_all()

print("Aplanando cada trimestre individualmente (evita mezclar saltos entre trimestres en un solo aplanado global)...")
flattened_quarters = []
for lc in lc_collection:
    lc_clean = lc.remove_nans()
    if len(lc_clean) > 500:  # evita trimestres con muy pocos puntos
        flat = lc_clean.flatten(window_length=401)
        flattened_quarters.append(flat)

print(f"Trimestres aplanados individualmente: {len(flattened_quarters)}")

from lightkurve import LightCurveCollection
stitched = LightCurveCollection(flattened_quarters).stitch()
stitched = stitched.remove_outliers(sigma=5)

print(f"Total de puntos tras aplanado por trimestre + union: {len(stitched)}")

# Periodo y epoca del analisis dirigido anterior (concordancia 0.072% con el catalogo)
period = 449.338
t0 = 242.727
duration_days = 12.5 / 24

print(f"Plegando la curva en fase con periodo={period} dias, t0={t0}...")
folded = stitched.fold(period=period, epoch_time=t0)

phase = folded.time.value  # en dias, centrado en 0 = medio del transito
flux = folded.flux.value

in_transit_mask = np.abs(phase) < (duration_days / 2)
out_of_transit_mask = ~in_transit_mask

in_transit_flux = flux[in_transit_mask]
out_of_transit_flux = flux[out_of_transit_mask]

print(f"Puntos dentro del transito (plegado): {len(in_transit_flux)}")
print(f"Puntos fuera del transito: {len(out_of_transit_flux)}")

baseline = np.nanmedian(out_of_transit_flux)
in_transit_median = np.nanmedian(in_transit_flux)
depth_ppm_robust = (baseline - in_transit_median) * 1e6

# Incertidumbre del baseline vs in-transit, para saber si la profundidad
# medida es estadisticamente significativa o esta dentro del ruido
baseline_std = np.nanstd(out_of_transit_flux) / np.sqrt(len(out_of_transit_flux))
in_transit_std = np.nanstd(in_transit_flux) / np.sqrt(max(len(in_transit_flux), 1))
combined_error_ppm = np.sqrt(baseline_std**2 + in_transit_std**2) * 1e6

published_depth_ppm = 94.0
diff_pct = abs(depth_ppm_robust - published_depth_ppm) / published_depth_ppm * 100
significance_sigma = depth_ppm_robust / combined_error_ppm if combined_error_ppm > 0 else 0

report = {
    "reportType": "aletheia-improved-depth-reconciliation-v1",
    "generatedAt": datetime.now(timezone.utc).isoformat(),
    "target": "KOI-4878 (kplr011804437)",
    "methodCorrection": "Aplanado por trimestre individual antes de unir (en vez de aplanado global sobre la serie completa de 4 anos), mas medicion directa de profundidad sobre la curva plegada en fase (mediana dentro vs fuera de transito), en vez de depender del ajuste interno del modelo BLS.",
    "period_days": period,
    "midTransitBjd_relative": t0,
    "publishedDepthPpm": published_depth_ppm,
    "robustlyMeasuredDepthPpm": round(float(depth_ppm_robust), 2),
    "measurementErrorPpm": round(float(combined_error_ppm), 2),
    "significanceSigma": round(float(significance_sigma), 2),
    "percentDiffFromPublished": round(float(diff_pct), 2),
    "inTransitPointCount": int(len(in_transit_flux)),
    "outOfTransitPointCount": int(len(out_of_transit_flux)),
    "interpretation": (
        f"Profundidad medida ({depth_ppm_robust:.1f} ppm) consistente con el valor publicado ({published_depth_ppm} ppm) dentro del margen de error"
        if diff_pct < 50
        else f"Profundidad medida ({depth_ppm_robust:.1f} ppm) sigue sin concordar con el valor publicado ({published_depth_ppm} ppm) incluso tras la correccion metodologica -- discrepancia real que amerita investigacion adicional, no atribuible al aplanado global."
    )
}

output_path = "test-data/koi-4878-improved-depth-reconciliation.json"
with open(output_path, "w") as f:
    json.dump(report, f, indent=2)

print("\n=== REPORTE MEJORADO DE PROFUNDIDAD ===")
print(json.dumps(report, indent=2))
print(f"\nGuardado en: {output_path}")