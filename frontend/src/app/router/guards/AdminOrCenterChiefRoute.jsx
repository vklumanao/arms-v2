import { Navigate, Outlet } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import AppLoading from "@/shared/components/feedback/AppLoading";

export default function AdminOrCenterChiefRoute() {
  const { user, profile, loading, profileLoading, signOut } = useAuth();

  useEffect(() => {
    if (profile && profile.is_active === false) {
      signOut();
    }
  }, [profile, signOut]);

  if (loading) return <AppLoading label="Checking session..." />;
  if (!user) return <Navigate to="/login" replace />;
  if (profileLoading) return <AppLoading label="Loading access..." />;
  if (profile && profile.is_active === false) {
    return <Navigate to="/login" replace />;
  }
  if (!profile) return <Navigate to="/unauthorized" replace />;

  const isAdmin = profile.role === "admin";
  const isScopedCenterChief =
    profile.role === "faculty" &&
    profile.is_center_chief === true &&
    Boolean(profile.managed_center_id);

  if (!isAdmin && !isScopedCenterChief) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}
