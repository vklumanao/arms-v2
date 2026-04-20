import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/utils/cn";
import { useAuth } from "@/components/providers/AuthProvider";
import AppFooter from "@/components/layout/AppFooter";
import NotificationPanel from "@/components/navigation/NotificationPanel";
import Breadcrumbs from "@/components/navigation/Breadcrumbs";
import { Button } from "@/components/ui/button";
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
} from "@/services/permissions";
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
  const isSubmissionsRoute = useMemo(() => {
    const path = String(location.pathname || "");
    return (
      path === "/projects" ||
      path.startsWith("/projects/") ||
      path === "/outputs" ||
      path.startsWith("/outputs/") ||
      path === "/awards" ||
      path.startsWith("/awards/")
    );
  }, [location.pathname]);

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = window.localStorage.getItem(SIDEBAR_COLLAPSE_STORAGE_KEY);
    return stored === "true";
  });
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(`(min-width: ${DESKTOP_SIDEBAR_BREAKPOINT}px)`)
          .matches
      : true,
  );

  const [permissionVersion, setPermissionVersion] = useState(0);
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
        ? "bg-[#1E3A8A] text-white"
        : "text-slate-700 hover:bg-blue-50 hover:text-[#1E3A8A]"
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
        to: "/admin/access-control",
        label: "Access Control",
        icon: Settings,
        permission: PERMISSIONS.ADMIN_RBAC_MANAGE,
      },
    ],
    [],
  );

  const workspaceCoreLinks = useMemo(() => {
    const roleKeys =
      profile?.roles?.map((entry) => entry?.key) || profile?.role;
    const isAdmin = hasPermission(
      roleKeys,
      PERMISSIONS.ADMIN_CONTROLS_MANAGE,
      profile?.permissions,
    );
    const isCenterChief =
      profile?.is_center_chief === true && Boolean(profile?.managed_center_id);

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
      (profile?.is_center_chief === true &&
        Boolean(profile?.managed_center_id));

    if (canAccessResearchCenters) {
      const managedCenterId = String(profile?.managed_center_id || "").trim();
      links.push({
        to: isAdmin
          ? "/admin/research-center"
          : managedCenterId
            ? `/admin/research-center/${encodeURIComponent(managedCenterId)}`
            : "/admin/research-center",
        label: isAdmin ? "Research Centers" : "My Research Center",
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

    if (isAdmin || isCenterChief) {
      links.push({
        to: "/admin/affiliates",
        label: "Affiliates",
        icon: UserRoundSearch,
        permission: PERMISSIONS.AFFILIATES_VIEW,
      });
    }

    return links;
  }, [
    profile?.is_center_chief,
    profile?.managed_center_id,
    profile?.role,
    profile?.roles,
  ]);

  const workspaceResearchLinks = useMemo(
    () => [
      {
        to: "/projects",
        label: "Research Projects",
        icon: FolderOpen,
        permission: PERMISSIONS.PROJECTS_VIEW,
      },
      {
        to: "/outputs",
        label: "Research Outputs",
        icon: Database,
        permission: PERMISSIONS.OUTPUTS_VIEW,
      },
      {
        to: "/awards",
        label: "Awards and Recognitions",
        icon: Award,
        permission: PERMISSIONS.AWARDS_VIEW,
      },
    ],
    [],
  );

  const navGroups = useMemo(() => {
    if (!profile) return [];

    const groups = [];
    groups.push(
      { key: "core", title: "Core Modules", links: workspaceCoreLinks },
      {
        key: "research",
        title: "Research Modules",
        links: workspaceResearchLinks,
      },
    );

    if (
      hasPermission(
        profile?.roles?.map((entry) => entry?.key) || profile?.role,
        PERMISSIONS.ADMIN_CONTROLS_MANAGE,
        profile?.permissions,
      ) ||
      hasPermission(
        profile?.roles?.map((entry) => entry?.key) || profile?.role,
        PERMISSIONS.ADMIN_RBAC_MANAGE,
        profile?.permissions,
      )
    ) {
      groups.push({
        key: "admin",
        title: "Admin Governance",
        links: adminGovernanceLinks,
      });
    }

    return groups;
  }, [
    adminGovernanceLinks,
    profile,
    workspaceCoreLinks,
    workspaceResearchLinks,
  ]);

  const visibleGroups = useMemo(
    () =>
      navGroups
        .map((group) => ({
          ...group,
          items: group.links.filter((item) => {
            const isCenterChief =
              profile?.is_center_chief === true &&
              Boolean(profile?.managed_center_id);
            if (item.to === "/admin/affiliates" && isCenterChief) return true;
            return hasPermission(
              profile?.roles?.map((entry) => entry?.key) || profile?.role,
              item.permission,
              profile?.permissions,
            );
          }),
        }))
        .filter((group) => group.items.length > 0),
    [
      navGroups,
      permissionVersion,
      profile?.is_center_chief,
      profile?.managed_center_id,
      profile?.permissions,
      profile?.role,
      profile?.roles,
    ],
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
    if (!desktopSidebarCollapsed || !isDesktop) {
      setHoverExpanded(false);
      return;
    }
    if (accountMenuOpen) {
      setHoverExpanded(true);
    }
  }, [desktopSidebarCollapsed, isDesktop, accountMenuOpen]);

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
            "sidebar-nav-item",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            collapsed ? "is-collapsed" : "is-expanded",
            isActive && "is-active",
          )
        }
      >
        {({ isActive }) => (
          <>
            {!collapsed ? (
              <span
                className={cn("sidebar-nav-rail", isActive && "is-active")}
                aria-hidden="true"
              />
            ) : null}
            <span className="sidebar-nav-icon">
              <Icon className={cn("h-4 w-4", collapsed && "h-5 w-5")} />
            </span>
            <span className={cn("sidebar-nav-label", collapsed && "is-hidden")}>
              {item.label}
            </span>
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
      <DropdownMenu
        open={accountMenuOpen}
        onOpenChange={(open) => setAccountMenuOpen(open)}
      >
        <DropdownMenuTrigger asChild>
          {collapsed ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title={displayName}
              aria-label="Account menu"
              className={cn(
                "w-full rounded-lg shadow-black/5",
                "hover:border-[#93C5FD] hover:bg-blue-50",
                "data-[state=open]:border-[#93C5FD] data-[state=open]:bg-blue-50 data-[state=open]:shadow-md",
              )}
            >
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-blue-100 text-[#1E3A8A]">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              className={cn(
                "group w-full justify-between gap-3 rounded-lg px-3 py-2.5 text-left shadow-sm shadow-black/5",
                "hover:border-[#93C5FD] hover:bg-blue-50",
                "data-[state=open]:border-[#93C5FD] data-[state=open]:bg-blue-50 data-[state=open]:shadow-md",
              )}
            >
              <span className="flex min-w-0 items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-blue-100 text-[#1E3A8A]">
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
                <AvatarFallback className="bg-blue-100 text-[#1E3A8A]">
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
                to="/profile"
                onClick={onNavigate}
                className="flex w-full items-center gap-2"
              >
                <User className="h-4 w-4 text-[#1E3A8A]" />
                <span className="min-w-0 flex-1 truncate">My Profile</span>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-slate-700 focus:bg-blue-50 focus:text-[#1E3A8A] flex w-full items-center gap-2"
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
      <div
        className={cn(
          "flex h-full min-h-0 flex-col",
          collapsed ? "gap-3" : "gap-4",
        )}
      >
        <div
          className={cn(
            "sidebar-panel",
            collapsed ? "is-collapsed" : "is-expanded",
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
                <div className="min-w-0 flex justify-center">
                  <img
                    src="/full-logo.svg"
                    alt="CenterPulse"
                    className="h-6 sm:h-8 md:h-10 lg:h-12 w-auto"
                    draggable="false"
                  />
                </div>
              ) : (
                <img
                  src="/icon.svg"
                  alt="CenterPulse"
                  className="h-6 sm:h-8 md:h-10 lg:h-12 w-auto"
                  draggable="false"
                />
              )}
            </Link>
          </div>
        </div>

        <div className="sidebar-nav-shell min-h-0 flex-1">
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
              <div className="rounded-md border border-dashed border-[var(--border)] bg-white/80 p-4">
                <p className="text-sm font-semibold text-slate-800">
                  No navigation items available.
                </p>
              </div>
            ) : (
              <div className={cn("space-y-2", collapsed && "space-y-1")}>
                {visibleGroups
                  .flatMap((group) => group.items)
                  .map((item) => (
                    <NavItem
                      key={item.to}
                      item={item}
                      collapsed={collapsed}
                      onNavigate={onNavigate}
                    />
                  ))}
              </div>
            )}
          </div>
        </div>

        <div className={cn("sidebar-footer", collapsed && "is-collapsed")}>
          <SidebarAccount onNavigate={onNavigate} collapsed={collapsed} />
        </div>
      </div>
    );
  };

  if (isAuthPage) {
    return (
      <div className="flex min-h-screen flex-col">
        <header className="border-b border-border bg-white/92 px-4 py-3 backdrop-blur sm:px-6 sm:py-4">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <div className="flex items-center gap-5">
              <Link
                to="/home"
                className="shrink-0 text-lg font-bold text-[#1E3A8A]"
              >
                CenterPulse
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
          className={cn(
            "sidebar-shell",
            desktopSidebarCollapsed &&
              hoverExpanded &&
              "sidebar-shell-hover-expanded",
            desktopSidebarCollapsed &&
              !hoverExpanded &&
              "sidebar-shell-collapsed",
          )}
          onMouseEnter={() => {
            if (desktopSidebarCollapsed) setHoverExpanded(true);
          }}
          onMouseLeave={() => {
            if (accountMenuOpen) return;
            setHoverExpanded(false);
          }}
          onFocusCapture={() => {
            if (desktopSidebarCollapsed) setHoverExpanded(true);
          }}
          onBlurCapture={(event) => {
            if (!desktopSidebarCollapsed) return;
            const nextFocus = event.relatedTarget;
            if (
              nextFocus instanceof Node &&
              event.currentTarget.contains(nextFocus)
            )
              return;
            if (accountMenuOpen) return;
            setHoverExpanded(false);
          }}
        >
          <SidebarContent
            variant="desktop"
            collapsed={desktopSidebarCollapsed && !hoverExpanded}
          />
        </aside>
      ) : null}

      <div className="content-shell">
        <header className="topbar-shell">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {isLandingPage && !user ? (
              <Link
                to="/home"
                className="shrink-0 text-lg font-bold text-[#1E3A8A]"
              >
                CenterPulse
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
            isSubmissionsRoute && "min-h-[calc(100vh-5rem)] bg-[var(--bg)]",
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
