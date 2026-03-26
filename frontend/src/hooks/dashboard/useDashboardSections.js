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
    range: safeString(filters?.range),
    startDate: safeString(filters?.startDate),
    endDate: safeString(filters?.endDate),
    ownerOnly: Boolean(filters?.ownerOnly),
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
  const [activityThisMonth, setActivityThisMonth] = useState(null);
  const [centerBreakdownRows, setCenterBreakdownRows] = useState([]);
  const [projectsPerCenterData, setProjectsPerCenterData] = useState([]);
  const [outputsByTypeData, setOutputsByTypeData] = useState([]);
  const [outputsOverTimeData, setOutputsOverTimeData] = useState([]);
  const [awardsByLevelData, setAwardsByLevelData] = useState([]);
  const [fundingOverview, setFundingOverview] = useState(null);
  const [outputsVisibility, setOutputsVisibility] = useState(null);
  const [projectStatusCounts, setProjectStatusCounts] = useState([]);
  const [topContributors, setTopContributors] = useState(null);
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
      setActivityThisMonth(null);
      setCenterBreakdownRows([]);
      setProjectsPerCenterData([]);
      setOutputsByTypeData([]);
      setOutputsOverTimeData([]);
      setAwardsByLevelData([]);
      setFundingOverview(null);
      setOutputsVisibility(null);
      setProjectStatusCounts([]);
      setTopContributors(null);
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
    setActivityThisMonth(
      payload.overview?.activityThisMonth &&
        typeof payload.overview.activityThisMonth === "object"
        ? payload.overview.activityThisMonth
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
    setOutputsByTypeData(
      Array.isArray(payload.outputsByTypeData)
        ? payload.outputsByTypeData
        : [],
    );
    setOutputsOverTimeData(
      Array.isArray(payload.outputsOverTimeData)
        ? payload.outputsOverTimeData
        : [],
    );
    setAwardsByLevelData(
      Array.isArray(payload.awardsByLevelData) ? payload.awardsByLevelData : [],
    );
    setFundingOverview(
      payload.fundingOverview && typeof payload.fundingOverview === "object"
        ? payload.fundingOverview
        : null,
    );
    setOutputsVisibility(
      payload.outputsVisibility && typeof payload.outputsVisibility === "object"
        ? payload.outputsVisibility
        : null,
    );
    setProjectStatusCounts(
      Array.isArray(payload.projectStatusCounts)
        ? payload.projectStatusCounts
        : [],
    );
    setTopContributors(
      payload.topContributors && typeof payload.topContributors === "object"
        ? payload.topContributors
        : null,
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

    setLoading(false);
  }, [normalizedFilters]);

  useEffect(() => {
    loadSections();
  }, [loadSections]);

  return {
    yearOptions,
    overview,
    activityThisMonth,
    centerBreakdownRows,
    projectsPerCenterData,
    outputsByTypeData,
    outputsOverTimeData,
    awardsByLevelData,
    fundingOverview,
    outputsVisibility,
    projectStatusCounts,
    topContributors,
    recentProjects,
    recentOutputs,
    recentAwards,
    loading,
    error,
  };
}
