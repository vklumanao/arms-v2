import EmptyState from "@/components/feedback/EmptyState";
import ConfirmActionModal from "@/components/feedback/ConfirmActionModal";
import {
  DetailWorkspaceHeader,
  DetailWorkspaceRail,
  DetailWorkspaceTabs,
  ProjectsPanel,
  AffiliatesPanel,
  ScorecardsPanel,
  EditResearchCenterDrawer,
  DeleteResearchCenterDialog,
} from "./research-center-detail/components/ResearchCenterDetailPanels";
import useAdminResearchCenterDetailWorkspace from "./research-center-detail/hooks/useAdminResearchCenterDetailWorkspace";
import { useNavigate } from "react-router-dom";

export default function AdminResearchCenterDetailPage() {
  const navigate = useNavigate();
  const {
    PAGE_SIZE,
    isCenterChief,
    loading,
    error,
    center,
    chiefUsers,
    usage,
    activeTab,
    setTab,
    clearProjectFilters,
    applyAgendaFilter,
    affiliatesPage,
    setAffiliatesPage,
    affiliatesTotalPages,
    paginatedAffiliates,
    projectsPage,
    setProjectsPage,
    projectsTotalPages,
    links,
    filteredProjects,
    paginatedProjects,
    agendaFilter,
    setAgendaFilter,
    projectSearch,
    setProjectSearch,
    projectStatus,
    setProjectStatus,
    projectStatusOptions,
    projectYear,
    setProjectYear,
    projectYearOptions,
    editOpen,
    setEditOpen,
    editSaving,
    editForm,
    updateEditForm,
    addEditAgenda,
    removeEditAgenda,
    editErrors,
    isEditValid,
    saveCenter,
    unlinkTarget,
    setUnlinkTarget,
    unlinkAffiliate,
    unlinkAffiliateSaving,
    deleteDialogOpen,
    setDeleteDialogOpen,
    deleteGuard,
    deleting,
    deleteCenter,
    goToProject,
    statusBadgeClass,
    initials,
    socialLink,
    socialMeta,
  } = useAdminResearchCenterDetailWorkspace();

  const showProjects = activeTab === "projects";
  const showAffiliates = activeTab === "affiliates";

  return (
    <section className="page-stack-lg pb-16 md:pb-8">
      <DetailWorkspaceHeader
        center={center}
        usage={usage}
        initials={initials}
        isCenterChief={isCenterChief}
        loading={loading}
        socialLink={socialLink}
        socialMeta={socialMeta}
        onBack={() => {
          clearProjectFilters();
          navigate("/admin/research-center");
        }}
        onEdit={() => setEditOpen(true)}
        onDelete={() => setDeleteDialogOpen(true)}
      />

      <div className="space-y-5">
        {loading ? (
          <div className="rounded-xl border border-slate-300 bg-white p-6 text-sm text-slate-600">
            Loading research center...
          </div>
        ) : error ? (
          <EmptyState title="Unable to load" description={error} />
        ) : !center ? (
          <EmptyState
            title="Research center not found"
            description="The requested research center could not be found or you do not have access."
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)] xl:gap-5">
            <DetailWorkspaceRail
              center={center}
              agendaFilter={agendaFilter}
              onAgendaClick={applyAgendaFilter}
            />

            <div className="space-y-3 sm:space-y-4">
              <DetailWorkspaceTabs activeTab={activeTab} onTabChange={setTab} />

              {showProjects ? (
                <ProjectsPanel
                  links={links}
                  filteredProjects={filteredProjects}
                  paginatedProjects={paginatedProjects}
                  projectsPage={projectsPage}
                  projectsTotalPages={projectsTotalPages}
                  pageSize={PAGE_SIZE}
                  agendaFilter={agendaFilter}
                  setAgendaFilter={setAgendaFilter}
                  projectSearch={projectSearch}
                  setProjectSearch={setProjectSearch}
                  projectStatus={projectStatus}
                  setProjectStatus={setProjectStatus}
                  projectStatusOptions={projectStatusOptions}
                  projectYear={projectYear}
                  setProjectYear={setProjectYear}
                  projectYearOptions={projectYearOptions}
                  clearProjectFilters={clearProjectFilters}
                  onPageChange={setProjectsPage}
                  statusBadgeClass={statusBadgeClass}
                  goToProject={goToProject}
                  loading={loading}
                />
              ) : showAffiliates ? (
                <AffiliatesPanel
                  links={links}
                  center={center}
                  paginatedAffiliates={paginatedAffiliates}
                  affiliatesPage={affiliatesPage}
                  affiliatesTotalPages={affiliatesTotalPages}
                  pageSize={PAGE_SIZE}
                  onPageChange={setAffiliatesPage}
                  onUnlink={setUnlinkTarget}
                  loading={loading}
                />
              ) : (
                <ScorecardsPanel
                  center={center}
                  isCenterChief={isCenterChief}
                />
              )}
            </div>
          </div>
        )}
      </div>

      <EditResearchCenterDrawer
        open={editOpen}
        onOpenChange={setEditOpen}
        editForm={editForm}
        updateEditForm={updateEditForm}
        editErrors={editErrors}
        isEditValid={isEditValid}
        chiefUsers={chiefUsers}
        addEditAgenda={addEditAgenda}
        removeEditAgenda={removeEditAgenda}
        saveCenter={saveCenter}
        editSaving={editSaving}
      />

      <DeleteResearchCenterDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        deleteGuard={deleteGuard}
        deleting={deleting}
        onDelete={deleteCenter}
        onGoToProjects={() => {
          setTab("projects");
          setDeleteDialogOpen(false);
        }}
        onGoToAffiliates={() => {
          setTab("affiliates");
          setDeleteDialogOpen(false);
        }}
      />

      <ConfirmActionModal
        open={Boolean(unlinkTarget)}
        title="Unlink Affiliate"
        message={`Remove "${unlinkTarget?.full_name || unlinkTarget?.email || unlinkTarget?.id || "this affiliate"}" from this research center?`}
        confirmLabel="Unlink"
        loading={unlinkAffiliateSaving}
        onCancel={() => setUnlinkTarget(null)}
        onConfirm={unlinkAffiliate}
      />
    </section>
  );
}

