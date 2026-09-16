import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../store/store";
import { clearSession } from "../store/auth-slice";
import { Button } from "./ui/button";

export function ClientLayout() {
  const user = useAppSelector((s) => s.auth.user);
  const cartCount = useAppSelector((s) =>
    s.cart.lines.reduce((sum, line) => sum + line.quantity, 0),
  );
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  function logout() {
    dispatch(clearSession());
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <Link to="/" className="text-lg font-semibold tracking-tight text-stone-900">
            SwiftBite
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/" className="text-stone-600 hover:text-stone-900">
              Menu
            </Link>
            <Link to="/cart" className="text-stone-600 hover:text-stone-900">
              Cart{cartCount > 0 ? ` (${cartCount})` : ""}
            </Link>
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
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
