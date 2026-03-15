import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "@/app/layouts/AppShell";
import ProtectedRoute from "@/app/router/guards/ProtectedRoute";
import RoleRoute from "@/app/router/guards/RoleRoute";
import AdminOrManagedCenterRoute from "@/app/router/guards/AdminOrManagedCenterRoute";
import AdminOrManagedDepartmentRoute from "@/app/router/guards/AdminOrManagedDepartmentRoute";
import PermissionRoute from "@/app/router/guards/PermissionRoute";
import RouteErrorBoundary from "@/shared/components/feedback/RouteErrorBoundary";
import { PERMISSIONS } from "@/shared/auth/permissions";
import { useAuth } from "@/app/providers/AuthProvider";
import {
  AboutPage,
  HomePage,
  NotFoundPage,
  UnauthorizedPage,
} from "@/features/core";
import {
  ForgotPasswordPage,
  LoginPage,
  RegisterPage,
  ResetPasswordPage,
} from "@/features/auth";
import { PublicRecordsPage } from "@/features/public-records";
import { DashboardPage } from "@/features/dashboard";
import {
  AffiliateProfilePage,
  AwardsRecognitionPage,
  ResearchProjectDetailPage,
  ResearchOutputsPage,
  ResearchProjectsHubPage,
  SubmitAffiliationPage,
  SubmitAwardRecognitionPage,
} from "@/features/submissions";
import {
  AdminAffiliateDetailPage,
  AdminAffiliatesModulePage,
  AdminControlsPage,
  AdminDepartmentDetailPage,
  AdminDepartmentPage,
  AdminResearchCenterDetailPage,
  AdminResearchCenterPage,
  AdminUsersPage,
} from "@/features/admin";

const withBoundary = (element) => (
  <RouteErrorBoundary>{element}</RouteErrorBoundary>
);
const withPermission = (permission, element) =>
  withBoundary(
    <PermissionRoute permission={permission}>{element}</PermissionRoute>,
  );

function ResearchCenterEntryRoute() {
  const { profile } = useAuth();

  if (!profile) return <Navigate to="/unauthorized" replace />;

  const role = String(profile?.role || "").trim().toLowerCase();
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

function DepartmentEntryRoute() {
  const { profile } = useAuth();

  if (!profile) return <Navigate to="/unauthorized" replace />;

  const role = String(profile?.role || "").trim().toLowerCase();
  const isAdmin = role === "admin";
  const isChairperson =
    role === "faculty" &&
    profile?.is_chairperson === true &&
    Boolean(profile?.managed_department_id);

  if (isChairperson) {
    const managedDepartmentId = String(profile?.managed_department_id || "").trim();
    if (managedDepartmentId) {
      return (
        <Navigate
          to={`/admin/departments/${encodeURIComponent(managedDepartmentId)}`}
          replace
        />
      );
    }
    return <Navigate to="/unauthorized" replace />;
  }

  if (!isAdmin) return <Navigate to="/unauthorized" replace />;

  return <AdminDepartmentPage />;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={withBoundary(<HomePage />)} />
        <Route path="/home" element={withBoundary(<HomePage />)} />
        <Route path="/about" element={withBoundary(<AboutPage />)} />
        <Route
          path="/public-records"
          element={withBoundary(<PublicRecordsPage />)}
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

        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={withBoundary(<DashboardPage />)} />

          <Route
            element={<RoleRoute allow={["faculty", "student", "admin"]} />}
          >
            <Route
              path="/my-profile"
              element={withPermission(
                PERMISSIONS.AFFILIATE_PROFILE_VIEW,
                <AffiliateProfilePage />,
              )}
            />
            <Route
              path="/submit-project"
              element={withPermission(
                PERMISSIONS.AFFILIATIONS_MANAGE,
                <ResearchProjectsHubPage />,
              )}
            />
            <Route
              path="/submit-project/:id"
              element={withPermission(
                PERMISSIONS.AFFILIATIONS_MANAGE,
                <ResearchProjectDetailPage />,
              )}
            />
            <Route
              path="/submit-project/submit"
              element={withPermission(
                PERMISSIONS.AFFILIATIONS_MANAGE,
                <SubmitAffiliationPage />,
              )}
            />
            <Route
              path="/submit-affiliation"
              element={<Navigate to="/submit-project" replace />}
            />
            <Route
              path="/submit-affiliation/submit"
              element={<Navigate to="/submit-project/submit" replace />}
            />
            <Route
              path="/research-outputs"
              element={withPermission(
                PERMISSIONS.RESEARCH_OUTPUTS_VIEW,
                <ResearchOutputsPage />,
              )}
            />
            <Route
              path="/awards-recognitions"
              element={withPermission(
                PERMISSIONS.AWARDS_RECOGNITION_VIEW,
                <AwardsRecognitionPage />,
              )}
            />
            <Route
              path="/awards-recognitions/add"
              element={withPermission(
                PERMISSIONS.AWARDS_RECOGNITION_VIEW,
                <SubmitAwardRecognitionPage />,
              )}
            />
          </Route>

          <Route>
            <Route
              path="/admin/research-center"
              element={withBoundary(<ResearchCenterEntryRoute />)}
            />
            <Route element={<AdminOrManagedCenterRoute />}>
              <Route
                path="/admin/research-center/:id"
                element={withBoundary(<AdminResearchCenterDetailPage />)}
              />
            </Route>
          </Route>

          <Route>
            <Route
              path="/admin/departments"
              element={withBoundary(<DepartmentEntryRoute />)}
            />
            <Route element={<AdminOrManagedDepartmentRoute />}>
              <Route
                path="/admin/departments/:id"
                element={withBoundary(<AdminDepartmentDetailPage />)}
              />
            </Route>
          </Route>

          <Route element={<RoleRoute allow={["admin"]} />}>
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

        <Route
          path="/unauthorized"
          element={withBoundary(<UnauthorizedPage />)}
        />
        <Route path="*" element={withBoundary(<NotFoundPage />)} />
      </Route>
    </Routes>
  );
}
