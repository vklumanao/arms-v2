import { Card, CardContent } from "@/components/ui/card";

export default function UnauthorizedPage() {
  return (
    <section className="mx-auto max-w-xl">
      <Card>
        <CardContent className="p-6">
          <h1 className="text-2xl font-bold">Unauthorized</h1>
          <p className="mt-2 text-slate-700">
            You do not have permission to access this page.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
