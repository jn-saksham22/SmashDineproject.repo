import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { Trophy, X, Frown, ArrowRight, Gamepad2, Zap } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ─── SmashKart Game Engine ────────────────────────────────────────────────────
class SmashKartGame {
  constructor(canvas, orderTotal) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = canvas.width;
    this.H = canvas.height;
    this.orderTotal = orderTotal;
    this.onGameOver = null;

    // Player power based on order total
    if (orderTotal >= 1500) this.playerDmg = 38;
    else if (orderTotal >= 700) this.playerDmg = 26;
    else if (orderTotal >= 300) this.playerDmg = 16;
    else this.playerDmg = 11;

    this.reset();
  }

  reset() {
    const { W, H } = this;
    this.player = { x: 80, y: H / 2 - 28, w: 80, h: 52, hp: 100, maxHp: 100, speed: 220 };
    this.enemy = { x: W - 162, y: H / 2 - 28, w: 80, h: 52, hp: 100, maxHp: 100, speed: 100, targetY: H / 2, moveTimer: 0, shootCooldown: 2.4 };
    this.pBullets = [];
    this.eBullets = [];
    this.particles = [];
    this.gameOver = false;
    this.won = false;
    this.timeLeft = 80;
    this.lastTs = null;
    this.shootCooldown = 0;
    this.keys = {};
    this.raf = null;
  }

  setupInput() {
    this._kd = (e) => {
      this.keys[e.key] = true;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); this._doShoot(); }
    };
    this._ku = (e) => { this.keys[e.key] = false; };
    this._click = () => this._doShoot();
    this._tm = (e) => {
      e.preventDefault();
      const t = e.touches[0];
      const r = this.canvas.getBoundingClientRect();
      const y = ((t.clientY - r.top) / r.height) * this.H;
      this.player.y = Math.max(52, Math.min(this.H - this.player.h - 22, y - this.player.h / 2));
    };
    this._ts = (e) => { e.preventDefault(); this._doShoot(); };
    document.addEventListener('keydown', this._kd);
    document.addEventListener('keyup', this._ku);
    this.canvas.addEventListener('click', this._click);
    this.canvas.addEventListener('touchmove', this._tm, { passive: false });
    this.canvas.addEventListener('touchstart', this._ts, { passive: false });
  }

  cleanup() {
    document.removeEventListener('keydown', this._kd);
    document.removeEventListener('keyup', this._ku);
    this.canvas.removeEventListener('click', this._click);
    this.canvas.removeEventListener('touchmove', this._tm);
    this.canvas.removeEventListener('touchstart', this._ts);
    if (this.raf) cancelAnimationFrame(this.raf);
  }

  _doShoot() {
    if (this.gameOver || this.shootCooldown > 0) return;
    const p = this.player;
    this.pBullets.push({ x: p.x + p.w, y: p.y + p.h / 2 - 7, w: 28, h: 14, vx: 520, dmg: this.playerDmg });
    this.shootCooldown = 0.32;
  }

  _hit(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  _splash(x, y, color, n = 6) {
    for (let i = 0; i < n; i++) {
      const angle = (Math.PI * 2 * i) / n + Math.random() * 0.5;
      this.particles.push({ x, y, vx: Math.cos(angle) * (60 + Math.random() * 120), vy: Math.sin(angle) * (60 + Math.random() * 120), r: 3 + Math.random() * 4, life: 0.5 + Math.random() * 0.3, maxLife: 0.8, color });
    }
  }

  update(dt) {
    if (this.gameOver) return;
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    if (this.timeLeft <= 0) { this.gameOver = true; this.won = false; if (this.onGameOver) this.onGameOver(false); return; }

    const { player: p, enemy: e } = this;
    const spd = p.speed * dt;
    if (this.keys['ArrowUp'] || this.keys['w'] || this.keys['W']) p.y = Math.max(52, p.y - spd);
    if (this.keys['ArrowDown'] || this.keys['s'] || this.keys['S']) p.y = Math.min(this.H - p.h - 18, p.y + spd);
    if (this.shootCooldown > 0) this.shootCooldown -= dt;

    // Enemy AI
    e.moveTimer -= dt;
    if (e.moveTimer <= 0) { e.targetY = 54 + Math.random() * (this.H - e.h - 72); e.moveTimer = 0.7 + Math.random() * 1.3; }
    const dy = e.targetY - e.y;
    if (Math.abs(dy) > 2) e.y += Math.sign(dy) * Math.min(Math.abs(dy), e.speed * dt);

    e.shootCooldown -= dt;
    if (e.shootCooldown <= 0) {
      const aimY = p.y + p.h / 2 - 7 + (Math.random() - 0.5) * 50;
      this.eBullets.push({ x: e.x, y: e.y + e.h / 2 - 7, w: 26, h: 14, vx: -310, vy: (aimY - (e.y + e.h / 2)) * 1.5, dmg: 12 });
      e.shootCooldown = 2.0 + Math.random() * 0.8;
    }

    // Player bullets
    for (let i = this.pBullets.length - 1; i >= 0; i--) {
      const b = this.pBullets[i];
      b.x += b.vx * dt;
      if (b.x > this.W) { this.pBullets.splice(i, 1); continue; }
      if (this._hit(b, e)) {
        this._splash(b.x, b.y + b.h / 2, '#F97316');
        e.hp = Math.max(0, e.hp - b.dmg);
        this.pBullets.splice(i, 1);
        if (e.hp <= 0) { this.gameOver = true; this.won = true; if (this.onGameOver) this.onGameOver(true); return; }
      }
    }
    // Enemy bullets
    for (let i = this.eBullets.length - 1; i >= 0; i--) {
      const b = this.eBullets[i];
      b.x += b.vx * dt;
      if (b.vy) b.y += b.vy * dt;
      if (b.x < 0) { this.eBullets.splice(i, 1); continue; }
      if (this._hit(b, p)) {
        this._splash(b.x, b.y + b.h / 2, '#DC2626');
        p.hp = Math.max(0, p.hp - b.dmg);
        this.eBullets.splice(i, 1);
        if (p.hp <= 0) { this.gameOver = true; this.won = false; if (this.onGameOver) this.onGameOver(false); return; }
      }
    }
    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }
  }

  _drawKart(k, isP) {
    const { ctx } = this;
    // Shadow
    ctx.save(); ctx.globalAlpha = 0.15; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(k.x + k.w / 2, k.y + k.h + 4, k.w * 0.55, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // Body
    ctx.fillStyle = isP ? '#F97316' : '#DC2626';
    ctx.beginPath(); ctx.roundRect(k.x + 4, k.y + 14, k.w - 8, k.h - 22, 8); ctx.fill();
    // Cab
    ctx.fillStyle = isP ? '#EA580C' : '#991B1B';
    if (isP) {
      ctx.beginPath(); ctx.moveTo(k.x + 14, k.y + 14); ctx.lineTo(k.x + k.w - 8, k.y + 14);
      ctx.lineTo(k.x + k.w - 14, k.y + 2); ctx.lineTo(k.x + 18, k.y + 2); ctx.closePath(); ctx.fill();
    } else {
      ctx.beginPath(); ctx.moveTo(k.x + 8, k.y + 14); ctx.lineTo(k.x + k.w - 14, k.y + 14);
      ctx.lineTo(k.x + k.w - 18, k.y + 2); ctx.lineTo(k.x + 14, k.y + 2); ctx.closePath(); ctx.fill();
    }
    // Wheels
    ctx.fillStyle = '#1F2937';
    [k.x + 13, k.x + k.w - 21].forEach(wx => {
      ctx.beginPath(); ctx.ellipse(wx, k.y + k.h - 8, 11, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4B5563'; ctx.beginPath(); ctx.ellipse(wx, k.y + k.h - 8, 5, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1F2937';
    });
    // Window
    ctx.fillStyle = 'rgba(186, 230, 253, 0.85)';
    if (isP) ctx.fillRect(k.x + k.w - 28, k.y + 4, 18, 9);
    else ctx.fillRect(k.x + 10, k.y + 4, 18, 9);
    // Exhaust flame
    if (isP) {
      ctx.fillStyle = '#FBBF24';
      ctx.beginPath(); ctx.moveTo(k.x + 4, k.y + 20); ctx.lineTo(k.x - 14, k.y + 25);
      ctx.lineTo(k.x + 4, k.y + 30); ctx.closePath(); ctx.fill();
    }
    // Damage smoke
    if (k.hp < 35) {
      ctx.globalAlpha = 0.6; ctx.fillStyle = '#9CA3AF';
      ctx.beginPath(); ctx.arc(k.x + k.w / 2, k.y - 6, 8, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  _drawHBar(x, y, w, hp, maxHp, col, label) {
    const { ctx } = this;
    ctx.fillStyle = '#E5E7EB'; ctx.beginPath(); ctx.roundRect(x, y, w, 13, 7); ctx.fill();
    const pct = hp / maxHp;
    const fc = pct > 0.5 ? col : pct > 0.25 ? '#EAB308' : '#EF4444';
    ctx.fillStyle = fc; ctx.beginPath(); ctx.roundRect(x, y, w * pct, 13, 7); ctx.fill();
    ctx.fillStyle = '#FFF'; ctx.font = 'bold 9px Inter,sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(`${hp}HP`, x + w / 2, y + 10); ctx.textAlign = 'left';
    ctx.fillStyle = '#F1F5F9'; ctx.font = 'bold 10px Inter,sans-serif';
    if (label === 'YOU') ctx.fillText(label, x, y - 2);
    else { ctx.textAlign = 'right'; ctx.fillText(label, x + w, y - 2); ctx.textAlign = 'left'; }
  }

  render() {
    const { ctx, W, H } = this;
    // BG
    ctx.fillStyle = '#1E293B'; ctx.fillRect(0, 0, W, H);
    // Stars
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    [[50,80],[150,42],[280,90],[420,52],[580,70],[700,32],[120,120],[350,105],[620,110],[760,85],[200,55],[480,95]].forEach(([sx,sy]) => {
      ctx.beginPath(); ctx.arc(sx, sy, 1.5, 0, Math.PI*2); ctx.fill();
    });
    // Road
    ctx.fillStyle = '#374151'; ctx.fillRect(0, H - 75, W, 75);
    ctx.strokeStyle = '#4B5563'; ctx.lineWidth = 3; ctx.setLineDash([40, 25]);
    ctx.beginPath(); ctx.moveTo(0, H - 38); ctx.lineTo(W, H - 38); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#F59E0B'; ctx.fillRect(0, H - 77, W, 4);
    // HUD
    ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0, 0, W, 52);
    this._drawHBar(18, 8, 180, this.player.hp, this.player.maxHp, '#22C55E', 'YOU');
    this._drawHBar(W - 200, 8, 180, this.enemy.hp, this.enemy.maxHp, '#EF4444', 'ENEMY');
    // Timer
    const t = Math.ceil(this.timeLeft);
    ctx.fillStyle = t <= 15 ? '#EF4444' : '#FBBF24';
    ctx.font = `bold ${t <= 15 ? '22' : '18'}px Inter,sans-serif`;
    ctx.textAlign = 'center'; ctx.fillText(`${t}s`, W / 2, 32); ctx.textAlign = 'left';
    ctx.fillStyle = '#F97316'; ctx.font = 'bold 9px Inter,sans-serif';
    ctx.fillText(`PWR ×${(this.playerDmg / 10).toFixed(1)}`, 18, 48);
    // Karts
    this._drawKart(this.player, true);
    this._drawKart(this.enemy, false);
    // Bullets (player)
    this.pBullets.forEach(b => {
      ctx.fillStyle = '#F97316'; ctx.shadowColor = '#F97316'; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 5); ctx.fill();
      ctx.shadowBlur = 0; ctx.fillStyle = '#FFF'; ctx.font = 'bold 7px Arial';
      ctx.fillText('SMASH', b.x + 2, b.y + b.h - 2);
    });
    // Bullets (enemy)
    this.eBullets.forEach(b => {
      ctx.fillStyle = '#7C3AED'; ctx.shadowColor = '#7C3AED'; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 5); ctx.fill();
      ctx.shadowBlur = 0;
    });
    // Particles
    this.particles.forEach(pt => {
      ctx.globalAlpha = pt.life / pt.maxLife; ctx.fillStyle = pt.color;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2); ctx.fill();
    }); ctx.globalAlpha = 1;
    // Controls hint (first 5s)
    if (this.timeLeft > 75) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '11px Inter,sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('Arrow keys / Drag to move · Space / Click to SHOOT', W / 2, H - 12);
      ctx.textAlign = 'left';
    }
  }

  start() {
    this.reset(); this.setupInput();
    const loop = (ts) => {
      const dt = this.lastTs ? Math.min((ts - this.lastTs) / 1000, 0.05) : 0;
      this.lastTs = ts;
      this.update(dt); this.render();
      if (!this.gameOver) this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() { this.cleanup(); }
}
// ─────────────────────────────────────────────────────────────────────────────

function Confetti() {
  return (
    <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
      {Array.from({ length: 28 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute', top: '-20px',
          left: `${Math.random() * 100}%`,
          width: `${6 + Math.random() * 8}px`, height: `${8 + Math.random() * 10}px`,
          background: ['#F97316','#DC2626','#FBBF24','#10B981','#3B82F6','#A855F7'][i % 6],
          borderRadius: Math.random() > 0.5 ? '50%' : '2px',
          animation: `confetti-fall ${1.5 + Math.random() * 2}s linear ${Math.random() * 1.5}s forwards`,
        }} />
      ))}
    </div>
  );
}

export default function GamePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const orderId = params.get("orderId");
  const total = parseFloat(params.get("total") || "0");
  const playerName = decodeURIComponent(params.get("name") || "Player");

  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const [phase, setPhase] = useState("intro"); // intro | playing | result
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleGameOver = useCallback(async (won) => {
    setSaving(true);
    try {
      const { data } = await axios.post(`${API}/game/result`, {
        order_id: orderId, player_name: playerName, won
      });
      setResult(data);
    } catch {
      setResult({ won, player_name: playerName, reward_label: won ? "10% Discount on next order" : "Better luck next time!", coupon_code: null });
    } finally {
      setSaving(false);
      setPhase("result");
    }
  }, [orderId, playerName]);

  useEffect(() => {
    if (phase !== "playing" || !canvasRef.current) return;
    const game = new SmashKartGame(canvasRef.current, total);
    game.onGameOver = handleGameOver;
    gameRef.current = game;
    game.start();
    return () => game.stop();
  }, [phase, total, handleGameOver]);

  function startGame() { setPhase("playing"); }

  const powerLabel = total >= 1500 ? "ULTRA" : total >= 700 ? "HIGH" : total >= 300 ? "MED" : "LOW";
  const powerColor = total >= 1500 ? "text-red-500" : total >= 700 ? "text-orange-500" : total >= 300 ? "text-yellow-500" : "text-slate-500";

  return (
    <div className="min-h-screen customer-bg flex flex-col items-center justify-center font-['Nunito',sans-serif] px-4">
      {/* Intro */}
      {phase === "intro" && (
        <div className="text-center max-w-md animate-bounceIn">
          <div className="w-24 h-24 bg-gradient-to-br from-orange-500 to-red-600 rounded-3xl flex items-center justify-center mx-auto mb-6 warm-shadow">
            <Gamepad2 size={44} className="text-white" />
          </div>
          <h1 className="font-['Fraunces',serif] text-4xl font-bold text-orange-900 mb-2">Smash Kart!</h1>
          <p className="text-orange-600 mb-2 text-lg">Play to win rewards on your order</p>
          <p className="text-orange-700 text-sm mb-2">Order <span className="font-bold">#{orderId}</span></p>
          <div className={`inline-flex items-center gap-2 font-bold text-lg mb-6 ${powerColor}`}>
            <Zap size={18} /> Player Power: <span>{powerLabel}</span>
            <span className="text-sm font-normal text-orange-500">(₹{total.toFixed(0)} order)</span>
          </div>
          <div className="bg-orange-50 rounded-2xl p-4 text-left mb-6 text-sm space-y-2 text-orange-700 border border-orange-100">
            <p className="font-bold text-orange-900 mb-1">How to play:</p>
            <p>• <span className="font-semibold">Arrow keys / Drag</span> to move up/down</p>
            <p>• <span className="font-semibold">Click / Space / Tap</span> to shoot</p>
            <p>• Deplete the enemy's HP before time runs out</p>
            <p>• Higher order value = More damage per shot!</p>
          </div>
          <button data-testid="start-game-btn" onClick={startGame}
            className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold py-5 rounded-2xl text-xl warm-shadow hover:opacity-90 transition-all active:scale-[0.97]">
            Start Game!
          </button>
          <button data-testid="skip-game-btn" onClick={() => navigate(`/order/${orderId}`)}
            className="w-full mt-3 text-orange-400 hover:text-orange-600 text-sm py-2">
            Skip game, track my order →
          </button>
        </div>
      )}

      {/* Playing */}
      {phase === "playing" && (
        <div className="w-full max-w-2xl">
          <div className="flex items-center justify-between mb-3 px-2">
            <h2 className="font-['Fraunces',serif] text-xl font-bold text-orange-900">Smash Kart</h2>
            <span className="text-sm text-orange-500">Order #{orderId}</span>
          </div>
          <canvas
            ref={canvasRef}
            id="game-canvas"
            width={720}
            height={380}
            className="w-full rounded-2xl border-2 border-orange-200 warm-shadow"
          />
          <p className="text-center text-orange-400 text-xs mt-2">Tap canvas to shoot · Arrow keys to move</p>
        </div>
      )}

      {/* Result */}
      {phase === "result" && result && (
        <>
          {result.won && <Confetti />}
          <div className={`max-w-sm w-full bg-white rounded-3xl p-8 text-center animate-bounceIn border-2 ${result.won ? 'border-orange-200' : 'border-slate-200'} warm-shadow z-50 relative`}>
            <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4 ${result.won ? 'bg-yellow-100' : 'bg-slate-100'}`}>
              {result.won ? <Trophy className="text-yellow-500" size={48} /> : <Frown className="text-slate-400" size={48} />}
            </div>
            <h2 className="font-['Fraunces',serif] text-3xl font-bold text-orange-900 mb-1">
              {result.won ? "You Won!" : "Game Over"}
            </h2>
            {saving ? (
              <div className="flex items-center justify-center gap-2 text-orange-400 my-4">
                <div className="w-4 h-4 border-2 border-orange-300 border-t-orange-500 rounded-full animate-spin" />
                Saving result...
              </div>
            ) : (
              <>
                <p className="text-orange-600 font-semibold mb-1">{result.player_name}</p>
                <p className="text-orange-500 text-sm mb-4">Order #{orderId}</p>
                {result.won && (
                  <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-2xl p-4 mb-5 border border-orange-200">
                    <p className="font-bold text-orange-900 mb-1">Reward Unlocked!</p>
                    <p className="text-orange-700 text-sm mb-3">{result.reward_label}</p>
                    {result.coupon_code && (
                      <div className="bg-white rounded-xl px-4 py-2 border border-dashed border-orange-400">
                        <p className="text-xs text-orange-500 mb-1">Your Coupon Code</p>
                        <p data-testid="coupon-code" className="font-['Fraunces',serif] text-xl font-bold text-orange-600 tracking-wider">
                          {result.coupon_code}
                        </p>
                      </div>
                    )}
                  </div>
                )}
                {!result.won && (
                  <p className="text-slate-500 text-sm mb-5">Don't worry — your order is still being prepared!</p>
                )}
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
    </div>
  );
}
