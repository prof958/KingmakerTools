"use client";

/**
 * LogView — the campaign log.
 * Lists log entries newest-first, grouped by calendar day. Users can add,
 * edit, and delete manual entries; auto-recorded (SYSTEM) entries are
 * read-only but can still be deleted.
 */

import { useMemo, useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ScrollText,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Sparkles,
  PenLine,
} from "lucide-react";
import { formatGolarionDate } from "@/lib/pf2e/calendar";
import { toast } from "sonner";

const CATEGORIES = [
  "PARTY",
  "INVENTORY",
  "CAMPSITE",
  "KINGDOM",
  "SESSION",
  "NOTE",
  "DEATH",
] as const;
type Category = (typeof CATEGORIES)[number];

export interface LogEntryData {
  id: string;
  category: Category;
  source: "MANUAL" | "SYSTEM";
  summary: string;
  details: string | null;
  entityType: string | null;
  entityName: string | null;
  golarionDay: number | null;
  golarionMonth: number | null;
  golarionYear: number | null;
  createdAt: string;
}

const CATEGORY_CLASS: Record<Category, string> = {
  PARTY: "bg-blue-600 text-white hover:bg-blue-700",
  INVENTORY: "bg-amber-600 text-white hover:bg-amber-700",
  CAMPSITE: "bg-emerald-600 text-white hover:bg-emerald-700",
  KINGDOM: "bg-violet-600 text-white hover:bg-violet-700",
  SESSION: "bg-slate-600 text-white hover:bg-slate-700",
  NOTE: "bg-slate-500 text-white hover:bg-slate-600",
  DEATH: "bg-red-700 text-white hover:bg-red-800",
};

function categoryLabel(c: Category) {
  return c.charAt(0) + c.slice(1).toLowerCase();
}

const CATEGORY_ITEMS = Object.fromEntries(
  CATEGORIES.map((c) => [c, categoryLabel(c)]),
);

export function LogView({
  initialEntries,
}: {
  initialEntries: LogEntryData[];
}) {
  const [entries, setEntries] = useState<LogEntryData[]>(initialEntries);
  const [isPending, startTransition] = useTransition();

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | Category>("ALL");
  const [sourceFilter, setSourceFilter] = useState<"ALL" | "MANUAL" | "SYSTEM">(
    "ALL",
  );
  const [search, setSearch] = useState("");

  // Add dialog
  const [addOpen, setAddOpen] = useState(false);
  const [newSummary, setNewSummary] = useState("");
  const [newDetails, setNewDetails] = useState("");
  const [newCategory, setNewCategory] = useState<Category>("SESSION");

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editSummary, setEditSummary] = useState("");
  const [editDetails, setEditDetails] = useState("");
  const [editCategory, setEditCategory] = useState<Category>("NOTE");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (categoryFilter !== "ALL" && e.category !== categoryFilter) return false;
      if (sourceFilter !== "ALL" && e.source !== sourceFilter) return false;
      if (q) {
        const hay = `${e.summary} ${e.details ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [entries, categoryFilter, sourceFilter, search]);

  const groups = useMemo(() => {
    const map = new Map<string, LogEntryData[]>();
    for (const e of filtered) {
      const key = new Date(e.createdAt).toLocaleDateString(undefined, {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
      });
      const list = map.get(key);
      if (list) list.push(e);
      else map.set(key, [e]);
    }
    return [...map.entries()];
  }, [filtered]);

  const manualCount = entries.filter((e) => e.source === "MANUAL").length;

  function addEntry() {
    if (!newSummary.trim()) return;
    startTransition(async () => {
      try {
        const res = await fetch("/api/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            summary: newSummary.trim(),
            details: newDetails.trim() || null,
            category: newCategory,
          }),
        });
        if (res.ok) {
          const entry: LogEntryData = await res.json();
          setEntries((prev) => [entry, ...prev]);
          setNewSummary("");
          setNewDetails("");
          setNewCategory("SESSION");
          setAddOpen(false);
        } else {
          toast.error("Couldn't add that log entry. Try again.");
        }
      } catch {
        toast.error("Couldn't reach the server. Check your connection and try again.");
      }
    });
  }

  function openEdit(entry: LogEntryData) {
    setEditId(entry.id);
    setEditSummary(entry.summary);
    setEditDetails(entry.details ?? "");
    setEditCategory(entry.category);
    setEditOpen(true);
  }

  function saveEdit() {
    if (!editId || !editSummary.trim()) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/log/${editId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            summary: editSummary.trim(),
            details: editDetails.trim() || null,
            category: editCategory,
          }),
        });
        if (res.ok) {
          const updated: LogEntryData = await res.json();
          setEntries((prev) =>
            prev.map((e) => (e.id === editId ? { ...e, ...updated } : e)),
          );
          setEditOpen(false);
          setEditId(null);
        } else {
          toast.error("Couldn't save those changes. Try again.");
        }
      } catch {
        toast.error("Couldn't reach the server. Check your connection and try again.");
      }
    });
  }

  function deleteEntry(id: string) {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/log/${id}`, { method: "DELETE" });
        if (res.ok) {
          setEntries((prev) => prev.filter((e) => e.id !== id));
        } else {
          toast.error("Couldn't delete that log entry. Try again.");
        }
      } catch {
        toast.error("Couldn't reach the server. Check your connection and try again.");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ScrollText className="h-5 w-5" />
            <CardTitle>Campaign Log</CardTitle>
            <Badge variant="outline" className="ml-1">
              {entries.length} entries
            </Badge>
            {manualCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {manualCount} written
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search log..."
              className="h-8 w-[160px] text-xs"
            />

            <Select
              value={categoryFilter}
              onValueChange={(val) =>
                setCategoryFilter((val as "ALL" | Category) ?? "ALL")
              }
              items={{ ALL: "All categories", ...CATEGORY_ITEMS }}
            >
              <SelectTrigger className="h-8 w-[150px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" label="All categories">
                  All categories
                </SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c} label={categoryLabel(c)}>
                    {categoryLabel(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={sourceFilter}
              onValueChange={(val) =>
                setSourceFilter(
                  (val as "ALL" | "MANUAL" | "SYSTEM") ?? "ALL",
                )
              }
              items={{ ALL: "All sources", MANUAL: "Written", SYSTEM: "Auto" }}
            >
              <SelectTrigger className="h-8 w-[110px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" label="All sources">
                  All sources
                </SelectItem>
                <SelectItem value="MANUAL" label="Written">
                  Written
                </SelectItem>
                <SelectItem value="SYSTEM" label="Auto">
                  Auto
                </SelectItem>
              </SelectContent>
            </Select>

            <Button
              size="sm"
              className="h-8"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="h-4 w-4" /> Add entry
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {entries.length === 0
              ? "The log is empty. Add a session note, or make a change on the Party, Inventory, or Campsite pages."
              : "No entries match the current filters."}
          </p>
        ) : (
          <div className="space-y-6">
            {groups.map(([day, dayEntries]) => (
              <div key={day}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {day}
                  </span>
                  <div className="flex-1 border-t border-border" />
                </div>
                <div className="space-y-2">
                  {dayEntries.map((entry) => (
                    <LogRow
                      key={entry.id}
                      entry={entry}
                      isPending={isPending}
                      onEdit={openEdit}
                      onDelete={deleteEntry}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add log entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Input
                placeholder="What happened?"
                value={newSummary}
                onChange={(e) => setNewSummary(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newSummary.trim()) addEntry();
                }}
              />
            </div>
            <div>
              <Textarea
                placeholder="Details (optional)"
                value={newDetails}
                onChange={(e) => setNewDetails(e.target.value)}
                rows={3}
              />
            </div>
            <div>
              <Select
                value={newCategory}
                onValueChange={(val) =>
                  setNewCategory((val as Category) ?? "SESSION")
                }
                items={CATEGORY_ITEMS}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c} label={categoryLabel(c)}>
                      {categoryLabel(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={addEntry}
              disabled={isPending || !newSummary.trim()}
              className="w-full"
            >
              {isPending ? "Saving..." : "Add entry"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit log entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Input
                placeholder="What happened?"
                value={editSummary}
                onChange={(e) => setEditSummary(e.target.value)}
              />
            </div>
            <div>
              <Textarea
                placeholder="Details (optional)"
                value={editDetails}
                onChange={(e) => setEditDetails(e.target.value)}
                rows={3}
              />
            </div>
            <div>
              <Select
                value={editCategory}
                onValueChange={(val) =>
                  setEditCategory((val as Category) ?? "NOTE")
                }
                items={CATEGORY_ITEMS}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c} label={categoryLabel(c)}>
                      {categoryLabel(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={saveEdit}
              disabled={isPending || !editSummary.trim()}
              className="w-full"
            >
              {isPending ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function LogRow({
  entry,
  isPending,
  onEdit,
  onDelete,
}: {
  entry: LogEntryData;
  isPending: boolean;
  onEdit: (e: LogEntryData) => void;
  onDelete: (id: string) => void;
}) {
  const time = new Date(entry.createdAt).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const inWorld =
    entry.golarionDay != null &&
    entry.golarionMonth != null &&
    entry.golarionYear != null
      ? formatGolarionDate(
          entry.golarionDay,
          entry.golarionMonth,
          entry.golarionYear,
        )
      : null;

  return (
    <div
      className={`flex items-start gap-3 rounded-md border p-3 ${
        isPending ? "opacity-50" : ""
      }`}
    >
      <div
        className="mt-0.5 shrink-0 text-muted-foreground"
        title={entry.source === "MANUAL" ? "Written entry" : "Auto-recorded"}
      >
        {entry.source === "MANUAL" ? (
          <PenLine className="h-4 w-4" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={CATEGORY_CLASS[entry.category]}>
            {categoryLabel(entry.category)}
          </Badge>
          <span className="text-sm font-medium">{entry.summary}</span>
        </div>
        {entry.details && (
          <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
            {entry.details}
          </p>
        )}
        <p className="mt-1 text-[11px] text-muted-foreground">
          {time}
          {inWorld ? ` · ${inWorld}` : ""}
        </p>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger className="shrink-0 rounded-md p-1 hover:bg-muted">
          <MoreVertical className="h-4 w-4 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {entry.source === "MANUAL" && (
            <DropdownMenuItem onClick={() => onEdit(entry)}>
              <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            className="text-destructive"
            onClick={() => onDelete(entry.id)}
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
