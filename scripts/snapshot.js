import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ARTIFACTS_DIR = process.env.ARTIFACTS_DIR || path.join(ROOT, 'output');

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

async function takeSnapshots() {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: getExecutablePath(),
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--autoplay-policy=no-user-gesture-required',
      '--window-size=1280,720'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });

  console.log('Navigating to game on port 8080...');
  await page.goto('http://localhost:8080/public/index.html?autostart=1', { waitUntil: 'networkidle0' });

  // 1. Initial snapshot during intro announcement
  await new Promise(r => setTimeout(r, 1200));
  const snap1Path = path.join(ARTIFACTS_DIR, 'snapshot_intro_round.png');
  await page.screenshot({ path: snap1Path });
  console.log(`Saved snapshot 1 to: ${snap1Path}`);

  // 2. Active combat snapshot
  await new Promise(r => setTimeout(r, 3500));
  const snap2Path = path.join(ARTIFACTS_DIR, 'snapshot_active_combat.png');
  await page.screenshot({ path: snap2Path });
  console.log(`Saved snapshot 2 to: ${snap2Path}`);

  // 3. Extended combat snapshot showing elemental / dynamic action
  await new Promise(r => setTimeout(r, 4000));
  const snap3Path = path.join(ARTIFACTS_DIR, 'snapshot_elemental_action.png');
  await page.screenshot({ path: snap3Path });
  console.log(`Saved snapshot 3 to: ${snap3Path}`);

  await browser.close();
  console.log('Snapshots completed successfully!');
}

takeSnapshots().catch(err => {
  console.error(err);
  process.exit(1);
});
