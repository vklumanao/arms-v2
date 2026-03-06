import { useEffect, useState } from "react";
import { Compass } from "lucide-react";

export default function OnboardingStartButton({ onStart, tourRunning }) {
  const [isCompact, setIsCompact] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(max-width: 767px)").matches
      : false,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const media = window.matchMedia("(max-width: 767px)");
    const handleChange = (event) => setIsCompact(Boolean(event.matches));
    setIsCompact(Boolean(media.matches));
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  const label = tourRunning ? "Tour Running..." : "Start Tour";

  return (
    <button
      id="onboarding-start-tour"
      type="button"
      className="btn btn-outline inline-flex items-center gap-1 px-2.5 sm:px-3"
      onClick={onStart}
      disabled={tourRunning}
      aria-label={label}
      title={isCompact ? label : undefined}
    >
      <Compass size={14} />
      {isCompact ? <span className="sr-only">{label}</span> : label}
    </button>
  );
}

