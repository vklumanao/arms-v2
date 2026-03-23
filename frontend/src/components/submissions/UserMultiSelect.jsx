import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function UserMultiSelect({
  label,
  headerVariant = "default",
  headerBadge,
  placeholder,
  searchValue,
  onSearchChange,
  dropdownOpen,
  setDropdownOpen,
  suggestions,
  onSelect,
  selections,
  onRemove,
  fieldRef,
  emptyText,
  helperText,
  allowMultiple = true,
  disabled = false,
  error,
}) {
  const headerIsCaps = headerVariant === "caps";
  return (
    <label className="block space-y-1 text-sm">
      {headerIsCaps ? (
        <div className="flex items-start justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            {label}
          </span>
          {headerBadge ? (
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10px] font-semibold text-slate-500">
              {headerBadge}
            </span>
          ) : null}
        </div>
      ) : (
        <span className="font-semibold text-slate-700">{label}</span>
      )}
      <div ref={fieldRef} className="relative space-y-2">
        <Input
          placeholder={placeholder}
          value={searchValue}
          className={error ? "input-error" : ""}
          disabled={disabled}
          onFocus={() =>
            disabled ? null : setDropdownOpen(Boolean(searchValue.trim()))
          }
          onChange={(e) => {
            if (disabled) return;
            onSearchChange(e.target.value);
            setDropdownOpen(Boolean(e.target.value.trim()));
          }}
          onKeyDown={(e) => {
            if (disabled) return;
            if (e.key === "Enter" && suggestions[0]) {
              e.preventDefault();
              onSelect(suggestions[0]);
              onSearchChange("");
              setDropdownOpen(false);
            }
          }}
        />
        {!disabled && dropdownOpen && suggestions.length > 0 ? (
          <div className="absolute z-10 max-h-56 w-full overflow-auto rounded-[var(--radius-sm)] border border-[var(--border)] bg-white p-1 shadow-sm">
            {suggestions.map((user) => (
              <button
                key={`user-option-${user.id}`}
                type="button"
                className="w-full rounded px-2 py-1 text-left text-sm text-slate-700 hover:bg-[var(--surface-muted)]"
                onClick={() => {
                  onSelect(user);
                  onSearchChange("");
                  setDropdownOpen(false);
                }}
              >
                {user.name}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <Card className="bg-muted/30 shadow-none">
        <CardContent className="p-3">
          {selections.length === 0 ? (
            <p className="text-xs text-slate-500">{emptyText}</p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {selections.map((name) => (
                <span
                  key={`user-chip-${name}`}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--brand-soft)] px-2 py-0.5 text-xs font-medium text-[var(--brand)]"
                >
                  {name}
                  <button
                    type="button"
                    className="text-[var(--brand)] hover:text-[var(--brand-strong)]"
                    onClick={() => onRemove(name)}
                    aria-label={`Remove ${name}`}
                    disabled={disabled}
                  >
                    x
                  </button>
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      {error ? <p className="field-error">{error}</p> : null}
      <p className="text-xs text-slate-500">{helperText}</p>
    </label>
  );
}
