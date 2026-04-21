import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/components/providers/AuthProvider";
import AppLoading from "@/components/feedback/AppLoading";
import {
  canAccessRoutePermission,
  PERMISSIONS_UPDATED_EVENT,
  syncRolePermissionMapFromServer,
} from "@/services/permissions";

export default function PermissionRoute({ permission, children }) {
  const { user, profile, loading, profileLoading } = useAuth();
  const [, setPermissionVersion] = useState(0);
  const [permissionsLoading, setPermissionsLoading] = useState(true);

  useEffect(() => {
    const handlePermissionsUpdated = () => {
      setPermissionVersion((prev) => prev + 1);
    };
    window.addEventListener(
      PERMISSIONS_UPDATED_EVENT,
      handlePermissionsUpdated,
    );
    return () => {
      window.removeEventListener(
        PERMISSIONS_UPDATED_EVENT,
        handlePermissionsUpdated,
      );
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!user || profileLoading) {
      setPermissionsLoading(true);
      return () => {
        active = false;
      };
    }

    syncRolePermissionMapFromServer()
      .catch(() => {})
      .finally(() => {
        if (active) setPermissionsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user, profileLoading, profile?.id, profile?.role]);

  if (loading) return <AppLoading label="Checking session..." />;
  if (!user) return <Navigate to="/login" replace />;
  if (profileLoading) return <AppLoading label="Loading permissions..." />;
  if (permissionsLoading) return <AppLoading label="Loading permissions..." />;
  if (!profile) return <Navigate to="/unauthorized" replace />;
  if (!canAccessRoutePermission(profile, permission)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children || <Outlet />;
}
