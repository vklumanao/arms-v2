import { Badge } from "@/components/ui/badge";
import { CardDescription, CardTitle } from "@/components/ui/card";
import { Building2, FolderKanban, Users } from "lucide-react";

export default function ResearchCenterHeroHeader({
  center,
  initials,
  usage,
  socialLink,
  socialMeta,
  SocialIcon,
}) {
  return (
    <div className="flex flex-col gap-5 rounded-[var(--radius-lg)] border border-slate-200 bg-white p-6 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-5">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#10B981] text-lg font-bold uppercase text-white">
          {initials}
        </div>

        <div className="space-y-2">
          <CardTitle className="text-xl font-bold text-[#1E293B]">
            {center?.name || "Research Center"}
          </CardTitle>

          <CardDescription className="text-sm text-slate-600">
            Code:{" "}
            <span className="font-mono font-semibold text-slate-800">
              {center?.code || "-"}
            </span>
            {" - "}
            Center Chief:{" "}
            <span className="font-semibold text-slate-800">
              {center?.centerChiefName || "-"}
            </span>
          </CardDescription>

          <div className="flex flex-wrap gap-3">
            <Badge className="gap-2 text-sm px-3 py-1.5 bg-emerald-50 text-[#1E293B] border border-slate-200">
              <Users className="h-5 w-5" />
              {usage.profileCount} affiliates
            </Badge>

            <Badge className="gap-2 text-sm px-3 py-1.5 bg-emerald-50 text-[#1E293B] border border-slate-200">
              <FolderKanban className="h-5 w-5" />
              {usage.projectCount} projects
            </Badge>

            <Badge className="gap-2 text-sm px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Building2 className="h-5 w-5" />
              {center?.agendaNames?.length || 0} agenda
            </Badge>

            {socialLink ? (
              <a
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50 hover:text-[#1E293B]"
                href={socialLink}
                target="_blank"
                rel="noreferrer"
                title={socialMeta?.label || "Open link"}
                aria-label={socialMeta?.label || "Open link"}
              >
                <SocialIcon className="h-5 w-5" />
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
