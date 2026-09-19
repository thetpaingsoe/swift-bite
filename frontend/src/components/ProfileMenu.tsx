import { LayoutDashboard, LogOut, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { User as UserType } from "../store/auth-slice";
import { cn } from "../lib/cn";

export function ProfileMenu({
  user,
  onLogout,
  showAdminLink = true,
}: {
  user: UserType;
  onLogout: () => void;
  showAdminLink?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const initial = (user.name.trim()[0] ?? "?").toUpperCase();

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        className={cn(
          "flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-sm font-bold text-stone-700 transition-colors",
          open ? "bg-stone-300" : "bg-stone-200 hover:bg-stone-300",
        )}
      >
        {initial}
      </button>
      {open && (
        <div className="absolute right-0 z-50 pt-2">
          <div className="w-48 overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-lg">
          <p className="truncate px-4 py-2 text-sm text-stone-600">{user.email}</p>
          {showAdminLink && user.role === "admin" && (
            <Link
              to="/admin"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-stone-700 hover:bg-stone-100"
            >
              <LayoutDashboard className="h-4 w-4" />
              Admin panel
            </Link>
          )}
          <Link
            to="/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-stone-700 hover:bg-stone-100"
          >
            <User className="h-4 w-4" />
            Profile
          </Link>
          <button
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="flex w-full cursor-pointer items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
          </div>
        </div>
      )}
    </div>
  );
}
