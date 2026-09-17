Aletheia Ledger parte de una pregunta simple: ¿cómo se le puede pedir a alguien que confíe en un veredicto científico automatizado si no puede ver por qué se llegó a esa conclusión?

Este es un proyecto independiente — no fue construido por un astrofísico, sino por un Contador Público que aplica los mismos estándares de evidencia usados en la auditoría financiera a un campo completamente distinto.

El proyecto aplica un principio tomado directamente de la auditoría financiera profesional —toda decisión debe ser explicable, verificable, y dejar un rastro de evidencia inmutable— a datos científicos reales. Su primer módulo, ya construido y validado, analiza curvas de luz de tránsitos planetarios (datos reales de la misión Kepler de la NASA) para determinar si un candidato a exoplaneta es probablemente real o un falso positivo, mostrando el razonamiento completo detrás de cada veredicto en vez de un puntaje de caja negra.

La arquitectura central del proyecto —el motor de criterios explicables, la cadena de auditoría criptográfica, y el mecanismo de abstención ante evidencia insuficiente— fue diseñada para ser independiente del dominio. Los exoplanetas son el caso de uso actual, no una limitación permanente: la misma filosofía de auditoría aplica a cualquier campo donde conclusiones automatizadas necesiten ser verificadas contra evidencia real.

## Módulo actual: escrutinio de exoplanetas

- **Motor de escrutinio de seis criterios**: simetría de profundidad par/impar, forma del tránsito (V vs. U), dispersión de ruido residual, firma periódica de llamaradas, suficiencia de muestra, y búsqueda de eclipse secundario (con mecanismo de veto).
- **Categoría "No concluyente"**: el motor puede abstenerse de un veredicto binario cuando la evidencia es insuficiente, en vez de forzar una conclusión.
- **Auditoría continua**: marca candidatos ya confirmados que muestran señales de alerta internas, invitando a una segunda revisión humana sin reclasificarlos automáticamente.
- **Fotometría real, sin instalación requerida**: descubre y descarga archivos FITS reales de Kepler directamente vía la API de MAST, aplana la curva de luz con un filtro Savitzky-Golay en TypeScript puro (validado con r=0.992 contra el pipeline de referencia en Python) — todo dentro del navegador.
- **Suite de pruebas sintéticas reproducibles**, con escenarios de verdad conocida (planeta limpio, binaria eclipsante, contaminación por llamarada).

## La parte que no es sobre exoplanetas

Estos componentes son independientes del dominio por diseño, y son los candidatos naturales para reutilizarse en futuros módulos:

- **Cadena de proveniencia criptográfica**: cada análisis produce una cadena de hash SHA-256 verificable, desde el dato crudo hasta el veredicto final, más firma digital ECDSA opcional. Nada de este mecanismo es específico de la astronomía.
- **El principio de abstención ante evidencia insuficiente**: una regla de decisión general (nunca forzar un veredicto binario sin evidencia adecuada) aplicable a cualquier sistema de clasificación automatizado.
- **El principio de auditoría continua**: revisitar periódicamente conclusiones ya "confirmadas" con métodos independientes, en vez de tratarlas como definitivas para siempre.

## Visión: más allá de los exoplanetas

Todavía no se ha construido un segundo módulo —se dice aquí con honestidad, no como una fecha prometida. Pero la intención declarada del proyecto es explorar, en el futuro, aplicar esta misma arquitectura de auditoría explicable a otros campos donde la verificación transparente de conclusiones automatizadas tenga valor real. Sugerencias y colaboración sobre posibles dominios futuros son bienvenidas vía Issues.

## Resultados científicos reales (módulo de exoplanetas)

- **Hallazgo publicado**: Ramírez Hernández, J. (2026), "An Explainable, Auditable Vetting Framework Reveals Transit-Shape Ambiguity in the Eccentric Giant Planet KOI-1257 b," *Research Notes of the AAS* (manuscrito AAS80906).
- **Calibración estadística formal (v0.2.0, actual)**: evaluado contra 252 candidatos reales del catálogo de Kepler (127 confirmados, 125 falsos positivos oficiales), descargados en vivo desde MAST/NASA Exoplanet Archive. Resultado: 53.6% de recall y 80.7% de precisión en detección de falsos positivos —un intercambio deliberado que prioriza recall, reportado junto con el análisis de poder discriminativo por criterio que lo motivó, incluyendo las limitaciones actuales de dos de los seis criterios.
- Documentación completa del proceso de calibración, hallazgos y limitaciones en `aletheia-ledger-whitepaper.md`.

## Colección de libros complementaria

La metodología, los hallazgos y el razonamiento de este proyecto están documentados en una colección accesible de 10 libros, *Aletheia Ledger*, escrita para lectores sin formación en astrofísica. El Libro 1 —*Exoplanetas: Un viaje al método que revela mundos lejanos*— ya está disponible en Kindle:

- Español: https://www.amazon.com/dp/B0HK14R9PD
- English: https://www.amazon.com/dp/B0HJZXN64Z

Los nuevos libros de la colección se publican aproximadamente cada cuatro semanas.

## Cómo ejecutarlo localmente

```
npm install
npm run dev
```

Abre http://localhost:3000 en tu navegador.

Las funciones de calibración y análisis por lotes requieren un entorno virtual de Python con `lightkurve`, `astroquery`, `numpy`, y `pandas` —ver los scripts en `scripts/`.

## Estructura del proyecto

- `app/` — Next.js App Router, incluyendo rutas de API para descubrimiento y descarga de fotometría (`/api/mast-discover`, `/api/fetch-photometry`).
- `components/` — Componentes de React para el Dashboard del módulo de exoplanetas.
- `lib/` — lógica del motor de escrutinio, cadena de auditoría, filtro Savitzky-Golay, cliente del NASA Exoplanet Archive.
- `hooks/` — React hooks para el flujo de análisis.
- `scripts/` — Scripts de Python para calibración estadística y generación de datos de prueba.
- `test-data/` — casos de prueba sintéticos y resultados de calibración (JSON, CSV).

## Licencia y autoría

Licenciado bajo **AGPL-3.0**. Proyecto de investigación independiente desarrollado por Javiel De Jesús Ramírez Hernández (ORCID: 0009-0005-9007-6029), Contador Público e investigador independiente en ciencia ciudadana astronómica.

Contribuciones, reportes de errores y sugerencias para futuros módulos son bienvenidas vía Issues.
