const axios = require("axios");
const cheerio = require("cheerio");

axios
  .get("https://prosettings.net/players/fallen/", {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  })
  .then((r) => {
    const $ = cheerio.load(r.data);

    // Procura por "CSGO-" no HTML inteiro
    const html = r.data;
    const match = html.match(
      /CSGO-[a-zA-Z0-9]{5}-[a-zA-Z0-9]{5}-[a-zA-Z0-9]{5}-[a-zA-Z0-9]{5}-[a-zA-Z0-9]{5}/,
    );
    console.log("Código da mira:", match ? match[0] : "Não encontrado");

    // Procura também por atributos data- que possam ter o código
    $("[data-crosshair], [data-code], [data-copy]").each((i, el) => {
      console.log(
        "Atributo data:",
        $(el).attr("data-crosshair") ||
          $(el).attr("data-code") ||
          $(el).attr("data-copy"),
      );
    });
  });
