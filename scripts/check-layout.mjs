import { chromium } from "playwright";
import { preview } from "vite";

const server = await preview({ preview: { port: 4173 } });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 640, height: 900 } });

await page.goto("http://localhost:4173/#/auth");
await page.fill('input[type="email"]', "player@sptr.demo");
await page.fill('input[type="password"]', "demo1234");
await page.click('button[type="submit"]');
await page.waitForTimeout(500);
await page.goto("http://localhost:4173/#/p/stats");
await page.waitForTimeout(800);

const boxes = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll(".card.stat, .grid.cols-3.equal > .card").forEach(el => {
    const r = el.getBoundingClientRect();
    out.push({
      label: el.querySelector(".label, h3")?.textContent?.trim().slice(0, 20),
      top: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
    });
  });
  return out;
});
console.table(boxes);

await page.screenshot({ path: "scripts/stats-640.png", fullPage: true });
await browser.close();
await server.close();
process.exit(0);
