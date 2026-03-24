import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchDashboardAwardsByCategory,
  fetchDashboardCenterBreakdown,
  fetchDashboardOverview,
  fetchDashboardOutputsByDepartment,
  fetchDashboardOutputsOverTime,
  fetchDashboardProjectsPerCenter,
  fetchDashboardRecentAwards,
  fetchDashboardRecentOutputs,
  fetchDashboardRecentProjects,
  fetchDashboardYearOptions,
} from "@/services/dashboard";

function safeString(value) {
  return String(value ?? "").trim();
}

function normalizeFilters(filters) {
  return {
    centerId: safeString(filters?.centerId),
    departmentId: safeString(filters?.departmentId),
    year: safeString(filters?.year),
  };
}

export function useDashboardSections({ filters } = {}) {
  const normalizedFilters = useMemo(() => normalizeFilters(filters), [filters]);

  const [yearOptions, setYearOptions] = useState([]);
  const [overview, setOverview] = useState(null);
  const [centerBreakdownRows, setCenterBreakdownRows] = useState([]);
  const [projectsPerCenterData, setProjectsPerCenterData] = useState([]);
  const [outputsByDepartmentData, setOutputsByDepartmentData] = useState([]);
  const [outputsOverTimeData, setOutputsOverTimeData] = useState([]);
  const [awardsByCategoryData, setAwardsByCategoryData] = useState([]);
  const [recentProjects, setRecentProjects] = useState([]);
  const [recentOutputs, setRecentOutputs] = useState({ mode: "submitted", rows: [] });
  const [recentAwards, setRecentAwards] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadSections = useCallback(async () => {
    setLoading(true);
    setError("");

    const [
      yearsRes,
      overviewRes,
      breakdownRes,
      projectsPerCenterRes,
      outputsByDeptRes,
      outputsOverTimeRes,
      awardsByCategoryRes,
      recentProjectsRes,
      recentOutputsRes,
      recentAwardsRes,
    ] = await Promise.all([
      fetchDashboardYearOptions(),
      fetchDashboardOverview(normalizedFilters),
      fetchDashboardCenterBreakdown(normalizedFilters),
      fetchDashboardProjectsPerCenter(normalizedFilters),
      fetchDashboardOutputsByDepartment(normalizedFilters),
      fetchDashboardOutputsOverTime(normalizedFilters),
      fetchDashboardAwardsByCategory(normalizedFilters),
      fetchDashboardRecentProjects(normalizedFilters, { limit: 6 }),
      fetchDashboardRecentOutputs(normalizedFilters, { limit: 6 }),
      fetchDashboardRecentAwards(normalizedFilters, { limit: 6 }),
    ]);

    if (yearsRes.error) setError(yearsRes.error?.message || "Failed to load years.");
    else setYearOptions(Array.isArray(yearsRes.data) ? yearsRes.data : []);

    if (overviewRes.error) setError(overviewRes.error?.message || "Failed to load overview.");
    else setOverview(overviewRes.data && typeof overviewRes.data === "object" ? overviewRes.data : null);

    if (breakdownRes.error) setError(breakdownRes.error?.message || "Failed to load breakdown.");
    else setCenterBreakdownRows(Array.isArray(breakdownRes.data) ? breakdownRes.data : []);

    if (projectsPerCenterRes.error) setError(projectsPerCenterRes.error?.message || "Failed to load chart.");
    else setProjectsPerCenterData(Array.isArray(projectsPerCenterRes.data) ? projectsPerCenterRes.data : []);

    if (outputsByDeptRes.error) setError(outputsByDeptRes.error?.message || "Failed to load chart.");
    else setOutputsByDepartmentData(Array.isArray(outputsByDeptRes.data) ? outputsByDeptRes.data : []);

    if (outputsOverTimeRes.error) setError(outputsOverTimeRes.error?.message || "Failed to load chart.");
    else setOutputsOverTimeData(Array.isArray(outputsOverTimeRes.data) ? outputsOverTimeRes.data : []);

    if (awardsByCategoryRes.error) setError(awardsByCategoryRes.error?.message || "Failed to load chart.");
    else setAwardsByCategoryData(Array.isArray(awardsByCategoryRes.data) ? awardsByCategoryRes.data : []);

    if (recentProjectsRes.error) setError(recentProjectsRes.error?.message || "Failed to load recent projects.");
    else setRecentProjects(Array.isArray(recentProjectsRes.data) ? recentProjectsRes.data : []);

    if (recentOutputsRes.error) setError(recentOutputsRes.error?.message || "Failed to load recent outputs.");
    else setRecentOutputs(recentOutputsRes.data && typeof recentOutputsRes.data === "object" ? recentOutputsRes.data : { mode: "submitted", rows: [] });

    if (recentAwardsRes.error) setError(recentAwardsRes.error?.message || "Failed to load recent awards.");
    else setRecentAwards(Array.isArray(recentAwardsRes.data) ? recentAwardsRes.data : []);

    setLoading(false);
  }, [normalizedFilters]);

  useEffect(() => {
    loadSections();
  }, [loadSections]);

  return {
    yearOptions,
    overview,
    centerBreakdownRows,
    projectsPerCenterData,
    outputsByDepartmentData,
    outputsOverTimeData,
    awardsByCategoryData,
    recentProjects,
    recentOutputs,
    recentAwards,
    loading,
    error,
  };
}
