import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'output');

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

async function verifyVisuals() {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: getExecutablePath(),
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,720']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  await page.goto('http://localhost:8080/public/index.html?autostart=1', { waitUntil: 'networkidle0' });

  // 1. Snapshot Round 1 Announcement with straight body upright fighters
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'snapshot_1_round1_announce.png') });
  console.log('[Snapshot 1] Saved Round 1 Announcement.');

  // 2. Snapshot FIGHT! Announcement
  await new Promise(r => setTimeout(r, 1400));
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'snapshot_2_fight_announce.png') });
  console.log('[Snapshot 2] Saved FIGHT! Announcement.');

  // 3. Snapshot Active Combat with straight body walking & strikes
  await new Promise(r => setTimeout(r, 2500));
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'snapshot_3_walk_and_fight.png') });
  console.log('[Snapshot 3] Saved walking and fighting snapshot.');

  await browser.close();
  console.log('Visual verification complete!');
}

verifyVisuals().catch(console.error);
