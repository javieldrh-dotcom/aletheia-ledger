# Aletheia Ledger: An Explainable, Auditable Framework for Exoplanet Transit Vetting

**Author:** Javiel De Jesús Ramírez Hernández
**Affiliation:** Certified Public Accountant / Independent Researcher
**ORCID:** 0009-0005-9007-6029
**Repository:** https://github.com/javieldrh-dotcom/aletheia-ledger

---

## Abstract

We present Aletheia Ledger, an open-source, browser-based framework for vetting transiting exoplanet candidates against common false-positive scenarios (eclipsing binaries, stellar flare contamination, instrumental artifacts). Unlike black-box machine-learning classifiers, Aletheia Ledger decomposes each vetting decision into six individually reported, weighted statistical criteria, bound to a cryptographic provenance chain for full reproducibility. We validate the framework against a stratified random sample of 30 real Kepler objects of interest (15 confirmed planets, 15 official false positives), reporting a full confusion matrix rather than curated case studies alone. We find the framework performs well at confirming true planets (13/15 correct) but, even with a secondary-eclipse veto mechanism already active, shows limited discriminative power against real false positives overall (recall 21.4%; 3/14 correct) — a result we report and analyze rather than obscure. We document, with equal rigor, a published finding of methodological interest (transit-shape ambiguity in the eccentric planet KOI-1257 b, Ramírez Hernández 2026, RNAAS), and a fully validated client-side pipeline for retrieving and analyzing real Kepler photometry without any local Python installation — including three real bugs discovered and corrected via cross-validation against a known false positive. We argue that the framework's primary contribution today is explainability and auditability, not yet raw classification accuracy, and we outline a concrete path toward the latter. **Section 4.4 reports a follow-up recalibration (September 15, 2026) against an expanded sample of 252 real candidates, which independently reconfirms this work's root-cause finding at nearly nine times the sample size, and documents a deployed corrective action that raises recall to 53.6% at a stated cost to precision.**

---

## 1. Introduction

Automated vetting of transiting exoplanet candidates is dominated by two approaches: large-scale machine-learning classifiers trained on thousands of labeled Threshold Crossing Events (e.g., ExoMiner, AstroNet; Ansdell et al. 2018, Valizadegan et al. 2022), and rule-based statistical heuristics used both by professional pipelines (the Kepler Robovetter; Thompson et al. 2018) and by citizen-science tools. ML classifiers achieve high aggregate accuracy but rarely expose *why* a candidate was flagged, limiting their value for education and citizen science. Heuristic tests are transparent but carry known ambiguities not always made explicit to end users — a gap this work addresses directly, both in its findings and in its own honest self-assessment.

Aletheia Ledger was built with three explicit design goals, borrowed deliberately from financial-audit practice given the author's professional background as a Certified Public Accountant: (1) every automated decision must be individually explainable, not just a final score; (2) every analysis must carry a verifiable chain of custody from raw data to verdict; (3) claims of performance must be validated against real, randomly sampled data — not cherry-picked examples.

## 2. Related Work and Conceptual Attribution

The cryptographic provenance-chain mechanism used throughout this work (Section 3.3) is not a novel contribution to computer science: it is an application of the established *data provenance* field, with prior implementations including Open Science Chain (NSF-funded), SciChain (Al-Mamun et al. 2021, ICDE), and ProvChain, already applied in genomics and climate science. To our knowledge, this specific technique had not previously been applied to exoplanet transit vetting; that narrow application, not the underlying cryptographic method, is the contribution claimed here.

## 3. System Architecture and Methods

### 3.1 Client-side vetting engine

All statistical computation runs client-side in the user's browser (TypeScript, strictly typed), keeping server costs at zero and requiring no installation. Six criteria are evaluated per candidate:

1. **Odd-even transit-depth symmetry** — compares mean transit depth across odd- and even-numbered cycles; large asymmetry is classically associated with eclipsing binaries.
2. **Transit shape** — fraction of in-transit points near minimum flux, distinguishing flat-bottomed (U-shaped, planet-like) from V-shaped (grazing/binary-like) transits.
3. **Out-of-transit residual noise dispersion** — robust (MAD-based) noise ratio relative to reported photometric uncertainty.
4. **Periodic flare contamination** — detects stellar flares synchronized with the candidate period.
5. **Sample sufficiency** — number of complete transits observed and in-transit point density; as of v0.2.0 (Section 4.4), scored directly rather than only modulating the weight of other criteria.
6. **Secondary-eclipse search** — searches for a dimming event at orbital phase 0.5, a signature specific to stellar companions rather than planets, following the precedent of KOI 4.01's disposition (flagged as a false positive precisely via secondary-eclipse detection).

### 3.2 Evidence-weighted decision and veto mechanism

*(Original weighting scheme, superseded by Section 4.4 as of v0.2.0; retained here as the historical baseline against which the follow-up recalibration is measured.)* Criteria were combined via a weighted average (weights: 0.25/0.15/0.20/0.20/—/0.20 for criteria 1–4 and 6 respectively; criterion 5 modulated weights rather than voting directly). A candidate is flagged false-positive if the weighted confidence falls below 60%, **or** if the secondary-eclipse criterion fails with significance exceeding twice its nominal threshold (>6σ against a 3σ threshold) — an explicit veto mechanism, added after calibration testing showed that highly specific evidence (an unambiguous secondary eclipse) could otherwise be diluted by less specific, easily-passed criteria (Section 4.2). The veto mechanism and the 60% confidence threshold are unchanged in v0.2.0.

### 3.3 Cryptographic provenance chain and digital signature

Each analysis produces a chained SHA-256 hash across three pipeline stages (raw ingestion → quality filtering → verdict), such that tampering with any intermediate stage invalidates all downstream hashes — analogous to a financial ledger's requirement that each entry reference the prior balance. Users may additionally sign the final verdict with an ECDSA P-256 key pair generated entirely client-side via the Web Crypto API, providing non-repudiation without any server-side key custody. Reports are exportable as JSON (the verifiable source of truth) or PDF (a human-readable presentation layer).

### 3.4 Client-side photometry retrieval (no local Python required)

A secondary contribution, validated in this work, is a fully browser/server-side (Next.js API routes) pipeline for retrieving and processing real Kepler photometry without Python or `astropy`/`lightkurve`:

1. **Discovery**: MAST's underlying REST "Mashup" API (`mast.stsci.edu/api/v0/invoke`) is queried directly — the same service `astroquery` uses internally — via a two-step call (`Mast.Caom.Filtered` to resolve a KIC to an observation ID, then `Mast.Caom.Products` to list individual quarterly FITS files with download URLs). No filename timestamps are guessed.
2. **Parsing**: FITS binary tables are parsed with `jsfitsio`, a pure TypeScript/JavaScript FITS reader, extracting `TIME`, `PDCSAP_FLUX`, `PDCSAP_FLUX_ERR`, and `SAP_QUALITY` columns.
3. **Detrending**: a Savitzky–Golay filter was implemented natively in TypeScript (least-squares convolution coefficients for a local quadratic fit, equivalent to `scipy.signal.savgol_filter`'s default behavior, with mirror boundary extension), applied per-quarter before stitching — replicating the per-quarter flattening method validated in Section 4.1's KOI-4878 case study.

This filter was validated quantitatively against the Python reference pipeline: on 64,798 real photometric points from KIC 5816811 (17 quarters), the JavaScript-flattened flux correlated with the Python (`lightkurve.flatten()`) output at r = 0.9920, with a mean difference of −0.000001 and a standard deviation of the difference of 67 ppm.

To our knowledge, no existing exoplanet vetting tool (Lightkurve, DAVE, LATTE, Planet Hunters TESS) offers this full "search → retrieve real photometry → explainable vetting" pipeline without local installation.

## 4. Validation

### 4.1 Case studies (illustrative, not the primary validation)

Two real, individually investigated cases are documented in full in the project repository and, for KOI-1257 b, in a peer-reviewed-adjacent publication (Ramírez Hernández 2026, RNAAS):

- **KOI-1257 b** (confirmed giant planet, e = 0.772; Santerne et al. 2014): the odd-even and transit-shape criteria both failed, consistent with a near-grazing transit geometry produced by high eccentricity — a false-positive-like signature for a genuine planet. The secondary-eclipse criterion correctly found no significant secondary (−1.41σ), and the combined framework correctly classified the candidate as viable (60% confidence).
- **KOI-4878** (unconfirmed, low-SNR candidate; 50.5% official reliability per the Robovetter for similar low-SNR long-period candidates): independent period refinement recovered the published period to within 0.03 days with 8.43σ significance on the transit depth, corroborating the candidate's periodicity independently. The vetting engine itself returned 45–65% confidence across iterations — a genuine "too close to call" result, converging with the catalog's own stated uncertainty rather than contradicting it.

These cases illustrate the framework's explainability but are not, by themselves, evidence of general classification performance — a distinction we consider essential to state explicitly, and the reason Section 4.2 exists.

### 4.2 Formal statistical calibration

A stratified random sample of 30 KOI cumulative-table entries (seed = 42; 15 `CONFIRMED`, 15 `FALSE POSITIVE`) was drawn, their real Kepler photometry downloaded and processed via the validated per-quarter flattening method, and evaluated against the six-criterion engine (Python re-implementation of the TypeScript logic, for batch processing). One target failed due to a corrupted MAST download and was excluded (29/30 analyzed).

**Confusion matrix (original engine, prior to the corrective actions below):**

| | Predicted: False Positive | Predicted: Viable |
|---|---|---|
| **Actual: False Positive** (n=14) | 3 | 11 |
| **Actual: Confirmed** (n=15) | 2 | 13 |

Precision (false-positive detection): 60.0%. Recall: 21.4%. Overall accuracy: 55.2%.

**Root-cause analysis:** the sample-sufficiency mechanism (Section 3.1, criterion 5), intended to reduce confidence in resolution-dependent criteria under sparse data, instead redistributed their weight toward noise/flare criteria — which pass almost universally — producing the opposite of its intended effect: the engine became *more* permissive, not more cautious, when data were sparse.

**Two corrective strategies were tested (simulated post-hoc on the same 29 cases, not re-fetched):**
1. A hard confidence cap when sufficiency is low and any specific criterion fails: recall improved to 85.7%, but precision fell to 57.1% (9 confirmed planets misclassified) — trading one bias for its opposite.
2. A surgical redistribution (reducing only noise/flare weight, never odd-even/shape): recall remained at 21.4% — confirming the issue was not the redistribution mechanism itself.

**A deeper finding:** plotting raw odd-even and transit-shape values by class revealed substantial overlap between confirmed and false-positive candidates in this real sample — several genuine false positives showed transit-shape values as "clean" as confirmed planets. This is not a miscalibrated threshold; it is evidence that, as currently measured, these two criteria individually carry limited discriminative power on real, unselected data.

**Decision, stated for transparency:** no further threshold/weight adjustment was made against this 29-case sample, to avoid overfitting a small validation set. We report the negative result as-is.

### 4.3 A second, independent validation event

During integration of the client-side photometry pipeline (Section 3.4), a real KOI (K01042.02 / KIC 5816811, official false positive) was evaluated end-to-end without Python. The initial verdict was incorrect ("viable," 88.6–89.2% across iterations). Root-cause investigation, cross-validated quantitatively against the Python reference pipeline at each step, identified and corrected three distinct real bugs:

1. An inconsistency between the TypeScript engine's quality-flag filtering and the already-validated Python pipeline (which filters only NaNs, not quality flags).
2. An inverted BJD/BKJD epoch conversion for confirmed planets retrieved from the NASA Exoplanet Archive's `pscomppars` table.
3. An unnecessary and erroneous epoch offset applied to KOI candidates from the `cumulative` table — `koi_time0bk` is already defined by the archive as BJD − 2454833 (i.e., already in the internal BKJD convention used throughout this project); the code redundantly added the offset, introducing a ~2.45-million-day phase misalignment. This bug likely affected every KOI lookup performed via this tool's live NASA-catalog search since its creation.

After all three corrections, the same candidate correctly returned "probable false positive" (73.7% confidence), with the secondary-eclipse criterion detecting the true signal at 19.53σ — well above the veto threshold, and qualitatively consistent with the Fase 2.5 batch result for the same object.

We report this not merely as a bug-fix log, but as a second, independent confirmation that cross-validating against known ground truth — rather than trusting a pipeline that merely runs without errors — continues to surface real, otherwise-silent correctness issues, at every new layer of the system.

### 4.4 Follow-up recalibration at scale (September 15, 2026)

Following the recommendation of Section 6 ("expand the calibration sample beyond n≈30"), the case-study gallery was expanded from 31 to 252 real Kepler candidates with known official disposition (127 `CONFIRMED`, 125 `FALSE POSITIVE`), downloaded via `lightkurve` against live NASA Exoplanet Archive and MAST queries (`scripts/expand_case_studies.py`), with orbital parameters resolved directly from the archive rather than a static local sample file. All 252 candidates and their raw photometry are retained in the repository (`public/case-studies/`) for full reproducibility.

**Independent reconfirmation of Section 4.2's finding, at ~9× the sample size.** Per-criterion discriminative power was measured as the gap in pass rate between `CONFIRMED` and `FALSE POSITIVE` candidates (`scripts/measure_recall_impact.py`):

| Criterion | Gap (percentage points) | Assessment |
|---|---|---|
| Secondary eclipse | +37.7pp | Strong |
| Sample sufficiency | +30.4pp | Strong |
| Residual noise | +24.9pp | Moderate |
| Periodic flare | +3.2pp | Weak |
| Odd-even symmetry | +2.5pp | Weak |
| Transit shape | −2.4pp | No measurable discriminative power |

This corroborates Section 4.2's "deeper finding" almost exactly: transit shape and odd-even symmetry, as currently implemented, carry little to no discriminative power on real, unselected data — not a small-sample artifact, as hypothesized in Section 5's limitations.

**Root cause identified via comparison to the official method.** Neither Section 4.2 nor the present follow-up had previously compared this framework's heuristics against the published methodology of the Kepler Robovetter itself (Thompson et al. 2018; Bryson et al. 2020). That comparison, conducted as part of this follow-up, found a specific and previously unidentified reason for the weak performance of both criteria:

- The Robovetter's *odd-even* test is a **significance test**: the difference between odd- and even-transit depths divided by the *uncertainty of a fitted transit model*, not a raw fractional difference between crude point medians. An approximation using MAD-based dispersion of raw in-transit points (rather than a fitted model's formal uncertainty) was implemented and tested against the same n=252 sample; it did not materially improve the gap (+2.5pp, up from the original implementation's comparable weakness), because raw-point uncertainty without a model fit remains too large to resolve most real differences.
- The Robovetter's *transit-shape* test computes V = b + R_p/R_star from an actual fitted transit model (Mandel & Agol 2002), flagging V > 1.05 as grazing/binary-like — not a heuristic count of points near the flux minimum, as implemented here.

**Conclusion:** both criteria require a genuine transit-model fit (impact parameter and radius ratio via least-squares or MCMC fitting to a Mandel & Agol 2002 light-curve model) to function as intended by the literature they were originally adapted from. This is scoped as a discrete future engineering task (Section 6), not resolved in this follow-up.

**Deployed corrective action (v0.2.0).** Rather than either corrective strategy tested in Section 4.2, a third approach was implemented and measured: fixed criterion weights informed directly by the n=252 discriminative-power table above (secondary 0.25, sufficiency 0.25, noise 0.20, flare 0.15, odd-even 0.10, shape 0.05), replacing the dynamic sufficiency-driven redistribution described in Section 3.2. Critically, sample sufficiency — previously excluded from scoring entirely and used only to reweight other criteria — is now itself a scored criterion, directly addressing the Section 4.2 root cause (a criterion measuring reliability was influencing the score indirectly rather than being scored on its own considerable discriminative merit).

**Result, measured against the same n=252 sample, with the 60% confidence threshold and secondary-eclipse veto unchanged:**

| Version | Weighting scheme | Recall | Precision |
|---|---|---|---|
| v0.1.x (immediately preceding, same n=252 sample) | Dynamic redistribution; sufficiency unscored | ~45–47% | ~86–88% |
| v0.2.0 (deployed) | Fixed weights; sufficiency scored | 53.6% | 80.7% |

The change is reported as a **deliberate trade-off, not an unqualified improvement**: recall rose by 8.9 percentage points at a cost of 6.5 percentage points of precision. This was accepted specifically because it is consistent with the framework's own continuous-audit design principle (Section 3): a `CONFIRMED` candidate newly flagged for review is queued for human re-examination, not automatically reclassified, whereas a real false positive silently passing as "viable" has no such safeguard. In an audit-philosophy system, the asymmetry in these two error costs is not symmetric, and the weighting was chosen accordingly.

**A note on the achievable ceiling.** Even the Robovetter itself does not achieve clean separation between true and false transit signals on real data: *"there is not a clean separation between data with true transits and data with no true transits, which makes a choice of threshold difficult"* (Bryson et al. 2020). This framework's stated goal remains competitive, honestly-reported performance — not an unrealistic zero-error target.

## 5. Discussion and Limitations

**What the framework demonstrates well:** per-criterion explainability that enabled, in practice, real-time collaborative debugging of the engine itself (Sections 4.2–4.4); a verifiable, tamper-evident audit trail; and a validated, Python-free pipeline for real photometry retrieval.

**What it does not yet demonstrate:** competitive raw classification accuracy against real, unselected Kepler data, even after the Section 4.4 recalibration. The transit-shape and odd-even criteria, in isolation, remain confirmed (at 9× the original sample size) to show weak-to-no discriminative power as currently implemented — a genuine transit-model fit, not further threshold or weight tuning, is now understood to be the actual path to improving them. The secondary-eclipse veto substantially improves precision on the subset of false positives it can detect, but many false-positive mechanisms (e.g., background eclipsing binaries, subtle instrumental systematics) may not manifest as a detectable secondary eclipse.

**Known specific limitations:**
- The secondary-eclipse search assumes an approximately circular orbit when locating the phase-0.5 search window; for high-eccentricity systems the true secondary phase shifts with eccentricity and argument of periastron (relevant to, though not invalidating, the KOI-1257 b case, where no secondary was expected regardless).
- The client-side photometry pipeline's flattening, while validated at r=0.992 against Python, has not been stress-tested across a large, diverse sample, nor evaluated under real serverless deployment time constraints (validated only in local development).
- The Section 4.4 sample (n=252) remains modest relative to the full Kepler cumulative catalog (~9,000+ KOIs); conclusions about discriminative power, while now measured at nearly 9× the original scale, should still be treated as provisional pending further expansion (Section 6).

## 6. Future Work

- Implement a genuine transit-model fit (Mandel & Agol 2002: impact parameter, radius ratio) to correctly reimplement the transit-shape and odd-even-significance tests, following the Section 4.4 root-cause finding — the highest-priority remaining item.
- Continue expanding the calibration sample beyond n=252 to further reduce small-sample risk, using the now-reproducible `scripts/expand_case_studies.py` pipeline.
- Recompute the full confusion matrix (true/false positives/negatives) directly in the next calibration run, to replace the derived overall-accuracy estimate currently reported alongside Section 4.4's recall/precision figures.
- Explore formal calibration methods (e.g., logistic regression over extracted features) once sample size permits, replacing hand-set thresholds.
- Validate the client-side photometry pipeline under real serverless deployment constraints.
- Extend the synthetic benchmark suite (three ground-truth scenarios released alongside this work) with scenarios modeling the specific failure modes identified here (grazing/eccentric transits, low point-density secondary-eclipse windows).

## Data and Code Availability

All source code, the synthetic benchmark suite, calibration scripts, and this document are available at https://github.com/javieldrh-dotcom/aletheia-ledger. Kepler photometry was retrieved from the public MAST archive (DOI: 10.17909/T9059R) via `lightkurve` (Section 4) and via the native client-side pipeline described in Section 3.4. Orbital parameters were retrieved from the NASA Exoplanet Archive, hosted at IPAC/Caltech (DOI: 10.26133/NEA13).

## References

Al-Mamun, A., Yan, F., & Zhao, D. 2021, in 2021 IEEE 37th International Conference on Data Engineering (ICDE), SciChain: Blockchain-enabled Lightweight and Efficient Data Provenance for Reproducible Scientific Computing

Ansdell, M., Ioannou, Y., Osborn, H. P., et al. 2018, ApJL, 869, L7

Bryson, S., Coughlin, J., Batalha, N. M., et al. 2020, AJ, 159, 279 (arXiv:2006.15719)

Lightkurve Collaboration et al. 2018, Lightkurve: Kepler and TESS time series analysis in Python, Astrophysics Source Code Library, record ascl:1812.013

Mandel, K., & Agol, E. 2002, ApJL, 580, L171

Ramírez Hernández, J. 2026, RNAAS, submission AAS80906

Santerne, A., Hébrard, G., Deleuil, M., et al. 2014, A&A, 571, A37

Thompson, S. E., Coughlin, J. L., Hoffman, K., et al. 2018, ApJS, 235, 38

Valizadegan, H., Martinho, M. J. S., Wilkens, L. S., et al. 2022, ApJ, 926, 120

---

**[NOTES FOR JAVIEL — remove before any external distribution]**
- This is a first complete draft covering everything documented in the project roadmap through 2026-09-07, updated 2026-09-15 with Section 4.4 (follow-up recalibration at n=252) and corresponding edits to the Abstract, Sections 3.1–3.2, and 5–6. Review each factual claim against your own records before wider circulation.
- The brand rename from "Aletheia Space" to "Aletheia Ledger" has been applied throughout this document and the repository URL, consistent with the rest of the project as of September 2026.
- Consider whether to post this as a preprint (arXiv astro-ph.EP) — note arXiv requires an "endorsement" for first-time submitters in a category, which can be a real barrier without an existing academic contact; the RNAAS note and Planet Hunters TESS forum engagement (Fase 2.6) are more accessible near-term paths to build the track record that eventually eases this.
- Section 4.2's honest negative result — now independently reconfirmed at scale in Section 4.4 — is, by design, the most scientifically valuable part of this document — resist any temptation to soften it before sharing with anyone in the field.
- The overall-accuracy figure in Section 4.4 is derived from recall/precision/tp/fn, not an independently recomputed confusion matrix; Section 6 already lists recomputing this directly as a next step — do this before citing an accuracy percentage externally.
