// Role-to-permission matrix used by authorization checks in route middleware.
//
// System flow dependency:
// - Server exposes this map via `/api/permissions/role-map`.
// - Admin route guards (for example `admin.users.manage`) check membership
//   in these per-role permission arrays.
//
// Important note:
// - `student` and `faculty` currently share the same baseline permissions.
export const DEFAULT_ROLE_PERMISSIONS = {
  student: [
    "dashboard.view",
    "affiliate_profile.view",
    "projects.view",
    "projects.create",
    "projects.edit",
    "outputs.view",
    "outputs.create",
    "outputs.edit",
    "awards.view",
    "awards.create",
    "awards.edit",
    "affiliations.manage",
    "research_outputs.view",
    "awards_recognition.view",
  ],
  faculty: [
    "dashboard.view",
    "affiliate_profile.view",
    "projects.view",
    "projects.create",
    "projects.edit",
    "outputs.view",
    "outputs.create",
    "outputs.edit",
    "outputs.delete",
    "awards.view",
    "awards.create",
    "awards.edit",
    "affiliations.manage",
    "research_outputs.view",
    "awards_recognition.view",
  ],
  admin: [
    "dashboard.view",
    "affiliate_profile.view",
    "projects.view",
    "projects.create",
    "projects.edit",
    "projects.delete",
    "outputs.view",
    "outputs.create",
    "outputs.edit",
    "outputs.delete",
    "awards.view",
    "awards.create",
    "awards.edit",
    "awards.delete",
    "affiliates.view",
    "affiliates.edit",
    "affiliations.manage",
    "research_outputs.view",
    "awards_recognition.view",
    "admin.controls.manage",
    "admin.users.manage",
    "admin.affiliates.manage",
  ],
};

// Mutable in-memory map used by auth/permission checks.
// Admin controls can update this map at runtime through API routes.
// Note: changes are not persisted across server restarts.
export const ROLE_PERMISSIONS = JSON.parse(
  JSON.stringify(DEFAULT_ROLE_PERMISSIONS),
);
