import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { ShoppingCart, Plus, Minus, Trash2, ChevronRight, MapPin, Clock } from "lucide-react";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function CartItem({ item, onQty, onRemove }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-orange-100 last:border-0">
      <img src={item.image_url} alt={item.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" onError={e => { e.target.src = 'https://images.unsplash.com/photo-1565299507177-b0ac66763828?w=100&q=80'; }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-orange-900 truncate">{item.name}</p>
        <p className="text-xs text-orange-600">₹{item.price} × {item.quantity}</p>
      </div>
      <div className="flex items-center gap-2">
        <button data-testid={`cart-decrease-${item.id}`} onClick={() => onQty(item.id, -1)} className="w-7 h-7 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center hover:bg-orange-200 transition-colors">
          <Minus size={12} />
        </button>
        <span className="w-5 text-center text-sm font-bold text-orange-900">{item.quantity}</span>
        <button data-testid={`cart-increase-${item.id}`} onClick={() => onQty(item.id, 1)} className="w-7 h-7 rounded-full bg-orange-500 text-white flex items-center justify-center hover:bg-orange-600 transition-colors">
          <Plus size={12} />
        </button>
        <button data-testid={`cart-remove-${item.id}`} onClick={() => onRemove(item.id)} className="w-7 h-7 rounded-full bg-red-100 text-red-500 flex items-center justify-center hover:bg-red-200 transition-colors ml-1">
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

function FoodCard({ item, onAdd, qty }) {
  const [adding, setAdding] = useState(false);

  function handleAdd() {
    setAdding(true);
    onAdd(item);
    setTimeout(() => setAdding(false), 300);
  }

  return (
    <div className="food-card bg-white rounded-2xl overflow-hidden border border-orange-100 animate-slideUp">
      <div className="relative h-44 overflow-hidden">
        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover"
          onError={e => { e.target.src = 'https://images.unsplash.com/photo-1565299507177-b0ac66763828?w=400&q=80'; }} />
        {qty > 0 && (
          <div className="absolute top-2 right-2 bg-orange-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
            {qty}
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-['Fraunces',serif] font-semibold text-orange-900 text-sm leading-snug mb-1">{item.name}</h3>
        <p className="text-xs text-orange-700/60 mb-3 line-clamp-2">{item.description}</p>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-lg font-bold text-orange-600">₹{item.price}</span>
            <div className="flex items-center gap-1 text-xs text-orange-400">
              <Clock size={10} /> <span>{item.prep_time_minutes} min</span>
            </div>
          </div>
          <button
            data-testid={`add-item-${item.id}`}
            onClick={handleAdd}
            className={`flex items-center gap-1 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-full transition-all active:scale-95 ${adding ? 'animate-cartBounce' : ''}`}
          >
            <Plus size={14} /> Add
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MenuPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const restaurantId = params.get("rid");
  const tableNum = params.get("table");

  const [restaurant, setRestaurant] = useState(null);
  const [categories, setCategories] = useState([]);
  const [cart, setCart] = useState({});
  const [activeCategory, setActiveCategory] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const catRefs = useRef({});
  const cartBtnRef = useRef(null);

  useEffect(() => {
    if (!restaurantId) {
      setError("Invalid QR code — no restaurant ID found.");
      setLoading(false);
      return;
    }
    axios.get(`${API}/menu/${restaurantId}`)
      .then(r => {
        setRestaurant(r.data.restaurant);
        setCategories(r.data.categories);
        if (r.data.categories.length) setActiveCategory(r.data.categories[0].id);
        setLoading(false);
      })
      .catch(() => {
        setError("Restaurant not found. Please scan a valid QR code.");
        setLoading(false);
      });
  }, [restaurantId]);

  function addToCart(item) {
    setCart(prev => ({ ...prev, [item.id]: { ...item, quantity: (prev[item.id]?.quantity || 0) + 1 } }));
    toast.success(`${item.name} added to cart!`, { duration: 1500 });
    if (cartBtnRef.current) {
      cartBtnRef.current.classList.add('animate-cartBounce');
      setTimeout(() => cartBtnRef.current?.classList.remove('animate-cartBounce'), 400);
    }
  }

  function updateQty(id, delta) {
    setCart(prev => {
      const item = prev[id];
      if (!item) return prev;
      const newQty = item.quantity + delta;
      if (newQty <= 0) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: { ...item, quantity: newQty } };
    });
  }

  function removeItem(id) {
    setCart(prev => { const n = { ...prev }; delete n[id]; return n; });
  }

  const cartItems = Object.values(cart);
  const cartTotal = cartItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const cartCount = cartItems.reduce((s, i) => s + i.quantity, 0);

  function scrollToCategory(catId) {
    setActiveCategory(catId);
    catRefs.current[catId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function goCheckout() {
    if (cartItems.length === 0) {
      toast.error("Add items to cart first!");
      return;
    }
    const orderData = {
      restaurantId,
      tableNumber: tableNum || 1,
      items: cartItems,
      restaurantName: restaurant?.name || "Restaurant"
    };
    localStorage.setItem("pending_order", JSON.stringify(orderData));
    navigate("/checkout");
  }

  if (loading) {
    return (
      <div className="min-h-screen customer-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-orange-600 font-semibold">Loading menu...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen customer-bg flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h2 className="font-['Fraunces',serif] text-2xl font-bold text-orange-900 mb-2">Oops!</h2>
          <p className="text-orange-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen customer-bg pb-32 font-['Nunito',sans-serif]">
      {/* Header */}
      <div className="bg-gradient-to-br from-orange-500 to-red-600 text-white px-6 pt-8 pb-16">
        <div className="flex items-center gap-2 text-orange-200 text-sm mb-2">
          <MapPin size={14} /> {restaurant?.address || 'Table ' + tableNum}
        </div>
        <h1 className="font-['Fraunces',serif] text-4xl font-bold leading-tight">{restaurant?.name}</h1>
        <p className="text-orange-200 text-sm mt-1">{restaurant?.description || restaurant?.cuisine_type}</p>
        <div className="mt-3 inline-flex items-center gap-2 bg-white/20 rounded-full px-3 py-1 text-sm">
          Table #{tableNum}
        </div>
      </div>

      {/* Category tabs */}
      <div className="sticky top-0 z-30 bg-white shadow-sm">
        <div className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-hide">
          {categories.map(cat => (
            <button
              key={cat.id}
              data-testid={`category-tab-${cat.name}`}
              onClick={() => scrollToCategory(cat.id)}
              className={`flex-shrink-0 px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                activeCategory === cat.id
                  ? 'bg-orange-500 text-white'
                  : 'bg-orange-50 text-orange-700 hover:bg-orange-100'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Menu sections */}
      <div className="px-4 mt-6 space-y-10 -mt-6">
        {/* Pull up */}
        <div className="h-6" />
        {categories.map(cat => (
          <div key={cat.id} ref={el => catRefs.current[cat.id] = el}>
            <h2 className="font-['Fraunces',serif] text-2xl font-bold text-orange-900 mb-4 px-1">{cat.name}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {cat.items.map(item => (
                <FoodCard
                  key={item.id}
                  item={item}
                  qty={cart[item.id]?.quantity || 0}
                  onAdd={addToCart}
                />
              ))}
              {cat.items.length === 0 && (
                <p className="text-orange-400 text-sm col-span-2">No items available in this category</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Floating cart button */}
      {cartCount > 0 && (
        <div className="cart-sticky px-4 pb-4">
          <button
            data-testid="view-cart-btn"
            ref={cartBtnRef}
            onClick={() => setCartOpen(true)}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 px-6 rounded-2xl flex items-center justify-between warm-shadow transition-all active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <div className="bg-white/20 rounded-xl px-3 py-1 text-sm font-bold">{cartCount}</div>
              <span className="text-lg">View Cart</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-bold">₹{cartTotal.toFixed(0)}</span>
              <ChevronRight size={20} />
            </div>
          </button>
        </div>
      )}

      {/* Cart Drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setCartOpen(false)} />
          <div className="relative bg-white rounded-t-3xl max-h-[80vh] flex flex-col animate-slideUp z-10">
            <div className="flex items-center justify-between px-6 py-4 border-b border-orange-100">
              <div className="flex items-center gap-2">
                <ShoppingCart size={20} className="text-orange-500" />
                <h2 className="font-['Fraunces',serif] text-xl font-bold text-orange-900">Your Cart</h2>
              </div>
              <button data-testid="close-cart-btn" onClick={() => setCartOpen(false)} className="text-orange-400 hover:text-orange-600">
                <Minus size={20} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-2">
              {cartItems.map(item => (
                <CartItem key={item.id} item={item} onQty={updateQty} onRemove={removeItem} />
              ))}
            </div>
            <div className="px-6 py-4 border-t border-orange-100">
              <div className="flex justify-between text-sm text-orange-700 mb-1">
                <span>Subtotal</span><span>₹{cartTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-orange-700 mb-3">
                <span>GST (18%)</span><span>₹{(cartTotal * 0.18).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-orange-900 text-lg mb-4">
                <span>Total</span><span>₹{(cartTotal * 1.18).toFixed(2)}</span>
              </div>
              <button
                data-testid="proceed-checkout-btn"
                onClick={goCheckout}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-2xl text-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                Proceed to Checkout <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
