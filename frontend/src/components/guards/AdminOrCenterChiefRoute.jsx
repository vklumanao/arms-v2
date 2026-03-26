import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/components/providers/AuthProvider";

export default function AdminOrCenterChiefRoute() {
  const { profile } = useAuth();

  if (!profile) return <Navigate to="/unauthorized" replace />;

  const role = String(profile?.role || "").trim().toLowerCase();
  const isAdmin = role === "admin";
  const isCenterChief =
    role === "faculty" &&
    profile?.is_center_chief === true &&
    Boolean(profile?.managed_center_id);

  if (isAdmin || isCenterChief) return <Outlet />;

  return <Navigate to="/unauthorized" replace />;
}
