import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

async function capture() {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto('http://localhost:8080/public/index.html', { waitUntil: 'networkidle0' });

  // Wait 1.5 seconds to capture active match with background loaded
  await new Promise(r => setTimeout(r, 1500));

  const screenshotPath = path.join(ROOT, 'output', 'live_pixel_art.png');
  await page.screenshot({ path: screenshotPath });
  console.log('Saved screenshot to:', screenshotPath);

  await browser.close();
}

capture().catch(console.error);
