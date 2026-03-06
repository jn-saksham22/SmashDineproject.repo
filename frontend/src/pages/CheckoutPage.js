import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { CreditCard, Smartphone, Wallet, ChevronLeft, CheckCircle, ShieldCheck } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const GST = 0.18;

export default function CheckoutPage() {
  const navigate = useNavigate();
  const [orderData, setOrderData] = useState(null);
  const [customerName, setCustomerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("upi");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("review"); // review | processing | success
  const [progress, setProgress] = useState(0);
  const [orderId, setOrderId] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem("pending_order");
    if (!saved) { navigate("/"); return; }
    setOrderData(JSON.parse(saved));
  }, [navigate]);

  if (!orderData) return null;

  const subtotal = orderData.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const gstAmount = subtotal * GST;
  const total = subtotal + gstAmount;

  async function handlePayment() {
    if (!customerName.trim()) {
      toast.error("Please enter your name");
      return;
    }
    setLoading(true);
    setStep("processing");

    // Create order first
    let createdOrderId;
    try {
      const orderPayload = {
        restaurant_id: orderData.restaurantId,
        table_number: parseInt(orderData.tableNumber) || 1,
        customer_name: customerName.trim(),
        items: orderData.items.map(i => ({
          menu_item_id: i.id,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          prep_time_minutes: i.prep_time_minutes || 8,
          item_type: i.item_type || 'food',
          image_url: i.image_url || ''
        }))
      };
      const { data: orderRes } = await axios.post(`${API}/orders`, orderPayload);
      createdOrderId = orderRes.order_id;
      setOrderId(createdOrderId);
    } catch (err) {
      toast.error("Failed to create order");
      setLoading(false);
      setStep("review");
      return;
    }

    // Simulate payment countdown
    let p = 0;
    const interval = setInterval(() => {
      p += 10;
      setProgress(p);
      if (p >= 100) {
        clearInterval(interval);
        processPayment(createdOrderId);
      }
    }, 250);
  }

  async function processPayment(oid) {
    try {
      await axios.post(`${API}/payments/simulate`, {
        order_id: oid,
        payment_method: paymentMethod,
        customer_name: customerName
      });
      setStep("success");
      localStorage.removeItem("pending_order");
      setTimeout(() => {
        navigate(`/game?orderId=${oid}&total=${total.toFixed(0)}&name=${encodeURIComponent(customerName)}`);
      }, 2500);
    } catch (err) {
      toast.error("Payment failed, please try again");
      setLoading(false);
      setStep("review");
    }
  }

  const methods = [
    { id: "upi", icon: Smartphone, label: "UPI Payment", desc: "GPay, PhonePe, Paytm" },
    { id: "card", icon: CreditCard, label: "Credit / Debit Card", desc: "Visa, Mastercard, Rupay" },
    { id: "wallet", icon: Wallet, label: "Digital Wallet", desc: "Amazon Pay, Airtel" },
  ];

  if (step === "processing") {
    return (
      <div className="min-h-screen customer-bg flex items-center justify-center px-6 font-['Nunito',sans-serif]">
        <div className="text-center max-w-sm w-full">
          <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-6">
            <div className="w-14 h-14 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
          </div>
          <h2 className="font-['Fraunces',serif] text-2xl font-bold text-orange-900 mb-2">Processing Payment</h2>
          <p className="text-orange-600 mb-6">Please wait while we confirm your payment...</p>
          <div className="bg-orange-100 rounded-full h-3 overflow-hidden">
            <div className="h-full bg-orange-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-orange-400 text-sm mt-3">{progress}% complete</p>
        </div>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="min-h-screen customer-bg flex items-center justify-center px-6 font-['Nunito',sans-serif]">
        <div className="text-center max-w-sm animate-bounceIn">
          <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="text-green-500" size={52} />
          </div>
          <h2 className="font-['Fraunces',serif] text-3xl font-bold text-orange-900 mb-2">Payment Done!</h2>
          <p className="text-orange-600 text-lg mb-2">₹{total.toFixed(2)} paid successfully</p>
          <p className="text-orange-500 text-sm">Order #{orderId}</p>
          <p className="text-orange-400 mt-4 text-sm animate-pulse">Loading your reward game...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen customer-bg pb-8 font-['Nunito',sans-serif]">
      {/* Header */}
      <div className="bg-gradient-to-br from-orange-500 to-red-600 text-white px-6 pt-8 pb-8">
        <button data-testid="back-to-menu-btn" onClick={() => navigate(-1)} className="flex items-center gap-1 text-orange-200 mb-4 hover:text-white transition-colors">
          <ChevronLeft size={20} /> Back to Menu
        </button>
        <h1 className="font-['Fraunces',serif] text-3xl font-bold">Checkout</h1>
        <p className="text-orange-200 text-sm mt-1">{orderData.restaurantName} · Table #{orderData.tableNumber}</p>
      </div>

      <div className="max-w-lg mx-auto px-4 mt-6 space-y-5">
        {/* Name */}
        <div className="bg-white rounded-2xl p-5 border border-orange-100">
          <h2 className="font-bold text-orange-900 mb-3">Your Name</h2>
          <input
            data-testid="customer-name-input"
            type="text"
            value={customerName}
            onChange={e => setCustomerName(e.target.value)}
            className="w-full border-b-2 border-orange-200 focus:border-orange-500 outline-none py-2 text-orange-900 placeholder-orange-300 transition-colors bg-transparent"
            placeholder="Enter your name for the order..."
          />
        </div>

        {/* Order Summary */}
        <div className="bg-white rounded-2xl p-5 border border-orange-100">
          <h2 className="font-bold text-orange-900 mb-4">Order Summary</h2>
          <div className="space-y-3 mb-4">
            {orderData.items.map((item, i) => (
              <div key={i} className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-semibold text-orange-900">{item.name}</p>
                  <p className="text-xs text-orange-500">Qty: {item.quantity}</p>
                </div>
                <span className="text-sm font-bold text-orange-700">₹{(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-orange-100 pt-3 space-y-2">
            <div className="flex justify-between text-sm text-orange-700">
              <span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-orange-600">
              <span>GST (18%)</span><span>₹{gstAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-orange-900 text-lg pt-1">
              <span>Total</span><span>₹{total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Payment Method */}
        <div className="bg-white rounded-2xl p-5 border border-orange-100">
          <h2 className="font-bold text-orange-900 mb-4">Payment Method</h2>
          <div className="space-y-3">
            {methods.map(m => (
              <label key={m.id} data-testid={`payment-method-${m.id}`}
                className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === m.id ? 'border-orange-500 bg-orange-50' : 'border-slate-100 hover:border-orange-200'}`}>
                <input type="radio" name="payment" value={m.id} checked={paymentMethod === m.id}
                  onChange={() => setPaymentMethod(m.id)} className="sr-only" />
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${paymentMethod === m.id ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <m.icon size={20} />
                </div>
                <div>
                  <p className="font-semibold text-orange-900 text-sm">{m.label}</p>
                  <p className="text-xs text-orange-500">{m.desc}</p>
                </div>
                {paymentMethod === m.id && <CheckCircle className="ml-auto text-orange-500" size={20} />}
              </label>
            ))}
          </div>
        </div>

        {/* Secure note */}
        <div className="flex items-center gap-2 text-sm text-orange-500 justify-center">
          <ShieldCheck size={16} /> Secured payment simulation
        </div>

        {/* Pay Button */}
        <button
          data-testid="pay-now-btn"
          onClick={handlePayment}
          disabled={loading}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-5 rounded-2xl text-xl transition-all active:scale-[0.98] warm-shadow disabled:opacity-60"
        >
          Pay ₹{total.toFixed(2)}
        </button>
      </div>
    </div>
  );
}
