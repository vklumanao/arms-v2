import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";
import AppFooter from "@/shared/components/layout/AppFooter";
import NotificationPanel from "@/shared/components/navigation/NotificationPanel";
import Breadcrumbs from "@/shared/components/navigation/Breadcrumbs";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ONBOARDING_ID_BY_ROUTE,
  OnboardingStartButton,
  useOnboardingTour,
} from "@/features/onboarding";
import {
  hasPermission,
  PERMISSIONS,
  PERMISSIONS_UPDATED_EVENT,
} from "@/shared/auth/permissions";
import {
  Award,
  BookOpen,
  Building2,
  ChartNoAxesColumn,
  ClipboardCheck,
  Database,
  FolderOpen,
  Menu,
  Settings,
  User,
  UserCircle,
  UserRoundSearch,
  Users,
} from "lucide-react";

const DESKTOP_SIDEBAR_BREAKPOINT = 1100;

export default function AppShell() {
  const { user, profile, profileLoading, signOut } = useAuth();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(`(min-width: ${DESKTOP_SIDEBAR_BREAKPOINT}px)`)
          .matches
      : true,
  );
  const [, setPermissionVersion] = useState(0);
  const desktopSidebarScrollRef = useRef(null);
  const mobileSidebarScrollRef = useRef(null);
  const desktopSidebarScrollTopRef = useRef(0);
  const mobileSidebarScrollTopRef = useRef(0);
  const mobileNavLockScrollYRef = useRef(0);
  const { tourRunning, startOnboardingTour } = useOnboardingTour({
    userId: user?.id,
    role: profile?.role,
    profileLoading,
    pathname: location.pathname,
  });

  const isAuthPage = [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
  ].includes(location.pathname);

  const landingLinks = useMemo(
    () => [
      { to: "/home", label: "Home" },
      { to: "/about", label: "About" },
    ],
    [],
  );

  const handleNavToggle = () => {
    if (isDesktop) {
      setSidebarCollapsed((prev) => !prev);
      return;
    }

    setMobileNavOpen(true);
  };

  const NavSection = ({ title, links }) => (
    <section className="space-y-1">
      <h3 className="nav-section-title">{title}</h3>
      {links
        .filter((item) => hasPermission(profile?.role, item.permission))
        .map((item) => {
          const Icon = item.icon;
          const onboardingId = ONBOARDING_ID_BY_ROUTE[item.to];
          return (
            <NavLink
              key={item.to}
              id={onboardingId}
              to={item.to}
              onClick={() => setMobileNavOpen(false)}
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <Icon size={15} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
    </section>
  );

  const adminGovernanceLinks = useMemo(
    () => [
      {
        to: "/admin/users",
        label: "User Management",
        icon: Users,
        permission: PERMISSIONS.ADMIN_USERS_MANAGE,
      },
      {
        to: "/admin/controls",
        label: "Admin Controls",
        icon: Settings,
        permission: PERMISSIONS.ADMIN_CONTROLS_MANAGE,
      },
    ],
    [],
  );

  const workspaceCoreLinks = useMemo(() => {
    const links = [
      {
        to: "/dashboard",
        label: "Dashboard",
        icon: ChartNoAxesColumn,
        permission: PERMISSIONS.DASHBOARD_VIEW,
      },
    ];

    if (profile?.role === "admin") {
      links.push({
        to: "/admin/research-center",
        label: "Research Center",
        icon: Building2,
        permission: PERMISSIONS.DASHBOARD_VIEW,
      });
      links.push({
        to: "/admin/affiliates",
        label: "Affiliates",
        icon: UserRoundSearch,
        permission: PERMISSIONS.DASHBOARD_VIEW,
      });
    }

    return links;
  }, [profile?.role]);

  const workspaceResearchLinks = useMemo(
    () => [
      {
        to: "/submit-affiliation",
        label: "Research Projects",
        icon: FolderOpen,
        permission: PERMISSIONS.RESEARCH_PROJECTS_MANAGE,
      },
      {
        to: "/research-outputs",
        label: "Research Outputs",
        icon: Database,
        permission: PERMISSIONS.RESEARCH_OUTPUTS_VIEW,
      },
      {
        to: "/awards-recognition",
        label: "Awards and Recognition",
        icon: Award,
        permission: PERMISSIONS.AWARDS_RECOGNITION_VIEW,
      },
    ],
    [],
  );

  const workspaceRecordsLinks = useMemo(
    () => [
      {
        to: "/my-submissions",
        label: "My Submissions",
        icon: ClipboardCheck,
        permission: PERMISSIONS.MY_SUBMISSIONS_VIEW,
      },
      {
        to: "/publications",
        label: "Publications",
        icon: BookOpen,
        permission: PERMISSIONS.PUBLICATIONS_MANAGE,
      },
    ],
    [],
  );

  const workspaceProfileLinks = useMemo(
    () => [
      {
        to: "/affiliate-profile",
        label: "Affiliate Profile",
        icon: UserCircle,
        permission: PERMISSIONS.AFFILIATE_PROFILE_VIEW,
      },
    ],
    [],
  );

  const workspaceLinks = useMemo(
    () => [
      ...workspaceCoreLinks,
      ...workspaceResearchLinks,
      ...workspaceRecordsLinks,
      ...workspaceProfileLinks,
    ],
    [
      workspaceCoreLinks,
      workspaceResearchLinks,
      workspaceRecordsLinks,
      workspaceProfileLinks,
    ],
  );

  const isAcademicRole = ["student", "faculty"].includes(profile?.role || "");
  const isAdminRole = profile?.role === "admin";

  const workspaceNav = isAcademicRole ? (
    <div className="space-y-5">
      <NavSection title="Core Modules" links={workspaceCoreLinks} />
      <NavSection title="Research Modules" links={workspaceResearchLinks} />
      <NavSection title="Records" links={workspaceRecordsLinks} />
      <NavSection title="Profile" links={workspaceProfileLinks} />
    </div>
  ) : isAdminRole ? (
    <div className="space-y-5">
      <NavSection title="Core Modules" links={workspaceCoreLinks} />
      <NavSection title="Research Modules" links={workspaceResearchLinks} />
      <NavSection title="Profile" links={workspaceProfileLinks} />
    </div>
  ) : (
    <NavSection title="Workspace" links={workspaceLinks} />
  );

  const adminNav = (
    <div className="space-y-5">
      <NavSection title="Admin Governance" links={adminGovernanceLinks} />
    </div>
  );

  const workspaceAndAdminNav = (
    <>
      {profile ? workspaceNav : null}
      {profile?.role === "admin" ? adminNav : null}
    </>
  );

  const isHomeActive =
    (location.pathname === "/" || location.pathname === "/home") &&
    (!location.hash || location.hash === "#home" || location.hash === "");
  const isAboutActive =
    location.pathname === "/about" ||
    ((location.pathname === "/" || location.pathname === "/home") &&
      location.hash === "#about");
  const isLandingPage =
    location.pathname === "/" ||
    location.pathname === "/home" ||
    location.pathname === "/about";
  const shouldShowSidebar = Boolean(profile) || !isLandingPage;
  const isShellCollapsed = sidebarCollapsed || !shouldShowSidebar;
  const isAuthRoute = location.pathname === "/login";

  useEffect(() => {
    if (!(location.pathname === "/" || location.pathname === "/home")) return;

    const targetId = location.hash ? location.hash.slice(1) : "home";
    let frame = 0;
    let attempts = 0;

    const scrollToTarget = () => {
      const target = document.getElementById(targetId);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      if (attempts < 10) {
        attempts += 1;
        frame = window.requestAnimationFrame(scrollToTarget);
      }
    };

    scrollToTarget();
    return () => window.cancelAnimationFrame(frame);
  }, [location.pathname, location.hash]);

  useLayoutEffect(() => {
    if (desktopSidebarScrollRef.current) {
      desktopSidebarScrollRef.current.scrollTop =
        desktopSidebarScrollTopRef.current;
    }
    if (mobileSidebarScrollRef.current) {
      mobileSidebarScrollRef.current.scrollTop =
        mobileSidebarScrollTopRef.current;
    }
  }, [location.pathname]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const media = window.matchMedia(
      `(min-width: ${DESKTOP_SIDEBAR_BREAKPOINT}px)`,
    );
    const handleChange = (event) => {
      setIsDesktop(Boolean(event.matches));
    };
    setIsDesktop(Boolean(media.matches));
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (isDesktop) {
      setMobileNavOpen(false);
    }
  }, [isDesktop]);

  useEffect(() => {
    if (!mobileNavOpen) {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.width = "";
      document.body.style.overflow = "";
      return;
    }
    mobileNavLockScrollYRef.current = window.scrollY || window.pageYOffset || 0;
    document.body.style.position = "fixed";
    document.body.style.top = `-${mobileNavLockScrollYRef.current}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.width = "";
      document.body.style.overflow = "";
      window.scrollTo(0, mobileNavLockScrollYRef.current || 0);
    };
  }, [mobileNavOpen]);

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

  const landingLinkClass = (to) => {
    const isActive =
      (to === "/home" && isHomeActive) || (to === "/about" && isAboutActive);
    return `rounded-md px-3 py-1.5 text-sm font-semibold transition ${
      isActive
        ? "bg-[var(--brand-soft)] text-[var(--brand)]"
        : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--brand)]"
    }`;
  };

  if (isAuthPage) {
    return (
      <div className="flex min-h-screen flex-col">
        <header className="border-b border-[var(--border)] bg-white/88 px-4 py-3 backdrop-blur sm:px-6 sm:py-4">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <div className="flex items-center gap-5">
              <Link to="/home" className="flex items-center">
                <img
                  src="/arms-logo-v2.svg"
                  alt="ARMS Logo"
                  className="h-12 w-auto object-contain"
                />
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <nav className="hidden items-center gap-1 sm:flex">
                {landingLinks.map((item) => (
                  <Link
                    key={item.to}
                    className={landingLinkClass(item.to)}
                    to={item.to}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              {!isAuthRoute ? (
                <Link to="/login" className="btn btn-outline">
                  Login
                </Link>
              ) : null}
            </div>
          </div>
          <div className="mx-auto mt-3 flex max-w-6xl flex-wrap items-center gap-1 sm:hidden">
            {landingLinks.map((item) => (
              <Link
                key={item.to}
                className={landingLinkClass(item.to)}
                to={item.to}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
          <Outlet />
        </main>
        <AppFooter />
      </div>
    );
  }

  return (
    <div
      className={`app-shell ${isShellCollapsed ? "app-shell-collapsed" : ""}`}
    >
      {shouldShowSidebar && !isShellCollapsed && isDesktop ? (
        <aside className="sidebar-shell">
          <div className="sidebar-brand-panel mb-6">
            <Link
              to="/home"
              className="flex w-full items-center justify-center"
            >
              <img
                src="/arms-logo-v2.svg"
                alt="ARMS Logo"
                className="h-24 w-full object-contain"
              />
            </Link>
            <p className="sidebar-tagline">Affiliation & Research Management</p>
          </div>

          <div
            ref={desktopSidebarScrollRef}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1"
            onScroll={(event) => {
              desktopSidebarScrollTopRef.current =
                event.currentTarget.scrollTop;
            }}
          >
            <div className="space-y-5">{workspaceAndAdminNav}</div>
          </div>

          {profile ? (
            <div className="sidebar-user-card">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Signed in as
              </p>
              <p className="mt-1 text-sm font-bold text-slate-900">
                {profile.full_name}
              </p>
              <p className="text-xs text-slate-600">{profile.role}</p>
              <button
                id="onboarding-logout"
                className="btn btn-outline mt-3 w-full"
                onClick={signOut}
              >
                Logout
              </button>
            </div>
          ) : null}
        </aside>
      ) : null}

      <div className="content-shell">
        <header className="topbar-shell">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {isLandingPage && !user ? (
              <Link to="/home" className="shrink-0">
                <img
                  src="/arms-logo-v2.svg"
                  alt="ARMS Logo"
                  className="h-11 w-auto object-contain sm:h-12"
                />
              </Link>
            ) : null}
            {shouldShowSidebar ? (
              <button
                id="onboarding-menu-toggle"
                type="button"
                aria-label={
                  isShellCollapsed ? "Show navigation" : "Hide navigation"
                }
                className="btn btn-outline"
                onClick={handleNavToggle}
              >
                <Menu size={16} />
              </button>
            ) : null}
            <div id="onboarding-breadcrumbs" className="min-w-0 flex-1">
              <Breadcrumbs />
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2">
            <nav className="hidden items-center gap-1 md:flex">
              {landingLinks.map((item) => (
                <Link
                  key={item.to}
                  className={landingLinkClass(item.to)}
                  to={item.to}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            {profile ? (
              <>
                <div id="onboarding-notifications" className="shrink-0">
                  <NotificationPanel />
                </div>
                <div className="shrink-0">
                  <OnboardingStartButton
                    onStart={() => startOnboardingTour({ required: false })}
                    tourRunning={tourRunning}
                  />
                </div>
              </>
            ) : user && profileLoading ? (
              <span className="text-sm text-slate-600">Loading profile...</span>
            ) : (
              <Link to="/login" className="btn btn-outline">
                Login
              </Link>
            )}
          </div>
        </header>

        <main className="page-shell flex-1">
          <Outlet />
        </main>
        <AppFooter />
      </div>

      {shouldShowSidebar && mobileNavOpen && !isDesktop && (
        <div
          className="modal-overlay modal-overlay-sidebar"
          onClick={() => setMobileNavOpen(false)}
        >
          <aside
            className="flex h-full w-[min(22rem,92vw)] flex-col border-r border-[var(--border)] bg-[var(--surface)] px-4 pb-4 pt-0 sm:px-5 sm:pb-5 sm:pt-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 mt-3 flex shrink-0 items-center justify-between">
              <div className="flex items-center gap-2">
                <img src="/arms-logo-v2.svg" alt="ARMS Logo" />
              </div>
              <button
                className="btn btn-outline"
                onClick={() => setMobileNavOpen(false)}
              >
                Close
              </button>
            </div>
            <div
              ref={mobileSidebarScrollRef}
              className="min-h-0 flex-1 overflow-y-auto pr-1"
              onScroll={(event) => {
                mobileSidebarScrollTopRef.current =
                  event.currentTarget.scrollTop;
              }}
            >
              <div className="space-y-5">{workspaceAndAdminNav}</div>
            </div>

            {profile ? (
              <div className="mt-4 shrink-0 rounded-[var(--radius-md)] border border-[var(--border)] bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Signed in as
                </p>
                <p className="mt-1 text-sm font-bold text-slate-900">
                  {profile.full_name}
                </p>
                <p className="text-xs text-slate-600">{profile.role}</p>
                <button
                  type="button"
                  className="btn btn-outline mt-3 w-full"
                  onClick={signOut}
                >
                  Logout
                </button>
              </div>
            ) : null}
          </aside>
        </div>
      )}
    </div>
  );
}
