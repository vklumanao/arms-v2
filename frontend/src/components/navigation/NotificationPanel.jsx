import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export default function NotificationPanel() {
  const { user } = useAuth();
  const [isCompact, setIsCompact] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 767px)").matches
      : false,
  );

  useEffect(() => {
    if (!user || typeof window === "undefined") return undefined;
    const media = window.matchMedia("(max-width: 767px)");
    const handleChange = (event) => setIsCompact(Boolean(event.matches));
    setIsCompact(Boolean(media.matches));
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [user]);

  if (!user) return null;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="inline-flex items-center gap-1 px-2.5 sm:px-3"
          aria-label="Open notifications panel"
        >
          <Bell size={14} />
          {isCompact ? (
            <span className="sr-only">Notifications</span>
          ) : (
            "Notifications"
          )}
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Notifications</SheetTitle>
          <SheetDescription>
            Updates about submissions, reviews, and account activity.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 rounded-lg border border-border bg-muted/30 p-4 text-sm text-slate-700">
          Real-time notifications are temporarily disabled in local backend mode.
        </div>

        <SheetFooter className="mt-6">
          <SheetClose asChild>
            <Button type="button" variant="outline">
              Close
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
