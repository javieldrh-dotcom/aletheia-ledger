import json

with open("public/case-studies/manifest.json") as f:
    manifest = json.load(f)

manifest.insert(0, {
    "id": "koi-4878",
    "name": "KOI-4878",
    "kepid": 11804437,
    "csvFile": "koi4878-low-snr-limit.csv",
    "disposition": "CANDIDATE (low reliability, 50.5%)",
    "periodDays": 449.04479,
    "epochBjd": 527.956995,
    "durationHours": 12.5,
    "pointCount": 87229,
    "note": "Caso limite de baja SNR -- el motor converge con la incertidumbre oficial de NASA"
})

manifest.insert(1, {
    "id": "koi-1257",
    "name": "KOI-1257 b",
    "kepid": 5473556,
    "csvFile": "koi1257-eccentric-planet.csv",
    "disposition": "CONFIRMED",
    "periodDays": 86.647661,
    "epochBjd": 2455006.79341,
    "durationHours": 4.25,
    "pointCount": 128417,
    "note": "Alta excentricidad orbital produce forma de transito ambigua -- resuelto con busqueda de eclipse secundario (ver publicacion RNAAS AAS80906)"
})

with open("public/case-studies/manifest.json", "w") as f:
    json.dump(manifest, f, indent=2)

print("Manifiesto actualizado con 8 casos totales.")