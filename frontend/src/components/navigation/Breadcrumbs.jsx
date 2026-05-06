import { ChevronLeft } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

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
  login: "Login",
  register: "Register",
  "forgot-password": "Forgot Password",
  "reset-password": "Reset Password",
  unauthorized: "Unauthorized",
};

function toLabel(segment, prevSegment) {
  const label = SEGMENT_LABELS[segment];
  if (label) return label;

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
  const navigate = useNavigate();
  const segments = location.pathname.split("/").filter(Boolean);
  const normalizedSegments =
    segments[0] === "home" ? segments.slice(1) : segments;

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

  const currentCrumb = crumbs[crumbs.length - 1];

  return (
    <div className="breadcrumbs-shell">
      <div className="flex items-center gap-2 sm:hidden">
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-1 rounded-md border border-[var(--border)] bg-white px-3 text-sm font-semibold text-[var(--brand)] transition hover:bg-[var(--surface-muted)]"
          onClick={() => navigate(-1)}
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
        <span className="breadcrumbs-current">{currentCrumb?.label}</span>
      </div>

      <nav aria-label="Breadcrumb" className="hidden sm:block">
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
    </div>
  );
}
