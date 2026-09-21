import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'output');

function getExecutablePath() {
  const possiblePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  ];
  return possiblePaths.find(Boolean);
}

async function verify() {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: getExecutablePath(),
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,720']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto('http://localhost:8080/public/index.html?autostart=1', { waitUntil: 'networkidle0' });

  // 1. Snapshot Pre-Fight and Fire Power HUD meters
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'snapshot_strength_vs_speed_hud.png') });
  console.log('[Snapshot 1] Saved HUD with Fire Power gauges.');

  // 2. Snapshot Combat & Speed Ghosting / Strength Slams
  await new Promise(r => setTimeout(r, 3500));
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'snapshot_strength_vs_speed_combat.png') });
  console.log('[Snapshot 2] Saved Strength vs Speed combat snapshot.');

  // 3. Snapshot later into the round (fire power progression)
  await new Promise(r => setTimeout(r, 7000));
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'snapshot_fire_power_active.png') });
  console.log('[Snapshot 3] Saved Fire Power active snapshot.');

  await browser.close();
  console.log('Done!');
}

verify().catch(console.error);
