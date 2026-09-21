// Cheering Spectator Crowd & Comic Speech Bubbles (1280x720 16:9 Arcade)
// Features thick outlined stickmen standing behind the cage/sidewalk with pixel chant bubbles.

export class SpectatorCrowd {
  constructor(floorY = 560) {
    this.floorY = floorY;
    this.spectators = [];
    this.bubbles = [];
    this.flashes = [];
    this.time = 0;
    this.cheerExcitement = 1.0;

    this._initCrowd();
  }

  _initCrowd() {
    this.spectators = [];
    // Colors matching Image 2: White, Blue, Red
    const colors = ['#ffffff', '#00d2ff', '#ff2d55', '#ffffff', '#ff2d55', '#00d2ff'];

    // Crowd placed across the background fence / sidewalk
    const positions = [
      120, 180, 240, 420, 680, 840, 960, 1040, 1140
    ];

    positions.forEach((x, i) => {
      this.spectators.push({
        x: x + (Math.random() - 0.5) * 20,
        baseY: this.floorY - 6 + (Math.random() - 0.5) * 12,
        height: 105 + Math.random() * 15,
        speed: 3.5 + Math.random() * 2,
        phase: Math.random() * Math.PI * 2,
        color: colors[i % colors.length],
        headRadius: 12
      });
    });
  }

  onHit(intensity = 'light', attackerName = '', defenderName = '') {
    this.cheerExcitement = Math.min(3.5, this.cheerExcitement + (intensity === 'heavy' ? 1.0 : 0.4));

    if (intensity === 'heavy' || Math.random() < 0.35) {
      const s = this.spectators[Math.floor(Math.random() * this.spectators.length)];
      this.flashes.push({
        x: s.x,
        y: s.baseY - s.height,
        radius: 65 + Math.random() * 50,
        alpha: 0.95
      });
    }

    // Dynamic chants using actual fighter names
    const a = attackerName ? attackerName.toUpperCase() : 'FIGHTER';
    const d = defenderName ? defenderName.toUpperCase() : 'HIM';

    const chants = {
      light: [
        'FIGHT!\nFIGHT!\nFIGHT!',
        'GET EM!',
        `GO\n${a}!`,
        'NICE JAB!',
        'YES!'
      ],
      heavy: [
        `${a}\nCRUSH\n${d}!`,
        `DESTROY\n${d}!`,
        'BRUTAL\nHIT!',
        'CRITICAL!',
        `FINISH\n${d}!`
      ],
      block: [
        'DENIED!',
        'NICE\nGUARD!',
        `BLOCK\nIT\n${d}!`
      ],
      ko: [
        'KNOCKOUT!',
        'HE IS\nOUT COLD!',
        `${a}\nWINS!`
      ]
    };

    const list = chants[intensity] || chants.light;
    const text = list[Math.floor(Math.random() * list.length)];
    const s = this.spectators[Math.floor(Math.random() * this.spectators.length)];
    this.spawnBubble(s.x, s.baseY - s.height - 35, text);
  }

  spawnBubble(x, y, text) {
    if (this.bubbles.length > 3) this.bubbles.shift();
    this.bubbles.push({
      x: Math.max(100, Math.min(1180, x)),
      y,
      text,
      lines: text.split('\n'),
      alpha: 1.0,
      vy: -0.5,
      life: 2.2
    });
  }

  initStageBubbles(stageKey = 'CAGE', p1Name = 'RED', p2Name = 'BLUE') {
    const p1 = p1Name.toUpperCase();
    const p2 = p2Name.toUpperCase();

    const bubbleConfigs = {
      CAGE: [
        { x: 280, y: 260, text: 'FIGHT!\nFIGHT!\nFIGHT!' },
        { x: 640, y: 260, text: `${p1}\nVS\n${p2}!` },
        { x: 920, y: 260, text: 'KNOCKOUT!' }
      ],
      HARBOR: [
        { x: 240, y: 260, text: `GO\n${p1}!` },
        { x: 960, y: 260, text: 'DOWN HE\nGOES!' }
      ],
      SUBWAY: [
        { x: 240, y: 260, text: `${p2}\nINTO THE\nTRACKS!` },
        { x: 960, y: 260, text: `HIT EM\n${p1}!` }
      ],
      FOUNDRY: [
        { x: 240, y: 260, text: `BURN\n${p2}!` },
        { x: 960, y: 260, text: `${p1}\nON FIRE!` }
      ],
      ROOFTOP: [
        { x: 220, y: 260, text: `THROW\n${p2} OFF!` },
        { x: 640, y: 260, text: 'FIGHT!\nFIGHT!' },
        { x: 960, y: 260, text: `GO\n${p1}!` }
      ]
    };

    const cfg = bubbleConfigs[stageKey] || [
      { x: 300, y: 260, text: `GO ${p1}!` },
      { x: 900, y: 260, text: `GO ${p2}!` }
    ];
    this.bubbles = cfg.map(b => ({
      x: b.x,
      y: b.y,
      text: b.text,
      lines: b.text.split('\n'),
      alpha: 1.0,
      vy: -0.08,
      life: 15.0
    }));
  }


  update(dt) {
    this.time += dt;

    if (this.cheerExcitement > 1.0) {
      this.cheerExcitement -= dt * 0.5;
    }

    this.flashes.forEach(f => {
      f.alpha -= dt * 4.0;
    });
    this.flashes = this.flashes.filter(f => f.alpha > 0);

    this.bubbles.forEach(b => {
      b.y += b.vy;
      b.life -= dt;
      if (b.life < 0.4) b.alpha = b.life / 0.4;
    });
    this.bubbles = this.bubbles.filter(b => b.life > 0);
  }

  render(ctx, stageKey = 'CAGE') {
    // Alley stage is a quiet street with no crowd (matches reference image 1)
    if (stageKey === 'ALLEY') return;

    ctx.save();

    // Render Crowd Spectators behind railing/fence
    this.spectators.forEach(s => {
      const bounce = Math.sin(this.time * s.speed * this.cheerExcitement + s.phase) * (6 * this.cheerExcitement);
      const headY = s.baseY - s.height + bounce;
      const hipY = s.baseY - s.height * 0.45;
      const shoulderY = headY + s.headRadius + 8;
      const armWave = Math.sin(this.time * 8 + s.phase) * 14;

      const drawStickman = (strokeColor, lineWidth) => {
        ctx.save();
        ctx.strokeStyle = strokeColor;
        ctx.fillStyle = strokeColor;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Head
        ctx.beginPath();
        ctx.arc(s.x, headY, s.headRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Spine
        ctx.beginPath();
        ctx.moveTo(s.x, headY + s.headRadius);
        ctx.lineTo(s.x, hipY);
        ctx.stroke();

        // Legs
        ctx.beginPath();
        ctx.moveTo(s.x, hipY);
        ctx.lineTo(s.x - 14, s.baseY);
        ctx.moveTo(s.x, hipY);
        ctx.lineTo(s.x + 14, s.baseY);
        ctx.stroke();

        // Cheering Arms raised up
        ctx.beginPath();
        ctx.moveTo(s.x, shoulderY);
        ctx.lineTo(s.x - 22, shoulderY - 28 + armWave);
        ctx.moveTo(s.x, shoulderY);
        ctx.lineTo(s.x + 22, shoulderY - 28 - armWave);
        ctx.stroke();

        ctx.restore();
      };

      // Outer outline
      drawStickman('#050508', 12);
      // Inner fill
      drawStickman(s.color, 6);
    });

    // Camera Flashes
    this.flashes.forEach(f => {
      const g = ctx.createRadialGradient(f.x, f.y, 2, f.x, f.y, f.radius);
      g.addColorStop(0, `rgba(255, 255, 255, ${f.alpha})`);
      g.addColorStop(0.3, `rgba(200, 240, 255, ${f.alpha * 0.7})`);
      g.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    // Multi-line Pixel Speech Bubbles (Matches Reference Image 2!)
    this.bubbles.forEach(b => {
      ctx.save();
      ctx.globalAlpha = b.alpha;
      ctx.font = '900 13px "Press Start 2P", monospace';

      let maxLineW = 0;
      b.lines.forEach(l => {
        const w = ctx.measureText(l).width;
        if (w > maxLineW) maxLineW = w;
      });

      const padX = 14;
      const padY = 12;
      const lineHeight = 18;
      const boxW = maxLineW + padX * 2;
      const boxH = b.lines.length * lineHeight + padY * 2;
      const boxX = b.x - boxW / 2;
      const boxY = b.y - boxH;

      // White box with black border
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(boxX, boxY, boxW, boxH);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3.5;
      ctx.strokeRect(boxX, boxY, boxW, boxH);

      // Downward pointer tail
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(b.x - 6, boxY + boxH);
      ctx.lineTo(b.x, boxY + boxH + 9);
      ctx.lineTo(b.x + 6, boxY + boxH);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Text lines
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      b.lines.forEach((l, idx) => {
        ctx.fillText(l, b.x, boxY + padY + idx * lineHeight);
      });

      ctx.restore();
    });

    ctx.restore();
  }
}
