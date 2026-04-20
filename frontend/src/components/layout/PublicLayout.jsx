import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import AppFooter from "@/components/layout/AppFooter";
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
          <Link to="/home">
            <img
              src="/full-logo.svg"
              alt="CenterPulse"
              className="h-6 sm:h-8 md:h-10 lg:h-12 w-auto"
              draggable="false"
            />
          </Link>
          <nav className="hidden items-center gap-2 sm:flex">
            {landingLinks.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  isActive(item.to)
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                }`}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <Button asChild>
            <Link to="/login" className="px-4 py-2 font-semibold">
              Login
            </Link>
          </Button>
        </div>
        <div className="public-layout-inner mt-3 flex flex-wrap items-center gap-1 sm:hidden">
          {landingLinks.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                isActive(item.to)
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
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
