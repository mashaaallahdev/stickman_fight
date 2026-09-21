import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

function getExecutablePath() {
  const possiblePaths = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ].filter(Boolean);

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

async function capture() {
  const execPath = getExecutablePath();
  console.log('Using browser binary:', execPath);

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: execPath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1280,720'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  page.on('console', msg => console.log('[Page Console]', msg.type(), msg.text()));
  page.on('pageerror', err => console.error('[Page Error]', err));

  await page.goto('http://localhost:8080/public/index.html', { waitUntil: 'networkidle0' });

  // Click #startBtn to start match
  try {
    const startBtn = await page.$('#startBtn');
    if (startBtn) {
      console.log('Clicking #startBtn...');
      await startBtn.click();
    }
  } catch (e) {
    console.error('Click error:', e);
  }

  // Ensure sound banner is hidden for screenshot
  await page.evaluate(() => {
    const banner = document.getElementById('soundBanner');
    if (banner) banner.style.display = 'none';
  });

  const artifactDir = process.env.ARTIFACT_DIR || path.join(ROOT, 'output');

  // 1. First glance (straight arms)
  console.log('Capturing first glance straight arms (150ms)...');
  await new Promise(r => setTimeout(r, 150));
  const straightPath = path.join(artifactDir, 'straight_hands_first_glance.png');
  await page.screenshot({ path: straightPath });
  console.log('Saved:', straightPath);

  // 2. Bent fighter guard
  console.log('Waiting for arms to smoothly bend into fighter guard (1600ms)...');
  await new Promise(r => setTimeout(r, 1600));
  const bentPath = path.join(artifactDir, 'bent_hands_fighter_guard.png');
  await page.screenshot({ path: bentPath });
  console.log('Saved:', bentPath);

  // 3. Victory Celebration pose
  console.log('Triggering victory celebration pose for preview...');
  await page.evaluate(() => {
    if (window.gameEngine && window.gameEngine.fighters) {
      const [p1, p2] = window.gameEngine.fighters;
      window.gameEngine.matchState = 'FINAL_VICTORY';
      window.gameEngine.stateTimer = 1.2;
      window.gameEngine.finalWinner = p1;
      p1.state = 'VICTORY';
      p1.stateTimer = 1.2;
      p2.state = 'DEAD';
    }
  });
  await new Promise(r => setTimeout(r, 400));
  const victoryPath = path.join(artifactDir, 'winner_celebration_preview.png');
  await page.screenshot({ path: victoryPath });
  console.log('Saved:', victoryPath);

  await browser.close();
}

capture().catch(err => {
  console.error(err);
  process.exit(1);
});
