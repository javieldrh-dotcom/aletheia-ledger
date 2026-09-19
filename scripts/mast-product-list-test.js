const url = "https://mast.stsci.edu/api/v0/invoke";

const requestBody = {
  service: "Mast.Caom.Products",
  params: { obsid: "569755" },
  format: "json"
};

async function testProductList() {
  console.log("Consultando lista de productos para obsid 569755...");
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "request=" + encodeURIComponent(JSON.stringify(requestBody)),
  });

  console.log("Status HTTP:", response.status);
  const json = await response.json();
  console.log("Total de productos encontrados:", json.data ? json.data.length : "N/A");

  if (json.data) {
    const lightcurves = json.data.filter(
      (p) => p.productSubGroupDescription === "LLC" || (p.productFilename && p.productFilename.includes("llc"))
    );
    console.log(`\nProductos de curva de luz (llc): ${lightcurves.length}`);
    lightcurves.slice(0, 5).forEach((p) => {
      console.log(`  - ${p.productFilename} | URI: ${p.dataURI}`);
    });
  }
}

testProductList().catch((err) => console.error("ERROR:", err.message));