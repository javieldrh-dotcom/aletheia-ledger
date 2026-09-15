"""
Mide el impacto real del cambio de umbral de 'no concluyente'
(0.5 -> 0.8) sobre el recall de deteccion de falsos positivos,
usando los casos ya descargados en public/case-studies/ (no
requiere volver a consultar MAST).

Misma logica de los 6 criterios que scripts/run_calibration_v3.py,
mas el calculo de isInconclusive bajo ambos umbrales para comparar.
"""

import json
import numpy as np
import pandas as pd

MANIFEST_PATH = "public/case-studies/manifest.json"
OLD_THRESHOLD = 0.5
NEW_THRESHOLD = 0.8


def median(arr):
    return float(np.median(arr))


def mad_std(arr):
    med = median(arr)
    return 1.4826 * median(np.abs(arr - med))


def evaluate_candidate(time, flux, flux_err, period, epoch_bkjd, duration_hours):
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
        odd_depths_arr = 1 - flux[odd_mask]
        even_depths_arr = 1 - flux[even_mask]
        odd_depth = median(odd_depths_arr)
        even_depth = median(even_depths_arr)
        # Test de significancia (sigma), no fraccion simple -- mismo principio
        # que el Robovetter oficial de Kepler usa para este mismo test
        # (diferencia de profundidades dividida entre la incertidumbre de esa
        # diferencia), y el mismo patron que ya usa nuestro propio criterio
        # 'secondary' para el eclipse secundario.
        odd_err = mad_std(odd_depths_arr) / np.sqrt(len(odd_depths_arr))
        even_err = mad_std(even_depths_arr) / np.sqrt(len(even_depths_arr))
        combined_err = np.sqrt(odd_err**2 + even_err**2)
        odd_even_sig = abs(odd_depth - even_depth) / combined_err if combined_err > 0 else 0
    else:
        odd_even_sig = 999
    criteria["odd_even"] = {"value": float(odd_even_sig), "passed": bool(odd_even_sig < 3.0)}

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
    # Pesos fijos, recalibrados con evidencia real de 212 candidatos:
    # secondary (37.2pp de brecha) y sufficiency (33.8pp) son los mas
    # fuertes -- sufficiency pasa de tener peso 0 (solo redistribuia)
    # a competir como criterio real. odd_even y shape se redujeron
    # porque la medicion mostro que apenas discriminan (2.2pp y -2.4pp).
    weights = {
        "secondary": 0.25,
        "sufficiency": 0.25,
        "noise": 0.20,
        "flare": 0.15,
        "odd_even": 0.10,
        "shape": 0.05,
    }
    total_w = sum(weights.values())
    confidence = sum(weights[k] for k in weights if criteria[k]["passed"]) / total_w if total_w > 0 else 0

    veto = (not criteria["secondary"]["passed"]) and (criteria["secondary"]["value"] > 6.0)
    is_false_positive = bool(veto or confidence < 0.6)

    return {
        "confidence": float(confidence),
        "isFalsePositive": is_false_positive,
        "vetoed": bool(veto),
        "resolutionFactor": float(resolution_factor),
        "criteriaPassed": {k: criteria[k]["passed"] for k in criteria},
        "criteriaValues": {k: criteria[k]["value"] for k in criteria},
    }


def main():
    with open(MANIFEST_PATH, "r") as f:
        manifest = json.load(f)

    # Solo casos con etiqueta real conocida -- excluye "CANDIDATE (...)"
    # como KOI-4878, que no tiene verdad fundamental para medir recall.
    labeled = [
        c for c in manifest
        if c["disposition"] in ("CONFIRMED", "FALSE POSITIVE")
    ]
    print(f"Casos con etiqueta real conocida: {len(labeled)} de {len(manifest)} en el manifest.\n")

    results = []
    for i, case in enumerate(labeled, start=1):
        csv_path = f"public/case-studies/{case['csvFile']}"
        try:
            df = pd.read_csv(csv_path)
            time_arr = df["time"].values
            flux_arr = df["flux"].values
            flux_err_arr = df["flux_err"].values

            valid = ~(np.isnan(time_arr) | np.isnan(flux_arr) | np.isnan(flux_err_arr))
            time_arr, flux_arr, flux_err_arr = time_arr[valid], flux_arr[valid], flux_err_arr[valid]

            if len(time_arr) < 50:
                print(f"[{i}/{len(labeled)}] {case['name']}: muy pocos puntos, omitiendo.")
                continue

            verdict = evaluate_candidate(
                time_arr, flux_arr, flux_err_arr,
                case["periodDays"], case["epochBjd"], case["durationHours"]
            )
            verdict["name"] = case["name"]
            verdict["disposition"] = case["disposition"]
            results.append(verdict)
            print(f"[{i}/{len(labeled)}] {case['name']} ({case['disposition']}): "
                  f"confianza={verdict['confidence']:.2f}, rf={verdict['resolutionFactor']:.2f}")

        except FileNotFoundError:
            print(f"[{i}/{len(labeled)}] {case['name']}: archivo CSV no encontrado, omitiendo.")
        except Exception as e:
            print(f"[{i}/{len(labeled)}] {case['name']}: ERROR ({e}), omitiendo.")

    print(f"\n\nProcesados: {len(results)} candidatos con etiqueta real.\n")
    compare_thresholds(results)
    print()
    breakdown_missed_false_positives(results)
    print()
    print_value_distributions(results)


def breakdown_missed_false_positives(results):
    """Poder discriminativo real de cada criterio: que tan seguido
    aprueba en CONFIRMADOS reales (deberia ser casi siempre) contra
    que tan seguido aprueba en FALSOS POSITIVOS reales (deberia ser
    poco frecuente). Un criterio util tiene una brecha grande entre
    ambos porcentajes. Un criterio con porcentajes parecidos en
    ambos grupos no esta discriminando nada, sin importar su umbral."""
    confirmed = [r for r in results if r["disposition"] == "CONFIRMED"]
    false_pos = [r for r in results if r["disposition"] == "FALSE POSITIVE"]

    print("=" * 70)
    print(f"PODER DISCRIMINATIVO POR CRITERIO")
    print(f"Confirmados: {len(confirmed)} | Falsos positivos: {len(false_pos)}")
    print("=" * 70)

    criterion_names = list(results[0]["criteriaPassed"].keys())
    print(f"{'Criterio':<15} {'% aprueba en CONFIRMED':<25} {'% aprueba en FALSE POS':<25} {'Brecha':<10}")
    for name in criterion_names:
        pct_confirmed = sum(1 for r in confirmed if r["criteriaPassed"][name]) / len(confirmed) * 100
        pct_fp = sum(1 for r in false_pos if r["criteriaPassed"][name]) / len(false_pos) * 100
        gap = pct_confirmed - pct_fp
        flag = "  <-- debil" if abs(gap) < 15 else ("  <-- fuerte" if gap > 30 else "")
        print(f"{name:<15} {pct_confirmed:>6.1f}%{'':<18} {pct_fp:>6.1f}%{'':<18} {gap:>+6.1f}pp{flag}")


def percentile(values, p):
    return float(np.percentile(values, p))


def print_value_distributions(results):
    """Distribucion real (no solo pasa/no pasa) de cada criterio,
    separada por CONFIRMED vs FALSE POSITIVE. Esto distingue entre
    'el umbral esta mal puesto' (las distribuciones se solapan poco
    pero el corte esta en mal lugar) y 'el criterio no funciona como
    se penso' (las distribuciones son practicamente identicas, sin
    importar donde se ponga el umbral)."""
    confirmed = [r for r in results if r["disposition"] == "CONFIRMED"]
    false_pos = [r for r in results if r["disposition"] == "FALSE POSITIVE"]
    criterion_names = list(results[0]["criteriaValues"].keys())

    print("=" * 70)
    print("DISTRIBUCION DE VALORES CRUDOS (no solo pasa/no pasa)")
    print("=" * 70)

    for name in criterion_names:
        conf_vals = [r["criteriaValues"][name] for r in confirmed]
        fp_vals = [r["criteriaValues"][name] for r in false_pos]

        print(f"\n--- {name} ---")
        print(f"{'Grupo':<14} {'p10':>10} {'p25':>10} {'mediana':>10} {'p75':>10} {'p90':>10}")
        print(f"{'CONFIRMED':<14} "
              f"{percentile(conf_vals,10):>10.4f} {percentile(conf_vals,25):>10.4f} "
              f"{percentile(conf_vals,50):>10.4f} {percentile(conf_vals,75):>10.4f} "
              f"{percentile(conf_vals,90):>10.4f}")
        print(f"{'FALSE POS':<14} "
              f"{percentile(fp_vals,10):>10.4f} {percentile(fp_vals,25):>10.4f} "
              f"{percentile(fp_vals,50):>10.4f} {percentile(fp_vals,75):>10.4f} "
              f"{percentile(fp_vals,90):>10.4f}")


def compare_thresholds(results):
    def stats_for_threshold(threshold):
        # Excluye los marcados 'no concluyente' bajo este umbral,
        # igual que haria el dashboard real -- no cuentan como
        # veredicto binario correcto ni incorrecto.
        decisive = [r for r in results if r["resolutionFactor"] >= threshold]
        inconclusive_count = len(results) - len(decisive)

        tp = sum(1 for r in decisive if r["disposition"] == "FALSE POSITIVE" and r["isFalsePositive"])
        fn = sum(1 for r in decisive if r["disposition"] == "FALSE POSITIVE" and not r["isFalsePositive"])
        fp = sum(1 for r in decisive if r["disposition"] == "CONFIRMED" and r["isFalsePositive"])
        tn = sum(1 for r in decisive if r["disposition"] == "CONFIRMED" and not r["isFalsePositive"])

        recall = tp / (tp + fn) if (tp + fn) > 0 else 0
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0

        return {
            "inconclusive": inconclusive_count,
            "tp": tp, "fn": fn, "fp": fp, "tn": tn,
            "recall": recall, "precision": precision,
            "decisive_total": len(decisive),
        }

    old_stats = stats_for_threshold(OLD_THRESHOLD)
    new_stats = stats_for_threshold(NEW_THRESHOLD)

    print("=" * 70)
    print(f"UMBRAL VIEJO (no concluyente si resolutionFactor < {OLD_THRESHOLD})")
    print("=" * 70)
    print(f"  No concluyentes: {old_stats['inconclusive']}")
    print(f"  Veredictos binarios dados: {old_stats['decisive_total']}")
    print(f"  Verdaderos positivos (FP detectado): {old_stats['tp']}")
    print(f"  Falsos negativos (FP escapado como viable): {old_stats['fn']}")
    print(f"  Recall: {old_stats['recall']:.1%}")
    print(f"  Precision: {old_stats['precision']:.1%}")

    print()
    print("=" * 70)
    print(f"UMBRAL NUEVO (no concluyente si resolutionFactor < {NEW_THRESHOLD})")
    print("=" * 70)
    print(f"  No concluyentes: {new_stats['inconclusive']}")
    print(f"  Veredictos binarios dados: {new_stats['decisive_total']}")
    print(f"  Verdaderos positivos (FP detectado): {new_stats['tp']}")
    print(f"  Falsos negativos (FP escapado como viable): {new_stats['fn']}")
    print(f"  Recall: {new_stats['recall']:.1%}")
    print(f"  Precision: {new_stats['precision']:.1%}")

    print()
    print("=" * 70)
    print("IMPACTO DEL CAMBIO")
    print("=" * 70)
    rescued_fn = old_stats["fn"] - new_stats["fn"]
    lost_tn = old_stats["tn"] - new_stats["tn"]
    print(f"  Falsos negativos 'rescatados' (ahora no concluyentes en vez de viables): {rescued_fn}")
    print(f"  Confirmados que antes eran definitivos y ahora quedan 'no concluyentes': {lost_tn}")
    print(f"  Cambio en recall: {old_stats['recall']:.1%} -> {new_stats['recall']:.1%}")
    print(f"  Cambio en precision: {old_stats['precision']:.1%} -> {new_stats['precision']:.1%}")


if __name__ == "__main__":
    main()
