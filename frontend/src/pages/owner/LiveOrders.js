import { useState, useEffect } from "react";
import axios from "axios";
import OwnerLayout from "../../components/OwnerLayout";
import { RefreshCw, Clock, Filter } from "lucide-react";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_CONFIG = {
  pending:   { label: "Pending",   color: "bg-blue-50 text-blue-700 border-blue-200",   dot: "bg-blue-400",   next: "preparing", nextLabel: "Start Preparing" },
  preparing: { label: "Preparing", color: "bg-orange-50 text-orange-700 border-orange-200", dot: "bg-orange-400", next: "ready",     nextLabel: "Mark Ready" },
  ready:     { label: "Ready",     color: "bg-green-50 text-green-700 border-green-200",  dot: "bg-green-400",  next: "served",    nextLabel: "Mark Served" },
  served:    { label: "Served",    color: "bg-purple-50 text-purple-700 border-purple-200", dot: "bg-purple-400", next: null,       nextLabel: null },
  cancelled: { label: "Cancelled", color: "bg-red-50 text-red-700 border-red-200",       dot: "bg-red-400",    next: null,        nextLabel: null },
};

function timeSince(iso) {
  if (!iso) return '';
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export default function LiveOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [expanding, setExpanding] = useState(null);
  const token = localStorage.getItem("owner_token");
  const headers = { Authorization: `Bearer ${token}` };

  async function loadOrders() {
    try {
      const { data } = await axios.get(`${API}/owner/orders`, { headers });
      setOrders(data);
      setLoading(false);
    } catch {
      toast.error("Failed to load orders");
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 20000);
    return () => clearInterval(interval);
  }, []);

  async function updateStatus(orderId, newStatus) {
    try {
      await axios.put(`${API}/owner/orders/${orderId}/status`, { status: newStatus }, { headers });
      toast.success(`Status updated to ${newStatus}`);
      loadOrders();
    } catch {
      toast.error("Update failed");
    }
  }

  const filteredOrders = filter === "all" ? orders : orders.filter(o => o.status === filter);
  const pendingCount = orders.filter(o => o.status === "pending").length;
  const preparingCount = orders.filter(o => o.status === "preparing").length;

  return (
    <OwnerLayout title="Live Orders">
      <div className="space-y-4">
        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {["pending", "preparing", "ready", "served"].map(s => {
            const cnt = orders.filter(o => o.status === s).length;
            const cfg = STATUS_CONFIG[s];
            return (
              <button key={s} data-testid={`filter-${s}`}
                onClick={() => setFilter(filter === s ? "all" : s)}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${filter === s ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${cfg.dot}`} />
                <div className="min-w-0 text-left">
                  <p className="text-sm font-bold text-slate-800">{cnt}</p>
                  <p className="text-xs text-slate-500 capitalize">{s}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-slate-800 font-['Plus_Jakarta_Sans',sans-serif]">
              {filter === "all" ? `All Orders (${orders.length})` : `${filter} (${filteredOrders.length})`}
            </h2>
            {(pendingCount > 0 || preparingCount > 0) && (
              <span className="text-xs bg-orange-500 text-white rounded-full px-2 py-0.5 animate-pulse">
                {pendingCount + preparingCount} active
              </span>
            )}
          </div>
          <button data-testid="refresh-orders-btn" onClick={loadOrders}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2 transition-colors">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-7 h-7 border-2 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 py-16 text-center">
            <Clock className="mx-auto text-slate-300 mb-3" size={40} />
            <p className="text-slate-500">No {filter === "all" ? "" : filter} orders yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map(order => {
              const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
              const isExpanded = expanding === order.order_id;
              return (
                <div key={order.order_id} data-testid={`order-card-${order.order_id}`}
                  className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="flex items-center gap-3 px-5 py-4 cursor-pointer" onClick={() => setExpanding(isExpanded ? null : order.order_id)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="font-bold text-slate-800 text-sm font-['Inter',sans-serif]">#{order.order_id}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.color}`}>{cfg.label}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Table #{order.table_number} · {order.customer_name} · {order.items?.length || 0} items · ₹{order.total?.toFixed(0)} · {timeSince(order.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {cfg.next && (
                        <button data-testid={`action-${order.order_id}`}
                          onClick={e => { e.stopPropagation(); updateStatus(order.order_id, cfg.next); }}
                          className="text-xs bg-emerald-500 text-white px-3 py-2 rounded-lg hover:bg-emerald-600 transition-colors font-medium whitespace-nowrap">
                          {cfg.nextLabel}
                        </button>
                      )}
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="border-t border-slate-100 px-5 py-3 bg-slate-50">
                      <p className="text-xs font-semibold text-slate-600 mb-2">Order items:</p>
                      {order.items?.map((item, i) => (
                        <div key={i} className="flex justify-between text-xs text-slate-600 py-1">
                          <span>{item.name} × {item.quantity}</span>
                          <span className="font-medium">₹{(item.price * item.quantity).toFixed(0)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-xs font-bold text-slate-800 pt-2 border-t border-slate-200 mt-1">
                        <span>Total (incl. GST)</span><span>₹{order.total?.toFixed(2)}</span>
                      </div>
                      {order.coupon_code && (
                        <p className="text-xs text-orange-600 mt-2 font-medium">Coupon: {order.coupon_code}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </OwnerLayout>
  );
}
