# Registro de Procedencia de Datos — KOI-1257 b (RNAAS AAS80906)

Este documento es una innovación aplicada a la citación estándar de datos científicos: en vez de solo referenciar el DOI oficial de la misión (como exige MAST/IPAC), se vincula explícitamente ese DOI con el hash criptográfico de los datos específicos que se analizaron — creando una cadena de custodia verificable, desde la fuente oficial hasta el resultado publicado.

---

## 1. Fuente oficial citada (nivel de misión)

| Campo | Valor |
|---|---|
| Misión | Kepler |
| Repositorio | MAST (Mikulski Archive for Space Telescopes), STScI |
| DOI oficial de la misión | `10.17909/T9059R` |
| URL de resolución | https://doi.org/10.17909/T9059R |
| Fecha de verificación de este DOI | 6 de septiembre de 2026 |

Este es el DOI estándar y permanente que MAST asigna a la colección completa de datos de la misión Kepler — el mismo que otros papers publicados citan para este tipo de datos de curvas de luz (ej. "Breakthrough Listen Search for Intelligent Life... Kepler Lightcurves", arXiv:2312.07903).

## 2. Objetivo específico analizado (nivel de observación)

| Campo | Valor |
|---|---|
| Nombre KOI | KOI-1257 |
| Identificador KIC | Asociado a kepoi_name KOI-1257.01 |
| Trimestres descargados | 18 (Q0–Q17, misión completa) |
| Herramienta de descarga | `lightkurve` v2.6.0, vía `search_lightcurve()` + `download_all()` |
| Fecha de descarga original | 4 de septiembre de 2026 |

## 3. Hash de integridad del archivo realmente analizado

| Campo | Valor |
|---|---|
| Archivo | `koi-1257-validated.csv` |
| Algoritmo | SHA-256 |
| Hash | `0ab279987251af320727d08b1dfde4fabae07e8915ce9feea91cbe230b8ebb9f` |
| Tamaño | 8,049,901 bytes (128,417 filas × 4 columnas: time, flux, flux_err, quality) |
| Preprocesamiento aplicado | Aplanado por trimestre individual (Savitzky-Golay, ventana 401 cadencias) antes de unir — método validado en la Fase 2 del proyecto Aletheia Space |

## 4. La cadena de verificación completa

Cualquier persona puede verificar independientemente esta cadena de custodia siguiendo estos 3 pasos:

1. **Verificar la fuente oficial**: resolver `https://doi.org/10.17909/T9059R` y confirmar que apunta a la misión Kepler en MAST.
2. **Reproducir la descarga**: usar el mismo código público (`scripts/download_koi1257.py` en el repositorio de Aletheia Space) para descargar KOI-1257 vía `lightkurve` desde esa misma fuente.
3. **Verificar el hash**: calcular el SHA-256 del CSV resultante y confirmar que coincide con `0ab279987251af320727d08b1dfde4fabae07e8915ce9feea91cbe230b8ebb9f` — si coincide, se confirma matemáticamente que los datos usados en el paper AAS80906 son exactamente reproducibles a partir de la fuente oficial citada, sin alteración.

## 5. Por qué esto es una innovación, no solo un trámite

La citación estándar de DOI (lo que MAST/IPAC exigen) responde "¿de qué misión vienen los datos?" — pero no responde "¿puedo verificar que estos datos específicos, con este preprocesamiento específico, no fueron alterados?". Este registro cierra esa brecha aplicando el mismo principio de auditoría financiera usado en el resto del proyecto Aletheia Space (cadena de hashes, trazabilidad de procedencia) a la propia citación bibliográfica de datos — algo no encontrado en la revisión de literatura de vetting de exoplanetas realizada durante este proyecto (ExoMiner, Lightkurve, DAVE, LATTE no publican este tipo de vínculo explícito DOI-hash).

---

*Generado como material complementario a: Ramírez Hernández, J. 2026, RNAAS, submission AAS80906.*
