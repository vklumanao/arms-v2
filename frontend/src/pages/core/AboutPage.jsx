import { Link } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Eye,
  FileSpreadsheet,
  FolderKanban,
  Layers3,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const overviewCards = [
  {
    title: "Institutional Access",
    description:
      "Coordinate research records, affiliates, and submissions in one shared workspace.",
    icon: Building2,
  },
  {
    title: "Protected Workflow",
    description:
      "Keep review, approvals, and internal decisions visible only to the right roles.",
    icon: ShieldCheck,
  },
];

const capabilityCards = [
  {
    title: "Structured Records",
    description:
      "Standardize project details, outputs, affiliations, and supporting evidence in cleaner institutional forms.",
    icon: Layers3,
  },
  {
    title: "Role-Aware Review",
    description:
      "Guide records through visible review and approval steps so ownership stays clear at every stage.",
    icon: Users,
  },
  {
    title: "Reporting Readiness",
    description:
      "Maintain more dependable records for summaries, monitoring, and administrative reporting.",
    icon: FileSpreadsheet,
  },
  {
    title: "Public Visibility",
    description:
      "Publish approved scholarly records in a public-facing catalog without exposing workflow-only activity.",
    icon: Eye,
  },
];

const workflowSteps = [
  {
    step: "01",
    title: "Capture records",
    description:
      "Collect project details, affiliations, outputs, and supporting files in a standardized format.",
  },
  {
    step: "02",
    title: "Review and validate",
    description:
      "Route records through visible role-based checks so ownership and approvals remain clear.",
  },
  {
    step: "03",
    title: "Track progress",
    description:
      "Keep statuses, revisions, and supporting evidence aligned with institutional expectations.",
  },
  {
    step: "04",
    title: "Publish approved work",
    description:
      "Expose only ready and approved records to the public-facing research catalog.",
  },
];

const roleCards = [
  {
    title: "Administrators",
    description:
      "Oversee standards, access, and institution-wide research operations from one controlled environment.",
    icon: Building2,
  },
  {
    title: "Research Center Leads",
    description:
      "Monitor center activity, submissions, outputs, and affiliate participation with less fragmentation.",
    icon: Users,
  },
  {
    title: "Researchers and Affiliates",
    description:
      "Submit projects, maintain records, and keep approved work visible through a clearer institutional process.",
    icon: FolderKanban,
  },
];

const trustSignals = [
  "Role-based access aligned with research administration responsibilities",
  "Clear separation between internal workflow and public-facing records",
  "Cleaner data for reports, summaries, and oversight discussions",
  "A more dependable operating model for centers, departments, and affiliates",
];

export default function AboutPage() {
  const { user, profile } = useAuth();
  const isAuthenticated = Boolean(user || profile);

  return (
    <section>
      <div className="flex h-full items-center justify-center px-4 py-4 sm:px-6 lg:px-8">
        <Card className="w-full max-w-7xl overflow-hidden">
          <section className="relative overflow-hidden border-b border-slate-200 bg-[linear-gradient(145deg,#0f172a_0%,#134e4a_48%,#ecfdf5_160%)] px-6 py-6 text-white sm:px-8 sm:py-7 lg:px-10 lg:py-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18),transparent_28%),radial-gradient(circle_at_20%_80%,rgba(52,211,153,0.22),transparent_26%)]" />

            <div className="relative flex flex-col gap-6">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center bg-white/14">
                  <img
                    src="icon.svg"
                    alt="CenterPulse Logo"
                    className="h-24 w-24 object-contain"
                  />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-100/80">
                    About the Platform
                  </p>
                  <p className="text-xl font-semibold tracking-[0.08em] text-white">
                    CenterPULSE: Platform for University Logging of Scholarly
                    Engagements
                  </p>
                </div>
              </div>

              <div className="max-w-3xl space-y-3">
                <p className="text-sm font-medium uppercase tracking-[0.22em] text-emerald-100/80">
                  Research Management
                </p>
                <h1 className="text-3xl font-semibold leading-tight text-white sm:text-[2.4rem]">
                  One governed workspace for research operations and approved
                  public visibility.
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-slate-200 sm:text-[15px]">
                  CenterPULSE helps institutions manage submissions,
                  affiliations, outputs, and review workflows while preparing
                  approved scholarly records for wider institutional visibility.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:max-w-3xl">
                {overviewCards.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.title}
                      className="rounded-2xl border border-white/12 bg-white/10 p-4 backdrop-blur"
                    >
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/12 text-emerald-100">
                        <Icon size={18} />
                      </div>
                      <p className="text-sm font-semibold text-white">
                        {item.title}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-200">
                        {item.description}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-2xl border border-white/12 bg-black/10 p-4 backdrop-blur xl:max-w-3xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-100/80">
                  Platform Value
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-100">
                  Instead of disconnected spreadsheets and repeated manual
                  follow-ups, teams get one clearer workflow from submission to
                  publication-ready record.
                </p>
              </div>
            </div>
          </section>

          <div className="px-6 py-6 sm:px-8 sm:py-7 lg:px-10 lg:py-8">
            <div className="mx-auto w-full max-w-6xl space-y-5">
              <CardHeader className="space-y-4 px-0 pb-0 pt-0">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
                    Overview
                  </div>
                  <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
                    What CenterPULSE does
                  </h2>
                  <p className="max-w-3xl text-sm leading-6 text-slate-600">
                    CenterPULSE is built for institutions that need stronger
                    control over research administration, cleaner records for
                    reporting, and a safer way to present approved scholarly
                    outputs to the public.
                  </p>
                </div>
              </CardHeader>

              <CardContent className="space-y-5 px-0">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {capabilityCards.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.title}
                        className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 sm:p-5"
                      >
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-200 bg-white text-emerald-700 shadow-sm">
                          <Icon className="h-5 w-5" />
                        </div>
                        <h3 className="mt-4 text-lg font-semibold text-slate-900">
                          {item.title}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {item.description}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Workflow
                      </p>
                      <h3 className="text-xl font-semibold text-slate-900">
                        How records move through the platform
                      </h3>
                    </div>

                    <div className="mt-4 grid gap-3">
                      {workflowSteps.map((item) => (
                        <div
                          key={item.step}
                          className="rounded-2xl border border-white bg-white/90 p-4"
                        >
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                            Step {item.step}
                          </p>
                          <p className="mt-2 text-sm font-semibold text-slate-900">
                            {item.title}
                          </p>
                          <p className="mt-1 text-sm leading-6 text-slate-600">
                            {item.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Users
                        </p>
                        <h3 className="text-xl font-semibold text-slate-900">
                          Who the platform serves
                        </h3>
                      </div>

                      <div className="mt-4 grid gap-3">
                        {roleCards.map((item) => {
                          const Icon = item.icon;
                          return (
                            <div
                              key={item.title}
                              className="rounded-2xl border border-white bg-white/90 p-4"
                            >
                              <div className="flex items-start gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                                  <Icon className="h-5 w-5" />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">
                                    {item.title}
                                  </p>
                                  <p className="mt-1 text-sm leading-6 text-slate-600">
                                    {item.description}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Governance
                        </p>
                        <h3 className="text-xl font-semibold text-slate-900">
                          Why institutions can trust it
                        </h3>
                      </div>

                      <div className="mt-4 grid gap-3">
                        {trustSignals.map((item) => (
                          <div
                            key={item}
                            className="flex items-start gap-3 rounded-2xl border border-white bg-white/90 p-4"
                          >
                            <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                            <p className="text-sm leading-6 text-slate-700">
                              {item}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-[linear-gradient(145deg,#0f172a_0%,#134e4a_48%,#ecfdf5_160%)] p-5 text-white">
                  <div className="space-y-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-100/80">
                        Continue with CenterPULSE
                      </p>
                      <h3 className="mt-3 text-2xl font-semibold text-white">
                        Use the workspace for internal coordination or browse
                        the public catalog for approved records.
                      </h3>
                      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200">
                        Sign in to manage research operations, create an account
                        for access, or review public-facing scholarly records
                        already prepared for broader institutional visibility.
                      </p>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                      <Button
                        asChild
                        variant="outline"
                        className="border-white/20 bg-white/10 text-white hover:bg-white/20"
                      >
                        <Link to="/public-records">Public Records</Link>
                      </Button>
                      {!isAuthenticated ? (
                        <Button
                          asChild
                          variant="outline"
                          className="border-white/20 bg-white/10 text-white hover:bg-white/20"
                        >
                          <Link to="/register">Create Account</Link>
                        </Button>
                      ) : null}
                      <Button
                        asChild
                        className="border border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600"
                      >
                        <Link to={isAuthenticated ? "/dashboard" : "/login"}>
                          {isAuthenticated ? "Open Dashboard" : "Login"}
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
