import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1320, height: 900 } });
await page.goto("file:///Users/billionairekwon/Desktop/sptr%201.0/sportier-sbi-u15.html");
await page.waitForTimeout(600);

const sbi = await page.textContent("#sbiNum");
console.log("SBI (기대값 ≈ 87.7):", sbi);

await page.screenshot({ path: "scripts/sbi-u15.png", fullPage: true });
await browser.close();
process.exit(0);
