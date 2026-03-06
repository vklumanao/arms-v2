import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

const ToastContext = createContext(null);

const DEFAULT_DURATION = 4500;

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
        ...prev,
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
        className="pointer-events-none fixed right-4 top-4 z-[120] flex w-full max-w-sm flex-col gap-2"
      >
        {toasts.map((toast) => {
          const tone =
            toast.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : toast.type === "error"
                ? "border-rose-200 bg-rose-50 text-rose-900"
                : "border-sky-200 bg-sky-50 text-sky-900";
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto rounded-lg border p-3 shadow-lg ${tone}`}
              role="status"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  {toast.title ? (
                    <p className="text-sm font-semibold">{toast.title}</p>
                  ) : null}
                  <p className="text-sm">{toast.message}</p>
                </div>
                <button
                  type="button"
                  className="rounded px-1 text-xs font-semibold opacity-80 hover:opacity-100"
                  onClick={() => dismiss(toast.id)}
                >
                  Close
                </button>
              </div>
            </div>
          );
        })}
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

