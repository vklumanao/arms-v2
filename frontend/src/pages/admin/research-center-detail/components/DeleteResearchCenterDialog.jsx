import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function DeleteResearchCenterDialog({
  open,
  onOpenChange,
  deleteGuard,
  deleting,
  onDelete,
  onGoToProjects,
  onGoToAffiliates,
}) {
  const blocked = deleteGuard?.blocked;
  const projectCount = Number(deleteGuard?.reasons?.projectCount || 0);
  const affiliateCount = Number(deleteGuard?.reasons?.nonAdminAffiliates || 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !deleting && onOpenChange(next)}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-[#1E293B]">
            Delete Research Center
          </DialogTitle>
          <DialogDescription>
            {blocked
              ? "Deletion is blocked because this center still has linked records."
              : "This action cannot be undone."}
          </DialogDescription>
        </DialogHeader>

        {blocked ? (
          <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {projectCount > 0 ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span>{projectCount} linked project(s)</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onGoToProjects}
                >
                  View Projects
                </Button>
              </div>
            ) : null}
            {affiliateCount > 0 ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span>{affiliateCount} linked affiliate(s)</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onGoToAffiliates}
                >
                  Manage Affiliates
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="w-full bg-orange-600 text-white hover:bg-orange-700 sm:w-auto"
            disabled={deleting || blocked}
            onClick={onDelete}
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
