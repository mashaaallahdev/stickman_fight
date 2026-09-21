// Telegram Bot API Dispatcher with Viral Caption & Hashtag Engine
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'output');
const META_FILE = path.join(OUTPUT_DIR, 'latest_match.json');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Viral caption templates
function generateCaption(meta) {
  const hooks = [
    '💥 INSANE KNOCKOUT in the stickman arena!',
    '🥊 Pure 90s martial arts nostalgia in 60 FPS!',
    '🔥 Unbelievable comeback finish! Who saw that coming?!',
    '⚡ When stickmen clash, only one walks out alive.',
    '🩸 Brutal showdown in the underground fight club!'
  ];

  const callToActions = [
    '💬 Who takes the rematch? Drop your predictions below! 👇',
    '🔥 Rate this K.O. from 1 to 10 in the comments!',
    '💀 Drop a 🥊 if you remember Xiao Xiao stick fights!',
    '🏆 Follow for 3x daily automated stickman brawls!'
  ];

  const hashtags = [
    '#stickman', '#stickfight', '#brawler', '#retrogaming',
    '#martialarts', '#animation', '#shorts', '#reels',
    '#tiktok', '#action', '#gaming', '#combat'
  ];

  // Pick random hook and cta
  const hook = hooks[Math.floor(Math.random() * hooks.length)];
  const cta = callToActions[Math.floor(Math.random() * callToActions.length)];

  // Shuffle hashtags
  const shuffledTags = hashtags.sort(() => 0.5 - Math.random()).slice(0, 7).join(' ');

  const winnerIcon = meta.winner === 'BLAZE' ? '🔴' : (meta.winner === 'FROST' ? '🔵' : '⚪');
  const durationSec = Math.round(meta.duration || 15);

  return `${hook}\n\n` +
    `🏟️ Arena: ${meta.stageName || 'UNDERGROUND CAGE'}\n` +
    `🏆 Winner: ${winnerIcon} ${meta.winner || 'CHAMPION'}\n` +
    `⚡ Max Combo: ${meta.maxCombo || 3} Hits\n` +
    `⏱️ Match Time: ${durationSec}s\n\n` +
    `${cta}\n\n` +
    `${shuffledTags}`;
}

async function sendTelegramVideo() {
  console.log('=== [Telegram Dispatcher] Starting ===');

  if (!fs.existsSync(META_FILE)) {
    console.warn(`[Telegram] No match metadata found at ${META_FILE}. Run recorder first.`);
    return;
  }

  const meta = JSON.parse(fs.readFileSync(META_FILE, 'utf8'));
  const videoPath = meta.videoFile;

  if (!videoPath || !fs.existsSync(videoPath)) {
    console.warn(`[Telegram] Video file not found: ${videoPath}`);
    return;
  }

  const caption = generateCaption(meta);
  console.log('\n--- Generated Caption ---');
  console.log(caption);
  console.log('-------------------------\n');

  if (!BOT_TOKEN || !CHAT_ID) {
    console.log('[Telegram] Notice: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured.');
    console.log('[Telegram] Skipping API upload. (Configure in .env or GitHub Secrets for live dispatch)');
    return;
  }

  console.log(`[Telegram] Uploading ${videoPath} (${(fs.statSync(videoPath).size / (1024 * 1024)).toFixed(2)} MB) to chat ${CHAT_ID}...`);

  const https = await import('https');
  const fileBuffer = fs.readFileSync(videoPath);
  const fileName = path.basename(videoPath);
  const mimeType = fileName.endsWith('.mp4') ? 'video/mp4' : 'video/webm';

  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);

  const headerParts = [
    `--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${CHAT_ID}\r\n`,
    `--${boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\n${caption}\r\n`,
    `--${boundary}\r\nContent-Disposition: form-data; name="supports_streaming"\r\n\r\ntrue\r\n`,
    `--${boundary}\r\nContent-Disposition: form-data; name="video"; filename="${fileName}"\r\nContent-Type: ${mimeType}\r\n\r\n`
  ].join('');

  const footer = `\r\n--${boundary}--\r\n`;

  const headerBuffer = Buffer.from(headerParts, 'utf8');
  const footerBuffer = Buffer.from(footer, 'utf8');
  const totalLength = headerBuffer.length + fileBuffer.length + footerBuffer.length;

  console.log(`[Telegram] Payload size: ${(totalLength / (1024 * 1024)).toFixed(2)} MB. Streaming to Telegram...`);

  await new Promise((resolve, reject) => {
    const req = https.default.request({
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${BOT_TOKEN}/sendVideo`,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': totalLength,
        'Connection': 'keep-alive'
      },
      timeout: 120000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.ok) {
            console.log(`[Telegram] Successfully sent video! Message ID: ${result.result.message_id}`);
            resolve(result);
          } else {
            console.error('[Telegram API Error]', result);
            reject(new Error(result.description || 'Upload failed'));
          }
        } catch (err) {
          console.error('[Telegram Response Parse Error]', data);
          reject(err);
        }
      });
    });

    req.on('error', (err) => {
      console.error('[Telegram Request Error]', err);
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Telegram request timed out'));
    });

    // Write multipart payload
    req.write(headerBuffer);
    req.write(fileBuffer);
    req.write(footerBuffer);
    req.end();
  });
}

sendTelegramVideo().catch(err => {
  console.error('[Telegram Dispatcher Error]', err);
  process.exit(1);
});
