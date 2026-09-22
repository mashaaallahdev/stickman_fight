# 🥊 Retro Stickman Auto-Brawler & Automated Video Pipeline

An automated 60 FPS retro stickman fighting simulation and headless video generation pipeline designed for **Facebook Reels**, **YouTube Shorts**, and **TikTok** in **9:16 Rotated Landscape** format (viewers tilt phone sideways for full-screen combat).

---

## ⚡ Core Features

- **9:16 Rotated Landscape Video (1080x1920)**: Full-resolution arcade battle rotated 90° into vertical 9:16 mobile feeds so tilting the phone sideways displays the full 16:9 brawl across the entire mobile screen without blur bars or shrinking.
- **Kinematic Stickmen Physics**: Procedural joint skeleton (head, neck, spine, hips, knees, elbows, hands, feet) featuring legendary martial arts animations (jabs, body crosses, flying dropkicks, roundhouses, dragon punches).
- **Combat State-Machine AI**: Autonomous brawlers with spacing, dynamic combo strings, reactive blocking, parries, backdashes, and dramatic super moves.
- **Procedural Web Audio Engine**: Zero-asset procedural permissible sound generator: high-impact crunches, metallic block clangs, announcer speech chirps, and driving traditional acoustic Duff rhythm.
- **Dynamic Stages & Spectators**: 4 retro arcade environments (*The Alley*, *The Cage*, *Rooftop Helipad*, *Subway Platform*) with animated cheering crowds and reactive comic speech bubbles.
- **Cinematic Camera**: Dynamic zoom tracking, impact freeze frames (hit-pause), camera trauma screenshake, and slow-motion K.O. finishes.
- **Headless Chromium Recorder**: Puppeteer launches headless browser, records canvas + synthesized audio into high-bitrate 9:16 Rotated Landscape MP4.
- **Telegram Bot Dispatcher**: Automatically posts the generated video to a Telegram channel or chat with randomized viral captions, match statistics, and hashtags.
- **GitHub Actions Automation**: Runs on a cron schedule 2x daily (`08:00`, `20:00` UTC) to publish fresh daily combat videos.

---

## 📂 Project Structure

```text
├── .github/
│   └── workflows/
│       └── generate_reel.yml    # Cron runner (3x daily: 08:00, 14:00, 20:00 UTC)
├── public/
│   ├── assets/                  # 8-bit audio clips, retro sound FX
│   └── index.html               # Canvas host with viewport locked to 1080x1920
├── src/
│   ├── game/
│   │   ├── engine.js            # Game loop, state coordinator, match clock
│   │   ├── fighters.js          # Kinematic stickmen classes (Red vs. Blue vs. White)
│   │   ├── ai.js                # State-machine combat AI (combos, blocks, dodges)
│   │   ├── stages.js            # Multi-stage themes (Alley, Cage, Helipad, Subway)
│   │   ├── spectators.js        # Background cheering crowd + dynamic speech bubbles
│   │   └── audio.js             # Web Audio sound generator for retro hits/announcements
│   └── recorder/
│       └── capture.js           # MediaRecorder stream buffer logic
├── scripts/
│   ├── serve.js                 # Lightweight dev static file server
│   ├── run_recorder.js          # Headless Puppeteer script to execute & dump raw video
│   └── send_telegram.js         # Telegram Bot API client + random caption/hashtag engine
├── package.json
├── PROJECT_RULES.md
└── README.md
```

---

## 🚀 Quick Start & Local Preview

### 1. Install Dependencies
```bash
npm install
```

### 2. Launch Local Game Preview
```bash
npm start
```
Open **[http://localhost:8080](http://localhost:8080)** in your browser to watch autonomous stickman brawls in real time, trigger manual rematches, change stages, or download manual screen recordings!

---

## 🎥 Running the Headless Video Recorder

To run a headless simulation and export a 9:16 Rotated Landscape (1080x1920) MP4 video to `output/`:

```bash
npm run record
```

To test that Puppeteer launches and connects without waiting for a full match:
```bash
node scripts/run_recorder.js --dry-run
```

---

## 📲 Telegram Bot Setup

1. Message [@BotFather](https://t.me/BotFather) on Telegram to create a bot and copy your `TELEGRAM_BOT_TOKEN`.
2. Add the bot as an administrator to your target Telegram channel or group.
3. Get the `TELEGRAM_CHAT_ID` (e.g. `@your_channel` or `-100xxxxxxxxxx`).
4. Create a `.env` file locally:
   ```env
   TELEGRAM_BOT_TOKEN=123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ
   TELEGRAM_CHAT_ID=-1001234567890
   ```
5. Dispatch the latest recorded match:
   ```bash
   npm run dispatch
   ```

---

## ⚙️ GitHub Actions Automation Setup

### 1. Configure Repository Secrets
In your GitHub repository, navigate to **Settings > Secrets and variables > Actions > New repository secret** and add:
- `TELEGRAM_BOT_TOKEN`: `<YOUR_TELEGRAM_BOT_TOKEN>`
- `TELEGRAM_CHAT_ID`: `<YOUR_TELEGRAM_CHAT_ID>`

### 2. Automatic 2x Daily Dispatch
The workflow in `.github/workflows/generate_reel.yml` automatically triggers **2x daily** (at `08:00 UTC` and `20:00 UTC`), simulates a 3-round tournament, converts the footage to **9:16 Rotated Landscape MP4 (1080x1920)** with Halal Duff audio, and sends it directly to your Telegram chat.

### 3. Manual Generation Anytime via GitHub Actions
You can trigger a custom match on-demand anytime from the GitHub website:
1. Go to the **Actions** tab in your GitHub repository.
2. Select **Automated Stickman 9:16 Rotated Landscape Video Pipeline** on the left menu.
3. Click **Run workflow**.
4. Choose your custom options from the interactive dropdowns:
   - **Player 1 Fighter**: `BILLY`, `JIMMY`, `ABOBO`, `CHIN`, `WILLIAMS`, `PHANTOM`, `JEFF`, `ROPER`, `LINDA`, `WILLY`, `LOPAR`, or `RANDOM`.
   - **Player 2 Fighter**: Any roster brawler or `RANDOM`.
   - **Fight Stage Arena**: `ALLEY`, `CAGE`, `HARBOR`, `SUBWAY`, `FOUNDRY`, `ROOFTOP`, or `RANDOM`.
5. Click the green **Run workflow** button. Within ~2-3 minutes, the 9:16 Rotated Landscape MP4 match will be delivered straight to your Telegram!

### 4. Pushing to GitHub
```bash
git init
git add .
git commit -m "feat: 9:16 rotated landscape MP4 pipeline with 2x daily telegram dispatch"
git branch -M main
git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPOSITORY>.git
git push -u origin main
```
