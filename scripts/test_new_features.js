import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

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

async function verify() {
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

  page.on('console', msg => {
    console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`);
  });

  page.on('pageerror', err => {
    console.error('[Page Error]', err);
  });

  console.log('Navigating to game...');
  await page.goto('http://localhost:8080/public/index.html?autostart=1', { waitUntil: 'networkidle0' });

  // Click on the canvas to trigger audio resume
  await page.mouse.click(640, 360);
  await new Promise(r => setTimeout(r, 1000));

  // Snapshot 1: Round start / stance (Straight legs, natural guard hands pointing down)
  await page.screenshot({ path: path.join(ROOT, 'output', 'verify_stance_hands.png') });
  console.log('Snapshot 1 captured: verify_stance_hands.png');

  // Wait 3.5s for combat to start and fighters to move forward / backward and trade blows
  await new Promise(r => setTimeout(r, 3500));
  await page.screenshot({ path: path.join(ROOT, 'output', 'verify_combat_walk.png') });
  console.log('Snapshot 2 captured: verify_combat_walk.png');

  // Let's inspect fighter properties directly in page context
  const inspectData = await page.evaluate(() => {
    const f1 = window.gameEngine?.fighters?.[0];
    const f2 = window.gameEngine?.fighters?.[1];
    const sound = window.soundEngine;
    return {
      f1: f1 ? {
        name: f1.name,
        state: f1.state,
        facing: f1.facing,
        vx: f1.vx,
        rightElbowY: f1.joints?.rightElbow?.y,
        rightShoulderY: f1.joints?.rightShoulder?.y,
        rightHandY: f1.joints?.rightHand?.y,
        leftKneeY: f1.joints?.leftKnee?.y,
        leftFootY: f1.joints?.leftFoot?.y
      } : null,
      soundState: sound?.ctx?.state,
      bgmGain: sound?.bgmGain?.gain?.value
    };
  });

  console.log('Inspect Data:', inspectData);

  // Let combat continue until someone is KO'd and verify the grounded defeat pose
  console.log('Waiting for KO / round win to verify fully grounded defeat pose...');
  let groundedCaptured = false;
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const deadStatus = await page.evaluate(() => {
      const deadFighter = window.gameEngine?.fighters?.find(f => f.state === 'DEAD' || f.hp <= 0);
      if (deadFighter) {
        return {
          found: true,
          name: deadFighter.name,
          state: deadFighter.state,
          joints: deadFighter.joints
        };
      }
      return { found: false };
    });

    if (deadStatus.found && !groundedCaptured) {
      await new Promise(r => setTimeout(r, 1200)); // Wait for ragdoll settle on floor
      await page.screenshot({ path: path.join(ROOT, 'output', 'verify_grounded_defeat.png') });
      console.log('Snapshot 3 captured: verify_grounded_defeat.png (Defeated fighter:', deadStatus.name, ')');
      console.log('Defeated joints:', deadStatus.joints);
      groundedCaptured = true;
      break;
    }
  }

  await browser.close();
  console.log('Verification finished successfully!');
}

verify().catch(err => {
  console.error(err);
  process.exit(1);
});
