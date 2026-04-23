import { Link, useNavigate } from "react-router-dom";
import HomePage from "./HomePage";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function AboutPage() {
  const navigate = useNavigate();

  const closeAbout = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/home", { replace: true });
  };

  return (
    <>
      <HomePage />
      <Dialog
        open
        onOpenChange={(nextOpen) => {
          if (!nextOpen) closeAbout();
        }}
      >
        <DialogContent className="w-[min(94vw,56rem)] max-w-4xl overflow-hidden rounded-[1.6rem] border-slate-200/80 bg-white p-0 sm:max-h-[88vh]">
          <div className="max-h-[88vh] overflow-y-auto">
            <DialogHeader className="border-b border-slate-200/80 bg-gradient-to-r from-[#1E3A8A] via-[#0e7490] to-[#0f766e] px-6 pb-6 pt-7 text-left text-white sm:px-8">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100/95">
                About ARMS
              </p>
              <DialogTitle className="mt-2 font-['Manrope'] text-2xl font-extrabold text-white sm:text-[2rem]">
                Affiliation and Research Management System
              </DialogTitle>
              <DialogDescription className="mt-2 max-w-3xl text-sm text-cyan-100/95">
                ARMS centralizes affiliation records and research workflows so institutions can track submissions, reviews, and outputs with consistency.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 px-6 py-6 sm:px-8">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <h3 className="text-sm font-bold text-slate-900">What It Solves</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Replaces fragmented spreadsheets and manual tracking with one unified system.
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <h3 className="text-sm font-bold text-slate-900">Who It Helps</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Students, faculty, research units, and administrators with role-based access.
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <h3 className="text-sm font-bold text-slate-900">Why It Matters</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Supports clearer governance, faster workflows, and better evidence for planning.
                  </p>
                </div>
              </div>

              <section className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5">
                <h3 className="font-['Manrope'] text-lg font-extrabold text-slate-900">
                  Core Platform Capabilities
                </h3>
                <ul className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                  <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    Project, output, and award submission workflows
                  </li>
                  <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    Status visibility for review and approvals
                  </li>
                  <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    Role-aware access and permission controls
                  </li>
                  <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    Consistent records for institutional reporting
                  </li>
                </ul>
              </section>
            </div>

            <DialogFooter className="flex items-center justify-between gap-2 border-t border-slate-200/80 bg-white px-6 py-4 sm:flex-row sm:px-8">
              <Button type="button" variant="outline" onClick={closeAbout}>
                Close
              </Button>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <Button asChild variant="outline" className="w-full sm:w-auto">
                  <Link to="/public-records">Public Records</Link>
                </Button>
                <Button asChild variant="outline" className="w-full sm:w-auto">
                  <Link to="/register">Create Account</Link>
                </Button>
                <Button asChild className="w-full sm:w-auto">
                  <Link to="/login">Login</Link>
                </Button>
              </div>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}


