import { useState, useEffect } from "react";
import axios from "axios";
import OwnerLayout from "../../components/OwnerLayout";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { TrendingUp, ShoppingBag, Star, Trophy } from "lucide-react";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const PIE_COLORS = ["#10B981", "#F97316", "#3B82F6", "#A855F7", "#EF4444"];

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem("owner_token");

  useEffect(() => {
    axios.get(`${API}/owner/analytics`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { setData(r.data); setLoading(false); })
      .catch(() => { toast.error("Failed to load analytics"); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <OwnerLayout title="Analytics">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      </OwnerLayout>
    );
  }

  const statusData = data?.status_breakdown
    ? Object.entries(data.status_breakdown).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }))
    : [];

  return (
    <OwnerLayout title="Analytics">
      <div className="space-y-6">
        {/* Key metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Revenue", value: `₹${data?.total_revenue?.toFixed(0) || 0}`, icon: TrendingUp, color: "bg-emerald-50 text-emerald-600" },
            { label: "Total Orders", value: data?.total_orders || 0, icon: ShoppingBag, color: "bg-blue-50 text-blue-600" },
            { label: "Avg Order Value", value: `₹${data?.avg_order_value?.toFixed(0) || 0}`, icon: Star, color: "bg-orange-50 text-orange-600" },
            { label: "Game Win Rate", value: `${data?.game_stats?.win_rate || 0}%`, icon: Trophy, color: "bg-yellow-50 text-yellow-600" },
          ].map((m, i) => (
            <div key={i} className="bg-white rounded-xl p-5 border border-slate-200 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${m.color}`}>
                <m.icon size={22} />
              </div>
              <div>
                <p className="text-sm text-slate-500">{m.label}</p>
                <p className="text-2xl font-bold text-slate-800 font-['Plus_Jakarta_Sans',sans-serif]">{m.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Revenue Chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-800 mb-4 font-['Plus_Jakarta_Sans',sans-serif]">Daily Revenue (Last 7 Days)</h2>
          {data?.daily_revenue?.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.daily_revenue} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94A3B8' }} tickFormatter={v => v.slice(5)} />
                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} tickFormatter={v => `₹${v}`} />
                <Tooltip formatter={v => [`₹${v.toFixed(0)}`, "Revenue"]} labelStyle={{ color: '#1E293B' }} />
                <Bar dataKey="revenue" fill="#10B981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No revenue data yet</div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Top Items */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="font-semibold text-slate-800 mb-4 font-['Plus_Jakarta_Sans',sans-serif]">Top Ordered Items</h2>
            {data?.top_items?.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.top_items.slice(0, 6)} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94A3B8' }} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10, fill: '#64748B' }} />
                  <Tooltip formatter={v => [v, "Orders"]} />
                  <Bar dataKey="count" fill="#F97316" radius={[0, 5, 5, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No data yet</div>
            )}
          </div>

          {/* Status Breakdown */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="font-semibold text-slate-800 mb-4 font-['Plus_Jakarta_Sans',sans-serif]">Order Status Breakdown</h2>
            {statusData.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {statusData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No data yet</div>
            )}
          </div>

          {/* Top Tables */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="font-semibold text-slate-800 mb-4 font-['Plus_Jakarta_Sans',sans-serif]">Top Tables by Orders</h2>
            <div className="space-y-3">
              {data?.top_tables?.length ? data.top_tables.map(([table, count], i) => (
                <div key={table} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-400 w-5">#{i + 1}</span>
                  <span className="text-sm font-medium text-slate-700 flex-1">Table #{table}</span>
                  <div className="flex items-center gap-2 flex-1">
                    <div className="flex-1 h-2 bg-slate-100 rounded-full">
                      <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${(count / data.top_tables[0][1]) * 100}%` }} />
                    </div>
                    <span className="text-xs font-bold text-slate-600 w-8 text-right">{count}</span>
                  </div>
                </div>
              )) : <p className="text-sm text-slate-400">No data yet</p>}
            </div>
          </div>

          {/* Game Stats */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="font-semibold text-slate-800 mb-4 font-['Plus_Jakarta_Sans',sans-serif]">Game Statistics</h2>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-3xl font-bold text-slate-800 font-['Plus_Jakarta_Sans',sans-serif]">{data?.game_stats?.total || 0}</p>
                <p className="text-xs text-slate-500 mt-1">Total Games</p>
              </div>
              <div className="bg-emerald-50 rounded-xl p-4">
                <p className="text-3xl font-bold text-emerald-600 font-['Plus_Jakarta_Sans',sans-serif]">{data?.game_stats?.wins || 0}</p>
                <p className="text-xs text-slate-500 mt-1">Player Wins</p>
              </div>
              <div className="bg-orange-50 rounded-xl p-4">
                <p className="text-3xl font-bold text-orange-500 font-['Plus_Jakarta_Sans',sans-serif]">{data?.game_stats?.win_rate || 0}%</p>
                <p className="text-xs text-slate-500 mt-1">Win Rate</p>
              </div>
            </div>
            <div className="mt-4 bg-slate-50 rounded-xl p-3">
              <div className="flex justify-between text-sm text-slate-600 mb-1">
                <span>Coupons Issued (Wins)</span>
                <span className="font-semibold">{data?.game_stats?.wins || 0}</span>
              </div>
              <div className="h-2 bg-slate-200 rounded-full">
                <div className="h-full bg-orange-400 rounded-full" style={{ width: `${data?.game_stats?.win_rate || 0}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </OwnerLayout>
  );
}
