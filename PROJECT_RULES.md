# ANTIGRAVITY ENGINE SPECIFICATION & ARCHITECTURE RULES

## Project Identity

- **Name:** Retro Stickman Auto-Brawler & Video Pipeline
- **Target Audience:** Automated 16:9 Landscape Full HD video generation (YouTube, Facebook, X/Twitter).
- **Core Loop:** Headless simulation -> Auto combat AI -> Screen record -> FFmpeg transcode (16:9 Full HD MP4) -> Telegram Bot dispatch (Scheduled 2x/day via GitHub Actions).

---

## 1. Directory Structure & File Map

When generating or modifying files in this workspace, strictly conform to this file layout:

```text
├── .github/
│   └── workflows/
│       └── generate_reel.yml    # Cron runner (2x daily: 08:00, 20:00 UTC)
├── public/
│   ├── assets/                  # 8-bit audio clips, retro sound FX
│   └── index.html               # Canvas host with 16:9 arcade widescreen viewport
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
