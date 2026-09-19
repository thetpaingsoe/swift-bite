import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, Package, Receipt, Tags } from "lucide-react";
import { useAppDispatch, useAppSelector } from "../store/store";
import { clearSession } from "../store/auth-slice";
import { BrandLogo } from "./BrandLogo";
import { ProfileMenu } from "./ProfileMenu";
import { cn } from "../lib/cn";

const links = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/categories", label: "Category", icon: Tags, end: false },
  { to: "/admin/items", label: "Item", icon: Package, end: false },
  { to: "/admin/orders", label: "Orders", icon: Receipt, end: false },
];

export function AdminLayout() {
  const user = useAppSelector((s) => s.auth.user);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  function logout() {
    dispatch(clearSession());
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen bg-stone-50">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-stone-200 bg-white md:flex">
        <div className="flex h-16 items-center border-b border-stone-200 px-5">
          <Link to="/admin" className="text-lg">
            <BrandLogo suffix="Admin" />
          </Link>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium",
                  isActive
                    ? "bg-stone-900 text-white"
                    : "text-stone-600 hover:bg-stone-100 hover:text-stone-900",
                )
              }
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-stone-200 p-3">
          <div className="rounded-xl px-3 py-2">
            <span className="truncate text-sm text-stone-500">{user?.name}</span>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="flex h-16 items-center justify-between border-b border-stone-200 bg-white px-4 sm:px-8">
          <Link to="/admin" className="text-lg md:hidden">
            <BrandLogo suffix="Admin" />
          </Link>
          <div className="ml-auto flex items-center gap-4">
            <Link to="/" className="text-sm font-semibold tracking-wide text-stone-600 hover:text-stone-900">
              STOREFRONT
            </Link>
            {user && <ProfileMenu user={user} onLogout={logout} showAdminLink={false} />}
          </div>
        </header>
        <nav className="flex gap-2 overflow-x-auto border-b border-stone-200 bg-white px-4 py-2 md:hidden">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                cn(
                  "shrink-0 rounded-full px-4 py-2 text-sm font-medium",
                  isActive ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600",
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <main className="mx-auto max-w-5xl px-4 py-8">
          <div className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
