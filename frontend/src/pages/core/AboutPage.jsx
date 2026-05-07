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
import { Card, CardContent } from "@/components/ui/card";

const audienceCards = [
  {
    title: "Administrators",
    description:
      "Oversee research centers, affiliates, access control, and reporting standards from one workspace.",
    icon: Building2,
  },
  {
    title: "Research Center Leads",
    description:
      "Monitor center performance, member activity, projects, and agenda coverage without scattered records.",
    icon: Users,
  },
  {
    title: "Researchers and Affiliates",
    description:
      "Submit projects, manage outputs, and keep research activity visible through structured workflows.",
    icon: FolderKanban,
  },
];

const capabilityCards = [
  {
    title: "Submission Workflows",
    description:
      "Guide projects, outputs, and recognition records through one consistent institutional process.",
    icon: Layers3,
  },
  {
    title: "Governance Controls",
    description:
      "Use role-aware permissions, review visibility, and accountable actions across core modules.",
    icon: ShieldCheck,
  },
  {
    title: "Reporting Readiness",
    description:
      "Keep cleaner data for summaries, compliance checks, and institution-wide research reporting.",
    icon: FileSpreadsheet,
  },
  {
    title: "Public Visibility",
    description:
      "Surface approved research records in a public-facing catalog without exposing internal workflow noise.",
    icon: Eye,
  },
];

const timelineSteps = [
  {
    step: "01",
    title: "Capture structured records",
    description:
      "Collect affiliations, project metadata, outputs, and evidence in standardized forms.",
  },
  {
    step: "02",
    title: "Review with role clarity",
    description:
      "Make ownership and approval paths visible so records move with less ambiguity.",
  },
  {
    step: "03",
    title: "Track status and evidence",
    description:
      "Keep progress, outputs, and supporting files aligned with institutional expectations.",
  },
  {
    step: "04",
    title: "Publish what is ready",
    description:
      "Expose approved records to the public catalog while preserving internal controls.",
  },
];

const trustSignals = [
  "Role-based access aligned with research administration responsibilities",
  "Structured records that reduce reporting gaps and repeated follow-ups",
  "Public and private visibility controls for institution-safe publishing",
  "A clearer operating model for departments, centers, and affiliates",
];

export default function AboutPage() {
  const { user, profile } = useAuth();
  const isAuthenticated = Boolean(user || profile);

  return (
    <section className="page-stack-xl">
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.16),transparent_32%),linear-gradient(180deg,rgba(248,250,252,0.92),rgba(255,255,255,1))]" />
        <div className="relative grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] lg:p-10">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">
              <Sparkles className="h-3.5 w-3.5" />
              About CenterPulse
            </div>

            <div className="space-y-3">
              <h1 className="max-w-4xl text-slate-900">
                A research operations platform built for institutional clarity,
                accountability, and visibility.
              </h1>
              <p className="max-w-3xl text-[15px] leading-7 text-slate-600 lg:text-base">
                CenterPulse helps institutions organize affiliations, research
                submissions, outputs, and public-ready records in one governed
                system. Instead of fragmented spreadsheets and disconnected
                follow-ups, teams get one structured workflow from submission to
                reporting.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button asChild className="sm:w-auto">
                <Link to={isAuthenticated ? "/dashboard" : "/login"}>
                  {isAuthenticated ? "Open Dashboard" : "Login to Workspace"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="sm:w-auto">
                <Link to="/public-records">Explore Public Records</Link>
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: "Core Coverage", value: "Projects, outputs, awards" },
                { label: "Governance Lens", value: "Role-aware actions" },
                {
                  label: "Institution Value",
                  value: "Reporting-ready records",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm"
                >
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                    {item.label}
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-800">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 self-stretch">
            <div className="rounded-[1.75rem] border border-slate-200 bg-slate-950 p-5 text-white shadow-lg">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-300">
                Research Operations Snapshot
              </p>
              <div className="mt-4 space-y-3">
                {[
                  [
                    "Affiliation Records",
                    "Structured across centers and departments",
                  ],
                  ["Submission Workflow", "Tracked from encoding to approval"],
                  ["Output Visibility", "Ready for governance and publication"],
                ].map(([title, copy]) => (
                  <div
                    key={title}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4"
                  >
                    <p className="text-sm font-semibold text-white">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-300">
                      {copy}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-emerald-200 bg-emerald-50 p-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">
                Why it matters
              </p>
              <p className="mt-3 text-sm leading-7 text-slate-700">
                When records are standardized and workflow states are visible,
                institutions spend less time reconciling data and more time
                improving research performance.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {audienceCards.map((item) => {
          const Icon = item.icon;
          return (
            <Card
              key={item.title}
              className="border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
            >
              <CardContent className="p-5 lg:p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="mt-4 text-xl font-bold text-slate-900">
                  {item.title}
                </h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  {item.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-5 rounded-[2rem] border border-slate-200 bg-white p-4 sm:p-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:p-8">
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
            What CenterPulse Solves
          </p>
          <h2 className="text-slate-900">
            From fragmented research records to one dependable operating system.
          </h2>
          <p className="text-sm leading-7 text-slate-600">
            The platform is designed for teams that need better control over
            project submissions, affiliate data, output tracking, and public
            transparency without losing institutional rigor.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {capabilityCards.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-900 shadow-sm">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-bold text-slate-900">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="rounded-[2rem] border border-slate-200 bg-slate-950 p-5 text-white sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
            Platform Flow
          </p>
          <h2 className="mt-3 text-white">
            A cleaner path from submission to publication-ready record.
          </h2>
          <div className="mt-6 grid gap-4">
            {timelineSteps.map((item) => (
              <div
                key={item.step}
                className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4"
              >
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-300">
                  Step {item.step}
                </p>
                <p className="mt-2 text-base font-semibold text-white">
                  {item.title}
                </p>
                <p className="mt-2 text-sm leading-7 text-slate-300">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
            Governance and Trust
          </p>
          <h2 className="mt-3 text-slate-900">
            Built for visibility without sacrificing control.
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            CenterPulse is not just a submission form. It is a governed research
            workspace where institutions can define ownership, reduce ambiguity,
            and keep public-facing records separate from internal workflow
            decisions.
          </p>

          <div className="mt-6 grid gap-3">
            {trustSignals.map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <p className="text-sm leading-7 text-slate-700">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#111827_55%,#1f2937_100%)] p-5 text-white sm:p-6 lg:p-8">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_auto] lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
              Next Step
            </p>
            <h2 className="mt-3 text-white">
              Continue with CenterPulse in the way that fits your role.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
              Open your dashboard, sign in to your workspace, register a new
              account, or review public research records already approved for
              institutional visibility.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap lg:justify-end">
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
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </section>
  );
}
