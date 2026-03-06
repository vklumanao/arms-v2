import { useCallback, useEffect, useState } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { getOnboardingTourSteps } from "@/features/onboarding/config/tourSteps";

export function useOnboardingTour({ userId, role, profileLoading, pathname }) {
  const [tourRunning, setTourRunning] = useState(false);

  const getTourStateKey = useCallback(() => {
    if (!userId || !role) return null;
    return `arms_onboarding_seen_${userId}_${role}`;
  }, [role, userId]);

  const startOnboardingTour = useCallback(
    ({ required = false } = {}) => {
      if (!role || tourRunning) return;
      const steps = getOnboardingTourSteps(role).filter((step) =>
        document.querySelector(step.element),
      );
      if (steps.length === 0) return;

      setTourRunning(true);
      const tour = driver({
        showProgress: true,
        allowClose: !required,
        nextBtnText: "Next",
        prevBtnText: "Back",
        doneBtnText: "Done",
        onDestroyed: () => {
          const tourStateKey = getTourStateKey();
          if (tourStateKey) {
            window.localStorage.setItem(tourStateKey, "1");
          }
          setTourRunning(false);
        },
      });

      tour.setSteps(steps);
      tour.drive();
    },
    [getTourStateKey, role, tourRunning],
  );

  useEffect(() => {
    if (import.meta.env.MODE === "test") return;
    if (!userId || !role || profileLoading) return;

    const tourStateKey = getTourStateKey();
    if (!tourStateKey) return;
    const hasSeen = window.localStorage.getItem(tourStateKey) === "1";
    if (hasSeen) return;

    const timer = window.setTimeout(() => {
      startOnboardingTour({ required: true });
    }, 500);

    return () => window.clearTimeout(timer);
  }, [
    getTourStateKey,
    pathname,
    profileLoading,
    role,
    startOnboardingTour,
    userId,
  ]);

  return { tourRunning, startOnboardingTour };
}

