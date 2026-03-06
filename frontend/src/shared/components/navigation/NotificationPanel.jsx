import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useAuth } from "@/app/providers/AuthProvider";

export default function NotificationPanel() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [isCompact, setIsCompact] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 767px)").matches
      : false,
  );

  if (!user) return null;

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const handleChange = (event) => setIsCompact(Boolean(event.matches));
    setIsCompact(Boolean(media.matches));
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  return (
    <div className="relative">
      <button
        type="button"
        className="btn btn-outline inline-flex items-center gap-1 px-2.5 sm:px-3"
        aria-label="Open notifications panel"
        onClick={() => setOpen((prev) => !prev)}
      >
        <Bell size={14} />
        {isCompact ? (
          <span className="sr-only">Notifications</span>
        ) : (
          "Notifications"
        )}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="false"
          className="absolute right-0 z-30 mt-2 w-[min(22rem,calc(100vw-1rem))] rounded-[var(--radius-md)] border border-[var(--border)] bg-white p-3 shadow-xl"
        >
          <p className="text-sm font-semibold text-slate-900">Notifications</p>
          <p className="mt-2 text-sm text-slate-600">
            Real-time notifications are temporarily disabled in local backend
            mode.
          </p>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

