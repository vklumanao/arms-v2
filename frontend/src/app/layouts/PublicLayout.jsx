import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import AppFooter from "@/shared/components/layout/AppFooter";
import { Button } from "@/components/ui/button";

const landingLinks = [
  { to: "/home", label: "Home" },
  { to: "/about", label: "About" },
];

export default function PublicLayout() {
  const location = useLocation();

  const isActive = (to) => {
    if (to === "/home") {
      return location.pathname === "/" || location.pathname === "/home";
    }
    return location.pathname === to || location.pathname.startsWith(`${to}/`);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border bg-white/90 px-4 py-3 backdrop-blur sm:px-6 sm:py-4">
        <div className="public-layout-inner flex items-center justify-between gap-4">
          <Link to="/home" className="flex items-center">
            <img
              src="/arms-logo-v2.svg"
              alt="ARMS Logo"
              className="h-11 w-auto object-contain sm:h-12"
            />
          </Link>
          <nav className="hidden items-center gap-2 sm:flex">
            {landingLinks.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                  isActive(item.to)
                    ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                    : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--brand)]"
                }`}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <Button asChild variant="outline">
            <Link to="/login">Login</Link>
          </Button>
        </div>
        <div className="public-layout-inner mt-3 flex flex-wrap items-center gap-1 sm:hidden">
          {landingLinks.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                isActive(item.to)
                  ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                  : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--brand)]"
              }`}
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </header>

      <main className="public-layout-main">
        <Outlet />
      </main>

      <AppFooter />
    </div>
  );
}
