import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/shared/components/layout/PageHeader";
import ConfirmActionModal from "@/shared/components/feedback/ConfirmActionModal";
import { ReferenceCard } from "@/features/admin/components";
import { logAdminActivity } from "@/features/admin/utils";
import {
  buildReferenceLabelById,
  getRefMeta,
  getReassignEntityLabel,
} from "@/features/admin/utils";
import {
  createReference,
  deleteReference,
  fetchReferenceData,
  fetchReferenceUsageCounts,
  reassignDependencies,
  updateReference,
} from "@/features/admin/services";
import {
  PERMISSIONS,
  PERMISSION_LABELS,
  ROLE_LABELS,
  getRolePermissionMap,
  resetRolePermissionMapToDefaults,
  saveRolePermissionMap,
  syncRolePermissionMapFromServer,
} from "@/shared/auth/permissions";
import {
  AlertCircle,
  BookOpen,
  Building2,
  Check,
  CheckCircle2,
  FolderTree,
  Pencil,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react";

export default function AdminControlsPage() {
  const [centers, setCenters] = useState([]);
  const [agendas, setAgendas] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [proponents, setProponents] = useState([]);
  const [form, setForm] = useState({
    center: "",
    agenda: "",
    department: "",
    proponent: "",
  });
  const [feedback, setFeedback] = useState(null);
  const [editingRef, setEditingRef] = useState({
    type: null,
    id: null,
    value: "",
  });
  const [savingRefByKey, setSavingRefByKey] = useState({});
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [reassign, setReassign] = useState({
    entity: "center",
    fromId: "",
    toId: "",
  });
  const [reassignResult, setReassignResult] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [permissionDraft, setPermissionDraft] = useState(() =>
    getRolePermissionMap(),
  );

  const showSuccess = (text) => {
    setFeedback({ type: "success", text });
    window.clearTimeout(window.__armsAdminControlsFeedbackTimer);
    window.__armsAdminControlsFeedbackTimer = window.setTimeout(() => {
      setFeedback(null);
    }, 8000);
  };

  const showError = (text) => {
    setFeedback({ type: "error", text });
    window.clearTimeout(window.__armsAdminControlsFeedbackTimer);
    window.__armsAdminControlsFeedbackTimer = window.setTimeout(() => {
      setFeedback(null);
    }, 13000);
  };

  const load = async () => {
    const { centersRes, agendasRes, departmentsRes, proponentsRes } =
      await fetchReferenceData({});
    setCenters(centersRes.data || []);
    setAgendas(agendasRes.data || []);
    setDepartments(departmentsRes.data || []);
    setProponents(proponentsRes.data || []);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    let active = true;
    syncRolePermissionMapFromServer()
      .then((nextMap) => {
        if (active) setPermissionDraft(nextMap);
      })
      .catch((error) => {
        if (!active) return;
        showError(
          error.message || "Failed to load centralized role permissions.",
        );
      });

    return () => {
      active = false;
    };
  }, []);

  const roleKeys = useMemo(() => Object.keys(ROLE_LABELS), []);
  const permissionKeys = useMemo(() => Object.values(PERMISSIONS), []);

  const createCenter = async (confirmed = false) => {
    setFeedback(null);
    const name = form.center.trim();
    if (!name) {
      showError("Research center name is required.");
      return;
    }
    if (name.length < 2) {
      showError("Research center name must be at least 2 characters.");
      return;
    }
    if (!confirmed) {
      setConfirmAction({
        type: "create_center",
        title: "Confirm Create Center",
        message: `Create research center "${name}"?`,
        confirmLabel: "Create",
      });
      return;
    }
    const { error: insertError } = await createReference({
      type: "center",
      name,
    });
    if (insertError) {
      showError(insertError.message);
      return;
    }
    void logAdminActivity("reference_created", "research_center", null, {
      name,
    });
    setForm((p) => ({ ...p, center: "" }));
    showSuccess("Research center added successfully.");
    load();
  };

  const createAgenda = async (confirmed = false) => {
    setFeedback(null);
    const name = form.agenda.trim();
    if (!name) {
      showError("Research agenda name is required.");
      return;
    }
    if (name.length < 2) {
      showError("Research agenda name must be at least 2 characters.");
      return;
    }
    if (!confirmed) {
      setConfirmAction({
        type: "create_agenda",
        title: "Confirm Create Agenda",
        message: `Create research agenda "${name}"?`,
        confirmLabel: "Create",
      });
      return;
    }
    const { error: insertError } = await createReference({
      type: "agenda",
      name,
    });
    if (insertError) {
      showError(insertError.message);
      return;
    }
    void logAdminActivity("reference_created", "research_agenda", null, {
      name,
    });
    setForm((p) => ({ ...p, agenda: "" }));
    showSuccess("Research agenda added successfully.");
    load();
  };

  const createDepartment = async (confirmed = false) => {
    setFeedback(null);
    const name = form.department.trim();
    if (!name) {
      showError("Department name is required.");
      return;
    }
    if (name.length < 2) {
      showError("Department name must be at least 2 characters.");
      return;
    }
    if (!confirmed) {
      setConfirmAction({
        type: "create_department",
        title: "Confirm Create Department",
        message: `Create department "${name}"?`,
        confirmLabel: "Create",
      });
      return;
    }
    const { error: insertError } = await createReference({
      type: "department",
      name,
    });
    if (insertError) {
      showError(insertError.message);
      return;
    }
    void logAdminActivity("reference_created", "department", null, { name });
    setForm((p) => ({ ...p, department: "" }));
    showSuccess("Department added successfully.");
    load();
  };

  const createProponent = async (confirmed = false) => {
    setFeedback(null);
    const name = form.proponent.trim();
    if (!name) {
      showError("Proponent name is required.");
      return;
    }
    if (name.length < 2) {
      showError("Proponent name must be at least 2 characters.");
      return;
    }
    if (!confirmed) {
      setConfirmAction({
        type: "create_proponent",
        title: "Confirm Create Proponent",
        message: `Create proponent "${name}"?`,
        confirmLabel: "Create",
      });
      return;
    }
    const { error: insertError } = await createReference({
      type: "proponent",
      name,
    });
    if (insertError) {
      showError(insertError.message);
      return;
    }
    void logAdminActivity("reference_created", "proponent", null, { name });
    setForm((p) => ({ ...p, proponent: "" }));
    showSuccess("Proponent added successfully.");
    load();
  };

  const getSetRowsByType = (type) => {
    if (type === "center") return setCenters;
    if (type === "agenda") return setAgendas;
    if (type === "proponent") return setProponents;
    return setDepartments;
  };

  const startEditRef = (type, row) => {
    setEditingRef({ type, id: row.id, value: row.name || "" });
  };

  const cancelEditRef = () => {
    setEditingRef({ type: null, id: null, value: "" });
  };

  const saveEditRef = async (confirmed = false) => {
    setFeedback(null);
    const nextName = editingRef.value.trim();
    if (!editingRef.id || !editingRef.type || !nextName) {
      showError("Name is required.");
      return;
    }
    if (nextName.length < 2) {
      showError("Name must be at least 2 characters.");
      return;
    }
    if (!confirmed) {
      setConfirmAction({
        type: "save_edit_ref",
        title: "Confirm Update",
        message: `Save changes to "${nextName}"?`,
        confirmLabel: "Save Changes",
      });
      return;
    }

    const { label, entity } = getRefMeta(editingRef.type);
    const setRows = getSetRowsByType(editingRef.type);
    const key = `${editingRef.type}:${editingRef.id}`;
    setSavingRefByKey((prev) => ({ ...prev, [key]: true }));

    const { data, error: updateError } = await updateReference({
      type: editingRef.type,
      id: editingRef.id,
      name: nextName,
    });

    if (updateError) {
      showError(
        updateError.message || `Failed to update ${label.toLowerCase()}.`,
      );
      setSavingRefByKey((prev) => ({ ...prev, [key]: false }));
      return;
    }
    if (!data) {
      showError(`No ${label.toLowerCase()} row was updated.`);
      setSavingRefByKey((prev) => ({ ...prev, [key]: false }));
      return;
    }

    setRows((prev) =>
      prev.map((row) => (row.id === data.id ? { ...row, ...data } : row)),
    );
    void logAdminActivity("reference_updated", entity, data.id, {
      name: data.name,
    });
    setSavingRefByKey((prev) => ({ ...prev, [key]: false }));
    showSuccess(`${label} updated successfully.`);
    cancelEditRef();
  };

  const askDeleteRef = (type, row) => {
    if (!row?.id) return;
    const { label } = getRefMeta(type);
    setDeleteDialog({
      type,
      row,
      title: `Delete ${label}?`,
      text: `This will permanently remove "${row.name}" from the ${label.toLowerCase()} list.`,
      loading: true,
      projectCount: 0,
      profileCount: 0,
    });

    const loadLinkedCounts = async () => {
      const { projectCount, profileCount } = await fetchReferenceUsageCounts({
        type,
        id: row.id,
      });

      setDeleteDialog((prev) => {
        if (!prev || prev.type !== type || prev.row?.id !== row.id) return prev;
        return { ...prev, loading: false, projectCount, profileCount };
      });
    };

    loadLinkedCounts();
  };

  const deleteRef = async (type, row) => {
    setFeedback(null);
    if (!row?.id) return;

    const { label, entity } = getRefMeta(type);
    const setRows = getSetRowsByType(type);
    const key = `${type}:${row.id}`;

    setSavingRefByKey((prev) => ({ ...prev, [key]: true }));
    const { error: deleteError } = await deleteReference({
      type,
      id: row.id,
    });

    if (deleteError) {
      const isReferenceConflict =
        deleteError.code === "23503" ||
        deleteError.code === "409" ||
        /foreign key|constraint|reference/i.test(deleteError.message || "");
      if (isReferenceConflict) {
        showError(
          `${label} cannot be deleted because it is still in use by existing records (such as linked projects or users). Reassign those records first, then try again.`,
        );
      } else {
        showError(
          deleteError.message ||
            `Failed to delete ${label.toLowerCase()}. It may still be in use.`,
        );
      }
      setSavingRefByKey((prev) => ({ ...prev, [key]: false }));
      return;
    }

    setRows((prev) => prev.filter((item) => item.id !== row.id));
    void logAdminActivity("reference_deleted", entity, row.id, {
      name: row.name,
    });
    setSavingRefByKey((prev) => ({ ...prev, [key]: false }));
    showSuccess(`${label} deleted successfully.`);
    if (editingRef.type === type && editingRef.id === row.id) {
      cancelEditRef();
    }
    setDeleteDialog(null);
  };

  const referenceOptions = useMemo(() => {
    if (reassign.entity === "center") return centers;
    if (reassign.entity === "agenda") return agendas;
    return departments;
  }, [reassign.entity, centers, agendas, departments]);

  const referenceLabelById = useMemo(() => {
    return buildReferenceLabelById({
      centers,
      agendas,
      departments,
      proponents,
    });
  }, [centers, agendas, departments, proponents]);

  const reassignEntityLabel = getReassignEntityLabel(
    reassignResult?.entity_type,
  );

  const runReassignDependencies = async (confirmed = false) => {
    setFeedback(null);
    setReassignResult(null);
    if (!reassign.fromId || !reassign.toId) {
      showError("Select both From and To records for reassignment.");
      return;
    }
    if (reassign.fromId === reassign.toId) {
      showError("From and To records must be different.");
      return;
    }
    if (!confirmed) {
      setConfirmAction({
        type: "reassign_dependencies",
        title: "Confirm Reassignment",
        message:
          "Proceed with dependency reassignment? This updates linked records.",
        confirmLabel: "Proceed",
      });
      return;
    }

    const { data, error: rpcError } = await reassignDependencies({
      entity: reassign.entity,
      fromId: reassign.fromId,
      toId: reassign.toId,
    });

    if (rpcError) {
      showError(rpcError.message || "Dependency reassignment failed.");
      return;
    }

    setReassignResult(data || {});
    showSuccess("Dependencies reassigned successfully.");
    await load();
  };

  const executeConfirmAction = async () => {
    if (!confirmAction) return;
    setConfirmLoading(true);
    try {
      if (confirmAction.type === "create_center") {
        await createCenter(true);
      } else if (confirmAction.type === "create_agenda") {
        await createAgenda(true);
      } else if (confirmAction.type === "create_department") {
        await createDepartment(true);
      } else if (confirmAction.type === "create_proponent") {
        await createProponent(true);
      } else if (confirmAction.type === "save_permissions") {
        await saveRolePermissionMap(permissionDraft);
        void logAdminActivity("permissions_updated", "role_permissions", null, {
          permission_map: permissionDraft,
        });
        showSuccess("Roles and permissions updated.");
      } else if (confirmAction.type === "reset_permissions") {
        const next = await resetRolePermissionMapToDefaults();
        setPermissionDraft(next);
        void logAdminActivity(
          "permissions_reset",
          "role_permissions",
          null,
          {},
        );
        showSuccess("Roles and permissions reset to defaults.");
      } else if (confirmAction.type === "save_edit_ref") {
        await saveEditRef(true);
      } else if (confirmAction.type === "reassign_dependencies") {
        await runReassignDependencies(true);
      }
      setConfirmAction(null);
    } catch (error) {
      showError(error.message || "Action failed.");
    } finally {
      setConfirmLoading(false);
    }
  };

  const togglePermissionForRole = (role, permission, checked) => {
    setPermissionDraft((prev) => {
      const current = new Set(prev[role] || []);
      if (checked) {
        current.add(permission);
      } else {
        current.delete(permission);
      }
      return {
        ...prev,
        [role]: [...current],
      };
    });
  };

  const setPermissionsForRole = (role, nextPermissions) => {
    setPermissionDraft((prev) => ({
      ...prev,
      [role]: [...nextPermissions],
    }));
  };

  const savePermissions = () => {
    setConfirmAction({
      type: "save_permissions",
      title: "Confirm Permission Update",
      message:
        "Apply these role-permission changes? This will take effect immediately.",
      confirmLabel: "Apply Changes",
    });
  };

  const resetPermissions = () => {
    setConfirmAction({
      type: "reset_permissions",
      title: "Reset Permissions",
      message:
        "Reset all role permissions to default values? This cannot be undone.",
      confirmLabel: "Reset",
    });
  };

  return (
    <section className="page-stack-lg">
      <PageHeader
        title="Admin Controls"
        description="Manage reference entities and dependency reassignment workflows."
      />
      {feedback ? (
        <div
          className={`rounded-[var(--radius-sm)] border px-3 py-2 text-sm ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              {feedback.type === "success" ? (
                <CheckCircle2 size={16} className="mt-0.5" />
              ) : (
                <AlertCircle size={16} className="mt-0.5" />
              )}
              <div>
                <p className="font-semibold">
                  {feedback.type === "success"
                    ? "Action completed"
                    : "Action failed"}
                </p>
                <p>{feedback.text}</p>
              </div>
            </div>
            <button
              className="text-current/70 hover:text-current"
              onClick={() => setFeedback(null)}
              aria-label="Dismiss notification"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <ReferenceCard
          icon={<Building2 size={18} />}
          title="Research Centers"
          subtitle="Maintain official centers used in submissions and reporting."
          value={form.center}
          placeholder="e.g. Center for Data Science"
          onChange={(e) => setForm((p) => ({ ...p, center: e.target.value }))}
          onAdd={createCenter}
          items={centers}
          renderItem={(center) => (
            <li
              key={center.id}
              className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[var(--border)] bg-white px-3 py-2"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {editingRef.type === "center" && editingRef.id === center.id ? (
                  <input
                    className="control-input h-9"
                    value={editingRef.value}
                    onChange={(e) =>
                      setEditingRef((prev) => ({
                        ...prev,
                        value: e.target.value,
                      }))
                    }
                  />
                ) : (
                  <>
                    <span className="truncate font-medium">{center.name}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                      {center.code}
                    </span>
                  </>
                )}
              </div>
              <div className="ml-3 flex items-center gap-1">
                {editingRef.type === "center" && editingRef.id === center.id ? (
                  <>
                    <button
                      className="btn btn-outline px-2"
                      disabled={Boolean(savingRefByKey[`center:${center.id}`])}
                      onClick={saveEditRef}
                    >
                      <Check size={14} />
                    </button>
                    <button
                      className="btn btn-outline px-2"
                      onClick={cancelEditRef}
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="btn btn-outline px-2"
                      disabled={Boolean(savingRefByKey[`center:${center.id}`])}
                      onClick={() => startEditRef("center", center)}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className="btn btn-outline px-2 text-red-700 hover:bg-red-50"
                      disabled={Boolean(savingRefByKey[`center:${center.id}`])}
                      onClick={() => askDeleteRef("center", center)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </li>
          )}
        />

        <ReferenceCard
          icon={<BookOpen size={18} />}
          title="Research Agendas"
          subtitle="Standardize agenda categories for project classification."
          value={form.agenda}
          placeholder="e.g. AI for Education"
          onChange={(e) => setForm((p) => ({ ...p, agenda: e.target.value }))}
          onAdd={createAgenda}
          items={agendas}
          renderItem={(agenda) => (
            <li
              key={agenda.id}
              className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[var(--border)] bg-white px-3 py-2"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {editingRef.type === "agenda" && editingRef.id === agenda.id ? (
                  <input
                    className="control-input h-9"
                    value={editingRef.value}
                    onChange={(e) =>
                      setEditingRef((prev) => ({
                        ...prev,
                        value: e.target.value,
                      }))
                    }
                  />
                ) : (
                  <span className="truncate font-medium">{agenda.name}</span>
                )}
              </div>
              <div className="ml-3 flex items-center gap-1">
                {editingRef.type === "agenda" && editingRef.id === agenda.id ? (
                  <>
                    <button
                      className="btn btn-outline px-2"
                      disabled={Boolean(savingRefByKey[`agenda:${agenda.id}`])}
                      onClick={saveEditRef}
                    >
                      <Check size={14} />
                    </button>
                    <button
                      className="btn btn-outline px-2"
                      onClick={cancelEditRef}
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="btn btn-outline px-2"
                      disabled={Boolean(savingRefByKey[`agenda:${agenda.id}`])}
                      onClick={() => startEditRef("agenda", agenda)}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className="btn btn-outline px-2 text-red-700 hover:bg-red-50"
                      disabled={Boolean(savingRefByKey[`agenda:${agenda.id}`])}
                      onClick={() => askDeleteRef("agenda", agenda)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </li>
          )}
        />

        <ReferenceCard
          icon={<FolderTree size={18} />}
          title="Departments"
          subtitle="Control department values available to users and projects."
          value={form.department}
          placeholder="e.g. College of Engineering"
          onChange={(e) =>
            setForm((p) => ({ ...p, department: e.target.value }))
          }
          onAdd={createDepartment}
          items={departments}
          renderItem={(department) => (
            <li
              key={department.id}
              className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[var(--border)] bg-white px-3 py-2"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {editingRef.type === "department" &&
                editingRef.id === department.id ? (
                  <input
                    className="control-input h-9"
                    value={editingRef.value}
                    onChange={(e) =>
                      setEditingRef((prev) => ({
                        ...prev,
                        value: e.target.value,
                      }))
                    }
                  />
                ) : (
                  <span className="truncate font-medium">
                    {department.name}
                  </span>
                )}
              </div>
              <div className="ml-3 flex items-center gap-1">
                {editingRef.type === "department" &&
                editingRef.id === department.id ? (
                  <>
                    <button
                      className="btn btn-outline px-2"
                      disabled={Boolean(
                        savingRefByKey[`department:${department.id}`],
                      )}
                      onClick={saveEditRef}
                    >
                      <Check size={14} />
                    </button>
                    <button
                      className="btn btn-outline px-2"
                      onClick={cancelEditRef}
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="btn btn-outline px-2"
                      disabled={Boolean(
                        savingRefByKey[`department:${department.id}`],
                      )}
                      onClick={() => startEditRef("department", department)}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className="btn btn-outline px-2 text-red-700 hover:bg-red-50"
                      disabled={Boolean(
                        savingRefByKey[`department:${department.id}`],
                      )}
                      onClick={() => askDeleteRef("department", department)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </li>
          )}
        />

        <ReferenceCard
          icon={<Users size={18} />}
          title="Proponents"
          subtitle="Manage the selectable proponent list used in submission forms."
          value={form.proponent}
          placeholder="e.g. DELA CRUZ, JUAN A."
          onChange={(e) =>
            setForm((p) => ({ ...p, proponent: e.target.value }))
          }
          onAdd={createProponent}
          items={proponents}
          renderItem={(proponent) => (
            <li
              key={proponent.id}
              className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[var(--border)] bg-white px-3 py-2"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {editingRef.type === "proponent" &&
                editingRef.id === proponent.id ? (
                  <input
                    className="control-input h-9"
                    value={editingRef.value}
                    onChange={(e) =>
                      setEditingRef((prev) => ({
                        ...prev,
                        value: e.target.value,
                      }))
                    }
                  />
                ) : (
                  <span className="truncate font-medium">{proponent.name}</span>
                )}
              </div>
              <div className="ml-3 flex items-center gap-1">
                {editingRef.type === "proponent" &&
                editingRef.id === proponent.id ? (
                  <>
                    <button
                      className="btn btn-outline px-2"
                      disabled={Boolean(
                        savingRefByKey[`proponent:${proponent.id}`],
                      )}
                      onClick={saveEditRef}
                    >
                      <Check size={14} />
                    </button>
                    <button
                      className="btn btn-outline px-2"
                      onClick={cancelEditRef}
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="btn btn-outline px-2"
                      disabled={Boolean(
                        savingRefByKey[`proponent:${proponent.id}`],
                      )}
                      onClick={() => startEditRef("proponent", proponent)}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className="btn btn-outline px-2 text-red-700 hover:bg-red-50"
                      disabled={Boolean(
                        savingRefByKey[`proponent:${proponent.id}`],
                      )}
                      onClick={() => askDeleteRef("proponent", proponent)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </li>
          )}
        />
      </div>

      <div className="panel">
        <div className="panel-header flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-slate-600">
              Roles & Permissions
            </h2>
            <p className="text-xs text-slate-500">
              Simple access matrix for Student, Faculty, and Admin.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn btn-outline" onClick={resetPermissions}>
              Reset Defaults
            </button>
            <button className="btn btn-primary" onClick={savePermissions}>
              Save Permissions
            </button>
          </div>
        </div>

        <div className="panel-body space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            {roleKeys.map((role) => (
              <div
                key={`role-summary-${role}`}
                className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2"
              >
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span>{ROLE_LABELS[role]}</span>
                  <span>
                    {(permissionDraft[role] || []).length}/
                    {permissionKeys.length}
                  </span>
                </div>
                <div className="mt-2 flex gap-1">
                  <button
                    className="btn btn-outline h-7 px-2 text-[11px]"
                    onClick={() => setPermissionsForRole(role, permissionKeys)}
                  >
                    Select all
                  </button>
                  <button
                    className="btn btn-outline h-7 px-2 text-[11px]"
                    onClick={() => setPermissionsForRole(role, [])}
                  >
                    Clear
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-[var(--radius-sm)] border border-[var(--border)]">
            <table className="data-table">
              <thead className="bg-[var(--surface-muted)]">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">
                    Permission
                  </th>
                  {roleKeys.map((role) => (
                    <th
                      key={`role-column-${role}`}
                      className="px-3 py-2 text-center font-semibold text-slate-700"
                    >
                      {ROLE_LABELS[role]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {permissionKeys.map((permission) => (
                  <tr
                    key={`permission-row-${permission}`}
                    className="border-t border-[var(--border)]"
                  >
                    <td className="px-3 py-2 text-slate-700">
                      <p className="font-medium">
                        {PERMISSION_LABELS[permission] || permission}
                      </p>
                      <p className="text-xs text-slate-500">{permission}</p>
                    </td>
                    {roleKeys.map((role) => (
                      <td
                        key={`permission-cell-${permission}-${role}`}
                        className="px-3 py-2 text-center"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-slate-700"
                          checked={Boolean(
                            (permissionDraft[role] || []).includes(permission),
                          )}
                          onChange={(e) =>
                            togglePermissionForRole(
                              role,
                              permission,
                              e.target.checked,
                            )
                          }
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-slate-500">
            Dependency Reassignment Wizard
          </h2>
        </div>
        <div className="panel-body grid gap-3 md:grid-cols-4">
          <select
            className="control-select"
            value={reassign.entity}
            onChange={(e) =>
              setReassign((prev) => ({
                ...prev,
                entity: e.target.value,
                fromId: "",
                toId: "",
              }))
            }
          >
            <option value="center">Research Center</option>
            <option value="agenda">Research Agenda</option>
            <option value="department">Department</option>
          </select>
          <select
            className="control-select"
            value={reassign.fromId}
            onChange={(e) =>
              setReassign((prev) => ({ ...prev, fromId: e.target.value }))
            }
          >
            <option value="">From (source)</option>
            {referenceOptions.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
          <select
            className="control-select"
            value={reassign.toId}
            onChange={(e) =>
              setReassign((prev) => ({ ...prev, toId: e.target.value }))
            }
          >
            <option value="">To (replacement)</option>
            {referenceOptions.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={runReassignDependencies}>
            Reassign Dependencies
          </button>
          {reassignResult ? (
            <div className="sm:col-span-4 app-card-muted app-card-compact text-sm text-slate-700">
              <p className="font-semibold">Reassignment Result</p>
              <div className="mt-2 space-y-1 text-xs">
                <p>
                  Reassigned{" "}
                  <span className="font-semibold">{reassignEntityLabel}</span>{" "}
                  from{" "}
                  <span className="font-semibold">
                    {referenceLabelById[reassignResult.from_id] ||
                      reassignResult.from_id ||
                      "-"}
                  </span>{" "}
                  to{" "}
                  <span className="font-semibold">
                    {referenceLabelById[reassignResult.to_id] ||
                      reassignResult.to_id ||
                      "-"}
                  </span>
                  .
                </p>
                <p>
                  Projects updated:{" "}
                  <span className="font-semibold">
                    {reassignResult.projects_updated || 0}
                  </span>
                </p>
                {"profiles_updated" in (reassignResult || {}) ? (
                  <p>
                    Profiles updated:{" "}
                    <span className="font-semibold">
                      {reassignResult.profiles_updated || 0}
                    </span>
                  </p>
                ) : null}
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-semibold text-slate-600">
                  View raw result
                </summary>
                <pre className="mt-1 whitespace-pre-wrap text-xs">
                  {JSON.stringify(reassignResult, null, 2)}
                </pre>
              </details>
            </div>
          ) : null}
        </div>
      </div>

      {deleteDialog ? (
        <div
          className="modal-overlay modal-overlay-centered"
          onClick={() => setDeleteDialog(null)}
        >
          <div
            className="modal-dialog modal-dialog-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="panel">
              <div className="panel-header">
                <h3 className="text-base font-semibold text-slate-900">
                  {deleteDialog.title}
                </h3>
              </div>
              <div className="panel-body space-y-4">
                <p className="text-sm text-slate-600">{deleteDialog.text}</p>
                <div className="app-card-muted app-card-compact text-sm text-slate-700">
                  {deleteDialog.loading ? (
                    <p>Checking linked records...</p>
                  ) : (
                    <div className="space-y-1">
                      <p>
                        Linked projects:{" "}
                        <span className="font-semibold">
                          {deleteDialog.projectCount || 0}
                        </span>
                      </p>
                      {deleteDialog.type === "center" ? (
                        <p>
                          Linked user profiles:{" "}
                          <span className="font-semibold">
                            {deleteDialog.profileCount || 0}
                          </span>
                        </p>
                      ) : null}
                      {(deleteDialog.projectCount || 0) > 0 ||
                      (deleteDialog.profileCount || 0) > 0 ? (
                        <p className="text-xs text-amber-700">
                          This record is currently in use. Reassign linked
                          records first before deleting.
                        </p>
                      ) : (
                        <p className="text-xs text-emerald-700">
                          No linked records found.
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    className="btn btn-outline"
                    onClick={() => setDeleteDialog(null)}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-danger"
                    disabled={Boolean(
                      deleteDialog?.loading ||
                      deleteDialog?.projectCount > 0 ||
                      deleteDialog?.profileCount > 0 ||
                      (deleteDialog?.type &&
                        deleteDialog?.row?.id &&
                        savingRefByKey[
                          `${deleteDialog.type}:${deleteDialog.row.id}`
                        ]),
                    )}
                    onClick={() =>
                      deleteRef(deleteDialog.type, deleteDialog.row)
                    }
                  >
                    {deleteDialog.loading ? "Checking..." : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmActionModal
        open={Boolean(confirmAction)}
        title={confirmAction?.title || "Confirm Action"}
        message={confirmAction?.message || ""}
        confirmLabel={confirmAction?.confirmLabel || "Confirm"}
        loading={confirmLoading}
        onCancel={() => setConfirmAction(null)}
        onConfirm={executeConfirmAction}
      />
    </section>
  );
}





