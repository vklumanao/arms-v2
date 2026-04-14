import { Link, useLocation } from "react-router-dom";

const SEGMENT_LABELS = {
  dashboard: "Dashboard",
  "public-records": "Public Records",
  "public-research-centers": "Research Centers",
  profile: "My Profile",
  projects: "Research Projects",
  submit: "Submit Project",
  outputs: "Research Outputs",
  awards: "Awards & Recognition",
  new: "New Record",
  admin: "Admin",
  affiliates: "Affiliates",
  users: "Users",
  "research-center": "Research Centers",
  departments: "Departments",
  controls: "Admin Controls",
  login: "Login",
  register: "Register",
  "forgot-password": "Forgot Password",
  "reset-password": "Reset Password",
  unauthorized: "Unauthorized",
};

function toLabel(segment, prevSegment) {
  const label = SEGMENT_LABELS[segment];
  if (label) return label;

  // Avoid exposing raw ids in breadcrumb labels.
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      segment,
    );
  const looksLikeId =
    isUuid ||
    /^\d+$/.test(segment) ||
    (segment.includes("-") && segment.length > 12);

  if (looksLikeId) {
    const parent = String(prevSegment || "").toLowerCase();
    const parentLabel = {
      projects: "Project",
      "public-records": "Record",
      "public-research-centers": "Research Center",
      "research-center": "Research Center",
      departments: "Department",
      affiliates: "Affiliate",
      users: "User",
    }[parent];
    return parentLabel ? `${parentLabel} Detail` : "Detail";
  }

  return segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function Breadcrumbs() {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);
  const normalizedSegments =
    segments[0] === "home" ? segments.slice(1) : segments;

  // Don't render breadcrumbs on the home route; a lone "Home" crumb is visual noise.
  if (normalizedSegments.length === 0) return null;

  const crumbs = [{ label: "Home", to: "/home" }];
  let path = "";

  normalizedSegments.forEach((segment, index) => {
    const prevSegment = index > 0 ? normalizedSegments[index - 1] : null;
    path += `/${segment}`;
    crumbs.push({
      label: toLabel(segment, prevSegment),
      to: path,
    });
  });

  return (
    <nav aria-label="Breadcrumb" className="breadcrumbs-shell">
      <ol className="breadcrumbs-list">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <li key={crumb.to} className="breadcrumbs-item">
              {isLast ? (
                <span aria-current="page" className="breadcrumbs-current">
                  {crumb.label}
                </span>
              ) : (
                <Link to={crumb.to} className="breadcrumbs-link">
                  {crumb.label}
                </Link>
              )}
              {!isLast ? (
                <span className="breadcrumbs-separator">/</span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
