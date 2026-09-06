import pandas as pd
import numpy as np
import json
from datetime import datetime, timezone
from lightkurve import LightCurve

print("Cargando curva de luz...")
df = pd.read_csv("test-data/koi-4878-real-kepler.csv")

lc = LightCurve(time=df["time"].values, flux=df["flux"].values, flux_err=df["flux_err"].values)
lc = lc.remove_nans().remove_outliers(sigma=5)
flat_lc = lc.flatten(window_length=401)

published_period = 449.015
published_duration_days = 12.5 / 24

print(f"Evaluando potencia BLS especificamente en el periodo publicado ({published_period} dias)...")

# Grid muy fino y estrecho alrededor del valor publicado, en vez de la
# busqueda ciega 400-500. Esto es "verificar el asiento especifico",
# no "encontrar el total mas grande del libro".
narrow_period_grid = np.linspace(
    published_period - 0.5, published_period + 0.5, 2000
)
narrow_duration_grid = [published_duration_days]

bls_targeted = flat_lc.to_periodogram(
    method="bls",
    period=narrow_period_grid,
    duration=narrow_duration_grid
)

targeted_period = float(bls_targeted.period_at_max_power.value)
targeted_power = float(bls_targeted.max_power.value)
targeted_depth_ppm = float(bls_targeted.depth_at_max_power.value) * 1e6
targeted_t0 = float(bls_targeted.transit_time_at_max_power.value)

global_max_power = 11435.928856490298  # del analisis anterior, para comparar

power_ratio = targeted_power / global_max_power

report = {
    "reportType": "aletheia-targeted-reconciliation-v1",
    "generatedAt": datetime.now(timezone.utc).isoformat(),
    "target": "KOI-4878 (kplr011804437)",
    "method": "Verificacion dirigida vs busqueda ciega -- se evalua la potencia BLS especificamente en el periodo publicado, en vez de asumir que el maximo global es la senal correcta.",
    "globalBlindSearch": {
        "maxPowerFound": global_max_power,
        "periodAtMaxPower": 487.30582038802584,
        "note": "Senal mas fuerte en el rango 400-500 dias, pero no coincide con el candidato publicado."
    },
    "targetedSearchAtPublishedPeriod": {
        "period": targeted_period,
        "power": targeted_power,
        "depthPpm": targeted_depth_ppm,
        "midTransitBjd": targeted_t0
    },
    "reconciliation": {
        "powerRatioTargetedVsGlobalMax": round(power_ratio, 6),
        "interpretation": (
            "Hay evidencia real de una senal en el periodo publicado, mas debil que la senal dominante"
            if power_ratio > 0.05
            else "Sin evidencia significativa de senal en el periodo publicado -- la potencia BLS ahi es practicamente indistinguible del ruido de fondo, consistente con lo esperado para un candidato de 94 ppm no confirmado y de baja confiabilidad segun el propio catalogo Robovetter."
        )
    }
}

output_path = "test-data/koi-4878-targeted-reconciliation.json"
with open(output_path, "w") as f:
    json.dump(report, f, indent=2)

print(json.dumps(report, indent=2))
print(f"\nGuardado en: {output_path}")