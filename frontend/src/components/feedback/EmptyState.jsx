import { Card, CardContent } from "@/components/ui/card";

export default function EmptyState({ title, description }) {
  return (
    <Card>
      <CardContent className="p-6">
        <p className="text-sm font-semibold text-zinc-800">{title}</p>
        {description ? (
          <p className="mt-1 text-sm text-zinc-600">{description}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
