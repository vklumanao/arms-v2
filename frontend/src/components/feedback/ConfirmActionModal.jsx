import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";

export default function ConfirmActionModal({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  align = "top",
  loading = false,
  className = "",
  cancelButtonClassName = "",
  confirmButtonClassName = "",
  confirmVariant,
  onConfirm,
  onCancel,
}) {
  const resolvedConfirmVariant =
    confirmVariant ||
    (/delete|remove|revoke|deactivate/i.test(String(confirmLabel || title || ""))
      ? "destructive"
      : undefined);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !loading) onCancel?.();
      }}
    >
      <DialogContent
        className={cn(
          align === "center"
            ? "top-1/2"
            : "top-[14%] -translate-y-0 sm:top-[18%]",
          className,
        )}
        onInteractOutside={(event) => {
          if (loading) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription asChild>
            <div className="text-sm text-muted-foreground">{message}</div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            className={cn("w-full sm:w-auto", cancelButtonClassName)}
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={resolvedConfirmVariant}
            className={cn("w-full sm:w-auto", confirmButtonClassName)}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Processing..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
