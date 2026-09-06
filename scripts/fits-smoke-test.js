const { FITSParser } = require("jsfitsio");

async function smokeTest() {
  const url = "https://archive.stsci.edu/missions/kepler/lightcurves/0118/011804437/kplr011804437-2009131105131_llc.fits";

  const fitsFile = await FITSParser.loadFITSFile(url);
  const hdu = fitsFile.hdus[1];

  const columnIndex = (name) => hdu.columns.findIndex((c) => c.name === name);
  const timeIdx = columnIndex("TIME");
  const fluxIdx = columnIndex("PDCSAP_FLUX");
  const fluxErrIdx = columnIndex("PDCSAP_FLUX_ERR");
  const qualityIdx = columnIndex("SAP_QUALITY");

  console.log("Indices:", { timeIdx, fluxIdx, fluxErrIdx, qualityIdx });

  const points = [];
  for (let i = 0; i < hdu.rowCount; i++) {
    const row = hdu.getRow(i);
    const time = row[timeIdx];
    const flux = row[fluxIdx];
    if (time === null || flux === null || Number.isNaN(time) || Number.isNaN(flux)) continue;

    points.push({
      time,
      flux,
      fluxErr: row[fluxErrIdx] ?? 0.0001,
      quality: row[qualityIdx] ?? 0,
    });
  }

  console.log(`Puntos validos extraidos: ${points.length} de ${hdu.rowCount} filas totales`);
  console.log("Primeros 3 puntos:", points.slice(0, 3));
}

smokeTest().catch((err) => {
  console.error("ERROR:", err.message);
  console.error(err.stack);
});