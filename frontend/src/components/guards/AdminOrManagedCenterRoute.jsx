import { Navigate, Outlet, useParams } from "react-router-dom";
import { useAuth } from "@/components/providers/AuthProvider";

export default function AdminOrManagedCenterRoute() {
  const { profile } = useAuth();
  const params = useParams();
  const centerId = String(params?.id || "").trim();

  if (!profile) return <Navigate to="/unauthorized" replace />;
  if (!centerId) return <Navigate to="/unauthorized" replace />;

  const role = String(profile?.role || "").trim().toLowerCase();
  const isAdmin = role === "admin";

  if (isAdmin) return <Outlet />;

  const isCenterChief =
    role === "faculty" &&
    profile?.is_center_chief === true &&
    Boolean(profile?.managed_center_id);

  if (!isCenterChief) return <Navigate to="/unauthorized" replace />;

  const managedCenterId = String(profile?.managed_center_id || "").trim();
  if (managedCenterId && managedCenterId === centerId) return <Outlet />;

  return <Navigate to="/unauthorized" replace />;
}

