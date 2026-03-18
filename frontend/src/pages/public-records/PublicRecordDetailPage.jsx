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
import { formatBytes, formatDate } from "@/utils/submissions";
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

export default function PublicRecordDetailPage() {
  const params = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const recordId = String(params?.id || "").trim();

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
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Public Record Detail
            </p>
            <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">
              {record?.title || "Research Project"}
            </h1>
            <p className="text-sm text-slate-600">
              Explore the published project record, citations, and linked
              resources from the public catalog.
            </p>
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

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200/70 bg-white/80 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Status
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-900 capitalize">
              {record?.status || "Published"}
            </p>
            <p className="mt-1 text-xs text-slate-500">Record status</p>
          </div>
          <div className="rounded-xl border border-slate-200/70 bg-white/80 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Visibility
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {record?.public_visible ? "Public" : "Private"}
            </p>
            <p className="mt-1 text-xs text-slate-500">Catalog access</p>
          </div>
          <div className="rounded-xl border border-slate-200/70 bg-white/80 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Year
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {record?.year || "-"}
            </p>
            <p className="mt-1 text-xs text-slate-500">Project cycle</p>
          </div>
          <div className="rounded-xl border border-slate-200/70 bg-white/80 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Research Center
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {selectedCenter}
            </p>
            <p className="mt-1 text-xs text-slate-500">Owning center</p>
          </div>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-[var(--border)] px-6 py-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold text-slate-900">
                Project Details
              </CardTitle>
              <CardDescription>
                Complete submission profile and classifications.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 p-6">
          {loading ? (
            <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] p-8 text-center text-sm text-slate-600">
              Loading record...
            </div>
          ) : !record ? (
            <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] p-8 text-center text-sm text-slate-600">
              Record not found. The public record you are looking for is
              unavailable.
            </div>
          ) : (
            <>
              <div className="grid gap-4 xl:grid-cols-[1fr_1.1fr]">
                <div className="space-y-4">
                  <Card className="overflow-hidden rounded-2xl border border-slate-200/70 shadow-sm">
                    <CardHeader className="border-b border-[var(--border)] px-6 py-4">
                      <CardTitle className="text-sm font-semibold text-slate-900">
                        Overview
                      </CardTitle>
                      <CardDescription>Submission metadata.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 p-5 text-sm text-slate-700 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold text-slate-500">
                          Research Center
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {selectedCenter}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500">
                          Submitted
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {formatDate(record?.submitted_at)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500">
                          Submitted By
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {record?.submitted_by_name || "Unknown user"}
                        </p>
                        {record?.submitted_by_email ? (
                          <p className="text-xs text-slate-500">
                            {record.submitted_by_email}
                          </p>
                        ) : null}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500">
                          Visibility
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {record?.public_visible ? "Public" : "Private"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500">
                          Year
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {record?.year || "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500">
                          Status
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900 capitalize">
                          {record?.status || "-"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="overflow-hidden rounded-2xl border border-slate-200/70 shadow-sm">
                    <CardHeader className="border-b border-[var(--border)] px-6 py-4">
                      <CardTitle className="text-sm font-semibold text-slate-900">
                        Classification
                      </CardTitle>
                      <CardDescription>
                        Program and agenda mapping.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 p-5 text-sm text-slate-700 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold text-slate-500">
                          Department
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {selectedDepartment}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500">
                          Research Agenda
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {agendaLabel}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500">
                          Classification
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {record?.classification || "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500">
                          Scholarly Type
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {record?.scholarly_type || "-"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="overflow-hidden rounded-2xl border border-slate-200/70 shadow-sm">
                    <CardHeader className="border-b border-[var(--border)] px-6 py-4">
                      <CardTitle className="text-sm font-semibold text-slate-900">
                        People
                      </CardTitle>
                      <CardDescription>
                        Research teams and participants.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 p-5 text-sm text-slate-700 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold text-slate-500">
                          Lead Researcher
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {record?.lead_researcher || "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500">
                          Faculty Team
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {record?.faculty_team || "-"}
                        </p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-xs font-semibold text-slate-500">
                          Student Team
                        </p>
                        <p className="mt-1 whitespace-pre-line text-sm text-slate-900">
                          {record?.student_team || "-"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-4">
                  <Card className="overflow-hidden rounded-2xl border border-slate-200/70 shadow-sm">
                    <CardHeader className="border-b border-[var(--border)] px-6 py-4">
                      <CardTitle className="text-sm font-semibold text-slate-900">
                        Abstract
                      </CardTitle>
                      <CardDescription>Project summary.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-5 text-sm text-slate-700">
                      <p className="whitespace-pre-line text-sm font-semibold text-slate-900">
                        {record?.abstract || "No abstract available."}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="overflow-hidden rounded-2xl border border-slate-200/70 shadow-sm">
                    <CardHeader className="border-b border-[var(--border)] px-6 py-4">
                      <CardTitle className="text-sm font-semibold text-slate-900">
                        Funding
                      </CardTitle>
                      <CardDescription>
                        Budget and funding sources.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 p-5 text-sm text-slate-700 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold text-slate-500">
                          Industry/Agency Partner
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {record?.industry_partner || "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500">
                          Funding Type
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {normalizeLabel(record?.funding_type)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500">
                          Funding Source
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {record?.funding_source || "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500">
                          Funding Amount
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {formatCurrencyPHP(record?.funding_amount)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="overflow-hidden rounded-2xl border border-slate-200/70 shadow-sm">
                    <CardHeader className="border-b border-[var(--border)] px-6 py-4">
                      <CardTitle className="text-sm font-semibold text-slate-900">
                        Timeline & MOA
                      </CardTitle>
                      <CardDescription>
                        Key dates and agreements.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 p-5 text-sm text-slate-700 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold text-slate-500">
                          Start Date
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {formatDate(record?.start_date)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500">
                          End Date
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {formatDate(record?.end_date)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500">
                          Supporting MOV Link
                        </p>
                        {record?.supporting_mov_link ? (
                          <a
                            className="mt-1 inline-flex items-center text-sm font-semibold text-slate-900 underline-offset-4 hover:underline"
                            href={record.supporting_mov_link}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {record.supporting_mov_link}
                          </a>
                        ) : (
                          <p className="mt-1 whitespace-pre-line text-sm text-slate-900">
                            -
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500">
                          Signed MOA Reference
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {record?.signed_moa_reference || "-"}
                        </p>
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
                    <p className="text-sm text-slate-600">
                      CKAN sync is disabled in this environment.
                    </p>
                  ) : resourcePanel.loading ? (
                    <p className="text-sm text-slate-600">
                      Loading linked resources...
                    </p>
                  ) : resourcePanel.error ? (
                    <p className="text-sm text-red-700">
                      {resourcePanel.error}
                    </p>
                  ) : resourcePanel.resources.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] p-6 text-center text-sm text-slate-600">
                      No linked resources found for this project.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      {resourcePanel.resources.map((resource) => {
                        const resourceUrl = String(resource.url || "").trim();
                        const isDownloadable =
                          /\/resource\/.+\/download\//i.test(resourceUrl);
                        const downloadUrl = resourceUrl
                          ? resourceUrl.includes("?")
                            ? `${resourceUrl}&download=1`
                            : `${resourceUrl}?download=1`
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
                                  <p className="text-sm text-slate-600">
                                    Format: {resource.format || "-"} | Size:{" "}
                                    {formatBytes(resource.size)} | Updated:{" "}
                                    {formatDate(
                                      resource.lastModified || resource.created,
                                    )}
                                  </p>
                                </div>
                                <FileText className="h-5 w-5 text-slate-400" />
                              </div>

                              {resourceUrl && isDownloadable ? (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <Button asChild variant="outline" size="sm">
                                    <a
                                      href={resourceUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      <ExternalLink className="h-4 w-4" />
                                      Open
                                    </a>
                                  </Button>
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
                              ) : (
                                <p className="mt-2 text-sm text-slate-500">
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
