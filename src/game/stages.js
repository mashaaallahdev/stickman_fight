// Pixel-Art Stage Manager with Direct 16-Bit Background Artwork & CRT Bezel
// Uses the authentic background artwork matching the reference images.

export class StageManager {
  constructor() {
    this.stages = ['ALLEY', 'CAGE', 'HARBOR', 'SUBWAY', 'FOUNDRY', 'ROOFTOP'];
    const urlParams = typeof window !== 'undefined' && window.location ? new URLSearchParams(window.location.search) : null;
    const stageParam = urlParams && urlParams.get('stage') ? urlParams.get('stage').toUpperCase() : null;
    const initialStage = (stageParam && stageParam !== 'RANDOM' && this.stages.includes(stageParam))
      ? stageParam
      : this.stages[Math.floor(Math.random() * this.stages.length)];
    this.currentStageKey = initialStage;
    this.stageData = null;
    this.time = 0;
    this.floorY = 535;
    this.bounds = { minX: 130, maxX: 1150 };
    this.decals = [];

    // Preload pixel-art background assets
    this.images = {
      ALLEY: new Image(),
      CAGE: new Image(),
      HARBOR: new Image(),
      SUBWAY: new Image(),
      FOUNDRY: new Image(),
      ROOFTOP: new Image()
    };
    this.images.ALLEY.src = '/public/assets/stage_alley.jpg';
    this.images.CAGE.src = '/public/assets/stage_cage.jpg';
    this.images.HARBOR.src = '/public/assets/stage_harbor.jpg';
    this.images.SUBWAY.src = '/public/assets/stage_subway.jpg';
    this.images.FOUNDRY.src = '/public/assets/stage_foundry.jpg';
    this.images.ROOFTOP.src = '/public/assets/stage_rooftop.jpg';

    this.selectRandomStage(this.currentStageKey);
  }

  selectRandomStage(key = null) {
    this.currentStageKey = key || this.stages[Math.floor(Math.random() * this.stages.length)];
    this.decals = [];
    this._initStage();
  }

  _initStage() {
    const stageMap = {
      ALLEY: { name: 'DOWNTOWN ALLEY', themeColor: '#ff2d55' },
      CAGE: { name: 'THE UNDERGROUND CAGE', themeColor: '#ff9500' },
      HARBOR: { name: 'OCEAN CARGO HARBOR', themeColor: '#00b0ff' },
      SUBWAY: { name: 'SUBWAY TRACK 4', themeColor: '#ffd60a' },
      FOUNDRY: { name: 'MOLTEN STEEL FOUNDRY', themeColor: '#ff3b30' },
      ROOFTOP: { name: 'SKYLINE ROOFTOP HELIPAD', themeColor: '#af52de' }
    };
    this.stageData = stageMap[this.currentStageKey] || stageMap.ALLEY;
  }

  addDecal(x, y, type = 'blood', color = '#e0113a') {
    if (this.decals.length > 50) this.decals.shift();
    this.decals.push({
      x,
      y: Math.min(y, this.floorY),
      type,
      color,
      radius: 4 + Math.random() * 10
    });
  }

  update(dt) {
    this.time += dt;
  }

  renderBackground(ctx) {
    const W = 1280;
    const H = 720;
    const currentImg = this.images[this.currentStageKey];

    ctx.save();

    // 1. Render Authentic 16-bit Pixel-Art Background Artwork
    if (currentImg && currentImg.complete && currentImg.naturalWidth > 0) {
      ctx.drawImage(currentImg, 0, 0, W, H);
    } else {
      // Fallback dark color while image initializes
      ctx.fillStyle = this.currentStageKey === 'ALLEY' ? '#100e18' : '#0c0f12';
      ctx.fillRect(0, 0, W, H);
    }

    // 2. Render Floor Blood Decals
    this.decals.forEach(d => {
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.ellipse(d.x, d.y, d.radius * 1.6, d.radius * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  }

  renderForeground(ctx) {
    // Stage-specific foreground highlights if needed
  }
}
