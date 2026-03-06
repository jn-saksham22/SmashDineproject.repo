import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { Clock, CheckCircle, ChefHat, Package, Star, QrCode, RefreshCw } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_STEPS = [
  { key: "pending", label: "Order Placed", icon: Package, color: "text-blue-500 bg-blue-50" },
  { key: "preparing", label: "Preparing", icon: ChefHat, color: "text-orange-500 bg-orange-50" },
  { key: "ready", label: "Ready!", icon: CheckCircle, color: "text-green-500 bg-green-50" },
  { key: "served", label: "Served", icon: Star, color: "text-purple-500 bg-purple-50" },
];

function getStatusIndex(status) {
  return STATUS_STEPS.findIndex(s => s.key === status);
}

function timeUntilReady(estimatedReady) {
  if (!estimatedReady) return null;
  const diff = new Date(estimatedReady) - new Date();
  if (diff <= 0) return "Ready soon!";
  const mins = Math.ceil(diff / 60000);
  return `~${mins} min${mins !== 1 ? 's' : ''} remaining`;
}

export default function OrderTrackingPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  async function fetchOrder() {
    try {
      const { data } = await axios.get(`${API}/orders/${orderId}`);
      setOrder(data);
      setLastUpdated(new Date());
      setLoading(false);
    } catch {
      setError("Order not found");
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOrder();
    const interval = setInterval(fetchOrder, 15000);
    return () => clearInterval(interval);
  }, [orderId]);

  if (loading) {
    return (
      <div className="min-h-screen customer-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-orange-600 font-semibold">Loading your order...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen customer-bg flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-3xl mb-4">🔍</p>
          <h2 className="font-['Fraunces',serif] text-2xl font-bold text-orange-900 mb-2">Order Not Found</h2>
          <p className="text-orange-600">{error}</p>
          <button onClick={() => navigate("/")} className="mt-6 text-orange-500 hover:underline">Go to home</button>
        </div>
      </div>
    );
  }

  const statusIdx = getStatusIndex(order.status);
  const timeLeft = timeUntilReady(order.estimated_ready_at);
  const reward = order.game_result;

  return (
    <div className="min-h-screen customer-bg pb-10 font-['Nunito',sans-serif]">
      {/* Header */}
      <div className="bg-gradient-to-br from-orange-500 to-red-600 text-white px-6 pt-10 pb-12">
        <h1 className="font-['Fraunces',serif] text-3xl font-bold mb-1">Order Tracking</h1>
        <p data-testid="order-id-display" className="text-orange-200 text-sm">#{order.order_id}</p>
        <div className="mt-3 flex items-center gap-2 text-sm">
          <span className="bg-white/20 rounded-full px-3 py-1">Table #{order.table_number}</span>
          <span className="bg-white/20 rounded-full px-3 py-1">{order.customer_name}</span>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-6 space-y-4">
        {/* Status card */}
        <div className="bg-white rounded-2xl p-5 border border-orange-100 warm-shadow">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-orange-900">Order Status</h2>
            <button data-testid="refresh-btn" onClick={fetchOrder} className="flex items-center gap-1 text-xs text-orange-400 hover:text-orange-600">
              <RefreshCw size={12} /> Refresh
            </button>
          </div>

          {/* Progress steps */}
          <div className="flex items-center justify-between mb-6">
            {STATUS_STEPS.slice(0, 4).map((step, i) => {
              const isActive = i === statusIdx;
              const isDone = i < statusIdx;
              const StepIcon = step.icon;
              return (
                <div key={step.key} className="flex flex-col items-center flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-1.5 transition-all ${
                    isDone ? 'bg-green-500 text-white' : isActive ? step.color + ' animate-pulse-glow' : 'bg-slate-100 text-slate-400'
                  }`}>
                    <StepIcon size={18} />
                  </div>
                  <span className={`text-xs text-center leading-tight ${isActive ? 'font-bold text-orange-700' : isDone ? 'text-green-600' : 'text-slate-400'}`}>
                    {step.label}
                  </span>
                  {i < 3 && (
                    <div className={`absolute mt-5 ml-10 w-full h-0.5 ${isDone ? 'bg-green-400' : 'bg-slate-200'}`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* ETA */}
          {(order.status === 'pending' || order.status === 'preparing') && timeLeft && (
            <div data-testid="eta-display" className="flex items-center gap-3 bg-orange-50 rounded-xl p-4 border border-orange-100">
              <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Clock size={18} className="text-orange-500" />
              </div>
              <div>
                <p className="text-xs text-orange-500 font-medium">Estimated Time</p>
                <p className="text-orange-900 font-bold">{timeLeft}</p>
                <p className="text-xs text-orange-400">{order.prep_time_minutes} min total prep time</p>
              </div>
            </div>
          )}
          {order.status === 'ready' && (
            <div data-testid="order-ready-banner" className="flex items-center gap-3 bg-green-50 rounded-xl p-4 border border-green-200">
              <CheckCircle className="text-green-500 flex-shrink-0" size={24} />
              <div>
                <p className="font-bold text-green-800">Your order is ready!</p>
                <p className="text-xs text-green-600">Please collect your order from the counter</p>
              </div>
            </div>
          )}
          {order.status === 'served' && (
            <div className="flex items-center gap-3 bg-purple-50 rounded-xl p-4 border border-purple-200">
              <Star className="text-purple-500 flex-shrink-0" size={24} />
              <p className="font-bold text-purple-800">Enjoy your meal! Thank you for dining with us.</p>
            </div>
          )}

          <p className="text-xs text-slate-400 mt-3 text-center">Auto-refreshes every 15 seconds</p>
        </div>

        {/* Order items */}
        <div className="bg-white rounded-2xl p-5 border border-orange-100">
          <h2 className="font-bold text-orange-900 mb-4">Your Order</h2>
          <div className="space-y-3">
            {order.items.map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <img src={item.image_url} alt={item.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0"
                  onError={e => { e.target.src = 'https://images.unsplash.com/photo-1565299507177-b0ac66763828?w=100&q=80'; }} />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-orange-900">{item.name}</p>
                  <p className="text-xs text-orange-500">Qty: {item.quantity} × ₹{item.price}</p>
                </div>
                <span className="text-sm font-bold text-orange-700">₹{(item.price * item.quantity).toFixed(0)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-orange-100 mt-4 pt-3 space-y-1">
            <div className="flex justify-between text-sm text-orange-600">
              <span>Subtotal</span><span>₹{order.subtotal?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-orange-500">
              <span>GST (18%)</span><span>₹{order.gst_amount?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-orange-900 text-lg">
              <span>Total Paid</span><span>₹{order.total?.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Reward if won */}
        {reward && reward.won && (
          <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-2xl p-5 border-2 border-orange-200">
            <div className="flex items-center gap-2 mb-3">
              <Star className="text-yellow-500" size={20} />
              <h2 className="font-bold text-orange-900">Game Reward Earned!</h2>
            </div>
            <p className="text-orange-700 text-sm mb-3">{reward.reward_label}</p>
            {reward.coupon_code && (
              <div className="bg-white rounded-xl p-3 border border-dashed border-orange-400 text-center">
                <p className="text-xs text-orange-500 mb-1">Your Coupon Code</p>
                <p className="font-['Fraunces',serif] text-2xl font-bold text-orange-600 tracking-wider">
                  {reward.coupon_code}
                </p>
              </div>
            )}
          </div>
        )}

        {/* QR scan again */}
        <div className="text-center py-4">
          <div className="flex items-center justify-center gap-2 text-orange-400 text-sm">
            <QrCode size={16} />
            <span>Scan the QR code again to place another order</span>
          </div>
        </div>
      </div>
    </div>
  );
}
