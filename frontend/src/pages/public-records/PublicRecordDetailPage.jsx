import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  fetchPublicRecordTimeline,
  fetchPublicRecordResources,
  fetchPublicRecordAwards,
  fetchPublicRecordsDataset,
} from "@/services/public-records";
import { buildApaCitation, buildMlaCitation } from "@/utils/public-records";
import { useToast } from "@/components/providers/ToastProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  EXPECTED_OUTPUT_TYPE_OPTIONS,
  formatBytes,
  formatDate,
} from "@/utils/submissions";
import {
  ChevronLeft,
  Download,
  ExternalLink,
  FileText,
  Trophy,
} from "lucide-react";

const normalizeLabel = (value) => {
  const text = String(value || "").trim();
  if (!text) return "-";
  const normalized = text
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
  return normalized.replace(/\b\w/g, (match) => match.toUpperCase());
};

const formatCurrencyPHP = (value) => {
  if (value === null || value === undefined || value === "") return "-";
  const numericValue = Number(String(value).replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(numericValue)) return String(value);
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numericValue);
};

const isHttpUrl = (value) => /^https?:\/\//i.test(String(value || ""));

const formatProjectDuration = (startDateValue, endDateValue) => {
  if (!startDateValue || !endDateValue) return "-";
  const startDate = new Date(startDateValue);
  const endDate = new Date(endDateValue);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return "-";
  }
  const diffMs = endDate.getTime() - startDate.getTime();
  if (diffMs < 0) return "-";
  const diffDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  if (diffDays >= 365) {
    const years = Math.floor(diffDays / 365);
    const months = Math.round((diffDays % 365) / 30);
    return `${years} yr${years === 1 ? "" : "s"}${
      months ? ` ${months} mo` : ""
    }`;
  }
  if (diffDays >= 30) {
    const months = Math.round(diffDays / 30);
    return `${months} mo`;
  }
  return `${diffDays} day${diffDays === 1 ? "" : "s"}`;
};

const getStatusBadgeStyle = (value) => {
  const key = String(value || "")
    .trim()
    .toLowerCase();
  if (key === "completed" || key === "complete" || key === "approved") {
    return "border-border bg-muted text-muted-foreground";
  }
  if (key === "ongoing" || key === "in progress" || key === "active") {
    return "border-border bg-muted text-muted-foreground";
  }
  if (key === "proposal" || key === "proposed" || key === "pending") {
    return "border-border bg-muted text-muted-foreground";
  }
  if (key === "rejected" || key === "cancelled" || key === "canceled") {
    return "border-border bg-muted text-muted-foreground";
  }
  return "border-border bg-muted text-muted-foreground";
};

export default function PublicRecordDetailPage() {
  const params = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const recordId = String(params?.id || "").trim();
  const apiBaseUrl =
    import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:4010/api";

  const [record, setRecord] = useState(null);
  const [centers, setCenters] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [resourcePanel, setResourcePanel] = useState({
    loading: false,
    error: "",
    dataset: null,
    resources: [],
    syncEnabled: true,
  });
  const [awardsPanel, setAwardsPanel] = useState({
    loading: false,
    error: "",
    rows: [],
  });
  const [loading, setLoading] = useState(true);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (error) toast.error("Public record load issue", error);
  }, [error, toast]);

  useEffect(() => {
    if (message) toast.success("Done", message);
  }, [message, toast]);

  useEffect(() => {
    if (!recordId) return;
    let active = true;

    const load = async () => {
      setLoading(true);
      setError("");
      const result = await fetchPublicRecordsDataset();
      if (!active) return;
      if (result.error) {
        setRecord(null);
        setCenters([]);
        setDepartments([]);
        setError(result.error.message || "Unable to load public records.");
        setLoading(false);
        return;
      }

      const rows = result.records || [];
      setCenters(result.centers || []);
      setDepartments(result.departments || []);
      const matched = rows.find(
        (row) => String(row.id || "").trim() === recordId,
      );
      setRecord(matched || null);
      setLoading(false);

      if (matched) {
        setTimelineLoading(true);
        const timelineResult = await fetchPublicRecordTimeline(recordId);
        if (!active) return;
        if (timelineResult.error) {
          setError(
            timelineResult.error.message || "Unable to load project timeline.",
          );
        } else {
          setTimeline(timelineResult.timeline || []);
        }
        setTimelineLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [recordId]);

  useEffect(() => {
    if (!recordId) {
      setResourcePanel((prev) => ({ ...prev, resources: [], dataset: null }));
      return;
    }

    let cancelled = false;
    setResourcePanel((prev) => ({ ...prev, loading: true, error: "" }));
    fetchPublicRecordResources(recordId)
      .then(({ data, error: loadError, syncEnabled }) => {
        const resolvedSyncEnabled = syncEnabled ?? true;
        if (cancelled) return;
        if (loadError) {
          setResourcePanel({
            loading: false,
            error: loadError.message || "Unable to load linked resources.",
            dataset: null,
            resources: [],
            syncEnabled: resolvedSyncEnabled,
          });
          return;
        }
        setResourcePanel({
          loading: false,
          error: "",
          dataset: data?.dataset || null,
          resources: Array.isArray(data?.resources) ? data.resources : [],
          syncEnabled: resolvedSyncEnabled,
        });
      })
      .catch((e) => {
        if (cancelled) return;
        setResourcePanel({
          loading: false,
          error: e?.message || "Unable to load linked resources.",
          dataset: null,
          resources: [],
          syncEnabled: true,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [recordId]);

  useEffect(() => {
    if (!recordId) {
      setAwardsPanel({ loading: false, error: "", rows: [] });
      return;
    }
    let cancelled = false;
    setAwardsPanel((prev) => ({ ...prev, loading: true, error: "" }));
    fetchPublicRecordAwards(recordId)
      .then(({ data, error: loadError }) => {
        if (cancelled) return;
        if (loadError) {
          setAwardsPanel({
            loading: false,
            error: loadError.message || "Unable to load linked awards.",
            rows: [],
          });
          return;
        }
        setAwardsPanel({
          loading: false,
          error: "",
          rows: Array.isArray(data) ? data : [],
        });
      })
      .catch((e) => {
        if (cancelled) return;
        setAwardsPanel({
          loading: false,
          error: e?.message || "Unable to load linked awards.",
          rows: [],
        });
      });

    return () => {
      cancelled = true;
    };
  }, [recordId]);

  const centerById = useMemo(
    () =>
      centers.reduce((acc, center) => {
        acc[center.id] = center.name;
        return acc;
      }, {}),
    [centers],
  );

  const departmentById = useMemo(
    () =>
      departments.reduce((acc, department) => {
        acc[department.id] = department.name;
        return acc;
      }, {}),
    [departments],
  );
  const outputTypeLabelByValue = useMemo(
    () =>
      (EXPECTED_OUTPUT_TYPE_OPTIONS || []).reduce((acc, item) => {
        const key = String(item?.value || "").trim();
        if (!key) return acc;
        const label = String(item?.label || "").trim();
        acc[key] = label || key;
        return acc;
      }, {}),
    [],
  );
  const moaDownloadUrl = (() => {
    const resources = Array.isArray(resourcePanel?.resources)
      ? resourcePanel.resources
      : [];
    const moaResource = resources.find((resource) => {
      const name = String(resource?.name || "").trim();
      const description = String(resource?.description || "").trim();
      const notes = String(resource?.notes || "").trim();
      return [name, description, notes].some((value) => /\bmoa\b/i.test(value));
    });
    if (!moaResource?.id) return "";
    return `${apiBaseUrl}/public-records/resources/${encodeURIComponent(
      moaResource.id,
    )}/download?download=1`;
  })();

  const selectedCenter = record
    ? centerById[record.research_center_id] || "-"
    : "-";
  const selectedDepartment = record
    ? departmentById[record.department_id] || "-"
    : "-";
  const agendaLabel = record?.research_agenda_name
    ? record.research_agenda_name
    : record?.research_agenda_id
      ? record.research_agenda_id
      : "-";
  const visibilityLabel = record?.public_visible ? "Public" : "Private";
  const durationLabel = formatProjectDuration(
    record?.start_date,
    record?.end_date,
  );
  const apaCitation = record
    ? buildApaCitation(record, selectedCenter, selectedDepartment)
    : "";
  const mlaCitation = record
    ? buildMlaCitation(record, selectedCenter, selectedDepartment)
    : "";

  return (
    <section className="page-stack-lg">
      <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6 lg:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_28%),linear-gradient(180deg,rgba(248,250,252,0.95),rgba(255,255,255,1))]" />
        <div className="relative flex flex-col gap-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-700">
                Public Research Record
              </p>
              <div className="space-y-2">
                <h1 className="text-slate-900">
                  {record?.title || "Research Project"}
                </h1>
                <p className="max-w-3xl text-[15px] leading-7 text-slate-600 lg:text-base">
                  Explore this approved public record, review its abstract,
                  discover related outputs and awards, and cite it from the
                  institutional research catalog.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">
              <Button asChild variant="outline">
                <Link to="/public-records">
                  <ChevronLeft className="h-4 w-4" />
                  Back to Records
                </Link>
              </Button>
              {!recordId ? (
                <Button
                  variant="ghost"
                  onClick={() => navigate("/public-records")}
                >
                  Return
                </Button>
              ) : null}
              <Button asChild>
                <Link
                  to={`/public-research-centers/${encodeURIComponent(
                    String(record?.research_center_id || "").trim(),
                  )}`}
                >
                  Explore Center
                </Link>
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
              Loading public record...
            </div>
          ) : !record ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
              Record not found. The public record you are looking for is
              unavailable.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold capitalize ${getStatusBadgeStyle(
                    record?.status || "published",
                  )}`}
                >
                  {record?.status || "Published"}
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                  {visibilityLabel}
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                  {durationLabel}
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                  {selectedCenter}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  {
                    label: "Lead Researcher",
                    value: record?.lead_researcher || "-",
                  },
                  { label: "Research Center", value: selectedCenter },
                  { label: "Department", value: selectedDepartment },
                  { label: "Project Year", value: record?.year || "-" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm"
                  >
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                      {item.label}
                    </p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-slate-900">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
                <div className="space-y-4">
                  <Card className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
                    <CardHeader className="border-b border-slate-100 px-5 py-4">
                      <CardTitle className="text-lg font-bold text-slate-900">
                        Overview
                      </CardTitle>
                      <CardDescription>
                        Public-facing summary and discovery context for this
                        record.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5 p-5">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                          Project Summary
                        </p>
                        <p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-700">
                          {record?.abstract || "No abstract available."}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
                    <CardHeader className="border-b border-slate-100 px-5 py-4">
                      <CardTitle className="text-lg font-bold text-slate-900">
                        Proponents
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                          Lead Researcher
                        </p>
                        <p className="mt-2 text-sm font-semibold text-slate-900">
                          {record?.lead_researcher || "-"}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                          Faculty Team
                        </p>
                        <p className="mt-2 text-sm leading-7 text-slate-700">
                          {record?.faculty_team || "-"}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                          Student Team
                        </p>
                        <p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-700">
                          {record?.student_team || "-"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
                    <CardHeader className="border-b border-slate-100 px-5 py-4">
                      <CardTitle className="text-lg font-bold text-slate-900">
                        Funding and Timeline
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
                      {[
                        [
                          "Industry/Agency Partner",
                          record?.industry_partner || "-",
                        ],
                        ["Funding Type", normalizeLabel(record?.funding_type)],
                        ["Funding Source", record?.funding_source || "-"],
                        [
                          "Funding Amount",
                          formatCurrencyPHP(record?.funding_amount),
                        ],
                        ["Start Date", formatDate(record?.start_date)],
                        ["End Date", formatDate(record?.end_date)],
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                        >
                          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                            {label}
                          </p>
                          <p className="mt-2 text-sm font-semibold leading-6 text-slate-900">
                            {value}
                          </p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
                    <CardHeader className="border-b border-slate-100 px-6 py-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <CardTitle className="text-base font-semibold text-black">
                            Timeline
                          </CardTitle>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6">
                      {timelineLoading ? (
                        <p className="text-sm text-slate-600">
                          Loading timeline...
                        </p>
                      ) : timeline.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
                          No public timeline entries available for this record.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {timeline.map((item, index) => (
                            <div
                              key={`${item?.date || "timeline"}-${index}`}
                              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                            >
                              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-sm font-semibold text-slate-900">
                                  {item?.label ||
                                    item?.title ||
                                    "Timeline Entry"}
                                </p>
                                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                  {formatDate(item?.date)}
                                </span>
                              </div>
                              {item?.description ? (
                                <p className="mt-2 text-sm leading-7 text-slate-600">
                                  {item.description}
                                </p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-4">
                  <Card className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm xl:sticky xl:top-5">
                    <CardHeader className="border-b border-slate-100 px-5 py-4">
                      <CardTitle className="text-lg font-bold text-slate-900">
                        Record Facts
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 p-5">
                      {[
                        ["Status", normalizeLabel(record?.status)],
                        ["Visibility", visibilityLabel],
                        ["Research Agenda", agendaLabel],
                        [
                          "Classification",
                          normalizeLabel(record?.classification),
                        ],
                        ["Project Year", record?.year || "-"],
                        ["Duration", durationLabel],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                            {label}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">
                            {value}
                          </p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
                    <CardHeader className="border-b border-slate-100 px-5 py-4">
                      <CardTitle className="text-lg font-bold text-slate-900">
                        Supporting Links
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 p-5">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                          Research Center
                        </p>
                        <Link
                          className="mt-2 inline-flex items-center text-sm font-semibold text-slate-900 underline-offset-4 hover:underline"
                          to={`/public-research-centers/${encodeURIComponent(
                            String(record?.research_center_id || "").trim(),
                          )}`}
                        >
                          Explore {selectedCenter}
                          <ExternalLink className="ml-2 h-4 w-4" />
                        </Link>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                          Signed MOA
                        </p>
                        {moaDownloadUrl ? (
                          <div className="mt-3">
                            <Button asChild variant="outline" size="sm">
                              <a
                                href={moaDownloadUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <Download className="h-4 w-4" />
                                Download MOA
                              </a>
                            </Button>
                          </div>
                        ) : (
                          <p className="mt-2 text-sm text-slate-600">
                            No signed MOA reference available.
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
                    <CardHeader className="border-b border-slate-100 px-5 py-4">
                      <CardTitle className="text-lg font-bold text-slate-900">
                        Cite This Record
                      </CardTitle>
                      <CardDescription>
                        Generated from the currently visible public metadata.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3 p-5">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                          APA
                        </p>
                        <p className="mt-2 text-sm leading-7 text-slate-700">
                          {apaCitation}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                          MLA
                        </p>
                        <p className="mt-2 text-sm leading-7 text-slate-700">
                          {mlaCitation}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <Card className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
                <CardHeader className="border-b border-[var(--border)] px-5 py-4">
                  <CardTitle className="text-base font-semibold text-black">
                    Outputs and Resources
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5">
                  {!resourcePanel.syncEnabled ? (
                    <p className="text-sm text-muted-foreground">
                      CKAN sync is disabled in this environment.
                    </p>
                  ) : resourcePanel.loading ? (
                    <p className="text-sm text-muted-foreground">
                      Loading linked resources...
                    </p>
                  ) : resourcePanel.error ? (
                    <p className="text-sm text-muted-foreground">
                      {resourcePanel.error}
                    </p>
                  ) : resourcePanel.resources.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] p-6 text-center text-sm text-muted-foreground">
                      No linked resources found for this record.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      {resourcePanel.resources
                        .filter((resource) => {
                          const name = String(resource?.name || "").trim();
                          const description = String(
                            resource?.description || "",
                          ).trim();
                          const notes = String(resource?.notes || "").trim();
                          return ![name, description, notes].some((value) =>
                            /\bmoa\b/i.test(value),
                          );
                        })
                        .map((resource) => {
                          const resourceUrl = String(resource.url || "").trim();
                          const isDownloadable =
                            /\/resource\/.+\/download\//i.test(resourceUrl);
                          const descriptionText = String(
                            resource.description || "",
                          ).trim();
                          const outputLinkFromDescription = descriptionText
                            .split("\n")
                            .map((line) => line.trim())
                            .find((line) =>
                              line.toLowerCase().startsWith("output link:"),
                            )
                            ?.split("output link:")
                            .slice(1)
                            .join("output link:")
                            .trim();
                          const outputLinkFromUrl =
                            descriptionText.match(/(https?:\/\/\S+)/i)?.[1];
                          const outputLink =
                            String(resource.output_link || "").trim() ||
                            outputLinkFromDescription ||
                            outputLinkFromUrl ||
                            (!isDownloadable ? resourceUrl : "");
                          const hasLink = Boolean(outputLink);
                          const hasFile = Boolean(
                            resource.id && isDownloadable,
                          );
                          const downloadUrl = resource.id
                            ? `${apiBaseUrl}/public-records/resources/${encodeURIComponent(
                                resource.id,
                              )}/download?download=1`
                            : "";
                          return (
                            <Card
                              key={resource.id || resource.url || resource.name}
                              className="h-full rounded-2xl border border-slate-200 bg-white shadow-sm"
                            >
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-base font-semibold text-slate-900">
                                      {resource.name || "Unnamed resource"}
                                    </p>
                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-sm font-semibold text-slate-600">
                                        {outputTypeLabelByValue[
                                          String(
                                            resource.output_type ||
                                              resource.outputType ||
                                              "",
                                          ).trim()
                                        ] || "Output"}
                                      </span>
                                    </div>
                                    {(() => {
                                      const rawAuthors =
                                        String(
                                          resource.publication_authors || "",
                                        ).trim() ||
                                        String(
                                          resource.publicationAuthors || "",
                                        ).trim();
                                      if (rawAuthors) {
                                        return (
                                          <p className="text-base font-medium text-slate-900">
                                            Proponents: {rawAuthors}
                                          </p>
                                        );
                                      }
                                      const descriptionText = String(
                                        resource.description || "",
                                      ).trim();
                                      const fromDescription = descriptionText
                                        .split("\n")
                                        .map((line) => line.trim())
                                        .find((line) =>
                                          line
                                            .toLowerCase()
                                            .startsWith("authors/proponents:"),
                                        )
                                        ?.split("authors/proponents:")
                                        .slice(1)
                                        .join("authors/proponents:")
                                        .trim();
                                      if (!fromDescription) return null;
                                      return (
                                        <p className="text-base font-medium text-slate-900">
                                          Proponents: {fromDescription}
                                        </p>
                                      );
                                    })()}
                                    <p className="text-base text-slate-600">
                                      Format: {resource.format || "-"} | Size:{" "}
                                      {formatBytes(resource.size)}
                                    </p>
                                    {hasLink ? (
                                      <p className="text-base text-slate-600">
                                        Output Link:{" "}
                                        <a
                                          href={outputLink}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="text-slate-700 hover:underline"
                                        >
                                          {outputLink}
                                        </a>
                                      </p>
                                    ) : null}
                                  </div>
                                  <FileText className="h-5 w-5 text-slate-500" />
                                </div>

                                {resource.id && hasFile ? (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    <Button asChild variant="outline" size="sm">
                                      <a
                                        href={downloadUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                      >
                                        <Download className="h-4 w-4" />
                                        Download
                                      </a>
                                    </Button>
                                  </div>
                                ) : hasLink ? null : (
                                  <p className="mt-2 text-base text-slate-600">
                                    No file attached yet.
                                  </p>
                                )}
                              </CardContent>
                            </Card>
                          );
                        })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="overflow-hidden border border-black/20 bg-white shadow-sm">
                <CardHeader className="border-b border-zinc-200 px-6 py-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="text-base font-semibold text-black">
                        Awards &amp; Recognition
                      </CardTitle>
                      <CardDescription>
                        Awards linked to this public research record.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-5">
                  {awardsPanel.loading ? (
                    <p className="text-sm text-muted-foreground">
                      Loading linked awards...
                    </p>
                  ) : awardsPanel.error ? (
                    <p className="text-sm text-muted-foreground">
                      {awardsPanel.error}
                    </p>
                  ) : awardsPanel.rows.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] p-6 text-center text-sm text-muted-foreground">
                      No awards linked to this project yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {awardsPanel.rows.map((row) => {
                        const downloadUrl = row.supporting_mov_resource_id
                          ? `${apiBaseUrl}/public-records/resources/${encodeURIComponent(
                              row.supporting_mov_resource_id,
                            )}/download?download=1`
                          : "";
                        const fallbackLink = row.supporting_movs || "";
                        return (
                          <Card
                            key={row.id || row.award_recognition}
                            className="h-full rounded-2xl border border-slate-200 bg-white shadow-sm"
                          >
                            <CardContent className="p-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-base font-semibold text-slate-900">
                                    {row.award_recognition || "Award"}
                                  </p>
                                  <div className="mt-1 flex flex-wrap items-center gap-2">
                                    <Badge variant="outline">
                                      {row.level || "Level"}
                                    </Badge>
                                    {row.year_received ? (
                                      <Badge variant="secondary">
                                        {row.year_received}
                                      </Badge>
                                    ) : null}
                                  </div>
                                  <p className="mt-2 text-base text-slate-600">
                                    Awarding body: {row.awarding_body || "-"}
                                  </p>
                                  <p className="text-base text-slate-600">
                                    Recipients: {row.recipients || "-"}
                                  </p>
                                </div>
                                <Trophy className="h-5 w-5 text-slate-500" />
                              </div>
                              {downloadUrl || fallbackLink ? (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <Button asChild variant="outline" size="sm">
                                    <a
                                      href={downloadUrl || fallbackLink}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      <Download className="h-4 w-4" />
                                      Download
                                    </a>
                                  </Button>
                                </div>
                              ) : null}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
