import PageHeader from "@/shared/components/layout/PageHeader";
import EmptyState from "@/shared/components/feedback/EmptyState";

export default function AdminProgramDashboardPlaceholderPage({ title }) {
  return (
    <section className="page-stack-lg">
      <PageHeader
        title={title}
        description="Program-level dashboard module for admin users."
      />
      <EmptyState
        title="Under Development"
        description="This module is currently being built. Please check back soon."
      />
    </section>
  );
}


