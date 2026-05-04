import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function ReferenceCard({
  icon,
  title,
  subtitle,
  value,
  placeholder,
  onChange,
  onAdd,
  items,
  renderItem,
  className = "",
  listClassName = "",
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-zinc-500">
            Reference Data
          </p>
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-zinc-900">
            {icon}
            {title}
          </CardTitle>
          <p className="text-xs text-zinc-500">{subtitle}</p>
        </div>
        <Badge variant="outline">{items.length} items</Badge>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder={placeholder}
            value={value}
            onChange={onChange}
          />
          <Button className="sm:min-w-28" onClick={onAdd}>
            Add
          </Button>
        </div>

        <div
          className={`max-h-64 overflow-auto rounded-md border bg-muted/30 p-2 ${listClassName}`.trim()}
        >
          {items.length === 0 ? (
            <p className="px-2 py-3 text-sm text-zinc-500">
              No records yet. Add your first entry.
            </p>
          ) : (
            <ul className="space-y-1.5 text-sm text-zinc-700">
              {items.map(renderItem)}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
