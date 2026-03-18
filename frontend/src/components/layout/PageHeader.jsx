import { cn } from "@/utils/cn";

export default function PageHeader({ title, description, actions = null }) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        "page-header",
      )}
    >
      <div className="min-w-0">
        <h1 className="page-title">{title}</h1>
        {description ? (
          <p className="page-description">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
