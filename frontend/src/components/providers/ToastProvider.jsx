import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

const ToastContext = createContext(null);

const DEFAULT_DURATION = 4500;
const MAX_TOASTS = 5;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    ({
      type = "info",
      title = "",
      message = "",
      duration = DEFAULT_DURATION,
    }) => {
      const text = String(message || "").trim();
      if (!text) return;
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      setToasts((prev) => [
        ...prev.slice(-(MAX_TOASTS - 1)),
        {
          id,
          type,
          title: String(title || "").trim(),
          message: text,
        },
      ]);
      const lifetime =
        Number(duration) > 0 ? Number(duration) : DEFAULT_DURATION;
      window.setTimeout(() => dismiss(id), lifetime);
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({
      show: push,
      success: (title, message, options = {}) =>
        push({ type: "success", title, message, duration: options.duration }),
      error: (title, message, options = {}) =>
        push({ type: "error", title, message, duration: options.duration }),
      info: (title, message, options = {}) =>
        push({ type: "info", title, message, duration: options.duration }),
      dismiss,
    }),
    [dismiss, push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-4 z-[120] flex items-start justify-center px-3 sm:inset-x-auto sm:right-4 sm:top-4 sm:block sm:px-0"
      >
        <div className="flex w-full max-w-md flex-col gap-2">
          {toasts.map((toast) => {
            const tone =
              toast.type === "success"
                ? {
                    card: "border-zinc-300/70 bg-zinc-50/95 text-zinc-950",
                    icon: "bg-zinc-100 text-zinc-700",
                    label: "Success",
                    Icon: CheckCircle2,
                  }
                : toast.type === "error"
                  ? {
                      card: "border-zinc-300/70 bg-zinc-50/95 text-zinc-950",
                      icon: "bg-zinc-100 text-zinc-700",
                      label: "Error",
                      Icon: AlertTriangle,
                    }
                  : {
                      card: "border-zinc-300/70 bg-zinc-50/95 text-zinc-950",
                      icon: "bg-zinc-100 text-zinc-700",
                      label: "Info",
                      Icon: Info,
                    };
            return (
              <div
                key={toast.id}
                className={`pointer-events-auto rounded-xl border px-3 py-3 shadow-lg backdrop-blur-sm transition ${tone.card}`}
                role="status"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${tone.icon}`}
                  >
                    <tone.Icon size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] opacity-80">
                      {toast.title || tone.label}
                    </p>
                    <p className="mt-0.5 text-sm leading-snug">{toast.message}</p>
                  </div>
                  <button
                    type="button"
                    className="rounded-md px-2 py-1 text-xs font-semibold text-current/80 transition hover:bg-black/5 hover:text-current"
                    onClick={() => dismiss(toast.id)}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
