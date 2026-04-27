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

  return (
    <section className="page-stack-lg">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline">
          <Link to="/public-records">
            <ChevronLeft className="h-4 w-4" />
            Back to Catalog
          </Link>
        </Button>
        {!recordId ? (
          <Button variant="ghost" onClick={() => navigate("/public-records")}>
            Return
          </Button>
        ) : null}
      </div>
      <div className="rounded-2xl border border-border bg-card from-muted via-card to-muted p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground md:text-3xl">
              {record?.title || "Research Project"}
            </h1>
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

          <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
            {record?.public_visible ? "Public" : "Private"}
          </span>

          <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
            {formatProjectDuration(record?.start_date, record?.end_date)}
          </span>

          <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
            {selectedCenter}
          </span>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-[var(--border)] px-6 py-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold text-foreground">
                Project Details
              </CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 p-6">
          {loading ? (
            <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] p-8 text-center text-base text-muted-foreground">
              Loading record...
            </div>
          ) : !record ? (
            <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] p-8 text-center text-base text-muted-foreground">
              Record not found. The public record you are looking for is
              unavailable.
            </div>
          ) : (
            <>
              <div className="grid gap-4 xl:grid-cols-[1fr_1.1fr]">
                <div className="space-y-4">
                  <Card className="overflow-hidden rounded-2xl border border-border shadow-sm">
                    <CardHeader className="border-b border-[var(--border)] px-6 py-4">
                      <CardTitle className="text-base font-semibold text-foreground">
                        Overview
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 p-5 text-base text-muted-foreground sm:grid-cols-2">
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground">
                          Research Center
                        </p>
                        <p className="mt-1 text-base font-semibold text-foreground">
                          {selectedCenter}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground">
                          Submitted
                        </p>
                        <p className="mt-1 text-base font-semibold text-foreground">
                          {formatDate(record?.submitted_at)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground">
                          Submitted By
                        </p>
                        <p className="mt-1 text-base font-semibold text-foreground">
                          {record?.submitted_by_name || "Unknown user"}
                        </p>
                        {record?.submitted_by_email ? (
                          <p className="text-sm text-muted-foreground">
                            {record.submitted_by_email}
                          </p>
                        ) : null}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground">
                          Visibility
                        </p>
                        <p className="mt-1 text-base font-semibold text-foreground">
                          {record?.public_visible ? "Public" : "Private"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground">
                          Year
                        </p>
                        <p className="mt-1 text-base font-semibold text-foreground">
                          {record?.year || "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground">
                          Status
                        </p>
                        <p className="mt-1 text-base font-semibold text-foreground capitalize">
                          {record?.status || "-"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="overflow-hidden rounded-2xl border border-border shadow-sm">
                    <CardHeader className="border-b border-[var(--border)] px-6 py-4">
                      <CardTitle className="text-base font-semibold text-foreground">
                        Classification
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 p-5 text-base text-muted-foreground sm:grid-cols-2">
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground">
                          Department
                        </p>
                        <p className="mt-1 text-base font-semibold text-foreground">
                          {selectedDepartment}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground">
                          Research Agenda
                        </p>
                        <p className="mt-1 text-base font-semibold text-foreground">
                          {agendaLabel}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground">
                          Classification
                        </p>
                        <p className="mt-1 text-base font-semibold text-foreground">
                          {normalizeLabel(record?.classification)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="overflow-hidden rounded-2xl border border-border shadow-sm">
                    <CardHeader className="border-b border-[var(--border)] px-6 py-4">
                      <CardTitle className="text-base font-semibold text-foreground">
                        People
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 p-5 text-base text-muted-foreground sm:grid-cols-2">
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground">
                          Lead Researcher
                        </p>
                        <p className="mt-1 text-base font-semibold text-foreground">
                          {record?.lead_researcher || "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground">
                          Faculty Team
                        </p>
                        <p className="mt-1 text-base font-semibold text-foreground">
                          {record?.faculty_team || "-"}
                        </p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-sm font-semibold text-muted-foreground">
                          Student Team
                        </p>
                        <p className="mt-1 whitespace-pre-line text-base text-foreground">
                          {record?.student_team || "-"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-4">
                  <Card className="overflow-hidden rounded-2xl border border-border shadow-sm">
                    <CardHeader className="border-b border-[var(--border)] px-6 py-4">
                      <CardTitle className="text-base font-semibold text-foreground">
                        Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-5 text-base text-muted-foreground">
                      <p className="whitespace-pre-line text-base font-semibold text-foreground">
                        {record?.abstract || "No abstract available."}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="overflow-hidden rounded-2xl border border-border shadow-sm">
                    <CardHeader className="border-b border-[var(--border)] px-6 py-4">
                      <CardTitle className="text-base font-semibold text-foreground">
                        Funding
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 p-5 text-base text-muted-foreground sm:grid-cols-2">
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground">
                          Industry/Agency Partner
                        </p>
                        <p className="mt-1 text-base font-semibold text-foreground">
                          {record?.industry_partner || "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground">
                          Funding Type
                        </p>
                        <p className="mt-1 text-base font-semibold text-foreground">
                          {normalizeLabel(record?.funding_type)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground">
                          Funding Source
                        </p>
                        <p className="mt-1 text-base font-semibold text-foreground">
                          {record?.funding_source || "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground">
                          Funding Amount
                        </p>
                        <p className="mt-1 text-base font-semibold text-foreground">
                          {formatCurrencyPHP(record?.funding_amount)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="overflow-hidden rounded-2xl border border-border shadow-sm">
                    <CardHeader className="border-b border-[var(--border)] px-6 py-4">
                      <CardTitle className="text-base font-semibold text-foreground">
                        Timeline & MOA
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 p-5 text-base text-muted-foreground sm:grid-cols-2">
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground">
                          Start Date
                        </p>
                        <p className="mt-1 text-base font-semibold text-foreground">
                          {formatDate(record?.start_date)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground">
                          End Date
                        </p>
                        <p className="mt-1 text-base font-semibold text-foreground">
                          {formatDate(record?.end_date)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground">
                          Supporting MOV Link
                        </p>
                        {record?.supporting_mov_link ? (
                          <a
                            className="mt-1 inline-flex items-center text-base font-semibold text-foreground underline-offset-4 hover:underline"
                            href={record.supporting_mov_link}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {record.supporting_mov_link}
                          </a>
                        ) : (
                          <p className="mt-1 whitespace-pre-line text-base text-foreground">
                            -
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground">
                          {" "}
                          Signed MOA
                        </p>
                        {(() => {
                          const moaReference = String(
                            record?.signed_moa_reference || "",
                          ).trim();
                          if (isHttpUrl(moaReference)) {
                            return (
                              <a
                                className="mt-1 inline-flex items-center text-base font-semibold text-foreground underline-offset-4 hover:underline"
                                href={moaReference}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {moaReference}
                              </a>
                            );
                          }
                          return (
                            <p className="mt-1 text-base font-semibold text-foreground">
                              {moaReference}
                            </p>
                          );
                        })()}
                        {moaDownloadUrl ? (
                          <div className="mt-2 flex flex-wrap gap-2">
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
                      <CardTitle className="text-base font-semibold text-foreground">
                        Outputs
                      </CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  {!resourcePanel.syncEnabled ? (
                    <p className="text-base text-muted-foreground">
                      CKAN sync is disabled in this environment.
                    </p>
                  ) : resourcePanel.loading ? (
                    <p className="text-base text-muted-foreground">
                      Loading linked resources...
                    </p>
                  ) : resourcePanel.error ? (
                    <p className="text-base text-muted-foreground">
                      {resourcePanel.error}
                    </p>
                  ) : resourcePanel.resources.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] p-6 text-center text-base text-muted-foreground">
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
                              className="rounded-2xl border border-border bg-card shadow-sm"
                            >
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-base font-semibold text-foreground">
                                      {resource.name || "Unnamed resource"}
                                    </p>
                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                      <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-sm font-semibold text-muted-foreground">
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
                                          <p className="text-base font-medium text-foreground">
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
                                        <p className="text-base font-medium text-foreground">
                                          Proponents: {fromDescription}
                                        </p>
                                      );
                                    })()}
                                    <p className="text-base text-muted-foreground">
                                      Format: {resource.format || "-"} | Size:{" "}
                                      {formatBytes(resource.size)}
                                    </p>
                                    {hasLink ? (
                                      <p className="text-base text-muted-foreground">
                                        Output Link:{" "}
                                        <a
                                          href={outputLink}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="text-muted-foreground hover:underline"
                                        >
                                          {outputLink}
                                        </a>
                                      </p>
                                    ) : null}
                                  </div>
                                  <FileText className="h-5 w-5 text-muted-foreground" />
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
                                  <p className="mt-2 text-base text-muted-foreground">
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
              <Card className="overflow-hidden">
                <CardHeader className="border-b border-[var(--border)] px-6 py-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="text-base font-semibold text-foreground">
                        Awards &amp; Recognition
                      </CardTitle>
                      <CardDescription>
                        Awards linked to this project.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  {awardsPanel.loading ? (
                    <p className="text-base text-muted-foreground">
                      Loading linked awards...
                    </p>
                  ) : awardsPanel.error ? (
                    <p className="text-base text-muted-foreground">
                      {awardsPanel.error}
                    </p>
                  ) : awardsPanel.rows.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] p-6 text-center text-base text-muted-foreground">
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
                            className="rounded-2xl border border-border bg-card shadow-sm"
                          >
                            <CardContent className="p-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-base font-semibold text-foreground">
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
                                  <p className="mt-2 text-base text-muted-foreground">
                                    Awarding body: {row.awarding_body || "-"}
                                  </p>
                                  <p className="text-base text-muted-foreground">
                                    Recipients: {row.recipients || "-"}
                                  </p>
                                </div>
                                <Trophy className="h-5 w-5 text-muted-foreground" />
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
        </CardContent>
      </Card>
    </section>
  );
}

