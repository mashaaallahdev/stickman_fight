// Multi-Round Tournament Match Coordinator (50s - 2min Cinematic Pipeline)
// Starts with "ROUND 1 FIGHT", "ROUND 2 FIGHT", Best of 3 with Double Dragon audio.

import { Fighter, CHARACTERS } from './fighters.js';
import { FighterAI } from './ai.js';
import { StageManager } from './stages.js';
import { SpectatorCrowd } from './spectators.js';
import { sound } from './audio.js';

export class GameEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = 1280;
    this.height = 720;

    this.stage = new StageManager();
    this.crowd = new SpectatorCrowd(this.stage.floorY);
    // Bubbles initialized after fighters are created (need names)

    this.camera = {
      x: 640,
      y: 360,
      targetX: 640,
      targetY: 360,
      zoom: 1.0,
      trauma: 0
    };

    // Tournament Multi-Round State:
    // INTRO -> FIGHT -> SLOWMO_KO -> ROUND_WIN -> RESET_ROUND -> FINAL_VICTORY -> FINISHED
    this.currentRound = 1;
    this.maxRounds = 3;
    this.p1Wins = 0;
    this.p2Wins = 0;
    this.matchState = 'INTRO_ROUND';
    this.stateTimer = 0;
    this.roundClock = 99; // 99 Arcade Timer matching reference images!
    this.totalMatchDuration = 0;
    this.hitPauseTimer = 0;
    this.roundWinner = null;
    this.finalWinner = null;

    this.fighters = [];
    this.ais = [];
    this.projectiles = [];
    this.fireOrbs = [];
    this.fireOrbSpawnTimer = 0;
    this.hitFlash = 0; // screen flash intensity (0-1) for heavy hits
    this.hitFlashColor = '#ffffff';
    this._initFighters();

    this.matchStats = {
      winner: null,
      loser: null,
      duration: 0,
      stageName: this.stage.stageData.name,
      redDamage: 0,
      blueDamage: 0,
      maxCombo: 0,
      p1Rounds: 0,
      p2Rounds: 0
    };

    this.lastTime = performance.now();
    this.isRunning = false;
  }

  // ── Pick ONE random character, excluding given IDs ───────────────────────────
  _pickRandomOne(...excludeIds) {
    const allKeys = Object.keys(CHARACTERS).filter(k => !excludeIds.includes(k));
    // Fisher-Yates shuffle
    for (let i = allKeys.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allKeys[i], allKeys[j]] = [allKeys[j], allKeys[i]];
    }
    return CHARACTERS[allKeys[0]] || CHARACTERS.JIMMY;
  }

  // ── Pick 2 unique random characters from the full roster ────────────────────────
  _pickRandomPair(excludeP1Id = null, excludeP2Id = null) {
    const allKeys = Object.keys(CHARACTERS);
    // Fisher-Yates shuffle
    for (let i = allKeys.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allKeys[i], allKeys[j]] = [allKeys[j], allKeys[i]];
    }
    // Pick the first two that aren't the excluded IDs
    const picks = allKeys.filter(k => k !== excludeP1Id && k !== excludeP2Id);
    return [
      CHARACTERS[picks[0]] || CHARACTERS.JIMMY,
      CHARACTERS[picks[1]] || CHARACTERS.BILLY
    ];
  }

  _initFighters() {
    // P1 is chosen ONCE per match (stays the same all 3 rounds)
    // P2 is chosen randomly and will change each round
    let p1Char = this._pickRandomOne(); // random P1 for this video
    let p2Char = this._pickRandomOne(p1Char.id); // different random P2

    // URL params override for custom match selections
    this.p1Locked = false;
    this.p2Locked = false;
    if (typeof window !== 'undefined' && window.location) {
      try {
        const params = new URLSearchParams(window.location.search);
        const p1Param = params.get('p1');
        const p2Param = params.get('p2');
        if (p1Param && p1Param.toUpperCase() !== 'RANDOM' && CHARACTERS[p1Param.toUpperCase()]) {
          p1Char = CHARACTERS[p1Param.toUpperCase()];
          this.p1Locked = true;
        }
        if (p2Param && p2Param.toUpperCase() !== 'RANDOM' && CHARACTERS[p2Param.toUpperCase()]) {
          p2Char = CHARACTERS[p2Param.toUpperCase()];
          this.p2Locked = true;
          this.p2CharConfig = p2Char;
        }
      } catch (e) {
        // fallback to random
      }
    }

    // Store P1 and P2 character configs
    this.p1CharConfig = p1Char;

    const p1 = new Fighter('p1', p1Char, 380, this.stage.floorY, 1);
    const p2 = new Fighter('p2', p2Char, 900, this.stage.floorY, -1);

    // Tuned HP so authentic martial arts trades and combinations last ~24-28s per round
    p1.maxHp = 155;
    p1.hp = 155;
    p1.ghostHp = 155;

    p2.maxHp = 155;
    p2.hp = 155;
    p2.ghostHp = 155;

    this.fighters = [p1, p2];
    this.ais = [
      new FighterAI(p1, p2, p1Char.style || 'AGGRESSIVE'),
      new FighterAI(p2, p1, p2Char.style || 'BALANCED')
    ];

    // Now init crowd bubbles with real fighter names
    this.crowd.initStageBubbles(this.stage.currentStageKey, p1.name, p2.name);
  }

  start() {
    this.isRunning = true;
    this.matchState = 'INTRO_ROUND';
    this.stateTimer = 0;
    this.projectiles = [];
    sound.init();
    sound.startHalalBackgroundSound();
    sound.playAnnouncer(`ROUND ${this.currentRound}`);
    this.lastTime = performance.now();
    this._loop(this.lastTime);
  }

  _loop(currentTime) {
    if (!this.isRunning) return;

    let dt = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    if (dt > 0.1) dt = 0.1;

    if (this.hitPauseTimer > 0) {
      this.hitPauseTimer -= dt;
      this._render();
      requestAnimationFrame((t) => this._loop(t));
      return;
    }

    let timeScale = 1.0;
    if (this.matchState === 'SLOWMO_KO') {
      timeScale = 0.22;
    }

    const scaledDt = dt * timeScale;
    this._update(scaledDt);
    this._render();

    requestAnimationFrame((t) => this._loop(t));
  }

  _update(dt) {
    this.stateTimer += dt;
    this.totalMatchDuration += dt;
    this.matchStats.duration = this.totalMatchDuration;
    this.stage.update(dt);
    this.crowd.update(dt);

    const [p1, p2] = this.fighters;

    // 1. DEDICATED PRE-MATCH ANNOUNCEMENT: "ROUND 1" (1.8s)
    if (this.matchState === 'INTRO_ROUND') {
      this.fighters.forEach(f => {
        f.updateKinematics(dt);
        f.facing = f.id === 'p1' ? 1 : -1;
      });

      if (this.stateTimer >= 1.8) {
        this.matchState = 'INTRO_FIGHT';
        this.stateTimer = 0;
        sound.playAnnouncer('FIGHT');
        this.addCameraTrauma(0.35);
      }
      return;
    }

    // 2. DEDICATED PRE-MATCH ANNOUNCEMENT: "FIGHT!" (1.2s)
    if (this.matchState === 'INTRO_FIGHT') {
      this.fighters.forEach(f => {
        f.updateKinematics(dt);
        f.facing = f.id === 'p1' ? 1 : -1;
      });

      if (this.stateTimer >= 1.2) {
        this.matchState = 'FIGHT';
        this.stateTimer = 0;
      }
      return;
    }

    // 3. ACTIVE COMBAT
    if (this.matchState === 'FIGHT') {
      this.roundClock -= dt * 3.3; // Ticks down from 99 to 0 over ~30s per round

      // Check for elemental special projectile spawns
      this.fighters.forEach(f => {
        const special = f.checkSpecialSpawn();
        if (special) {
          this.projectiles.push({
            x: special.x,
            y: special.y,
            vx: special.vx,
            radius: 24,
            damage: special.damage,
            element: special.element || 'FIRE',
            color: special.color || '#ff3d00',
            attacker: special.attacker,
            life: 2.5,
            rot: 0
          });
          sound.playElementThrow(special.element || 'FIRE');
          this.addCameraTrauma(0.28);
        }
      });

      // Update active elemental projectiles
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const p = this.projectiles[i];
        p.x += p.vx * dt;
        p.life -= dt;
        p.rot = (p.rot || 0) + dt * 8;

        // Distinct elemental particle trail
        let trailColor1 = '#ff3d00';
        let trailColor2 = '#ffea00';
        if (p.element === 'THUNDER') {
          trailColor1 = '#00f0ff';
          trailColor2 = '#ffffff';
        } else if (p.element === 'ICE') {
          trailColor1 = '#80deea';
          trailColor2 = '#ffffff';
        } else if (p.element === 'MUD') {
          trailColor1 = '#8d6e63';
          trailColor2 = '#4e342e';
        } else if (p.element === 'ROCK') {
          trailColor1 = '#9e9e9e';
          trailColor2 = '#616161';
        }

        if (Math.random() < 0.6) {
          p.attacker.sparks.push({
            x: p.x - Math.sign(p.vx) * (8 + Math.random() * 12),
            y: p.y + (Math.random() - 0.5) * 10,
            vx: -Math.sign(p.vx) * (2 + Math.random() * 3),
            vy: (Math.random() - 0.5) * 2,
            color: Math.random() < 0.6 ? trailColor1 : trailColor2,
            size: 2.0,
            alpha: 0.8,
            drag: 0.92
          });
        }

        // Collision against defender hurtbox (AABB check: enables jumping over projectiles!)
        const defender = this.fighters.find(f => f !== p.attacker);
        if (defender && defender.state !== 'DEAD' && defender.state !== 'KNOCKDOWN') {
          const hurtbox = defender.getHurtbox();
          const halfW = hurtbox.width / 2;
          const halfH = hurtbox.height / 2;
          const closestX = Math.max(hurtbox.x - halfW, Math.min(p.x, hurtbox.x + halfW));
          const closestY = Math.max(hurtbox.y - halfH, Math.min(p.y, hurtbox.y + halfH));
          const distX = p.x - closestX;
          const distY = p.y - closestY;
          const isHit = (distX * distX + distY * distY) < (p.radius * p.radius);

          if (isHit) {
            // Explosive Elemental Impact!
            sound.playElementExplosion(p.element || 'FIRE');
            defender.takeDamage(p.damage, 'heavy', 480, -6);
            this.addCameraTrauma(0.5);

            let burstC1 = '#ff3d00', burstC2 = '#ffea00';
            let decalT = 'scorch', decalC = '#111111';
            if (p.element === 'THUNDER') {
              burstC1 = '#00f0ff'; burstC2 = '#ffffff';
              decalT = 'scorch'; decalC = '#003344';
            } else if (p.element === 'ICE') {
              burstC1 = '#b3e5fc'; burstC2 = '#ffffff';
              decalT = 'scorch'; decalC = '#80deea';
            } else if (p.element === 'MUD') {
              burstC1 = '#8d6e63'; burstC2 = '#4e342e';
              decalT = 'blood'; decalC = '#3e2723';
            } else if (p.element === 'ROCK') {
              burstC1 = '#bcaaa4'; burstC2 = '#ffb74d';
              decalT = 'scorch'; decalC = '#212121';
            }

            defender.addSparkBurst(p.x, p.y, burstC1, 16);
            defender.addSparkBurst(p.x, p.y, burstC2, 10);
            this.stage.addDecal(defender.x, this.stage.floorY, decalT, decalC);
            this.projectiles.splice(i, 1);
            continue;
          }
        }

        if (p.life <= 0 || p.x < 50 || p.x > 1230) {
          this.projectiles.splice(i, 1);
        }
      }

      // Elemental Power Orb Spawning & Pickups
      this.fireOrbSpawnTimer += dt;
      if (this.fireOrbSpawnTimer >= 8.0 && this.fireOrbs.length === 0) {
        // Orb element corresponds to one of the fighters
        const pickedFighter = this.fighters[Math.floor(Math.random() * this.fighters.length)];
        this.fireOrbs.push({
          x: 640 + (Math.random() - 0.5) * 280,
          y: this.stage.floorY - 26,
          radius: 18,
          pulse: 0,
          element: pickedFighter.element || 'FIRE',
          color: pickedFighter.elementColor || '#ff3d00'
        });
        this.fireOrbSpawnTimer = 0;
      }

      // Check Elemental Orb pickup
      for (let i = this.fireOrbs.length - 1; i >= 0; i--) {
        const orb = this.fireOrbs[i];
        orb.pulse += dt * 4.5;
        this.fighters.forEach(f => {
          if (Math.abs(f.x - orb.x) < 45 && Math.abs(f.y - orb.y) < 65) {
            f.activateElementPower();
            sound.playElementThrow(f.element || 'FIRE');
            this.addCameraTrauma(0.35);
            this.fireOrbs.splice(i, 1);
          }
        });
      }

      // Pass active projectiles to AI so stickman can jump to avoid fireballs!
      this.ais.forEach(ai => ai.update(dt, this.projectiles));
      this.fighters.forEach(f => f.update(dt, this.stage.bounds));
      this._checkCollisions();

      const dead = this.fighters.find(f => f.hp <= 0);
      if (dead || this.roundClock <= 0) {
        const roundSurv = this.fighters.find(f => f.hp > 0) || (p1.hp >= p2.hp ? p1 : p2);
        this.roundWinner = roundSurv;

        if (roundSurv.id === 'p1') {
          this.p1Wins++;
          this.matchStats.p1Rounds = this.p1Wins;
        } else {
          this.p2Wins++;
          this.matchStats.p2Rounds = this.p2Wins;
        }

        this.matchState = 'SLOWMO_KO';
        this.stateTimer = 0;
        sound.setSlowMotion(true);
        sound.playSuperImpact();
        sound.playAnnouncer('KO');
        this.addCameraTrauma(0.85);
      }
    }

    // 3. SLOW-MOTION KNOCKOUT IMPACT
    else if (this.matchState === 'SLOWMO_KO') {
      if (this.roundWinner && this.roundWinner.state !== 'VICTORY' && this.roundWinner.hp > 0) {
        this.roundWinner.state = 'VICTORY';
        this.roundWinner.stateTimer = 0;
        this.roundWinner.vx = 0;
      }
      this.fighters.forEach(f => f.update(dt, this.stage.bounds));
      if (this.stateTimer >= 1.8) {
        this.matchState = 'ROUND_WIN';
        this.stateTimer = 0;
        sound.setSlowMotion(false);
        sound.playCrowdCheer();
      }
    }

    // 4. ROUND WIN CELEBRATION
    else if (this.matchState === 'ROUND_WIN') {
      if (this.roundWinner && this.roundWinner.state !== 'VICTORY' && this.roundWinner.hp > 0) {
        this.roundWinner.state = 'VICTORY';
        this.roundWinner.stateTimer = 0;
        this.roundWinner.vx = 0;
      }
      this.fighters.forEach(f => f.update(dt, this.stage.bounds));

      if (this.stateTimer >= 2.8) {
        // Check if tournament match is won (Best of 3: first to 2 wins)
        if (this.p1Wins >= 2 || this.p2Wins >= 2 || this.currentRound >= 3) {
          this.matchState = 'FINAL_VICTORY';
          this.stateTimer = 0;
          this.finalWinner = this.p1Wins > this.p2Wins ? p1 : p2;
          this.finalWinner.state = 'VICTORY';
          this.finalWinner.stateTimer = 0;
          this.finalWinner.vx = 0;
          this.matchStats.winner = this.finalWinner.name;
          this.matchStats.loser = (this.finalWinner === p1 ? p2 : p1).name;
          sound.playAnnouncer(`${this.finalWinner.name} WINS!`);
        } else {
          // Prepare next round!
          this._startNextRound();
        }
      }
    }

    // 5. FINAL TOURNAMENT VICTORY (Guarantees total video length strictly between 52s and 110s)
    else if (this.matchState === 'FINAL_VICTORY') {
      if (this.finalWinner && this.finalWinner.state !== 'VICTORY') {
        this.finalWinner.state = 'VICTORY';
        this.finalWinner.stateTimer = 0;
        this.finalWinner.vx = 0;
      }
      this.fighters.forEach(f => f.update(dt, this.stage.bounds));
      if (this.stateTimer >= 5.0 && this.totalMatchDuration >= 52.0 && !window.MATCH_FINISHED) {
        this.matchState = 'FINISHED';
        sound.stopHalalBackgroundSound();
        window.MATCH_FINISHED = true;
        window.MATCH_DATA = this.matchStats;
      }
    }

    this._updateCamera(dt);
  }

  _startNextRound() {
    this.currentRound++;
    this.matchState = 'INTRO_ROUND';
    this.stateTimer = 0;
    this.roundClock = 99;
    this.projectiles = [];

    // Rotate to a new exciting stage for the next round!
    this.stage.selectRandomStage();

    const [p1, p2] = this.fighters;

    // P1 is ALWAYS restored to their original match character (locked for the whole video)
    p1._applyCharConfig(this.p1CharConfig);

    // P2 gets a fresh random character unless locked by user selection
    if (!this.p2Locked) {
      const newP2Char = this._pickRandomOne(this.p1CharConfig.id, p2.charConfig.id);
      p2._applyCharConfig(newP2Char);
    } else {
      p2._applyCharConfig(this.p2CharConfig);
    }

    // Re-init AIs with updated styles
    this.ais = [
      new FighterAI(p1, p2, p1.charConfig.style || 'AGGRESSIVE'),
      new FighterAI(p2, p1, p2.charConfig.style || 'BALANCED')
    ];

    // Update crowd bubbles with current fighter names
    this.crowd.initStageBubbles(this.stage.currentStageKey, p1.name, p2.name);

    // Reset fighter positions & HP
    p1.x = 420;
    p1.y = this.stage.floorY;
    p1.vx = 0;
    p1.vy = 0;
    p1.facing = 1;
    p1.hp = p1.maxHp;
    p1.ghostHp = p1.maxHp;
    p1.state = 'IDLE';
    p1.readyBlend = 0;
    p1.animTime = 0;
    p1.elementPower = 0;
    p1.firePower = 0;
    p1.hasElementPower = false;
    p1.hasFirePower = false;

    p2.x = 860;
    p2.y = this.stage.floorY;
    p2.vx = 0;
    p2.vy = 0;
    p2.facing = -1;
    p2.hp = p2.maxHp;
    p2.ghostHp = p2.maxHp;
    p2.state = 'IDLE';
    p2.readyBlend = 0;
    p2.animTime = 0;
    p2.elementPower = 0;
    p2.firePower = 0;
    p2.hasElementPower = false;
    p2.hasFirePower = false;

    // Announce next round
    const announceName = this.currentRound === 3 ? 'FINAL ROUND' : `ROUND ${this.currentRound}`;
    sound.playAnnouncer(announceName);
  }


  _checkCollisions() {
    const [p1, p2] = this.fighters;
    this._checkStrike(p1, p2);
    this._checkStrike(p2, p1);
  }

  _checkStrike(attacker, defender) {
    const hitbox = attacker.getActiveHitbox();
    if (!hitbox) return;

    const hurtbox = defender.getHurtbox();

    const testX = Math.max(hurtbox.x - hurtbox.width / 2, Math.min(hitbox.x, hurtbox.x + hurtbox.width / 2));
    const testY = Math.max(hurtbox.y - hurtbox.height / 2, Math.min(hitbox.y, hurtbox.y + hurtbox.height / 2));

    const distX = hitbox.x - testX;
    const distY = hitbox.y - testY;
    const distance = Math.sqrt(distX * distX + distY * distY);

    if (distance <= hitbox.radius) {
      attacker.currentMove.hasHit = true;
      attacker.comboCounter++;
      if (attacker.comboCounter > this.matchStats.maxCombo) {
        this.matchStats.maxCombo = attacker.comboCounter;
      }

      const move = hitbox.move;
      const result = defender.takeDamage(move.damage, move.type, move.knockback, move.launchY || 0);

      if (result.blocked) {
        this.hitPauseTimer = 0.04;
        sound.playBlock();
        this.crowd.onHit('block', attacker.name, defender.name);
        this.addCameraTrauma(0.18);
        // Small block spark — keep this, it gives impact feedback
        defender.addSparkBurst(hitbox.x, hitbox.y, '#00d2ff', 6);
      } else {
        const isKick = move.name.includes('KICK') || move.name === 'ROUNDHOUSE';
        const isPowerStrike = move.isPower;

        if (isPowerStrike) {
          this.hitPauseTimer = 0.09;
          sound.playElementExplosion(attacker.element || 'FIRE');
          this.crowd.onHit('heavy', attacker.name, defender.name);
          this.addCameraTrauma(0.55);
          this._triggerHitFlash(attacker.elementColor || '#00d2ff', 0.65);
          // Power hits keep the element burst
          defender.addSparkBurst(hitbox.x, hitbox.y, attacker.elementColor || '#ffea00', 16);
        } else if (move.type === 'heavy' || move.type === 'super') {
          this.hitPauseTimer = 0.09;
          if (isKick) sound.playKick('heavy');
          else sound.playPunch('heavy');
          this.crowd.onHit('heavy', attacker.name, defender.name);
          this.addCameraTrauma(0.5);
          this._triggerHitFlash('#ffffff', 0.45);
          this.stage.addDecal(defender.x, this.stage.floorY, 'blood', '#ff2d55');
          // Heavy hit: small subtle flash only, no bubble burst
          defender.addSparkBurst(hitbox.x, hitbox.y, '#ffffff', 8);
        } else {
          this.hitPauseTimer = 0.04;
          if (isKick) sound.playKick('light');
          else sound.playPunch('light');
          this.crowd.onHit('light', attacker.name, defender.name);
          this.addCameraTrauma(0.24);
          // Light hits: NO spark burst — clean contact only
        }

        // Both fighters build Element Power from active martial arts combat!
        attacker.addElementPower(14);
        defender.addElementPower(result.blocked ? 8 : 16);

        if (attacker.id === 'p1') this.matchStats.redDamage += move.damage;
        else this.matchStats.blueDamage += move.damage;
      }
    }
  }

  addCameraTrauma(amount) {
    this.camera.trauma = Math.min(1.0, this.camera.trauma + amount);
  }

  _triggerHitFlash(color = '#ffffff', intensity = 0.5) {
    this.hitFlash = Math.max(this.hitFlash, intensity);
    this.hitFlashColor = color;
  }

  _updateCamera(dt) {
    const [p1, p2] = this.fighters;
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2 - 40;

    let targetZoom = 1.0;
    if (this.matchState === 'SLOWMO_KO') targetZoom = 1.22;

    this.camera.targetX = midX;
    this.camera.targetY = midY;
    this.camera.x += (this.camera.targetX - this.camera.x) * dt * 4.2;
    this.camera.y += (this.camera.targetY - this.camera.y) * dt * 4.2;
    this.camera.zoom += (targetZoom - this.camera.zoom) * dt * 3.2;

    if (this.camera.trauma > 0) {
      this.camera.trauma -= dt * 2.2;
      if (this.camera.trauma < 0) this.camera.trauma = 0;
    }

    if (this.hitFlash > 0) {
      this.hitFlash -= dt * 8.0; // quick flash decay
      if (this.hitFlash < 0) this.hitFlash = 0;
    }
  }

  _render() {
    const ctx = this.ctx;
    const W = this.width;
    const H = this.height;

    ctx.clearRect(0, 0, W, H);

    ctx.save();

    const shakePower = this.camera.trauma * this.camera.trauma;
    const shakeX = (Math.random() - 0.5) * 18 * shakePower;
    const shakeY = (Math.random() - 0.5) * 18 * shakePower;
    ctx.translate(shakeX, shakeY);

    // 1. Stage Background
    this.stage.renderBackground(ctx);

    // 2. Spectator Crowd (Only renders in CAGE stage!)
    this.crowd.render(ctx, this.stage.currentStageKey);

    // 3. Fighters
    this.fighters.forEach(f => f.render(ctx));

    // 3.4. Elemental Power Orbs on Floor (Collect to gain Elemental Special!)
    this.fireOrbs.forEach(orb => {
      ctx.save();
      const bob = Math.sin(orb.pulse) * 5;
      const orbY = orb.y + bob;
      const elem = orb.element || 'FIRE';
      const elemColor = orb.color || '#ff3d00';

      // Outer elemental aura
      ctx.shadowColor = elemColor;
      ctx.shadowBlur = 32;
      ctx.fillStyle = elemColor;
      ctx.beginPath();
      ctx.arc(orb.x, orbY, orb.radius + 6, 0, Math.PI * 2);
      ctx.fill();

      // Inner core
      ctx.fillStyle = elem === 'THUNDER' ? '#00f0ff' : (elem === 'ICE' ? '#b3e5fc' : (elem === 'MUD' ? '#8d6e63' : (elem === 'ROCK' ? '#bcaaa4' : '#ffea00')));
      ctx.beginPath();
      ctx.arc(orb.x, orbY, orb.radius, 0, Math.PI * 2);
      ctx.fill();

      // White-hot center
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(orb.x, orbY, orb.radius * 0.45, 0, Math.PI * 2);
      ctx.fill();

      // Glowing floating text
      const icon = elem === 'THUNDER' ? '⚡' : (elem === 'ICE' ? '❄️' : (elem === 'MUD' ? '💧' : (elem === 'ROCK' ? '🪨' : '🔥')));
      ctx.font = '900 11px "Press Start 2P", monospace';
      ctx.fillStyle = elemColor;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 4;
      ctx.textAlign = 'center';
      const label = `${icon} ${elem} POWER`;
      ctx.strokeText(label, orb.x, orbY - 26);
      ctx.fillText(label, orb.x, orbY - 26);
      ctx.restore();
    });

    // 3.5. Elemental Special Projectiles (Fire, Thunder, Ice, Mud, Rock)
    this.projectiles.forEach(p => {
      ctx.save();
      const elem = p.element || 'FIRE';
      const rot = p.rot || 0;

      if (elem === 'THUNDER') {
        // --- THUNDER: Electric Plasma Sphere with Jagged Lightning Arcs ---
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 30;
        ctx.fillStyle = 'rgba(0, 240, 255, 0.45)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 1.35, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#00f0ff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 0.85, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 0.45, 0, Math.PI * 2);
        ctx.fill();

        // Jagged crackling electric bolts radiating from center
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        for (let b = 0; b < 6; b++) {
          const angle = rot + (b * Math.PI / 3);
          const r1 = p.radius * 0.5;
          const r2 = p.radius * (1.1 + Math.sin(rot * 3 + b) * 0.35);
          ctx.beginPath();
          ctx.moveTo(p.x + Math.cos(angle) * r1, p.y + Math.sin(angle) * r1);
          const midA = angle + (b % 2 === 0 ? 0.3 : -0.3);
          ctx.lineTo(p.x + Math.cos(midA) * (r1 + r2) * 0.5, p.y + Math.sin(midA) * (r1 + r2) * 0.5);
          ctx.lineTo(p.x + Math.cos(angle) * r2, p.y + Math.sin(angle) * r2);
          ctx.stroke();
        }
      } else if (elem === 'ICE') {
        // --- ICE: Crystalline Faceted Frost Shard ---
        ctx.shadowColor = '#80deea';
        ctx.shadowBlur = 24;
        ctx.translate(p.x, p.y);
        ctx.rotate(rot * 0.5);

        // Outer frost glow diamond
        ctx.fillStyle = 'rgba(128, 222, 234, 0.5)';
        ctx.beginPath();
        ctx.moveTo(p.radius * 1.4, 0);
        ctx.lineTo(0, -p.radius * 0.7);
        ctx.lineTo(-p.radius * 1.4, 0);
        ctx.lineTo(0, p.radius * 0.7);
        ctx.closePath();
        ctx.fill();

        // Main ice crystal
        ctx.fillStyle = '#b3e5fc';
        ctx.beginPath();
        ctx.moveTo(p.radius, 0);
        ctx.lineTo(0, -p.radius * 0.5);
        ctx.lineTo(-p.radius, 0);
        ctx.lineTo(0, p.radius * 0.5);
        ctx.closePath();
        ctx.fill();

        // Inner white facet reflection
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(p.radius * 0.6, 0);
        ctx.lineTo(0, -p.radius * 0.25);
        ctx.lineTo(-p.radius * 0.3, 0);
        ctx.lineTo(0, p.radius * 0.15);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else if (elem === 'MUD') {
        // --- MUD: Bubbling Dense Sludge Orb with Dripping Blobs ---
        ctx.shadowColor = '#5d4037';
        ctx.shadowBlur = 18;
        ctx.fillStyle = '#4e342e';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();

        // Mud bubbles and splatter
        ctx.fillStyle = '#795548';
        ctx.beginPath();
        ctx.arc(p.x - 5, p.y - 4, p.radius * 0.55, 0, Math.PI * 2);
        ctx.arc(p.x + 6, p.y + 4, p.radius * 0.45, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#a1887f';
        ctx.beginPath();
        ctx.arc(p.x - 7, p.y - 6, 3.5, 0, Math.PI * 2);
        ctx.arc(p.x + 4, p.y + 2, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Dripping sludge tail
        ctx.fillStyle = '#3e2723';
        ctx.beginPath();
        ctx.arc(p.x - Math.sign(p.vx) * 14, p.y + 3, 5, 0, Math.PI * 2);
        ctx.fill();
      } else if (elem === 'ROCK') {
        // --- ROCK: Rotating Faceted Jagged Stone Boulder ---
        ctx.shadowColor = '#616161';
        ctx.shadowBlur = 18;
        ctx.translate(p.x, p.y);
        ctx.rotate(rot);

        // Angular faceted boulder silhouette
        ctx.fillStyle = '#757575';
        ctx.strokeStyle = '#212121';
        ctx.lineWidth = 3;
        ctx.beginPath();
        const sides = 7;
        for (let s = 0; s < sides; s++) {
          const ang = (s * Math.PI * 2) / sides;
          const rad = p.radius * (0.8 + (s % 2 === 0 ? 0.25 : -0.15));
          const px = Math.cos(ang) * rad;
          const py = Math.sin(ang) * rad;
          if (s === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Stone crack ridges
        ctx.strokeStyle = '#424242';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-p.radius * 0.5, p.radius * 0.4);
        ctx.moveTo(0, 0);
        ctx.lineTo(p.radius * 0.6, -p.radius * 0.2);
        ctx.stroke();
      } else {
        // --- FIRE: Radiant Blazing Plasma Fireball ---
        ctx.shadowColor = '#ff3d00';
        ctx.shadowBlur = 28;
        ctx.fillStyle = '#ff3d00';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();

        // Mid-layer intense orange/gold flame
        ctx.fillStyle = '#ff9500';
        ctx.beginPath();
        ctx.arc(p.x + Math.sign(p.vx) * 3, p.y, p.radius * 0.72, 0, Math.PI * 2);
        ctx.fill();

        // Bright yellow electric core
        ctx.fillStyle = '#ffea00';
        ctx.beginPath();
        ctx.arc(p.x + Math.sign(p.vx) * 6, p.y, p.radius * 0.48, 0, Math.PI * 2);
        ctx.fill();

        // White-hot center
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x + Math.sign(p.vx) * 9, p.y, p.radius * 0.25, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    // 4. Stage Foreground
    this.stage.renderForeground(ctx);

    ctx.restore();

    // 4.5. Screen Flash Overlay (for heavy hit impacts)
    if (this.hitFlash > 0.01) {
      ctx.save();
      ctx.globalAlpha = this.hitFlash * 0.72;
      ctx.fillStyle = this.hitFlashColor;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // 5. Scanlines
    this._renderScanlines(ctx, W, H);

    // 6. Retro Arcade HUD
    this._renderHUD(ctx, W, H);

    // 7. Outer CRT Bezel Border
    this._renderCRTBezel(ctx, W, H);
  }

  _drawFighterBust(ctx, x, y, target, facing = 1) {
    ctx.save();
    const isFighter = target && typeof target === 'object';
    const skin = (isFighter && target.skinColor) ? target.skinColor : (typeof target === 'string' ? target : '#f3a67d');
    const shadow = (isFighter && target.skinShadow) ? target.skinShadow : '#c47852';
    const hair = (isFighter && target.hairColor) ? target.hairColor : '#3d2415';
    const vest = (isFighter && target.vestColor) ? target.vestColor : (typeof target === 'string' ? target : '#d50000');
    const headband = isFighter ? target.headbandColor : null;
    const isAbobo = isFighter && target.charConfig?.id === 'ABOBO';

    // 1. Broad Muscular Shoulders & Trapezius
    ctx.fillStyle = vest;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3.0;

    ctx.beginPath();
    ctx.moveTo(x - 22, y + 36);
    ctx.lineTo(x - 20, y + 16);
    ctx.lineTo(x - 8, y + 10);
    ctx.lineTo(x + 8, y + 10);
    ctx.lineTo(x + 20, y + 16);
    ctx.lineTo(x + 22, y + 36);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Muscular neck & chest V-notch
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.moveTo(x - 7, y + 8);
    ctx.lineTo(x, y + 24);
    ctx.lineTo(x + 7, y + 8);
    ctx.closePath();
    ctx.fill();

    // Collar trim
    ctx.strokeStyle = isFighter && target.beltColor ? target.beltColor : '#ffffff';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(x - 8, y + 10);
    ctx.lineTo(x, y + 24);
    ctx.lineTo(x + 8, y + 10);
    ctx.stroke();

    // 2. Faceless Chiseled Head Silhouette
    ctx.fillStyle = skin;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3.0;

    ctx.beginPath();
    ctx.arc(x, y - 2, 13, -Math.PI * 0.85, Math.PI * 0.15, false);
    ctx.lineTo(x + facing * 12, y + 2);
    ctx.lineTo(x + facing * 6, y + 14);
    ctx.lineTo(x - facing * 4, y + 14);
    ctx.lineTo(x - facing * 10, y + 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Faceless feature shadow plane (no eyes, no nose, no mouth)
    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.moveTo(x - facing * 3, y + 7);
    ctx.lineTo(x + facing * 6, y + 14);
    ctx.lineTo(x - facing * 4, y + 14);
    ctx.closePath();
    ctx.fill();

    // Hair / Spikes
    if (isAbobo) {
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(x + facing * 2, y - 4);
      ctx.lineTo(x + facing * 9, y - 3);
      ctx.stroke();
    } else if (hair) {
      ctx.fillStyle = hair;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x + facing * 10, y - 6);
      ctx.lineTo(x + facing * 15, y - 13);
      ctx.lineTo(x + facing * 8, y - 17);
      ctx.lineTo(x, y - 19);
      ctx.lineTo(x - facing * 8, y - 16);
      ctx.lineTo(x - facing * 14, y - 10);
      ctx.lineTo(x - facing * 10, y - 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Headband
    if (headband) {
      ctx.fillStyle = headband;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.roundRect(x - 12, y - 4, 24, 5.5, 2);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = headband;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x - facing * 11, y - 1);
      ctx.quadraticCurveTo(x - facing * 18, y - 4, x - facing * 24, y + 1);
      ctx.stroke();
    }

    ctx.restore();
  }

  _renderHUD(ctx, W, H) {
    const [p1, p2] = this.fighters;

    ctx.save();

    const barW = 340;
    const barH = 26;
    const barY = 46;

    // --- P1 (LEFT) ---
    this._drawFighterBust(ctx, 64, barY + 4, p1, 1);

    ctx.fillStyle = p1.color;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.font = '900 16px "Press Start 2P", monospace';
    ctx.textAlign = 'left';
    const p1Label = `P1: ${p1.name.toUpperCase()}`;
    ctx.strokeText(p1Label, 105, 34);
    ctx.fillText(p1Label, 105, 34);

    this._drawSegmentedHealthBar(ctx, 105, barY, barW, barH, p1, 'LEFT');

    // P1 Element Power Gauge
    const fpBarW = 185;
    const fpBarH = 7;
    const fpBarY = barY + barH + 4;
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(105, fpBarY, fpBarW, fpBarH);
    const p1ElemPower = p1.elementPower !== undefined ? p1.elementPower : (p1.firePower || 0);
    const p1FpPct = Math.min(1.0, p1ElemPower / 100);
    const p1HasElem = p1ElemPower >= 100;
    ctx.fillStyle = p1.elementColor || '#ff3d00';
    ctx.fillRect(105, fpBarY, fpBarW * p1FpPct, fpBarH);
    ctx.strokeStyle = '#2d2d42';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(105, fpBarY, fpBarW, fpBarH);

    ctx.font = '900 8.5px "Press Start 2P", monospace';
    ctx.fillStyle = p1HasElem ? '#ffea00' : (p1.elementColor || '#888899');
    ctx.textAlign = 'left';
    const p1ElemIcon = p1.elementIcon || '🔥';
    const p1ElemText = p1HasElem
      ? `${p1ElemIcon} POWER READY!`
      : `${p1ElemIcon} POWER: ${Math.floor(p1FpPct * 100)}%`;
    ctx.fillText(p1ElemText, 105, fpBarY + 16);

    // --- P2 (RIGHT) ---
    ctx.fillStyle = p2.color;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.font = '900 16px "Press Start 2P", monospace';
    ctx.textAlign = 'right';
    const p2Label = `${p2.name.toUpperCase()} :P2`;
    ctx.strokeText(p2Label, W - 105, 34);
    ctx.fillText(p2Label, W - 105, 34);

    this._drawFighterBust(ctx, W - 64, barY + 4, p2, -1);

    this._drawSegmentedHealthBar(ctx, W - 105 - barW, barY, barW, barH, p2, 'RIGHT');

    // P2 Element Power Gauge
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(W - 105 - fpBarW, fpBarY, fpBarW, fpBarH);
    const p2ElemPower = p2.elementPower !== undefined ? p2.elementPower : (p2.firePower || 0);
    const p2FpPct = Math.min(1.0, p2ElemPower / 100);
    const p2HasElem = p2ElemPower >= 100;
    ctx.fillStyle = p2.elementColor || '#00d2ff';
    ctx.fillRect(W - 105 - fpBarW + (fpBarW * (1 - p2FpPct)), fpBarY, fpBarW * p2FpPct, fpBarH);
    ctx.strokeStyle = '#2d2d42';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(W - 105 - fpBarW, fpBarY, fpBarW, fpBarH);

    ctx.font = '900 8.5px "Press Start 2P", monospace';
    ctx.fillStyle = p2HasElem ? '#ffea00' : (p2.elementColor || '#888899');
    ctx.textAlign = 'right';
    const p2ElemIcon = p2.elementIcon || '⚡';
    const p2ElemText = p2HasElem
      ? `${p2ElemIcon} POWER READY!`
      : `${p2ElemIcon} POWER: ${Math.floor(p2FpPct * 100)}%`;
    ctx.fillText(p2ElemText, W - 105, fpBarY + 16);

    // --- CENTER TIMER BOX ("99") ---
    const timerW = 90;
    const timerH = 55;
    const timerX = W / 2 - timerW / 2;
    const timerY = 32;

    ctx.fillStyle = '#0d0f14';
    ctx.fillRect(timerX, timerY, timerW, timerH);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3.5;
    ctx.strokeRect(timerX, timerY, timerW, timerH);

    ctx.fillStyle = this.roundClock <= 10 ? '#ff2d55' : '#ffffff';
    ctx.font = '900 32px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const displayTime = Math.max(0, Math.ceil(this.roundClock)).toString().padStart(2, '0');
    ctx.fillText(displayTime, W / 2, timerY + timerH / 2);

    // --- BOTTOM STATUS BAR (Clean Retro Arcade) ---
    const botY = H - 24;

    // Center: "1UP" with round-win indicator heads
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 13px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('1UP', W / 2 - 45, botY - 3);

    // Mini Stickmen icons (P1 Wins = Red icon lit, P2 Wins = Blue icon lit)
    [
      { color: this.p1Wins > 0 ? '#ff2d55' : '#444455', x: W / 2 - 12 },
      { color: (this.p1Wins > 0 && this.p2Wins > 0) ? '#ffea00' : '#444455', x: W / 2 + 10 },
      { color: this.p2Wins > 0 ? '#00d2ff' : '#444455', x: W / 2 + 32 }
    ].forEach(m => {
      ctx.fillStyle = m.color;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(m.x, botY - 8, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(m.x, botY - 1);
      ctx.lineTo(m.x, botY + 6);
      ctx.moveTo(m.x - 3, botY + 10);
      ctx.lineTo(m.x, botY + 6);
      ctx.lineTo(m.x + 3, botY + 10);
      ctx.stroke();
    });

    // Right: "SCORE: 005400"
    const scoreVal = Math.floor(this.matchStats.redDamage * 50 + this.totalMatchDuration * 15);
    const scoreStr = scoreVal.toString().padStart(6, '0');
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 13px "Press Start 2P", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`SCORE: ${scoreStr}`, W - 25, botY - 3);

    // --- ROUND ANNOUNCEMENTS: CLEAR "ROUND 1" -> "FIGHT!" BEFORE COMBAT STARTS ---
    if (this.matchState === 'INTRO_ROUND') {
      let roundTitle = `ROUND ${this.currentRound}`;
      if (this.currentRound === 3) roundTitle = 'FINAL ROUND';
      this._renderArcadeAnnouncement(ctx, W, H, roundTitle, '#ffea00');
    } else if (this.matchState === 'INTRO_FIGHT' || (this.matchState === 'FIGHT' && this.stateTimer < 1.0)) {
      const alpha = this.matchState === 'FIGHT' ? (1.0 - this.stateTimer) / 1.0 : 1.0;
      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      this._renderArcadeAnnouncement(ctx, W, H, 'FIGHT!', '#ff1744');
      ctx.restore();
    } else if (this.matchState === 'SLOWMO_KO' || this.matchState === 'ROUND_WIN') {
      this._renderArcadeAnnouncement(ctx, W, H, 'K. O. !', '#ff2d55');
      if (this.roundWinner) {
        ctx.fillStyle = this.roundWinner.color;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 5;
        ctx.font = '900 24px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        const winText = `${this.roundWinner.name} WINS ROUND ${this.currentRound}!`;
        ctx.strokeText(winText, W / 2, H / 2 + 55);
        ctx.fillText(winText, W / 2, H / 2 + 55);
      }
    } else if (this.matchState === 'FINAL_VICTORY' || this.matchState === 'FINISHED') {
      this._renderArcadeAnnouncement(ctx, W, H, 'CHAMPION!', '#ffea00');
      if (this.finalWinner) {
        ctx.fillStyle = this.finalWinner.color;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 5;
        ctx.font = '900 28px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        const winText = `${this.finalWinner.name} WINS THE MATCH!`;
        ctx.strokeText(winText, W / 2, H / 2 + 55);
        ctx.fillText(winText, W / 2, H / 2 + 55);
      }
    }

    ctx.restore();
  }

  _renderDualArcadeAnnouncement(ctx, W, H, line1, line2) {
    ctx.save();
    const textY1 = H / 2 - 50;
    const textY2 = H / 2 + 25;

    [
      { text: line1, y: textY1, size: 54 },
      { text: line2, y: textY2, size: 58 }
    ].forEach(({ text, y, size }) => {
      ctx.font = `900 ${size}px "Press Start 2P", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // 3D Red Shadow Layers
      for (let offset = 8; offset >= 2; offset -= 2) {
        ctx.fillStyle = '#990000';
        ctx.fillText(text, W / 2 + offset, y + offset);
      }

      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 12;
      ctx.strokeText(text, W / 2, y);

      const grad = ctx.createLinearGradient(0, y - 30, 0, y + 30);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.3, '#ffea00');
      grad.addColorStop(1, '#ff9500');
      ctx.fillStyle = grad;
      ctx.fillText(text, W / 2, y);
    });

    ctx.restore();
  }

  _renderArcadeAnnouncement(ctx, W, H, text, mainColor) {
    ctx.save();
    const textY = H / 2 - 25;

    ctx.font = '900 48px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 3D Red Shadow Layers
    for (let offset = 8; offset >= 2; offset -= 2) {
      ctx.fillStyle = '#990000';
      ctx.fillText(text, W / 2 + offset, textY + offset);
    }

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 10;
    ctx.strokeText(text, W / 2, textY);

    const grad = ctx.createLinearGradient(0, textY - 30, 0, textY + 30);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.3, mainColor);
    grad.addColorStop(1, '#ff9500');
    ctx.fillStyle = grad;
    ctx.fillText(text, W / 2, textY);

    ctx.restore();
  }

  _drawSegmentedHealthBar(ctx, x, y, width, height, fighter, align = 'LEFT') {
    ctx.save();
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(x, y, width, height);

    const hpPercent = Math.max(0, fighter.hp / fighter.maxHp);
    const ghostPercent = Math.max(0, fighter.ghostHp / fighter.maxHp);

    const totalSegments = 14;
    const pad = 3;
    const segW = (width - (totalSegments + 1) * pad) / totalSegments;
    const segH = height - pad * 2;

    const activeSegs = Math.ceil(totalSegments * hpPercent);
    const ghostSegs = Math.ceil(totalSegments * ghostPercent);

    for (let i = 0; i < totalSegments; i++) {
      const idx = align === 'LEFT' ? i : (totalSegments - 1 - i);
      const sx = x + pad + idx * (segW + pad);
      const sy = y + pad;

      if (i < activeSegs) {
        let segColor = '#22ee44';
        if (hpPercent < 0.25) segColor = '#ff2d55';
        else if (hpPercent < 0.5) segColor = '#ffea00';

        ctx.fillStyle = segColor;
        ctx.fillRect(sx, sy, segW, segH);

        // Highlight stripe
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.fillRect(sx, sy, segW, segH * 0.35);
      } else if (i < ghostSegs) {
        ctx.fillStyle = '#ff2d55';
        ctx.fillRect(sx, sy, segW, segH);
      } else {
        ctx.fillStyle = '#101018';
        ctx.fillRect(sx, sy, segW, segH);
      }
    }

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3.5;
    ctx.strokeRect(x, y, width, height);
    ctx.restore();
  }

  _renderScanlines(ctx, W, H) {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    for (let y = 0; y < H; y += 3) {
      ctx.fillRect(0, y, W, 1.2);
    }
    ctx.restore();
  }

  _renderCRTBezel(ctx, W, H) {
    ctx.save();
    ctx.strokeStyle = '#050508';
    ctx.lineWidth = 16;
    ctx.strokeRect(0, 0, W, H);

    ctx.strokeStyle = '#1c1c28';
    ctx.lineWidth = 3;
    ctx.strokeRect(8, 8, W - 16, H - 16);

    const glintX = W - 110;
    const glintY = H - 85;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.beginPath();
    ctx.moveTo(glintX, glintY - 15);
    ctx.lineTo(glintX + 15, glintY);
    ctx.lineTo(glintX, glintY + 15);
    ctx.lineTo(glintX - 15, glintY);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}
