import { useQuery } from "@tanstack/react-query";
import { ChefHat, LayoutDashboard, Lock, LogOut, Pencil, Receipt } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { listOrders } from "../api/orders";
import { Card } from "../components/ui/card";
import { cn } from "../lib/cn";
import { clearSession } from "../store/auth-slice";
import { useAppDispatch, useAppSelector } from "../store/store";

const roleStyles: Record<string, string> = {
  admin: "bg-stone-900",
  kitchen: "bg-blue-600",
  customer: "bg-green-600",
};

const linkClass =
  "flex items-center gap-2 px-1 py-2 text-sm text-stone-600 hover:text-stone-900";

export function Profile() {
  const user = useAppSelector((s) => s.auth.user);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const ordersQuery = useQuery({
    queryKey: ["orders", "totals"],
    queryFn: () => listOrders(1, 1),
  });

  function logout() {
    dispatch(clearSession());
    navigate("/login", { replace: true });
  }

  if (!user) return null;

  const initial = (user.name.trim()[0] ?? "?").toUpperCase();

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Profile</h1>
      <p className="mt-1 text-sm text-stone-500">Your account details.</p>

      <Card className="mt-6 p-6">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-stone-900 text-xl font-bold text-white">
            {initial}
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-stone-900">{user.name}</p>
            <p className="truncate text-sm text-stone-500">{user.email}</p>
          </div>
          <span
            className={cn(
              "ml-auto inline-block shrink-0 rounded-full px-3 py-1 text-xs font-medium capitalize text-white",
              roleStyles[user.role] ?? "bg-stone-500",
            )}
          >
            {user.role}
          </span>
        </div>
        <div className="mt-6 flex items-center justify-between border-t border-stone-100 pt-4 text-sm">
          <span className="text-stone-500">Total orders</span>
          <span className="font-semibold text-stone-900">
            {ordersQuery.isPending ? "–" : (ordersQuery.data?.meta.total ?? 0)}
          </span>
        </div>
      </Card>

      <Card className="mt-4 px-6 py-2">
        <Link to="/profile/edit" className={linkClass}>
          <Pencil className="h-4 w-4" />
          Edit name
        </Link>
        <Link
          to="/profile/password"
          className={cn(linkClass, "border-t border-stone-100")}
        >
          <Lock className="h-4 w-4" />
          Change password
        </Link>
        <Link to="/orders" className={cn(linkClass, "border-t border-stone-100")}>
          <Receipt className="h-4 w-4" />
          My orders
        </Link>
        {user.role === "admin" && (
          <Link to="/admin" className={cn(linkClass, "border-t border-stone-100")}>
            <LayoutDashboard className="h-4 w-4" />
            Admin panel
          </Link>
        )}
        {(user.role === "kitchen" || user.role === "admin") && (
          <Link to="/kitchen" className={cn(linkClass, "border-t border-stone-100")}>
            <ChefHat className="h-4 w-4" />
            Kitchen board
          </Link>
        )}
        <button
          onClick={logout}
          className={cn(linkClass, "w-full cursor-pointer border-t border-stone-100 text-red-600 hover:text-red-800")}
        >
          <LogOut className="h-4 w-4" />
          Log out
        </button>
      </Card>
    </div>
  );
}
