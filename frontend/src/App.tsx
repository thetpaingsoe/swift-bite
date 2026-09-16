import { Navigate, Route, Routes } from "react-router-dom";
import { AdminLayout } from "./components/AdminLayout";
import { AdminRoute } from "./components/AdminRoute";
import { ClientLayout } from "./components/ClientLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminDashboard } from "./routes/AdminDashboard";
import { Cart } from "./routes/Cart";
import { Checkout } from "./routes/Checkout";
import { Confirmation } from "./routes/Confirmation";
import { Login } from "./routes/Login";
import { Menu } from "./routes/Menu";
import { useAppSelector } from "./store/store";

export default function App() {
  const token = useAppSelector((s) => s.auth.token);
  const role = useAppSelector((s) => s.auth.user?.role);

  return (
    <Routes>
      <Route
        path="/login"
        element={
          token ? (
            <Navigate to={role === "admin" ? "/admin" : "/"} replace />
          ) : (
            <Login />
          )
        }
      />
      <Route path="/" element={<ClientLayout />}>
        <Route index element={<Menu />} />
        <Route path="cart" element={<Cart />} />
        <Route
          path="checkout"
          element={
            <ProtectedRoute>
              <Checkout />
            </ProtectedRoute>
          }
        />
        <Route
          path="confirmation"
          element={
            <ProtectedRoute>
              <Confirmation />
            </ProtectedRoute>
          }
        />
      </Route>
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
