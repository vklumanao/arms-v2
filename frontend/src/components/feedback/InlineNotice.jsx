import { AlertCircle, CheckCircle2, Info } from "lucide-react";

const STYLE_MAP = {
  success: "notice-success",
  error: "notice-error",
  info: "notice-info",
};

const ICON_MAP = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

export default function InlineNotice({ type = "info", title, message }) {
  if (!message) return null;
  const styleClass = STYLE_MAP[type] || STYLE_MAP.info;
  const Icon = ICON_MAP[type] || ICON_MAP.info;

  return (
    <div className={`notice ${styleClass}`} role="status" aria-live="polite">
      <Icon size={16} className="notice-icon" />
      <div>
        {title ? <p className="notice-title">{title}</p> : null}
        <p className="notice-text">{message}</p>
      </div>
    </div>
  );
}

