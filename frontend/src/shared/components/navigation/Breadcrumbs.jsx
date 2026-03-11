import { Link, useLocation } from "react-router-dom";

const SEGMENT_LABELS = {
  dashboard: "Dashboard",
  "public-records": "Public Records",
  "submit-project": "Research Projects",
  "submit-affiliation": "Research Projects",
  submit: "Submit Research Project",
  add: "Add Award Record",
  "research-outputs": "Research Outputs",
  "awards-recognitions": "Awards and Recognitions",
  "my-profile": "My Profile",
  admin: "Admin",
  affiliates: "Affiliates",
  "research-center": "Research Center",
  departments: "Department",
  controls: "Controls",
  login: "Login",
  register: "Register",
  "forgot-password": "Forgot Password",
  "reset-password": "Reset Password",
  unauthorized: "Unauthorized",
};

function toLabel(segment) {
  return (
    SEGMENT_LABELS[segment] ||
    segment
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  );
}

export default function Breadcrumbs() {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);
  const normalizedSegments =
    segments[0] === "home" ? segments.slice(1) : segments;

  const crumbs = [{ label: "Home", to: "/home" }];
  let path = "";

  normalizedSegments.forEach((segment) => {
    path += `/${segment}`;
    crumbs.push({
      label: toLabel(segment),
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

