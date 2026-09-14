import { chromium } from "playwright";
import { preview } from "vite";

const server = await preview({ preview: { port: 4174 } });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

await page.goto("http://localhost:4174/#/auth");
await page.fill('input[type="email"]', "player@sptr.demo");
await page.fill('input[type="password"]', "demo1234");
await page.click('button[type="submit"]');
await page.waitForTimeout(400);
await page.goto("http://localhost:4174/#/p/ranking");
await page.waitForTimeout(600);

const overflow = await page.evaluate(() => ({
  bodyScrollW: document.body.scrollWidth,
  innerW: window.innerWidth,
  cardScrollable: (() => {
    const c = document.querySelector(".card");
    return c ? { scrollW: c.scrollWidth, clientW: c.clientWidth } : null;
  })(),
}));
console.log(JSON.stringify(overflow));

await page.screenshot({ path: "scripts/ranking-390.png", fullPage: true });
await browser.close();
await server.close();
process.exit(0);
