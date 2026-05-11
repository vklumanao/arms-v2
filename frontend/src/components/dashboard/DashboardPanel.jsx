import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/utils/cn";

export default function DashboardPanel({
  title,
  action = null,
  children,
  className = "",
  bodyClassName = "p-4 sm:p-5",
  cardClassName = "",
  headerClassName = "",
}) {
  return (
    <section className={className}>
      <Card className={cn("overflow-hidden", cardClassName)}>
        <CardHeader
          className={cn("border-b px-4 py-4 sm:px-5", headerClassName)}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <CardTitle className="text-sm font-bold uppercase tracking-[0.08em] text-zinc-500">
              {title}
            </CardTitle>
            {action ? <div className="text-sm">{action}</div> : null}
          </div>
        </CardHeader>
        <CardContent className={cn(bodyClassName)}>{children}</CardContent>
      </Card>
    </section>
  );
}
