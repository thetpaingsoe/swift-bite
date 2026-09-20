import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAppSelector } from "../store/store";

export function KitchenRoute({ children }: { children: ReactNode }) {
  const role = useAppSelector((s) => s.auth.user?.role);
  if (role !== "kitchen" && role !== "admin") return <Navigate to="/" replace />;
  return children;
}
