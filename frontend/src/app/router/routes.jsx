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
  AdminAuditConsolePage,
  AdminControlsPage,
  AdminReportsPage,
  AdminResearchCenterPage,
  AdminReviewQueuePage,
  AdminUsersPage,
} from "@/features/admin";

const withBoundary = (element) => (
  <RouteErrorBoundary>{element}</RouteErrorBoundary>
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
              element={withBoundary(
                <PermissionRoute
                  permission={PERMISSIONS.AFFILIATE_PROFILE_VIEW}
                >
                  <AffiliateProfilePage />
                </PermissionRoute>,
              )}
            />
            <Route
              path="/submit-affiliation"
              element={withBoundary(
                <PermissionRoute
                  permission={PERMISSIONS.RESEARCH_PROJECTS_MANAGE}
                >
                  <ResearchProjectsHubPage />
                </PermissionRoute>,
              )}
            />
            <Route
              path="/submit-affiliation/submit"
              element={withBoundary(
                <PermissionRoute
                  permission={PERMISSIONS.RESEARCH_PROJECTS_MANAGE}
                >
                  <SubmitAffiliationPage />
                </PermissionRoute>,
              )}
            />
            <Route
              path="/research-outputs"
              element={withBoundary(
                <PermissionRoute permission={PERMISSIONS.RESEARCH_OUTPUTS_VIEW}>
                  <ResearchOutputsPage />
                </PermissionRoute>,
              )}
            />
            <Route
              path="/awards-recognition"
              element={withBoundary(
                <PermissionRoute
                  permission={PERMISSIONS.AWARDS_RECOGNITION_VIEW}
                >
                  <AwardsRecognitionPage />
                </PermissionRoute>,
              )}
            />
            <Route
              path="/my-submissions"
              element={withBoundary(
                <PermissionRoute permission={PERMISSIONS.MY_SUBMISSIONS_VIEW}>
                  <MySubmissionsPage />
                </PermissionRoute>,
              )}
            />
            <Route
              path="/publications"
              element={withBoundary(
                <PermissionRoute permission={PERMISSIONS.PUBLICATIONS_MANAGE}>
                  <PublicationsPage />
                </PermissionRoute>,
              )}
            />
          </Route>

          <Route element={<RoleRoute allow={["admin"]} />}>
            <Route
              path="/admin/review-queue"
              element={withBoundary(
                <PermissionRoute
                  permission={PERMISSIONS.ADMIN_REVIEW_QUEUE_MANAGE}
                >
                  <AdminReviewQueuePage />
                </PermissionRoute>,
              )}
            />
            <Route
              path="/admin/controls"
              element={withBoundary(
                <PermissionRoute permission={PERMISSIONS.ADMIN_CONTROLS_MANAGE}>
                  <AdminControlsPage />
                </PermissionRoute>,
              )}
            />
            <Route
              path="/admin/users"
              element={withBoundary(
                <PermissionRoute permission={PERMISSIONS.ADMIN_USERS_MANAGE}>
                  <AdminUsersPage />
                </PermissionRoute>,
              )}
            />
            <Route
              path="/admin/affiliates"
              element={withBoundary(
                <PermissionRoute
                  permission={PERMISSIONS.ADMIN_AFFILIATES_MANAGE}
                >
                  <AdminAffiliatesModulePage />
                </PermissionRoute>,
              )}
            />
            <Route
              path="/admin/affiliates-registry"
              element={withBoundary(
                <PermissionRoute
                  permission={PERMISSIONS.ADMIN_AFFILIATES_MANAGE}
                >
                  <AdminAffiliatesPage />
                </PermissionRoute>,
              )}
            />
            <Route
              path="/admin/reports"
              element={withBoundary(
                <PermissionRoute permission={PERMISSIONS.ADMIN_REPORTS_VIEW}>
                  <AdminReportsPage />
                </PermissionRoute>,
              )}
            />
            <Route
              path="/admin/research-center"
              element={withBoundary(<AdminResearchCenterPage />)}
            />
            <Route
              path="/admin/audit"
              element={withBoundary(
                <PermissionRoute permission={PERMISSIONS.ADMIN_AUDIT_VIEW}>
                  <AdminAuditConsolePage />
                </PermissionRoute>,
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

