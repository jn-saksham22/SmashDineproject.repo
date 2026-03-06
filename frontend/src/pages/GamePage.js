import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { Trophy, Frown, ArrowRight, Gamepad2, Zap, Shield, Swords, SkipForward } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ── Round Configurations ─────────────────────────────────────────────────────
const ROUND_CONFIGS = [
  {
    round: 1, label: "Challenger",
    enemyHp: 105, enemySpeed: 108, shootInterval: 1.65, bulletDmg: 13,
    burstCount: 1, aimSpread: 75, timeLimit: 62, enrageAt: 0,
    tip: "Click / Space to shoot · Arrow keys to dodge",
    bgColor: "#0F172A",
  },
  {
    round: 2, label: "Veteran",
    enemyHp: 155, enemySpeed: 162, shootInterval: 1.1, bulletDmg: 17,
    burstCount: 1, aimSpread: 45, timeLimit: 56, enrageAt: 0,
    tip: "Faster & more accurate — keep moving!",
    bgColor: "#1A1A2E",
  },
  {
    round: 3, label: "BOSS",
    enemyHp: 200, enemySpeed: 200, shootInterval: 0.82, bulletDmg: 21,
    burstCount: 2, aimSpread: 28, timeLimit: 50, enrageAt: 0.3,
    tip: "DOUBLE BULLETS! Enrages at low HP — GO ALL OUT!",
    bgColor: "#1A0708",
  },
];

// ── Game Engine ───────────────────────────────────────────────────────────────
class SmashKartGame {
  constructor(canvas, orderTotal, roundConfig, initialHp = 100) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.W = canvas.width;
    this.H = canvas.height;
    this.rc = roundConfig;
    this.onRoundOver = null;  // called with (won, playerHp)

    // Reduced player damage to make ~50% win rate
    if (orderTotal >= 1500) this.playerDmg = 23;
    else if (orderTotal >= 700) this.playerDmg = 16;
    else if (orderTotal >= 300) this.playerDmg = 11;
    else this.playerDmg = 7;

    this.initialHp = initialHp;
    this._initState();
  }

  _initState() {
    const { W, H, rc } = this;
    this.player = {
      x: 80, y: H / 2 - 26, w: 78, h: 52,
      hp: this.initialHp, maxHp: 100, speed: 215,
      hitFlash: 0,
    };
    this.enemy = {
      x: W - 160, y: H / 2 - 26, w: 78, h: 52,
      hp: rc.enemyHp, maxHp: rc.enemyHp,
      speed: rc.enemySpeed, targetY: H / 2,
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
  }

  setupInput() {
    this._kd = (e) => {
      this.keys[e.key] = true;
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); this._shoot(); }
    };
    this._ku = (e) => { this.keys[e.key] = false; };
    this._click = () => this._shoot();
    this._tm = (e) => {
      e.preventDefault();
      const t = e.touches[0];
      const r = this.canvas.getBoundingClientRect();
      const y = ((t.clientY - r.top) / r.height) * this.H;
      this.player.y = Math.max(52, Math.min(this.H - this.player.h - 20, y - this.player.h / 2));
    };
    this._ts = (e) => { e.preventDefault(); this._shoot(); };
    document.addEventListener("keydown", this._kd);
    document.addEventListener("keyup", this._ku);
    this.canvas.addEventListener("click", this._click);
    this.canvas.addEventListener("touchmove", this._tm, { passive: false });
    this.canvas.addEventListener("touchstart", this._ts, { passive: false });
  }

  cleanup() {
    document.removeEventListener("keydown", this._kd);
    document.removeEventListener("keyup", this._ku);
    this.canvas.removeEventListener("click", this._click);
    this.canvas.removeEventListener("touchmove", this._tm);
    this.canvas.removeEventListener("touchstart", this._ts);
    if (this.raf) cancelAnimationFrame(this.raf);
  }

  _shoot() {
    if (this.gameOver || this.shootCooldown > 0) return;
    const p = this.player;
    this.pBullets.push({
      x: p.x + p.w, y: p.y + p.h / 2 - 7, w: 28, h: 14, vx: 540, dmg: this.playerDmg,
    });
    this.shootCooldown = 0.38;
    this._splash(p.x + p.w, p.y + p.h / 2, "#F97316", 3);
  }

  _hit(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  _splash(x, y, color, n = 7) {
    for (let i = 0; i < n; i++) {
      const ang = (Math.PI * 2 * i) / n + Math.random() * 0.6;
      const spd = 55 + Math.random() * 120;
      this.particles.push({
        x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
        r: 2.5 + Math.random() * 4, life: 0.45 + Math.random() * 0.3, maxLife: 0.75, color,
      });
    }
  }

  _enemyShoot() {
    const { enemy: e, player: p, rc } = this;
    const isEnraged = e.enraged;
    const spread = isEnraged ? rc.aimSpread * 0.5 : rc.aimSpread;
    const baseY = p.y + p.h / 2 - 7 + (Math.random() - 0.5) * spread;

    const makeBullet = (vy = 0) => ({
      x: e.x, y: e.y + e.h / 2 - 7, w: 26, h: 14,
      vx: isEnraged ? -370 : -320,
      vy,
      dmg: rc.bulletDmg + (isEnraged ? 4 : 0),
    });

    if (rc.burstCount >= 2) {
      // Spread burst — two bullets angled
      const spread2 = isEnraged ? 20 : 35;
      this.eBullets.push({ ...makeBullet(), y: e.y + e.h / 2 - 7 - spread2 });
      this.eBullets.push({ ...makeBullet(), y: e.y + e.h / 2 - 7 + spread2 });
      if (isEnraged) this.eBullets.push(makeBullet()); // 3 bullets when enraged boss
    } else {
      this.eBullets.push({ ...makeBullet(), vy: (baseY - (e.y + e.h / 2)) * 1.4 });
    }
  }

  update(dt) {
    if (this.gameOver) return;

    // Time
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    if (this.timeLeft <= 0) {
      this.gameOver = true; this.won = false;
      if (this.onRoundOver) this.onRoundOver(false, this.player.hp);
      return;
    }

    const { player: p, enemy: e, rc } = this;

    // Screen shake decay
    if (this.screenShake > 0) this.screenShake = Math.max(0, this.screenShake - dt * 15);

    // Hit flash decay
    if (p.hitFlash > 0) p.hitFlash = Math.max(0, p.hitFlash - dt * 8);
    if (e.flashTimer > 0) e.flashTimer = Math.max(0, e.flashTimer - dt * 8);

    // Player movement
    const spd = p.speed * dt;
    if (this.keys["ArrowUp"] || this.keys["w"] || this.keys["W"]) p.y = Math.max(52, p.y - spd);
    if (this.keys["ArrowDown"] || this.keys["s"] || this.keys["S"]) p.y = Math.min(this.H - p.h - 18, p.y + spd);
    if (this.shootCooldown > 0) this.shootCooldown -= dt;

    // Enemy enrage check (boss round at low HP)
    if (rc.enrageAt > 0 && !e.enraged && e.hp < rc.enemyHp * rc.enrageAt) {
      e.enraged = true;
    }

    // Enemy movement
    e.moveTimer -= dt;
    if (e.moveTimer <= 0) {
      // More erratic movement in higher rounds
      const variance = rc.round === 3 ? 0.5 : rc.round === 2 ? 0.8 : 1.2;
      e.targetY = 52 + Math.random() * (this.H - e.h - 72);
      e.moveTimer = variance + Math.random() * variance;
    }
    const dy = e.targetY - e.y;
    if (Math.abs(dy) > 2) e.y += Math.sign(dy) * Math.min(Math.abs(dy), e.speed * dt);

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
      b.x += b.vx * dt;
      if (b.x > this.W) { this.pBullets.splice(i, 1); continue; }
      if (this._hit(b, e)) {
        this._splash(b.x, b.y + b.h / 2, "#F97316", 8);
        e.hp = Math.max(0, e.hp - b.dmg);
        e.flashTimer = 1;
        this.pBullets.splice(i, 1);
        if (e.hp <= 0) {
          this.gameOver = true; this.won = true;
          this._splash(e.x + e.w / 2, e.y + e.h / 2, "#FBBF24", 20);
          if (this.onRoundOver) this.onRoundOver(true, p.hp);
          return;
        }
      }
    }

    // Enemy bullets → player
    for (let i = this.eBullets.length - 1; i >= 0; i--) {
      const b = this.eBullets[i];
      b.x += b.vx * dt;
      if (b.vy) b.y += b.vy * dt;
      if (b.x < 0) { this.eBullets.splice(i, 1); continue; }
      if (this._hit(b, p)) {
        this._splash(b.x, b.y + b.h / 2, "#DC2626", 8);
        p.hp = Math.max(0, p.hp - b.dmg);
        p.hitFlash = 1;
        this.screenShake = 0.3;
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

  // ── Draw helpers ─────────────────────────────────────────────────────────────
  _drawKart(k, isPlayer, enraged = false) {
    const { ctx } = this;
    // Shadow
    ctx.save(); ctx.globalAlpha = 0.18; ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.ellipse(k.x + k.w / 2, k.y + k.h + 4, k.w * 0.52, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // Hit flash overlay
    if (isPlayer && k.hitFlash > 0) {
      ctx.save(); ctx.globalAlpha = k.hitFlash * 0.5;
      ctx.fillStyle = "#EF4444"; ctx.beginPath();
      ctx.roundRect(k.x, k.y, k.w, k.h, 8); ctx.fill(); ctx.restore();
    }
    if (!isPlayer && k.flashTimer > 0) {
      ctx.save(); ctx.globalAlpha = k.flashTimer * 0.6;
      ctx.fillStyle = "#FBBF24"; ctx.beginPath();
      ctx.roundRect(k.x, k.y, k.w, k.h, 8); ctx.fill(); ctx.restore();
    }

    // Body
    const bodyColor = isPlayer ? "#F97316" : (enraged ? "#FF0000" : "#DC2626");
    const topColor = isPlayer ? "#EA580C" : (enraged ? "#CC0000" : "#991B1B");
    ctx.fillStyle = bodyColor;
    ctx.beginPath(); ctx.roundRect(k.x + 4, k.y + 14, k.w - 8, k.h - 22, 8); ctx.fill();

    // Cab
    ctx.fillStyle = topColor;
    if (isPlayer) {
      ctx.beginPath(); ctx.moveTo(k.x + 13, k.y + 14); ctx.lineTo(k.x + k.w - 8, k.y + 14);
      ctx.lineTo(k.x + k.w - 14, k.y + 2); ctx.lineTo(k.x + 17, k.y + 2); ctx.closePath(); ctx.fill();
    } else {
      ctx.beginPath(); ctx.moveTo(k.x + 8, k.y + 14); ctx.lineTo(k.x + k.w - 13, k.y + 14);
      ctx.lineTo(k.x + k.w - 17, k.y + 2); ctx.lineTo(k.x + 13, k.y + 2); ctx.closePath(); ctx.fill();
    }

    // Wheels
    ctx.fillStyle = "#1F2937";
    [k.x + 13, k.x + k.w - 20].forEach(wx => {
      const wy = k.y + k.h - 8;
      ctx.beginPath(); ctx.ellipse(wx, wy, 11, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#4B5563"; ctx.beginPath(); ctx.ellipse(wx, wy, 5, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#1F2937";
    });

    // Window
    ctx.fillStyle = "rgba(186, 230, 253, 0.85)";
    if (isPlayer) ctx.fillRect(k.x + k.w - 27, k.y + 4, 17, 9);
    else ctx.fillRect(k.x + 10, k.y + 4, 17, 9);

    // Exhaust (player) / Boss glow (enemy)
    if (isPlayer) {
      ctx.fillStyle = "#FBBF24";
      ctx.beginPath(); ctx.moveTo(k.x + 4, k.y + 19); ctx.lineTo(k.x - 14, k.y + 25);
      ctx.lineTo(k.x + 4, k.y + 31); ctx.closePath(); ctx.fill();
    }
    if (!isPlayer && enraged) {
      ctx.save(); ctx.shadowColor = "#FF0000"; ctx.shadowBlur = 18;
      ctx.strokeStyle = "#FF3333"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(k.x - 2, k.y - 2, k.w + 4, k.h + 4, 10); ctx.stroke();
      ctx.restore();
    }

    // Low HP smoke
    if (k.hp < k.maxHp * 0.3) {
      ctx.save(); ctx.globalAlpha = 0.55;
      ctx.fillStyle = "#9CA3AF";
      ctx.beginPath(); ctx.arc(k.x + k.w / 2, k.y - 6, 9, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  _drawHBar(x, y, w, hp, maxHp, col, label, isEnraged = false) {
    const { ctx } = this;
    const pct = Math.max(0, hp / maxHp);
    const fc = isEnraged ? "#FF0000" : pct > 0.5 ? col : pct > 0.25 ? "#EAB308" : "#EF4444";

    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.beginPath(); ctx.roundRect(x, y, w, 14, 7); ctx.fill();
    if (pct > 0) {
      ctx.fillStyle = fc;
      ctx.beginPath(); ctx.roundRect(x, y, w * pct, 14, 7); ctx.fill();
    }
    ctx.fillStyle = "#FFF"; ctx.font = "bold 9px Inter,sans-serif"; ctx.textAlign = "center";
    ctx.fillText(`${hp}HP`, x + w / 2, y + 10); ctx.textAlign = "left";
    ctx.fillStyle = "#F1F5F9"; ctx.font = "bold 10px Inter,sans-serif";
    if (label === "YOU") { ctx.fillText(label, x, y - 2); }
    else { ctx.textAlign = "right"; ctx.fillText(label, x + w, y - 2); ctx.textAlign = "left"; }
  }

  render() {
    const { ctx, W, H, rc } = this;

    // Screen shake transform
    const shakeX = this.screenShake > 0 ? (Math.random() - 0.5) * 6 * this.screenShake : 0;
    const shakeY = this.screenShake > 0 ? (Math.random() - 0.5) * 4 * this.screenShake : 0;
    ctx.save();
    ctx.translate(shakeX, shakeY);

    // Background
    ctx.fillStyle = rc.bgColor;
    ctx.fillRect(-4, -4, W + 8, H + 8);

    // Stars
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    [[50,80],[150,42],[280,90],[420,52],[580,70],[700,32],[120,120],[350,105],[620,110],[760,85],[200,55],[480,95]].forEach(([sx, sy]) => {
      ctx.beginPath(); ctx.arc(sx, sy, 1.5, 0, Math.PI * 2); ctx.fill();
    });

    // Boss round – red sky tint
    if (rc.round === 3) {
      ctx.fillStyle = "rgba(100, 0, 0, 0.18)";
      ctx.fillRect(-4, -4, W + 8, H + 8);
    }

    // Road
    ctx.fillStyle = "#374151"; ctx.fillRect(0, H - 75, W, 75);
    ctx.strokeStyle = "#4B5563"; ctx.lineWidth = 3; ctx.setLineDash([40, 25]);
    ctx.beginPath(); ctx.moveTo(0, H - 38); ctx.lineTo(W, H - 38); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#F59E0B"; ctx.fillRect(0, H - 77, W, 4);

    // HUD overlay
    ctx.fillStyle = "rgba(0,0,0,0.75)"; ctx.fillRect(0, 0, W, 54);

    // Health bars
    this._drawHBar(18, 8, 172, this.player.hp, this.player.maxHp, "#22C55E", "YOU");
    this._drawHBar(W - 194, 8, 172, this.enemy.hp, this.enemy.maxHp, "#EF4444",
      this.enemy.enraged ? "ENRAGED!" : rc.round === 3 ? "BOSS" : "ENEMY",
      this.enemy.enraged);

    // Timer
    const t = Math.ceil(this.timeLeft);
    ctx.fillStyle = t <= 12 ? "#EF4444" : "#FBBF24";
    ctx.font = `bold ${t <= 12 ? "22" : "18"}px Inter,sans-serif`;
    ctx.textAlign = "center"; ctx.fillText(`${t}s`, W / 2, 30); ctx.textAlign = "left";

    // Round & power in HUD
    ctx.fillStyle = "#F97316"; ctx.font = "bold 9px Inter,sans-serif";
    ctx.fillText(`PWR ×${(this.playerDmg / 10).toFixed(1)}`, 18, 50);
    ctx.fillStyle = "#94A3B8"; ctx.font = "9px Inter,sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`Round ${rc.round}/3 — ${rc.label}`, W - 10, 50);
    ctx.textAlign = "left";

    // Danger flash when player HP critical
    if (this.player.hp <= 25 && Math.sin(Date.now() / 120) > 0) {
      ctx.fillStyle = "rgba(220, 38, 38, 0.12)";
      ctx.fillRect(0, 0, W, H);
    }

    // Draw karts
    this._drawKart(this.player, true);
    this._drawKart(this.enemy, false, this.enemy.enraged);

    // Player bullets
    this.pBullets.forEach(b => {
      ctx.fillStyle = "#F97316"; ctx.shadowColor = "#F97316"; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 5); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#FFF"; ctx.font = "bold 7px Arial";
      ctx.fillText("SMASH", b.x + 2, b.y + b.h - 2);
    });

    // Enemy bullets
    this.eBullets.forEach(b => {
      const bulletColor = this.enemy.enraged ? "#FF0000" : "#7C3AED";
      ctx.fillStyle = bulletColor; ctx.shadowColor = bulletColor; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 5); ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Particles
    this.particles.forEach(pt => {
      ctx.globalAlpha = pt.life / pt.maxLife; ctx.fillStyle = pt.color;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Controls hint
    if (this.timeLeft > rc.timeLimit - 6) {
      ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.font = "11px Inter,sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Arrow keys / drag to move · Click / Space to SHOOT", W / 2, H - 12);
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
      {Array.from({ length: 32 }).map((_, i) => (
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
          "w-3 h-3 bg-slate-500"
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

  // Round state
  const [roundIdx, setRoundIdx] = useState(0);
  const [playerHpCarry, setPlayerHpCarry] = useState(100);

  // Phase: intro | countdown | playing | round-win | victory | defeat
  const [phase, setPhase] = useState("intro");
  const [countdownVal, setCountdownVal] = useState(3);

  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);

  // Countdown effect
  useEffect(() => {
    if (phase !== "countdown") return;
    setCountdownVal(3);
    let val = 3;
    const tick = setInterval(() => {
      val--;
      if (val <= 0) {
        clearInterval(tick);
        setPhase("playing");
      } else {
        setCountdownVal(val);
      }
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
    } finally {
      setSaving(false);
    }
  }, [orderId, playerName]);

  const handleRoundOver = useCallback((won, playerHp) => {
    if (!won) {
      setPhase("defeat");
      saveResult(false);
    } else if (roundIdx >= ROUND_CONFIGS.length - 1) {
      // All rounds beaten!
      setPhase("victory");
      saveResult(true);
    } else {
      // Advance to next round with partial HP recovery
      const recovered = Math.min(100, playerHp + 28);
      setPlayerHpCarry(recovered);
      setPhase("round-win");
      setTimeout(() => {
        setRoundIdx(r => r + 1);
        setPhase("countdown");
      }, 2800);
    }
  }, [roundIdx, saveResult]);

  // Start game instance when phase = 'playing'
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
  const powerColor = total >= 1500 ? "text-red-400" : total >= 700 ? "text-orange-400" : total >= 300 ? "text-yellow-400" : "text-slate-400";

  return (
    <div className="min-h-screen customer-bg flex flex-col items-center justify-center font-['Nunito',sans-serif] px-4 py-6">

      {/* ── INTRO ── */}
      {phase === "intro" && (
        <div className="text-center max-w-md w-full animate-bounceIn">
          <div className="w-24 h-24 bg-gradient-to-br from-orange-500 to-red-600 rounded-3xl flex items-center justify-center mx-auto mb-5 warm-shadow">
            <Gamepad2 size={44} className="text-white" />
          </div>
          <h1 className="font-['Fraunces',serif] text-4xl font-bold text-orange-900 mb-1">Smash Kart</h1>
          <p className="text-orange-600 mb-1 text-lg font-semibold">3 Rounds of Pure Battle!</p>
          <p className="text-orange-500 text-sm mb-4">Order <strong>#{orderId}</strong></p>

          <div className={`inline-flex items-center gap-2 font-bold text-base mb-5 ${powerColor}`}>
            <Zap size={16} /> Power: <span className="uppercase">{powerLabel}</span>
            <span className="text-xs font-normal text-orange-400">(₹{total.toFixed(0)} order)</span>
          </div>

          {/* Round preview */}
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-5 text-left space-y-2">
            {ROUND_CONFIGS.map((r) => (
              <div key={r.round} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  r.round === 1 ? "bg-blue-100 text-blue-700" :
                  r.round === 2 ? "bg-orange-100 text-orange-700" :
                  "bg-red-100 text-red-700"
                }`}>
                  {r.round === 3 ? "!" : r.round}
                </div>
                <div className="flex-1">
                  <span className="text-sm font-bold text-orange-900">Round {r.round} — {r.label}</span>
                  <div className="flex gap-3 text-xs text-orange-500 mt-0.5">
                    <span>HP: {r.enemyHp}</span>
                    <span>Fires every {r.shootInterval}s</span>
                    {r.burstCount > 1 && <span className="text-red-600 font-bold">DOUBLE BULLETS</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-orange-50 rounded-xl p-3 text-xs text-orange-700 text-left mb-5 border border-orange-100 space-y-1">
            <p><span className="font-bold">Move:</span> Arrow keys / drag on screen</p>
            <p><span className="font-bold">Shoot:</span> Click / Space / Tap</p>
            <p><span className="font-bold">Win:</span> Defeat all 3 rounds · HP carries over (+28 recovery)</p>
            <p className="text-orange-500"><span className="font-bold">Warning:</span> Success rate is ~50% — fight hard!</p>
          </div>

          <button data-testid="start-game-btn" onClick={() => setPhase("countdown")}
            className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold py-5 rounded-2xl text-xl warm-shadow hover:opacity-90 transition-all active:scale-[0.97]">
            Start Battle!
          </button>
          <button data-testid="skip-game-btn" onClick={() => navigate(`/order/${orderId}`)}
            className="w-full mt-3 text-orange-400 hover:text-orange-600 text-sm py-2">
            Skip game, track order →
          </button>
        </div>
      )}

      {/* ── COUNTDOWN ── */}
      {phase === "countdown" && (
        <div className="text-center">
          <RoundDots current={roundIdx} />
          <p className="text-orange-500 font-bold mb-2 text-lg">Round {roundIdx + 1} of 3 — {rc.label}</p>
          <div className="text-9xl font-['Fraunces',serif] font-bold text-orange-500 animate-bounceIn" key={countdownVal}>
            {countdownVal === 0 ? "FIGHT!" : countdownVal}
          </div>
          <p className="text-orange-400 text-sm mt-4">{rc.tip}</p>
          {roundIdx > 0 && (
            <p className="text-green-400 text-sm mt-2">
              HP carried over: <strong>{playerHpCarry}</strong>/100
            </p>
          )}
        </div>
      )}

      {/* ── PLAYING ── */}
      {phase === "playing" && (
        <div className="w-full max-w-2xl">
          <div className="flex items-center justify-between mb-2 px-1">
            <RoundDots current={roundIdx} />
            <span className="text-sm font-bold text-orange-900">
              Round {roundIdx + 1} — {rc.label}
            </span>
            <span className="text-xs text-orange-500">#{orderId}</span>
          </div>
          <canvas
            ref={canvasRef}
            id="game-canvas"
            width={720}
            height={380}
            className="w-full rounded-2xl border-2 border-orange-200 warm-shadow"
          />
          <p className="text-center text-orange-400 text-xs mt-2">Tap canvas to shoot · Arrow keys / drag to move</p>
        </div>
      )}

      {/* ── ROUND WIN (transition) ── */}
      {phase === "round-win" && (
        <div className="text-center max-w-sm animate-bounceIn">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <Swords className="text-green-500" size={40} />
          </div>
          <h2 className="font-['Fraunces',serif] text-3xl font-bold text-orange-900 mb-2">
            Round {roundIdx + 1} Complete!
          </h2>
          <p className="text-orange-600 mb-2">Get ready for Round {roundIdx + 2}...</p>
          <RoundDots current={roundIdx + 1} />
          <p className="text-green-500 text-sm mt-3 font-semibold">
            +28 HP Recovery! Prepare yourself.
          </p>
          <div className="mt-4 text-orange-400 text-sm animate-pulse">Launching next round...</div>
        </div>
      )}

      {/* ── VICTORY ── */}
      {phase === "victory" && result && (
        <>
          <Confetti />
          <div className="max-w-sm w-full bg-white rounded-3xl p-8 text-center animate-bounceIn border-2 border-orange-200 warm-shadow z-50 relative">
            <RoundDots current={3} />
            <div className="w-24 h-24 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-4">
              <Trophy className="text-yellow-500" size={48} />
            </div>
            <h2 className="font-['Fraunces',serif] text-3xl font-bold text-orange-900 mb-1">Champion!</h2>
            {saving ? (
              <div className="flex items-center justify-center gap-2 text-orange-400 my-4">
                <div className="w-4 h-4 border-2 border-orange-300 border-t-orange-500 rounded-full animate-spin" />
                Saving reward...
              </div>
            ) : (
              <>
                <p className="text-orange-600 font-semibold mb-1">{result.player_name}</p>
                <p className="text-orange-400 text-sm mb-4">Defeated all 3 rounds · Order #{orderId}</p>
                <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-2xl p-4 mb-5 border border-orange-200">
                  <p className="font-bold text-orange-900 mb-1">Reward Unlocked!</p>
                  <p className="text-orange-700 text-sm mb-3">{result.reward_label}</p>
                  {result.coupon_code && (
                    <div className="bg-white rounded-xl px-4 py-2 border border-dashed border-orange-400">
                      <p className="text-xs text-orange-400 mb-1">Coupon Code</p>
                      <p data-testid="coupon-code" className="font-['Fraunces',serif] text-2xl font-bold text-orange-600 tracking-wider">
                        {result.coupon_code}
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
            <button data-testid="track-order-btn"
              onClick={() => navigate(`/order/${orderId}`)}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-2xl text-lg flex items-center justify-center gap-2 transition-all active:scale-[0.97]">
              Track My Order <ArrowRight size={20} />
            </button>
          </div>
        </>
      )}

      {/* ── DEFEAT ── */}
      {phase === "defeat" && (
        <div className="max-w-sm w-full bg-white rounded-3xl p-8 text-center animate-bounceIn border-2 border-slate-200 z-50 relative warm-shadow">
          <RoundDots current={roundIdx} />
          <div className="w-24 h-24 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <Frown className="text-red-400" size={48} />
          </div>
          <h2 className="font-['Fraunces',serif] text-3xl font-bold text-orange-900 mb-1">Defeated!</h2>
          {saving ? (
            <div className="flex items-center justify-center gap-2 text-orange-400 my-4">
              <div className="w-4 h-4 border-2 border-orange-300 border-t-orange-500 rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <p className="text-orange-500 text-sm mb-1">Fell at Round {roundIdx + 1} — {rc.label}</p>
              <p className="text-slate-500 text-sm mb-5">Your order is still being prepared!</p>
              <button data-testid="try-again-btn"
                onClick={() => {
                  setRoundIdx(0); setPlayerHpCarry(100);
                  setResult(null); setPhase("countdown");
                }}
                className="w-full mb-3 border-2 border-orange-400 text-orange-600 font-bold py-3 rounded-2xl text-base hover:bg-orange-50 transition-all active:scale-[0.97]">
                Try Again
              </button>
            </>
          )}
          <button data-testid="track-order-btn"
            onClick={() => navigate(`/order/${orderId}`)}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-2xl text-lg flex items-center justify-center gap-2 transition-all active:scale-[0.97]">
            Track My Order <ArrowRight size={20} />
          </button>
        </div>
      )}
    </div>
  );
}
