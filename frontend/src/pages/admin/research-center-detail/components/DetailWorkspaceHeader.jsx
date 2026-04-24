import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Building2,
  ChevronLeft,
  Facebook,
  FolderKanban,
  Globe,
  Instagram,
  Linkedin,
  Pencil,
  Trash2,
  Twitter,
  Users,
  Youtube,
} from "lucide-react";

const ICON_BY_KEY = {
  facebook: Facebook,
  instagram: Instagram,
  twitter: Twitter,
  linkedin: Linkedin,
  youtube: Youtube,
  website: Globe,
};

export default function DetailWorkspaceHeader({
  center,
  usage,
  initials,
  isCenterChief,
  loading,
  onBack,
  onEdit,
  onDelete,
  socialLink,
  socialMeta,
}) {
  const SocialIcon = ICON_BY_KEY[socialMeta?.iconKey] || Globe;

  return (
    <div className="rounded-2xl border border-blue-200/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(239,246,255,0.92))] p-4 shadow-[0_12px_32px_rgba(30,58,138,0.08)] backdrop-blur sm:p-5">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {!isCenterChief ? (
            <Button
              variant="outline"
              className="min-h-10 w-full border-slate-300 bg-white text-slate-900 hover:bg-blue-50 sm:w-auto"
              onClick={onBack}
            >
              <ChevronLeft className="h-4 w-4" />
              Back to Centers
            </Button>
          ) : (
            <span />
          )}

          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
            <Button
              variant="outline"
              className="min-h-10 border-slate-300 bg-white text-slate-900 hover:bg-blue-50"
              disabled={loading || !center}
              onClick={onEdit}
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
            <Button
              variant="mono"
              className="min-h-10 bg-[#1E3A8A] text-white hover:bg-[#1D4ED8]"
              disabled={loading || !center}
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-xl border border-blue-200/70 bg-white/80 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#1E3A8A] text-lg font-bold text-white">
              {initials}
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Research Center
              </p>
              <h1 className="break-words text-lg font-bold leading-tight text-[#1E3A8A] sm:text-2xl">
                {center?.name || "Research Center"}
              </h1>
              <p className="text-sm text-slate-600">
                <span className="font-mono font-semibold text-slate-800">
                  {center?.code || "-"}
                </span>
                {" - "}
                Chief:{" "}
                <span className="font-semibold">
                  {center?.centerChiefName || "-"}
                </span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Badge className="gap-1.5 border border-blue-200 bg-white text-[#1E3A8A]">
              <Users className="h-4 w-4" />
              {usage.profileCount} affiliates
            </Badge>
            <Badge className="gap-1.5 border border-blue-200 bg-white text-[#1E3A8A]">
              <FolderKanban className="h-4 w-4" />
              {usage.projectCount} projects
            </Badge>
            <Badge className="gap-1.5 border border-emerald-200 bg-emerald-50 text-emerald-700">
              <Building2 className="h-4 w-4" />
              {center?.agendaNames?.length || 0} agendas
            </Badge>

            {socialLink ? (
              <a
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition hover:bg-blue-50 hover:text-[#1E3A8A]"
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
