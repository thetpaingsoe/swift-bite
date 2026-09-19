import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Receipt, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { useAppDispatch, useAppSelector } from "../store/store";
import { clearSession } from "../store/auth-slice";
import { BrandLogo } from "./BrandLogo";
import { CartModal } from "./CartModal";
import { CheckoutButton } from "./CheckoutButton";
import { ProfileMenu } from "./ProfileMenu";
import { cn } from "../lib/cn";

export function ClientLayout() {
  const user = useAppSelector((s) => s.auth.user);
  const cartCount = useAppSelector((s) =>
    s.cart.lines.reduce((sum, line) => sum + line.quantity, 0),
  );
  const cartTotal = useAppSelector((s) =>
    s.cart.lines.reduce((sum, line) => sum + line.price * line.quantity, 0),
  );
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [cartOpen, setCartOpen] = useState(false);

  const showCartBar =
    cartCount > 0 && !["/cart", "/checkout"].includes(location.pathname);

  function logout() {
    dispatch(clearSession());
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <Link to="/" className="text-lg">
            <BrandLogo />
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <NavLink
              to="/cart"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-1.5 text-sm font-semibold tracking-wide",
                  isActive ? "text-primary" : "text-stone-600 hover:text-primary",
                )
              }
            >
              <ShoppingBag className="h-4 w-4" />
              CART
              {cartCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-bold text-white">
                  {cartCount}
                </span>
              )}
            </NavLink>
            {user && (
              <NavLink
                to="/orders"
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-1.5 text-sm font-semibold tracking-wide",
                    isActive ? "text-primary" : "text-stone-600 hover:text-primary",
                  )
                }
              >
                <Receipt className="h-4 w-4" />
                ORDERS
              </NavLink>
            )}
            {user ? (
              <ProfileMenu user={user} onLogout={logout} />
            ) : (
              <Link to="/login" className="font-semibold text-stone-600 hover:text-stone-900">
                Log in
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main className={cn("mx-auto max-w-5xl px-4 py-8", showCartBar && "pb-28")}>
        <Outlet />
      </main>
      {showCartBar && (
        <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-4">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between rounded-2xl bg-stone-900 px-5 py-4 text-white shadow-lg">
            <button
              onClick={() => setCartOpen(true)}
              className="flex cursor-pointer items-center gap-3"
            >
              <span className="relative">
                <ShoppingBag className="h-5 w-5" />
                <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-bold">
                  {cartCount}
                </span>
              </span>
              <span className="text-sm font-medium">{cartCount} items</span>
            </button>
            <div className="flex items-center gap-3">
              <span className="font-semibold">${cartTotal}</span>
              <CheckoutButton onClick={() => navigate("/cart")} />
            </div>
          </div>
        </div>
      )}
      {cartOpen && cartCount > 0 && (
        <CartModal
          onClose={() => setCartOpen(false)}
          onCheckout={() => {
            setCartOpen(false);
            navigate("/checkout");
          }}
        />
      )}
    </div>
  );
}
