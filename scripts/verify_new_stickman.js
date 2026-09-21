import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ARTIFACT_DIR = process.env.ARTIFACT_DIR || path.join(ROOT, 'output');

function getExecutablePath() {
  const possiblePaths = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  ].filter(Boolean);

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

async function run() {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: getExecutablePath(),
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--autoplay-policy=no-user-gesture-required',
      '--use-fake-ui-for-media-stream',
      '--window-size=1280,720'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  page.on('console', msg => console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`));
  page.on('pageerror', err => console.error('[Page Error]', err));

  console.log('Navigating to game...');
  await page.goto('http://localhost:8080/public/index.html?autostart=1', { waitUntil: 'networkidle0' });

  // 1. Force readyBlend = 0 to capture exact straight arms at first glance
  await page.evaluate(() => {
    window.gameEngine.fighters.forEach(f => {
      f.readyBlend = 0;
      f.state = 'IDLE';
    });
  });
  await new Promise(r => setTimeout(r, 60));
  const shot1 = path.join(ARTIFACT_DIR, 'stickman_straight_start.png');
  await page.screenshot({ path: shot1 });
  console.log('Captured straight arms:', shot1);

  // 2. Force readyBlend = 1 to capture exact alert guard
  await page.evaluate(() => {
    window.gameEngine.fighters.forEach(f => {
      f.readyBlend = 1;
    });
  });
  await new Promise(r => setTimeout(r, 100));
  const shot2 = path.join(ARTIFACT_DIR, 'stickman_guard_ready.png');
  await page.screenshot({ path: shot2 });
  console.log('Captured guard ready:', shot2);

  // 3. Combat action screenshot
  await new Promise(r => setTimeout(r, 3500));
  const shot3 = path.join(ARTIFACT_DIR, 'stickman_combat_action.png');
  await page.screenshot({ path: shot3 });
  console.log('Captured:', shot3);

  // 4. Verify fighter properties & HUD
  const info = await page.evaluate(() => {
    const f1 = window.gameEngine?.fighters?.[0];
    const f2 = window.gameEngine?.fighters?.[1];
    return {
      f1Name: f1?.name,
      f2Name: f2?.name,
      f1ReadyBlend: f1?.readyBlend,
      round: window.gameEngine?.currentRound,
      matchState: window.gameEngine?.matchState
    };
  });
  console.log('Info:', info);

  await browser.close();
  console.log('Done verification capture!');
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
