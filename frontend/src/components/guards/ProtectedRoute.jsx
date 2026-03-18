import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/components/providers/AuthProvider";
import AppLoading from "@/components/feedback/AppLoading";
import { useEffect } from "react";

export default function ProtectedRoute() {
  const { user, profile, loading, profileLoading, signOut } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (profile && profile.is_active === false) {
      signOut();
    }
  }, [profile, signOut]);

  if (loading || profileLoading)
    return <AppLoading label="Checking session..." />;
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (profile && profile.is_active === false) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

