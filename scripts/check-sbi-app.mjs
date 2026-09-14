import { chromium } from "playwright";
import { preview } from "vite";

const server = await preview({ preview: { port: 4176 } });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.goto("http://localhost:4176/#/auth");
await page.fill('input[type="email"]', "player@sptr.demo");
await page.fill('input[type="password"]', "demo1234");
await page.click('button[type="submit"]');
await page.waitForTimeout(400);
await page.goto("http://localhost:4176/#/sbi");
await page.waitForTimeout(500);

// 샘플 입력 (문서 U15 SAMPLE)
await page.fill('input[type="number"] >> nth=0', "65");   // 체중
await page.fill('input[type="number"] >> nth=1', "132");  // 구속
await page.fill('input[type="number"] >> nth=2', "1.55"); // 스프린트
await page.fill('input[type="number"] >> nth=3', "58");   // 버티컬
await page.fill('input[type="number"] >> nth=4', "50");   // 스쿼트
await page.fill('input[type="number"] >> nth=5', "13");   // 데드
await page.fill('input[type="number"] >> nth=6', "16");   // 푸쉬업
await page.waitForTimeout(400);

await page.screenshot({ path: "scripts/sbi-app.png", fullPage: true });
await browser.close();
await server.close();
process.exit(0);
