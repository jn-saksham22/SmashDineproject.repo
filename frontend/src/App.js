import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import LandingPage from "./pages/LandingPage";
import MenuPage from "./pages/MenuPage";
import CheckoutPage from "./pages/CheckoutPage";
import GamePage from "./pages/GamePage";
import OrderTrackingPage from "./pages/OrderTrackingPage";
import OwnerLogin from "./pages/owner/OwnerLogin";
import OwnerRegister from "./pages/owner/OwnerRegister";
import Dashboard from "./pages/owner/Dashboard";
import LiveOrders from "./pages/owner/LiveOrders";
import MenuManagement from "./pages/owner/MenuManagement";
import TableManagement from "./pages/owner/TableManagement";
import Analytics from "./pages/owner/Analytics";

function ProtectedRoute({ children }) {
  const token = localStorage.getItem("owner_token");
  return token ? children : <Navigate to="/owner/login" replace />;
}

function App() {
  return (
    <div className="App">
      <Toaster position="top-center" richColors />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/menu" element={<MenuPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/game" element={<GamePage />} />
          <Route path="/order/:orderId" element={<OrderTrackingPage />} />
          <Route path="/owner/login" element={<OwnerLogin />} />
          <Route path="/owner/register" element={<OwnerRegister />} />
          <Route path="/owner/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/owner/orders" element={<ProtectedRoute><LiveOrders /></ProtectedRoute>} />
          <Route path="/owner/menu" element={<ProtectedRoute><MenuManagement /></ProtectedRoute>} />
          <Route path="/owner/tables" element={<ProtectedRoute><TableManagement /></ProtectedRoute>} />
          <Route path="/owner/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
          <Route path="/owner" element={<Navigate to="/owner/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
