import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ShoppingBag } from "lucide-react";
import { useState } from "react";
import { useAppDispatch, useAppSelector } from "../store/store";
import { clearSession } from "../store/auth-slice";
import { Button } from "./ui/button";
import { BrandLogo } from "./BrandLogo";
import { CartModal } from "./CartModal";
import { CheckoutButton } from "./CheckoutButton";
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
            <Link to="/" className="text-stone-600 hover:text-stone-900">
              Menu
            </Link>
            <Link to="/cart" className="text-stone-600 hover:text-stone-900">
              Cart{cartCount > 0 ? ` (${cartCount})` : ""}
            </Link>
            {user && (
              <Link to="/orders" className="text-stone-600 hover:text-stone-900">
                Orders
              </Link>
            )}
            {user?.role === "admin" && (
              <Link to="/admin" className="text-stone-600 hover:text-stone-900">
                Admin
              </Link>
            )}
            {user ? (
              <>
                <span className="text-stone-400">{user.name}</span>
                <Button variant="outline" size="md" onClick={logout}>
                  Log out
                </Button>
              </>
            ) : (
              <Link to="/login" className="text-stone-600 hover:text-stone-900">
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
