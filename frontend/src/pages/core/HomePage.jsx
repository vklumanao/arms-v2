import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicRecordsPage } from "@/pages/public-records";

export default function HomePage() {
  return (
    <div className="page-stack-xl">
      <section
        id="home"
        className="scroll-mt-24 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm sm:scroll-mt-28 sm:p-6 lg:p-8"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">
              <Sparkles className="h-3.5 w-3.5" />
              Research Visibility
            </div>
            <div className="space-y-2">
              <h1 className="text-slate-900">
                Explore the institution&apos;s public research records in a
                mobile-first catalog.
              </h1>
              <p className="max-w-3xl text-[15px] leading-7 text-slate-600 md:text-base">
                Start with approved public records, browse by research center,
                and move into deeper institutional context as the screen gets
                larger.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap lg:justify-end">
            <Button asChild variant="outline">
              <Link to="/about">About CenterPulse</Link>
            </Button>
            <Button asChild>
              <Link to="/public-records">
                Open Full Catalog
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="scroll-mt-24 sm:scroll-mt-28">
        <PublicRecordsPage />
      </section>
    </div>
  );
}
