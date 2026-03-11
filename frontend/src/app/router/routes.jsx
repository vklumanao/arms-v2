import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "@/app/layouts/AppShell";
import ProtectedRoute from "@/app/router/guards/ProtectedRoute";
import RoleRoute from "@/app/router/guards/RoleRoute";
import AdminOrCenterChiefRoute from "@/app/router/guards/AdminOrCenterChiefRoute";
import PermissionRoute from "@/app/router/guards/PermissionRoute";
import RouteErrorBoundary from "@/shared/components/feedback/RouteErrorBoundary";
import { PERMISSIONS } from "@/shared/auth/permissions";
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
  ResearchOutputsPage,
  ResearchProjectsHubPage,
  SubmitAffiliationPage,
  SubmitAwardRecognitionPage,
} from "@/features/submissions";
import {
  AdminAffiliatesModulePage,
  AdminControlsPage,
  AdminDepartmentPage,
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

          <Route element={<AdminOrCenterChiefRoute />}>
            <Route
              path="/admin/research-center"
              element={withBoundary(<AdminResearchCenterPage />)}
            />
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
              path="/admin/departments"
              element={withBoundary(<AdminDepartmentPage />)}
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
