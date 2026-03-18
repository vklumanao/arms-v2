import { useEffect, useState } from "react";
import { fetchReferenceData as fetchReferenceDataApi } from "@/services/referenceDataApi";

const referenceCache = new Map();
const inflightPromise = new Map();

async function fetchReferenceData(options = {}) {
  try {
    const payload = await fetchReferenceDataApi(options);
    return {
      centers: payload.centers || [],
      agendas: payload.agendas || [],
      departments: payload.departments || [],
      proponents: payload.proponents || [],
      error: null,
    };
  } catch (error) {
    return {
      centers: [],
      agendas: [],
      departments: [],
      proponents: [],
      error,
    };
  }
}

export function useReferenceData(options = {}) {
  const orgId = String(options?.orgId || "").trim();
  const cacheKey = `org:${orgId || "-"}`;
  const cached = referenceCache.get(cacheKey) || null;

  const [centers, setCenters] = useState(cached?.centers || []);
  const [agendas, setAgendas] = useState(cached?.agendas || []);
  const [departments, setDepartments] = useState(cached?.departments || []);
  const [proponents, setProponents] = useState(cached?.proponents || []);
  const [error, setError] = useState(cached?.error || null);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    let cancelled = false;

    const existingCache = referenceCache.get(cacheKey) || null;
    if (existingCache) {
      setCenters(existingCache.centers);
      setAgendas(existingCache.agendas);
      setDepartments(existingCache.departments);
      setProponents(existingCache.proponents || []);
      setError(existingCache.error || null);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    if (!inflightPromise.get(cacheKey)) {
      inflightPromise.set(
        cacheKey,
        fetchReferenceData({ orgId }).then((result) => {
          referenceCache.set(cacheKey, result);
          inflightPromise.delete(cacheKey);
          return result;
        }),
      );
    }

    inflightPromise.get(cacheKey).then((result) => {
      if (cancelled) return;
      setCenters(result.centers);
      setAgendas(result.agendas);
      setDepartments(result.departments);
      setProponents(result.proponents || []);
      setError(result.error || null);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, orgId]);

  return { centers, agendas, departments, proponents, loading, error };
}
