# Aletheia Ledger

**An explainable scientific auditing platform — transparent, cryptographically-traceable verification, currently applied to exoplanet candidate vetting.**

> Formerly known as "Aletheia Space" — renamed in September 2026 out of respect for a pre-existing science communication platform with that name. Old links (`aletheia-space`) redirect here automatically.

---

## What is this?

Aletheia Ledger starts from a simple question: **how can anyone be asked to trust an automated scientific verdict if they can't see why that conclusion was reached?**

The project applies a principle drawn directly from professional financial auditing — every decision must be explainable, verifiable, and leave an immutable evidence trail — to real scientific data. Its **first module, already built and validated**, analyzes planetary transit light curves (real data from NASA's Kepler mission) to determine whether an exoplanet candidate is likely real or a false positive, showing the full reasoning behind each verdict instead of a black-box score.

**The project's core architecture — the explainable-criteria engine, the cryptographic audit chain, and the abstention mechanism for insufficient evidence — was designed to be domain-agnostic.** Exoplanets are the current use case, not a permanent limitation: the same auditing philosophy applies to any field where automated conclusions need to be verified against real evidence.

## Current module: exoplanet vetting

- **Six-criterion vetting engine**: odd-even depth symmetry, transit shape (V vs. U), residual noise dispersion, periodic flare signature, sample sufficiency, and secondary-eclipse search (with a veto mechanism).
- **"Inconclusive" category**: the engine can abstain from a binary verdict when evidence is insufficient, instead of forcing a conclusion.
- **Continuous audit**: flags already-confirmed candidates that show internal warning signs, inviting a second human review without automatically reclassifying them.
- **Real photometry, no installation required**: discovers and downloads real Kepler FITS files directly via the MAST API, flattens the light curve with a pure-TypeScript Savitzky-Golay filter (validated at r=0.992 against the reference Python pipeline) — entirely in the browser.
- **Reproducible synthetic benchmark suite**, with known-ground-truth scenarios (clean planet, eclipsing binary, flare contamination).

## The part that isn't about exoplanets

These components are domain-agnostic by design, and are the natural candidates for reuse in future modules:

- **Cryptographic provenance chain**: every analysis produces a verifiable SHA-256 hash chain, from raw data to final verdict, plus optional ECDSA digital signing. Nothing about this mechanism is astronomy-specific.
- **The abstention-under-insufficient-evidence principle**: a general decision rule (never force a binary verdict without adequate evidence) applicable to any automated classification system.
- **The continuous-audit principle**: periodically revisiting already-"confirmed" conclusions with independent methods, instead of treating them as permanently settled.

## Vision: beyond exoplanets

No second module has been built yet — stated here honestly, not as a promised timeline. But the project's declared intent is to explore, in the future, applying this same explainable-auditing architecture to other fields where transparent verification of automated conclusions has real value. Suggestions and collaboration on possible future domains are welcome via Issues.

## Real scientific results (exoplanet module)

- **Published finding**: Ramírez Hernández, J. (2026), *"An Explainable, Auditable Vetting Framework Reveals Transit-Shape Ambiguity in the Eccentric Giant Planet KOI-1257 b"*, Research Notes of the AAS (manuscript AAS80906).
- **Formal statistical calibration**: evaluated against 128 real candidates from the Kepler catalog (three independent rounds, stratified random sampling). Combined result: 89% accuracy on confirmed planets, 75% precision and 33% recall on false-positive detection — reported with full honesty, including its current limitations.
- Full documentation of the calibration process, findings, and limitations in [`aletheia-ledger-whitepaper.md`](./aletheia-ledger-whitepaper.md).

## Running it locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

Calibration and batch-analysis features require a Python virtual environment with `lightkurve`, `astroquery`, `numpy`, and `pandas` — see scripts in `scripts/`.

## Project structure

- `app/` — Next.js App Router, including API routes for photometry discovery and download (`/api/mast-discover`, `/api/fetch-photometry`).
- `components/` — React components for the exoplanet module's Dashboard.
- `lib/` — vetting engine logic, audit chain, Savitzky-Golay filter, NASA Exoplanet Archive client.
- `hooks/` — React hooks for the analysis workflow.
- `scripts/` — Python scripts for statistical calibration and test data generation.
- `test-data/` — synthetic test cases and calibration results (JSON, CSV).

## License and authorship

Independent research project developed by **Javiel De Jesús Ramírez Hernández** ([ORCID: 0009-0005-9007-6029](https://orcid.org/0009-0005-9007-6029)), Certified Public Accountant and independent researcher in astronomical citizen science.

Contributions, bug reports, and suggestions for future modules are welcome via Issues.
