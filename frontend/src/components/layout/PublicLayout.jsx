import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { useState } from "react";
import AppFooter from "@/components/layout/AppFooter";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const landingLinks = [
  { to: "/home", label: "Home" },
  { to: "/about", label: "About" },
];

export default function PublicLayout() {
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isLoginPage = location.pathname === "/login";
  const isRegisterPage = location.pathname === "/register";
  const authAction = isLoginPage
    ? { to: "/register", label: "Create Account" }
    : isRegisterPage
      ? { to: "/login", label: "Login" }
      : { to: "/login", label: "Login" };

  const isActive = (to) => {
    if (to === "/home") {
      return location.pathname === "/" || location.pathname === "/home";
    }
    return location.pathname === to || location.pathname.startsWith(`${to}/`);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="public-layout-header sticky top-0 z-40 px-4 py-3 sm:px-6 sm:py-4">
        <div className="public-layout-inner flex items-center justify-between gap-3 sm:gap-4">
          <Link
            to="/home"
            className="flex min-w-0 items-center rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
          >
            <img
              src="/full-logo.svg"
              alt="CenterPulse"
              className="h-7 w-auto sm:h-8 md:h-10 lg:h-12"
              draggable="false"
              decoding="async"
            />
          </Link>
          <nav className="hidden items-center gap-2 lg:flex">
            {landingLinks.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={`public-nav-link ${isActive(item.to) ? "is-active" : ""}`}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="h-4.5 w-4.5" />
            </Button>
            <Button asChild className="hidden lg:inline-flex">
              <Link to={authAction.to} className="font-semibold">
                {authAction.label}
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="public-layout-main">
        <Outlet />
      </main>

      <AppFooter />

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="right" className="w-screen max-w-none sm:max-w-sm">
          <SheetHeader>
            <SheetTitle>Navigation</SheetTitle>
            <SheetDescription>
              Move between public pages and sign in to continue into the
              workspace.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 grid gap-3">
            {landingLinks.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileNavOpen(false)}
                className={`public-nav-link public-nav-link-mobile ${isActive(item.to) ? "is-active" : ""}`}
              >
                {item.label}
              </NavLink>
            ))}
            <Button asChild className="mt-3 w-full">
              <Link to={authAction.to} onClick={() => setMobileNavOpen(false)}>
                {authAction.label}
              </Link>
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
