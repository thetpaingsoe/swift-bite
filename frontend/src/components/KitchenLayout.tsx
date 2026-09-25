import { Link, Outlet, useNavigate } from "react-router-dom";
import { Store } from "lucide-react";
import { useAppDispatch, useAppSelector } from "../store/store";
import { clearSession } from "../store/auth-slice";
import { BrandLogo } from "./BrandLogo";
import { ProfileMenu } from "./ProfileMenu";

export function KitchenLayout() {
  const user = useAppSelector((s) => s.auth.user);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  function logout() {
    dispatch(clearSession());
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/kitchen" className="text-lg">
            <BrandLogo suffix="Kitchen" />
          </Link>
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-sm font-semibold tracking-wide text-stone-600 hover:text-primary"
            >
              <Store className="h-4 w-4" />
              STOREFRONT
            </Link>
            {user && <ProfileMenu user={user} onLogout={logout} />}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
