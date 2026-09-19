async function checkQuality() {
  const res = await fetch("http://localhost:3000/api/fetch-photometry?kic=5816811&maxQuarters=2");
  const data = await res.json();
  const qualityValues = data.points.map((p) => p.quality);
  const unique = [...new Set(qualityValues)];
  console.log("Valores unicos de quality encontrados:", unique.slice(0, 20));
  console.log("Total de puntos:", data.points.length);

  const counts = {};
  for (const q of qualityValues) {
    counts[q] = (counts[q] || 0) + 1;
  }
  console.log("Conteo por valor:", counts);
}
checkQuality();