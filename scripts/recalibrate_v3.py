"""
Aletheia Ledger -- Recalibracion de pesos (Fase 3) tras la correccion del
criterio de forma (Mandel & Agol 2002) y del criterio odd-even (significancia
con error fotometrico propagado).

Corre 100% en local, sobre los 252 candidatos ya descargados en
public/case-studies/ -- no descarga nada de MAST, no necesita lightkurve.

Uso:
    python scripts/recalibrate_v3.py

Requiere: numpy, scipy (pip install --user numpy scipy si hace falta)
"""
import json
import os
import numpy as np
from scipy.optimize import least_squares

CASE_STUDIES_DIR = os.path.join("public", "case-studies")
MANIFEST_PATH = os.path.join(CASE_STUDIES_DIR, "manifest.json")


# ---------------------------------------------------------------------------
# Modelo de transito de disco uniforme (Mandel & Agol 2002) -- misma logica
# que lib/vetting/transitModel.ts, reimplementada en Python para calibracion.
# ---------------------------------------------------------------------------
def occult_uniform(z, p):
    z = np.atleast_1d(np.asarray(z, dtype=float))
    flux = np.ones_like(z)
    full = z <= (1 - p)
    flux[full] = 1 - p ** 2
    partial = (z > abs(1 - p)) & (z <= (1 + p))
    if np.any(partial):
        zp = z[partial]
        k1 = np.arccos(np.clip((zp ** 2 + p ** 2 - 1) / (2 * zp * p), -1, 1))
        k2 = np.arccos(np.clip((zp ** 2 + 1 - p ** 2) / (2 * zp), -1, 1))
        k3 = np.sqrt(np.clip((4 * zp ** 2 - (1 + zp ** 2 - p ** 2) ** 2) / 4, 0, None))
        lambda_e = (p ** 2 * k1 + k2 - k3) / np.pi
        flux[partial] = 1 - lambda_e
    return flux


def transit_flux_at_phase(offset_days, period_days, a_rs, b, p):
    x = a_rs * np.sin(2 * np.pi * offset_days / period_days)
    z = np.sqrt(x ** 2 + b ** 2)
    return occult_uniform(z, p)


def fit_transit_geometry(time, flux, period_days, epoch_bjd, duration_hours):
    duration_days = duration_hours / 24
    phase = (time - epoch_bjd) / period_days
    offset_days = (phase - np.round(phase)) * period_days
    mask = np.abs(offset_days) < duration_days * 2
    off = offset_days[mask]
    fl = flux[mask]

    if len(off) < 10:
        return {"b": 0, "p": 0, "V": 999.0, "converged": False}

    in_transit = np.abs(off) < duration_days / 2
    if in_transit.sum() > 0:
        min_flux = np.min(fl[in_transit])
    else:
        min_flux = 1.0
    depth_est = max(1 - min_flux, 1e-6)
    p_guess = np.clip(np.sqrt(depth_est), 0.005, 0.45)
    a_rs = max((period_days / np.pi) * (1 + p_guess) / max(duration_days, 1e-4), 2)

    def residuals(params):
        b, p = params
        b = np.clip(b, 0, 1.5)
        p = np.clip(p, 0.001, 0.5)
        model = transit_flux_at_phase(off, period_days, a_rs, b, p)
        return model - fl

    result = least_squares(residuals, x0=[0.3, p_guess],
                            bounds=([0.0, 0.001], [1.5, 0.5]), method="trf")
    b_fit = float(np.clip(result.x[0], 0, 1.5))
    p_fit = float(np.clip(result.x[1], 0.001, 0.5))
    return {"b": b_fit, "p": p_fit, "V": b_fit + p_fit, "converged": result.success}


# ---------------------------------------------------------------------------
# Los 6 criterios (misma logica que lib/vetting/criteria.ts, version corregida)
# ---------------------------------------------------------------------------
def evaluate_all(time, flux, flux_err, period_days, epoch_bjd, duration_hours):
    duration_days = duration_hours / 24
    phase = (time - epoch_bjd) / period_days
    offset = (phase - np.round(phase)) * period_days
    cycle = np.floor(phase)
    in_transit = np.abs(offset) < duration_days / 2

    crit = {}

    # --- odd_even (NUEVO: significancia con error propagado) ---
    odd_mask = in_transit & (cycle.astype(int) % 2 != 0)
    even_mask = in_transit & (cycle.astype(int) % 2 == 0)
    if odd_mask.sum() >= 3 and even_mask.sum() >= 3:
        odd_depth = np.mean(1 - flux[odd_mask])
        even_depth = np.mean(1 - flux[even_mask])
        odd_err = np.sqrt(np.sum(flux_err[odd_mask] ** 2)) / odd_mask.sum()
        even_err = np.sqrt(np.sum(flux_err[even_mask] ** 2)) / even_mask.sum()
        combined_err = np.sqrt(odd_err ** 2 + even_err ** 2)
        sig = abs(odd_depth - even_depth) / combined_err if combined_err > 0 else 0
    else:
        sig = 0
    crit["odd_even"] = {"value": float(sig), "passed": bool(sig < 3.0)}

    # --- shape (NUEVO: ajuste Mandel-Agol) ---
    fit = fit_transit_geometry(time, flux, period_days, epoch_bjd, duration_hours)
    crit["shape"] = {"value": fit["V"], "passed": bool(fit["converged"] and fit["V"] <= 1.05)}

    # --- secondary (sin cambios) ---
    secondary_epoch_offset = period_days / 2
    sec_offset = ((time - (epoch_bjd + secondary_epoch_offset)) / period_days)
    sec_offset = (sec_offset - np.round(sec_offset)) * period_days
    in_secondary = np.abs(sec_offset) < duration_days / 2
    baseline = (~in_transit) & (~in_secondary)
    if in_secondary.sum() >= 10 and baseline.sum() >= 10:
        base_med = np.median(flux[baseline])
        sec_med = np.median(flux[in_secondary])
        depth_ppm = (base_med - sec_med) * 1e6
        mad = lambda a: 1.4826 * np.median(np.abs(a - np.median(a)))
        base_err = mad(flux[baseline]) / np.sqrt(baseline.sum()) * 1e6
        sec_err = mad(flux[in_secondary]) / np.sqrt(in_secondary.sum()) * 1e6
        combined = np.sqrt(base_err ** 2 + sec_err ** 2)
        sig_sec = depth_ppm / combined if combined > 0 else 0
    else:
        sig_sec = 0
    crit["secondary"] = {"value": float(sig_sec), "passed": bool(sig_sec < 3.0),
                          "veto": bool(sig_sec > 6.0)}

    # --- noise (sin cambios) ---
    out = ~in_transit
    if out.sum() > 0:
        observed_std = np.std(flux[out])
        mean_err = np.mean(flux_err[out])
        noise_ratio = observed_std / mean_err if mean_err > 0 else 999
    else:
        noise_ratio = 999
    crit["noise"] = {"value": float(noise_ratio), "passed": bool(noise_ratio < 3.0)}

    # --- flare (sin cambios) ---
    med = np.median(flux)
    mad_flux = 1.4826 * np.median(np.abs(flux - med))
    flare_thresh = med + 4 * mad_flux
    flare_ratio = np.sum(flux > flare_thresh) / len(flux)
    crit["flare"] = {"value": float(flare_ratio), "passed": bool(flare_ratio < 0.02)}

    # --- sufficiency (sin cambios) ---
    time_span = time.max() - time.min()
    n_transits = int(time_span / period_days)
    pts_per_transit = in_transit.sum() / max(n_transits, 1)
    suff_score = (min(n_transits / 4, 1) + min(pts_per_transit / 15, 1)) / 2
    crit["sufficiency"] = {"value": float(suff_score),
                            "passed": bool(n_transits >= 4 and pts_per_transit >= 15)}

    return crit


def confidence_with_weights(crit, weights):
    total_w = sum(weights.values())
    score = sum(weights[k] for k in weights if crit[k]["passed"])
    return score / total_w if total_w > 0 else 0


def main():
    with open(MANIFEST_PATH, encoding="utf-8") as f:
        manifest = json.load(f)

    print(f"Cargando {len(manifest)} candidatos del manifiesto...")

    records = []
    for i, entry in enumerate(manifest):
        disp = entry.get("disposition", "")
        if disp.startswith("CONFIRMED"):
            label = "CONFIRMED"
        elif disp.startswith("FALSE POSITIVE"):
            label = "FALSE POSITIVE"
        else:
            continue  # candidatos ambiguos no se usan para calibracion supervisada

        csv_path = os.path.join(CASE_STUDIES_DIR, entry["csvFile"])
        if not os.path.exists(csv_path):
            print(f"  [{i+1}/{len(manifest)}] {entry['name']}: archivo no encontrado, omitido")
            continue

        data = np.genfromtxt(csv_path, delimiter=",", names=True)
        quality_ok = data["quality"] == 0
        time = data["time"][quality_ok]
        flux = data["flux"][quality_ok]
        flux_err = data["flux_err"][quality_ok]

        if len(time) < 50:
            continue

        try:
            crit = evaluate_all(time, flux, flux_err,
                                 entry["periodDays"], entry["epochBjd"], entry["durationHours"])
            records.append({"name": entry["name"], "label": label, "crit": crit})
            print(f"  [{i+1}/{len(manifest)}] {entry['name']} ({label}): "
                  f"shape={crit['shape']['value']:.3f} odd_even={crit['odd_even']['value']:.2f}")
        except Exception as e:
            print(f"  [{i+1}/{len(manifest)}] {entry['name']}: ERROR {e}")

    print(f"\nProcesados exitosamente: {len(records)} candidatos")
    confirmed = [r for r in records if r["label"] == "CONFIRMED"]
    false_pos = [r for r in records if r["label"] == "FALSE POSITIVE"]
    print(f"CONFIRMED: {len(confirmed)}, FALSE POSITIVE: {len(false_pos)}")

    # --- Poder discriminativo por criterio (gap de tasa de aprobacion) ---
    print("\n=== PODER DISCRIMINATIVO POR CRITERIO (nueva logica) ===")
    print(f"{'criterio':<15} {'tasa aprob. CONFIRMED':>22} {'tasa aprob. FALSE POS':>22} {'gap':>8}")
    for k in ["secondary", "sufficiency", "noise", "flare", "odd_even", "shape"]:
        rate_c = np.mean([r["crit"][k]["passed"] for r in confirmed]) if confirmed else 0
        rate_f = np.mean([r["crit"][k]["passed"] for r in false_pos]) if false_pos else 0
        gap = rate_c - rate_f
        print(f"{k:<15} {rate_c:>21.1%} {rate_f:>21.1%} {gap:>+7.1%}")

    # --- Busqueda de la mejor division del presupuesto de peso (0.15) ---
    # entre shape y odd_even, manteniendo secondary=0.25, sufficiency=0.25,
    # noise=0.20, flare=0.15 fijos (ya validados en la Fase 2.5).
    print("\n=== BUSQUEDA DE PESOS: division de 0.15 entre shape y odd_even ===")
    print(f"{'shape_w':>8} {'odd_even_w':>11} {'recall':>8} {'precision':>10} {'accuracy':>9}")
    best = None
    for shape_w in np.arange(0.0, 0.151, 0.025):
        odd_even_w = round(0.15 - shape_w, 3)
        weights = {"secondary": 0.25, "sufficiency": 0.25, "noise": 0.20,
                   "flare": 0.15, "odd_even": odd_even_w, "shape": shape_w}

        tp = fn = fp = tn = 0
        for r in records:
            conf = confidence_with_weights(r["crit"], weights)
            veto = r["crit"]["secondary"]["veto"]
            is_fp_predicted = veto or conf < 0.6
            actual_fp = r["label"] == "FALSE POSITIVE"
            if actual_fp and is_fp_predicted:
                tp += 1
            elif actual_fp and not is_fp_predicted:
                fn += 1
            elif not actual_fp and is_fp_predicted:
                fp += 1
            else:
                tn += 1

        recall = tp / (tp + fn) if (tp + fn) > 0 else 0
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0
        accuracy = (tp + tn) / len(records) if records else 0
        print(f"{shape_w:>8.3f} {odd_even_w:>11.3f} {recall:>7.1%} {precision:>9.1%} {accuracy:>8.1%}")

        score = recall + precision  # criterio simple de seleccion, documentado
        if best is None or score > best[0]:
            best = (score, shape_w, odd_even_w, recall, precision, accuracy)

    print(f"\nMejor combinacion (recall+precision maximo): "
          f"shape={best[1]:.3f}, odd_even={best[2]:.3f} "
          f"(recall={best[3]:.1%}, precision={best[4]:.1%}, accuracy={best[5]:.1%})")

    with open("recalibration_v3_report.json", "w", encoding="utf-8") as f:
        json.dump({
            "n_processed": len(records),
            "n_confirmed": len(confirmed),
            "n_false_positive": len(false_pos),
            "best_shape_weight": best[1],
            "best_odd_even_weight": best[2],
            "best_recall": best[3],
            "best_precision": best[4],
            "best_accuracy": best[5],
        }, f, indent=2)
    print("\nReporte guardado en recalibration_v3_report.json")


if __name__ == "__main__":
    main()
