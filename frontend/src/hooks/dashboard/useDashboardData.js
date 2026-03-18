import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchReferenceData as fetchReferenceDataApi } from "@/services/referenceDataApi";
import { useReferenceData } from "@/hooks/useReferenceData";
import { fetchAffiliateRegistry } from "@/services/admin";
import {
  fetchDashboardProjects,
  fetchDashboardProjectStatusHistory,
  notifyDashboardUpcomingDeadlines,
} from "@/services/dashboard";
import { ENABLE_DEADLINE_NOTIFY_RPC } from "@/utils/dashboard";

export function useDashboardData({ user, profile, isAdmin }) {
  const [projects, setProjects] = useState([]);
  const [affiliateRows, setAffiliateRows] = useState([]);
  const [liveCenters, setLiveCenters] = useState([]);
  const [liveAgendas, setLiveAgendas] = useState([]);
  const [liveDepartments, setLiveDepartments] = useState([]);
  const [historyRows, setHistoryRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [affiliateError, setAffiliateError] = useState("");

  const {
    centers,
    agendas,
    departments,
    error: referenceError,
  } = useReferenceData();

  const loadData = useCallback(
    async ({ silent = false } = {}) => {
      setError("");
      setAffiliateError("");
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const { data: projectData, error: projectsError } =
        await fetchDashboardProjects({
          userId: user?.id,
          role: profile?.role || "",
        });

      if (projectsError) {
        setError(
          projectsError.message ||
            "Unable to load dashboard data. Please refresh.",
        );
      }

      const rows = projectData || [];
      setProjects(rows);
      if (isAdmin) {
        try {
          const referencePayload = await fetchReferenceDataApi();
          setLiveCenters(referencePayload?.centers || []);
          setLiveAgendas(referencePayload?.agendas || []);
          setLiveDepartments(referencePayload?.departments || []);
        } catch {
          setLiveCenters([]);
          setLiveAgendas([]);
          setLiveDepartments([]);
        }
        try {
          const affiliatePayload = await fetchAffiliateRegistry();
          setAffiliateRows(affiliatePayload?.rows || []);
        } catch (loadAffiliateError) {
          setAffiliateRows([]);
          setAffiliateError(
            loadAffiliateError.message || "Unable to load affiliate analytics.",
          );
        }
      } else {
        setAffiliateRows([]);
        setLiveCenters([]);
        setLiveAgendas([]);
        setLiveDepartments([]);
      }

      if (!projectsError && rows.length) {
        const { data: historyData } = await fetchDashboardProjectStatusHistory({
          projectIds: rows.map((project) => project.id),
        });
        setHistoryRows(historyData || []);
      } else {
        setHistoryRows([]);
      }

      if (silent) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    },
    [isAdmin, profile?.role, user?.id],
  );

  useEffect(() => {
    loadData();
    if (ENABLE_DEADLINE_NOTIFY_RPC && user?.id && profile?.role !== "admin") {
      notifyDashboardUpcomingDeadlines({ days: 14 });
    }
  }, [loadData, profile?.role, user?.id]);

  useEffect(() => {
    if (!isAdmin) return undefined;

    const intervalId = setInterval(() => {
      loadData({ silent: true });
    }, 15000);

    const onFocus = () => {
      if (document.visibilityState === "visible") {
        loadData({ silent: true });
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [isAdmin, loadData]);

  const effectiveCenters = useMemo(
    () => (isAdmin ? liveCenters : centers),
    [centers, isAdmin, liveCenters],
  );
  const effectiveAgendas = useMemo(
    () => (isAdmin ? liveAgendas : agendas),
    [agendas, isAdmin, liveAgendas],
  );
  const effectiveDepartments = useMemo(
    () => (isAdmin ? liveDepartments : departments),
    [departments, isAdmin, liveDepartments],
  );

  return {
    projects,
    affiliateRows,
    historyRows,
    loading,
    refreshing,
    error,
    affiliateError,
    referenceError,
    centers,
    departments,
    effectiveCenters,
    effectiveAgendas,
    effectiveDepartments,
    loadData,
  };
}

