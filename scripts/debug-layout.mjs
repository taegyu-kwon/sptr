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

const info = await page.evaluate(() => {
  const grid = document.querySelector(".grid.cols-4");
  const gs = getComputedStyle(grid);
  const cards = [...grid.children].map(el => {
    const cs = getComputedStyle(el);
    return {
      label: el.querySelector(".label")?.textContent,
      alignSelf: cs.alignSelf,
      height: cs.height,
      children: [...el.children].map(c => {
        const ccs = getComputedStyle(c);
        return `${c.className}: h=${Math.round(c.getBoundingClientRect().height)} fs=${ccs.fontSize} lh=${ccs.lineHeight}`;
      }),
    };
  });
  return {
    gridAlignItems: gs.alignItems,
    gridAutoRows: gs.gridAutoRows,
    gridTemplateRows: gs.gridTemplateRows,
    cards,
  };
});
console.log(JSON.stringify(info, null, 2));

await browser.close();
await server.close();
process.exit(0);
