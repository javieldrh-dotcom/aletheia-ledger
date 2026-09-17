Aletheia Ledger starts from a simple question: how can anyone be asked to trust an automated scientific verdict if they can't see why that conclusion was reached?

This is an independent project — not built by an astrophysicist, but by a Certified Public Accountant applying the same evidentiary standards used in financial auditing to a completely different field.

The project applies a principle drawn directly from professional financial auditing — every decision must be explainable, verifiable, and leave an immutable evidence trail — to real scientific data. Its first module, already built and validated, analyzes planetary transit light curves (real data from NASA's Kepler mission) to determine whether an exoplanet candidate is likely real or a false positive, showing the full reasoning behind each verdict instead of a black-box score.

The project's core architecture — the explainable-criteria engine, the cryptographic audit chain, and the abstention mechanism for insufficient evidence — was designed to be domain-agnostic. Exoplanets are the current use case, not a permanent limitation: the same auditing philosophy applies to any field where automated conclusions need to be verified against real evidence.

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

- **Published finding**: Ramírez Hernández, J. (2026), "An Explainable, Auditable Vetting Framework Reveals Transit-Shape Ambiguity in the Eccentric Giant Planet KOI-1257 b," *Research Notes of the AAS* (manuscript AAS80906).
- **Formal statistical calibration (v0.2.0, current)**: evaluated against 252 real candidates from the Kepler catalog (127 confirmed, 125 official false positives), downloaded live from MAST/NASA Exoplanet Archive. Result: 53.6% recall and 80.7% precision on false-positive detection — a deliberate trade-off favoring recall, reported alongside the per-criterion discriminative-power analysis that drove it, including the current limitations of two of the six criteria.
- Full documentation of the calibration process, findings, and limitations in `aletheia-ledger-whitepaper.md`.

## Companion book series

This project's methodology, findings, and reasoning are documented in an accessible 10-book collection, *Aletheia Ledger*, written for readers with no background in astrophysics. Book 1 — *Exoplanets: A Journey Into the Method That Reveals Distant Worlds* — is out now on Kindle:

- English: https://www.amazon.com/dp/B0HJZXN64Z
- Español: https://www.amazon.com/dp/B0HK14R9PD

New books in the collection are published roughly every four weeks.

## Running it locally

```
npm install
npm run dev
```

Open http://localhost:3000 in your browser.

Calibration and batch-analysis features require a Python virtual environment with `lightkurve`, `astroquery`, `numpy`, and `pandas` — see scripts in `scripts/`.

## Project structure

- `app/` — Next.js App Router, including API routes for photometry discovery and download (`/api/mast-discover`, `/api/fetch-photometry`).
- `components/` — React components for the exoplanet module's Dashboard.
- `lib/` — vetting engine logic, audit chain, Savitzky-Golay filter, NASA Exoplanet Archive client.
- `hooks/` — React hooks for the analysis workflow.
- `scripts/` — Python scripts for statistical calibration and test data generation.
- `test-data/` — synthetic test cases and calibration results (JSON, CSV).

## License and authorship

Licensed under **AGPL-3.0**. Independent research project developed by Javiel De Jesús Ramírez Hernández (ORCID: 0009-0005-9007-6029), Certified Public Accountant and independent researcher in astronomical citizen science.

Contributions, bug reports, and suggestions for future modules are welcome via Issues.
