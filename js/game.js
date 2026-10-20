/*
 * ZOMBIES — browser edition.
 * HTML5 Canvas port of the pygame game (main.py / sprites.py / tilemap.py / ui.py).
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------- canvas
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const LEVEL = window.LEVEL;

  // ------------------------------------------------------------- constants
  const FONT_TITLE = '"ZombieFont", Impact, Haettenschweiler, sans-serif';
  const FONT_HUD = '"Impacted", Impact, Haettenschweiler, sans-serif';

  const PLAYER_SPEED = 250;
  const PLAYER_SPRINT_MULT = 1.7;
  const PLAYER_HEALTH = 100;
  const PLAYER_HIT = 35;
  const STAMINA_MAX = 100;
  const STAMINA_DRAIN = 30;
  const STAMINA_REGEN = 20;
  const STAMINA_RECOVER = 25;
  const MOB_HEALTH = 100;
  const MOB_HIT = 35;
  const MOB_DAMAGE = 10;
  const MOB_ATTACK_COOLDOWN = 0.7;
  const MOB_KNOCKBACK = 20;
  const MOB_SPEEDS = [150, 75, 50, 125];
  const AVOID_RADIUS = 50;
  const DETECT_RADIUS = 400;
  const HEALTH_PACK_AMOUNT = 20;

  const WEAPONS = {
    pistol: { rate: 150, speed: 600, life: 1000, kickback: 300, spread: 5, damage: 10, img: 'bullet', count: 1, sound: 'pistol' },
    shotgun: { rate: 900, speed: 400, life: 500, kickback: 300, spread: 20, damage: 5, img: 'bullet_sm', count: 12, sound: 'shotgun' }
  };

  const DAY_DURATION = 60000;
  const NIGHT_DURATION = 60000;
  const TRANSITION = 3000;
  const DARKNESS_ALPHA = 200;
  const FLASHLIGHT_RANGE = 500;
  const FLASHLIGHT_HALF = (55 / 2) * Math.PI / 180;
  const NIGHT_SPAWN_INTERVAL = 5000;
  const SPLAT_BIG = 64;

  // ----------------------------------------------------------------- utils
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rand = (a, b) => a + Math.random() * (b - a);
  const irand = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const keyDown = (code) => !!state.keys[code];

  function inRect(m, r) {
    return m.x >= r.x && m.x <= r.x + r.w && m.y >= r.y && m.y <= r.y + r.h;
  }

  function roundRect(x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function text(str, x, y, size, color, align = 'left', baseline = 'top', font = FONT_HUD) {
    ctx.font = size + 'px ' + font;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  // --------------------------------------------------------------- assets
  const IMG_SRC = {
    player: 'assets/img/player.png',
    zombie: 'assets/img/zombie.png',
    bullet: 'assets/img/bullet.png',
    bullet_sm: 'assets/img/bullet_sm.png',
    splat: 'assets/img/splat.png',
    health: 'assets/img/health.png',
    shotgun: 'assets/img/shotgun.png',
    flash1: 'assets/img/flash1.png',
    flash2: 'assets/img/flash2.png',
    flash3: 'assets/img/flash3.png',
    flash4: 'assets/img/flash4.png',
    crosshair: 'assets/img/crosshair.png',
    map: 'assets/map.png'
  };
  const IMG = {};
  const FLASH_KEYS = ['flash1', 'flash2', 'flash3', 'flash4'];

  function loadImages() {
    return Promise.all(Object.keys(IMG_SRC).map(function (key) {
      return new Promise(function (resolve) {
        const im = new Image();
        im.onload = function () { IMG[key] = im; resolve(); };
        im.onerror = function () { console.error('image failed: ' + IMG_SRC[key]); resolve(); };
        im.src = IMG_SRC[key];
      });
    }));
  }

  const SFX_SRC = {
    pistol: ['assets/snd/pistol.wav'],
    shotgun: ['assets/snd/shotgun.wav'],
    pain: ['assets/snd/pain/8.wav', 'assets/snd/pain/9.wav', 'assets/snd/pain/10.wav', 'assets/snd/pain/11.wav'],
    moan: ['assets/snd/brains2.wav', 'assets/snd/brains3.wav', 'assets/snd/zombie-roar-1.wav', 'assets/snd/zombie-roar-2.wav',
      'assets/snd/zombie-roar-3.wav', 'assets/snd/zombie-roar-5.wav', 'assets/snd/zombie-roar-6.wav', 'assets/snd/zombie-roar-7.wav'],
    splat: ['assets/snd/splat-15.wav'],
    start: ['assets/snd/level_start.wav'],
    health: ['assets/snd/health_pack.wav'],
    pickup: ['assets/snd/gun_pickup.wav']
  };
  const SFX = {};
  let audioStarted = false;

  const music = new Audio('assets/music/level_music.ogg');
  music.loop = true;

  function initAudio() {
    if (!audioStarted) {
      audioStarted = true;
      Object.keys(SFX_SRC).forEach(function (key) {
        SFX[key] = SFX_SRC[key].map(function (src) {
          const a = new Audio();
          a.src = src;
          a.preload = 'auto';
          return a;
        });
      });
      music.volume = settings.music;
      music.play().catch(function () {});
      return;
    }
    if (music.paused) music.play().catch(function () {});
  }

  function sfx(key, volume) {
    const list = SFX[key];
    if (!list || !list.length) return;
    const base = pick(list);
    if (!base) return;
    const a = new Audio(base.src);
    a.volume = clamp(volume, 0, 1);
    a.play().catch(function () {});
  }

  // --------------------------------------------------------------- state
  const settings = { music: 0.5, effects: 0.7, darkness: DARKNESS_ALPHA / 255 };

  const state = {
    screen: 'start',        // 'start' | 'playing' | 'over'
    paused: false,
    win: false,
    overAt: 0,
    time: 0,
    timeMs: 0,
    player: null,
    mobs: [],
    bullets: [],
    items: [],
    flashes: [],
    camera: { x: 0, y: 0 },
    daynight: null,
    ground: null,
    groundCtx: null,
    splatCount: 0,
    mouse: { x: W / 2, y: H / 2, down: false },
    keys: Object.create(null),
    settingsOpen: false,
    startBg: null
  };

  const daynight = {
    timer: 0,
    isNight: false,
    darkness: 0,
    lastSpawn: 0,
    maxDarkness: settings.darkness,
    reset: function () {
      this.timer = 0;
      this.isNight = false;
      this.darkness = 0;
      this.lastSpawn = state.timeMs;
      this.maxDarkness = settings.darkness;
    },
    update: function (dt) {
      this.timer += dt * 1000;
      if (!this.isNight) {
        if (this.timer < DAY_DURATION) {
          if (this.timer > DAY_DURATION - TRANSITION) {
            this.darkness = (this.timer - (DAY_DURATION - TRANSITION)) / TRANSITION * this.maxDarkness;
          } else {
            this.darkness = 0;
          }
        } else {
          this.isNight = true;
          this.timer = 0;
          this.lastSpawn = state.timeMs;
        }
      } else if (this.timer < NIGHT_DURATION) {
        if (this.timer < TRANSITION) {
          this.darkness = this.timer / TRANSITION * this.maxDarkness;
        } else if (this.timer > NIGHT_DURATION - TRANSITION) {
          this.darkness = (1 - (this.timer - (NIGHT_DURATION - TRANSITION)) / TRANSITION) * this.maxDarkness;
        } else {
          this.darkness = this.maxDarkness;
        }
        if (state.timeMs - this.lastSpawn > NIGHT_SPAWN_INTERVAL) {
          this.lastSpawn = state.timeMs;
          spawnZombie();
        }
      } else {
        this.isNight = false;
        this.timer = 0;
        this.darkness = 0;
      }
    },
    timeString: function () {
      const remaining = (this.isNight ? NIGHT_DURATION : DAY_DURATION) - this.timer;
      return (this.isNight ? 'Night ' : 'Day ') + Math.max(0, Math.round(remaining / 1000)) + 's';
    }
  };
  state.daynight = daynight;

  // ------------------------------------------------------------- entities
  function collideAxis(entity, dir, half) {
    for (let i = 0; i < LEVEL.walls.length; i++) {
      const w = LEVEL.walls[i];
      const cx = w[0] + w[2] / 2;
      const cy = w[1] + w[3] / 2;
      if (Math.abs(entity.pos.x - cx) < half + w[2] / 2 &&
          Math.abs(entity.pos.y - cy) < half + w[3] / 2) {
        if (dir === 'x') {
          entity.pos.x = entity.pos.x < cx ? w[0] - half : w[0] + w[2] + half;
          entity.vel.x = 0;
        } else {
          entity.pos.y = entity.pos.y < cy ? w[1] - half : w[1] + w[3] + half;
          entity.vel.y = 0;
        }
      }
    }
  }

  function bulletHitsWall(b) {
    const half = b.size / 2;
    for (let i = 0; i < LEVEL.walls.length; i++) {
      const w = LEVEL.walls[i];
      if (b.pos.x + half > w[0] && b.pos.x - half < w[0] + w[2] &&
          b.pos.y + half > w[1] && b.pos.y - half < w[1] + w[3]) {
        return true;
      }
    }
    return false;
  }

  class Bullet {
    constructor(x, y, angle, speed, weapon) {
      this.pos = { x: x, y: y };
      this.vel = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
      this.weapon = weapon;
      this.born = state.timeMs;
      this.img = IMG[weapon.img];
      this.size = this.img ? this.img.width : 10;
      this.dead = false;
    }
  }

  class Player {
    constructor(x, y) {
      this.pos = { x: x, y: y };
      this.vel = { x: 0, y: 0 };
      this.aim = 0;
      this.health = PLAYER_HEALTH;
      this.weapon = 'pistol';
      this.lastShot = -1e9;
      this.damaged = 0;
      this.stamina = STAMINA_MAX;
      this.exhausted = false;
      this.sprinting = false;
    }

    update(dt) {
      // Aim at the crosshair.
      const wx = state.mouse.x - state.camera.x;
      const wy = state.mouse.y - state.camera.y;
      if (wx !== this.pos.x || wy !== this.pos.y) {
        this.aim = Math.atan2(wy - this.pos.y, wx - this.pos.x);
      }

      // Absolute WASD movement, independent of the aim direction.
      let dx = 0;
      let dy = 0;
      if (keyDown('KeyW') || keyDown('ArrowUp')) dy -= 1;
      if (keyDown('KeyS') || keyDown('ArrowDown')) dy += 1;
      if (keyDown('KeyA') || keyDown('ArrowLeft')) dx -= 1;
      if (keyDown('KeyD') || keyDown('ArrowRight')) dx += 1;
      const len = Math.hypot(dx, dy) || 1;
      const moving = dx !== 0 || dy !== 0;
      const wantSprint = moving && !this.exhausted && this.stamina > 0 &&
        (keyDown('ShiftLeft') || keyDown('ShiftRight'));
      this.sprinting = wantSprint;
      const speed = PLAYER_SPEED * (wantSprint ? PLAYER_SPRINT_MULT : 1);
      this.vel.x = dx / len * speed;
      this.vel.y = dy / len * speed;

      if (wantSprint) {
        this.stamina = Math.max(0, this.stamina - STAMINA_DRAIN * dt);
        if (this.stamina <= 0) this.exhausted = true;
      } else {
        this.stamina = Math.min(STAMINA_MAX, this.stamina + STAMINA_REGEN * dt);
        if (this.exhausted && this.stamina >= STAMINA_RECOVER) this.exhausted = false;
      }

      if (state.mouse.down || keyDown('Space')) this.shoot();

      this.pos.x += this.vel.x * dt;
      collideAxis(this, 'x', PLAYER_HIT / 2);
      this.pos.y += this.vel.y * dt;
      collideAxis(this, 'y', PLAYER_HIT / 2);

      this.damaged = Math.max(0, this.damaged - dt);
    }

    shoot() {
      const w = WEAPONS[this.weapon];
      if (state.timeMs - this.lastShot < w.rate) return;
      this.lastShot = state.timeMs;

      const ca = Math.cos(this.aim);
      const sa = Math.sin(this.aim);
      const bx = this.pos.x + ca * 30 - sa * 10;
      const by = this.pos.y + sa * 30 + ca * 10;

      for (let i = 0; i < w.count; i++) {
        const angle = this.aim + (Math.random() * 2 - 1) * w.spread * Math.PI / 180;
        state.bullets.push(new Bullet(bx, by, angle, w.speed * rand(0.9, 1.1), w));
      }

      // Recoil.
      this.vel.x = -ca * w.kickback;
      this.vel.y = -sa * w.kickback;

      sfx(w.sound, settings.effects * 0.6);
      state.flashes.push({
        x: bx, y: by, born: state.timeMs,
        img: IMG[pick(FLASH_KEYS)], size: irand(20, 50)
      });
    }
  }

  class Zombie {
    constructor(x, y) {
      this.pos = { x: x, y: y };
      this.vel = { x: 0, y: 0 };
      this.aim = 0;
      this.speed = pick(MOB_SPEEDS);
      this.health = MOB_HEALTH;
      this.cooldown = 0;
      this.dead = false;
    }

    update(dt) {
      this.cooldown = Math.max(0, this.cooldown - dt);
      const p = state.player;
      const dx = p.pos.x - this.pos.x;
      const dy = p.pos.y - this.pos.y;
      this.aim = Math.atan2(dy, dx);

      if (dx * dx + dy * dy < DETECT_RADIUS * DETECT_RADIUS && Math.random() < 0.002) {
        sfx('moan', settings.effects * 0.5);
      }

      let ax = Math.cos(this.aim);
      let ay = Math.sin(this.aim);

      for (let i = 0; i < state.mobs.length; i++) {
        const m = state.mobs[i];
        if (m === this || m.dead) continue;
        const ddx = this.pos.x - m.pos.x;
        const ddy = this.pos.y - m.pos.y;
        const d = Math.hypot(ddx, ddy);
        if (d > 0 && d < AVOID_RADIUS) {
          ax += ddx / d;
          ay += ddy / d;
        }
      }

      const alen = Math.hypot(ax, ay);
      if (alen > 0) {
        ax = ax / alen * this.speed;
        ay = ay / alen * this.speed;
      } else {
        ax = Math.cos(this.aim) * this.speed;
        ay = Math.sin(this.aim) * this.speed;
      }
      ax -= this.vel.x;
      ay -= this.vel.y;

      this.vel.x += ax * dt;
      this.vel.y += ay * dt;
      this.pos.x += this.vel.x * dt + 0.5 * ax * dt * dt;
      this.pos.y += this.vel.y * dt + 0.5 * ay * dt * dt;

      collideAxis(this, 'x', MOB_HIT / 2);
      collideAxis(this, 'y', MOB_HIT / 2);
    }
  }

  // --------------------------------------------------------------- world
  function newGame() {
    state.player = new Player(LEVEL.player.x, LEVEL.player.y);
    state.mobs = LEVEL.zombies.map(function (z) { return new Zombie(z.x, z.y); });
    state.items = LEVEL.items.map(function (it) {
      return { type: it.type, x: it.x, y: it.y, phase: Math.random() * Math.PI * 2, taken: false };
    });
    state.bullets = [];
    state.flashes = [];
    state.camera.x = 0;
    state.camera.y = 0;
    daynight.reset();
    state.groundCtx.drawImage(IMG.map, 0, 0);
    state.splatCount = 0;
    state.paused = false;
    state.win = false;
    state.settingsOpen = false;
    state.mouse.down = false;
    state.screen = 'playing';
    updateCamera();
    sfx('start', settings.effects * 0.8);
  }

  function updateCamera() {
    const p = state.player;
    state.camera.x = clamp(-p.pos.x + W / 2, -(LEVEL.width - W), 0);
    state.camera.y = clamp(-p.pos.y + H / 2, -(LEVEL.height - H), 0);
  }

  function spawnZombie() {
    for (let i = 0; i < 20; i++) {
      const x = irand(64, LEVEL.width - 64);
      const y = irand(64, LEVEL.height - 64);
      if (Math.hypot(x - state.player.pos.x, y - state.player.pos.y) > 300) {
        state.mobs.push(new Zombie(x, y));
        return;
      }
    }
  }

  function addHitSplats(x, y, count) {
    const g = state.groundCtx;
    for (let i = 0; i < Math.min(count, 6); i++) {
      const size = irand(10, 22);
      g.save();
      g.globalAlpha = rand(0.55, 0.8);
      g.translate(x + irand(-24, 24), y + irand(-22, 22));
      g.rotate(Math.random() * Math.PI * 2);
      g.drawImage(IMG.splat, -size / 2, -size / 2, size, size);
      g.restore();
      state.splatCount++;
    }
  }

  function addDeathSplat(x, y) {
    const g = state.groundCtx;
    g.save();
    g.translate(x, y);
    g.drawImage(IMG.splat, -SPLAT_BIG / 2, -SPLAT_BIG / 2, SPLAT_BIG, SPLAT_BIG);
    g.restore();
  }

  function killZombie(z) {
    if (z.dead) return;
    z.dead = true;
    sfx('splat', settings.effects * 0.6);
    addDeathSplat(z.pos.x, z.pos.y);
  }

  function gameOver(win) {
    state.win = win;
    state.screen = 'over';
    state.overAt = state.time;
    state.mouse.down = false;
  }

  function updateWorld(dt) {
    const p = state.player;
    p.update(dt);

    // Bullets.
    for (let i = 0; i < state.bullets.length; i++) {
      const b = state.bullets[i];
      b.pos.x += b.vel.x * dt;
      b.pos.y += b.vel.y * dt;
      if (state.timeMs - b.born > b.weapon.life || bulletHitsWall(b)) b.dead = true;
    }

    // Bullet hits.
    for (let i = 0; i < state.bullets.length; i++) {
      const b = state.bullets[i];
      if (b.dead) continue;
      for (let j = 0; j < state.mobs.length; j++) {
        const z = state.mobs[j];
        if (z.dead) continue;
        if (Math.abs(b.pos.x - z.pos.x) < (b.size + MOB_HIT) / 2 &&
            Math.abs(b.pos.y - z.pos.y) < (b.size + MOB_HIT) / 2) {
          z.health -= b.weapon.damage;
          b.dead = true;
          addHitSplats(z.pos.x, z.pos.y, 1);
          sfx('splat', settings.effects * 0.4);
          break;
        }
      }
    }
    state.bullets = state.bullets.filter(function (b) { return !b.dead; });

    // Dead zombies.
    for (let i = 0; i < state.mobs.length; i++) {
      if (state.mobs[i].health <= 0) killZombie(state.mobs[i]);
    }
    state.mobs = state.mobs.filter(function (z) { return !z.dead; });

    // Living zombies.
    for (let i = 0; i < state.mobs.length; i++) state.mobs[i].update(dt);

    // Zombie attacks.
    for (let i = 0; i < state.mobs.length; i++) {
      const z = state.mobs[i];
      if (Math.abs(p.pos.x - z.pos.x) < (PLAYER_HIT + MOB_HIT) / 2 &&
          Math.abs(p.pos.y - z.pos.y) < (PLAYER_HIT + MOB_HIT) / 2) {
        z.vel.x = 0;
        z.vel.y = 0;
        if (z.cooldown <= 0) {
          z.cooldown = MOB_ATTACK_COOLDOWN;
          if (Math.random() < 0.7) sfx('pain', settings.effects);
          p.health -= MOB_DAMAGE;
          p.damaged = 0.35;
          if (p.health <= 0) {
            p.health = 0;
            gameOver(false);
            return;
          }
        }
        p.pos.x += Math.cos(z.aim) * MOB_KNOCKBACK;
        p.pos.y += Math.sin(z.aim) * MOB_KNOCKBACK;
      }
    }

    // Items.
    for (let i = 0; i < state.items.length; i++) {
      const it = state.items[i];
      if (it.taken) continue;
      if (Math.abs(p.pos.x - it.x) < 30 && Math.abs(p.pos.y - it.y) < 30) {
        if (it.type === 'health') {
          if (p.health < PLAYER_HEALTH) {
            p.health = Math.min(PLAYER_HEALTH, p.health + HEALTH_PACK_AMOUNT);
            it.taken = true;
            sfx('health', settings.effects);
          }
        } else {
          p.weapon = 'shotgun';
          it.taken = true;
          sfx('pickup', settings.effects);
        }
      }
    }
    state.items = state.items.filter(function (it) { return !it.taken; });

    updateCamera();
    daynight.update(dt);

    state.flashes = state.flashes.filter(function (f) { return state.timeMs - f.born < 70; });

    if (state.mobs.length === 0) {
      gameOver(true);
    }
  }

  // -------------------------------------------------------------- loading
  function buildStartBg() {
    const bg = document.createElement('canvas');
    bg.width = W;
    bg.height = H;
    const c = bg.getContext('2d');
    c.fillStyle = '#080a08';
    c.fillRect(0, 0, W, H);
    for (let i = 0; i < 16; i++) {
      const size = irand(50, 190);
      c.save();
      c.globalAlpha = rand(0.08, 0.22);
      c.translate(irand(-40, W - 40), irand(-40, H - 40));
      c.rotate(Math.random() * Math.PI * 2);
      c.drawImage(IMG.splat, -size / 2, -size / 2, size, size);
      c.restore();
    }
    state.startBg = bg;
  }

  function startGame() {
    initAudio();
    newGame();
  }

  // ---------------------------------------------------------------- audio
  // (settings volumes are applied on every play; music volume is applied live)

  // ---------------------------------------------------------------- input
  const startButtons = {
    play: { x: W / 2 - 150, y: 470, w: 300, h: 54, label: 'PLAY', accent: '#00ff00' },
    settings: { x: W / 2 - 150, y: 538, w: 300, h: 54, label: 'SETTINGS', accent: '#ffffff' },
    fullscreen: { x: W / 2 - 150, y: 606, w: 300, h: 54, label: 'FULLSCREEN', accent: '#6ea8ff' }
  };
  const settingsBtn = { x: W - 130, y: 90, w: 120, h: 34 };
  const closeBtn = { x: W / 2 - 80, y: H - 120, w: 160, h: 50 };

  const sliders = [
    { key: 'music', label: 'MUSIC VOLUME', x: W / 2 - 180, y: 220, w: 360, h: 16, min: 0, max: 1 },
    { key: 'effects', label: 'EFFECTS VOLUME', x: W / 2 - 180, y: 290, w: 360, h: 16, min: 0, max: 1 },
    { key: 'darkness', label: 'NIGHT DARKNESS', x: W / 2 - 180, y: 360, w: 360, h: 16, min: 0.3, max: 1 }
  ];
  let dragging = null;

  function applySetting(key) {
    if (key === 'music') {
      music.volume = clamp(settings.music, 0, 1);
    } else if (key === 'darkness') {
      daynight.maxDarkness = settings.darkness;
    }
  }

  function setSliderFromMouse(s, mx) {
    const t = clamp((mx - s.x) / s.w, 0, 1);
    settings[s.key] = s.min + t * (s.max - s.min);
    applySetting(s.key);
  }

  function settingsClick(m) {
    for (let i = 0; i < sliders.length; i++) {
      const s = sliders[i];
      if (inRect(m, { x: s.x, y: s.y - 6, w: s.w, h: s.h + 12 })) {
        dragging = s;
        setSliderFromMouse(s, m.x);
        return;
      }
    }
    if (inRect(m, closeBtn)) {
      state.settingsOpen = false;
    }
  }

  function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        const req = document.documentElement.requestFullscreen;
        if (req) req.call(document.documentElement);
      } else if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    } catch (e) { /* ignore */ }
  }

  function onMouseDown(m) {
    initAudio();
    if (state.screen === 'start') {
      if (state.settingsOpen) { settingsClick(m); return; }
      if (inRect(m, startButtons.play)) { startGame(); return; }
      if (inRect(m, startButtons.settings)) { state.settingsOpen = true; return; }
      if (inRect(m, startButtons.fullscreen)) { toggleFullscreen(); return; }
      return;
    }
    if (state.screen === 'over') {
      if (state.time - state.overAt > 0.4) startGame();
      return;
    }
    if (state.settingsOpen) { settingsClick(m); return; }
    if (state.paused) return;
    if (inRect(m, settingsBtn)) { state.settingsOpen = true; return; }
    state.mouse.down = true;
  }

  function toCanvas(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: clamp((e.clientX - r.left) * (W / r.width), 0, W),
      y: clamp((e.clientY - r.top) * (H / r.height), 0, H)
    };
  }

  canvas.addEventListener('mousemove', function (e) {
    const m = toCanvas(e);
    state.mouse.x = m.x;
    state.mouse.y = m.y;
    if (dragging) setSliderFromMouse(dragging, m.x);
  });

  canvas.addEventListener('mousedown', function (e) {
    if (e.button !== 0) return;
    const m = toCanvas(e);
    state.mouse.x = m.x;
    state.mouse.y = m.y;
    onMouseDown(m);
  });

  window.addEventListener('mouseup', function () {
    state.mouse.down = false;
    dragging = null;
  });

  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  window.addEventListener('keydown', function (e) {
    state.keys[e.code] = true;
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'ArrowLeft' ||
        e.code === 'ArrowRight' || e.code === 'Space') {
      e.preventDefault();
    }
    if (e.repeat) return;
    initAudio();

    if (state.screen === 'start') {
      if (state.settingsOpen) {
        if (e.code === 'Escape') state.settingsOpen = false;
        return;
      }
      if (e.code === 'Enter' || e.code === 'Space') startGame();
      return;
    }
    if (state.screen === 'over') return;
    if (state.settingsOpen) {
      if (e.code === 'Escape') state.settingsOpen = false;
      return;
    }
    if (e.code === 'KeyP' || e.code === 'Escape') {
      state.paused = !state.paused;
    }
  });

  window.addEventListener('keyup', function (e) {
    state.keys[e.code] = false;
    if (state.screen === 'over' && state.time - state.overAt > 0.4) startGame();
  });

  window.addEventListener('blur', function () {
    state.keys = Object.create(null);
    state.mouse.down = false;
    dragging = null;
  });

  // -------------------------------------------------------------- drawing
  function drawSprite(img, x, y, angle, size) {
    if (!img) return;
    ctx.save();
    ctx.translate(Math.round(x + state.camera.x), Math.round(y + state.camera.y));
    if (angle) ctx.rotate(angle);
    if (size) {
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
    } else {
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
    }
    ctx.restore();
  }

  let playerTint = null;
  function getPlayerTint() {
    if (!playerTint) {
      playerTint = document.createElement('canvas');
      playerTint.width = IMG.player.width;
      playerTint.height = IMG.player.height;
      const c = playerTint.getContext('2d');
      c.drawImage(IMG.player, 0, 0);
      c.globalCompositeOperation = 'source-atop';
      c.fillStyle = 'rgba(255, 0, 0, 0.55)';
      c.fillRect(0, 0, playerTint.width, playerTint.height);
    }
    return playerTint;
  }

  function drawZombieBar(z) {
    if (z.health >= MOB_HEALTH) return;
    const pct = clamp(z.health / MOB_HEALTH, 0, 1);
    const bw = 40;
    const bh = 5;
    const sx = Math.round(z.pos.x + state.camera.x - bw / 2);
    const sy = Math.round(z.pos.y + state.camera.y - IMG.zombie.height / 2 - 12);
    ctx.fillStyle = '#282828';
    ctx.fillRect(sx, sy, bw, bh);
    ctx.fillStyle = pct > 0.6 ? '#00ff00' : pct > 0.3 ? '#ffff00' : '#ff0000';
    ctx.fillRect(sx, sy, bw * pct, bh);
  }

  const nightCanvas = document.createElement('canvas');
  nightCanvas.width = W;
  nightCanvas.height = H;
  const nctx = nightCanvas.getContext('2d');

  function drawNight() {
    if (daynight.darkness <= 0.01) return;
    const p = state.player;
    const px = p.pos.x + state.camera.x;
    const py = p.pos.y + state.camera.y;

    nctx.clearRect(0, 0, W, H);
    nctx.globalCompositeOperation = 'source-over';
    nctx.fillStyle = 'rgba(0,0,0,' + daynight.darkness.toFixed(3) + ')';
    nctx.fillRect(0, 0, W, H);

    if (daynight.darkness > 0.3) {
      nctx.globalCompositeOperation = 'destination-out';
      const layers = [[1.0, 0.78], [0.9, 0.84], [0.78, 0.9], [0.62, 0.96], [0.45, 1.0]];
      for (let i = 0; i < layers.length; i++) {
        const reach = FLASHLIGHT_RANGE * layers[i][0];
        nctx.fillStyle = 'rgba(0,0,0,' + layers[i][1] + ')';
        nctx.beginPath();
        nctx.moveTo(px, py);
        nctx.arc(px, py, reach, p.aim - FLASHLIGHT_HALF, p.aim + FLASHLIGHT_HALF);
        nctx.closePath();
        nctx.fill();
      }
      const halo = nctx.createRadialGradient(px, py, 0, px, py, 58);
      halo.addColorStop(0, 'rgba(0,0,0,1)');
      halo.addColorStop(0.55, 'rgba(0,0,0,0.85)');
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      nctx.fillStyle = halo;
      nctx.beginPath();
      nctx.arc(px, py, 58, 0, Math.PI * 2);
      nctx.fill();
      nctx.globalCompositeOperation = 'source-over';
    }
    ctx.drawImage(nightCanvas, 0, 0);
  }

  function drawWorld() {
    const cam = state.camera;
    ctx.drawImage(state.ground, -cam.x, -cam.y, W, H, 0, 0, W, H);

    for (let i = 0; i < state.items.length; i++) {
      const it = state.items[i];
      const img = it.type === 'health' ? IMG.health : IMG.shotgun;
      const bob = Math.sin(state.time * 2 + it.phase) * 4;
      drawSprite(img, it.x, it.y + bob, 0);
    }

    const p = state.player;
    drawSprite(p.damaged > 0 ? getPlayerTint() : IMG.player, p.pos.x, p.pos.y, p.aim);

    for (let i = 0; i < state.mobs.length; i++) {
      const z = state.mobs[i];
      drawSprite(IMG.zombie, z.pos.x, z.pos.y, z.aim);
      drawZombieBar(z);
    }

    for (let i = 0; i < state.bullets.length; i++) {
      const b = state.bullets[i];
      drawSprite(b.img, b.pos.x, b.pos.y, 0);
    }

    for (let i = 0; i < state.flashes.length; i++) {
      const f = state.flashes[i];
      const age = (state.timeMs - f.born) / 70;
      ctx.globalAlpha = clamp(1 - age, 0, 1);
      drawSprite(f.img, f.x, f.y, 0, f.size);
      ctx.globalAlpha = 1;
    }

    drawNight();
  }

  function drawButton(b) {
    const hover = inRect(state.mouse, b);
    ctx.fillStyle = hover ? '#5a5a5a' : '#1e1e1e';
    roundRect(b.x, b.y, b.w, b.h, 10);
    ctx.fill();
    ctx.strokeStyle = b.accent;
    ctx.lineWidth = 2;
    roundRect(b.x, b.y, b.w, b.h, 10);
    ctx.stroke();
    text(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1, 34, '#ffffff', 'center', 'middle');
  }

  function drawStart() {
    ctx.drawImage(state.startBg, 0, 0);

    text('ZOMBIES', W / 2 + 5, 112, 120, '#000000', 'center', 'middle', FONT_TITLE);
    text('ZOMBIES', W / 2, 106, 120, '#ff0000', 'center', 'middle', FONT_TITLE);
    text('SURVIVE THE NIGHT', W / 2, 188, 34, '#00ff00', 'center', 'middle');

    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 300, 222);
    ctx.lineTo(W / 2 + 300, 222);
    ctx.stroke();

    const lines = [
      'You are trapped in a town full of zombies.',
      'Kill every zombie to clear the level.',
      'At night it gets dark and new zombies come.',
      'Grab medkits and the shotgun to stay alive.'
    ];
    for (let i = 0; i < lines.length; i++) {
      text(lines[i], W / 2, 252 + i * 32, 24, '#ffffff', 'center', 'middle');
    }

    text('WASD - MOVE    SHIFT - SPRINT    MOUSE - AIM    LMB / SPACE - SHOOT    P - PAUSE',
      W / 2, 400, 20, '#9a9a9a', 'center', 'middle');

    drawButton(startButtons.play);
    drawButton(startButtons.settings);
    drawButton(startButtons.fullscreen);

    text('BROWSER EDITION', W / 2, 700, 18, '#777777', 'center', 'middle');

    if (state.settingsOpen) drawSettings();
  }

  function drawSettingsButton() {
    const hover = inRect(state.mouse, settingsBtn);
    ctx.fillStyle = hover ? '#646464' : '#282828';
    roundRect(settingsBtn.x, settingsBtn.y, settingsBtn.w, settingsBtn.h, 6);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    roundRect(settingsBtn.x, settingsBtn.y, settingsBtn.w, settingsBtn.h, 6);
    ctx.stroke();
    text('SETTINGS', settingsBtn.x + settingsBtn.w / 2, settingsBtn.y + settingsBtn.h / 2 + 1,
      20, '#ffffff', 'center', 'middle');
  }

  function drawHUD() {
    const p = state.player;
    const pct = clamp(p.health / PLAYER_HEALTH, 0, 1);
    ctx.fillStyle = pct > 0.6 ? '#00ff00' : pct > 0.3 ? '#ffff00' : '#ff0000';
    ctx.fillRect(10, 10, 100 * pct, 20);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, 100, 20);

    // Stamina.
    const st = clamp(p.stamina / STAMINA_MAX, 0, 1);
    ctx.fillStyle = '#0a2a33';
    ctx.fillRect(10, 36, 100, 10);
    ctx.fillStyle = st > 0.25 ? '#00c8ff' : '#ffa000';
    ctx.fillRect(10, 36, 100 * st, 10);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(10, 36, 100, 10);

    text('ZOMBIES ' + state.mobs.length, W - 10, 8, 30, '#ffffff', 'right', 'top');
    text(daynight.timeString(), W - 10, 48, 30,
      daynight.isNight ? '#96b4ff' : '#fff096', 'right', 'top');

    drawSettingsButton();
  }

  function drawPause() {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, W, H);
    text('PAUSED', W / 2, H / 2, 120, '#ff0000', 'center', 'middle', FONT_TITLE);
    text('PRESS P TO RESUME', W / 2, H / 2 + 90, 24, '#ffffff', 'center', 'middle');
  }

  function drawOver() {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);
    if (state.win) {
      text('YOU WIN', W / 2, H / 2, 110, '#00ff00', 'center', 'middle', FONT_TITLE);
      text('ALL ZOMBIES ARE DEAD', W / 2, H / 2 + 70, 30, '#ffffff', 'center', 'middle');
    } else {
      text('GAME OVER', W / 2, H / 2, 110, '#ff0000', 'center', 'middle', FONT_TITLE);
      text('THE ZOMBIES GOT YOU', W / 2, H / 2 + 70, 30, '#ffffff', 'center', 'middle');
    }
    text('PRESS A KEY TO START', W / 2, H * 0.75, 60, '#ffffff', 'center', 'middle', FONT_TITLE);
  }

  function drawSlider(s) {
    const t = clamp((settings[s.key] - s.min) / (s.max - s.min), 0, 1);

    ctx.fillStyle = '#282828';
    roundRect(s.x, s.y, s.w, s.h, 6);
    ctx.fill();

    if (t > 0) {
      ctx.fillStyle = '#00ff00';
      roundRect(s.x, s.y, s.w * t, s.h, 6);
      ctx.fill();
    }

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    roundRect(s.x, s.y, s.w, s.h, 6);
    ctx.stroke();

    const kx = s.x + s.w * t;
    const ky = s.y + s.h / 2;
    ctx.beginPath();
    ctx.arc(kx, ky, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#000000';
    ctx.stroke();

    text(s.label, s.x, s.y - 28, 22, '#ffffff', 'left', 'top');
    text(Math.round(settings[s.key] * 100) + '%', s.x + s.w + 15, s.y - 3, 22, '#ffff00', 'left', 'top');
  }

  function drawSettings() {
    ctx.fillStyle = 'rgba(0,0,0,0.94)';
    ctx.fillRect(0, 0, W, H);

    text('SETTINGS', W / 2, 130, 60, '#ffffff', 'center', 'middle', FONT_TITLE);

    for (let i = 0; i < sliders.length; i++) drawSlider(sliders[i]);

    const hover = inRect(state.mouse, closeBtn);
    ctx.fillStyle = hover ? '#ff0000' : '#962828';
    roundRect(closeBtn.x, closeBtn.y, closeBtn.w, closeBtn.h, 8);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    roundRect(closeBtn.x, closeBtn.y, closeBtn.w, closeBtn.h, 8);
    ctx.stroke();
    text('CLOSE', closeBtn.x + closeBtn.w / 2, closeBtn.y + closeBtn.h / 2 + 1,
      30, '#ffffff', 'center', 'middle');
  }

  function drawCrosshair() {
    if (!IMG.crosshair) return;
    const x = Math.round(state.mouse.x) - IMG.crosshair.width / 2;
    const y = Math.round(state.mouse.y) - IMG.crosshair.height / 2;
    ctx.drawImage(IMG.crosshair, x, y);
  }

  function render() {
    if (state.screen === 'start') {
      drawStart();
    } else if (state.screen === 'over') {
      drawOver();
    } else {
      drawWorld();
      drawHUD();
      if (state.paused) drawPause();
      if (state.settingsOpen) drawSettings();
    }
    drawCrosshair();
  }

  // ------------------------------------------------------------- main loop
  function update(dt) {
    if (state.screen !== 'playing') return;
    if (state.paused || state.settingsOpen) return;
    updateWorld(dt);
  }

  let lastT = 0;
  function frame(t) {
    const dt = clamp((t - lastT) / 1000, 0, 0.05);
    lastT = t;
    state.time += dt;
    state.timeMs = t;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------- selftest
  function runSelfTest() {
    const results = [];
    const ok = function (name, cond, info) {
      results.push({ name: name, pass: !!cond, info: info === undefined ? '' : String(info) });
    };

    try {
      newGame();
      ok('level: 10 zombies', state.mobs.length === 10, state.mobs.length);
      ok('level: 2 items (health + shotgun)', state.items.length === 2, state.items.length);
      ok('level: 32 walls', LEVEL.walls.length === 32, LEVEL.walls.length);

      const p = state.player;
      state.camera.x = 0;
      state.camera.y = 0;
      state.mouse.down = false;

      state.mouse.x = p.pos.x + 100;
      state.mouse.y = p.pos.y;
      p.update(1 / 60);
      ok('aim right', Math.abs(p.aim) < 1e-6, p.aim.toFixed(3));

      state.mouse.x = p.pos.x;
      state.mouse.y = p.pos.y - 100;
      p.update(1 / 60);
      ok('aim up', Math.abs(p.aim + Math.PI / 2) < 1e-6, p.aim.toFixed(3));

      // Movement is absolute (cursor stays up, D still moves right).
      p.pos = { x: 200, y: 400 };
      p.vel = { x: 0, y: 0 };
      state.keys = Object.create(null);
      state.keys.KeyD = true;
      for (let i = 0; i < 20; i++) p.update(1 / 60);
      ok('WASD moves right while aiming up', p.pos.x > 240 && Math.abs(p.pos.y - 400) < 0.01,
        'x=' + p.pos.x.toFixed(1) + ' y=' + p.pos.y.toFixed(1));
      state.keys = Object.create(null);

      // Shooting (clear vertical corridor at x = 200).
      state.mobs = [];
      state.bullets = [];
      state.items = [];
      p.pos = { x: 200, y: 500 };
      p.health = 100;
      p.weapon = 'pistol';
      p.lastShot = -1e9;
      const z = new Zombie(200, 300);
      state.mobs.push(z);
      state.camera.x = 0;
      state.camera.y = 0;
      state.mouse.x = 200;
      state.mouse.y = 300;
      state.mouse.down = true;
      const hp0 = z.health;
      const splats0 = state.splatCount;
      for (let i = 0; i < 50; i++) {
        state.timeMs += 16;
        updateWorld(1 / 60);
      }
      state.mouse.down = false;
      ok('shooting damages a zombie', z.health < hp0, hp0 + ' -> ' + z.health);
      ok('hit splats spawn', state.splatCount > splats0, state.splatCount);

      // Night.
      newGame();
      state.daynight.isNight = true;
      state.daynight.timer = 0;
      state.daynight.maxDarkness = 0.78;
      for (let i = 0; i < 240; i++) {
        state.timeMs += 16;
        state.daynight.update(1 / 60);
      }
      ok('night gets dark', state.daynight.darkness > 0.7, state.daynight.darkness.toFixed(2));

      // Medkit pickup.
      newGame();
      state.mobs = [new Zombie(3000, 1800)];
      const medkit = state.items.find(function (it) { return it.type === 'health'; });
      state.player.pos = { x: medkit.x - 20, y: medkit.y };
      state.player.health = 50;
      updateWorld(1 / 60);
      ok('medkit heals +20', state.player.health === 70, state.player.health);

      // Shotgun pickup.
      newGame();
      state.mobs = [new Zombie(3000, 1800)];
      const gun = state.items.find(function (it) { return it.type === 'shotgun'; });
      state.player.pos = { x: gun.x - 20, y: gun.y };
      updateWorld(1 / 60);
      ok('shotgun pickup', state.player.weapon === 'shotgun', state.player.weapon);

      // Zombie hit + attack cooldown.
      newGame();
      state.player.pos = { x: 200, y: 500 };
      state.player.health = 100;
      state.mobs = [new Zombie(200, 500)];
      updateWorld(1 / 60);
      const afterFirstHit = state.player.health;
      updateWorld(1 / 60);
      ok('zombie hit: 10 dmg, then cooldown',
        afterFirstHit === 90 && state.player.health === 90,
        afterFirstHit + ' / ' + state.player.health);

      // Sprint + stamina.
      newGame();
      state.mobs = [];
      state.keys = Object.create(null);
      const runner = state.player;
      runner.pos = { x: 200, y: 250 };
      state.keys.KeyD = true;
      runner.update(1 / 60);
      const walkSpeed = Math.abs(runner.vel.x);
      state.keys.ShiftLeft = true;
      runner.update(1 / 60);
      const sprintSpeed = Math.abs(runner.vel.x);
      const staminaAfterOneStep = runner.stamina;
      for (let i = 0; i < 30; i++) runner.update(1 / 60);
      ok('Shift sprints (250 -> 425)',
        Math.abs(walkSpeed - 250) < 0.1 && Math.abs(sprintSpeed - 425) < 0.1,
        walkSpeed + ' / ' + sprintSpeed);
      ok('sprint drains stamina', runner.stamina < staminaAfterOneStep - 10,
        runner.stamina.toFixed(1));
      state.keys = Object.create(null);

      // Win.
      newGame();
      state.mobs = [];
      updateWorld(1 / 60);
      ok('win when all zombies are dead', state.screen === 'over' && state.win === true, state.screen);

      // UI wiring.
      state.screen = 'start';
      state.settingsOpen = false;
      onMouseDown({ x: startButtons.play.x + 10, y: startButtons.play.y + 10 });
      ok('PLAY button starts the game', state.screen === 'playing', state.screen);

      state.screen = 'start';
      state.settingsOpen = true;
      const musicSlider = sliders[0];
      settingsClick({ x: musicSlider.x + musicSlider.w * 0.75, y: musicSlider.y + 8 });
      ok('settings slider works', Math.abs(settings.music - 0.75) < 0.03, settings.music.toFixed(2));
      settingsClick({ x: closeBtn.x + 5, y: closeBtn.y + 5 });
      ok('settings close button', state.settingsOpen === false, state.settingsOpen);
    } catch (err) {
      results.push({ name: 'EXCEPTION: ' + err.message, pass: false, info: '' });
    }

    const failed = results.filter(function (r) { return !r.pass; }).length;
    document.title = failed ? 'SELFTEST FAIL (' + failed + ')' : 'SELFTEST OK';

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);
    text('SELFTEST ' + (failed ? 'FAIL' : 'OK'), W / 2, 46, 40,
      failed ? '#ff0000' : '#00ff00', 'center', 'middle');

    let y = 100;
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      text((r.pass ? 'PASS  ' : 'FAIL  ') + r.name, 60, y, 20,
        r.pass ? '#66ff66' : '#ff7777', 'left', 'middle');
      if (r.info) text(r.info, W - 60, y, 18, '#888888', 'right', 'middle');
      y += 34;
    }
  }

  // ----------------------------------------------------------------- init
  function resize() {
    const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
    canvas.style.width = Math.round(W * scale) + 'px';
    canvas.style.height = Math.round(H * scale) + 'px';
  }

  function loadFonts() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all([
      document.fonts.load('120px ZombieFont'),
      document.fonts.load('30px Impacted'),
      document.fonts.load('34px Impacted')
    ]).catch(function () {});
  }

  window.addEventListener('resize', resize);
  resize();

  window.addEventListener('error', function (e) {
    let el = document.getElementById('err');
    if (!el) {
      el = document.createElement('div');
      el.id = 'err';
      document.body.appendChild(el);
    }
    el.textContent += 'Error: ' + e.message + ' (' + (e.filename || '') + ':' + (e.lineno || 0) + ')\n';
  });

  Promise.all([loadImages(), loadFonts()]).then(function () {
    state.ground = document.createElement('canvas');
    state.ground.width = LEVEL.width;
    state.ground.height = LEVEL.height;
    state.groundCtx = state.ground.getContext('2d');
    state.groundCtx.drawImage(IMG.map, 0, 0);

    buildStartBg();

    document.getElementById('loading').classList.add('hidden');

    const query = new URLSearchParams(window.location.search);
    if (query.has('selftest')) {
      runSelfTest();
      return;
    }
    if (query.has('play')) {
      startGame();
      // Dev helper: ?play=600 advances the simulation before the first paint.
      const steps = Math.min(20000, parseInt(query.get('play') || '0', 10) || 0);
      for (let i = 0; i < steps; i++) {
        state.time += 1 / 60;
        state.timeMs += 16.666;
        update(1 / 60);
        if (state.screen !== 'playing') break;
      }
    }
    if (query.has('night')) {
      if (state.screen === 'start') startGame();
      daynight.isNight = true;
      daynight.timer = 5000;
      daynight.darkness = daynight.maxDarkness;
    }
    if (query.has('menu')) {
      state.settingsOpen = true;
    }
    lastT = performance.now();
    requestAnimationFrame(frame);
  });
})();
