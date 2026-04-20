import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/components/providers/AuthProvider";
import AppLoading from "@/components/feedback/AppLoading";
import { useEffect } from "react";

export default function RoleRoute({ allow }) {
  const { user, profile, loading, profileLoading, signOut } = useAuth();

  useEffect(() => {
    if (profile && profile.is_active === false) {
      signOut();
    }
  }, [profile, signOut]);

  if (loading) return <AppLoading label="Checking session..." />;
  if (!user) return <Navigate to="/login" replace />;
  if (profileLoading) return <AppLoading label="Loading role permissions..." />;
  if (profile && profile.is_active === false)
    return <Navigate to="/login" replace />;
  if (!profile) return <Navigate to="/unauthorized" replace />;
  const roleKeys = Array.isArray(profile?.roles)
    ? profile.roles.map((entry) => String(entry?.key || "").toLowerCase())
    : [String(profile?.role || "").toLowerCase()];
  if (!roleKeys.some((role) => allow.includes(role)))
    return <Navigate to="/unauthorized" replace />;

  return <Outlet />;
}

