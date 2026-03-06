import { useNavigate } from "react-router-dom";
import { QrCode, ChefHat, Gamepad2, Clock, ArrowRight, Star, Zap } from "lucide-react";

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen customer-bg font-['Nunito',sans-serif]">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-orange-500 to-red-600 text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="w-full h-full" style={{backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '60px 60px'}} />
        </div>
        <div className="relative max-w-5xl mx-auto px-6 py-20 text-center">
          <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-4 py-1 text-sm font-semibold mb-6 animate-fadeIn">
            <Zap size={14} /> Enterprise Restaurant Platform
          </div>
          <h1 className="font-['Fraunces',serif] text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 animate-slideUp leading-tight">
            SmashDine
          </h1>
          <p className="text-xl sm:text-2xl text-orange-100 mb-10 animate-slideUp stagger-1 max-w-2xl mx-auto">
            Scan. Order. Play. Win. — The future of restaurant dining
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-slideUp stagger-2">
            <button
              data-testid="owner-login-btn"
              onClick={() => navigate('/owner/login')}
              className="bg-white text-orange-600 font-bold px-8 py-4 rounded-full text-lg hover:bg-orange-50 transition-all active:scale-95 warm-shadow"
            >
              Owner Login
            </button>
            <button
              data-testid="owner-register-btn"
              onClick={() => navigate('/owner/register')}
              className="bg-orange-700/60 text-white font-bold px-8 py-4 rounded-full text-lg hover:bg-orange-700/80 transition-all active:scale-95 border border-white/30"
            >
              Register Restaurant
            </button>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="font-['Fraunces',serif] text-3xl font-bold text-center text-orange-900 mb-12">
          How it works
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: QrCode, title: "Scan QR Code", desc: "Each table has a unique QR code. Just scan and start ordering.", color: "bg-orange-100 text-orange-600", step: "01" },
            { icon: ChefHat, title: "Browse & Order", desc: "Explore the full menu with categories, photos and prices.", color: "bg-red-100 text-red-600", step: "02" },
            { icon: Star, title: "Pay & Win", desc: "Pay seamlessly and play the Smash Kart game to win rewards!", color: "bg-amber-100 text-amber-600", step: "03" },
            { icon: Clock, title: "Track Order", desc: "Real-time order status and estimated prep time displayed.", color: "bg-green-100 text-green-600", step: "04" },
          ].map((f, i) => (
            <div key={i} className={`bg-white rounded-2xl p-6 warm-shadow animate-slideUp stagger-${i+1} text-center`}>
              <div className="text-xs font-bold text-orange-400 mb-3">STEP {f.step}</div>
              <div className={`w-12 h-12 rounded-xl ${f.color} flex items-center justify-center mx-auto mb-4`}>
                <f.icon size={24} />
              </div>
              <h3 className="font-bold text-orange-900 mb-2">{f.title}</h3>
              <p className="text-sm text-orange-700/70">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Game Banner */}
      <div className="bg-gradient-to-r from-red-600 to-orange-500 text-white py-12 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <Gamepad2 className="mx-auto mb-4" size={40} />
          <h2 className="font-['Fraunces',serif] text-3xl font-bold mb-3">Win Rewards with Smash Kart!</h2>
          <p className="text-orange-100 text-lg">After payment, play our exclusive Smash Kart game. Defeat the enemy and win discounts, free drinks, and more!</p>
        </div>
      </div>

      {/* Owner CTA */}
      <div className="max-w-5xl mx-auto px-6 py-16 text-center">
        <h2 className="font-['Fraunces',serif] text-3xl font-bold text-orange-900 mb-4">Own a Restaurant?</h2>
        <p className="text-orange-700 mb-8 text-lg">Manage orders, track revenue, and generate QR codes — all from one dashboard.</p>
        <button
          data-testid="get-started-owner-btn"
          onClick={() => navigate('/owner/register')}
          className="inline-flex items-center gap-2 bg-orange-500 text-white font-bold px-10 py-4 rounded-full text-lg hover:bg-orange-600 transition-all active:scale-95 warm-shadow"
        >
          Get Started Free <ArrowRight size={20} />
        </button>
      </div>

      <footer className="text-center py-6 text-orange-400 text-sm border-t border-orange-100">
        © 2024 SmashDine. Enterprise Restaurant Platform
      </footer>
    </div>
  );
}
