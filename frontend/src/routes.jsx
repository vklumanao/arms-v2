import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import AppShell from "@/components/layout/AppShell";
import PublicLayout from "@/components/layout/PublicLayout";
import ProtectedRoute from "@/components/guards/ProtectedRoute";
import RoleRoute from "@/components/guards/RoleRoute";
import AdminOrManagedCenterRoute from "@/components/guards/AdminOrManagedCenterRoute";
import PermissionRoute from "@/components/guards/PermissionRoute";
import RouteErrorBoundary from "@/components/feedback/RouteErrorBoundary";
import { PERMISSIONS } from "@/services/permissions";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  AboutPage,
  HomePage,
  NotFoundPage,
  UnauthorizedPage,
} from "@/pages/core";
import {
  ForgotPasswordPage,
  LoginPage,
  RegisterPage,
  ResetPasswordPage,
} from "@/pages/auth";
import {
  PublicRecordDetailPage,
  PublicRecordsPage,
  PublicResearchCenterDetailPage,
} from "@/pages/public-records";
import { DashboardPage } from "@/pages/dashboard";
import {
  AffiliateProfilePage,
  AwardsRecognitionPage,
  ResearchProjectDetailPage,
  ResearchOutputsPage,
  ResearchProjectsHubPage,
  SubmitAffiliationPage,
  SubmitAwardRecognitionPage,
} from "@/pages/submissions";
import {
  AdminAffiliateDetailPage,
  AdminAffiliatesModulePage,
  AdminControlsPage,
  AdminDepartmentDetailPage,
  AdminDepartmentPage,
  AdminResearchCenterDetailPage,
  AdminResearchCenterPage,
  AdminUsersPage,
} from "@/pages/admin";

const withBoundary = (element) => (
  <RouteErrorBoundary>{element}</RouteErrorBoundary>
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

  const role = String(profile?.role || "")
    .trim()
    .toLowerCase();
  const isAdmin = role === "admin";
  const isCenterChief =
    role === "faculty" &&
    profile?.is_center_chief === true &&
    Boolean(profile?.managed_center_id);

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
      </Route>

      <Route element={<PublicLayout />}>
        <Route path="/about" element={withBoundary(<AboutPage />)} />
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
            element={<RoleRoute allow={["faculty", "student", "admin"]} />}
          >
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
                PERMISSIONS.AFFILIATIONS_MANAGE,
                <ResearchProjectsHubPage />,
              )}
            />
            <Route
              path="/projects/:id"
              element={withPermission(
                PERMISSIONS.AFFILIATIONS_MANAGE,
                <ResearchProjectDetailPage />,
              )}
            />
            <Route
              path="/projects/submit"
              element={withPermission(
                PERMISSIONS.AFFILIATIONS_MANAGE,
                <SubmitAffiliationPage />,
              )}
            />
            <Route
              path="/outputs"
              element={withPermission(
                PERMISSIONS.RESEARCH_OUTPUTS_VIEW,
                <ResearchOutputsPage />,
              )}
            />
            <Route
              path="/awards"
              element={withPermission(
                PERMISSIONS.AWARDS_RECOGNITION_VIEW,
                <AwardsRecognitionPage />,
              )}
            />
            <Route
              path="/awards/new"
              element={withPermission(
                PERMISSIONS.AWARDS_RECOGNITION_VIEW,
                <SubmitAwardRecognitionPage />,
              )}
            />
          </Route>

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

          <Route element={<RoleRoute allow={["admin"]} />}>
            <Route
              path="/admin/departments"
              element={withBoundary(<AdminDepartmentPage />)}
            />
            <Route
              path="/admin/departments/:id"
              element={withBoundary(<AdminDepartmentDetailPage />)}
            />
            <Route
              path="/admin/controls"
              element={withPermission(
                PERMISSIONS.ADMIN_CONTROLS_MANAGE,
                <AdminControlsPage />,
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
              path="/admin/affiliates"
              element={withPermission(
                PERMISSIONS.ADMIN_AFFILIATES_MANAGE,
                <AdminAffiliatesModulePage />,
              )}
            />
            <Route
              path="/admin/affiliates/:id"
              element={withPermission(
                PERMISSIONS.ADMIN_AFFILIATES_MANAGE,
                <AdminAffiliateDetailPage />,
              )}
            />
          </Route>
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
