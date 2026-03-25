import { useCallback, useEffect, useMemo, useState } from "react";
import InlineNotice from "@/components/feedback/InlineNotice";
import { useAuth } from "@/components/providers/AuthProvider";
import { useDashboardData, useDashboardSections } from "@/hooks/dashboard";
import {
  AwardsByCategorySection,
  AwardsByLevelSection,
  CenterBreakdownSection,
  DashboardHeader,
  FacultyActivitySection,
  FacultyStatusSection,
  FundingOverviewSection,
  LinkedProjectsSection,
  OverviewSection,
  OutputVisibilitySection,
  OutputsByDepartmentSection,
  OutputsOverTimeSection,
  ProjectsPerCenterSection,
  RecentActivitySection,
  TopContributorsSection,
} from "./DashboardSections";
import {
  formatDateTimeLabel,
  groupByQuarter,
  normalizeCenterId,
  safeString,
  toNumber,
  UNASSIGNED_VALUE,
} from "./dashboardUtils";

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const role = safeString(profile?.role).toLowerCase();
  const isAdmin = role === "admin";

  const {
    projects,
    error,
    referenceError,
    effectiveCenters,
    effectiveDepartments,
    linkedProjects,
  } = useDashboardData({ user, profile, isAdmin });

  const knownCenterIds = useMemo(
    () =>
      new Set(
        (effectiveCenters || [])
          .map((center) => safeString(center?.id))
          .filter(Boolean),
      ),
    [effectiveCenters],
  );

  const scopedProjects = useMemo(() => {
    if (isAdmin) return projects || [];
    const ownerId = safeString(profile?.id || user?.id);
    if (!ownerId) return [];
    return (projects || []).filter(
      (project) => safeString(project?.submitted_by) === ownerId,
    );
  }, [isAdmin, profile?.id, projects, user?.id]);

  const visibleProjects = scopedProjects;

  const facultyProjects = useMemo(() => {
    if (isAdmin) return visibleProjects || [];
    const owned = Array.isArray(visibleProjects) ? visibleProjects : [];
    const linked = Array.isArray(linkedProjects) ? linkedProjects : [];
    const seen = new Set();
    const merged = [];
    [...owned, ...linked].forEach((project) => {
      const key =
        safeString(project?.ckan_dataset_id) ||
        safeString(project?.id) ||
        safeString(project?.title);
      if (!key || seen.has(key)) return;
      seen.add(key);
      merged.push(project);
    });
    return merged;
  }, [isAdmin, linkedProjects, visibleProjects]);

  const [filters, setFilters] = useState({
    centerId: "",
    departmentId: "",
    year: "",
    range: "",
  });
  const [showAllCenters, setShowAllCenters] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [trendView, setTrendView] = useState("monthly");
  const [outputsRange, setOutputsRange] = useState("last12");
  const [contributorView, setContributorView] = useState("month");
  const [sortConfig, setSortConfig] = useState({
    key: "projects",
    direction: "desc",
  });
  const [lastUpdated, setLastUpdated] = useState(null);

  const {
    yearOptions: dashboardYearOptions,
    overview: dashboardOverview,
    centerBreakdownRows: dashboardCenterBreakdownRows,
    projectsPerCenterData: dashboardProjectsPerCenterData,
    outputsByDepartmentData: dashboardOutputsByDepartmentData,
    outputsOverTimeData: dashboardOutputsOverTimeData,
    awardsByCategoryData: dashboardAwardsByCategoryData,
    awardsByLevelData: dashboardAwardsByLevelData,
    fundingOverview: dashboardFundingOverview,
    outputsVisibility: dashboardOutputsVisibility,
    topContributors: dashboardTopContributors,
    recentProjects: dashboardRecentProjects,
    recentOutputs: dashboardRecentOutputs,
    recentAwards: dashboardRecentAwards,
    activityThisMonth: dashboardActivityThisMonth,
    loading: dashboardLoading,
    error: dashboardError,
  } = useDashboardSections({ filters });

  const visibleCenterIds = useMemo(() => {
    if (isAdmin) {
      return new Set(
        (effectiveCenters || []).map((center) => safeString(center?.id)),
      );
    }

    const ids = new Set(
      (visibleProjects || [])
        .map((project) =>
          normalizeCenterId(project?.research_center_id, knownCenterIds),
        )
        .filter(Boolean),
    );
    const profileCenterId = normalizeCenterId(
      profile?.ckan_org_id || profile?.research_center_id,
      knownCenterIds,
    );
    if (profileCenterId) ids.add(profileCenterId);
    return ids;
  }, [
    effectiveCenters,
    isAdmin,
    knownCenterIds,
    profile?.ckan_org_id,
    profile?.research_center_id,
    visibleProjects,
  ]);

  const visibleCenters = useMemo(() => {
    if (isAdmin) return effectiveCenters || [];
    return (effectiveCenters || []).filter((center) =>
      visibleCenterIds.has(safeString(center?.id)),
    );
  }, [effectiveCenters, isAdmin, visibleCenterIds]);

  const visibleDepartmentIds = useMemo(() => {
    if (isAdmin) {
      return new Set(
        (effectiveDepartments || []).map((department) =>
          safeString(department?.id),
        ),
      );
    }

    const ids = new Set(
      (visibleProjects || [])
        .map((project) => safeString(project?.department_id))
        .filter(Boolean),
    );
    const profileDepartmentId = safeString(profile?.department_id);
    if (profileDepartmentId) ids.add(profileDepartmentId);
    return ids;
  }, [effectiveDepartments, isAdmin, profile?.department_id, visibleProjects]);

  const visibleDepartments = useMemo(() => {
    if (isAdmin) return effectiveDepartments || [];
    return (effectiveDepartments || []).filter((department) =>
      visibleDepartmentIds.has(safeString(department?.id)),
    );
  }, [effectiveDepartments, isAdmin, visibleDepartmentIds]);

  const yearOptions = useMemo(
    () => (Array.isArray(dashboardYearOptions) ? dashboardYearOptions : []),
    [dashboardYearOptions],
  );

  const summaryCounts = useMemo(
    () =>
      dashboardOverview || {
        centers: 0,
        departments: 0,
        affiliates: 0,
        linkedProjects: 0,
        projects: 0,
        outputs: 0,
        outputsSubmitted: 0,
        outputsExpected: 0,
        awards: 0,
      },
    [dashboardOverview],
  );

  const projectsPerCenterData = useMemo(
    () =>
      Array.isArray(dashboardProjectsPerCenterData)
        ? dashboardProjectsPerCenterData
        : [],
    [dashboardProjectsPerCenterData],
  );

  const outputsByDepartmentData = useMemo(
    () =>
      Array.isArray(dashboardOutputsByDepartmentData)
        ? dashboardOutputsByDepartmentData
        : [],
    [dashboardOutputsByDepartmentData],
  );

  const outputsOverTimeData = useMemo(
    () =>
      Array.isArray(dashboardOutputsOverTimeData)
        ? dashboardOutputsOverTimeData
        : [],
    [dashboardOutputsOverTimeData],
  );

  const awardsByCategoryData = useMemo(
    () =>
      Array.isArray(dashboardAwardsByCategoryData)
        ? dashboardAwardsByCategoryData
        : [],
    [dashboardAwardsByCategoryData],
  );

  const awardsByLevelData = useMemo(
    () =>
      Array.isArray(dashboardAwardsByLevelData)
        ? dashboardAwardsByLevelData
        : [],
    [dashboardAwardsByLevelData],
  );

  const fundingOverview = useMemo(
    () =>
      dashboardFundingOverview && typeof dashboardFundingOverview === "object"
        ? dashboardFundingOverview
        : null,
    [dashboardFundingOverview],
  );

  const outputsVisibility = useMemo(
    () =>
      dashboardOutputsVisibility &&
      typeof dashboardOutputsVisibility === "object"
        ? dashboardOutputsVisibility
        : null,
    [dashboardOutputsVisibility],
  );

  const topContributors = useMemo(
    () =>
      dashboardTopContributors && typeof dashboardTopContributors === "object"
        ? dashboardTopContributors
        : null,
    [dashboardTopContributors],
  );

  const centerBreakdownRows = useMemo(
    () =>
      Array.isArray(dashboardCenterBreakdownRows)
        ? dashboardCenterBreakdownRows
        : [],
    [dashboardCenterBreakdownRows],
  );

  const recentProjects = useMemo(
    () =>
      Array.isArray(dashboardRecentProjects) ? dashboardRecentProjects : [],
    [dashboardRecentProjects],
  );

  const recentOutputs = useMemo(
    () =>
      dashboardRecentOutputs && typeof dashboardRecentOutputs === "object"
        ? dashboardRecentOutputs
        : { mode: "submitted", rows: [] },
    [dashboardRecentOutputs],
  );

  const recentAwards = useMemo(
    () => (Array.isArray(dashboardRecentAwards) ? dashboardRecentAwards : []),
    [dashboardRecentAwards],
  );

  const activeFilterCount = useMemo(
    () =>
      [
        filters.centerId,
        filters.departmentId,
        filters.year,
        filters.range,
      ].filter(Boolean).length,
    [filters.centerId, filters.departmentId, filters.range, filters.year],
  );

  const outputsTrendData = useMemo(
    () =>
      trendView === "quarterly"
        ? groupByQuarter(outputsOverTimeData)
        : outputsOverTimeData,
    [outputsOverTimeData, trendView],
  );

  const outputsTrendDataScoped = useMemo(() => {
    if (isAdmin) return outputsTrendData;
    if (outputsRange === "last6") {
      return outputsTrendData.slice(-6);
    }
    return outputsTrendData;
  }, [isAdmin, outputsRange, outputsTrendData]);

  const totalOutputsByDepartment = useMemo(
    () =>
      outputsByDepartmentData.reduce(
        (sum, entry) => sum + toNumber(entry?.value),
        0,
      ),
    [outputsByDepartmentData],
  );

  const totalAwardsByCategory = useMemo(
    () =>
      awardsByCategoryData.reduce(
        (sum, entry) => sum + toNumber(entry?.value),
        0,
      ),
    [awardsByCategoryData],
  );

  const totalProjectsPerCenter = useMemo(
    () =>
      projectsPerCenterData.reduce(
        (sum, entry) => sum + toNumber(entry?.count),
        0,
      ),
    [projectsPerCenterData],
  );

  const totalOutputsTrend = useMemo(
    () =>
      outputsTrendDataScoped.reduce(
        (sum, entry) => sum + toNumber(entry?.outputs),
        0,
      ),
    [outputsTrendDataScoped],
  );

  const loadIssueMessage =
    error || dashboardError || referenceError?.message || "";
  const lastUpdatedLabel = lastUpdated ? formatDateTimeLabel(lastUpdated) : "";
  const currentYear = useMemo(() => String(new Date().getFullYear()), []);

  const handleToggleFilters = useCallback(
    () => setShowFilters((prev) => !prev),
    [],
  );

  const handleClearFilters = useCallback(() => {
    setFilters({ centerId: "", departmentId: "", year: "", range: "" });
    setShowFilters(false);
  }, []);

  const handleTrendChange = useCallback((nextView) => {
    setTrendView(nextView);
  }, []);

  const handleToggleShowAll = useCallback(
    () => setShowAllCenters((prev) => !prev),
    [],
  );

  const presetFlags = useMemo(
    () => ({
      thisYear: filters.year === currentYear && !filters.range,
      last12: filters.range === "last12",
      topCenters: !filters.centerId && !filters.departmentId && !showAllCenters,
      unassigned: filters.centerId === UNASSIGNED_VALUE,
    }),
    [
      currentYear,
      filters.centerId,
      filters.departmentId,
      filters.range,
      filters.year,
      showAllCenters,
    ],
  );

  const handleApplyPreset = useCallback(
    (preset) => {
      if (preset === "thisYear") {
        setFilters((prev) => ({
          ...prev,
          year: currentYear,
          range: "",
        }));
        return;
      }
      if (preset === "last12") {
        setFilters((prev) => ({
          ...prev,
          year: "",
          range: "last12",
        }));
        return;
      }
      if (preset === "topCenters") {
        setFilters((prev) => ({
          ...prev,
          centerId: "",
          departmentId: "",
        }));
        setShowAllCenters(false);
        setSortConfig({ key: "projects", direction: "desc" });
        return;
      }
      if (preset === "unassigned") {
        setFilters((prev) => ({
          ...prev,
          centerId: UNASSIGNED_VALUE,
        }));
      }
    },
    [currentYear],
  );

  useEffect(() => {
    if (!dashboardLoading) {
      setLastUpdated(new Date());
    }
  }, [
    dashboardLoading,
    filters.centerId,
    filters.departmentId,
    filters.range,
    filters.year,
  ]);

  return (
    <section className="page-stack-lg">
      <DashboardHeader
        isAdmin={isAdmin}
        title={
          isAdmin ? "Research Management Dashboard" : "My Research Dashboard"
        }
        description={
          isAdmin
            ? "Institution-wide overview across research centers, departments, affiliates, projects, outputs, and awards."
            : "Quick insights scoped to your affiliated portfolio: projects, outputs, and recognitions you can access."
        }
        filters={filters}
        visibleCenters={visibleCenters}
        visibleDepartments={visibleDepartments}
        yearOptions={yearOptions}
        activeFilterCount={activeFilterCount}
        lastUpdatedLabel={lastUpdatedLabel}
        dashboardLoading={dashboardLoading}
        showFilters={showFilters}
        onToggleFilters={handleToggleFilters}
        onUpdateFilters={setFilters}
        onClearFilters={handleClearFilters}
        onApplyPreset={handleApplyPreset}
        presetFlags={presetFlags}
      />

      {loadIssueMessage ? (
        <InlineNotice
          type="error"
          title="Dashboard load issue"
          message={loadIssueMessage}
        />
      ) : null}

      <OverviewSection
        isAdmin={isAdmin}
        summaryCounts={summaryCounts}
        filters={filters}
        loading={dashboardLoading}
      />

      {isAdmin ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <TopContributorsSection
            loading={dashboardLoading}
            contributors={topContributors}
            view={contributorView}
            onViewChange={setContributorView}
          />
          <FundingOverviewSection
            loading={dashboardLoading}
            fundingOverview={fundingOverview}
          />
          <AwardsByLevelSection
            loading={dashboardLoading}
            awardsByLevelData={awardsByLevelData}
          />
          <OutputVisibilitySection
            loading={dashboardLoading}
            visibility={outputsVisibility}
          />
        </div>
      ) : null}

      {isAdmin ? (
        <CenterBreakdownSection
          isAdmin={isAdmin}
          loading={dashboardLoading}
          centerBreakdownRows={centerBreakdownRows}
          showAllCenters={showAllCenters}
          onToggleShowAll={handleToggleShowAll}
          sortConfig={sortConfig}
          onSortChange={setSortConfig}
        />
      ) : (
        <>
          <FacultyActivitySection
            loading={dashboardLoading}
            activity={dashboardActivityThisMonth}
          />
          <FacultyStatusSection
            loading={dashboardLoading}
            projects={facultyProjects}
          />
        </>
      )}

      {isAdmin ? (
        <ProjectsPerCenterSection
          loading={dashboardLoading}
          projectsPerCenterData={projectsPerCenterData}
          totalProjectsPerCenter={totalProjectsPerCenter}
        />
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <OutputsByDepartmentSection
          loading={dashboardLoading}
          outputsByDepartmentData={outputsByDepartmentData}
          totalOutputsByDepartment={totalOutputsByDepartment}
        />

        <OutputsOverTimeSection
          loading={dashboardLoading}
          outputsTrendData={outputsTrendDataScoped}
          trendView={trendView}
          onTrendChange={handleTrendChange}
          rangeView={outputsRange}
          onRangeChange={setOutputsRange}
          isAdmin={isAdmin}
          totalOutputsTrend={totalOutputsTrend}
        />

        <AwardsByCategorySection
          loading={dashboardLoading}
          awardsByCategoryData={awardsByCategoryData}
          totalAwardsByCategory={totalAwardsByCategory}
        />
      </div>

      {!isAdmin ? (
        <LinkedProjectsSection
          loading={dashboardLoading}
          linkedProjects={linkedProjects}
        />
      ) : null}

      <RecentActivitySection
        loading={dashboardLoading}
        recentProjects={recentProjects}
        recentOutputs={recentOutputs}
        recentAwards={recentAwards}
      />
    </section>
  );
}
