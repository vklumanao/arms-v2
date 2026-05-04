import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import UserMultiSelect from "@/components/submissions/UserMultiSelect";
import {
  EXPECTED_OUTPUT_TYPE_OPTIONS,
  splitCsvNames,
  toCsvNames,
} from "@/utils/submissions";

export default function ExpectedOutputModal({
  open,
  onOpenChange,
  editingOutputClientId,
  newOutputDraft,
  setNewOutputDraft,
  saveNewExpectedOutput,
  closeAddOutputModal,
  formatFileSize,
  fileToBase64,
  maxOutputFileSizeBytes,
  productSoftwareSpecificOutputOptions,
  facultyEligibleUserOptions,
  setError,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [authorSearch, setAuthorSearch] = useState("");
  const [authorDropdownOpen, setAuthorDropdownOpen] = useState(false);
  const authorFieldRef = useRef(null);
  const publicationAuthorSelections = useMemo(
    () => splitCsvNames(newOutputDraft.publication_authors || ""),
    [newOutputDraft.publication_authors],
  );
  const publicationAuthorSuggestions = useMemo(() => {
    const keyword = authorSearch.trim().toLowerCase();
    if (!keyword) return [];
    return (facultyEligibleUserOptions || [])
      .filter((ckanUser) =>
        String(ckanUser.name || "")
          .toLowerCase()
          .includes(keyword),
      )
      .filter(
        (ckanUser) => !publicationAuthorSelections.includes(ckanUser.name),
      )
      .slice(0, 8);
  }, [authorSearch, facultyEligibleUserOptions, publicationAuthorSelections]);

  useEffect(() => {
    if (!authorDropdownOpen) return () => {};
    const handleClickOutside = (event) => {
      if (
        authorFieldRef.current &&
        !authorFieldRef.current.contains(event.target)
      ) {
        setAuthorDropdownOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, [authorDropdownOpen]);
  const handleSelectedFile = async (selectedFile) => {
    if (selectedFile && selectedFile.size > maxOutputFileSizeBytes) {
      setError("Each expected output file must be 25MB or smaller.");
      return;
    }
    setError("");
    const base64 = selectedFile ? await fileToBase64(selectedFile) : "";
    setNewOutputDraft((prev) => ({
      ...prev,
      file: selectedFile,
      file_name: selectedFile?.name || "",
      mime_type: selectedFile?.type || "",
      file_size: selectedFile?.size || null,
      file_base64: base64,
      file_path: "",
      needs_file_reselect: false,
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {editingOutputClientId ? "Edit Output" : "Add Output"}
          </DialogTitle>
          <DialogDescription>
            Fill out the output details, then click{" "}
            {editingOutputClientId ? "Save" : "Add"} to list it in Step 4.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <label className="block space-y-1 text-sm">
              <span className="font-semibold text-zinc-700">Output type</span>
              <Select
                value={newOutputDraft.output_type || "__none__"}
                onValueChange={(value) =>
                  setNewOutputDraft((prev) => ({
                    ...prev,
                    output_type: value === "__none__" ? "" : value,
                    specific_output:
                      value === "product_software"
                        ? prev.specific_output || ""
                        : "",
                    publication_authors: prev.publication_authors || "",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select output type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Select output type</SelectItem>
                  {EXPECTED_OUTPUT_TYPE_OPTIONS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            {newOutputDraft.output_type === "product_software" ? (
              <label className="block space-y-1 text-sm">
                <span className="font-semibold text-zinc-700">
                  Specific output
                </span>
                <Select
                  value={newOutputDraft.specific_output || "__none__"}
                  onValueChange={(value) =>
                    setNewOutputDraft((prev) => ({
                      ...prev,
                      specific_output: value === "__none__" ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select specific output" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      Select specific output
                    </SelectItem>
                    {productSoftwareSpecificOutputOptions.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            ) : null}

            <label className="block space-y-1 text-sm">
              <span className="font-semibold text-zinc-700">Notes</span>
              <Input
                placeholder="Short note about this expected output"
                value={newOutputDraft.notes || ""}
                onChange={(e) =>
                  setNewOutputDraft((prev) => ({
                    ...prev,
                    notes: e.target.value,
                  }))
                }
              />
            </label>

            <label className="block space-y-1 text-sm">
              <span className="font-semibold text-zinc-700">
                Output link (optional)
              </span>
              <Input
                placeholder="Paste a link to the output resource"
                value={newOutputDraft.output_link || ""}
                onChange={(e) =>
                  setNewOutputDraft((prev) => ({
                    ...prev,
                    output_link: e.target.value,
                  }))
                }
              />
            </label>

            <div className="block space-y-1 text-sm">
              <span className="font-semibold text-zinc-700">
                Output file (optional)
              </span>
              <div
                className={`upload-field ${isDragging ? "ring-2 ring-zinc-400" : ""}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "copy";
                }}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                }}
                onDrop={async (event) => {
                  event.preventDefault();
                  setIsDragging(false);
                  const droppedFile = event.dataTransfer.files?.[0] || null;
                  if (droppedFile) {
                    await handleSelectedFile(droppedFile);
                  }
                }}
              >
                <div className="upload-picker">
                  <div className="upload-picker-info">
                    <FileText
                      size={16}
                      className="mt-0.5 text-zinc-500"
                      aria-hidden="true"
                    />
                    <div className="space-y-0.5">
                      <p className="upload-picker-name">
                        {newOutputDraft.file?.name ||
                          newOutputDraft.file_name ||
                          "No file selected"}
                      </p>
                      <p className="upload-picker-sub">
                        Size:{" "}
                        {formatFileSize(
                          newOutputDraft.file?.size || newOutputDraft.file_size,
                        )}
                      </p>
                    </div>
                  </div>
                  <Button asChild variant="outline" className="upload-trigger">
                    <label>
                      <Upload size={14} aria-hidden="true" />
                      <span>
                        {newOutputDraft.file ? "Replace" : "Choose File"}
                      </span>
                      <input
                        className="sr-only"
                        type="file"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                        onChange={async (e) => {
                          const selectedFile = e.target.files?.[0] || null;
                          await handleSelectedFile(selectedFile);
                        }}
                      />
                    </label>
                  </Button>
                </div>
                <div className="upload-field-preview">
                  <p className="upload-field-hint">
                    Allowed: PDF, DOC, XLS, PNG, JPG | Max 25MB
                  </p>
                  <p className="text-xs text-zinc-500">
                    Tip: you can provide an output link, an output file, or
                    both.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <UserMultiSelect
              label="Proponents"
              placeholder="Type a Faculty name"
              searchValue={authorSearch}
              onSearchChange={setAuthorSearch}
              dropdownOpen={authorDropdownOpen}
              setDropdownOpen={setAuthorDropdownOpen}
              suggestions={publicationAuthorSuggestions}
              onSelect={(user) =>
                setNewOutputDraft((prev) => ({
                  ...prev,
                  publication_authors: toCsvNames([
                    ...splitCsvNames(prev.publication_authors || ""),
                    user.name,
                  ]),
                }))
              }
              selections={publicationAuthorSelections}
              onRemove={(name) =>
                setNewOutputDraft((prev) => ({
                  ...prev,
                  publication_authors: toCsvNames(
                    splitCsvNames(prev.publication_authors || "").filter(
                      (item) => item !== name,
                    ),
                  ),
                }))
              }
              fieldRef={authorFieldRef}
              emptyText="No authors/proponents selected yet."
              helperText="Type to search and select one or more faculty."
              allowMultiple
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={closeAddOutputModal}>
            Cancel
          </Button>
          <Button type="button" onClick={saveNewExpectedOutput}>
            {editingOutputClientId ? "Save" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
