// Headless Puppeteer Script to Execute Stickman Brawl & Dump 1080x1920 Video
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import { startServer } from './serve.js';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'output');

const isDryRun = process.argv.includes('--dry-run');

function getArg(flag, defaultValue = 'RANDOM') {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  return defaultValue;
}

const p1Choice = getArg('--p1', 'RANDOM');
const p2Choice = getArg('--p2', 'RANDOM');
const stageChoice = getArg('--stage', 'RANDOM');

function getExecutablePath() {
  const possiblePaths = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium'
  ].filter(Boolean);

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

async function runRecorder() {
  console.log('=== [1/5] Starting Local Server ===');
  const port = 8089;
  const server = await startServer(port);

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log('=== [2/5] Launching Headless Chromium ===');
  const execPath = getExecutablePath();
  if (execPath) {
    console.log(`[Puppeteer] Using browser binary: ${execPath}`);
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: execPath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--autoplay-policy=no-user-gesture-required',
      '--use-fake-ui-for-media-stream',
      '--window-size=1280,720'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({
    width: 1280,
    height: 720,
    deviceScaleFactor: 1
  });

  page.on('console', msg => {
    console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`);
  });
  page.on('pageerror', err => {
    console.error(`[Browser PageError] ${err.toString()}`);
  });

  console.log(`=== [3/5] Navigating to Brawl Viewport (P1: ${p1Choice}, P2: ${p2Choice}, Stage: ${stageChoice}) ===`);
  const queryParams = new URLSearchParams({
    autostart: '1',
    record: '1',
    p1: p1Choice,
    p2: p2Choice,
    stage: stageChoice
  });
  const targetUrl = `http://localhost:${port}/public/index.html?${queryParams.toString()}`;
  await page.goto(targetUrl, { waitUntil: 'networkidle0' });

  if (isDryRun) {
    console.log('[Dry Run] Page loaded cleanly. Stopping execution for verification.');
    await browser.close();
    server.close();
    console.log('=== Dry Run Complete! ===');
    process.exit(0);
  }

  console.log('=== [4/5] Recording Match in Progress... (50s - 2min duration) ===');
  // Wait until multi-round match is finished and video base64 is populated
  const maxTimeoutMs = 150000; // 2.5 minutes timeout
  const startTime = Date.now();

  let recordingData = null;
  let matchData = null;

  let lastLogTime = 0;
  while (Date.now() - startTime < maxTimeoutMs) {
    const status = await page.evaluate(() => ({
      finished: window.MATCH_FINISHED,
      recordingCompleted: window.RECORDING_COMPLETED,
      matchData: window.MATCH_DATA,
      hasBase64: !!window.RECORDING_BASE64,
      base64Len: window.RECORDING_BASE64 ? window.RECORDING_BASE64.length : 0,
      matchState: window.gameEngine ? window.gameEngine.matchState : null,
      matchDuration: window.gameEngine ? window.gameEngine.totalMatchDuration : null,
      round: window.gameEngine ? window.gameEngine.currentRound : null,
      isRecording: window.streamRecorder ? window.streamRecorder.isRecording : null
    }));

    if (Date.now() - lastLogTime > 4000) {
      lastLogTime = Date.now();
      console.log(`[Recorder Progress] Round: ${status.round}, State: ${status.matchState}, Duration: ${status.matchDuration ? status.matchDuration.toFixed(1) : 0}s, Rec: ${status.isRecording}, Fin: ${status.finished}, Done: ${status.recordingCompleted}`);
    }

    if (status.recordingCompleted && status.hasBase64) {
      // Grab actual base64
      recordingData = await page.evaluate(() => window.RECORDING_BASE64);
      matchData = status.matchData;
      console.log('[Recorder] Recording completed signal received! Video size:', status.base64Len, 'chars');
      break;
    }

    // Wait 500ms before next check
    await new Promise(r => setTimeout(r, 500));
  }

  await browser.close();
  server.close();

  if (!recordingData) {
    throw new Error('Recording timed out without producing video data.');
  }

  console.log('=== [5/5] Exporting & Transcoding Video ===');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const rawWebmPath = path.join(OUTPUT_DIR, `reel_${timestamp}.webm`);
  const finalMp4Path = path.join(OUTPUT_DIR, `reel_${timestamp}.mp4`);

  // Strip Base64 prefix and write WebM
  const base64Marker = ';base64,';
  const markerIdx = recordingData.indexOf(base64Marker);
  const base64Data = markerIdx !== -1 ? recordingData.slice(markerIdx + base64Marker.length) : recordingData;
  fs.writeFileSync(rawWebmPath, Buffer.from(base64Data, 'base64'));
  console.log(`[Recorder] Saved WebM video to: ${rawWebmPath} (${fs.statSync(rawWebmPath).size} bytes)`);

  // Optionally copy to artifacts directory if env is set
  if (process.env.ARTIFACT_DIR && fs.existsSync(process.env.ARTIFACT_DIR)) {
    try {
      fs.copyFileSync(rawWebmPath, path.join(process.env.ARTIFACT_DIR, 'latest_fight_video.webm'));
    } catch (e) {}
  }

  // Save metadata
  const metaPath = path.join(OUTPUT_DIR, 'latest_match.json');
  const matchPayload = {
    ...matchData,
    videoFile: rawWebmPath,
    timestamp: new Date().toISOString()
  };

  // Attempt FFmpeg conversion to 9:16 Vertical MP4 (1080x1920) for Facebook Reels / Shorts / TikTok
  try {
    const ffmpegCheck = await execAsync('ffmpeg -version');
    if (ffmpegCheck.stdout) {
      console.log('[FFmpeg] Found FFmpeg! Transcoding WebM to 9:16 (1080x1920) H.264/AAC MP4 for FB Reels...');
      // 9:16 Vertical Video:
      // Background: Scaled to fill 1080x1920 and blurred (boxblur)
      // Foreground: Scaled to 1080px wide (1080x608, aspect ratio maintained) and centered vertically
      const verticalFilter = `"[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=25:5[bg];[0:v]scale=1080:608[fg];[bg][fg]overlay=0:(H-h)/2"`;
      const transcodeCmd = `ffmpeg -y -i "${rawWebmPath}" -vf ${verticalFilter} -c:v libx264 -preset fast -crf 22 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart "${finalMp4Path}"`;
      await execAsync(transcodeCmd);
      console.log(`[FFmpeg] 9:16 Vertical Transcoding complete: ${finalMp4Path} (${fs.statSync(finalMp4Path).size} bytes)`);
      matchPayload.videoFile = finalMp4Path;

      // Optionally copy to artifacts directory if env is set
      if (process.env.ARTIFACT_DIR && fs.existsSync(process.env.ARTIFACT_DIR)) {
        try {
          fs.copyFileSync(finalMp4Path, path.join(process.env.ARTIFACT_DIR, 'latest_fight_video.mp4'));
        } catch (e) {}
      }
    }
  } catch (err) {
    console.log('[FFmpeg] FFmpeg not found or transcode skipped. Using raw WebM format:', err.message);
  }

  fs.writeFileSync(metaPath, JSON.stringify(matchPayload, null, 2));
  console.log(`[Recorder] Match metadata saved to: ${metaPath}`);
  console.log('=== Video Pipeline Finished Successfully! ===');
}

runRecorder().catch(err => {
  console.error('[Recorder Error]', err);
  process.exit(1);
});
