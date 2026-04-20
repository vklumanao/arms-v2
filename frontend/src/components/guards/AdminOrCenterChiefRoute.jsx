import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/components/providers/AuthProvider";
import { hasPermission, PERMISSIONS } from "@/services/permissions";

export default function AdminOrCenterChiefRoute() {
  const { profile } = useAuth();

  if (!profile) return <Navigate to="/unauthorized" replace />;

  const roleKeys = Array.isArray(profile?.roles)
    ? profile.roles.map((entry) => entry?.key)
    : profile?.role;
  const isAdmin = hasPermission(
    roleKeys,
    PERMISSIONS.ADMIN_CONTROLS_MANAGE,
    profile?.permissions,
  );
  const isCenterChief =
    profile?.is_center_chief === true && Boolean(profile?.managed_center_id);

  if (isAdmin || isCenterChief) return <Outlet />;

  return <Navigate to="/unauthorized" replace />;
}
