import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchDashboardSummary } from "@/services/dashboard";

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
  const now =
    typeof performance !== "undefined" && typeof performance.now === "function"
      ? () => performance.now()
      : () => Date.now();

  const [yearOptions, setYearOptions] = useState([]);
  const [overview, setOverview] = useState(null);
  const [centerBreakdownRows, setCenterBreakdownRows] = useState([]);
  const [projectsPerCenterData, setProjectsPerCenterData] = useState([]);
  const [outputsByDepartmentData, setOutputsByDepartmentData] = useState([]);
  const [outputsOverTimeData, setOutputsOverTimeData] = useState([]);
  const [awardsByCategoryData, setAwardsByCategoryData] = useState([]);
  const [recentProjects, setRecentProjects] = useState([]);
  const [recentOutputs, setRecentOutputs] = useState({
    mode: "submitted",
    rows: [],
  });
  const [recentAwards, setRecentAwards] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadSections = useCallback(async () => {
    setLoading(true);
    setError("");

    const startedAt = now();
    const summaryRes = await fetchDashboardSummary(normalizedFilters, {
      limit: 6,
    });

    if (summaryRes.error) {
      setError(summaryRes.error?.message || "Failed to load dashboard data.");
      setYearOptions([]);
      setOverview(null);
      setCenterBreakdownRows([]);
      setProjectsPerCenterData([]);
      setOutputsByDepartmentData([]);
      setOutputsOverTimeData([]);
      setAwardsByCategoryData([]);
      setRecentProjects([]);
      setRecentOutputs({ mode: "submitted", rows: [] });
      setRecentAwards([]);
      setLoading(false);
      return;
    }

    const payload =
      summaryRes.data && typeof summaryRes.data === "object"
        ? summaryRes.data
        : {};

    setYearOptions(
      Array.isArray(payload.yearOptions) ? payload.yearOptions : [],
    );
    setOverview(
      payload.overview && typeof payload.overview === "object"
        ? payload.overview
        : null,
    );
    setCenterBreakdownRows(
      Array.isArray(payload.centerBreakdownRows)
        ? payload.centerBreakdownRows
        : [],
    );
    setProjectsPerCenterData(
      Array.isArray(payload.projectsPerCenterData)
        ? payload.projectsPerCenterData
        : [],
    );
    setOutputsByDepartmentData(
      Array.isArray(payload.outputsByDepartmentData)
        ? payload.outputsByDepartmentData
        : [],
    );
    setOutputsOverTimeData(
      Array.isArray(payload.outputsOverTimeData)
        ? payload.outputsOverTimeData
        : [],
    );
    setAwardsByCategoryData(
      Array.isArray(payload.awardsByCategoryData)
        ? payload.awardsByCategoryData
        : [],
    );
    setRecentProjects(
      Array.isArray(payload.recentProjects) ? payload.recentProjects : [],
    );
    setRecentOutputs(
      payload.recentOutputs && typeof payload.recentOutputs === "object"
        ? payload.recentOutputs
        : { mode: "submitted", rows: [] },
    );
    setRecentAwards(
      Array.isArray(payload.recentAwards) ? payload.recentAwards : [],
    );

    const elapsed = Math.round(now() - startedAt);
    if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
      console.info(`Dashboard summary loaded in ${elapsed}ms`);
    }
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
