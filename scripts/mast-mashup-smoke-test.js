const url = "https://mast.stsci.edu/api/v0/invoke";

const requestBody = {
  service: "Mast.Caom.Filtered",
  params: {
    columns: "*",
    filters: [
      { paramName: "obs_collection", values: ["Kepler"] },
      { paramName: "target_name", values: ["kplr005816811"] }
    ]
  },
  format: "json"
};

async function testMashup() {
  console.log("Consultando API Mashup de MAST...");
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "request=" + encodeURIComponent(JSON.stringify(requestBody)),
  });

  console.log("Status HTTP:", response.status);
  const text = await response.text();
  console.log("Primeros 2000 caracteres de la respuesta:");
  console.log(text.slice(0, 2000));
}

testMashup().catch((err) => {
  console.error("ERROR:", err.message);
});