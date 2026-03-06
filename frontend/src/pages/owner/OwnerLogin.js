import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { ChefHat, Eye, EyeOff, LogIn } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function OwnerLogin() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.email || !form.password) {
      toast.error("Please fill in all fields");
      return;
    }
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/auth/login`, form);
      localStorage.setItem("owner_token", data.token);
      localStorage.setItem("owner_restaurant_id", data.restaurant_id);
      localStorage.setItem("restaurant_name", data.restaurant_name);
      toast.success(`Welcome back, ${data.restaurant_name}!`);
      navigate("/owner/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 font-['Inter',sans-serif]">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ChefHat size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 font-['Plus_Jakarta_Sans',sans-serif]">Owner Login</h1>
          <p className="text-slate-500 mt-1">Access your restaurant dashboard</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
              <input
                data-testid="login-email"
                type="email"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                placeholder="owner@restaurant.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  data-testid="login-password"
                  type={showPwd ? "text" : "password"}
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all pr-12"
                  placeholder="Enter your password"
                />
                <button type="button" onClick={() => setShowPwd(p => !p)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button
              data-testid="login-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <><LogIn size={18} /> Sign In</>
              )}
            </button>
          </form>
        </div>

        <p className="text-center mt-6 text-slate-500 text-sm">
          New restaurant?{" "}
          <Link to="/owner/register" data-testid="go-register-link" className="text-emerald-600 font-semibold hover:underline">
            Register here
          </Link>
        </p>
        <p className="text-center mt-3 text-slate-500 text-sm">
          <Link to="/" className="text-slate-400 hover:text-slate-600">← Back to home</Link>
        </p>
      </div>
    </div>
  );
}
