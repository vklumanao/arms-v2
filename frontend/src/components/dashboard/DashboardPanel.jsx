import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/utils/cn";

export default function DashboardPanel({
  title,
  children,
  className = "",
  bodyClassName = "p-5",
  cardClassName = "",
  headerClassName = "",
}) {
  return (
    <section className={className}>
      <Card className={cn("overflow-hidden", cardClassName)}>
        <CardHeader
          className={cn("border-b px-5 py-4", headerClassName)}
        >
          <CardTitle className="text-sm font-bold uppercase tracking-[0.08em] text-slate-500">
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className={cn(bodyClassName)}>{children}</CardContent>
      </Card>
    </section>
  );
}
