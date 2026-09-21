// ============================================================
// INTELLIGENT STICKMAN COMBAT AI  v2.0
// 4-Pillar Equal Balance: Hands 25% | Legs 25% | Powers 25% | Abilities 25%
//
// KEY IMPROVEMENTS over v1:
//  - Strict quota ring-buffer (size 8). Any category used ≥3 times
//    in last 8 moves gets weight=0 (HARD BLOCK).
//  - Per-category cooldown (0.3s) applied after each use.
//  - EVERY move tracked: ripostes, combos, whiff punishes ALL recorded.
//  - Tactical mode recalculates every frame (not every 0.8s).
//  - _execute() helper ensures nothing slips through untracked.
//  - Correct element-specific THROW moves per fighter.
// ============================================================

export class FighterAI {
  constructor(fighter, opponent, baseStyle = 'BALANCED') {
    this.fighter   = fighter;
    this.opponent  = opponent;
    this.baseStyle = baseStyle;

    // Tactical mode
    this.tacticalMode  = 'AGGRESSIVE';
    this.modeHoldTimer = 0;

    // Decision throttle
    this.decisionTimer    = 0;
    this.decisionInterval = 0.06 + Math.random() * 0.04;

    // Combo queue
    this.comboQueue = [];

    // Opponent state tracking
    this.wasOpponentAttacking = false;
    this.oppAttackCooldown    = 0;

    // 4-PILLAR QUOTA: ring-buffer of last 8 category uses
    this.categoryHistory = [];
    this.HISTORY_SIZE    = 8;

    // Per-category cooldown prevents single-category burst
    this.categoryCooldown = { HANDS: 0, LEGS: 0, POWERS: 0, ABILITIES: 0 };
  }

  // ── Record a category into the quota ring ─────────────────────
  _recordCat(cat) {
    this.categoryHistory.push(cat);
    if (this.categoryHistory.length > this.HISTORY_SIZE) this.categoryHistory.shift();
    this.categoryCooldown[cat] = 0.30;
  }

  _recentCount(cat) {
    return this.categoryHistory.filter(c => c === cat).length;
  }

  // ── Weighted random pick with hard block on overused categories ──
  pickBalancedCategory(allowed = ['HANDS', 'LEGS', 'POWERS', 'ABILITIES']) {
    const histLen = Math.max(1, this.categoryHistory.length);

    const weights = allowed.map(cat => {
      const count = this._recentCount(cat);
      // HARD BLOCK: used ≥3 times in last 8 → weight 0
      if (count >= 3) return 0;
      const share      = count / histLen;        // ideal 0.25
      const cdPenalty  = this.categoryCooldown[cat] > 0 ? 0.25 : 1.0;
      const base       = Math.max(0.02, 1.0 - (share / 0.25) * 0.60);
      return base * cdPenalty;
    });

    const total = weights.reduce((a, b) => a + b, 0);
    if (total <= 0) {
      // All blocked → pick least used
      const cat = allowed.reduce((a, b) => this._recentCount(a) <= this._recentCount(b) ? a : b);
      this._recordCat(cat);
      return cat;
    }

    let rand = Math.random() * total;
    for (let i = 0; i < allowed.length; i++) {
      if (rand < weights[i]) { this._recordCat(allowed[i]); return allowed[i]; }
      rand -= weights[i];
    }
    const fb = allowed.reduce((a, b) => this._recentCount(a) <= this._recentCount(b) ? a : b);
    this._recordCat(fb);
    return fb;
  }

  // ── Execute a move AND record its category ─────────────────────
  _exec(moveName, cat) {
    const ok = this.fighter.startAttack(moveName);
    if (ok && cat) this._recordCat(cat);
    return ok;
  }

  // ── Infer category from move name (for combo queue tracking) ───
  _catOf(moveName) {
    if (!moveName) return 'HANDS';
    if (moveName.includes('KICK') || moveName === 'ROUNDHOUSE') return 'LEGS';
    if (moveName === 'JUDO_THROW' || moveName === 'SHOULDER_TACKLE') return 'ABILITIES';
    if (moveName.includes('THROW') || moveName === 'AURA_PUNCH' || moveName === 'SUPER_DRAGON') return 'POWERS';
    return 'HANDS';
  }

  // ── Real-time tactical mode evaluation (every frame) ──────────
  evaluateTacticalMode() {
    const f   = this.fighter;
    const opp = this.opponent;
    const prev = this.tacticalMode;

    if (f.hasElementPower || f.elementPower >= 100) {
      this.tacticalMode = 'AGGRESSIVE';
    } else if (f.hp / f.maxHp <= 0.28) {
      this.tacticalMode = 'DEFENSIVE';
    } else if (opp.state === 'KNOCKDOWN' || opp.state === 'DEAD') {
      this.tacticalMode = 'AGGRESSIVE';
    } else if ((f.hp - opp.hp) / f.maxHp >= 0.30) {
      this.tacticalMode = 'AGGRESSIVE';
    } else if (opp.hasElementPower || opp.elementPower >= 90) {
      this.tacticalMode = 'DEFENSIVE';
    } else if (this.modeHoldTimer <= 0) {
      // Style-based baseline
      const aggrChance = {
        AGGRESSIVE: 0.72, BALANCED: 0.50, TACTICAL: 0.33,
        SPEED: 0.62, BRUTE: 0.65, KICKBOXER: 0.55
      }[this.baseStyle] ?? 0.50;
      this.tacticalMode  = Math.random() < aggrChance ? 'AGGRESSIVE' : 'DEFENSIVE';
      this.modeHoldTimer = 0.45 + Math.random() * 0.75;
    }

    if (this.tacticalMode !== prev) this.modeHoldTimer = 0.30;
  }

  // ── Close-range balanced attack ────────────────────────────────
  _closeRangeAttack(dist) {
    const f   = this.fighter;
    const cat = this.pickBalancedCategory();

    if (cat === 'HANDS') {
      const r = Math.random();
      if      (r < 0.18) this._exec('HOOK',         'HANDS');
      else if (r < 0.36) { this._exec('ELBOW_STRIKE','HANDS'); this.comboQueue = ['HOOK']; }
      else if (r < 0.54) { this._exec('JAB',         'HANDS'); this.comboQueue = ['CROSS','UPPERCUT']; }
      else if (r < 0.70) this._exec('UPPERCUT',     'HANDS');
      else if (r < 0.84) this._exec('RAPID_FLURRY', 'HANDS');
      else               this._exec('HEAVY_SLAM',   'HANDS');
    }
    else if (cat === 'LEGS') {
      if (Math.random() < 0.50) { this._exec('LOW_KICK', 'LEGS'); this.comboQueue = ['ROUNDHOUSE']; }
      else                        this._exec('ROUNDHOUSE','LEGS');
    }
    else if (cat === 'POWERS') {
      if ((f.hasElementPower || f.elementPower >= 100) && dist >= 90) {
        this._exec(`${f.element}_THROW`, 'POWERS');
      } else if (f.superMeter >= 100) {
        this._exec('SUPER_DRAGON', 'POWERS');
      } else {
        this._exec('AURA_PUNCH', 'POWERS');
      }
    }
    else { // ABILITIES
      const r = Math.random();
      if      (dist <= 95 && r < 0.50) this._exec('JUDO_THROW',      'ABILITIES');
      else if (r < 0.80)               this._exec('SHOULDER_TACKLE',  'ABILITIES');
      else                             { this.fighter.moveBackward(265); this._recordCat('ABILITIES'); }
    }
  }

  // ── Mid-range balanced attack ───────────────────────────────────
  _midRangeAttack() {
    const f   = this.fighter;
    const cat = this.pickBalancedCategory();

    if (cat === 'HANDS') {
      this._exec('DASH_PUNCH', 'HANDS');
    }
    else if (cat === 'LEGS') {
      this._exec('FLYING_KICK', 'LEGS');
    }
    else if (cat === 'POWERS') {
      if (f.hasElementPower || f.elementPower >= 90) {
        this._exec(`${f.element}_THROW`, 'POWERS');
      } else {
        f.addElementPower(20); f.auraIntensity = 1.0;
        f.vx = f.facing * 160; f.state = 'MOVE';
        this._recordCat('POWERS');
      }
    }
    else { // ABILITIES
      const r = Math.random();
      if      (r < 0.45) this._exec('SHOULDER_TACKLE', 'ABILITIES');
      else if (r < 0.72) {
        f.vx = f.facing * 380; f.isDashing = true; f.state = 'MOVE';
        this._recordCat('ABILITIES'); this.comboQueue = ['DASH_PUNCH'];
      }
      else {
        f.vx = f.facing * 320; f.state = 'MOVE';
        this._recordCat('ABILITIES'); this.comboQueue = ['JUDO_THROW'];
      }
    }
  }

  // ── Main update ────────────────────────────────────────────────
  update(dt, projectiles = []) {
    const f   = this.fighter;
    const opp = this.opponent;
    if (f.state === 'DEAD' || opp.state === 'DEAD') return;

    // Tick timers
    this.modeHoldTimer    = Math.max(0, this.modeHoldTimer - dt);
    this.oppAttackCooldown = Math.max(0, this.oppAttackCooldown - dt);
    for (const k of Object.keys(this.categoryCooldown)) {
      this.categoryCooldown[k] = Math.max(0, this.categoryCooldown[k] - dt);
    }

    // Evaluate tactical mode every frame
    this.evaluateTacticalMode();

    // Throttle decisions
    this.decisionTimer += dt;
    if (this.decisionTimer < this.decisionInterval) return;
    this.decisionTimer = 0;

    const dx   = opp.x - f.x;
    const dist = Math.abs(dx);

    const isOppAttacking      = opp.state === 'ATTACK';
    const opponentJustWhiffed = this.wasOpponentAttacking && !isOppAttacking && !opp.currentMove?.hasHit;
    this.wasOpponentAttacking = isOppAttacking;

    f.facing = dx >= 0 ? 1 : -1;

    if (f.isBlocking && (!isOppAttacking || dist > 200)) {
      f.isBlocking = false;
      if (f.state === 'BLOCK') f.state = 'IDLE';
    }

    // ── 0. PROJECTILE EVASION ─────────────────────────────────────
    if (projectiles.length > 0 && f.isGrounded &&
        f.state !== 'ATTACK' && f.state !== 'HIT' && f.state !== 'KNOCKDOWN') {
      for (const p of projectiles) {
        if (p.attacker === f) continue;
        const dp = Math.abs(p.x - f.x);
        const toward = (p.vx > 0 && f.x > p.x) || (p.vx < 0 && f.x < p.x);
        if (toward && dp < 270 && dp > 35) { f.jump(-18.5); return; }
      }
    }

    if (f.state === 'ATTACK' || f.state === 'HIT' ||
        f.state === 'KNOCKDOWN' || f.state === 'JUMP') return;

    // ── 1. DODGE / PARRY when opponent attacks ────────────────────
    if (isOppAttacking && dist < 190 && !opp.currentMove?.hasHit && this.oppAttackCooldown <= 0) {
      const evadeChance = this.tacticalMode === 'DEFENSIVE' ? 0.90 : 0.70;
      if (Math.random() < evadeChance) {
        this.oppAttackCooldown = 0.22;
        const mc = Math.random();
        if (mc < 0.38) {
          f.moveBackward(this.tacticalMode === 'DEFENSIVE' ? 320 : 255);
          return;
        } else if (mc < 0.62 && f.isGrounded) {
          f.jump(-16.5); return;
        } else {
          f.state = 'BLOCK'; f.isBlocking = true;
          // Riposte through the balanced picker (ALL ripostes ARE tracked now!)
          const riposteCat = this.pickBalancedCategory();
          if      (riposteCat === 'HANDS')     this.comboQueue = ['UPPERCUT'];
          else if (riposteCat === 'LEGS')      this.comboQueue = ['ROUNDHOUSE'];
          else if (riposteCat === 'POWERS')    this.comboQueue = ['AURA_PUNCH'];
          else                                 this.comboQueue = ['JUDO_THROW'];
          return;
        }
      }
    }

    // ── 2. WHIFF PUNISHMENT ───────────────────────────────────────
    if (opponentJustWhiffed && dist < 170 && f.state === 'IDLE') {
      this._closeRangeAttack(dist);
      return;
    }

    // ── 3. EXECUTE COMBO QUEUE (every combo move is also tracked) ──
    if (this.comboQueue.length > 0 && f.state === 'IDLE') {
      const nextMove = this.comboQueue.shift();
      this._exec(nextMove, this._catOf(nextMove));
      return;
    }

    // ── 4. ELEMENTAL SPECIAL ──────────────────────────────────────
    if ((f.hasElementPower || f.elementPower >= 100) && dist >= 100) {
      this._exec(`${f.element}_THROW`, 'POWERS');
      return;
    }

    // ── 5. SUPER MOVE ─────────────────────────────────────────────
    if (f.superMeter >= 100 && dist < 225) {
      this._exec('SUPER_DRAGON', 'POWERS');
      return;
    }

    // ── 6. OPPONENT KNOCKED DOWN ──────────────────────────────────
    if (opp.state === 'KNOCKDOWN') {
      if (dist < 190) { f.vx = f.facing * -155; f.state = 'MOVE'; }
      return;
    }

    // ── 7. CLOSE-RANGE COMBAT (≤ 140px) ──────────────────────────
    if (dist <= 140) { this._closeRangeAttack(dist); return; }

    // ── 8. MID-RANGE COMBAT (140–320px) ──────────────────────────
    if (dist <= 320) {
      if (this.tacticalMode === 'DEFENSIVE' && Math.random() < 0.45) {
        f.vx = f.facing * (130 + Math.random() * 55); f.state = 'MOVE';
      } else {
        this._midRangeAttack();
      }
      return;
    }

    // ── 9. LONG RANGE (> 320px) ───────────────────────────────────
    if (f.hasElementPower || f.elementPower >= 90) {
      this._exec(`${f.element}_THROW`, 'POWERS');
      return;
    }
    if (this.tacticalMode === 'DEFENSIVE') {
      f.vx = f.facing * (110 + Math.random() * 55); f.state = 'MOVE';
    } else {
      f.vx = f.facing * (250 + Math.random() * 90); f.state = 'MOVE';
    }
  }
}
