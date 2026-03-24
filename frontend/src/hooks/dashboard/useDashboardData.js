import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchReferenceData as fetchReferenceDataApi } from "@/services/referenceDataApi";
import { useReferenceData } from "@/hooks/useReferenceData";
import {
  fetchDashboardProjects,
  notifyDashboardUpcomingDeadlines,
} from "@/services/dashboard";
import { ENABLE_DEADLINE_NOTIFY_RPC } from "@/utils/dashboard";

export function useDashboardData({ user, profile, isAdmin }) {
  const [projects, setProjects] = useState([]);
  const [liveCenters, setLiveCenters] = useState([]);
  const [liveAgendas, setLiveAgendas] = useState([]);
  const [liveDepartments, setLiveDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const {
    centers,
    agendas,
    departments,
    error: referenceError,
  } = useReferenceData();

  const loadData = useCallback(
    async () => {
      setError("");
      setLoading(true);

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
      } else {
        setLiveCenters([]);
        setLiveAgendas([]);
        setLiveDepartments([]);
      }

      setLoading(false);
    },
    [isAdmin, profile?.role, user?.id],
  );

  useEffect(() => {
    loadData();
    if (ENABLE_DEADLINE_NOTIFY_RPC && user?.id && profile?.role !== "admin") {
      notifyDashboardUpcomingDeadlines({ days: 14 });
    }
  }, [loadData, profile?.role, user?.id]);

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
    loading,
    error,
    referenceError,
    centers,
    departments,
    effectiveCenters,
    effectiveAgendas,
    effectiveDepartments,
  };
}
