async function saveJsData() {
  const res = await fetch("http://localhost:3000/api/fetch-photometry?kic=5816811&maxQuarters=17");
  const data = await res.json();

  const fs = require("fs");
  const header = "time,flux,flux_err,quality\n";
  const body = data.points
    .map((p) => `${p.time},${p.flux},${p.fluxError},${p.quality}`)
    .join("\n");
  fs.writeFileSync("test-data/kic5816811-from-javascript.csv", header + body);
  console.log(`Guardado: test-data/kic5816811-from-javascript.csv (${data.points.length} puntos)`);
}
saveJsData();