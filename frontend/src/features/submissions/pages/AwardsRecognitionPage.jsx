import PageHeader from "@/shared/components/layout/PageHeader";
import EmptyState from "@/shared/components/feedback/EmptyState";

export default function AwardsRecognitionPage() {
  return (
    <section className="page-stack-lg">
      <PageHeader
        title="Awards and Recognition"
        description="Track and manage awards and recognitions related to your research work."
      />
      <EmptyState
        title="Under Development"
        description="This module is currently being built. Please check back soon."
      />
    </section>
  );
}


