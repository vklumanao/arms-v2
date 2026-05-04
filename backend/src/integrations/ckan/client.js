// CKAN integration barrel:
// Re-exports feature-focused adapters (users, organizations, groups, datasets)
// as a unified client surface for route modules.
export * from "./users.js";
export * from "./organizations.js";
export * from "./groups.js";
export * from "./datasets.js";
