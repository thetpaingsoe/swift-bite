import { Navigate, Route, Routes } from "react-router-dom";
import { AdminLayout } from "./components/AdminLayout";
import { AdminRoute } from "./components/AdminRoute";
import { ClientLayout } from "./components/ClientLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminCategories } from "./routes/AdminCategories";
import { AdminCategoryEdit } from "./routes/AdminCategoryEdit";
import { AdminCategoryNew } from "./routes/AdminCategoryNew";
import { AdminDashboard } from "./routes/AdminDashboard";
import { AdminItemEdit } from "./routes/AdminItemEdit";
import { AdminItemNew } from "./routes/AdminItemNew";
import { AdminItems } from "./routes/AdminItems";
import { AdminPlaceholder } from "./routes/AdminPlaceholder";
import { Cart } from "./routes/Cart";
import { Checkout } from "./routes/Checkout";
import { Confirmation } from "./routes/Confirmation";
import { Login } from "./routes/Login";
import { Menu } from "./routes/Menu";
import { OrderDetail } from "./routes/OrderDetail";
import { Orders } from "./routes/Orders";
import { Register } from "./routes/Register";
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
      <Route
        path="/register"
        element={token ? <Navigate to="/" replace /> : <Register />}
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
        <Route
          path="orders"
          element={
            <ProtectedRoute>
              <Orders />
            </ProtectedRoute>
          }
        />
        <Route
          path="orders/:id"
          element={
            <ProtectedRoute>
              <OrderDetail />
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
        <Route path="categories" element={<AdminCategories />} />
        <Route path="categories/new" element={<AdminCategoryNew />} />
        <Route path="categories/:id/edit" element={<AdminCategoryEdit />} />
        <Route path="items" element={<AdminItems />} />
        <Route path="items/new" element={<AdminItemNew />} />
        <Route path="items/:id/edit" element={<AdminItemEdit />} />
        <Route path="orders" element={<AdminPlaceholder title="Orders" />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
