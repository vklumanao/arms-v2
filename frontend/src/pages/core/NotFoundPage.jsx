import { Card, CardContent } from "@/components/ui/card";

export default function NotFoundPage() {
  return (
    <section className="mx-auto max-w-xl">
      <Card>
        <CardContent className="p-6">
          <h1 className="text-2xl font-bold">Page Not Found</h1>
          <p className="mt-2 text-zinc-700">
            The requested route does not exist.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
