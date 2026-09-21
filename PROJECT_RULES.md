# ANTIGRAVITY ENGINE SPECIFICATION & ARCHITECTURE RULES

## Project Identity

- **Name:** Retro Stickman Auto-Brawler & Video Pipeline
- **Target Audience:** Automated short-form video generation (Facebook Reels, TikTok, YouTube Shorts).
- **Core Loop:** Headless simulation -> Auto combat AI -> Screen record -> FFmpeg transcode -> Telegram Bot dispatch (Scheduled 3x/day via GitHub Actions).

---

## 1. Directory Structure & File Map

When generating or modifying files in this workspace, strictly conform to this file layout:

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
│   ├── run_recorder.js          # Headless Puppeteer script to execute & dump raw video
│   └── send_telegram.js         # Telegram Bot API client + random caption/hashtag engine
├── package.json
└── README.md
```
