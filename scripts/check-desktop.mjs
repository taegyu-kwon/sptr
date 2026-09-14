import { chromium } from "playwright";
import { preview } from "vite";

const server = await preview({ preview: { port: 4175 } });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

await page.goto("http://localhost:4175/#/auth");
await page.fill('input[type="email"]', "player@sptr.demo");
await page.fill('input[type="password"]', "demo1234");
await page.click('button[type="submit"]');
await page.waitForTimeout(400);
await page.goto("http://localhost:4175/#/p/stats");
await page.waitForTimeout(600);
await page.click(".menu-btn");
await page.waitForTimeout(300);
await page.screenshot({ path: "scripts/desktop-menu.png" });
await browser.close();
await server.close();
process.exit(0);
