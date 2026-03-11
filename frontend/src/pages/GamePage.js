import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { Trophy, Frown, ArrowRight, Gamepad2, Zap, Swords } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ── Round Configurations ─────────────────────────────────────────────────────
const ROUND_CONFIGS = [
  {
    round: 1, label: "Challenger",
    enemyHp: 105, enemySpeed: 140, shootInterval: 1.65, bulletDmg: 13,
    burstCount: 1, aimSpread: 200, timeLimit: 62, enrageAt: 0,
    tip: "← → to dodge · Click / Space to shoot",
  },
  {
    round: 2, label: "Veteran",
    enemyHp: 155, enemySpeed: 200, shootInterval: 1.1, bulletDmg: 17,
    burstCount: 1, aimSpread: 130, timeLimit: 56, enrageAt: 0,
    tip: "Faster & more accurate — keep moving!",
  },
  {
    round: 3, label: "BOSS",
    enemyHp: 200, enemySpeed: 250, shootInterval: 0.82, bulletDmg: 21,
    burstCount: 2, aimSpread: 80, timeLimit: 50, enrageAt: 0.3,
    tip: "DOUBLE BULLETS! Enrages at low HP — GO ALL OUT!",
  },
];

// ── Game Engine (Vertical Fullscreen Arena) ──────────────────────────────────
class SmashKartGame {
  constructor(canvas, orderTotal, roundConfig, initialHp = 100) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    canvas.width = this.W;
    canvas.height = this.H;
    this.rc = roundConfig;
    this.onRoundOver = null;

    if (orderTotal >= 1500) this.playerDmg = 23;
    else if (orderTotal >= 700) this.playerDmg = 16;
    else if (orderTotal >= 300) this.playerDmg = 11;
    else this.playerDmg = 7;

    this.initialHp = initialHp;
    this._initState();
    this._initStars();
  }

  _initStars() {
    this.stars = Array.from({ length: 90 }, () => ({
      x: Math.random() * this.W,
      y: Math.random() * this.H,
      r: 0.4 + Math.random() * 1.6,
      twinkleOff: Math.random() * Math.PI * 2,
    }));
  }

  _initState() {
    const { W, H, rc } = this;
    const kw = 52, kh = 68;

    this.player = {
      x: W / 2 - kw / 2, y: H - 130, w: kw, h: kh,
      hp: this.initialHp, maxHp: 100, speed: 320,
      hitFlash: 0,
    };
    this.enemy = {
      x: W / 2 - kw / 2, y: 72, w: kw, h: kh,
      hp: rc.enemyHp, maxHp: rc.enemyHp,
      speed: rc.enemySpeed, targetX: W / 2,
      moveTimer: 0, shootCooldown: rc.shootInterval * 0.6,
      enraged: false, flashTimer: 0,
    };
    this.pBullets = [];
    this.eBullets = [];
    this.particles = [];
    this.screenShake = 0;
    this.gameOver = false;
    this.won = false;
    this.timeLeft = rc.timeLimit;
    this.lastTs = null;
    this.shootCooldown = 0;
    this.keys = {};
    this.raf = null;
    this.time = 0;
  }

  setupInput() {
    this._kd = (e) => {
      if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].includes(e.key)) e.preventDefault();
      this.keys[e.key] = true;
      if (e.key === " " || e.key === "Enter") this._shoot();
    };
    this._ku = (e) => { this.keys[e.key] = false; };
    this._click = () => this._shoot();
    this._tm = (e) => {
      e.preventDefault();
      const t = e.touches[0];
      const r = this.canvas.getBoundingClientRect();
      const x = ((t.clientX - r.left) / r.width) * this.W;
      this.player.x = Math.max(10, Math.min(this.W - this.player.w - 10, x - this.player.w / 2));
    };
    this._ts = (e) => {
      e.preventDefault();
      this._shoot();
      const t = e.touches[0];
      const r = this.canvas.getBoundingClientRect();
      const x = ((t.clientX - r.left) / r.width) * this.W;
      this.player.x = Math.max(10, Math.min(this.W - this.player.w - 10, x - this.player.w / 2));
    };
    document.addEventListener("keydown", this._kd);
    document.addEventListener("keyup", this._ku);
    this.canvas.addEventListener("click", this._click);
    this.canvas.addEventListener("touchmove", this._tm, { passive: false });
    this.canvas.addEventListener("touchstart", this._ts, { passive: false });
  }

  cleanup() {
    document.removeEventListener("keydown", this._kd);
    document.removeEventListener("keyup", this._ku);
    if (this.canvas) {
      this.canvas.removeEventListener("click", this._click);
      this.canvas.removeEventListener("touchmove", this._tm);
      this.canvas.removeEventListener("touchstart", this._ts);
    }
    if (this.raf) cancelAnimationFrame(this.raf);
  }

  _shoot() {
    if (this.gameOver || this.shootCooldown > 0) return;
    const p = this.player;
    this.pBullets.push({
      x: p.x + p.w / 2 - 5, y: p.y, w: 10, h: 24,
      vy: -650, vx: 0, dmg: this.playerDmg,
    });
    this.shootCooldown = 0.35;
    this._splash(p.x + p.w / 2, p.y, "#F97316", 4);
  }

  _hit(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  _splash(x, y, color, n = 7) {
    for (let i = 0; i < n; i++) {
      const ang = (Math.PI * 2 * i) / n + Math.random() * 0.6;
      const spd = 60 + Math.random() * 130;
      this.particles.push({
        x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
        r: 2.5 + Math.random() * 4.5, life: 0.5 + Math.random() * 0.35, maxLife: 0.85, color,
      });
    }
  }

  _enemyShoot() {
    const { enemy: e, player: p, rc } = this;
    const isEnraged = e.enraged;
    const spread = isEnraged ? rc.aimSpread * 0.4 : rc.aimSpread;
    const baseSpeed = isEnraged ? 420 : 350;

    const makeBullet = (offsetX = 0) => {
      const targetX = p.x + p.w / 2 + (Math.random() - 0.5) * spread + offsetX;
      const dx = targetX - (e.x + e.w / 2);
      const dy = (p.y + p.h / 2) - (e.y + e.h);
      const angle = Math.atan2(dy, dx);
      return {
        x: e.x + e.w / 2 - 4, y: e.y + e.h,
        w: 8, h: 18,
        vx: Math.cos(angle) * baseSpeed,
        vy: Math.sin(angle) * baseSpeed,
        dmg: rc.bulletDmg + (isEnraged ? 4 : 0),
      };
    };

    if (rc.burstCount >= 2) {
      this.eBullets.push(makeBullet(-50));
      this.eBullets.push(makeBullet(50));
      if (isEnraged) this.eBullets.push(makeBullet(0));
    } else {
      this.eBullets.push(makeBullet(0));
    }
  }

  update(dt) {
    if (this.gameOver) return;
    this.time += dt;

    this.timeLeft = Math.max(0, this.timeLeft - dt);
    if (this.timeLeft <= 0) {
      this.gameOver = true; this.won = false;
      if (this.onRoundOver) this.onRoundOver(false, this.player.hp);
      return;
    }

    const { player: p, enemy: e, rc } = this;

    if (this.screenShake > 0) this.screenShake = Math.max(0, this.screenShake - dt * 14);
    if (p.hitFlash > 0) p.hitFlash = Math.max(0, p.hitFlash - dt * 8);
    if (e.flashTimer > 0) e.flashTimer = Math.max(0, e.flashTimer - dt * 8);

    // Player movement (LEFT / RIGHT)
    const spd = p.speed * dt;
    if (this.keys["ArrowLeft"] || this.keys["a"] || this.keys["A"]) p.x = Math.max(10, p.x - spd);
    if (this.keys["ArrowRight"] || this.keys["d"] || this.keys["D"]) p.x = Math.min(this.W - p.w - 10, p.x + spd);
    if (this.shootCooldown > 0) this.shootCooldown -= dt;

    // Enemy enrage
    if (rc.enrageAt > 0 && !e.enraged && e.hp < rc.enemyHp * rc.enrageAt) {
      e.enraged = true;
    }

    // Enemy movement (LEFT / RIGHT)
    e.moveTimer -= dt;
    if (e.moveTimer <= 0) {
      const variance = rc.round === 3 ? 0.4 : rc.round === 2 ? 0.65 : 1.0;
      e.targetX = 30 + Math.random() * (this.W - e.w - 60);
      e.moveTimer = variance + Math.random() * variance;
    }
    const dx = e.targetX - e.x;
    if (Math.abs(dx) > 2) e.x += Math.sign(dx) * Math.min(Math.abs(dx), e.speed * dt);

    // Enemy shooting
    const interval = e.enraged ? rc.shootInterval * 0.45 : rc.shootInterval;
    e.shootCooldown -= dt;
    if (e.shootCooldown <= 0) {
      this._enemyShoot();
      e.shootCooldown = interval + (Math.random() - 0.5) * 0.2;
    }

    // Player bullets → enemy
    for (let i = this.pBullets.length - 1; i >= 0; i--) {
      const b = this.pBullets[i];
      b.y += b.vy * dt;
      b.x += (b.vx || 0) * dt;
      if (b.y + b.h < 0) { this.pBullets.splice(i, 1); continue; }
      if (this._hit(b, e)) {
        this._splash(b.x + b.w / 2, b.y, "#F97316", 9);
        e.hp = Math.max(0, e.hp - b.dmg);
        e.flashTimer = 1;
        this.pBullets.splice(i, 1);
        if (e.hp <= 0) {
          this.gameOver = true; this.won = true;
          this._splash(e.x + e.w / 2, e.y + e.h / 2, "#FBBF24", 22);
          if (this.onRoundOver) this.onRoundOver(true, p.hp);
          return;
        }
      }
    }

    // Enemy bullets → player
    for (let i = this.eBullets.length - 1; i >= 0; i--) {
      const b = this.eBullets[i];
      b.y += b.vy * dt;
      b.x += (b.vx || 0) * dt;
      if (b.y > this.H || b.x < -20 || b.x > this.W + 20) { this.eBullets.splice(i, 1); continue; }
      if (this._hit(b, p)) {
        this._splash(b.x + b.w / 2, b.y + b.h, "#DC2626", 9);
        p.hp = Math.max(0, p.hp - b.dmg);
        p.hitFlash = 1;
        this.screenShake = 0.35;
        this.eBullets.splice(i, 1);
        if (p.hp <= 0) {
          this.gameOver = true; this.won = false;
          if (this.onRoundOver) this.onRoundOver(false, 0);
          return;
        }
      }
    }

    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }
  }

  // ── Vehicle drawing (top-down view) ──────────────────────────────────────────
  _drawVehicle(v, isPlayer, enraged = false) {
    const { ctx } = this;
    const cx = v.x + v.w / 2;
    const hw = v.w / 2;

    // Hit flash aura
    if (isPlayer && v.hitFlash > 0) {
      ctx.save(); ctx.globalAlpha = v.hitFlash * 0.4;
      ctx.fillStyle = "#EF4444";
      ctx.beginPath(); ctx.arc(cx, v.y + v.h / 2, v.w, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    if (!isPlayer && v.flashTimer > 0) {
      ctx.save(); ctx.globalAlpha = v.flashTimer * 0.45;
      ctx.fillStyle = "#FBBF24";
      ctx.beginPath(); ctx.arc(cx, v.y + v.h / 2, v.w, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    const bodyColor = isPlayer ? "#F97316" : (enraged ? "#FF1A1A" : "#DC2626");
    const darkColor = isPlayer ? "#C2410C" : (enraged ? "#AA0000" : "#991B1B");

    ctx.save();
    if (!isPlayer && enraged) {
      ctx.shadowColor = "#FF0000"; ctx.shadowBlur = 28;
    }

    if (isPlayer) {
      // Ship facing UP
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.moveTo(cx, v.y);
      ctx.lineTo(cx + hw + 8, v.y + v.h * 0.48);
      ctx.lineTo(cx + hw, v.y + v.h * 0.82);
      ctx.lineTo(cx + hw - 5, v.y + v.h);
      ctx.lineTo(cx + 4, v.y + v.h - 8);
      ctx.lineTo(cx - 4, v.y + v.h - 8);
      ctx.lineTo(cx - hw + 5, v.y + v.h);
      ctx.lineTo(cx - hw, v.y + v.h * 0.82);
      ctx.lineTo(cx - hw - 8, v.y + v.h * 0.48);
      ctx.closePath();
      ctx.fill();

      // Inner detail
      ctx.fillStyle = darkColor;
      ctx.beginPath();
      ctx.moveTo(cx, v.y + 12);
      ctx.lineTo(cx + hw - 4, v.y + v.h * 0.5);
      ctx.lineTo(cx + hw - 6, v.y + v.h * 0.78);
      ctx.lineTo(cx - hw + 6, v.y + v.h * 0.78);
      ctx.lineTo(cx - hw + 4, v.y + v.h * 0.5);
      ctx.closePath();
      ctx.fill();

      // Cockpit
      ctx.fillStyle = "rgba(186,230,253,0.85)";
      ctx.beginPath();
      ctx.ellipse(cx, v.y + v.h * 0.38, 6, 11, 0, 0, Math.PI * 2);
      ctx.fill();

      // Exhaust flames
      const fl = 14 + Math.random() * 12;
      ctx.fillStyle = "#FBBF24";
      ctx.beginPath();
      ctx.moveTo(cx - 10, v.y + v.h - 6);
      ctx.lineTo(cx - 2, v.y + v.h + fl);
      ctx.lineTo(cx + 2, v.y + v.h + fl);
      ctx.lineTo(cx + 10, v.y + v.h - 6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#FFF"; ctx.globalAlpha = 0.65;
      ctx.beginPath();
      ctx.moveTo(cx - 3, v.y + v.h - 4);
      ctx.lineTo(cx, v.y + v.h + fl * 0.55);
      ctx.lineTo(cx + 3, v.y + v.h - 4);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      // Ship facing DOWN
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.moveTo(cx, v.y + v.h);
      ctx.lineTo(cx + hw + 8, v.y + v.h * 0.52);
      ctx.lineTo(cx + hw, v.y + v.h * 0.18);
      ctx.lineTo(cx + hw - 5, v.y);
      ctx.lineTo(cx + 4, v.y + 8);
      ctx.lineTo(cx - 4, v.y + 8);
      ctx.lineTo(cx - hw + 5, v.y);
      ctx.lineTo(cx - hw, v.y + v.h * 0.18);
      ctx.lineTo(cx - hw - 8, v.y + v.h * 0.52);
      ctx.closePath();
      ctx.fill();

      // Inner detail
      ctx.fillStyle = darkColor;
      ctx.beginPath();
      ctx.moveTo(cx, v.y + v.h - 12);
      ctx.lineTo(cx + hw - 4, v.y + v.h * 0.5);
      ctx.lineTo(cx + hw - 6, v.y + v.h * 0.22);
      ctx.lineTo(cx - hw + 6, v.y + v.h * 0.22);
      ctx.lineTo(cx - hw + 4, v.y + v.h * 0.5);
      ctx.closePath();
      ctx.fill();

      // Cockpit
      ctx.fillStyle = enraged ? "rgba(255,100,100,0.75)" : "rgba(186,230,253,0.7)";
      ctx.beginPath();
      ctx.ellipse(cx, v.y + v.h * 0.62, 6, 11, 0, 0, Math.PI * 2);
      ctx.fill();

      // Exhaust at top
      const fl = 10 + Math.random() * 9;
      ctx.fillStyle = enraged ? "#FF3333" : "#FBBF24";
      ctx.beginPath();
      ctx.moveTo(cx - 10, v.y + 6);
      ctx.lineTo(cx - 2, v.y - fl);
      ctx.lineTo(cx + 2, v.y - fl);
      ctx.lineTo(cx + 10, v.y + 6);
      ctx.closePath();
      ctx.fill();
    }

    // Low HP smoke
    if (v.hp < v.maxHp * 0.3) {
      ctx.globalAlpha = 0.4; ctx.fillStyle = "#6B7280";
      const sy = isPlayer ? v.y - 6 : v.y + v.h + 6;
      ctx.beginPath();
      ctx.arc(cx + Math.sin(this.time * 3) * 6, sy, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  // ── HUD ───────────────────────────────────────────────────────────────────────
  _drawHBar(x, y, w, h, hp, maxHp, col, label, isEnraged) {
    const { ctx } = this;
    const pct = Math.max(0, hp / maxHp);
    const fc = isEnraged ? "#FF0000" : pct > 0.5 ? col : pct > 0.25 ? "#EAB308" : "#EF4444";

    ctx.fillStyle = "#CBD5E1"; ctx.font = "bold 10px Inter,sans-serif";
    ctx.textAlign = label === "YOU" ? "left" : "right";
    ctx.fillText(label, label === "YOU" ? x : x + w, y - 2);
    ctx.textAlign = "left";

    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill();
    if (pct > 0) {
      ctx.fillStyle = fc;
      ctx.beginPath(); ctx.roundRect(x, y, w * pct, h, 8); ctx.fill();
    }
    ctx.fillStyle = "#FFF"; ctx.font = "bold 9px Inter,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${Math.round(hp)} HP`, x + w / 2, y + h - 3);
    ctx.textAlign = "left";
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  render() {
    const { ctx, W, H, rc } = this;
    ctx.save();

    // Screen shake
    if (this.screenShake > 0) {
      ctx.translate(
        (Math.random() - 0.5) * 8 * this.screenShake,
        (Math.random() - 0.5) * 6 * this.screenShake
      );
    }

    // Background gradient
    const isBoss = rc.round === 3;
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, isBoss ? "#1a0505" : "#070b1e");
    bg.addColorStop(0.5, isBoss ? "#0f0808" : "#0a0e27");
    bg.addColorStop(1, isBoss ? "#1a0505" : "#070b1e");
    ctx.fillStyle = bg;
    ctx.fillRect(-10, -10, W + 20, H + 20);

    // Grid
    ctx.strokeStyle = isBoss ? "rgba(255,40,40,0.035)" : "rgba(255,255,255,0.025)";
    ctx.lineWidth = 1;
    const gs = 55;
    for (let x = 0; x < W; x += gs) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += gs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // Stars
    this.stars.forEach(s => {
      ctx.globalAlpha = 0.25 + 0.35 * Math.sin(this.time * 1.5 + s.twinkleOff);
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Arena divider (center line)
    const midY = H / 2;
    ctx.strokeStyle = isBoss ? "rgba(255,50,50,0.14)" : "rgba(249,115,22,0.1)";
    ctx.lineWidth = 2; ctx.setLineDash([22, 16]);
    ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(W, midY); ctx.stroke();
    ctx.setLineDash([]);

    // Center glow
    const grd = ctx.createRadialGradient(W / 2, midY, 0, W / 2, midY, W * 0.35);
    grd.addColorStop(0, isBoss ? "rgba(255,30,30,0.06)" : "rgba(249,115,22,0.04)");
    grd.addColorStop(1, "transparent");
    ctx.fillStyle = grd;
    ctx.fillRect(0, midY - 80, W, 160);

    // Danger flash
    if (this.player.hp <= 25 && Math.sin(this.time * 8) > 0) {
      ctx.fillStyle = "rgba(220,38,38,0.07)";
      ctx.fillRect(0, 0, W, H);
    }

    // Draw vehicles
    this._drawVehicle(this.player, true);
    this._drawVehicle(this.enemy, false, this.enemy.enraged);

    // Player bullets
    this.pBullets.forEach(b => {
      ctx.save();
      ctx.fillStyle = "#F97316"; ctx.shadowColor = "#F97316"; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 4); ctx.fill();
      ctx.globalAlpha = 0.25;
      ctx.fillRect(b.x + 2, b.y + b.h, b.w - 4, 14);
      ctx.restore();
    });

    // Enemy bullets
    this.eBullets.forEach(b => {
      ctx.save();
      const c = this.enemy.enraged ? "#FF2222" : "#A855F7";
      ctx.fillStyle = c; ctx.shadowColor = c; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 4); ctx.fill();
      ctx.restore();
    });

    // Particles
    this.particles.forEach(pt => {
      ctx.globalAlpha = pt.life / pt.maxLife; ctx.fillStyle = pt.color;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    // ── HUD overlay at top ──
    const hudH = 54;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, W, hudH);
    ctx.fillStyle = isBoss ? "rgba(255,40,40,0.2)" : "rgba(249,115,22,0.12)";
    ctx.fillRect(0, hudH - 2, W, 2);

    const barW = Math.min(180, W * 0.22);
    this._drawHBar(16, 12, barW, 16, this.player.hp, this.player.maxHp, "#22C55E", "YOU", false);
    this._drawHBar(W - 16 - barW, 12, barW, 16, this.enemy.hp, this.enemy.maxHp, "#EF4444",
      this.enemy.enraged ? "ENRAGED!" : rc.round === 3 ? "BOSS" : "ENEMY", this.enemy.enraged);

    // Timer
    const t = Math.ceil(this.timeLeft);
    ctx.fillStyle = t <= 12 ? "#EF4444" : "#FBBF24";
    ctx.font = `bold ${t <= 12 ? "24" : "20"}px Inter,sans-serif`;
    ctx.textAlign = "center"; ctx.fillText(`${t}s`, W / 2, 30);

    // Round info
    ctx.fillStyle = "#94A3B8"; ctx.font = "11px Inter,sans-serif";
    ctx.fillText(`Round ${rc.round}/3 — ${rc.label}`, W / 2, 47);
    ctx.textAlign = "left";

    // Power
    ctx.fillStyle = "#F97316"; ctx.font = "bold 10px Inter,sans-serif";
    ctx.fillText(`PWR ×${(this.playerDmg / 10).toFixed(1)}`, 16, 46);

    // Controls hint (first 5 seconds)
    if (this.timeLeft > rc.timeLimit - 5) {
      ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.font = "13px Inter,sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("← → or A/D to move · Click / Space to SHOOT", W / 2, H - 22);
      ctx.textAlign = "left";
    }

    ctx.restore();
  }

  start() {
    this.setupInput();
    const loop = (ts) => {
      const dt = this.lastTs ? Math.min((ts - this.lastTs) / 1000, 0.05) : 0;
      this.lastTs = ts;
      this.update(dt);
      this.render();
      if (!this.gameOver) this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() { this.cleanup(); }
}

// ── Confetti ─────────────────────────────────────────────────────────────────
function Confetti() {
  return (
    <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
      {Array.from({ length: 36 }).map((_, i) => (
        <div key={i} style={{
          position: "absolute", top: "-20px",
          left: `${Math.random() * 100}%`,
          width: `${6 + Math.random() * 9}px`, height: `${8 + Math.random() * 12}px`,
          background: ["#F97316", "#DC2626", "#FBBF24", "#10B981", "#3B82F6", "#A855F7"][i % 6],
          borderRadius: Math.random() > 0.5 ? "50%" : "2px",
          animation: `confetti-fall ${1.5 + Math.random() * 2}s linear ${Math.random() * 1.5}s forwards`,
        }} />
      ))}
    </div>
  );
}

// ── Round dots indicator ──────────────────────────────────────────────────────
function RoundDots({ current, total = 3 }) {
  return (
    <div className="flex items-center gap-2 justify-center mb-2">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`rounded-full transition-all ${
          i < current ? "w-3 h-3 bg-green-400" :
          i === current ? "w-4 h-4 bg-orange-500 scale-110" :
          "w-3 h-3 bg-gray-600"
        }`} />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function GamePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const orderId = params.get("orderId");
  const total = parseFloat(params.get("total") || "0");
  const playerName = decodeURIComponent(params.get("name") || "Player");

  const canvasRef = useRef(null);
  const gameRef = useRef(null);

  const [roundIdx, setRoundIdx] = useState(0);
  const [playerHpCarry, setPlayerHpCarry] = useState(100);
  const [phase, setPhase] = useState("intro");
  const [countdownVal, setCountdownVal] = useState(3);
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);

  // Countdown
  useEffect(() => {
    if (phase !== "countdown") return;
    setCountdownVal(3);
    let val = 3;
    const tick = setInterval(() => {
      val--;
      if (val <= 0) { clearInterval(tick); setPhase("playing"); }
      else setCountdownVal(val);
    }, 800);
    return () => clearInterval(tick);
  }, [phase, roundIdx]);

  const saveResult = useCallback(async (won) => {
    setSaving(true);
    try {
      const { data } = await axios.post(`${API}/game/result`, {
        order_id: orderId, player_name: playerName, won,
      });
      setResult(data);
    } catch {
      setResult({
        won, player_name: playerName,
        reward_label: won ? "10% Discount on next order!" : "Better luck next time!",
        coupon_code: null,
      });
    } finally { setSaving(false); }
  }, [orderId, playerName]);

  const handleRoundOver = useCallback((won, playerHp) => {
    if (!won) {
      setPhase("defeat"); saveResult(false);
    } else if (roundIdx >= ROUND_CONFIGS.length - 1) {
      setPhase("victory"); saveResult(true);
    } else {
      const recovered = Math.min(100, playerHp + 28);
      setPlayerHpCarry(recovered);
      setPhase("round-win");
      setTimeout(() => {
        setRoundIdx(r => r + 1);
        setPhase("countdown");
      }, 2800);
    }
  }, [roundIdx, saveResult]);

  // Start game when playing
  useEffect(() => {
    if (phase !== "playing" || !canvasRef.current) return;
    const game = new SmashKartGame(
      canvasRef.current, total, ROUND_CONFIGS[roundIdx], playerHpCarry
    );
    game.onRoundOver = handleRoundOver;
    gameRef.current = game;
    game.start();
    return () => game.stop();
  }, [phase, roundIdx]); // eslint-disable-line

  const rc = ROUND_CONFIGS[roundIdx];
  const powerLabel = total >= 1500 ? "ULTRA" : total >= 700 ? "HIGH" : total >= 300 ? "MED" : "LOW";
  const powerColor = total >= 1500 ? "text-red-400" : total >= 700 ? "text-orange-400" : total >= 300 ? "text-yellow-400" : "text-gray-500";

  return (
    <div className="fixed inset-0 bg-[#070b1e] flex flex-col items-center justify-center overflow-hidden" style={{ fontFamily: "'Nunito', sans-serif" }}>

      {/* ── INTRO ── */}
      {phase === "intro" && (
        <div className="text-center max-w-md w-full px-6 z-10 animate-bounceIn" data-testid="game-intro">
          <div className="w-24 h-24 bg-gradient-to-br from-orange-500 to-red-600 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-orange-500/30">
            <Gamepad2 size={44} className="text-white" />
          </div>
          <h1 className="text-5xl font-bold text-white mb-1" style={{ fontFamily: "'Fraunces', serif" }}>
            Smash Kart
          </h1>
          <p className="text-orange-400 mb-1 text-lg font-semibold">3 Rounds of Pure Battle!</p>
          <p className="text-gray-500 text-sm mb-4">Order <strong className="text-gray-400">#{orderId}</strong></p>

          <div className={`inline-flex items-center gap-2 font-bold text-base mb-5 ${powerColor}`}>
            <Zap size={16} /> Power: <span className="uppercase">{powerLabel}</span>
            <span className="text-xs font-normal text-gray-500">(₹{total.toFixed(0)} order)</span>
          </div>

          {/* Round preview */}
          <div className="bg-gray-900/80 border border-gray-700/60 rounded-2xl p-4 mb-5 text-left space-y-3">
            {ROUND_CONFIGS.map((r) => (
              <div key={r.round} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  r.round === 1 ? "bg-blue-900/50 text-blue-400 border border-blue-800" :
                  r.round === 2 ? "bg-orange-900/50 text-orange-400 border border-orange-800" :
                  "bg-red-900/50 text-red-400 border border-red-800"
                }`}>
                  {r.round === 3 ? "!" : r.round}
                </div>
                <div className="flex-1">
                  <span className="text-sm font-bold text-gray-200">Round {r.round} — {r.label}</span>
                  <div className="flex gap-3 text-xs text-gray-500 mt-0.5">
                    <span>HP: {r.enemyHp}</span>
                    <span>Fires every {r.shootInterval}s</span>
                    {r.burstCount > 1 && <span className="text-red-400 font-bold">DOUBLE BULLETS</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-gray-900/60 rounded-xl p-3 text-xs text-gray-400 text-left mb-5 border border-gray-800 space-y-1">
            <p><span className="font-bold text-gray-300">Move:</span> ← → Arrow keys / drag on screen</p>
            <p><span className="font-bold text-gray-300">Shoot:</span> Click / Space / Tap</p>
            <p><span className="font-bold text-gray-300">Win:</span> Defeat all 3 rounds · HP carries over (+28 recovery)</p>
            <p className="text-orange-400"><span className="font-bold">Warning:</span> Success rate is ~50% — fight hard!</p>
          </div>

          <button data-testid="start-game-btn" onClick={() => setPhase("countdown")}
            className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold py-5 rounded-2xl text-xl shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:scale-[1.02] transition-all active:scale-[0.97]">
            Start Battle!
          </button>
          <button data-testid="skip-game-btn" onClick={() => navigate(`/order/${orderId}`)}
            className="w-full mt-3 text-gray-500 hover:text-gray-300 text-sm py-2 transition-colors">
            Skip game, track order →
          </button>
        </div>
      )}

      {/* ── COUNTDOWN ── */}
      {phase === "countdown" && (
        <div className="text-center z-10" data-testid="game-countdown">
          <RoundDots current={roundIdx} />
          <p className="text-orange-400 font-bold mb-2 text-lg">Round {roundIdx + 1} of 3 — {rc.label}</p>
          <div className="text-9xl font-bold text-orange-500 animate-bounceIn" style={{ fontFamily: "'Fraunces', serif" }} key={countdownVal}>
            {countdownVal === 0 ? "FIGHT!" : countdownVal}
          </div>
          <p className="text-gray-400 text-sm mt-4">{rc.tip}</p>
          {roundIdx > 0 && (
            <p className="text-green-400 text-sm mt-2">
              HP carried over: <strong>{playerHpCarry}</strong>/100
            </p>
          )}
        </div>
      )}

      {/* ── PLAYING (fullscreen canvas) ── */}
      {phase === "playing" && (
        <canvas
          ref={canvasRef}
          id="game-canvas"
          data-testid="game-canvas"
          style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", touchAction: "none", cursor: "crosshair" }}
        />
      )}

      {/* ── ROUND WIN (transition) ── */}
      {phase === "round-win" && (
        <div className="text-center max-w-sm z-10 animate-bounceIn" data-testid="round-win">
          <div className="w-20 h-20 rounded-full bg-green-900/40 border border-green-700 flex items-center justify-center mx-auto mb-4">
            <Swords className="text-green-400" size={40} />
          </div>
          <h2 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: "'Fraunces', serif" }}>
            Round {roundIdx + 1} Complete!
          </h2>
          <p className="text-orange-400 mb-2">Get ready for Round {roundIdx + 2}...</p>
          <RoundDots current={roundIdx + 1} />
          <p className="text-green-400 text-sm mt-3 font-semibold">+28 HP Recovery! Prepare yourself.</p>
          <div className="mt-4 text-gray-500 text-sm animate-pulse">Launching next round...</div>
        </div>
      )}

      {/* ── VICTORY ── */}
      {phase === "victory" && result && (
        <>
          <Confetti />
          <div className="max-w-sm w-full bg-[#111827] rounded-3xl p-8 text-center animate-bounceIn border border-orange-500/30 z-50 relative shadow-2xl shadow-orange-500/10" data-testid="game-victory">
            <RoundDots current={3} />
            <div className="w-24 h-24 rounded-full bg-yellow-900/30 border border-yellow-600/40 flex items-center justify-center mx-auto mb-4">
              <Trophy className="text-yellow-400" size={48} />
            </div>
            <h2 className="text-3xl font-bold text-white mb-1" style={{ fontFamily: "'Fraunces', serif" }}>Champion!</h2>
            {saving ? (
              <div className="flex items-center justify-center gap-2 text-orange-400 my-4">
                <div className="w-4 h-4 border-2 border-orange-300 border-t-orange-500 rounded-full animate-spin" />
                Saving reward...
              </div>
            ) : (
              <>
                <p className="text-orange-400 font-semibold mb-1">{result.player_name}</p>
                <p className="text-gray-500 text-sm mb-4">Defeated all 3 rounds · Order #{orderId}</p>
                <div className="bg-gradient-to-br from-orange-900/30 to-red-900/20 rounded-2xl p-4 mb-5 border border-orange-700/30">
                  <p className="font-bold text-white mb-1">Reward Unlocked!</p>
                  <p className="text-orange-300 text-sm mb-3">{result.reward_label}</p>
                  {result.coupon_code && (
                    <div className="bg-gray-900 rounded-xl px-4 py-2 border border-dashed border-orange-500/50">
                      <p className="text-xs text-gray-500 mb-1">Coupon Code</p>
                      <p data-testid="coupon-code" className="text-2xl font-bold text-orange-400 tracking-wider" style={{ fontFamily: "'Fraunces', serif" }}>
                        {result.coupon_code}
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
            <button data-testid="track-order-btn"
              onClick={() => navigate(`/order/${orderId}`)}
              className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold py-4 rounded-2xl text-lg flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 hover:scale-[1.02] transition-all active:scale-[0.97]">
              Track My Order <ArrowRight size={20} />
            </button>
          </div>
        </>
      )}

      {/* ── DEFEAT ── */}
      {phase === "defeat" && (
        <div className="max-w-sm w-full bg-[#111827] rounded-3xl p-8 text-center animate-bounceIn border border-red-500/20 z-50 relative shadow-2xl" data-testid="game-defeat">
          <RoundDots current={roundIdx} />
          <div className="w-24 h-24 rounded-full bg-red-900/30 border border-red-700/30 flex items-center justify-center mx-auto mb-4">
            <Frown className="text-red-400" size={48} />
          </div>
          <h2 className="text-3xl font-bold text-white mb-1" style={{ fontFamily: "'Fraunces', serif" }}>Defeated!</h2>
          {saving ? (
            <div className="flex items-center justify-center gap-2 text-orange-400 my-4">
              <div className="w-4 h-4 border-2 border-orange-300 border-t-orange-500 rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <p className="text-gray-400 text-sm mb-1">Fell at Round {roundIdx + 1} — {rc.label}</p>
              <p className="text-gray-600 text-sm mb-5">Your order is still being prepared!</p>
              <button data-testid="try-again-btn"
                onClick={() => {
                  setRoundIdx(0); setPlayerHpCarry(100);
                  setResult(null); setPhase("countdown");
                }}
                className="w-full mb-3 border-2 border-orange-500/50 text-orange-400 font-bold py-3 rounded-2xl text-base hover:bg-orange-500/10 transition-all active:scale-[0.97]">
                Try Again
              </button>
            </>
          )}
          <button data-testid="track-order-btn"
            onClick={() => navigate(`/order/${orderId}`)}
            className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold py-4 rounded-2xl text-lg flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 hover:scale-[1.02] transition-all active:scale-[0.97]">
            Track My Order <ArrowRight size={20} />
          </button>
        </div>
      )}
    </div>
  );
}
