import { Navigate, Outlet, useParams } from "react-router-dom";
import { useAuth } from "@/components/providers/AuthProvider";
import { hasPermission, PERMISSIONS } from "@/services/permissions";

export default function AdminOrManagedCenterRoute() {
  const { profile } = useAuth();
  const params = useParams();
  const centerId = String(params?.id || "").trim();

  if (!profile) return <Navigate to="/unauthorized" replace />;
  if (!centerId) return <Navigate to="/unauthorized" replace />;

  const roleKeys = Array.isArray(profile?.roles)
    ? profile.roles.map((entry) => entry?.key)
    : profile?.role;
  const isAdmin = hasPermission(
    roleKeys,
    PERMISSIONS.ADMIN_CONTROLS_MANAGE,
    profile?.permissions,
  );

  if (isAdmin) return <Outlet />;

  const isCenterChief =
    profile?.is_center_chief === true && Boolean(profile?.managed_center_id);

  if (!isCenterChief) return <Navigate to="/unauthorized" replace />;

  const managedCenterId = String(profile?.managed_center_id || "").trim();
  if (managedCenterId && managedCenterId === centerId) return <Outlet />;

  return <Navigate to="/unauthorized" replace />;
}
