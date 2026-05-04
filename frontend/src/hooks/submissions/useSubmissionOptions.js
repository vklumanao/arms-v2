import { useEffect, useMemo, useState } from "react";
import {
  fetchCkanOrganizationAgendas,
  fetchCkanUsers,
} from "@/services/ckanApi";

export default function useSubmissionOptions({ orgId, userId }) {
  const [orgAgendaOptions, setOrgAgendaOptions] = useState([]);
  const [agendasLoaded, setAgendasLoaded] = useState(false);
  const [ckanUsers, setCkanUsers] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const normalizedOrgId = String(orgId || "").trim();
    setAgendasLoaded(false);
    if (!normalizedOrgId) {
      setOrgAgendaOptions([]);
      setAgendasLoaded(true);
      return () => {
        cancelled = true;
      };
    }
    fetchCkanOrganizationAgendas(normalizedOrgId)
      .then((payload) => {
        if (cancelled) return;
        const rows = Array.isArray(payload?.data) ? payload.data : [];
        setOrgAgendaOptions(rows);
        setAgendasLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setOrgAgendaOptions([]);
        setAgendasLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  useEffect(() => {
    let cancelled = false;
    fetchCkanUsers()
      .then((payload) => {
        if (cancelled) return;
        const rows = Array.isArray(payload?.data) ? payload.data : [];
        setCkanUsers(rows);
      })
      .catch(() => {
        if (cancelled) return;
        setCkanUsers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const effectiveAgendas = useMemo(() => orgAgendaOptions, [orgAgendaOptions]);

  return {
    orgAgendaOptions,
    effectiveAgendas,
    agendasLoaded,
    ckanUsers,
  };
}
