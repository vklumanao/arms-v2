import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  fetchPublicRecordTimeline,
  fetchPublicRecordResources,
  fetchPublicRecordsDataset,
} from "@/services/public-records";
import { buildApaCitation, buildMlaCitation } from "@/utils/public-records";
import { useToast } from "@/components/providers/ToastProvider";
import { Button } from "@/components/ui/button";
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
import { Download, ExternalLink, FileText } from "lucide-react";

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
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (key === "ongoing" || key === "in progress" || key === "active") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }
  if (key === "proposal" || key === "proposed" || key === "pending") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (key === "rejected" || key === "cancelled" || key === "canceled") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-700";
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
  const moaDownloadUrl = useMemo(() => {
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
  }, [apiBaseUrl, resourcePanel?.resources]);

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

  const apaCitation = record
    ? buildApaCitation(record, selectedCenter, selectedDepartment)
    : "";
  const mlaCitation = record
    ? buildMlaCitation(record, selectedCenter, selectedDepartment)
    : "";

  const copyCitation = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(`${label} citation copied.`);
    } catch {
      setError("Unable to copy citation.");
    }
  };

  return (
    <section className="page-stack-lg">
      <div className="rounded-2xl border border-slate-200/70 bg-gradient-to-br from-amber-50 via-white to-emerald-50 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">
              {record?.title || "Research Project"}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline">
              <Link to="/public-records">Back to Catalog</Link>
            </Button>
            {!recordId ? (
              <Button
                variant="ghost"
                onClick={() => navigate("/public-records")}
              >
                Return
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold capitalize ${getStatusBadgeStyle(
              record?.status || "Published",
            )}`}
          >
            {record?.status || "Published"}
          </span>

          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-700">
            {record?.public_visible ? "Public" : "Private"}
          </span>

          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-700">
            {formatProjectDuration(record?.start_date, record?.end_date)}
          </span>

          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-700">
            {selectedCenter}
          </span>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-[var(--border)] px-6 py-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold text-slate-900">
                Project Details
              </CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 p-6">
          {loading ? (
            <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] p-8 text-center text-base text-slate-600">
              Loading record...
            </div>
          ) : !record ? (
            <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] p-8 text-center text-base text-slate-600">
              Record not found. The public record you are looking for is
              unavailable.
            </div>
          ) : (
            <>
              <div className="grid gap-4 xl:grid-cols-[1fr_1.1fr]">
                <div className="space-y-4">
                  <Card className="overflow-hidden rounded-2xl border border-slate-200/70 shadow-sm">
                    <CardHeader className="border-b border-[var(--border)] px-6 py-4">
                      <CardTitle className="text-base font-semibold text-slate-900">
                        Overview
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 p-5 text-base text-slate-700 sm:grid-cols-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-500">
                          Research Center
                        </p>
                        <p className="mt-1 text-base font-semibold text-slate-900">
                          {selectedCenter}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-500">
                          Submitted
                        </p>
                        <p className="mt-1 text-base font-semibold text-slate-900">
                          {formatDate(record?.submitted_at)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-500">
                          Submitted By
                        </p>
                        <p className="mt-1 text-base font-semibold text-slate-900">
                          {record?.submitted_by_name || "Unknown user"}
                        </p>
                        {record?.submitted_by_email ? (
                          <p className="text-sm text-slate-500">
                            {record.submitted_by_email}
                          </p>
                        ) : null}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-500">
                          Visibility
                        </p>
                        <p className="mt-1 text-base font-semibold text-slate-900">
                          {record?.public_visible ? "Public" : "Private"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-500">
                          Year
                        </p>
                        <p className="mt-1 text-base font-semibold text-slate-900">
                          {record?.year || "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-500">
                          Status
                        </p>
                        <p className="mt-1 text-base font-semibold text-slate-900 capitalize">
                          {record?.status || "-"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="overflow-hidden rounded-2xl border border-slate-200/70 shadow-sm">
                    <CardHeader className="border-b border-[var(--border)] px-6 py-4">
                      <CardTitle className="text-base font-semibold text-slate-900">
                        Classification
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 p-5 text-base text-slate-700 sm:grid-cols-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-500">
                          Department
                        </p>
                        <p className="mt-1 text-base font-semibold text-slate-900">
                          {selectedDepartment}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-500">
                          Research Agenda
                        </p>
                        <p className="mt-1 text-base font-semibold text-slate-900">
                          {agendaLabel}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-500">
                          Classification
                        </p>
                        <p className="mt-1 text-base font-semibold text-slate-900">
                          {normalizeLabel(record?.classification)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-500">
                          Scholarly Type
                        </p>
                        <p className="mt-1 text-base font-semibold text-slate-900">
                          {record?.scholarly_type || "-"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="overflow-hidden rounded-2xl border border-slate-200/70 shadow-sm">
                    <CardHeader className="border-b border-[var(--border)] px-6 py-4">
                      <CardTitle className="text-base font-semibold text-slate-900">
                        People
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 p-5 text-base text-slate-700 sm:grid-cols-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-500">
                          Lead Researcher
                        </p>
                        <p className="mt-1 text-base font-semibold text-slate-900">
                          {record?.lead_researcher || "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-500">
                          Faculty Team
                        </p>
                        <p className="mt-1 text-base font-semibold text-slate-900">
                          {record?.faculty_team || "-"}
                        </p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-sm font-semibold text-slate-500">
                          Student Team
                        </p>
                        <p className="mt-1 whitespace-pre-line text-base text-slate-900">
                          {record?.student_team || "-"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-4">
                  <Card className="overflow-hidden rounded-2xl border border-slate-200/70 shadow-sm">
                    <CardHeader className="border-b border-[var(--border)] px-6 py-4">
                      <CardTitle className="text-base font-semibold text-slate-900">
                        Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-5 text-base text-slate-700">
                      <p className="whitespace-pre-line text-base font-semibold text-slate-900">
                        {record?.abstract || "No abstract available."}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="overflow-hidden rounded-2xl border border-slate-200/70 shadow-sm">
                    <CardHeader className="border-b border-[var(--border)] px-6 py-4">
                      <CardTitle className="text-base font-semibold text-slate-900">
                        Funding
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 p-5 text-base text-slate-700 sm:grid-cols-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-500">
                          Industry/Agency Partner
                        </p>
                        <p className="mt-1 text-base font-semibold text-slate-900">
                          {record?.industry_partner || "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-500">
                          Funding Type
                        </p>
                        <p className="mt-1 text-base font-semibold text-slate-900">
                          {normalizeLabel(record?.funding_type)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-500">
                          Funding Source
                        </p>
                        <p className="mt-1 text-base font-semibold text-slate-900">
                          {record?.funding_source || "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-500">
                          Funding Amount
                        </p>
                        <p className="mt-1 text-base font-semibold text-slate-900">
                          {formatCurrencyPHP(record?.funding_amount)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="overflow-hidden rounded-2xl border border-slate-200/70 shadow-sm">
                    <CardHeader className="border-b border-[var(--border)] px-6 py-4">
                      <CardTitle className="text-base font-semibold text-slate-900">
                        Timeline & MOA
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 p-5 text-base text-slate-700 sm:grid-cols-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-500">
                          Start Date
                        </p>
                        <p className="mt-1 text-base font-semibold text-slate-900">
                          {formatDate(record?.start_date)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-500">
                          End Date
                        </p>
                        <p className="mt-1 text-base font-semibold text-slate-900">
                          {formatDate(record?.end_date)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-500">
                          Supporting MOV Link
                        </p>
                        {record?.supporting_mov_link ? (
                          <a
                            className="mt-1 inline-flex items-center text-base font-semibold text-slate-900 underline-offset-4 hover:underline"
                            href={record.supporting_mov_link}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {record.supporting_mov_link}
                          </a>
                        ) : (
                          <p className="mt-1 whitespace-pre-line text-base text-slate-900">
                            -
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-500">
                          Signed MOA Reference
                        </p>
                        {(() => {
                          const moaReference = String(
                            record?.signed_moa_reference || "",
                          ).trim();
                          if (isHttpUrl(moaReference)) {
                            return (
                              <a
                                className="mt-1 inline-flex items-center text-base font-semibold text-slate-900 underline-offset-4 hover:underline"
                                href={moaReference}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {moaReference}
                              </a>
                            );
                          }
                          return (
                            <p className="mt-1 text-base font-semibold text-slate-900">
                              {moaReference}
                            </p>
                          );
                        })()}
                        {moaDownloadUrl ? (
                          <a
                            className="mt-2 inline-flex max-w-full items-center gap-2 truncate text-sm font-semibold text-slate-700 underline-offset-4 hover:text-slate-900 hover:underline"
                            href={moaDownloadUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Download className="h-4 w-4" />
                            {moaDownloadUrl}
                          </a>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <Card className="overflow-hidden">
                <CardHeader className="border-b border-[var(--border)] px-6 py-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="text-base font-semibold text-slate-900">
                        Linked Resources
                      </CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  {!resourcePanel.syncEnabled ? (
                    <p className="text-base text-slate-600">
                      CKAN sync is disabled in this environment.
                    </p>
                  ) : resourcePanel.loading ? (
                    <p className="text-base text-slate-600">
                      Loading linked resources...
                    </p>
                  ) : resourcePanel.error ? (
                    <p className="text-base text-red-700">
                      {resourcePanel.error}
                    </p>
                  ) : resourcePanel.resources.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] p-6 text-center text-base text-slate-600">
                      No linked resources found for this project.
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
                              className="rounded-2xl border border-slate-200/70 bg-white shadow-sm"
                            >
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-base font-semibold text-slate-900">
                                      {resource.name || "Unnamed resource"}
                                    </p>
                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-sm font-semibold text-emerald-700">
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
                                          <p className="text-base font-medium text-slate-800">
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
                                        <p className="text-base font-medium text-slate-800">
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
                                          className="text-blue-600 hover:underline"
                                        >
                                          {outputLink}
                                        </a>
                                      </p>
                                    ) : null}
                                  </div>
                                  <FileText className="h-5 w-5 text-slate-400" />
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
                                  <p className="mt-2 text-base text-slate-500">
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
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
