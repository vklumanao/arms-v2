import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck } from "lucide-react";
import {
  aboutPillars,
  audienceCards,
  benefitsCards,
  brandPromiseCards,
  governanceCards,
  heroHighlights,
  heroSidebarCards,
  indicatorCards,
  moduleCards,
  roleCards,
  systemFramingCards,
  workflowSteps,
} from "./content";

function SectionIntro({ eyebrow, title, subtitle, inverted = false }) {
  const eyebrowClass = inverted ? "text-sky-200" : "text-slate-500";
  const titleClass = inverted ? "text-white" : "text-slate-900";
  const subtitleClass = inverted ? "text-slate-200" : "text-slate-600";

  return (
    <div>
      <p
        className={`text-xs font-semibold uppercase tracking-[0.14em] ${eyebrowClass}`}
      >
        {eyebrow}
      </p>
      <h2
        className={`mt-2 text-2xl font-black leading-tight sm:text-3xl ${titleClass}`}
      >
        {title}
      </h2>
      {subtitle ? (
        <p
          className={`mt-2 max-w-3xl text-sm leading-6 sm:text-base ${subtitleClass}`}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

export function HeroSection() {
  return (
    <section id="home" className="scroll-mt-28">
      <div className="relative overflow-hidden rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-cyan-50 p-6 sm:p-10">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-sky-200/45 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-56 w-56 rounded-full bg-cyan-200/35 blur-3xl" />

        <div className="relative z-10 grid gap-8 xl:grid-cols-[1.4fr_1fr]">
          <div className="page-stack-lg">
            <div className="w-full app-card app-card-compact">
              <img
                src="/arms-logo-v2.svg"
                alt="ARMS Logo"
                className="h-auto w-full object-contain"
              />
            </div>

            <h1 className="max-w-4xl text-3xl font-black leading-tight text-slate-900 sm:text-4xl lg:text-5xl">
              One Academic Platform for Affiliation, Review, Documentation, and
              Research Visibility
            </h1>

            <p className="max-w-3xl text-sm leading-6 text-slate-700 sm:text-base">
              ARMS streamlines research administration with structured
              submissions, role-based evaluation, MOV evidence management, and
              publication-ready records for institutional transparency.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                className="rounded-lg bg-sky-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-900"
                to="/submit-affiliation"
              >
                Start Submission
              </Link>
              <Link
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                to="/dashboard"
              >
                Open Dashboard
              </Link>
              <Link
                className="rounded-lg border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-800 transition hover:bg-sky-100"
                to="/public-records"
              >
                View Public Records
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {heroHighlights.map((item) => (
                <article
                  key={item.title}
                  className="app-card app-card-compact app-card-interactive"
                >
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {item.title}
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {item.description}
                  </p>
                </article>
              ))}
            </div>
          </div>

          <aside className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {heroSidebarCards.map((item) => (
              <article
                key={item.title}
                className="app-card app-card-interactive"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {item.title}
                </p>
                <h2 className="mt-2 text-lg font-black text-slate-900">
                  {item.heading}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {item.description}
                </p>
              </article>
            ))}
          </aside>
        </div>
      </div>
    </section>
  );
}

export function SystemFramingSection() {
  return (
    <section className="rounded-3xl border bg-white p-6 sm:p-8">
      <SectionIntro
        eyebrow="Institutional Context"
        title="Why ARMS Is Essential for Academic Operations"
      />
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {systemFramingCards.map((item) => (
          <article
            key={item.title}
            className="app-card-muted app-card"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">
              {item.title}
            </p>
            <h2 className="mt-2 text-lg font-black text-slate-900">
              {item.heading}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              {item.description}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function AudienceSection() {
  return (
    <section className="grid gap-4 md:grid-cols-3">
      {audienceCards.map((item, idx) => (
        <article
          key={item.heading}
          className="app-card app-card-interactive"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">
            Audience {idx + 1}
          </p>
          <h2 className="mt-2 text-lg font-black text-slate-900">
            {item.heading}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {item.description}
          </p>
        </article>
      ))}
    </section>
  );
}

export function WorkflowSection() {
  return (
    <section className="rounded-3xl border bg-white p-6 sm:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <SectionIntro
          eyebrow="Academic Workflow"
          title="Standardized Process from Submission to Public Output"
        />
        <Link to="/submit-affiliation" className="btn btn-primary">
          Open Research Projects
        </Link>
      </div>

      <ol className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {workflowSteps.map((item, index) => {
          const isLast = index === workflowSteps.length - 1;
          return (
            <li key={item.step} className="relative">
              <article className="h-full app-card app-card-interactive">
                <div className="mb-3 flex items-center justify-between">
                  <span className="inline-flex items-center rounded-full border border-sky-200 bg-white px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-sky-700">
                    Step {item.step}
                  </span>
                  <ShieldCheck size={16} className="text-sky-600" />
                </div>
                <p className="text-base font-black text-slate-900">
                  {item.title}
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {item.description}
                </p>
              </article>
              {!isLast ? (
                <span
                  className="absolute -right-2 top-1/2 hidden -translate-y-1/2 rounded-full border border-sky-200 bg-white p-1 text-sky-600 xl:inline-flex"
                  aria-hidden="true"
                >
                  <ArrowRight size={14} />
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function BenefitsSection() {
  return (
    <section className="rounded-3xl border bg-white p-6 sm:p-8">
      <SectionIntro
        eyebrow="Institutional Benefits"
        title="Value Beyond Basic Process Automation"
      />
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {benefitsCards.map((item) => (
          <article
            key={item.heading}
            className="app-card-muted app-card"
          >
            <h3 className="font-bold text-slate-900">{item.heading}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {item.description}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function BrandPromiseSection() {
  return (
    <section className="rounded-3xl border bg-gradient-to-r from-sky-900 to-cyan-800 p-6 text-white sm:p-8">
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-center">
        <SectionIntro
          eyebrow="Brand Promise"
          title="From Fragmented Tracking to Trusted, Data-Informed Research Governance"
          subtitle="ARMS unifies faculty, students, and administrators in one transparent platform built for academic rigor and institutional accountability."
          inverted
        />
        <div className="grid gap-3 sm:grid-cols-2">
          {brandPromiseCards.map((item) => (
            <article
              key={item.title}
              className="rounded-xl border border-white/20 bg-white/10 p-4"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-sky-100">
                {item.title}
              </p>
              <p className="mt-1 text-sm font-bold text-white">
                {item.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ModulesSection() {
  return (
    <section className="rounded-3xl border bg-white p-6 sm:p-8">
      <SectionIntro
        eyebrow="Core Modules"
        title="Built for Affiliation Management and Research Accountability"
      />
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {moduleCards.map((item) => (
          <article
            key={item.heading}
            className="app-card-muted app-card-compact"
          >
            <h3 className="font-bold text-slate-900">{item.heading}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {item.description}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function RolesSection() {
  return (
    <section className="rounded-3xl border bg-white p-6 sm:p-8">
      <SectionIntro
        eyebrow="Role Responsibilities"
        title="Clear Accountability Across the Academic Community"
      />
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {roleCards.map((item) => (
          <article
            key={item.heading}
            className="app-card app-card-interactive"
          >
            <h3 className="text-lg font-black text-slate-900">
              {item.heading}
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {item.description}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function GovernanceSection() {
  return (
    <section className="rounded-3xl border bg-gradient-to-br from-white to-slate-50 p-6 sm:p-8">
      <SectionIntro
        eyebrow="Governance Principles"
        title="Designed for Academic Integrity and Compliance"
      />
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {governanceCards.map((item) => (
          <article
            key={item.heading}
            className="app-card app-card-interactive"
          >
            <h3 className="font-bold text-slate-900">{item.heading}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {item.description}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function SuccessIndicatorsSection() {
  return (
    <section className="rounded-3xl border bg-gradient-to-br from-white via-sky-50 to-cyan-50 p-6 sm:p-8">
      <SectionIntro
        eyebrow="Success Indicators"
        title="What Effective ARMS Adoption Looks Like"
      />
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {indicatorCards.map((item) => (
          <article
            key={item.title}
            className="app-card app-card-interactive"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-sky-700">
              {item.title}
            </p>
            <p className="mt-2 text-sm font-bold text-slate-900">
              {item.description}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function VisionSection() {
  return (
    <section className="rounded-3xl border bg-white p-6 sm:p-8">
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-center">
        <SectionIntro
          eyebrow="Institutional Vision"
          title="A Research Culture Supported by Shared Systems and Standards"
          subtitle="ARMS enables better planning and better outcomes by making records, status, and workflows visible to the right stakeholders."
        />
        <div className="app-card-muted app-card">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Core Message
          </p>
          <p className="mt-2 text-lg font-black leading-snug text-slate-900">
            One platform. One process. One trusted source of research truth.
          </p>
        </div>
      </div>
    </section>
  );
}

export function AboutSection() {
  return (
    <section id="about" className="scroll-mt-28">
      <div className="rounded-3xl border bg-gradient-to-r from-slate-900 to-slate-800 p-6 text-white sm:p-8">
        <SectionIntro
          eyebrow="About ARMS"
          title="A Modern Academic Platform for Affiliation and Research Management"
          subtitle="ARMS supports governance, operational clarity, and evidence-driven monitoring by aligning processes with institutional responsibilities."
          inverted
        />
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {aboutPillars.map((item) => (
            <article
              key={item.heading}
              className="rounded-xl border border-white/20 bg-white/5 p-4"
            >
              <h3 className="font-bold">{item.heading}</h3>
              <p className="mt-1 text-sm text-slate-200">{item.description}</p>
            </article>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-white/20 bg-white/10 p-5">
          <h3 className="text-xl font-black">Expected Institutional Impact</h3>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            By centralizing data and process controls, ARMS reduces
            administrative friction, improves inter-unit coordination, and
            strengthens evidence for planning and accreditation.
          </p>
        </div>
      </div>
    </section>
  );
}

export function FinalCtaSection() {
  return (
    <section className="rounded-3xl border bg-gradient-to-r from-sky-800 to-cyan-700 p-6 text-white sm:p-8">
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-sky-100">
            Next Action
          </p>
          <h2 className="mt-2 text-2xl font-black text-white">
            Start Managing Affiliation and Research Records with Structure
          </h2>
          <p className="mt-2 text-sm leading-6 text-sky-100">
            Transition from manual tracking to a consistent, role-based research
            workflow for your unit.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 lg:justify-end">
          <Link
            to="/submit-affiliation"
            className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-sky-900 transition hover:bg-sky-50"
          >
            Research Projects
          </Link>
          <Link
            to="/login"
            className="rounded-lg border border-white/40 bg-transparent px-4 py-2 text-sm font-bold text-white transition hover:bg-white/10"
          >
            Login
          </Link>
        </div>
      </div>
    </section>
  );
}






