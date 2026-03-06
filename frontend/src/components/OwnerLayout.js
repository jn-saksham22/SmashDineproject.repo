import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, ShoppingBag, UtensilsCrossed, QrCode,
  BarChart3, LogOut, Menu, X, ChefHat
} from "lucide-react";

const navItems = [
  { path: "/owner/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/owner/orders", icon: ShoppingBag, label: "Live Orders" },
  { path: "/owner/menu", icon: UtensilsCrossed, label: "Menu" },
  { path: "/owner/tables", icon: QrCode, label: "QR Codes" },
  { path: "/owner/analytics", icon: BarChart3, label: "Analytics" },
];

export default function OwnerLayout({ children, title }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const restaurantName = localStorage.getItem("restaurant_name") || "My Restaurant";

  function logout() {
    localStorage.removeItem("owner_token");
    localStorage.removeItem("owner_restaurant_id");
    localStorage.removeItem("restaurant_name");
    navigate("/owner/login");
  }

  const Sidebar = () => (
    <aside className="flex flex-col h-full bg-white border-r border-slate-200 w-64">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-200">
        <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center">
          <ChefHat size={18} className="text-white" />
        </div>
        <div>
          <div className="font-bold text-slate-800 text-sm font-['Plus_Jakarta_Sans',sans-serif] leading-tight truncate max-w-[140px]">
            {restaurantName}
          </div>
          <div className="text-xs text-slate-400">Owner Dashboard</div>
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <button
              key={item.path}
              data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
              onClick={() => { navigate(item.path); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium font-['Inter',sans-serif] transition-colors ${
                active
                  ? "bg-emerald-50 text-emerald-700 font-semibold"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              <item.icon size={18} />
              {item.label}
            </button>
          );
        })}
      </nav>
      <div className="p-4 border-t border-slate-200">
        <button
          data-testid="logout-btn"
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 transition-colors font-['Inter',sans-serif]"
        >
          <LogOut size={18} /> Logout
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen bg-slate-50 font-['Inter',sans-serif] overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-10 flex">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center gap-4 px-6 py-4 bg-white border-b border-slate-200">
          <button
            className="lg:hidden p-2 rounded-lg hover:bg-slate-100"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>
          <h1 className="text-xl font-bold text-slate-800 font-['Plus_Jakarta_Sans',sans-serif]">{title}</h1>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6 owner-scroll">
          {children}
        </main>
      </div>
    </div>
  );
}
