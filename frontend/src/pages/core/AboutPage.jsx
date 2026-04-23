import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { aboutPillars } from "./home/content";

export default function AboutPage() {
  return (
    <section className="page-stack-xl">
      <header className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-6 sm:p-10">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-56 w-56 rounded-full bg-accent/20 blur-3xl" />

        <div className="relative z-10">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            About CenterPulse
          </p>
          <h1 className="mt-2 max-w-4xl text-3xl font-black leading-tight text-primary sm:text-4xl">
            CenterPulse: Affiliation and Research Monitoring System
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
            CenterPulse centralizes affiliation records and research workflows
            so institutions can manage submissions, reviews, and outputs with
            consistent standards, visibility, and governance.
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
              to="/projects"
            >
              Explore Projects
            </Link>
            <Link
              className="rounded-lg border border-secondary bg-background px-4 py-2 text-sm font-semibold text-secondary transition hover:bg-secondary/10"
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
            className="shadow-none transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
          >
            <CardContent className="p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                {item.heading}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {item.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="rounded-3xl border border-border bg-card p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
          Platform Scope
        </p>
        <h2 className="mt-2 text-2xl font-black leading-tight text-primary sm:text-3xl">
          Core Platform Capabilities
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[
            "Project, output, and award submission workflows",
            "Status visibility for reviews and approvals",
            "Role-aware access and permission controls",
            "Consistent records for institutional reporting",
          ].map((item) => (
            <Card key={item} className="bg-secondary/10 shadow-none">
              <CardContent className="p-5">
                <p className="text-sm font-bold text-primary">{item}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-gradient-to-r from-primary to-secondary p-6 text-primary-foreground sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary-foreground/85">
              Next Action
            </p>
            <h2 className="mt-2 text-2xl font-black text-primary-foreground">
              Continue with CenterPulse
            </h2>
            <p className="mt-2 text-sm leading-6 text-primary-foreground/85">
              Access your account, create a new one, or browse public research
              records.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <Button
              asChild
              variant="outline"
              className="border-primary-foreground/40 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20"
            >
              <Link to="/public-records">Public Records</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-primary-foreground/40 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20"
            >
              <Link to="/register">Create Account</Link>
            </Button>
            <Button
              asChild
              className="border border-accent bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <Link to="/login">Login</Link>
            </Button>
          </div>
        </div>
      </section>
    </section>
  );
}
