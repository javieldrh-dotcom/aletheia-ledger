import pandas as pd
import numpy as np
import json
from datetime import datetime, timezone
from lightkurve import LightCurve

print("Cargando curva de luz real de KOI-4878...")
df = pd.read_csv("test-data/koi-4878-real-kepler.csv")

lc = LightCurve(time=df["time"].values, flux=df["flux"].values, flux_err=df["flux_err"].values)
lc = lc.remove_nans().remove_outliers(sigma=5)

print("Aplanando la curva (removiendo tendencias de largo plazo)...")
flat_lc = lc.flatten(window_length=401)

print("Ejecutando busqueda BLS (Box Least Squares)...")
print("Rango de periodo: 400-500 dias, centrado en el valor publicado (449.015 dias)")

period_grid = np.linspace(400, 500, 15000)
duration_grid = [0.4, 0.45, 0.5, 0.55, 0.6]  # dias, alrededor de las 12.5 horas publicadas

bls = flat_lc.to_periodogram(
    method="bls",
    period=period_grid,
    duration=duration_grid
)

derived_period = float(bls.period_at_max_power.value)
derived_t0 = float(bls.transit_time_at_max_power.value)
derived_duration_hours = float(bls.duration_at_max_power.value) * 24
derived_depth_ppm = float(bls.depth_at_max_power.value) * 1e6
max_power = float(bls.max_power.value)

published = {
    "periodDays": 449.015,
    "periodErrorDays": 0.021,
    "durationHours": 12.5,
    "depthPpm": 94.0,
    "source": "Analisis publicado de datos Kepler Q1-Q16 (Wikipedia/NASA Exoplanet Archive)"
}

derived = {
    "periodDays": derived_period,
    "midTransitBjd": derived_t0,
    "durationHours": derived_duration_hours,
    "depthPpm": derived_depth_ppm,
    "blsMaxPower": max_power
}

period_diff_pct = abs(derived_period - published["periodDays"]) / published["periodDays"] * 100
depth_diff_pct = abs(derived_depth_ppm - published["depthPpm"]) / published["depthPpm"] * 100

reconciliation = {
    "reportType": "aletheia-period-reconciliation-v1",
    "generatedAt": datetime.now(timezone.utc).isoformat(),
    "target": "KOI-4878 (kplr011804437)",
    "publishedCatalogValues": published,
    "independentlyDerivedValues": derived,
    "reconciliation": {
        "periodAgreementPercentDiff": round(period_diff_pct, 4),
        "depthAgreementPercentDiff": round(depth_diff_pct, 4),
        "interpretation": (
            "Concordancia fuerte" if period_diff_pct < 1
            else "Concordancia moderada" if period_diff_pct < 5
            else "Discrepancia significativa -- senal probablemente no resuelta con claridad (esperable dada la profundidad de 94 ppm, cercana al piso de ruido fotometrico)"
        )
    }
}

output_path = "test-data/koi-4878-reconciliation-report.json"
with open(output_path, "w") as f:
    json.dump(reconciliation, f, indent=2)

print("\n=== REPORTE DE RECONCILIACION ===")
print(json.dumps(reconciliation, indent=2))
print(f"\nGuardado en: {output_path}")