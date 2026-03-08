import { Route, Routes } from "react-router-dom";
import AppShell from "@/app/layouts/AppShell";
import ProtectedRoute from "@/app/router/guards/ProtectedRoute";
import RoleRoute from "@/app/router/guards/RoleRoute";
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
  MySubmissionsPage,
  PublicationsPage,
  ResearchOutputsPage,
  ResearchProjectsHubPage,
  SubmitAffiliationPage,
} from "@/features/submissions";
import {
  AdminAffiliatesModulePage,
  AdminAffiliatesPage,
  AdminControlsPage,
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
              path="/affiliate-profile"
              element={withPermission(
                PERMISSIONS.AFFILIATE_PROFILE_VIEW,
                <AffiliateProfilePage />,
              )}
            />
            <Route
              path="/submit-affiliation"
              element={withPermission(
                PERMISSIONS.AFFILIATIONS_MANAGE,
                <ResearchProjectsHubPage />,
              )}
            />
            <Route
              path="/submit-affiliation/submit"
              element={withPermission(
                PERMISSIONS.AFFILIATIONS_MANAGE,
                <SubmitAffiliationPage />,
              )}
            />
            <Route
              path="/research-outputs"
              element={withPermission(
                PERMISSIONS.RESEARCH_OUTPUTS_VIEW,
                <ResearchOutputsPage />,
              )}
            />
            <Route
              path="/awards-recognition"
              element={withPermission(
                PERMISSIONS.AWARDS_RECOGNITION_VIEW,
                <AwardsRecognitionPage />,
              )}
            />
            <Route
              path="/my-submissions"
              element={withPermission(
                PERMISSIONS.MY_SUBMISSIONS_VIEW,
                <MySubmissionsPage />,
              )}
            />
            <Route
              path="/publications"
              element={withPermission(
                PERMISSIONS.PUBLICATIONS_MANAGE,
                <PublicationsPage />,
              )}
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
              path="/admin/affiliates-registry"
              element={withPermission(
                PERMISSIONS.ADMIN_AFFILIATES_MANAGE,
                <AdminAffiliatesPage />,
              )}
            />
            <Route
              path="/admin/research-center"
              element={withBoundary(<AdminResearchCenterPage />)}
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
