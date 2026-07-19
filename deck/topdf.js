// deck/topdf.js — deck/index.html'i 16:9 PDF'e çevirir.
const puppeteer = require("puppeteer");

(async () => {
  const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.goto("file://" + __dirname + "/index.html", { waitUntil: "networkidle0" });
  await page.pdf({
    path: __dirname + "/aegis-deck.pdf",
    width: "1280px", height: "720px",
    printBackground: true, margin: { top: 0, bottom: 0, left: 0, right: 0 },
  });
  await browser.close();
  console.log("✅ deck/aegis-deck.pdf üretildi");
})();
