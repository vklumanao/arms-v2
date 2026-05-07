import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "@/components/layout/AppShell";
import PublicLayout from "@/components/layout/PublicLayout";
import ProtectedRoute from "@/components/guards/ProtectedRoute";
import AdminOrManagedCenterRoute from "@/components/guards/AdminOrManagedCenterRoute";
import PermissionRoute from "@/components/guards/PermissionRoute";
import AppLoading from "@/components/feedback/AppLoading";
import RouteErrorBoundary from "@/components/feedback/RouteErrorBoundary";
import { hasPermission, PERMISSIONS } from "@/services/permissions";
import { useAuth } from "@/components/providers/AuthProvider";

const HomePage = lazy(() => import("@/pages/core/HomePage"));
const AboutPage = lazy(() => import("@/pages/core/AboutPage"));
const NotFoundPage = lazy(() => import("@/pages/core/NotFoundPage"));
const UnauthorizedPage = lazy(() => import("@/pages/core/UnauthorizedPage"));
const ForgotPasswordPage = lazy(() => import("@/pages/auth/ForgotPasswordPage"));
const LoginPage = lazy(() => import("@/pages/auth/LoginPage"));
const RegisterPage = lazy(() => import("@/pages/auth/RegisterPage"));
const ResetPasswordPage = lazy(() => import("@/pages/auth/ResetPasswordPage"));
const VerifyEmailPage = lazy(() => import("@/pages/auth/VerifyEmailPage"));
const PublicRecordDetailPage = lazy(() =>
  import("@/pages/public-records/PublicRecordDetailPage"),
);
const PublicRecordsPage = lazy(() =>
  import("@/pages/public-records/PublicRecordsPage"),
);
const PublicResearchCenterDetailPage = lazy(() =>
  import("@/pages/public-records/PublicResearchCenterDetailPage"),
);
const DashboardPage = lazy(() => import("@/pages/dashboard/DashboardPage"));
const AffiliateProfilePage = lazy(() =>
  import("@/pages/submissions/AffiliateProfilePage"),
);
const AwardsRecognitionPage = lazy(() =>
  import("@/pages/submissions/AwardsRecognitionPage"),
);
const ResearchProjectDetailPage = lazy(() =>
  import("@/pages/submissions/ResearchProjectDetailPage"),
);
const ResearchOutputsPage = lazy(() =>
  import("@/pages/submissions/ResearchOutputsPage"),
);
const ResearchProjectsPage = lazy(() =>
  import("@/pages/submissions/ResearchProjectsPage"),
);
const SubmitProjectPage = lazy(() =>
  import("@/pages/submissions/SubmitProjectPage"),
);
const SubmitAwardRecognitionPage = lazy(() =>
  import("@/pages/submissions/SubmitAwardRecognitionPage"),
);
const AdminAffiliateDetailPage = lazy(() =>
  import("@/pages/admin/AdminAffiliateDetailPage"),
);
const AdminAffiliatesModulePage = lazy(() =>
  import("@/pages/admin/AdminAffiliatesModulePage"),
);
const AdminAccessControlPage = lazy(() =>
  import("@/pages/admin/AdminAccessControlPage"),
);
const AdminDepartmentDetailPage = lazy(() =>
  import("@/pages/admin/AdminDepartmentDetailPage"),
);
const AdminDepartmentPage = lazy(() =>
  import("@/pages/admin/AdminDepartmentPage"),
);
const AdminResearchCenterDetailPage = lazy(() =>
  import("@/pages/admin/AdminResearchCenterDetailPage"),
);
const AdminResearchCenterPage = lazy(() =>
  import("@/pages/admin/AdminResearchCenterPage"),
);
const AdminUsersPage = lazy(() => import("@/pages/admin/AdminUsersPage"));

const withBoundary = (element) => (
  <RouteErrorBoundary>
    <Suspense fallback={<AppLoading label="Loading page..." />}>
      {element}
    </Suspense>
  </RouteErrorBoundary>
);
const withPermission = (permission, element) =>
  withBoundary(
    <PermissionRoute permission={permission}>{element}</PermissionRoute>,
  );

function HomeLayoutSwitch() {
  const { user, profile } = useAuth();
  return user || profile ? <AppShell /> : <PublicLayout />;
}

function ResearchCenterEntryRoute() {
  const { profile } = useAuth();

  if (!profile) return <Navigate to="/unauthorized" replace />;

  const roleKeys = Array.isArray(profile?.roles)
    ? profile.roles.map((entry) => entry?.key)
    : profile?.role;
  const isAdmin = hasPermission(
    roleKeys,
    PERMISSIONS.ADMIN_CONTROLS_MANAGE,
    profile?.permissions,
  );
  const isCenterChief =
    profile?.is_center_chief === true && Boolean(profile?.managed_center_id);

  if (isCenterChief) {
    const managedCenterId = String(profile?.managed_center_id || "").trim();
    if (managedCenterId) {
      return (
        <Navigate
          to={`/admin/research-center/${encodeURIComponent(managedCenterId)}`}
          replace
        />
      );
    }
    return <Navigate to="/unauthorized" replace />;
  }

  if (!isAdmin) return <Navigate to="/unauthorized" replace />;

  return <AdminResearchCenterPage />;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<HomeLayoutSwitch />}>
        <Route path="/" element={withBoundary(<HomePage />)} />
        <Route path="/home" element={withBoundary(<HomePage />)} />
        <Route path="/about" element={withBoundary(<AboutPage />)} />
      </Route>

      <Route element={<PublicLayout />}>
        <Route
          path="/public-records"
          element={withBoundary(<PublicRecordsPage />)}
        />
        <Route
          path="/public-records/:id"
          element={withBoundary(<PublicRecordDetailPage />)}
        />
        <Route
          path="/public-research-centers/:id"
          element={withBoundary(<PublicResearchCenterDetailPage />)}
        />

        <Route path="/login" element={withBoundary(<LoginPage />)} />
        <Route path="/register" element={withBoundary(<RegisterPage />)} />
        <Route
          path="/verify-email"
          element={withBoundary(<VerifyEmailPage />)}
        />
        <Route
          path="/forgot-password"
          element={withBoundary(<ForgotPasswordPage />)}
        />
        <Route
          path="/reset-password"
          element={withBoundary(<ResetPasswordPage />)}
        />
      </Route>

      <Route element={<AppShell />}>
        <Route element={<ProtectedRoute />}>
          <Route
            path="/dashboard"
            element={withPermission(
              PERMISSIONS.DASHBOARD_VIEW,
              <DashboardPage />,
            )}
          />

          <Route
            path="/profile"
            element={withPermission(
              PERMISSIONS.AFFILIATE_PROFILE_VIEW,
              <AffiliateProfilePage />,
            )}
          />
          <Route
            path="/projects"
            element={withPermission(
              PERMISSIONS.PROJECTS_VIEW,
              <ResearchProjectsPage />,
            )}
          />
          <Route
            path="/projects/:id"
            element={withPermission(
              PERMISSIONS.PROJECTS_VIEW,
              <ResearchProjectDetailPage />,
            )}
          />
          <Route
            path="/projects/submit"
            element={withPermission(
              PERMISSIONS.PROJECTS_CREATE,
              <SubmitProjectPage />,
            )}
          />
          <Route
            path="/outputs"
            element={withPermission(
              PERMISSIONS.OUTPUTS_VIEW,
              <ResearchOutputsPage />,
            )}
          />
          <Route
            path="/awards"
            element={withPermission(
              PERMISSIONS.AWARDS_VIEW,
              <AwardsRecognitionPage />,
            )}
          />
          <Route
            path="/awards/new"
            element={withPermission(
              PERMISSIONS.AWARDS_CREATE,
              <SubmitAwardRecognitionPage />,
            )}
          />

          <Route>
            <Route
              path="/admin/research-center"
              element={withPermission(
                PERMISSIONS.DASHBOARD_VIEW,
                <ResearchCenterEntryRoute />,
              )}
            />
            <Route element={<AdminOrManagedCenterRoute />}>
              <Route
                path="/admin/research-center/:id"
                element={withPermission(
                  PERMISSIONS.DASHBOARD_VIEW,
                  <AdminResearchCenterDetailPage />,
                )}
              />
            </Route>
          </Route>

          <Route
            path="/admin/departments"
            element={withPermission(
              PERMISSIONS.ADMIN_CONTROLS_MANAGE,
              <AdminDepartmentPage />,
            )}
          />
          <Route
            path="/admin/departments/:id"
            element={withPermission(
              PERMISSIONS.ADMIN_CONTROLS_MANAGE,
              <AdminDepartmentDetailPage />,
            )}
          />

          <Route
            path="/admin/users"
            element={withPermission(
              PERMISSIONS.ADMIN_USERS_MANAGE,
              <AdminUsersPage />,
            )}
          />
          <Route
            path="/admin/access-control"
            element={withPermission(
              PERMISSIONS.ADMIN_RBAC_MANAGE,
              <AdminAccessControlPage />,
            )}
          />

          <Route
            path="/admin/affiliates"
            element={withPermission(
              PERMISSIONS.AFFILIATES_VIEW,
              <AdminAffiliatesModulePage />,
            )}
          />
          <Route
            path="/admin/affiliates/:id"
            element={withPermission(
              PERMISSIONS.AFFILIATES_VIEW,
              <AdminAffiliateDetailPage />,
            )}
          />
        </Route>
      </Route>

      <Route
        path="/unauthorized"
        element={withBoundary(<UnauthorizedPage />)}
      />
      <Route path="*" element={withBoundary(<NotFoundPage />)} />
    </Routes>
  );
}
