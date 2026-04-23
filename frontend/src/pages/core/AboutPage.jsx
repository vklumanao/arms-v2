import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { aboutPillars } from "./home/content";

export default function AboutPage() {
  return (
    <section className="page-stack-xl">
      <header className="relative overflow-hidden rounded-3xl border border-zinc-100 bg-gradient-to-br from-zinc-50 via-white to-zinc-50 p-6 sm:p-10">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-zinc-200/45 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-56 w-56 rounded-full bg-zinc-200/35 blur-3xl" />

        <div className="relative z-10">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
            About CenterPulse
          </p>
          <h1 className="mt-2 max-w-4xl text-3xl font-black leading-tight text-zinc-900 sm:text-4xl">
            CenterPulse: Affiliation and Research Monitoring System
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-700 sm:text-base">
            CenterPulse centralizes affiliation records and research workflows
            so institutions can manage submissions, reviews, and outputs with
            consistent standards, visibility, and governance.
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-900"
              to="/projects"
            >
              Explore Projects
            </Link>
            <Link
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100"
              to="/public-records"
            >
              View Public Records
            </Link>
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        {aboutPillars.map((item) => (
          <Card
            key={item.heading}
            className="shadow-none transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <CardContent className="p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-700">
                {item.heading}
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                {item.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="rounded-3xl border bg-white p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
          Platform Scope
        </p>
        <h2 className="mt-2 text-2xl font-black leading-tight text-zinc-900 sm:text-3xl">
          Core Platform Capabilities
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[
            "Project, output, and award submission workflows",
            "Status visibility for reviews and approvals",
            "Role-aware access and permission controls",
            "Consistent records for institutional reporting",
          ].map((item) => (
            <Card key={item} className="bg-muted/30 shadow-none">
              <CardContent className="p-5">
                <p className="text-sm font-bold text-zinc-900">{item}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border bg-gradient-to-r from-zinc-800 to-zinc-700 p-6 text-white sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-100">
              Next Action
            </p>
            <h2 className="mt-2 text-2xl font-black text-white">
              Continue with CenterPulse
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-100">
              Access your account, create a new one, or browse public research
              records.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <Button asChild variant="outline">
              <Link to="/public-records">Public Records</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/register">Create Account</Link>
            </Button>
            <Button asChild>
              <Link to="/login">Login</Link>
            </Button>
          </div>
        </div>
      </section>
    </section>
  );
}
