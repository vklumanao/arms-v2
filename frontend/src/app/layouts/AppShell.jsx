import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/app/providers/AuthProvider";
import AppFooter from "@/shared/components/layout/AppFooter";
import NotificationPanel from "@/shared/components/navigation/NotificationPanel";
import Breadcrumbs from "@/shared/components/navigation/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  hasPermission,
  PERMISSIONS,
  PERMISSIONS_UPDATED_EVENT,
} from "@/shared/auth/permissions";
import {
  Award,
  Building2,
  ChartNoAxesColumn,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  Database,
  FolderOpen,
  FolderTree,
  LogIn,
  LogOut,
  Menu,
  Settings,
  User,
  UserCircle,
  UserRoundSearch,
  Users,
} from "lucide-react";

const DESKTOP_SIDEBAR_BREAKPOINT = 1100;
const SIDEBAR_COLLAPSE_STORAGE_KEY = "arms:desktopSidebarCollapsed";

function getInitials(value) {
  const name = String(value || "").trim();
  if (!name) return "U";
  const parts = name.split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0]?.toUpperCase());
  return letters.join("") || "U";
}

export default function AppShell() {
  const { user, profile, profileLoading, signOut } = useAuth();
  const location = useLocation();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = window.localStorage.getItem(SIDEBAR_COLLAPSE_STORAGE_KEY);
    return stored === "true";
  });
  const [hoverExpanded, setHoverExpanded] = useState(false);

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

  const isAuthPage = [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
  ].includes(location.pathname);

  const shouldShowPublicFooter = [
    "/",
    "/home",
    "/about",
    "/public-records",
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
  const isAuthRoute = location.pathname === "/login";

  const landingLinkClass = (to) => {
    const isActive =
      (to === "/home" && isHomeActive) || (to === "/about" && isAboutActive);
    return `rounded-md px-3 py-1.5 text-sm font-semibold transition ${
      isActive
        ? "bg-[var(--brand-soft)] text-[var(--brand)]"
        : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--brand)]"
    }`;
  };

  const handleNavToggle = () => {
    if (isDesktop) {
      setDesktopSidebarCollapsed((prev) => !prev);
      return;
    }
    setMobileNavOpen(true);
  };

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
    const role = String(profile?.role || "").trim().toLowerCase();
    const isAdmin = role === "admin";
    const isFaculty = role === "faculty";

    const links = [
      {
        to: "/dashboard",
        label: "Dashboard",
        icon: ChartNoAxesColumn,
        permission: PERMISSIONS.DASHBOARD_VIEW,
      },
    ];

    const canAccessResearchCenters =
      isAdmin ||
      (isFaculty &&
        profile?.is_center_chief === true &&
        Boolean(profile?.managed_center_id));

    if (canAccessResearchCenters) {
      const managedCenterId = String(profile?.managed_center_id || "").trim();
      links.push({
        to:
          isAdmin
            ? "/admin/research-center"
            : managedCenterId
              ? `/admin/research-center/${encodeURIComponent(managedCenterId)}`
              : "/admin/research-center",
        label:
          isAdmin ? "Research Centers" : "My Research Center",
        icon: Building2,
        permission: PERMISSIONS.DASHBOARD_VIEW,
      });
    }

    if (isAdmin) {
      links.push({
        to: "/admin/departments",
        label: "Departments",
        icon: FolderTree,
        permission: PERMISSIONS.DASHBOARD_VIEW,
      });
    }

    if (isAdmin) {
      links.push({
        to: "/admin/affiliates",
        label: "Affiliates",
        icon: UserRoundSearch,
        permission: PERMISSIONS.DASHBOARD_VIEW,
      });
    }

    return links;
  }, [
    profile?.is_center_chief,
    profile?.managed_center_id,
    profile?.role,
  ]);

  const workspaceResearchLinks = useMemo(
    () => [
      {
        to: "/submit-project",
        label: "Research Projects",
        icon: FolderOpen,
        permission: PERMISSIONS.AFFILIATIONS_MANAGE,
      },
      {
        to: "/research-outputs",
        label: "Research Outputs",
        icon: Database,
        permission: PERMISSIONS.RESEARCH_OUTPUTS_VIEW,
      },
      {
        to: "/awards-recognitions",
        label: "Awards and Recognitions",
        icon: Award,
        permission: PERMISSIONS.AWARDS_RECOGNITION_VIEW,
      },
    ],
    [],
  );

  const workspaceLinks = useMemo(
    () => [
      ...workspaceCoreLinks,
      ...workspaceResearchLinks,
    ],
    [workspaceCoreLinks, workspaceResearchLinks],
  );

  const isAcademicRole = ["student", "faculty"].includes(profile?.role || "");
  const isAdminRole = profile?.role === "admin";

  const navGroups = useMemo(() => {
    if (!profile) return [];

    const groups = [];

    if (isAcademicRole || isAdminRole) {
      groups.push(
        { key: "core", title: "Core Modules", links: workspaceCoreLinks },
        {
          key: "research",
          title: "Research Modules",
          links: workspaceResearchLinks,
        },
      );
    } else {
      groups.push({
        key: "workspace",
        title: "Workspace",
        links: workspaceLinks,
      });
    }

    if (profile.role === "admin") {
      groups.push({
        key: "admin",
        title: "Admin Governance",
        links: adminGovernanceLinks,
      });
    }

    return groups;
  }, [
    adminGovernanceLinks,
    isAcademicRole,
    isAdminRole,
    profile,
    workspaceCoreLinks,
    workspaceLinks,
    workspaceResearchLinks,
  ]);

  const visibleGroups = useMemo(
    () =>
      navGroups
        .map((group) => ({
          ...group,
          items: group.links.filter((item) =>
            hasPermission(profile?.role, item.permission),
          ),
        }))
        .filter((group) => group.items.length > 0),
    [navGroups, profile?.role],
  );

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
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      SIDEBAR_COLLAPSE_STORAGE_KEY,
      desktopSidebarCollapsed ? "true" : "false",
    );
  }, [desktopSidebarCollapsed]);

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

  const NavItem = ({ item, onNavigate, collapsed = false }) => {
    const Icon = item.icon;
    return (
      <NavLink
        to={item.to}
        onClick={onNavigate}
        aria-label={collapsed ? item.label : undefined}
        title={collapsed ? item.label : undefined}
        className={({ isActive }) =>
          cn(
            "group relative flex items-center rounded-md text-sm font-medium text-slate-700 transition-colors",
            "hover:bg-muted hover:text-slate-900",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            collapsed
              ? "mx-auto h-10 w-10 justify-center px-0"
              : "gap-3 px-3 py-2",
            isActive && "bg-muted text-slate-900",
          )
        }
      >
        {({ isActive }) => (
          <>
            {!collapsed ? (
              <span
                className={cn(
                  "absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-transparent transition",
                  "group-hover:bg-slate-200",
                  isActive && "bg-[var(--brand)]",
                )}
                aria-hidden="true"
              />
            ) : null}
            <Icon
              className={cn(
                "shrink-0 text-slate-500 group-hover:text-slate-700",
                collapsed ? "h-5 w-5" : "h-4 w-4",
              )}
            />
            {collapsed ? (
              <span className="sr-only">{item.label}</span>
            ) : (
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
            )}
          </>
        )}
      </NavLink>
    );
  };

  const SidebarAccount = ({ onNavigate, collapsed = false }) => {
    if (!profile) {
      return collapsed ? (
        <Button
          asChild
          variant="outline"
          size="icon"
          className="w-full"
          title="Login"
          aria-label="Login"
          onClick={onNavigate}
        >
          <Link to="/login">
            <LogIn className="h-4 w-4" />
          </Link>
        </Button>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-700">
            Sign in to access your workspace.
          </p>
          <Button
            asChild
            variant="outline"
            className="w-full"
            onClick={onNavigate}
          >
            <Link to="/login">Login</Link>
          </Button>
        </div>
      );
    }

    const displayName = String(profile.full_name || "").trim() || "User";
    const roleLabel = String(profile.role || "").trim() || "Member";
    const initials = getInitials(displayName);

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {collapsed ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title={displayName}
              aria-label="Account menu"
              className={cn(
                "w-full rounded-lg border border-border/60 bg-white/60 shadow-sm shadow-black/5",
                "hover:border-border hover:bg-white",
                "data-[state=open]:border-border data-[state=open]:bg-white data-[state=open]:shadow-md",
              )}
            >
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-[var(--brand-soft)] text-[var(--brand)]">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              className={cn(
                "group w-full justify-between gap-3 rounded-lg border border-border/60 bg-white/60 px-3 py-2.5 text-left shadow-sm shadow-black/5",
                "hover:border-border hover:bg-white",
                "data-[state=open]:border-border data-[state=open]:bg-white data-[state=open]:shadow-md",
              )}
            >
              <span className="flex min-w-0 items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-[var(--brand-soft)] text-[var(--brand)]">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-900">
                    {displayName}
                  </span>
                  <span className="block truncate text-xs text-slate-600">
                    {roleLabel}
                  </span>
                </span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-data-[state=open]:rotate-180" />
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          side="top"
          className="w-[--radix-dropdown-menu-trigger-width] min-w-64 p-1"
        >
          <DropdownMenuLabel className="px-2 py-2">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-[var(--brand-soft)] text-[var(--brand)]">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {displayName}
                </p>
                <p className="truncate text-xs font-normal text-slate-600">
                  {roleLabel}
                </p>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link
                to="/my-profile"
                onClick={onNavigate}
                className="flex w-full items-center gap-2"
              >
                <User className="h-4 w-4 text-slate-500" />
                <span className="min-w-0 flex-1 truncate">My Profile</span>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-red-700 focus:bg-red-50 focus:text-red-700"
            onSelect={(event) => {
              event.preventDefault();
              signOut();
            }}
          >
            <LogOut className="h-4 w-4" />
            <span className="min-w-0 flex-1 truncate">Logout</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const SidebarContent = ({ variant, collapsed = false }) => {
    const onNavigate =
      variant === "mobile" ? () => setMobileNavOpen(false) : undefined;

    const scrollRef =
      variant === "mobile" ? mobileSidebarScrollRef : desktopSidebarScrollRef;
    const scrollTopRef =
      variant === "mobile"
        ? mobileSidebarScrollTopRef
        : desktopSidebarScrollTopRef;

    return (
      <div className={cn("flex h-full min-h-0 flex-col", collapsed ? "gap-3" : "gap-4")}>
        <div
          className={cn(
            "rounded-[var(--radius-lg)] border border-border/70 bg-white/70 shadow-sm shadow-black/5",
            collapsed ? "p-2" : "p-3",
          )}
        >
          <div
            className={cn(
              "flex items-center justify-between gap-2",
              collapsed && "flex-col",
            )}
          >
            <Link
              to="/home"
              className={cn(
                collapsed
                  ? "flex w-full items-center justify-center"
                  : "min-w-0 flex-1",
              )}
              onClick={onNavigate}
            >
              {!collapsed ? (
                <div className="min-w-0 leading-tight">
                  <div className="truncate text-base font-extrabold tracking-tight text-slate-900">
                    ARMS
                  </div>
                  <div className="truncate text-xs font-medium text-slate-500">
                    Affiliation and Research Management
                  </div>
                </div>
              ) : null}
            </Link>

            {variant === "desktop" ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                onClick={handleNavToggle}
                className={cn(
                  "h-9 w-9 rounded-md",
                  "bg-transparent text-slate-600 hover:bg-white hover:text-slate-900",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                )}
              >
                {collapsed ? (
                  <ChevronsRight className="h-4 w-4" />
                ) : (
                  <ChevronsLeft className="h-4 w-4" />
                )}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="min-h-0 flex-1 rounded-[var(--radius-lg)] border border-[var(--border)] bg-white/60 shadow-sm shadow-black/5">
          <div
            ref={scrollRef}
            className={cn(
              "h-full min-h-0 overflow-y-auto pr-2",
              collapsed ? "p-2" : "p-3",
            )}
            onScroll={(event) => {
              scrollTopRef.current = event.currentTarget.scrollTop;
            }}
          >
            {visibleGroups.length === 0 ? (
              <div className="rounded-md border border-dashed border-[var(--border)] bg-white/70 p-4">
                <p className="text-sm font-semibold text-slate-800">
                  No navigation items available.
                </p>
              </div>
            ) : (
              <div className={cn("space-y-5", collapsed && "space-y-3")}>
                {visibleGroups.map((group) => (
                  <div key={group.key}>
                    {!collapsed ? (
                      <div className="flex items-center gap-2 px-1">
                        <h3 className="text-[0.7rem] font-extrabold uppercase tracking-[0.18em] text-slate-500">
                          {group.title}
                        </h3>
                        <div
                          className="h-px flex-1 bg-border/60"
                          aria-hidden="true"
                        />
                      </div>
                    ) : null}
                    <div className={cn("space-y-1", !collapsed && "mt-2")}>
                      {group.items.map((item) => (
                        <NavItem
                          key={item.to}
                          item={item}
                          collapsed={collapsed}
                          onNavigate={onNavigate}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={cn("border-t border-border/60 pt-3", collapsed && "flex justify-center")}>
          <SidebarAccount onNavigate={onNavigate} collapsed={collapsed} />
        </div>
      </div>
    );
  };

  if (isAuthPage) {
    return (
      <div className="flex min-h-screen flex-col">
        <header className="border-b border-border bg-white/88 px-4 py-3 backdrop-blur sm:px-6 sm:py-4">
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
                <Button asChild variant="outline">
                  <Link to="/login">Login</Link>
                </Button>
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
        {shouldShowPublicFooter ? <AppFooter /> : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "app-shell",
        !shouldShowSidebar || !isDesktop
          ? "app-shell-no-sidebar"
          : desktopSidebarCollapsed
            ? "app-shell-sidebar-collapsed"
            : null,
      )}
    >
      {shouldShowSidebar && isDesktop ? (
        <aside
          className={cn("sidebar-shell", desktopSidebarCollapsed && "sidebar-shell-collapsed")}
        >
          <SidebarContent
            variant="desktop"
            collapsed={desktopSidebarCollapsed}
          />
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

            {shouldShowSidebar && !isDesktop ? (
              <Button
                type="button"
                aria-label="Open navigation"
                variant="outline"
                onClick={handleNavToggle}
              >
                <Menu size={16} />
              </Button>
            ) : null}

            <div className="min-w-0 flex-1">
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
              <div className="shrink-0">
                <NotificationPanel />
              </div>
            ) : user && profileLoading ? (
              <span className="text-sm text-slate-600">Loading profile...</span>
            ) : (
              <Button asChild variant="outline">
                <Link to="/login">Login</Link>
              </Button>
            )}
          </div>
        </header>

        <main
          className={cn(
            "page-shell flex-1",
            !shouldShowSidebar && "page-shell-landing",
          )}
        >
          <Outlet />
        </main>
      </div>

      {shouldShowSidebar && !isDesktop ? (
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent
            side="left"
            className="flex h-full w-[min(22rem,92vw)] flex-col bg-background p-4 sm:p-5"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Workspace navigation</SheetTitle>
              <SheetDescription>
                Browse workspace, research, and admin navigation links.
              </SheetDescription>
            </SheetHeader>
            <SidebarContent variant="mobile" />
          </SheetContent>
        </Sheet>
      ) : null}
    </div>
  );
}
