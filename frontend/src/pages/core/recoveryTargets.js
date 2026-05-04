import { canAccessRoutePermission, PERMISSIONS } from "@/services/permissions";

export function getRoleAwareRecoveryTarget(user, profile) {
  if (!user) {
    return { to: "/login", label: "Go to Login" };
  }

  if (!profile) {
    return { to: "/home", label: "Go Home" };
  }

  const isCenterChief =
    profile?.is_center_chief === true && Boolean(profile?.managed_center_id);
  const managedCenterId = String(profile?.managed_center_id || "").trim();

  if (isCenterChief && managedCenterId) {
    return {
      to: `/admin/research-center/${encodeURIComponent(managedCenterId)}`,
      label: "Go to My Research Center",
    };
  }

  if (
    canAccessRoutePermission(profile, PERMISSIONS.ADMIN_CONTROLS_MANAGE) ||
    canAccessRoutePermission(profile, PERMISSIONS.ADMIN_RBAC_MANAGE)
  ) {
    return { to: "/admin/research-center", label: "Go to Admin Workspace" };
  }

  if (canAccessRoutePermission(profile, PERMISSIONS.PROJECTS_VIEW)) {
    return { to: "/projects", label: "Go to Research Projects" };
  }

  if (canAccessRoutePermission(profile, PERMISSIONS.AFFILIATE_PROFILE_VIEW)) {
    return { to: "/profile", label: "Go to My Profile" };
  }

  return { to: "/home", label: "Go Home" };
}

export function isAdminLikeProfile(profile) {
  if (!profile) return false;
  return (
    canAccessRoutePermission(profile, PERMISSIONS.ADMIN_CONTROLS_MANAGE) ||
    canAccessRoutePermission(profile, PERMISSIONS.ADMIN_RBAC_MANAGE)
  );
}
