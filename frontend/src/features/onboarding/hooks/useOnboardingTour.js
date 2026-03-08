import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { getOnboardingTourSteps } from "@/features/onboarding/config";

const ONBOARDING_TOUR_VERSION = "v3";
const RESUME_DELAY_MS = 220;
const FIND_ELEMENT_RETRY_MS = 180;
const FIND_ELEMENT_MAX_ATTEMPTS = 20;

export function useOnboardingTour({ userId, role, profileLoading, pathname }) {
  const navigate = useNavigate();
  const [tourRunning, setTourRunning] = useState(false);
  const driverRef = useRef(null);
  const resumeTimerRef = useRef(null);
  const localStepIndexRef = useRef(-1);
  const transitioningRef = useRef(false);

  const getSeenKey = useCallback(() => {
    if (!userId || !role) return null;
    return `arms_onboarding_seen_${ONBOARDING_TOUR_VERSION}_${userId}_${role}`;
  }, [role, userId]);

  const getStateKey = useCallback(() => {
    if (!userId || !role) return null;
    return `arms_onboarding_state_${ONBOARDING_TOUR_VERSION}_${userId}_${role}`;
  }, [role, userId]);

  const setState = useCallback(
    (nextState) => {
      const key = getStateKey();
      if (!key) return;
      if (!nextState) {
        window.localStorage.removeItem(key);
        return;
      }
      window.localStorage.setItem(key, JSON.stringify(nextState));
    },
    [getStateKey],
  );

  const getState = useCallback(() => {
    const key = getStateKey();
    if (!key) return null;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.active !== true) return null;
      return {
        active: true,
        required: parsed.required === true,
        stepIndex: Math.max(0, Number(parsed.stepIndex || 0)),
      };
    } catch {
      return null;
    }
  }, [getStateKey]);

  const endTour = useCallback(
    ({ markSeen = true } = {}) => {
      if (resumeTimerRef.current) {
        window.clearTimeout(resumeTimerRef.current);
        resumeTimerRef.current = null;
      }
      if (driverRef.current) {
        try {
          driverRef.current.destroy();
        } catch {
          // no-op
        }
        driverRef.current = null;
      }
      localStepIndexRef.current = -1;
      setTourRunning(false);
      setState(null);
      if (markSeen) {
        const seenKey = getSeenKey();
        if (seenKey) window.localStorage.setItem(seenKey, "1");
      }
    },
    [getSeenKey, setState],
  );

  const stepExistsOnPage = useCallback((step) => {
    if (!step?.element) return false;
    return Boolean(document.querySelector(step.element));
  }, []);

  const findStepElementAsync = useCallback((step, onDone) => {
    let attempts = 0;
    const check = () => {
      attempts += 1;
      if (stepExistsOnPage(step)) {
        onDone(true);
        return;
      }
      if (attempts >= FIND_ELEMENT_MAX_ATTEMPTS) {
        onDone(false);
        return;
      }
      resumeTimerRef.current = window.setTimeout(check, FIND_ELEMENT_RETRY_MS);
    };
    check();
  }, [stepExistsOnPage]);

  const showStepByIndex = useCallback(
    (steps, index, required) => {
      if (!Array.isArray(steps) || index < 0 || index >= steps.length) {
        endTour({ markSeen: true });
        return;
      }

      const step = steps[index];
      const targetPath = String(step?.path || "").trim();
      const currentPath = String(pathname || "").trim();
      if (targetPath && currentPath !== targetPath) {
        setTourRunning(true);
        setState({ active: true, required, stepIndex: index });
        localStepIndexRef.current = index;
        navigate(targetPath);
        return;
      }

      findStepElementAsync(step, (exists) => {
        if (!exists) {
          showStepByIndex(steps, index + 1, required);
          return;
        }

        setTourRunning(true);
        setState({ active: true, required, stepIndex: index });
        localStepIndexRef.current = index;

        if (driverRef.current) {
          try {
            driverRef.current.destroy();
          } catch {
            // no-op
          }
          driverRef.current = null;
        }

        const tour = driver({
          showProgress: false,
          allowClose: !required,
          nextBtnText: "Next",
          prevBtnText: "Back",
          doneBtnText: "Done",
          onDestroyed: () => {
            driverRef.current = null;
            const state = getState();
            if (transitioningRef.current) return;
            if (state?.active) {
              endTour({ markSeen: !required });
              return;
            }
            setTourRunning(false);
          },
        });

        const stepWithHandlers = {
          ...step,
          popover: {
            ...step.popover,
            onNextClick: () => {
              transitioningRef.current = true;
              tour.destroy();
              showStepByIndex(steps, index + 1, required);
              window.setTimeout(() => {
                transitioningRef.current = false;
              }, 0);
            },
            onPrevClick: () => {
              transitioningRef.current = true;
              tour.destroy();
              if (index <= 0) {
                endTour({ markSeen: false });
                return;
              }
              showStepByIndex(steps, index - 1, required);
              window.setTimeout(() => {
                transitioningRef.current = false;
              }, 0);
            },
          },
        };

        tour.setSteps([stepWithHandlers]);
        driverRef.current = tour;
        tour.drive();
      });
    },
    [endTour, findStepElementAsync, getState, navigate, pathname, setState],
  );

  const startOnboardingTour = useCallback(
    ({ required = false } = {}) => {
      if (!role || tourRunning) return;
      const steps = getOnboardingTourSteps(role);
      if (!Array.isArray(steps) || steps.length === 0) return;
      showStepByIndex(steps, 0, required);
    },
    [role, showStepByIndex, tourRunning],
  );

  useEffect(() => {
    if (!role || profileLoading) return;
    const state = getState();
    if (!state?.active) return;
    const steps = getOnboardingTourSteps(role);
    if (!Array.isArray(steps) || steps.length === 0) return;
    if (localStepIndexRef.current === state.stepIndex && driverRef.current) {
      return;
    }
    resumeTimerRef.current = window.setTimeout(() => {
      showStepByIndex(steps, state.stepIndex, state.required);
    }, RESUME_DELAY_MS);
    return () => {
      if (resumeTimerRef.current) {
        window.clearTimeout(resumeTimerRef.current);
        resumeTimerRef.current = null;
      }
    };
  }, [getState, pathname, profileLoading, role, showStepByIndex]);

  useEffect(() => {
    if (import.meta.env.MODE === "test") return;
    if (!userId || !role || profileLoading) return;
    if (tourRunning) return;
    const state = getState();
    if (state?.active) return;

    const seenKey = getSeenKey();
    if (!seenKey) return;
    const hasSeen = window.localStorage.getItem(seenKey) === "1";
    if (hasSeen) return;

    const timer = window.setTimeout(() => {
      startOnboardingTour({ required: true });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [
    getSeenKey,
    getState,
    pathname,
    profileLoading,
    role,
    startOnboardingTour,
    tourRunning,
    userId,
  ]);

  useEffect(
    () => () => {
      if (resumeTimerRef.current) window.clearTimeout(resumeTimerRef.current);
      if (driverRef.current) {
        try {
          driverRef.current.destroy();
        } catch {
          // no-op
        }
      }
    },
    [],
  );

  return { tourRunning, startOnboardingTour };
}
