async function diagnose() {
  const res = await fetch("http://localhost:3000/api/fetch-photometry?kic=5816811&maxQuarters=17");
  const data = await res.json();

  const times = data.points.map((p) => p.time);
  console.log("Primeros 5 tiempos:", times.slice(0, 5));
  console.log("Ultimos 5 tiempos:", times.slice(-5));

  // Verificar si estan ordenados correctamente
  let outOfOrder = 0;
  for (let i = 1; i < times.length; i++) {
    if (times[i] < times[i-1]) outOfOrder++;
  }
  console.log("Puntos fuera de orden temporal:", outOfOrder, "de", times.length);

  // Verificar gaps grandes (separaciones entre trimestres)
  const gaps = [];
  for (let i = 1; i < times.length; i++) {
    const gap = times[i] - times[i-1];
    if (gap > 1) gaps.push({ index: i, gap, time: times[i] });
  }
  console.log("Gaps mayores a 1 dia:", gaps.length);
  console.log("Primeros 5 gaps:", gaps.slice(0, 5));
}
diagnose();