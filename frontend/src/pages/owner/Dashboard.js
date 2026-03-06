import { useState, useEffect } from "react";
import axios from "axios";
import OwnerLayout from "../../components/OwnerLayout";
import { ShoppingBag, TrendingUp, Clock, Users, RefreshCw, CheckCircle, ChefHat, Package } from "lucide-react";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function MetricCard({ title, value, icon: Icon, color, sub }) {
  return (
    <div className="bg-white rounded-xl p-5 border border-slate-200 flex items-start gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-sm text-slate-500 font-['Inter',sans-serif]">{title}</p>
        <p className="text-2xl font-bold text-slate-800 font-['Plus_Jakarta_Sans',sans-serif]">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

const STATUS_COLORS = {
  pending: "bg-blue-50 text-blue-700 border-blue-200",
  preparing: "bg-orange-50 text-orange-700 border-orange-200",
  ready: "bg-green-50 text-green-700 border-green-200",
  served: "bg-purple-50 text-purple-700 border-purple-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
};

export default function Dashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem("owner_token");
  const headers = { Authorization: `Bearer ${token}` };

  async function loadData() {
    try {
      const [analyticsRes, ordersRes] = await Promise.all([
        axios.get(`${API}/owner/analytics`, { headers }),
        axios.get(`${API}/owner/orders`, { headers }),
      ]);
      setAnalytics(analyticsRes.data);
      setRecentOrders(ordersRes.data.slice(0, 8));
      setLoading(false);
    } catch (err) {
      toast.error("Failed to load dashboard data");
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  async function updateStatus(orderId, status) {
    try {
      await axios.put(`${API}/owner/orders/${orderId}/status`, { status }, { headers });
      toast.success(`Order ${orderId} → ${status}`);
      loadData();
    } catch {
      toast.error("Failed to update status");
    }
  }

  const activeOrders = recentOrders.filter(o => o.status === "preparing" || o.status === "pending").length;

  return (
    <OwnerLayout title="Dashboard">
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard title="Total Revenue" value={`₹${analytics?.total_revenue?.toFixed(0) || 0}`} icon={TrendingUp} color="bg-emerald-50 text-emerald-600" sub="All time" />
            <MetricCard title="Total Orders" value={analytics?.total_orders || 0} icon={ShoppingBag} color="bg-blue-50 text-blue-600" sub="Completed payments" />
            <MetricCard title="Active Orders" value={activeOrders} icon={Clock} color="bg-orange-50 text-orange-600" sub="In queue" />
            <MetricCard title="Avg Order Value" value={`₹${analytics?.avg_order_value?.toFixed(0) || 0}`} icon={Users} color="bg-purple-50 text-purple-600" sub="Per order" />
          </div>

          {/* Recent Orders + Top Items */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Recent orders */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <h2 className="font-semibold text-slate-800 font-['Plus_Jakarta_Sans',sans-serif]">Recent Orders</h2>
                <button data-testid="refresh-dashboard-btn" onClick={loadData} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
                  <RefreshCw size={13} /> Refresh
                </button>
              </div>
              <div className="divide-y divide-slate-50">
                {recentOrders.length === 0 && (
                  <div className="py-10 text-center text-slate-400 text-sm">No orders yet. Share your QR codes!</div>
                )}
                {recentOrders.map(order => (
                  <div key={order.order_id} data-testid={`order-row-${order.order_id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800 text-sm font-['Inter',sans-serif]">#{order.order_id}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[order.status] || 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                          {order.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">Table #{order.table_number} · {order.customer_name} · ₹{order.total?.toFixed(0)}</p>
                    </div>
                    <div className="flex gap-1.5">
                      {order.status === 'pending' && (
                        <button data-testid={`mark-preparing-${order.order_id}`}
                          onClick={() => updateStatus(order.order_id, 'preparing')}
                          className="text-xs bg-orange-500 text-white px-3 py-1.5 rounded-lg hover:bg-orange-600 transition-colors font-medium">
                          Start
                        </button>
                      )}
                      {order.status === 'preparing' && (
                        <button data-testid={`mark-ready-${order.order_id}`}
                          onClick={() => updateStatus(order.order_id, 'ready')}
                          className="text-xs bg-green-500 text-white px-3 py-1.5 rounded-lg hover:bg-green-600 transition-colors font-medium">
                          Ready
                        </button>
                      )}
                      {order.status === 'ready' && (
                        <button data-testid={`mark-served-${order.order_id}`}
                          onClick={() => updateStatus(order.order_id, 'served')}
                          className="text-xs bg-purple-500 text-white px-3 py-1.5 rounded-lg hover:bg-purple-600 transition-colors font-medium">
                          Served
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Items + Game Stats */}
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h2 className="font-semibold text-slate-800 mb-4 font-['Plus_Jakarta_Sans',sans-serif]">Top Items</h2>
                <div className="space-y-3">
                  {(analytics?.top_items || []).slice(0, 6).map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-slate-400 w-4 font-mono">#{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate font-['Inter',sans-serif]">{item.name}</p>
                        <div className="h-1.5 bg-slate-100 rounded-full mt-1">
                          <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${Math.min(100, (item.count / (analytics?.top_items?.[0]?.count || 1)) * 100)}%` }} />
                        </div>
                      </div>
                      <span className="text-xs font-bold text-slate-600">{item.count}x</span>
                    </div>
                  ))}
                  {(!analytics?.top_items?.length) && <p className="text-sm text-slate-400">No data yet</p>}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h2 className="font-semibold text-slate-800 mb-3 font-['Plus_Jakarta_Sans',sans-serif]">Game Stats</h2>
                <div className="flex justify-between text-sm">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-slate-800">{analytics?.game_stats?.total || 0}</p>
                    <p className="text-xs text-slate-500">Games Played</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-emerald-600">{analytics?.game_stats?.wins || 0}</p>
                    <p className="text-xs text-slate-500">Player Wins</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-orange-500">{analytics?.game_stats?.win_rate || 0}%</p>
                    <p className="text-xs text-slate-500">Win Rate</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </OwnerLayout>
  );
}
