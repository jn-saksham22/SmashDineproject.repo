import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { ChefHat, Eye, EyeOff, UserPlus } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function OwnerRegister() {
  const [form, setForm] = useState({
    name: "", email: "", mobile: "", password: "", confirm_password: "",
    restaurant_name: "", restaurant_description: "", restaurant_address: "", cuisine_type: "Multi-Cuisine"
  });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  function update(k, v) { setForm(p => ({ ...p, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name || !form.email || !form.password || !form.restaurant_name) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (!form.mobile) {
      toast.error("Mobile number is required");
      return;
    }
    if (!/^[6-9]\d{9}$/.test(form.mobile)) {
      toast.error("Enter a valid 10-digit Indian mobile number");
      return;
    }
    if (form.password !== form.confirm_password) {
      toast.error("Passwords do not match");
      return;
    }
    if (form.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        name: form.name, email: form.email, mobile: form.mobile,
        password: form.password, restaurant_name: form.restaurant_name,
        restaurant_description: form.restaurant_description,
        restaurant_address: form.restaurant_address, cuisine_type: form.cuisine_type
      };
      const { data } = await axios.post(`${API}/auth/register`, payload);
      localStorage.setItem("owner_token", data.token);
      localStorage.setItem("owner_restaurant_id", data.restaurant_id);
      localStorage.setItem("restaurant_name", data.restaurant_name);
      toast.success("Restaurant registered! Menu auto-populated with demo items.");
      navigate("/owner/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-8 font-['Inter',sans-serif]">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ChefHat size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 font-['Plus_Jakarta_Sans',sans-serif]">Register Restaurant</h1>
          <p className="text-slate-500 mt-1">Set up your SmashDine account</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Your Name *</label>
                <input data-testid="reg-name" type="text" value={form.name}
                  onChange={e => update("name", e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  placeholder="John Doe" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Email *</label>
                <input data-testid="reg-email" type="email" value={form.email}
                  onChange={e => update("email", e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  placeholder="email@restaurant.com" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Mobile Number *</label>
              <div className="flex gap-2">
                <div className="flex items-center px-3 py-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-500 text-sm font-medium">
                  🇮🇳 +91
                </div>
                <input data-testid="reg-mobile" type="tel" value={form.mobile}
                  onChange={e => update("mobile", e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  placeholder="9876543210" maxLength={10} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Restaurant Name *</label>
              <input data-testid="reg-restaurant-name" type="text" value={form.restaurant_name}
                onChange={e => update("restaurant_name", e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                placeholder="The Smash Burger Co." />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Address</label>
                <input type="text" value={form.restaurant_address}
                  onChange={e => update("restaurant_address", e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  placeholder="123 Main Street" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Cuisine Type</label>
                <select value={form.cuisine_type} onChange={e => update("cuisine_type", e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all bg-white">
                  {["Multi-Cuisine","Fast Food","Cafe","Fine Dining","Chinese","Indian","Continental","Italian"].map(c => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
              <textarea value={form.restaurant_description}
                onChange={e => update("restaurant_description", e.target.value)} rows={2}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all resize-none"
                placeholder="Best burgers in town..." />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Password *</label>
                <div className="relative">
                  <input data-testid="reg-password" type={showPwd ? "text" : "password"} value={form.password}
                    onChange={e => update("password", e.target.value)}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all pr-12"
                    placeholder="Min. 6 characters" />
                  <button type="button" onClick={() => setShowPwd(p => !p)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                    {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm Password *</label>
                <input type="password" value={form.confirm_password}
                  onChange={e => update("confirm_password", e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  placeholder="Repeat password" />
              </div>
            </div>

            <button data-testid="register-submit-btn" type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60">
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <><UserPlus size={18} /> Register & Get Started</>
              )}
            </button>
          </form>
        </div>

        <p className="text-center mt-6 text-slate-500 text-sm">
          Already registered?{" "}
          <Link to="/owner/login" className="text-emerald-600 font-semibold hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
