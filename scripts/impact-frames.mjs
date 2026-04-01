/**
 * Impact Frames — критичні попадання з анімацією
 * Foundry VTT v13, PIXI v7/v8 auto-detect
 */

const MODULE_ID = 'impact-frames';
const S = (k) => game.settings.get(MODULE_ID, k);

// ─── PIXI API автодетект ───────────────────────────────────────────────────────

const _tg = new PIXI.Graphics();
const PIXI_V8 = typeof _tg.rect === 'function';
if (typeof _tg.destroy === 'function') _tg.destroy();
console.log(`Impact Frames | PIXI API: ${PIXI_V8 ? 'v8 (new)' : 'v7 (legacy)'}`);

// ─── PIXI Graphics helpers (v7 + v8) ──────────────────────────────────────────

function gRect(g, x, y, w, h, color, alpha) {
  if (alpha <= 0) return;
  if (PIXI_V8) { g.rect(x, y, w, h); g.fill({ color, alpha }); }
  else          { g.beginFill(color, alpha); g.drawRect(x, y, w, h); g.endFill(); }
}

function gCircleFill(g, cx, cy, r, color, alpha) {
  if (alpha <= 0 || r <= 0) return;
  if (PIXI_V8) { g.circle(cx, cy, r); g.fill({ color, alpha }); }
  else          { g.beginFill(color, alpha); g.drawCircle(cx, cy, r); g.endFill(); }
}

function gCircleStroke(g, cx, cy, r, color, width, alpha) {
  if (alpha <= 0 || r <= 0 || width <= 0) return;
  if (PIXI_V8) { g.circle(cx, cy, r); g.stroke({ color, width, alpha }); }
  else          { g.lineStyle(width, color, alpha); g.drawCircle(cx, cy, r); g.lineStyle(0); }
}

function gLine(g, x0, y0, x1, y1, color, width, alpha) {
  if (alpha <= 0 || width <= 0) return;
  if (PIXI_V8) {
    g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke({ color, width, alpha });
  } else {
    g.lineStyle(width, color, alpha); g.moveTo(x0, y0); g.lineTo(x1, y1); g.lineStyle(0);
  }
}

function gPolyFill(g, pts, color, alpha) {
  if (alpha <= 0 || pts.length < 2) return;
  if (PIXI_V8) {
    g.moveTo(pts[0][0], pts[0][1]);
    for (let j = 1; j < pts.length; j++) g.lineTo(pts[j][0], pts[j][1]);
    g.closePath(); g.fill({ color, alpha });
  } else {
    g.beginFill(color, alpha);
    g.moveTo(pts[0][0], pts[0][1]);
    for (let j = 1; j < pts.length; j++) g.lineTo(pts[j][0], pts[j][1]);
    g.closePath(); g.endFill();
  }
}

function gLineStrip(g, pts, color, width, alpha) {
  if (alpha <= 0 || width <= 0 || pts.length < 2) return;
  if (PIXI_V8) {
    g.moveTo(pts[0][0], pts[0][1]);
    for (let j = 1; j < pts.length; j++) g.lineTo(pts[j][0], pts[j][1]);
    g.stroke({ color, width, alpha });
  } else {
    g.lineStyle(width, color, alpha);
    g.moveTo(pts[0][0], pts[0][1]);
    for (let j = 1; j < pts.length; j++) g.lineTo(pts[j][0], pts[j][1]);
    g.lineStyle(0);
  }
}

// ─── Дедублікація ─────────────────────────────────────────────────────────────

const _lastAnim = new Map();
function _shouldAnimate(tokenId) {
  const now = Date.now();
  if ((now - (_lastAnim.get(tokenId) ?? 0)) < 1500) return false;
  _lastAnim.set(tokenId, now);
  return true;
}

const _lastCrit = new Map();
function isDoubleCrit(tokenId) {
  const now = Date.now(), last = _lastCrit.get(tokenId) ?? 0;
  _lastCrit.set(tokenId, now);
  return (now - last) < 8000;
}

// ─── ColorMatrixFilter ────────────────────────────────────────────────────────

function makeCMF() {
  const CMF = PIXI.ColorMatrixFilter ?? PIXI.filters?.ColorMatrixFilter;
  return new CMF();
}

// ─── Детектор критів ──────────────────────────────────────────────────────────

function detectCriticalHit(message) {
  const f = message.flags ?? {};
  if (f.dnd5e?.roll?.isCritical || f.dnd5e?.isCritical) return true;

  // A5e: isCrit живе в message.system.rollData, НЕ в flags
  const sysRollData = message.system?.rollData;
  if (sysRollData) {
    const arr = Array.isArray(sysRollData) ? sysRollData : Object.values(sysRollData);
    if (arr.some(r => r?.type === 'attack' && r?.isCrit === true)) {
      console.log('Impact Frames | A5e crit via system.rollData ✓');
      return true;
    }
  }

  const a5e = f['a5e-for-dnd5e'] ?? f.a5e ?? {};
  const ctxs = a5e.contexts
    ? (Array.isArray(a5e.contexts) ? a5e.contexts : Object.values(a5e.contexts)) : [];
  if (ctxs.some(c => c?.isCriticalHit || c?.isCritical || c?.isCrit)) return true;
  if (a5e.isCriticalHit || a5e.isCritical || a5e.isCrit) return true;

  if (isAttackLike(message)) {
    for (const roll of message.rolls ?? []) {
      const d20 = roll.dice?.find(d => d.faces === 20);
      if (d20?.results?.some(r => r.result >= 20 && r.active !== false)) return true;
    }
  }
  return false;
}

function isAttackLike(msg) {
  const f = msg.flags ?? {};
  const t = f.dnd5e?.roll?.type;
  if (t) return t === 'attack';
  const sysRollData = msg.system?.rollData;
  if (sysRollData) {
    const arr = Array.isArray(sysRollData) ? sysRollData : Object.values(sysRollData);
    if (arr.some(r => r?.type === 'attack')) return true;
  }
  const a5e = f['a5e-for-dnd5e'] ?? f.a5e ?? {};
  const ctxs = a5e.contexts
    ? (Array.isArray(a5e.contexts) ? a5e.contexts : Object.values(a5e.contexts)) : [];
  if (ctxs.some(c => c?.rollType === 'atkRoll' || c?.rollType === 'attack')) return true;
  if (a5e.rollType === 'atkRoll' || a5e.rollType === 'attack') return true;
  return /attack/i.test(msg.flavor ?? '') || /attack/i.test(msg.content ?? '');
}

// Повертає АТАКУЮЧИЙ токен (той, хто робить рол), не ціль
function resolveTokens(message) {
  // speaker = атакуючий токен
  const speakerToken = message?.speaker?.token
    ? canvas.tokens?.get(message.speaker.token) : null;
  if (speakerToken) return [speakerToken];
  const controlled = canvas.tokens?.controlled ?? [];
  if (controlled.length) return [controlled[0]];
  return [];
}

// ─── Elements ─────────────────────────────────────────────────────────────────

const ELEMENTS = {
  none:      { chunks:['#dddddd','#ffffff','#aaaaaa'], bolts:'#cccccc', ring:'#ffffff', chunkCount:44, boltCount:10, chunkSpeed:[35,95],  chunkSize:[1.5,4.5] },
  fire:      { chunks:['#ffcc00','#ff4400','#ff8800'], bolts:'#ff9900', ring:'#ff6600', chunkCount:56, boltCount:4,  chunkSpeed:[60,145], chunkSize:[1.6,5],  sparkMode:true },
  ice:       { chunks:['#aaeeff','#66ccff','#ddf8ff'], bolts:'#99eeff', ring:'#44ccff', chunkCount:32, boltCount:5,  chunkSpeed:[18,52],  chunkSize:[2,5],    iceMode:true },
  arcane:    { chunks:['#cc80ff','#9933ff','#ffffff'], bolts:'#cc88ff', ring:'#aa55ff', chunkCount:34, boltCount:14, chunkSpeed:[35,90],  chunkSize:[1.6,4],  starMode:true },
  shadow:    { chunks:['#440066','#880099','#cc00ff'], bolts:'#660088', ring:'#9900cc', chunkCount:26, boltCount:16, chunkSpeed:[18,50],  chunkSize:[3.5,9],  darkMode:true },
  lightning: { chunks:['#ffffff','#88aaff','#ccddff'], bolts:'#aabbff', ring:'#88aaff', chunkCount:28, boltCount:28, chunkSpeed:[70,160], chunkSize:[1.6,4],  boltMode:true },
  poison:    { chunks:['#55ff55','#22bb22','#aaff88'], bolts:'#66ff44', ring:'#44dd44', chunkCount:38, boltCount:3,  chunkSpeed:[10,38],  chunkSize:[2,5.5],  bubbleMode:true },
  necrotic:  { chunks:['#220033','#440055','#880077'], bolts:'#330044', ring:'#660066', chunkCount:28, boltCount:8,  chunkSpeed:[8,32],   chunkSize:[2.5,7],  wispMode:true },
  force:     { chunks:['#aaccff','#6699ff','#eef4ff'], bolts:'#88aaff', ring:'#99bbff', chunkCount:30, boltCount:6,  chunkSpeed:[45,100], chunkSize:[2,5],    orbMode:true },
};

const ANIM_TYPES = ['streak', 'glint', 'particles', 'shockwave', 'pillar', 'slash'];

// ─── Damage type → Element mapping ───────────────────────────────────────────

const DAMAGE_ELEMENT_MAP = {
  fire:        'fire',
  cold:        'ice',
  lightning:   'lightning',
  thunder:     'lightning',
  necrotic:    'necrotic',
  poison:      'poison',
  acid:        'poison',   // кислота — зелена як отрута
  radiant:     'arcane',
  force:       'force',
  psychic:     'arcane',
  shadow:      'shadow',
  // bludgeoning / piercing / slashing → не в мапи → 'none'
};

function _getDmgTypeFromSystem(system) {
  if (!system) return null;
  // dnd5e v3+: system.damage.base.type
  const base = system?.damage?.base?.type;
  if (base && typeof base === 'string') return base;
  // dnd5e older: system.damage.parts = [["formula", "type"], ...]
  const parts = system?.damage?.parts;
  if (Array.isArray(parts) && parts.length) {
    const found = parts.find(p => Array.isArray(p) && p[1]);
    if (found) return found[1];
  }
  // A5e: system.actions is a map of actions, кожна має damage.rolls
  const actions = system?.actions;
  if (actions) {
    const actionArr = Array.isArray(actions) ? actions : Object.values(actions);
    for (const action of actionArr) {
      const rolls = action?.damage?.rolls;
      const rollArr = rolls ? (Array.isArray(rolls) ? rolls : Object.values(rolls)) : [];
      for (const roll of rollArr) {
        const t = roll?.damageType ?? roll?.type;
        if (t && typeof t === 'string') return t;
      }
    }
  }
  return null;
}

function getDmgTypeFromItem(item) {
  return _getDmgTypeFromSystem(item?.system);
}

function getDmgTypeFromMessage(message) {
  // dnd5e: item serialized у flags
  const itemData = message.flags?.dnd5e?.itemData;
  if (itemData?.system) {
    const t = _getDmgTypeFromSystem(itemData.system);
    if (t) return t;
  }
  // Шукаємо item через актора з speaker
  const actorId  = message.speaker?.actor;
  const tokenId  = message.speaker?.token;
  let actor = null;
  if (tokenId)  actor = canvas.tokens?.get(tokenId)?.actor;
  if (!actor && actorId) actor = game.actors?.get(actorId);
  if (actor) {
    const flavor = message.flavor ?? message.content ?? '';
    const item   = actor.items.find(i => i.name && flavor.includes(i.name));
    if (item) return getDmgTypeFromItem(item);
  }
  return null;
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
function easeIn(t)  { return t * t * t; }
function remap(v, a, b) { return Math.max(0, Math.min(1, (v - a) / (b - a))); }
function rng(s) { const x = Math.sin(s * 9301 + 49297) * 233280; return x - Math.floor(x); }

function buildChunks(el, seed) {
  return Array.from({ length: el.chunkCount }, (_, i) => {
    const s = seed + i;
    const angle    = rng(s*3.7) * Math.PI * 2;
    const spd      = el.chunkSpeed[0] + rng(s*1.9) * (el.chunkSpeed[1] - el.chunkSpeed[0]);
    const born     = rng(s*5.3) * 0.18;
    const life     = born + 0.22 + rng(s*2.1) * 0.32;
    const size     = el.chunkSize[0] + rng(s*8.1) * (el.chunkSize[1] - el.chunkSize[0]);
    const colorIdx = Math.floor(rng(s*6.3) * el.chunks.length);
    let pts;

    if (el.sparkMode) {
      // Вогонь: тонкий трикутник-іскра з легким нахилом
      const tilt = (rng(s*2.1) - 0.5) * 0.35;
      pts = [[tilt - 0.09, 0.42], [tilt, -1.0], [tilt + 0.09, 0.42]];
    } else if (el.iceMode) {
      // Лід: 6-кутна сніжинка (12 точок, чергуються inner/outer)
      pts = Array.from({ length: 12 }, (_, j) => {
        const a = (j / 12) * Math.PI * 2 - Math.PI / 6;
        const r = j % 2 === 0 ? 1.0 : 0.36;
        return [Math.cos(a) * r, Math.sin(a) * r];
      });
    } else if (el.boltMode) {
      // Блискавка: зигзаг-болт
      pts = [[0.25, 0.18], [0.02, -0.32], [0.34, -0.40], [-0.10, -1.08]];
    } else if (el.starMode) {
      // Аркана: 4-кутна зірка
      pts = Array.from({ length: 8 }, (_, j) => {
        const a = (j / 8) * Math.PI * 2;
        return [Math.cos(a) * (j % 2 === 0 ? 1.0 : 0.22), Math.sin(a) * (j % 2 === 0 ? 1.0 : 0.22)];
      });
    } else if (el.darkMode) {
      // Тінь: велика неправильна пляма
      const n = 4 + Math.floor(rng(s*4.4) * 3);
      pts = Array.from({ length: n }, (_, j) => {
        const a = (j / n) * Math.PI * 2 + rng(s*9+j) * 0.85;
        return [Math.cos(a) * (0.5 + rng(s*11+j) * 1.1), Math.sin(a) * (0.5 + rng(s*11+j) * 1.1)];
      });
    } else if (el.bubbleMode) {
      // Отрута: куля/бульбашка (8-гон із джитером)
      pts = Array.from({ length: 8 }, (_, j) => {
        const a = (j / 8) * Math.PI * 2;
        return [Math.cos(a) * (0.82 + rng(s*7+j) * 0.25), Math.sin(a) * (0.82 + rng(s*7+j) * 0.25)];
      });
    } else if (el.wispMode) {
      // Некротік: витягнута крапля-примара
      const l = 0.8 + rng(s*3) * 0.75;
      const w = 0.18 + rng(s*5) * 0.14;
      pts = [[0, -l], [w, -l*0.12], [w*0.55, l*0.38], [-w*0.55, l*0.38], [-w, -l*0.12]];
    } else if (el.orbMode) {
      // Форс: правильний шестикутник-орб
      pts = Array.from({ length: 6 }, (_, j) => {
        const a = (j / 6) * Math.PI * 2;
        return [Math.cos(a) * 0.88, Math.sin(a) * 0.88];
      });
    } else {
      // Базові: довільний полігон
      const n = 3 + Math.floor(rng(s*4.4) * 4);
      pts = Array.from({ length: n }, (_, j) => {
        const a = (j/n)*Math.PI*2, r = 0.4 + rng(s*11+j)*0.9;
        return [Math.cos(a)*r, Math.sin(a)*r];
      });
    }
    return { angle, speed: spd, born, life, pts, size, colorIdx };
  });
}

function buildBolts(el, seed) {
  return Array.from({ length: el.boltCount }, (_, i) => {
    const s     = seed + 1000 + i;
    const angle = rng(s*6.1) * Math.PI * 2;
    const born  = rng(s*3.3) * 0.25;
    const life  = born + 0.1 + rng(s*7.7) * 0.2;
    const len   = 40 + rng(s*2.9) * 120;
    const segs  = 3 + Math.floor(rng(s*4.1) * 5);
    const pts   = Array.from({ length: segs+1 }, (_, j) => {
      const t = j/segs;
      const bx = Math.cos(angle)*len*t, by = Math.sin(angle)*len*t;
      const jag = (rng(s*13+j)-0.5)*len*0.3*(1-t);
      return [bx - Math.sin(angle)*jag, by + Math.cos(angle)*jag];
    });
    return { born, life, pts };
  });
}

// ─── ImpactAnimation ──────────────────────────────────────────────────────────

class ImpactAnimation {
  constructor(token, animType, elementKey, doubleCrit) {
    this.token      = token;
    this.cx         = token.x + token.w / 2;
    this.cy         = token.y + token.h / 2;
    this.tw         = token.w;
    this.th         = token.h;
    this.R          = Math.max(token.w, token.h) * 0.5;
    this.animType   = animType;
    this.el         = ELEMENTS[elementKey] ?? ELEMENTS.none;
    this.doubleCrit = doubleCrit;
    this.seed       = Math.floor(Math.random() * 9999);
    this.chunks     = buildChunks(this.el, this.seed);
    this.bolts      = buildBolts(this.el, this.seed);
  }

  async play() {
    try {
      await this._shimmer();
      await this._impact();
      if (this.doubleCrit) this._screenInvert();
      if (S('screenShake')) this._shake();
    } catch(err) {
      console.error('Impact Frames | animation error:', err);
    }
  }

  // ── Shimmer ───────────────────────────────────────────────────────────────

  _shimmer() {
    return new Promise(resolve => {
      const token = this.token;
      if (!token.mesh?.texture) { resolve(); return; }

      const container = new PIXI.Container();
      canvas.stage.addChild(container);

      const inv = new PIXI.Sprite(token.mesh.texture);
      inv.x = token.x; inv.y = token.y;
      inv.width = token.w; inv.height = token.h;
      const cf = makeCMF();
      cf.negative(false);
      inv.filters = [cf];
      container.addChild(inv);

      const maskGfx = new PIXI.Graphics();
      inv.mask = maskGfx;
      container.addChild(maskGfx);

      const DURATION = 340;
      const start = performance.now();
      const tick = (now) => {
        const lp    = Math.min((now - start) / DURATION, 1);
        const shimX = lp < 0.5 ? easeOut(lp*2) : 1 - easeOut((lp-0.5)*2);
        const waveW = shimX * token.w;
        maskGfx.clear();
        if (waveW > 0.5) gRect(maskGfx, token.x, token.y, waveW, token.h, 0xFFFFFF, 1);
        if (lp < 1) requestAnimationFrame(tick);
        else { container.destroy({ children: true }); resolve(); }
      };
      requestAnimationFrame(tick);
    });
  }

  // ── Impact dispatcher ─────────────────────────────────────────────────────

  _impact() {
    return new Promise(resolve => {
      const { animType } = this;
      const container = new PIXI.Container();
      canvas.stage.addChild(container);
      const gfx = new PIXI.Graphics();
      container.addChild(gfx);

      const DURATION = 900;
      const start = performance.now();
      const tick = (now) => {
        const it = Math.min((now - start) / DURATION, 1);
        gfx.clear();
        if (animType === 'streak')    this._drawStreak(gfx, it);
        if (animType === 'glint')     this._drawGlint(gfx, it);
        if (animType === 'particles') this._drawParticles(gfx, it);
        if (animType === 'shockwave') this._drawShockwave(gfx, it);
        if (animType === 'pillar')    this._drawPillar(gfx, it);
        if (animType === 'slash')     this._drawSlash(gfx, it);
        if (it < 1) requestAnimationFrame(tick);
        else { container.destroy({ children: true }); resolve(); }
      };
      requestAnimationFrame(tick);
    });
  }

  // ── STREAK ────────────────────────────────────────────────────────────────
  // Горизонтальна яскрава смуга. Розширюється від токену, зникає до країв.
  // Темний фон — м'які краї (без жорсткого чорного обрамлення).

  _drawStreak(g, it) {
    const { cx, cy } = this;
    const sceneW = canvas.dimensions?.width ?? canvas.scene?.width ?? 4000;
    const areaH  = this.th * 2.4;
    const areaY  = cy - areaH / 2;

    // ── Фаза 1: Білий спалах ─────────────────────────────────────────────
    if (it < 0.18) {
      const fp = Math.sin((it / 0.18) * Math.PI);
      gRect(g, 0, areaY, sceneW, areaH, 0xFFFFFF, fp * 0.85);
      return;
    }

    // ── Фаза 2: Яскрава смуга, звужується до країв ───────────────────────
    const sp     = easeOut(remap(it, 0.07, 0.17));
    const fade   = it > 0.5 ? 1 - remap(it, 0.5, 0.90) : 1;
    const ga     = sp * fade;
    if (ga < 0.005) return;

    const gY    = cy;
    const gHmax = areaH * 0.18;
    const reach = this.R * 12;
    // Колонки: і висота і альфа звужуються від центру до країв — відблиск.
    const COLS = 48, cW = reach / COLS;
    for (let i = 0; i < COLS; i++) {
      const t = i / COLS;
      const a = ga * Math.pow(1 - t, 1.4);
      const h = gHmax * Math.pow(1 - t, 0.6) + 1.5;
      if (a < 0.005) continue;
      gRect(g, cx + i*cW,     gY - h/2, cW+1, h, 0xFFFFFF, a * 0.55);
      gRect(g, cx - (i+1)*cW, gY - h/2, cW+1, h, 0xFFFFFF, a * 0.55);
    }
    gRect(g, cx - cW,     gY - gHmax/2, cW*2, gHmax, 0xFFFFFF, ga * 0.55);
    gRect(g, cx - cW*0.5, gY - 1,       cW,   2,     0xFFFFFF, ga);

    // ── Частки ───────────────────────────────────────────────────────────
    for (const ch of this.chunks) {
      if (it < ch.born || it > ch.life) continue;
      const t2   = remap(it, ch.born, ch.life);
      const dist = easeOut(t2) * ch.speed * (this.R / 50);
      const px   = cx + (ch.angle > Math.PI ? -dist : dist);
      const py   = cy + (ch.angle - Math.PI/2) * areaH * 0.25;
      const a    = Math.pow(1 - t2, 1.4) * 0.7;
      const s    = ch.size * 0.4 * (this.R / 50);
      if (s > 0.1) gCircleFill(g, px, py, s, 0xFFFFFF, a);
    }
  }

  // ── GLINT ─────────────────────────────────────────────────────────────────
  // Спалах зі сяючими променями (ефект лінзи).

  _drawGlint(g, it) {
    const { cx, cy, R } = this;
    const sceneW = canvas.dimensions?.width  ?? canvas.scene?.width  ?? 4000;
    const sceneH = canvas.dimensions?.height ?? canvas.scene?.height ?? 3000;

    const coreR = it < 0.45
      ? R*0.12 + remap(it,0,0.28)*R*0.95
      : R*1.1*(1-remap(it,0.45,0.72));
    const coreA = it < 0.72 ? 1 : 1-remap(it,0.72,0.88);
    if (coreR > 0 && coreA > 0) {
      gCircleFill(g, cx, cy, coreR * 2.2, 0xFFFFFF, coreA * 0.08);
      gCircleFill(g, cx, cy, coreR,       0xFFFFFF, coreA);
    }

    const rayP = remap(it, 0.05, 0.28), rayF = it > 0.38 ? 1-remap(it,0.38,0.65) : 1;
    if (rayP > 0 && rayF > 0) {
      const p = easeOut(rayP), spin = it * Math.PI;
      const lines = [
        [0         + spin*0.55, sceneW*0.46*p, rayF      ],
        [Math.PI/2 - spin*0.38, sceneH*0.44*p, rayF*0.75 ],
        [Math.PI/4 + spin*0.72, sceneW*0.28*p, rayF*0.45 ],
        [-Math.PI/4- spin*0.48, sceneW*0.24*p, rayF*0.38 ],
      ];
      for (const [angle, hl, alpha] of lines) {
        const cos = Math.cos(angle), sin = Math.sin(angle);
        const x0 = cx-cos*hl, y0 = cy-sin*hl, x1 = cx+cos*hl, y1 = cy+sin*hl;
        gLine(g, x0,y0,x1,y1, 0xFFFFFF, 6,   alpha*0.28);
        gLine(g, x0,y0,x1,y1, 0xFFFFFF, 2,   alpha*0.9);
        gLine(g, x0,y0,x1,y1, 0xFFFFFF, 0.8, alpha);
      }
    }

    const rp = remap(it,0.28,0.52), rf = it>0.55 ? 1-remap(it,0.55,0.80):1;
    const rr = R*0.85+easeOut(rp)*R*1.7, rw = 2.8*(1-rp*0.65);
    if (rp>0 && rf>0 && rw>0.2) gCircleStroke(g, cx,cy,rr, 0xFFFFFF, rw, rf*0.88);

    this._drawChunks(g, it);
  }

  // ── PARTICLES ─────────────────────────────────────────────────────────────
  // Вибух уламків і блискавок.

  _drawParticles(g, it) {
    const { cx, cy, R } = this;

    if (it < 0.18) {
      const fp = Math.sin((it/0.18)*Math.PI);
      gCircleFill(g, cx, cy, R*(1.4+fp*1.8), 0xFFFFFF, fp * 0.8);
    }

    this._drawChunks(g, it);
    this._drawBolts(g, it);

    const rp = remap(it,0.06,0.42), rf = it>0.44 ? 1-remap(it,0.44,0.75):1;
    const rr = R*0.9+easeOut(rp)*R*1.9, rw = 2.2*(1-rp*0.7);
    if (rp>0 && rf>0 && rw>0.2) gCircleStroke(g, cx,cy,rr, 0xFFFFFF, rw, rf*0.75);
  }

  // ── SHOCKWAVE ─────────────────────────────────────────────────────────────
  // Хвилі ударного відлуння — кілька кілець розходяться назовні.

  _drawShockwave(g, it) {
    const { cx, cy, R } = this;

    // Спалах — лише навколо токену, не весь екран
    if (it < 0.16) {
      const fp = Math.sin((it / 0.16) * Math.PI);
      gCircleFill(g, cx, cy, R*(0.9 + fp*2.0), 0xFFFFFF, fp * 0.88);
      gCircleFill(g, cx, cy, R*(0.5 + fp*0.9), 0xFFFFFF, fp * 0.40);
    }

    // 3 кільця як суцільні полілінії з яскравіший відблиск по горизонталі
    const waves = [
      { delay: 0.00, speed: 3.8, alpha: 0.90 },
      { delay: 0.10, speed: 3.0, alpha: 0.65 },
      { delay: 0.24, speed: 2.2, alpha: 0.38 },
    ];
    for (const w of waves) {
      const rp = remap(it, w.delay, w.delay + 0.64);
      if (rp <= 0) continue;
      const rf = 1 - rp;
      const rr = R * 0.4 + easeOut(rp) * R * w.speed;
      const baseW = 2.6 * (1 - rp * 0.52);
      if (baseW < 0.12 || rf < 0.01) continue;
      // Сегменти з cos²-яскравістю: відблиск яскравіший по горизонталі
      const N = 64;
      for (let i = 0; i < N; i++) {
        const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2;
        const taper = 0.25 + 0.75 * Math.pow(Math.abs(Math.cos((a0 + a1) * 0.5)), 0.6);
        const segA = rf * w.alpha * taper;
        if (segA < 0.01) continue;
        gLine(g, cx+Math.cos(a0)*rr, cy+Math.sin(a0)*rr,
                  cx+Math.cos(a1)*rr, cy+Math.sin(a1)*rr, 0xFFFFFF, baseW, segA);
      }
    }

    this._drawChunks(g, it);
  }

  // ── PILLAR ────────────────────────────────────────────────────────────────
  // Стовп світла б'є в токен зверху, потім ударна хвиля по землі з частками.

  _drawPillar(g, it) {
    const { cx, cy, R } = this;

    // ── Стовп світла (0 → 0.42) ───────────────────────────────────────────
    const pA = it < 0.24 ? remap(it, 0, 0.18) : 1 - remap(it, 0.24, 0.42);
    if (pA > 0.01) {
      const pW = R * 0.45;
      gRect(g, cx - pW*3.5, 0, pW*7,    cy, 0xFFFFFF, pA * 0.04);
      gRect(g, cx - pW*1.4, 0, pW*2.8,  cy, 0xFFFFFF, pA * 0.18);
      gRect(g, cx - pW*0.35, 0, pW*0.7, cy, 0xFFFFFF, pA * 0.90);
    }

    // ── Спалах в точці удару (0.20 → 0.44) ───────────────────────────────
    const fP = remap(it, 0.20, 0.44);
    const fA = Math.sin(fP * Math.PI);
    if (fA > 0) {
      gCircleFill(g, cx, cy, R*(0.6 + fA*2.8), 0xFFFFFF, fA * 0.9);
      gCircleFill(g, cx, cy, R*(0.4 + fA*1.2), 0xFFFFFF, fA * 0.45);
    }

    // ── Ударна хвиля по землі (0.32 → 0.92) ──────────────────────────────
    const swP = remap(it, 0.32, 0.90);
    const swF = 1 - swP;
    if (swP > 0 && swF > 0) {
      const swR = R * 0.3 + easeOut(swP) * R * 5.8;
      const N = 64;
      const pts = [];
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * Math.PI * 2;
        pts.push([cx + Math.cos(a)*swR, cy + Math.sin(a)*swR]);
      }
      const lw = 2.8 * (1 - swP*0.55);
      if (lw > 0.15) gLineStrip(g, pts, 0xFFFFFF, lw, swF * 0.88);
      if (swP < 0.65) {
        const swR2 = swR * 0.72, pts2 = [];
        for (let i = 0; i <= N; i++) {
          const a = (i / N) * Math.PI * 2;
          pts2.push([cx + Math.cos(a)*swR2, cy + Math.sin(a)*swR2]);
        }
        gLineStrip(g, pts2, 0xFFFFFF, lw * 0.4, swF * 0.38);
      }
    }

    // ── Частки летять вгору (від it = 0.32) ───────────────────────────────
    for (const ch of this.chunks) {
      const OFFSET = 0.30;
      if (it < ch.born + OFFSET || it > ch.life + OFFSET) continue;
      const t    = remap(it, ch.born + OFFSET, ch.life + OFFSET);
      const dist = easeOut(t) * ch.speed * (R / 50);
      const px   = cx + Math.cos(ch.angle) * dist * 0.6;
      const py   = cy - easeOut(t) * dist * 1.1 + t*t * dist * 0.55;
      const a    = Math.pow(1 - t, 1.3) * 0.82;
      const s    = ch.size * 0.38 * (R / 50);
      if (s > 0.1) gCircleFill(g, px, py, s, 0xFFFFFF, a);
    }
  }

  // ── SLASH ─────────────────────────────────────────────────────────────────
  // Кінематографічна ударна хвиля: кластери, streaks, аутлаєри, уламки.

  _drawSlash(g, it) {
    const { cx, cy, R, seed } = this;

    // Звичайні частки (кластеризовані по кутах, з streak)
    const PARTS = 120;
    for (let i = 0; i < PARTS; i++) {
      const s       = seed + 1000 + i * 13;
      const cluster = Math.floor(rng(s * 0.7) * 12) / 12 * Math.PI * 2;
      const angle   = cluster + (rng(s * 4.9) - 0.5) * 1.1;
      const maxDist = R * (1.2 + rng(s * 5.5) * 2.0);
      const born    = 0.02 + rng(s * 1.1) * 0.05;
      const life    = born + 0.45 + rng(s * 3.7) * 0.25;
      if (it < born || it > life) continue;
      const t   = remap(it, born, life);
      const d   = t * t * t * maxDist;
      const px  = cx + Math.cos(angle) * d;
      const py  = cy + Math.sin(angle) * d;
      const tP  = Math.max(0, t - 0.07), dP = tP*tP*tP*maxDist;
      const pxP = cx + Math.cos(angle) * dP, pyP = cy + Math.sin(angle) * dP;
      const a   = (1 - t * t) * 0.88;
      const sz  = 0.5 + rng(s * 7.1) * 1.0;
      if (a < 0.02) continue;
      if (d - dP > 1) gLine(g, pxP, pyP, px, py, 0xFFFFFF, sz * 0.6, a * 0.55);
      gCircleFill(g, px, py, sz, 0xFFFFFF, a);
    }

    // Швидкі аутлаєри — стрімкі лінії
    const FAST = 18;
    for (let i = 0; i < FAST; i++) {
      const s       = seed + 3000 + i * 29;
      const angle   = rng(s * 2.3) * Math.PI * 2;
      const maxDist = R * (2.5 + rng(s * 4.1) * 2.5);
      const born    = 0.02 + rng(s * 0.9) * 0.04;
      const life    = born + 0.35 + rng(s * 1.7) * 0.15;
      if (it < born || it > life) continue;
      const t   = remap(it, born, life);
      const d   = t * maxDist;
      const dP  = Math.max(0, t - 0.10) * maxDist;
      const px  = cx + Math.cos(angle) * d,  py  = cy + Math.sin(angle) * d;
      const pxP = cx + Math.cos(angle) * dP, pyP = cy + Math.sin(angle) * dP;
      const a   = (1 - t) * 0.75;
      if (a > 0.02) gLine(g, pxP, pyP, px, py, 0xFFFFFF, 0.8, a);
    }

    // Великі уламки
    const CHUNKS = 10;
    for (let i = 0; i < CHUNKS; i++) {
      const s       = seed + 2000 + i * 71;
      const angle   = rng(s * 3.1) * Math.PI * 2;
      const maxDist = R * (0.9 + rng(s * 4.1) * 1.4);
      const born    = 0.02 + rng(s * 1.1) * 0.04;
      const life    = born + 0.55 + rng(s * 2.3) * 0.20;
      if (it < born || it > life) continue;
      const t  = remap(it, born, life);
      const d  = t * t * t * maxDist;
      const px = cx + Math.cos(angle) * d, py = cy + Math.sin(angle) * d;
      const a  = (1 - t * t) * 0.95;
      const sz = 1.8 + rng(s * 8.1) * 2.5;
      if (a > 0.02) gCircleFill(g, px, py, sz, 0xFFFFFF, a);
    }
  }

  // ── _drawChunks ───────────────────────────────────────────────────────────

  _drawChunks(g, it) {
    const { cx, cy, el, chunks } = this;
    const scale = Math.max(this.tw, this.th) / 100;
    for (const ch of chunks) {
      if (it < ch.born || it > ch.life + 0.08) continue;
      const t  = remap(it, ch.born, ch.life);
      let dx = Math.cos(ch.angle) * easeOut(t) * ch.speed * scale;
      let dy = Math.sin(ch.angle) * easeOut(t) * ch.speed * scale;
      if (el.sparkMode)  dy -= t * 30 * scale;
      if (el.bubbleMode) dy -= t * 14 * scale;
      if (el.darkMode)   { dx *= 0.65; dy *= 0.65; }
      if (el.wispMode)   { dx *= 0.42; dy *= 0.42; }
      const px = cx + dx, py = cy + dy;
      const slow = el.darkMode || el.wispMode;
      const a  = Math.pow(1 - t, slow ? 0.8 : 1.3);
      const sz = ch.size * (0.7 + t * 0.35) * scale;
      const hex = parseInt(el.chunks[ch.colorIdx].replace('#',''), 16);

      if (el.sparkMode) {
        // Вогонь: вертикальний іскро-стрік
        const len = sz * 3.2;
        const ox = Math.cos(ch.angle + Math.PI*0.5) * sz * 0.15;
        gLine(g, px, py, px + ox, py - len, hex, Math.max(1, sz * 0.45), a);
        gLine(g, px, py, px + ox, py - len, 0xFFFFFF, Math.max(0.5, sz * 0.12), a * 0.55);
      } else if (el.iceMode) {
        // Лід: сніжинка — 6 промінів з гілками
        const arm = sz * 1.5;
        for (let i = 0; i < 6; i++) {
          const aa = (i / 6) * Math.PI * 2;
          const ex = px + Math.cos(aa) * arm, ey = py + Math.sin(aa) * arm;
          gLine(g, px, py, ex, ey, hex, 1.8, a);
          const mx = px + Math.cos(aa)*arm*0.55, my = py + Math.sin(aa)*arm*0.55;
          for (const da of [0.38, -0.38]) {
            gLine(g, mx, my, mx + Math.cos(aa+da)*arm*0.35, my + Math.sin(aa+da)*arm*0.35, hex, 1.2, a * 0.75);
          }
        }
      } else if (el.boltMode) {
        // Блискавка: мінімальний зигзаг
        const h = sz * 2.8;
        const pts = [[px, py], [px+sz*0.55, py-h*0.36], [px-sz*0.42, py-h*0.54], [px+sz*0.2, py-h]];
        gLineStrip(g, pts, hex, 2.0, a);
        gLineStrip(g, pts, 0xFFFFFF, 0.7, a * 0.5);
      } else if (el.starMode) {
        // Аркана: 4-кутна зірка (filled)
        const world = ch.pts.map(([ppx,ppy]) => [px+ppx*sz, py+ppy*sz]);
        gPolyFill(g, world, hex, a);
        gPolyFill(g, world, 0xFFFFFF, a * 0.25);
      } else if (el.darkMode) {
        // Тінь: велика неправильна пляма
        const world = ch.pts.map(([ppx,ppy]) => [px+ppx*sz, py+ppy*sz]);
        gPolyFill(g, world, hex, a * 0.9);
      } else if (el.bubbleMode) {
        // Отрута: куля з обводкою і відблиском
        gCircleFill(g, px, py, sz * 0.82, hex, a * 0.55);
        gCircleStroke(g, px, py, sz * 0.82, hex, 2.0, a * 0.6);
        gCircleFill(g, px - sz*0.22, py - sz*0.22, sz * 0.18, 0xFFFFFF, a * 0.55);
      } else if (el.wispMode) {
        // Некротік: витягнута крапля з серцевиною
        const world = ch.pts.map(([ppx,ppy]) => [px+ppx*sz, py+ppy*sz]);
        gPolyFill(g, world, hex, a);
        gCircleFill(g, px, py, sz * 0.22, 0xaa44aa, a * 0.7);
      } else if (el.orbMode) {
        // Форс: кільце + центральне ядро
        gCircleStroke(g, px, py, sz * 0.88, hex, 2.5, a);
        gCircleFill(g, px, py, sz * 0.3, hex, a * 0.8);
        gCircleStroke(g, px, py, sz * 0.52, hex, 1.0, a * 0.4);
      } else {
        const world = ch.pts.map(([ppx,ppy]) => [px+ppx*sz, py+ppy*sz]);
        gPolyFill(g, world, hex, a);
      }
    }
  }

  // ── _drawBolts ────────────────────────────────────────────────────────────

  _drawBolts(g, it) {
    const { cx, cy, el, bolts } = this;
    const scale   = Math.max(this.tw, this.th) / 100;
    const boltHex = parseInt(el.bolts.replace('#',''), 16);
    for (const bolt of bolts) {
      if (it < bolt.born || it > bolt.life) continue;
      const t   = remap(it, bolt.born, bolt.life);
      const a   = t < 0.3 ? t/0.3 : 1-(t-0.3)/0.7;
      const pts = bolt.pts.map(([px,py]) => [cx+px*scale, cy+py*scale]);
      gLineStrip(g, pts, boltHex,  2.5*scale, a*0.85);
      gLineStrip(g, pts, 0xFFFFFF, 0.8*scale, a*0.65);
    }
  }

  // ── Screen invert (double crit) ───────────────────────────────────────────

  _screenInvert() {
    const filter = makeCMF();
    const stage  = canvas.stage;
    const prev   = stage.filters ?? [];
    filter.negative(false);
    stage.filters = [...prev, filter];
    const start = performance.now(), DUR = 320;
    const tick = (now) => {
      const t = Math.min((now-start)/DUR, 1);
      filter.alpha = Math.sin(t*Math.PI);
      if (t < 1) requestAnimationFrame(tick);
      else { stage.filters = prev; filter.destroy(); }
    };
    requestAnimationFrame(tick);
  }

  // ── Shake ─────────────────────────────────────────────────────────────────

  _shake() {
    const stage = canvas.stage;
    const ox = stage.pivot.x, oy = stage.pivot.y;
    const frames = [[9,-3],[-8,3],[6,-2],[-4,2],[2,-1],[0,0]];
    let i = 0;
    const next = () => {
      if (i >= frames.length) { stage.pivot.set(ox, oy); return; }
      stage.pivot.set(ox+frames[i][0], oy+frames[i][1]);
      i++; setTimeout(next, 38);
    };
    next();
  }
}

// ─── Вибір анімації та елементу ──────────────────────────────────────────────

function chooseAnim() {
  if (S('animRandom')) return ANIM_TYPES[Math.floor(Math.random() * ANIM_TYPES.length)];
  return S('animFixed');
}

// dmgType — тип шкоди зброї (string | null). Якщо null, ігнорується.
function resolveElement(dmgType = null) {
  if (!S('useElements')) return 'none';
  // Якщо увімкнено авто-детект стихії зброї і є тип шкоди
  if (S('elemFromWeapon') && dmgType) {
    const mapped = DAMAGE_ELEMENT_MAP[dmgType];
    return (mapped && ELEMENTS[mapped]) ? mapped : 'none';
  }
  return S('elemFixed');
}

// ─── Звук критичного удару ────────────────────────────────────────────────────
// Кладіть файл crit.ogg / crit.mp3 / crit.wav у папку modules/impact-frames/

async function playCritSound() {
  for (const ext of ['ogg', 'mp3', 'wav']) {
    const src = `modules/${MODULE_ID}/crit.${ext}`;
    try {
      const r = await fetch(src, { method: 'HEAD' });
      if (r.ok) {
        (foundry.audio?.AudioHelper ?? AudioHelper).play({ src, volume: 1.0, autoplay: true, loop: false });
        return;
      }
    } catch { /* не знайдено, пробуємо далі */ }
  }
}

// ─── Тригери ──────────────────────────────────────────────────────────────────

function _triggerForTokens(tokens, isOwn, dmgType = null) {
  if (tokens.length) playCritSound();
  for (const token of tokens) {
    if (!token) continue;
    if (!S('showOthers') && !isOwn) continue;
    if (!_shouldAnimate(token.id)) continue;
    new ImpactAnimation(token, chooseAnim(), resolveElement(dmgType), isDoubleCrit(token.id)).play();
  }
}

// Отримує токен АТАКУЮЧОГО актора
function _triggerFromActor(actor, isOwn, dmgType = null) {
  let tokens = [];
  if (actor?.getActiveTokens) {
    tokens = actor.getActiveTokens().filter(t => t.visible !== false);
  }
  if (!tokens.length) {
    const controlled = canvas.tokens?.controlled ?? [];
    if (controlled.length) tokens = [controlled[0]];
  }
  _triggerForTokens(tokens, isOwn, dmgType);
}

// ─── Settings ─────────────────────────────────────────────────────────────────

Hooks.once('init', () => {
  const R = (k, d) => game.settings.register(MODULE_ID, k, d);

  R('enabled',     { name:'IMPACT_FRAMES.SettingEnabled',    scope:'client', config:true, type:Boolean, default:true });
  R('showOthers',  { name:'IMPACT_FRAMES.SettingShowOthers', scope:'client', config:true, type:Boolean, default:true });
  R('screenShake', { name:'IMPACT_FRAMES.SettingShake',      scope:'client', config:true, type:Boolean, default:true });

  R('animRandom',  { name:'IMPACT_FRAMES.SettingAnimRandom', scope:'client', config:true, type:Boolean, default:false });
  R('animFixed',   { name:'IMPACT_FRAMES.SettingAnimFixed',  scope:'client', config:true, type:String,
    choices:{
      streak:'Streak (горизонтальна смуга)',
      glint:'Glint (промені лінзи)',
      particles:'Burst (вибух часток)',
      shockwave:'Shockwave (ударна хвиля)',
      nova:'Nova (зірковий вибух)',
      slash:'Slash (діагональні розтини)',
    },
    default:'glint' });

  R('useElements',    { name:'IMPACT_FRAMES.SettingUseElements',    scope:'client', config:true, type:Boolean, default:false });
  R('elemFromWeapon', { name:'IMPACT_FRAMES.SettingElemFromWeapon', hint:'IMPACT_FRAMES.SettingElemFromWeaponHint',
    scope:'client', config:true, type:Boolean, default:false });
  R('elemFixed',      { name:'IMPACT_FRAMES.SettingElemFixed',      scope:'client', config:true, type:String,
    choices: Object.fromEntries(Object.keys(ELEMENTS).map(k=>[k,k.charAt(0).toUpperCase()+k.slice(1)])),
    default:'none' });

  R('onlyOwner',   { name:'IMPACT_FRAMES.SettingOnlyOwner', hint:'IMPACT_FRAMES.SettingOnlyOwnerHint',
    scope:'world', config:true, type:Boolean, default:false });
});

// ─── Hooks ────────────────────────────────────────────────────────────────────

Hooks.once('ready', () => {

  // A5e: itemActivate — прямий доступ до rolls з isCrit
  Hooks.on('a5e.itemActivate', (item, hookData) => {
    if (!S('enabled')) return;
    const rolls = hookData?.rolls ?? [];
    if (!rolls.some(r => r?.type === 'attack' && r?.isCrit === true)) return;
    const isOwn = item?.actor?.isOwner ?? false;
    if (S('onlyOwner') && !isOwn) return;
    _triggerFromActor(item.actor, isOwn, getDmgTypeFromItem(item));
  });

  // dnd5e
  Hooks.on('dnd5e.rollAttack', (item, roll) => {
    if (!S('enabled') || !roll?.isCritical) return;
    _triggerFromActor(item?.actor, true, getDmgTypeFromItem(item));
  });

  // Універсальний fallback: createChatMessage (A5e через system.rollData)
  Hooks.on('createChatMessage', (message) => {
    if (!S('enabled')) return;
    if (!detectCriticalHit(message)) return;
    if (S('onlyOwner') && message.author?.id !== game.user.id) return;
    const isOwn = message.author?.id === game.user.id;
    if (!S('showOthers') && !isOwn) return;

    const tokens = resolveTokens(message);
    if (!tokens.length) {
      console.warn('Impact Frames | Crit detected but no attacker token found');
      return;
    }
    _triggerForTokens(tokens, isOwn, getDmgTypeFromMessage(message));
  });
});
