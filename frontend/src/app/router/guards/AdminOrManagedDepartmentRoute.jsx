import { Navigate, Outlet, useParams } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";

export default function AdminOrManagedDepartmentRoute() {
  const { profile } = useAuth();
  const params = useParams();
  const departmentId = String(params?.id || "").trim();

  if (!profile) return <Navigate to="/unauthorized" replace />;
  if (!departmentId) return <Navigate to="/unauthorized" replace />;

  const role = String(profile?.role || "").trim().toLowerCase();
  const isAdmin = role === "admin";
  if (isAdmin) return <Outlet />;

  const isChairperson =
    role === "faculty" &&
    profile?.is_chairperson === true &&
    Boolean(profile?.managed_department_id);

  if (!isChairperson) return <Navigate to="/unauthorized" replace />;

  const managedDepartmentId = String(profile?.managed_department_id || "").trim();
  if (managedDepartmentId && managedDepartmentId === departmentId) return <Outlet />;

  return <Navigate to="/unauthorized" replace />;
}

