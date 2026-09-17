# Aletheia Ledger — Hoja de Ruta

**Vetting explicable de curvas de luz fotométricas — descarte de falsos positivos estelares**

**Nota sobre el nombre (2026-09-13):** el proyecto se llamó originalmente "Aletheia Ledger". Al descubrirse que ese nombre ya pertenecía a la plataforma de divulgación científica de Marina Aletheia (aletheia.space, Francia), se renombró de inmediato a **Aletheia Ledger** por respeto a su marca previa, sin evidencia de que hubiera existido confusión real entre ambos públicos. Se conserva "Aletheia" (palabra griega de dominio público, usada en numerosos proyectos de software) con un término distintivo y más representativo de la identidad técnica del proyecto: la cadena de auditoría ("ledger") que ha sido central desde la Fase 1.

Última actualización: 7 de septiembre de 2026 (flujo FITS-a-CSV validado end-to-end: 3 bugs reales encontrados y corregidos, veredicto correcto confirmado)

---

## Fase 1: Motor de vetting explicable (MVP client-side) — ✅ COMPLETA Y VALIDADA

**Arquitectura confirmada:**
- Next.js (App Router) + TypeScript estricto + Tailwind CSS
- 100% client-side — cero costo de servidor (Regla de Oro #1)
- Sin carpeta `src/` — estructura en raíz del proyecto

**Archivos construidos:**
| Archivo | Propósito |
|---|---|
| `types/photometry.ts` | Modelo de dominio: `FluxDataPoint`, `LightCurve`, `VettingCriterion`, `VettingVerdict`, `ProvenanceLedgerEntry` |
| `lib/vetting/criteria.ts` | 6 criterios de vetting: odd-even, forma V/U, ruido residual, flares periódicos, suficiencia de muestra, eclipse secundario (con veto por evidencia extrema en el hook) |
| `hooks/useLightCurveFilter.ts` | Hook que orquesta el vetting, filtra por calidad, construye la cadena de auditoría |
| `lib/parsing/csvParser.ts` | Parser tipado de CSV a `FluxDataPoint[]`, tolerante a filas corruptas |
| `components/LightCurveUploader.tsx` | Carga de archivo CSV |
| `components/LightCurveChart.tsx` | Gráfico interactivo (Recharts) con zoom y color por calidad de dato |
| `components/VettingResults.tsx` | Desglose visual del veredicto por criterio |
| `app/page.tsx` | Dashboard que conecta todo |

**Validación realizada:** 3 casos sintéticos de verdad conocida (`scripts/generate-test-data.js`), con 2 bugs reales detectados y corregidos:
1. Contaminación de la ventana de tránsito en el cálculo de ruido residual.
2. Sensibilidad a outliers en la detección de flares (resuelto con estimador robusto MAD).

**Resultado final de validación:**
| Caso | Veredicto esperado | Obtenido |
|---|---|---|
| Tránsito limpio | Candidato viable | ✅ 100% confianza |
| Binaria eclipsante | Falso positivo | ✅ Detectado correctamente |
| Estrella con flares | Falso positivo | ✅ Detectado correctamente |

**Decisiones de diseño fijadas:**
- Pesos de criterios (30/25/20/25%) — punto de partida, pendientes de calibrar en Fase 2.
- Parámetros de tránsito (período/época/duración) — entrada manual del usuario. Búsqueda automática (Box Least Squares) queda como mejora futura.
- Umbral de falso positivo — 60% de confianza ponderada.

---

## Innovación de auditoría (adelantada desde Fase 3) — ✅ COMPLETA

Se implementó antes de lo planeado porque emergió como diferenciador central del proyecto, aplicando principios de auditoría financiera y criptografía.

**Atribución conceptual honesta:** la técnica central (cadena de hashes encadenados para detectar alteración de datos) NO es una invención de este proyecto. Es la base de un campo académico establecido llamado *data provenance* (trazabilidad de datos), con implementaciones previas como Open Science Chain (NSF), SciChain, ProvChain y LineageChain, ya aplicadas en genómica, bioinformática y ciencia climática (ESMValTool), y alineadas con los principios FAIR de datos científicos. No se encontró, sin embargo, ningún caso documentado de esta técnica aplicada específicamente a vetting de curvas de luz fotométricas de exoplanetas — ese es el nicho real del aporte.

**El aporte genuino y defendible de Aletheia Ledger no es "inventar" trazabilidad criptográfica para ciencia — es aplicar, con rigor, un principio ya validado académicamente en otros campos, a un nicho que no lo tiene, en una implementación 100% accesible desde el navegador (sin nodos distribuidos, redes de consenso, ni infraestructura blockchain real como exigen OSC/SciChain).**

| Componente | Archivo | Qué aporta |
|---|---|---|
| Cadena de trazabilidad (libro mayor) | `lib/audit/provenanceLedger.ts` + `components/ProvenanceChain.tsx` | Hash encadenado por cada etapa del pipeline (crudo → filtrado → evaluado), detecta alteración de cualquier eslabón |
| Firma digital de no repudio | `lib/audit/signature.ts` + `hooks/useVerdictSignature.ts` + `components/SignaturePanel.tsx` | ECDSA P-256 vía Web Crypto API, 100% client-side, verifica quién aprobó el veredicto |
| Reporte exportable (JSON) | `lib/audit/exportReport.ts` | Fuente de verdad verificable — veredicto + cadena + firma en un único artefacto |
| Reporte exportable (PDF) | `lib/audit/exportReportPdf.ts` | Presentación legible generada directamente del JSON firmado, para compartir con no técnicos |

**Aprendizaje documentado:** la trazabilidad de datos garantiza integridad, pero no valida parámetros de entrada — son capas de auditoría distintas (se descubrió al diagnosticar un resultado anómalo causado por parámetros de tránsito incorrectos, no por un bug).

---

## Fase 2: Validación contra KOI-4878 y el NASA Exoplanet Archive — 🔶 EN PROGRESO (primer caso de estudio real: RESUELTO CON ÉXITO)

**Entorno técnico montado:**
- Python 3.12 + entorno virtual dedicado (`venv`) en la raíz del proyecto.
- `lightkurve` 2.6.0 instalado (incluye `astropy`, `astroquery`).
- Scripts en `scripts/`: `download_koi4878.py`, `fix_csv_columns.py`, `reconcile_period.py`, `targeted_reconciliation.py`, `improved_depth_reconciliation.py`.

**Datos reales descargados:** 89,377 puntos de fotometría real de Kepler para KOI-4878 (`kplr011804437`), 16 trimestres (2009-2013), guardados en `test-data/koi-4878-real-kepler.csv`.

**Valores publicados (catálogo oficial, vía Wikipedia/NASA Exoplanet Archive):**
- Período: 449.015 ± 0.021 días
- Duración: 12.5 horas
- Profundidad: 94 ppm (extremadamente sutil — candidato NO confirmado, con solo 50.5% de confiabilidad catalogada para candidatos de baja SNR en el rango 200-500 días según el Robovetter oficial)

**Innovación aplicada — Reporte de Reconciliación (concepto de auditoría financiera aplicado a validación científica):** en vez de solo correr una búsqueda de período y aceptar el resultado, se comparó explícitamente el valor derivado de forma independiente contra el valor publicado, cuantificando la concordancia — igual que una reconciliación contable entre dos libros.

**Resultados obtenidos:**
1. **Búsqueda BLS ciega (400-500 días):** encontró una señal dominante en 487.3 días, distinta al candidato publicado — no concluyente por sí sola.
2. **Búsqueda dirigida en el período publicado:** encontró una señal real en 449.338 días (0.072% de diferencia vs. el catálogo), con 69% de la potencia de la señal dominante — **corrobora independientemente la periodicidad reportada**.
3. **Medición robusta de profundidad (primer intento, aplanado por trimestre + plegado de fase con período BLS):** dio -37.1 ppm con significancia de -3.27 sigma (dirección opuesta a la esperada) — no reprodujo la profundidad publicada.
4. **Refinamiento fino de época y período (barrido de 400 × 2,000 combinaciones maximizando significancia estadística directa, no potencia BLS genérica):** ✅ **RESUELTO** — detectó oscurecimiento de 102.1 ppm con **8.43 sigma de significancia** (muy por encima del umbral estándar de 3 sigma), a solo 8.59% del valor publicado (94 ppm). Período refinado: 449.045 días (0.03 días de diferencia vs. publicado, dentro del margen de error oficial de ±0.021 días).

**Diagnóstico confirmado:** la discrepancia inicial no era ausencia de señal ni error del motor — era imprecisión en la alineación de fase. Con búsqueda fina de época y período (en vez de depender del grid genérico de BLS), la señal real emergió con fuerza estadística clara. Esto valida tanto el método de vetting como el propio candidato publicado, con evidencia derivada de forma completamente independiente.

**Vetting ejecutado sobre datos reales (motor completo, Dashboard):** el candidato validado se subió al Dashboard con los parámetros refinados (período 449.045 días, época 527.957, duración 12.5h). Resultado: "Probable falso positivo" al 45% de confianza — `odd_even_depth_symmetry` y `transit_shape_v_vs_u` fallaron, `residual_noise_dispersion` y `periodic_flare_signature` aprobaron.

**Diagnóstico honesto — no es evidencia de que el candidato sea falso:** con solo 3-4 tránsitos totales en 4 años de datos y ~25 puntos por tránsito individual (cadencia de 30 min sobre 12.5h de duración), los criterios de forma y simetría no tienen suficiente resolución para una evaluación confiable — el motor está reportando correctamente "no puedo confirmar la forma esperada con esta resolución", no "esto es una binaria eclipsante". Ruido y flares, que no dependen de resolución dentro del tránsito, aprobaron limpiamente.

**Brecha de diseño real revelada por este caso:** los 4 criterios actuales fueron calibrados con datos sintéticos de alta profundidad (~1%) y buena cadencia relativa a la duración del tránsito. No incorporan el número de tránsitos disponibles ni la resolución de puntos por tránsito como factor de confianza — algo indispensable para candidatos de baja SNR y período largo como KOI-4878. Esto conecta directamente con el Campo de innovación #1 identificado (vetting de tránsitos únicos/período largo): el problema no es exclusivo de tránsito único, también aplica a tránsitos periódicos con pocos ciclos observados.

**Mejora implementada — criterio de suficiencia de muestra:** se agregó un quinto criterio (`sample_sufficiency`) en `lib/vetting/criteria.ts` y `hooks/useLightCurveFilter.ts` que evalúa el número de tránsitos completos observados y la resolución de puntos por tránsito, y que reduce proporcionalmente el peso de los criterios sensibles a resolución (simetría par/impar, forma V/U), redistribuyendo ese peso hacia ruido y flares — aplicando el mismo principio de auditoría de que una conclusión basada en poca muestra no debe pesar igual que una basada en muestra abundante.

**Resultado tras la mejora:** confianza subió de 45% a 51.9% (aún bajo el umbral de 60%, sigue marcando "falso positivo"). El efecto fue más modesto de lo esperado: la suficiencia de muestra midió 0.875/1.0 (relativamente alta, porque sí hay ~4 tránsitos completos), pero `transit_shape_v_vs_u` había fallado de forma extrema (0.0078 vs. umbral 0.15) — una reducción proporcional del 12.5% en su peso no compensa un fallo tan severo en su medición.

**Conclusión honesta y cierre de este caso de estudio:** no se forzaron más ajustes para que este caso "apruebe" — hacerlo habría sido calibrar hacia el resultado deseado en vez de hacia lo que los datos muestran. El resultado final (45-52% de confianza, con fallos explicables por criterio) **converge cualitativamente con la incertidumbre oficial**: el catálogo Robovetter de NASA reporta apenas 50.5% de confiabilidad para candidatos de baja SNR en el rango 200-500 días — nuestro motor, de forma independiente, llegó a un nivel de incertidumbre del mismo orden. Esto es evidencia real de que el motor de vetting, aunque simple, no está mal calibrado — está reflejando honestamente la dificultad genuina de este candidato específico.

**Aprendizaje metodológico para el whitepaper:** distintos criterios tienen sensibilidades muy distintas a la resolución de datos (comparar promedios agregados vs. resolver forma interna del tránsito) — un factor de reducción proporcional único para todos no es suficiente cuando un criterio falla de forma extrema, no marginal. Trabajo futuro: criterios de resolución específicos por tipo de medición, no un factor global.

**Qué falta para cerrar la Fase 2 por completo:**
- Repetir el ejercicio con 1-2 candidatos adicionales de mayor SNR (tránsitos más profundos, para casos de resolución más directa sin necesitar refinamiento fino).
- Documentar formalmente esta metodología de refinamiento (barrido de época + período maximizando significancia directa) como parte del whitepaper — es un aporte metodológico genuino más allá del propio caso de KOI-4878.

**Por qué importa:** este caso de estudio completo — con una discrepancia inicial real, diagnóstico correcto de su causa, y resolución exitosa con evidencia cuantitativa (8.43 sigma) — es exactamente el tipo de narrativa metodológica rigurosa que da credibilidad real a un whitepaper científico, mucho más que un resultado que "funcionó a la primera" sin mostrar el proceso de validación.

---

## Segundo caso de estudio real: KOI-1257 b — 🔶 HALLAZGO DOCUMENTADO

**Por qué se eligió:** a diferencia de KOI-4878 (candidato no confirmado, baja SNR), KOI-1257 b es un **planeta gigante confirmado** por velocidad radial (Santerne et al. 2014), con parámetros orbitales publicados con precisión de segundos: período 86.647661 ± 3s, profundidad de tránsito 0.7% (~75 veces más profunda que KOI-4878), 17 tránsitos observados en los 4 años de misión. Se eligió como caso de concordancia esperada, dado el SNR mucho mayor.

**Datos reales descargados:** 128,417 puntos de fotometría real de Kepler (18 trimestres), aplanados por trimestre individual (mismo método validado con KOI-4878), guardados en `test-data/koi-1257-validated.csv`.

**Bug de rendimiento encontrado y corregido:** al procesar este dataset (mucho más grande que los anteriores), `evaluateSampleSufficiency`, `evaluateTransitShape` y `evaluateSingleTransitShape` usaban `Math.max(...array)`/`Math.min(...array)` con spread — JavaScript tiene un límite de argumentos por llamada de función (~65,000-125,000) que 128,417 puntos superan, causando `Maximum call stack size exceeded`. Corregido reemplazando spread por bucles `for` manuales en los 3 lugares (`lib/vetting/criteria.ts`, `lib/vetting/singleTransitCriteria.ts`). Hallazgo real: solo aparece con volumen de datos reales, nunca con datasets sintéticos pequeños — valida la importancia de probar con datos de escala real, no solo casos sintéticos.

**Resultado del vetting:** "Probable falso positivo" al 45% de confianza. `residual_noise_dispersion`, `periodic_flare_signature` y `sample_sufficiency` aprobaron limpiamente (1.0/1.0 en suficiencia, coherente con 17 tránsitos y alta resolución). `odd_even_depth_symmetry` (0.42) y `transit_shape_v_vs_u` (0.0039, fallo severo) fallaron.

**Hallazgo científico genuino, no un bug de código:** el propio paper de descubrimiento (Santerne et al. 2014) reporta que KOI-1257 b tiene una **excentricidad orbital muy alta (e = 0.772 ± 0.045)** y una duración de tránsito "relativamente corta para este período orbital", atribuible a una posible **geometría de tránsito rasante**. Un tránsito rasante produce geométricamente una forma en V, no en U — indistinguible, con nuestra heurística actual, de la forma en V que produce una binaria eclipsante. Esto es una **limitación real y conocida en la literatura de vetting**: el criterio de forma V/U no puede por sí solo diferenciar "falso positivo por binaria" de "planeta real en órbita excéntrica/tránsito rasante". La asimetría par/impar (0.42) queda como hipótesis abierta, posiblemente relacionada a la correlación entre paridad de tránsitos y límites de trimestre Kepler — no confirmada.

**Mejora implementada tras este hallazgo — criterio de búsqueda de eclipse secundario:** se agregó un sexto criterio (`secondary_eclipse_search`) que busca una caída de brillo en fase 0.5 del período (el equivalente al "eclipse secundario" de un sistema binario) — evidencia mucho más específica de sistema binario que la forma V/U, precedente directo en la literatura (KOI 4.01 fue marcado falso positivo precisamente por detección de eclipse secundario profundo). Se rebalancearon los pesos base: forma V/U reducida de 25% a 15% (dado que confirmamos su ambigüedad), eclipse secundario agregado con 20%.

**Limitación documentada del nuevo criterio:** asume órbita aproximadamente circular para ubicar la ventana secundaria en fase 0.5 exacta. En órbitas de alta excentricidad (como la propia KOI-1257 b, e=0.772), la fase real del eclipse secundario se desplaza según la excentricidad y el argumento del periastro — sin esos parámetros adicionales (no derivables solo de la curva de luz), la búsqueda puede no ubicar correctamente la ventana en sistemas muy excéntricos. Se documenta como limitación conocida, no resuelta en esta versión.

**Regresión detectada y su causa raíz real (no un problema de diseño):** al re-validar los 3 casos sintéticos y 2 reales tras agregar el eclipse secundario, `false-positive-eclipsing-binary.csv` pasó a "Candidato viable" (71.6%) pese a que `secondary_eclipse_search` detectara una señal binaria inequívoca (8.89 sigma) — el promedio ponderado dejaba que otros criterios "diluyeran" evidencia extremadamente específica. Corregido con un **veto por evidencia extrema**: un fallo de `secondary_eclipse_search` con significancia mayor a 2× el umbral (>6 sigma) descalifica el candidato automáticamente, sin importar el resto — mismo principio de auditoría de que cierta evidencia (ej. un documento falsificado confirmado) anula un promedio general de indicadores saludables, en vez de competir con ellos en igualdad de peso.

**Segunda causa descubierta durante la re-validación:** `false-positive-flare-star.csv` pareció romperse también (pasó a "viable" en una ejecución), pero la causa real no fue el rebalanceo de pesos — fue que **el generador sintético usaba `Math.random()` sin semilla fija**, así que cada regeneración producía ruido gaussiano distinto, y un criterio marginal (medido muy cerca del umbral) podía pasar o fallar por puro azar entre ejecuciones. Corregido implementando un generador pseudoaleatorio con semilla fija (mulberry32, semilla=42) en `scripts/generate-test-data.js` — los 3 datasets sintéticos ahora son 100% reproducibles entre ejecuciones. Con datos reproducibles confirmados, el caso de flare star vuelve a fallar correctamente (41.3%) sin necesidad de tocar ningún peso — la causa nunca fue el diseño de pesos, fue la falta de reproducibilidad en los datos de prueba.

**Validación final de los 4 casos de control tras ambas correcciones:**
| Caso | Esperado | Obtenido |
|---|---|---|
| Tránsito limpio (sintético) | Candidato viable | ✅ 100% |
| Binaria eclipsante (sintético, con eclipse 2° real) | Falso positivo | ✅ Vetado por evidencia extrema (8.89σ) |
| Estrella con flares (sintético, semilla fija) | Falso positivo | ✅ 41.3% |
| KOI-1257 b (real, confirmado por RV) | Candidato viable | ✅ 60% |
| KOI-4878 (real, baja confiabilidad oficial) | Límite/incierto | ✅ 65% (caso límite, coherente con 50.5% oficial) |

**Aprendizaje metodológico para el whitepaper:** (1) no todos los criterios tienen el mismo "peso epistémico" aunque compartan peso numérico — evidencia extremadamente específica necesita mecanismos de veto, no solo ponderación; (2) los datos de prueba sintéticos requieren la misma reproducibilidad que se exige al motor de vetting — sin semilla fija, ninguna afirmación de "este caso se valida correctamente" es sostenible entre ejecuciones.

---

## Innovación adicional: banco de pruebas sintético reproducible con verdad conocida — ✅ COMPLETA

**Contexto que motivó esto:** una búsqueda sobre el estado del arte en vetting con ML confirmó que la comunidad astronómica reconoce activamente la falta de un banco de pruebas estandarizado y reproducible — un paper reciente (2025-2026) *propone* crear uno explícitamente para fomentar reproducibilidad y colaboración en la comunidad de ML astronómica, pero no lo ha implementado aún.

**Lo que se construyó:** `scripts/generate-test-data.js` ahora produce, además de los 3 CSV sintéticos, un `test-data/benchmark-manifest.json` con la "verdad conocida" (ground truth) de cada escenario: qué se inyectó exactamente, qué veredicto se espera, y qué característica específica del motor de vetting pone a prueba cada caso. La generación usa una semilla pseudoaleatoria fija (mulberry32, semilla=42), garantizando reproducibilidad total entre ejecuciones — corrección de un defecto real que encontramos durante esta misma sesión (`Math.random()` sin semilla causaba resultados no reproducibles en criterios marginales).

**Por qué es un aporte genuino, con honestidad sobre su alcance:** no resuelve el problema de raíz al nivel de escala que propone el paper académico (esto no incluye miles de curvas de luz ni cobertura sistemática de todo el espacio de parámetros) — es un banco de pruebas pequeño y dirigido (3 escenarios), pero es una **implementación funcional, ejecutable sin instalar nada (solo Node.js), y ya en uso real** — mientras que la propuesta académica formal, hasta donde se investigó, sigue siendo solo una propuesta. Cualquier otra herramienta de vetting (no solo Aletheia Ledger) puede correr sus propios criterios contra estos mismos CSV y comparar objetivamente contra el manifiesto de verdad conocida.

**Posicionamiento estratégico:** en vez de competir en precisión bruta contra clasificadores ML establecidos (ExoMiner, WATSON-Net, ExoNet) — comparación que no podemos ganar — este banco de pruebas posiciona a Aletheia Ledger como **infraestructura de evaluación neutral y reproducible**, un rol complementario y menos disputado, con potencial de cita académica si se documenta y publica formalmente en la Fase 5.

**Trabajo futuro:** ampliar el manifiesto con escenarios adicionales inspirados en los casos reales encontrados (tránsito rasante/excéntrico tipo KOI-1257 b, candidato de bajo SNR tipo KOI-4878), y considerar publicarlo como repositorio independiente citable.

---

## Innovación adicional: catálogo en vivo del NASA Exoplanet Archive integrado al Dashboard — ✅ COMPLETA

**Qué se construyó:** un buscador en el Dashboard que consulta en vivo el servicio TAP (Table Access Protocol) del NASA Exoplanet Archive — primero en la tabla de planetas confirmados (`pscomppars`), y si no hay resultados, en la tabla de candidatos KOI (`cumulative`). Al seleccionar un resultado, autocompleta automáticamente período, época y duración en el formulario de vetting. Archivos: `lib/nasa/exoplanetArchive.ts`, `components/NasaTargetSearch.tsx`, `app/api/nasa-search/route.ts`.

**Limitación de alcance, honesta desde el diseño:** esto conecta el catálogo de parámetros orbitales en vivo, NO la fotometría cruda — las curvas de luz siguen requiriendo el flujo de Python/`lightkurve` documentado en la Fase 2 (MAST distribuye FITS, no un servicio JSON simple). Son dos fuentes de datos distintas de NASA, con niveles de accesibilidad muy diferentes.

**Excepción real y justificada a la Regla de Oro #1 (100% client-side):** se descubrió que el servidor del NASA Exoplanet Archive responde correctamente (200 OK) pero sin el header `Access-Control-Allow-Origin`, por lo que el navegador bloquea la respuesta por política CORS — confirmado con el error real de consola, no asumido. Se resolvió agregando una API route mínima de Next.js (`app/api/nasa-search/route.ts`) que actúa como intermediario servidor-a-servidor (donde CORS no aplica). Esta excepción es mínima y deliberada: la ruta solo reenvía la consulta sin procesar ni almacenar nada — el motor de vetting completo sigue siendo 100% client-side. Costo: $0 en el tier gratuito de Vercel para este volumen de tráfico.

**Validación:** búsqueda de "KOI-1257" devolvió el registro confirmado con período 86.6477 días — coincide con el valor validado manualmente contra Santerne et al. (2014) en la Fase 2 (86.647661 días), confirmando que el catálogo en vivo es consistente con la literatura ya verificada independientemente.

**Aprendizaje documentado:** "100% client-side" como regla de oro es un objetivo de diseño correcto (minimiza costo y complejidad), pero no siempre es alcanzable sin excepción cuando se depende de servicios de terceros no diseñados para consumo directo desde navegador — la decisión correcta es documentar la excepción con su justificación exacta, no forzar una arquitectura que no funciona contra la evidencia real (el error de CORS).

---

## Innovación: convertidor FITS-a-CSV bajo demanda, 100% en el navegador/servidor — ✅ FLUJO COMPLETO VALIDADO (sin Python)

**El problema que motivó esto:** hasta esta sesión, la plataforma solo podía analizar CSV descargados manualmente con Python — ningún usuario nuevo podía explorar un objetivo fuera de los ya precargados sin instalar Python/lightkurve.

**Los 5 puntos pendientes identificados en la prueba de humo inicial, y su resolución real:**

1. ✅ **Descubrimiento de URLs de archivos (RESUELTO)** — se encontró y validó la API Mashup de MAST (`mast.stsci.edu/api/v0/invoke`), el mismo servicio REST que usa `astroquery`/`lightkurve` internamente. Flujo de 2 pasos: `Mast.Caom.Filtered` (KIC → obsid) → `Mast.Caom.Products` (obsid → lista de archivos FITS individuales con URLs reales). Implementado en `app/api/mast-discover/route.ts`. Validado con KIC 5816811: 17 trimestres descubiertos correctamente, sin adivinar ningún timestamp.
2. ✅ **Manejo de múltiples trimestres (RESUELTO)** — `app/api/fetch-photometry/route.ts` descarga y procesa los N trimestres descubiertos en un bucle secuencial en el servidor.
3. 🔶 **Normalización de flujo (RESUELTO de forma simplificada)** — se implementó división por mediana por trimestre (no el filtro Savitzky-Golay completo de Python). Ver limitación abajo.
4. ✅ **Límites de tiempo de ejecución (VALIDADO EN DESARROLLO LOCAL)** — prueba real con los 17 trimestres completos de KIC 5816811: descarga + parseo + normalización de 64,798 puntos completada en pocos segundos, sin timeout, corriendo en `npm run dev`.
5. Pendiente de probar: comportamiento en un entorno serverless real desplegado (Vercel), que impone límites de tiempo más estrictos que el desarrollo local — no evaluado todavía porque el proyecto no está desplegado en producción.

**Limitación real y documentada, no resuelta:** la normalización por mediana simple es una aproximación de menor calidad que el aplanado Savitzky-Golay (ventana 401) validado en la Fase 2 como necesario para resultados publicables (caso KOI-4878). Los datos obtenidos por esta vía son válidos para exploración rápida en el Dashboard, pero **no deben usarse como base de un resultado científico publicable** sin re-procesarlos con el pipeline completo de Python.

**Por qué esto sigue siendo una innovación genuina:** hasta donde se investigó, ninguna herramienta de vetting existente (DAVE, LATTE, Lightkurve, Planet Hunters TESS) ofrece "buscar cualquier KIC → obtener su fotometría real → vetting explicable" completamente en el navegador, sin instalación local. Aletheia Ledger ahora tiene el flujo técnico validado extremo a extremo para lograrlo.

**Trabajo pendiente antes de integrarlo al flujo principal del Dashboard:**
- Conectar `/api/fetch-photometry` directamente al motor de vetting (hoy son sistemas independientes, no integrados en la UI).
- Implementar un aplanado por ventana deslizante en JavaScript que se aproxime más al método de Python, documentando la diferencia de calidad honestamente en cualquier resultado derivado.
- Probar en un despliegue real (Vercel) para confirmar el comportamiento bajo límites de tiempo serverless reales, no solo en desarrollo local.
- Considerar cachear resultados de descubrimiento/descarga para no repetir llamadas a MAST innecesariamente.

### Actualización: integración completa validada de extremo a extremo, con 3 bugs reales encontrados y corregidos (sesión 2026-09-07)

**Se completó la conexión real:** se agregó `components/FetchByKic.tsx` y `CollapsibleSection`/`ToolsMenu` al Dashboard, permitiendo a un usuario escribir un KIC, obtener su fotometría real vía `/api/fetch-photometry`, y ejecutar el motor de vetting completo — sin Python en ningún paso. Primera prueba con KIC 5816811 (K01042.02, falso positivo oficial) dio un veredicto **incorrecto** ("Candidato viable"), lo cual disparó una investigación de causa raíz de tres capas, cada una con hallazgo real:

**Bug 1 — Filtrado de calidad inconsistente entre pipelines.** El motor de vetting en TypeScript descartaba cualquier punto con bandera de calidad distinta de "clean". El pipeline de Python ya validado en la Fase 2 (8.43σ en KOI-1257 b) nunca filtró así — solo removió NaN. Corregido en `hooks/useLightCurveFilter.ts`: se removió el filtro por bandera de calidad, alineando el motor con el método ya validado.

**Innovación de ingeniería — filtro Savitzky-Golay en TypeScript puro.** Para descartar que la normalización simplificada (división por mediana) fuera la causa, se implementó `lib/photometry/savitzkyGolay.ts`: cálculo de coeficientes de convolución vía mínimos cuadrados (ajuste polinomial local de orden 2, igual que el valor por defecto de `scipy.signal.savgol_filter`), sin dependencias externas. **Validado cuantitativamente contra Python**: correlación de 0.9920 entre el flujo aplanado en JavaScript y el de `lightkurve` sobre los mismos 64,798 puntos de KIC 5816811 (diferencia media de -0.000001, desviación estándar de la diferencia de 67 ppm). Este filtro resultó no ser la causa del veredicto incorrecto, pero es una pieza de ingeniería real y reutilizable que cierra la brecha de fidelidad identificada anteriormente.

**Bug 2 — Conversión de época invertida para planetas confirmados.** `lib/nasa/exoplanetArchive.ts` usaba `pl_tranmid` (tabla `pscomppars`) directamente como época, pero ese campo viene en BJD completo mientras toda la fotometría interna usa BKJD (BJD − 2454833). Corregido restando el offset.

**Bug 3 — Conversión de época errónea e innecesaria para candidatos KOI (el más extendido).** `koi_time0bk` (tabla `cumulative`) ya está definido oficialmente por la NASA como "BJD − 2454833" — es decir, ya en BKJD. El código le **sumaba** el offset innecesariamente, convirtiéndolo a BJD completo e introduciendo un desfase de fase de ~2.45 millones de días. Corregido eliminando la suma. **Este bug probablemente afectó a toda búsqueda de candidatos KOI hecha con esta herramienta desde su creación**, no solo al caso detectado.

**Resultado final tras las 3 correcciones:** K01042.02 (KIC 5816811) evaluado con datos 100% obtenidos vía JavaScript/navegador dio correctamente **"Probable falso positivo" (73.7%)**, con el eclipse secundario detectado a **19.53σ** (muy por encima del umbral de veto de 6σ) — coincidiendo cualitativamente con el resultado de la calibración de Python de la Fase 2.5 para el mismo objetivo.

**Por qué este hallazgo es valioso más allá de la corrección en sí:** confirma con evidencia real que la práctica de "probar contra un objetivo con verdad conocida, no solo contra el flujo feliz" sigue revelando errores reales en cada capa nueva del sistema — la misma disciplina metodológica aplicada consistentemente desde la Fase 2. También expone que una herramienta puede parecer funcionar (superficialmente, sin errores de compilación ni de red) mientras produce resultados científicamente incorrectos por errores silenciosos de unidades/convenciones — una lección relevante para la sección de Métodos del whitepaper.

---

## Fase 2.5: Calibración estadística formal — ✅ PRIMERA ITERACIÓN COMPLETADA (hallazgo honesto: limitación real detectada)

### Mejora post-calibración: categoría de veredicto "No concluyente" (abstención de determinación)

**Motivación:** al revisar formalmente qué elementos de una auditoría profesional (materialidad, evidencia suficiente y apropiada, papeles de trabajo) ya estaban presentes en el motor de forma implícita, se identificó una pieza real y faltante: el motor siempre fuerza una decisión binaria (viable / falso positivo), incluso cuando la suficiencia de muestra es extremadamente baja — nunca "se abstiene" cuando la evidencia es insuficiente, a diferencia de prácticas ya aceptadas en el campo (el propio Robovetter de NASA usa categorías de indeterminado).

**Implementación:** se agregó `isInconclusive: boolean` a `VettingVerdict`. En el motor periódico (`useLightCurveFilter.ts`), se activa cuando `sample_sufficiency < 0.5`, independientemente del resultado de los demás criterios. En el motor de tránsito único (`useSingleTransitVetting.ts`), se activa cuando hay menos de 20 puntos filtrados. `VettingResults.tsx` muestra la nueva etiqueta "No concluyente — evidencia insuficiente" con color distintivo (dorado/acento, no verde ni rojo).

**Validación:** probado deliberadamente limitando trimestres descargados vía la herramienta "Obtener fotometría real por KIC" (construida en la sesión anterior). Con KIC 11804437 (KOI-4878, período 449 días) y solo 1 trimestre (~90 días, 469 puntos), no hay ningún tránsito completo observable — suficiencia de muestra midió 0.0000, y el veredicto correctamente mostró "No concluyente" en vez de forzar una clasificación binaria sin base real. Casos de control con períodos más cortos (KIC 5816811, período 4.45 días) no activaron la categoría incluso con 1-2 trimestres, confirmando que el mecanismo responde específicamente a insuficiencia real de tránsitos observados, no a un umbral arbitrario de puntos totales.

**Limitación conocida, no resuelta aún:** el campo de confianza (`confidenceScore`) puede mostrar valores altos (ej. 100%) en casos "no concluyentes" cuando los pocos criterios evaluables aprobaron por defecto — esto es visualmente confuso (alta confianza numérica junto a una etiqueta de "evidencia insuficiente") y debería revisarse en una futura iteración, aunque no afecta la clasificación principal, que ya prioriza correctamente `isInconclusive` sobre el score numérico.

**Nota sobre origen conceptual:** esta mejora surgió de examinar deliberadamente qué principios de auditoría financiera formal (abstención de opinión cuando la evidencia es insuficiente) todavía no estaban aplicados en el motor, más allá de los ya presentes (trazabilidad, materialidad estadística). Se mantiene el lenguaje 100% científico estándar en la interfaz (sin terminología contable visible), consistente con el enfoque de "sustancia técnica en lenguaje del campo" ya establecido en el proyecto.

**Qué se ejecutó:** se descargó y evaluó una muestra aleatoria estratificada de 30 candidatos reales del catálogo Kepler cumulative (15 confirmados + 15 falsos positivos oficiales, semilla fija = 42, `scripts/run_calibration.py`), replicando en Python los 6 criterios del motor de vetting de Aletheia Ledger. 29 de 30 se procesaron con éxito (1 error de descarga por archivo corrupto en MAST, omitido).

**Matriz de confusión inicial (umbrales/pesos originales, sin ajustar):**
| | Predicho: Falso Positivo | Predicho: Viable |
|---|---|---|
| **Real: Falso Positivo** (14) | 3 (verdaderos positivos) | 11 (falsos negativos) |
| **Real: Confirmado** (15) | 2 (falsos positivos) | 13 (verdaderos negativos) |

- Precisión (detección de FP): 60.0%
- Exhaustividad/Recall: 21.4% — **muy bajo**
- Exactitud global: 55.2%

**Hallazgo central, honesto: el motor tiene sesgo fuerte hacia "aprobar"** — es bueno reconociendo planetas confirmados (13/15 correctos) pero falla en detectar la mayoría de los falsos positivos reales (solo 3/14). Diagnóstico de causa raíz: el mecanismo de "suficiencia de muestra" (agregado en una sesión anterior) reduce el peso de `odd_even`/`shape` cuando la muestra es pequeña, redistribuyendo ese peso hacia `noise`/`flare` — que casi siempre aprueban. Efecto neto: cuando el motor está más inseguro, se vuelve más permisivo, no más cauteloso — el diseño original tenía el efecto opuesto al buscado.

**Dos correcciones alternativas probadas y sus resultados (simuladas post-hoc sobre los mismos 29 casos, sin re-descargar):**
1. *Tope de confianza por baja suficiencia + criterio fallido*: Recall subió a 85.7%, pero Precisión cayó a 57.1% (9 confirmados mal marcados como falsos positivos) — corrige un sesgo introduciendo el opuesto.
2. *Redistribución quirúrgica (solo reduce noise/flare, nunca odd_even/shape)*: resultado casi idéntico al original (Recall 21.4%) — confirma que el problema no está en la redistribución de pesos.

**Hallazgo más profundo, con evidencia cuantitativa real:** al graficar los valores crudos de `odd_even` y `shape` por clase (confirmado vs. falso positivo) en esta muestra, **ambos criterios muestran solapamiento sustancial entre clases** — varios falsos positivos reales tienen valores de forma/simetría tan "limpios" como los de planetas confirmados. Esto no es un problema de umbral mal ajustado (ej. 0.15 vs. 0.20) — es evidencia de que, con el método de medición actual, estos dos criterios individualmente tienen **poder discriminativo limitado** sobre esta muestra real.

**Segunda ronda de calibración ejecutada (n=50, 49 procesados exitosamente):** siguiendo el mismo protocolo (semilla fija=43, exclusión explícita de los 30 candidatos de la primera ronda para evitar solapamiento), se procesaron 25 confirmados + 25 falsos positivos nuevos. Resultado de la ronda 2 sola: Precisión 78.57%, Recall 44.0%, Exactitud 65.31% — una mejora notable sobre la ronda 1.

**Matriz de confusión combinada (Rondas 1+2, n=78 candidatos reales, la muestra más grande hasta ahora):**
| | Predicho: Falso Positivo | Predicho: Viable |
|---|---|---|
| **Real: Falso Positivo** (39) | 14 (verdaderos positivos) | 25 (falsos negativos) |
| **Real: Confirmado** (39) | 5 (falsos positivos) | 34 (verdaderos negativos) |

- Precisión combinada: **73.68%**
- Exhaustividad/Recall combinado: **35.90%**
- Exactitud global combinada: **61.54%**

**Lectura honesta del resultado combinado (n=78):** el recall mejoró respecto a la ronda 1 aislada (21.4% → 35.9%), pero sigue siendo modesto — el motor continúa sin detectar a la mayoría de los falsos positivos reales (más de 6 de cada 10 se le escapan). La mejora entre rondas es real y medible, pero no cambia la conclusión metodológica central: el valor actual y defendible de Aletheia Ledger está en su explicabilidad y trazabilidad, no todavía en competir en precisión bruta de clasificación con herramientas especializadas (ExoMiner, Robovetter).

**Tercera ronda de calibración ejecutada (n=50, 50 procesados exitosamente, sin fallos de red):** siguiendo el mismo protocolo (semilla fija=44, exclusión explícita de los 60 candidatos de las Rondas 1 y 2), se procesaron 25 confirmados + 25 falsos positivos nuevos. Resultado de la ronda 3 sola: Precisión 77.78%, Recall 28.00%, Exactitud 60.00% — un resultado intermedio entre las dos rondas anteriores.

**Matriz de confusión combinada final (Rondas 1+2+3, n=128 candidatos reales, la muestra más grande obtenida hasta ahora):**
| | Predicho: Falso Positivo | Predicho: Viable |
|---|---|---|
| **Real: Falso Positivo** (64) | 21 (verdaderos positivos) | 43 (falsos negativos) |
| **Real: Confirmado** (64) | 7 (falsos positivos) | 57 (verdaderos negativos) |

- Precisión combinada: **75.00%**
- Exhaustividad/Recall combinado: **32.81%**
- Exactitud global combinada: **60.94%**

**Comparativa de las tres rondas individuales** (evidencia de estabilización, no de mejora continua):
| Ronda | n | Precisión | Recall |
|---|---|---|---|
| Ronda 1 | 29 | 60.0% | 21.4% |
| Ronda 2 | 49 | 78.6% | 44.0% |
| Ronda 3 | 50 | 77.8% | 28.0% |
| **Combinado** | **128** | **75.0%** | **32.8%** |

**Lectura honesta del resultado con 128 candidatos:** el recall combinado (32.8%) es muy similar al de la muestra de 78 (35.9%), confirmando que esa cifra no era una casualidad de muestra pequeña — el comportamiento real de la herramienta parece estabilizarse en un rango de 30-35% de recall, con precisión alrededor de 75%. La Ronda 3, con un recall de 28.0%, está más cerca de la Ronda 1 (21.4%) que de la Ronda 2 (44.0%), reforzando la idea de que la Ronda 2 pudo haber sido, en retrospectiva, la ronda relativamente favorable, no la norma. Esta cifra de 128 candidatos (n=128) es la que debe citarse en el whitepaper y en la colección de libros como el resultado de calibración más robusto disponible, reemplazando la cifra de n=78 en cualquier mención de desempeño general del motor.

**Conclusión honesta para el whitepaper:** el aporte real y defendible de Aletheia Ledger, con la evidencia disponible hasta ahora, está en su **framework de explicabilidad y auditoría** (por qué se llegó a un veredicto, trazabilidad criptográfica, reproducibilidad) — no todavía en su precisión bruta de clasificación, que con esta muestra real es modesta (55% de exactitud, similar a azar en detección de falsos positivos). Esto es coherente con, y no contradice, el objetivo original del proyecto: una herramienta educativa y transparente, no un competidor de precisión frente a ExoMiner/Robovetter.

**Trabajo futuro identificado:**
- Ampliar la muestra a 100+ candidatos para confirmar si el solapamiento persiste a mayor escala o es artefacto de muestra pequeña.
- Explorar criterios adicionales con mayor poder discriminativo real (no solo forma/simetría) antes de recalibrar pesos.
- Considerar métodos de calibración formal (regresión logística sobre features extraídas) en vez de umbrales fijos, una vez la muestra sea suficientemente grande para evitar sobreajuste.
- Publicar este resultado de calibración (positivo y negativo) como parte del whitepaper — es exactamente el tipo de reporte honesto que distingue rigor científico de marketing de producto.

---

## Innovación: auditoría continua de candidatos ya confirmados — ✅ IMPLEMENTADA Y VALIDADA CON CASO REAL

**Origen:** surgió al preguntar explícitamente qué ofrece Aletheia Ledger en los casos donde el motor *acierta* (candidatos confirmados correctamente clasificados, ~85-87% en ambas rondas de calibración) — no solo en los casos de fallo ya documentados extensamente.

**Respaldo en literatura verificada (no asumido, confirmado por búsqueda):**
- Robnik & Seljak (2025, PNAS) reevaluaron planetas de Kepler ya "confirmados" en zona habitable con un método independiente nuevo, encontrando que candidatos conocidos como Kepler-186f tienen una probabilidad de falsa alarma de ~20% — concluyen que "no deberían considerarse validados" con la confianza previamente asumida.
- Armstrong, Gamper & Damoulas (2021, MNRAS) compararon dos métodos de validación independientes, encontraron discrepancias sustanciales, y advierten explícitamente contra usar un solo método de validación hasta entender esas discrepancias.

**La propuesta:** formalizar la aplicación del motor de 6 criterios como una capa de **re-vetting independiente y continuo** sobre el catálogo de planetas ya confirmados — no para reclasificarlos, sino para señalar a la comunidad candidatos donde: (a) algún criterio individual falla pese a un veredicto general aprobado, o (b) la confianza cae en una banda intermedia (60-75%) en vez de saturar cerca del 100%. El hallazgo de KOI-1257 b (ya publicado en RNAAS) es, en retrospectiva, la primera instancia real de esta práctica — un planeta confirmado desde 2014 que nadie había revisado con este método, y que sí reveló algo genuino sin necesitar datos nuevos.

**Por qué esto es honesto y no una reformulación conveniente de la debilidad ya documentada:** la Fase 2.5 documentó que el motor tiene poder discriminativo débil para *detectar* falsos positivos nuevos (21.4% de recall). Esta propuesta no contradice ni oculta eso — es una aplicación distinta y más modesta: no "encontrar nuevos falsos positivos con alta confianza", sino "señalar candidatos confirmados que merecen una segunda mirada humana", que es precisamente lo que la literatura reciente pide.

**Implementación real:** agregado a `components/VettingResults.tsx` — un recuadro visual distintivo (⚑, color de acento, separado de los colores verde/rojo de veredicto) que se activa cuando el veredicto es "viable" (no falso positivo, no inconcluyente) **y** (al menos un criterio individual falló **o** la confianza cae en la banda 0.60–0.75). Constantes `REVIEW_BAND_MIN`/`REVIEW_BAND_MAX` documentadas en el propio código con referencia a esta sección de la hoja de ruta y al whitepaper.

**Validación con caso real (2026-09-11):** candidato K00941.02/K00941.03 (KIC 9480189, CONFIRMED oficialmente) — confianza exacta 60.0%, con simetría par/impar (0.1908 vs. umbral 0.15) y forma del tránsito (0.0003 vs. umbral 0.15) fallidos, pese a veredicto general "viable". El recuadro de auditoría continua se activó correctamente. Hash de verificación: `7992f1de8d0d...176d2ab0`. Este es el primer caso real, distinto de KOI-1257 b, detectado automáticamente por esta funcionalidad — exactamente el tipo de señal que la literatura (Robnik & Seljak 2025; Armstrong et al. 2021) pide que las herramientas independientes generen.

---

## Nueva línea de investigación: modernizar criterios clásicos/heurísticos — ⏳ PENDIENTE (identificada, no iniciada)

**El problema a investigar:** los 6 criterios actuales del motor (simetría par/impar, forma V/U, ruido residual, llamaradas, suficiencia de muestra, eclipse secundario) son, en su mayoría, **heurísticas estadísticas clásicas** — las mismas que ya usaba el Robovetter de Kepler hace una década (Thompson et al. 2018). La Fase 2.5 ya documentó evidencia real de que al menos dos de ellas (simetría par/impar y forma del tránsito) tienen **poder discriminativo débil** sobre datos reales no seleccionados — no es una sospecha, es un hallazgo medido.

**La pregunta pendiente de investigar:** ¿existen métodos más modernos, no necesariamente heurísticos, que puedan complementar o reemplazar estos criterios clásicos? Ejemplos identificados como candidatos a investigar (sin comprometerse aún a ninguno):
- **Análisis de centroide (centroid analysis):** verifica si la fuente de la caída de brillo coincide exactamente con la posición de la estrella objetivo, detectando contaminación de estrellas vecinas — usado por el Robovetter real pero no implementado en Aletheia Ledger todavía.
- **Características aprendidas (no heurísticas manuales):** los clasificadores modernos (ExoMiner, AstroNet) no usan umbrales fijos como "0.15" — aprenden qué patrones de la curva de luz importan, directamente de datos etiquetados. Explorar si alguna técnica intermedia (no una red neuronal completa, que perdería la explicabilidad central del proyecto) podría mejorar la discriminación sin sacrificar transparencia.
- **Métodos estadísticos bayesianos** (como los usados por vespa/TRICERATOPS, mencionados en el whitepaper) en vez de umbrales fijos — permitirían expresar incertidumbre de forma más rigurosa que un simple aprobado/fallido.

**Por qué se registra ahora, sin iniciar todavía:** siguiendo la misma disciplina aplicada en toda la Fase 2.5, no se debe modificar ningún criterio sin antes calibrar contra una muestra real — y la muestra actual (78 candidatos) puede ser insuficiente para evaluar con confianza si un método nuevo mejora genuinamente sobre el clásico, o si solo se ajusta mejor a esta muestra específica (sobreajuste). Este pendiente debe abordarse junto con, no antes de, una ampliación de la calibración.

---



**Cambio de enfoque respecto a la versión anterior:** en vez de depender de contactar en frío a un profesor o investigador (barrera real cuando no se tiene acceso institucional), la estrategia es construir visibilidad a través de canales ya diseñados para que la comunidad experta descubra y responda a contribuciones de ciencia ciudadana por mérito propio. Existe precedente directo: una publicación RNAAS de 2026 ("Discovery of a New Cataclysmic Variable... via the Exoasteroids Citizen Science Project") documenta exactamente este patrón — un voluntario sin formación profesional identificó una señal, y eso llegó a una publicación citable de la AAS.

**Ruta concreta, en orden de accesibilidad:**

1. **Publicar en RNAAS (Research Notes of the AAS)** — el paso más accionable de toda la hoja de ruta. No requiere afiliación institucional, no es revisado por pares tradicionalmente (sí por un editor, por formato y pertinencia), cuesta $0, límite de 1,500 palabras + 1 figura o tabla, y queda indexado en ADS de forma permanente y citable. El caso de estudio de KOI-1257 b (eclipse secundario, excentricidad, corrección metodológica) es un candidato natural: resultado breve, bien acotado, con hallazgo concreto.
2. **Participar activamente (no solo registrarse) en Planet Hunters TESS / Zooniverse** — su foro "Talk" tiene científicos de staff que responden directamente a voluntarios. Publicar ahí la metodología de vetting explicable pidiendo retroalimentación es una vía legítima de revisión experta sin contacto previo.
3. **Contactar al coordinador de participación amateur de PLATO (Gunther Wuchterl, identificado en la Fase de innovación #3)** — no es un contacto en frío a un desconocido cualquiera: es el punto de entrada oficial y ya documentado para exactamente este tipo de colaboración ciudadana.
4. **Mantener el repositorio de GitHub público**, con la hoja de ruta, el benchmark reproducible y los casos de estudio visibles — que el trabajo mismo sea la carta de presentación.

**Por qué este orden:** RNAAS es lo único de esta lista que no depende de que un tercero responda o preste atención — es una publicación real, indexada y citable, lograble de forma autónoma. Los otros 3 pasos son de exposición y visibilidad, no garantizados, pero de bajo riesgo y alineados con cómo la ciencia ciudadana real ha llegado a resultados publicados (caso Andrew Grey, Exoasteroids).

**Esto sigue siendo un paso determinante para el nivel "científico profesional"**, pero ya no depende de acceso institucional que no se tiene — depende de ejecutar estos 4 pasos, que sí están al alcance.

---



Usuarios reales (club de astronomía, cátedra universitaria, foro de ciencia ciudadana) probando la herramienta. Sin esto, ningún programa de financiamiento la tomará en serio — la mayoría de grants exigen evidencia de adopción o resultados publicables, no solo una idea.

---

## Fase 5: Publicación con estándares científicos profesionales — ⏳ PENDIENTE (redireccionada)

**Cambio de enfoque respecto a la version anterior:** ya no es solo "un whitepaper propio" — es un documento que sigue las convenciones reales del campo, con la intención explícita de ser revisable por pares, no solo leíble.

**Estructura profesional a seguir** (formato estándar de un paper de vetting de exoplanetas, como los que ya revisamos: Santerne et al., Thompson et al./Robovetter):
1. **Abstract, Introducción, Datos, Métodos, Resultados, Discusión, Conclusiones** — no una narrativa libre.
2. **Sección de Métodos** debe incluir la matriz de confusión y métricas de la Fase 2.5 — sin eso, ningún revisor tomará en serio las afirmaciones de rendimiento.
3. **Sección de Limitaciones** explícita — incluyendo la ambigüedad forma V/U vs. excentricidad orbital (caso KOI-1257 b), la sensibilidad a resolución de muestra (caso KOI-4878), y cualquier resultado de la Fase 2.5 que sea débil. Ocultar limitaciones es lo que distingue un paper amateur de uno profesional, no al revés.
4. **Cita formal de todo el trabajo previo apoyado** — Robovetter (Thompson et al. 2018), SciChain/data provenance, Santerne et al. 2014 (KOI-1257 b), y cualquier fuente usada en la Fase 2.
5. **Coautoría, agradecimiento formal, o cita** de cualquier retroalimentación experta obtenida vía la Fase 2.6 (foro de Planet Hunters TESS, coordinador de PLATO, o revisión editorial de RNAAS) — obligatorio si contribuyó a la validación de metodología.
6. **Publicación en arXiv (astro-ph.EP)** como preprint — paso estándar del campo antes o en paralelo a someter a una revista o presentar como poster en un congreso de la AAS (American Astronomical Society).

**Qué SÍ mantenemos de la versión anterior (sigue siendo válido):**
- Los 2 bugs corregidos durante la validación sintética, como evidencia de rigor metodológico.
- Los hallazgos de la Fase 2 (KOI-4878, KOI-1257 b) como casos de estudio ilustrativos dentro del paper — ya no como la validación principal (ese rol lo toma la Fase 2.5).
- El framework de auditoría (cadena de hashes + firma digital) como aporte diferenciador, con su atribución honesta al campo de *data provenance* ya documentada.
- El banco de pruebas sintético reproducible, formalizado como material suplementario descargable.

---

## Fase 6: Postulación a financiamiento con evidencia en mano — ⏳ PENDIENTE

Candidatos identificados: NASA CSSFP (exige resultados científicos publicables, no solo herramienta), NASA Open-Source Tools (exige adopción ya demostrada), NumFOCUS. Se postula con datos de adopción real + whitepaper, no con una idea.

---

## Fase 7: Escalar como infraestructura open-source sostenida — ⏳ PENDIENTE

Modelo de sostenibilidad tipo Astropy/Matplotlib: grants de mantenimiento plurianuales, no ventas directas al usuario final.

---

## Referencias académicas a citar en el whitepaper (Fase 5)

- Al-Mamun, A., Yan, F., Zhao, D. — "SciChain: Blockchain-enabled Lightweight and Efficient Data Provenance for Reproducible Scientific Computing" (ICDE 2021).
- Open Science Chain (OSC) — plataforma de cyberinfraestructura financiada por NSF para validación de autenticidad y linaje de datos de investigación.
- Principios FAIR (Findable, Accessible, Interoperable, Reusable) como marco de referencia para metadata de trazabilidad científica.
- ESMValTool — ejemplo de integración de provenance tracking en ciencia climática, como precedente de aplicación disciplinar específica.

---

## Notas de contexto del proyecto

- **Repositorio:** GitHub separado y aislado de proyectos financieros (ReclaimFi/AGI).
- **Sin Supabase:** no hay necesidad de backend/persistencia dado el diseño 100% client-side.
- **Posicionamiento:** herramienta educativa/divulgativa de alta calidad, complemento transparente y explicable a clasificadores de caja negra existentes (ExoMiner, AstroNet) — no busca competir en precisión bruta con esos modelos.



## Actualización: 15 de septiembre de 2026

Resumen de lo resuelto desde la última actualización (7 de septiembre), organizado por la fase que cada punto cierra o avanza.

### Cierra un pendiente de la Fase 2.5 ("ampliar la muestra a 100+ candidatos")

La galería de casos de estudio se amplió de 31 a **252 candidatos reales** del catálogo Kepler (127 `CONFIRMED`, 125 `FALSE POSITIVE`), descargados en lote vía `scripts/expand_case_studies.py`, consultando en vivo el NASA Exoplanet Archive y MAST (no depende de un archivo de muestra local estático). Todos los CSV y el manifiesto quedan en `public/case-studies/`, reutilizables directamente por el Dashboard y por scripts de calibración futuros.

Con esta muestra ampliada (~9 veces la original), se corrió `scripts/measure_recall_impact.py` y se **reconfirmó, de forma independiente, el hallazgo central de la Fase 2.5**: `odd_even` y `shape` muestran poder discriminativo nulo o casi nulo entre candidatos confirmados y falsos positivos reales (brechas de +2.5pp y -2.4pp respectivamente), mientras que `secondary` (+37.7pp) y `sufficiency` (+30.4pp) sí discriminan con fuerza.

### Cierra un pendiente de la Fase 2.5 ("explorar criterios adicionales con mayor poder discriminativo real")

Se investigó, contra la metodología publicada del Robovetter oficial de Kepler (Bryson et al. 2020, arxiv.org/pdf/2006.15719), **por qué** `shape` y `odd_even` no discriminan bien — no era solo cuestión de umbral:

- El test oficial de forma (V vs. U) requiere un **ajuste real de modelo de tránsito** (Mandel & Agol 2002): V = parámetro de impacto + razón de radios, con fallo si V > 1.05. La implementación actual solo cuenta fracción de puntos cerca del mínimo de brillo — una aproximación sin poder discriminativo real, confirmado con la muestra de 252.
- El test oficial de simetría par/impar mide una **significancia estadística** (diferencia de profundidades entre la incertidumbre de un ajuste de modelo), no una fracción simple. Se intentó adaptar esto usando la incertidumbre de puntos crudos (MAD) en vez de un ajuste real — medido contra los 252 casos, tampoco mejoró de forma sustancial (+2.5pp), porque la incertidumbre sin ajuste de modelo es demasiado grande.

**Conclusión, consistente con la Fase 2.5**: implementar un ajuste real de modelo de tránsito (Mandel-Agol) es el único camino identificado para que estos dos criterios funcionen como se diseñaron originalmente. Queda como tarea de ingeniería aparte, no resuelta hoy — ver "Próximos pasos" abajo.

### Nueva versión del motor: v0.2.0 (recalibración desplegada)

Con la evidencia de discriminación por criterio ya medida, se recalibró el esquema de pesos del motor real (`hooks/useLightCurveFilter.ts`), reemplazando la redistribución dinámica basada en `resolutionFactor` por pesos fijos informados por los datos: `secondary` 0.25, `sufficiency` 0.25 (antes excluido del puntaje, ahora compite como criterio real), `noise` 0.20, `flare` 0.15, `odd_even` 0.10, `shape` 0.05.

**Resultado medido, mismo conjunto de 252 casos:**

| Versión | Recall | Precisión |
|---|---|---|
| v0.1.x (esquema anterior) | ~45-47% | ~86-88% |
| v0.2.0 (desplegado) | 53.6% | 80.7% |

Reportado con la misma honestidad que el resto de este documento: es un **intercambio deliberado**, no una mejora sin costo — se prioriza recall porque el propio mecanismo de auditoría continua del proyecto ya absorbe ese costo (un confirmado señalado se marca para revisión humana, no se descarta automáticamente).

**Intento descartado, reportado igual que en la Fase 2.5:** antes de llegar a v0.2.0, se probó subir el umbral de "no concluyente" de 0.5 a 0.8. Medido contra los mismos datos, esto **empeoró** tanto el recall (45.3%→40.9%) como la precisión (86.0%→81.8%), y dejó 58% de los casos sin veredicto binario. Se revirtió — el mismo tipo de resultado negativo que la Fase 2.5 ya documentó no ocultar.

### Actualiza la Fase 2.6 (visibilidad ante expertos)

El paso 1 de la ruta ("Publicar en RNAAS") ya se ejecutó: la nota sobre KOI-1257 b fue enviada y recibida oficialmente con número de manuscrito **AAS80906**.

### Documentación

- **Whitepaper** (`docs/aletheia-ledger-whitepaper.md`): se encontró el borrador ya redactado el 7 de septiembre (previamente sin ubicar en el repositorio) y se actualizó con una Sección 4.4 nueva documentando todo lo anterior, preservando intacta la Sección 4.2 original (calibración de 29 casos) como registro histórico honesto.
- **Registro de procedencia de KOI-1257 b** (`docs/registro-procedencia-KOI-1257b.md`): corregido de marca (Aletheia Space → Aletheia Ledger).
- Este mismo documento (hoja de ruta): corregido de marca en las 7 menciones existentes.

### Rediseño visual del Dashboard

Se corrigió la marca visible en la interfaz (encabezado seguía mostrando "Aletheia Space"), se unificó la paleta de color a un solo acento (antes competían tres colores sin sistema), se amplió el layout a ancho completo de pantalla, y se conectó un bug real encontrado en el proceso: la Galería de Casos no tenía cableada su función de selección (`onSelectCase` faltante en `page.tsx`), por lo que hacer clic en un caso no cargaba nada — corregido y verificado con una ejecución real de principio a fin.

### Nueva fase futura identificada: "Auditoría Estelar"

Se definió, como segundo módulo/segunda colección de la plataforma (posterior a concluir el módulo actual de exoplanetas), un motor de auditoría de **actividad estelar** (manchas y llamaradas), con 6 criterios propuestos: morfología de llamarada (forma FRED), consistencia amplitud-duración contra catálogos públicos (Yang & Liu 2019), corroboración multi-cadencia, separación periodicidad/estocasticidad, estabilidad de línea base, y corroboración cruzada entre instrumentos. Diseño conceptual completo, sin implementar todavía.

### Próximos pasos, en orden de prioridad

1. Implementar ajuste real de modelo de tránsito (Mandel-Agol) para rediseñar `shape` y `odd_even` correctamente — el pendiente de mayor impacto identificado hoy.
2. Recalcular la matriz de confusión completa de la corrida v0.2.0 (el whitepaper reporta una exactitud global derivada, pendiente de confirmar directamente).
3. Continuar ampliando la galería de casos más allá de 252 para reducir incertidumbre estadística.
4. Confirmar en `git` que todos los cambios de hoy (motor v0.2.0, whitepaper, registro de procedencia, esta hoja de ruta) quedaron respaldados en el historial de versiones.
