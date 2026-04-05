"use client";

/**
 * ObjectiveTracker — CRUD for campaign objectives / quests.
 * Users can add, edit, complete, fail, and delete objectives.
 */

import { useState, useTransition, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  Target,
  Plus,
  MoreVertical,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Pencil,
  Trash2,
} from "lucide-react";

export interface ObjectiveData {
  id: string;
  title: string;
  description: string | null;
  status: "ACTIVE" | "COMPLETED" | "FAILED";
  priority: number;
  createdAt: string;
  updatedAt: string;
}

function statusBadge(status: ObjectiveData["status"]) {
  switch (status) {
    case "ACTIVE":
      return <Badge className="bg-blue-600 hover:bg-blue-700 text-white">Active</Badge>;
    case "COMPLETED":
      return <Badge className="bg-green-600 hover:bg-green-700 text-white">Completed</Badge>;
    case "FAILED":
      return <Badge variant="destructive">Failed</Badge>;
  }
}

function priorityLabel(priority: number) {
  if (priority >= 2) return "High";
  if (priority === 1) return "Medium";
  return "Low";
}

function priorityColor(priority: number) {
  if (priority >= 2) return "text-red-500";
  if (priority === 1) return "text-yellow-500";
  return "text-muted-foreground";
}

export function ObjectiveTracker({
  initialObjectives,
}: {
  initialObjectives: ObjectiveData[];
}) {
  const [objectives, setObjectives] = useState<ObjectiveData[]>(initialObjectives);
  const [isPending, startTransition] = useTransition();

  // Add dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState("0");

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editPriority, setEditPriority] = useState("0");

  // Filter
  const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "COMPLETED" | "FAILED">("ALL");

  const activeCount = objectives.filter((o) => o.status === "ACTIVE").length;
  const completedCount = objectives.filter((o) => o.status === "COMPLETED").length;

  const filtered = objectives
    .filter((o) => filter === "ALL" || o.status === filter)
    .sort((a, b) => b.priority - a.priority);

  const addObjective = useCallback(() => {
    if (!newTitle.trim()) return;
    startTransition(async () => {
      const res = await fetch("/api/objectives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDesc.trim() || null,
          priority: parseInt(newPriority) || 0,
        }),
      });
      if (res.ok) {
        const obj = await res.json();
        setObjectives((prev) => [...prev, obj]);
        setNewTitle("");
        setNewDesc("");
        setNewPriority("0");
        setAddOpen(false);
      }
    });
  }, [newTitle, newDesc, newPriority]);

  const updateStatus = useCallback(
    (id: string, status: ObjectiveData["status"]) => {
      startTransition(async () => {
        const res = await fetch(`/api/objectives/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        if (res.ok) {
          const updated = await res.json();
          setObjectives((prev) =>
            prev.map((o) => (o.id === id ? { ...o, ...updated } : o)),
          );
        }
      });
    },
    [],
  );

  const saveEdit = useCallback(() => {
    if (!editId || !editTitle.trim()) return;
    startTransition(async () => {
      const res = await fetch(`/api/objectives/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDesc.trim() || null,
          priority: parseInt(editPriority) || 0,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setObjectives((prev) =>
          prev.map((o) => (o.id === editId ? { ...o, ...updated } : o)),
        );
        setEditOpen(false);
        setEditId(null);
      }
    });
  }, [editId, editTitle, editDesc, editPriority]);

  const deleteObjective = useCallback((id: string) => {
    startTransition(async () => {
      const res = await fetch(`/api/objectives/${id}`, { method: "DELETE" });
      if (res.ok) {
        setObjectives((prev) => prev.filter((o) => o.id !== id));
      }
    });
  }, []);

  function openEdit(obj: ObjectiveData) {
    setEditId(obj.id);
    setEditTitle(obj.title);
    setEditDesc(obj.description || "");
    setEditPriority(String(obj.priority));
    setEditOpen(true);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            <CardTitle>Objectives</CardTitle>
            <Badge variant="outline" className="ml-1">
              {activeCount} active
            </Badge>
            {completedCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {completedCount} done
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={filter}
              onValueChange={(val) =>
                setFilter((val as typeof filter) ?? "ALL")
              }
              items={{ ALL: "All", ACTIVE: "Active", COMPLETED: "Completed", FAILED: "Failed" }}
            >
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" label="All">All</SelectItem>
                <SelectItem value="ACTIVE" label="Active">Active</SelectItem>
                <SelectItem value="COMPLETED" label="Completed">Completed</SelectItem>
                <SelectItem value="FAILED" label="Failed">Failed</SelectItem>
              </SelectContent>
            </Select>

            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-8 px-3">
                <Plus className="h-4 w-4" /> Add
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Objective</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Input
                      placeholder="Quest or goal title..."
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newTitle.trim()) addObjective();
                      }}
                    />
                  </div>
                  <div>
                    <Textarea
                      placeholder="Description (optional)"
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      rows={2}
                    />
                  </div>
                  <div>
                    <Select
                      value={newPriority}
                      onValueChange={(val) => setNewPriority(val ?? "0")}
                      items={{ "0": "Low Priority", "1": "Medium Priority", "2": "High Priority" }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0" label="Low Priority">Low Priority</SelectItem>
                        <SelectItem value="1" label="Medium Priority">Medium Priority</SelectItem>
                        <SelectItem value="2" label="High Priority">High Priority</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={addObjective}
                    disabled={isPending || !newTitle.trim()}
                    className="w-full"
                  >
                    {isPending ? "Adding..." : "Add Objective"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {filter === "ALL"
              ? "No objectives yet. Add quests and goals to track your party\u2019s progress."
              : `No ${filter.toLowerCase()} objectives.`}
          </p>
        ) : (
          <div className="space-y-2">
            {filtered.map((obj) => (
              <div
                key={obj.id}
                className={`flex items-start gap-3 rounded-md border p-3 transition-colors ${
                  obj.status !== "ACTIVE" ? "opacity-60" : ""
                } ${isPending ? "opacity-50" : ""}`}
              >
                {/* Status quick-toggle button */}
                <button
                  className="mt-0.5 shrink-0"
                  onClick={() => {
                    if (obj.status === "ACTIVE") updateStatus(obj.id, "COMPLETED");
                    else if (obj.status === "COMPLETED") updateStatus(obj.id, "ACTIVE");
                    else updateStatus(obj.id, "ACTIVE");
                  }}
                  title={
                    obj.status === "ACTIVE"
                      ? "Mark completed"
                      : "Reactivate"
                  }
                >
                  {obj.status === "COMPLETED" ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : obj.status === "FAILED" ? (
                    <XCircle className="h-5 w-5 text-red-500" />
                  ) : (
                    <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/40" />
                  )}
                </button>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-medium text-sm ${
                        obj.status !== "ACTIVE"
                          ? "line-through text-muted-foreground"
                          : ""
                      }`}
                    >
                      {obj.title}
                    </span>
                    {obj.priority > 0 && (
                      <span className={`text-xs font-medium ${priorityColor(obj.priority)}`}>
                        {priorityLabel(obj.priority)}
                      </span>
                    )}
                    {statusBadge(obj.status)}
                  </div>
                  {obj.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {obj.description}
                    </p>
                  )}
                </div>

                {/* Actions dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger className="shrink-0 rounded-md p-1 hover:bg-muted">
                    <MoreVertical className="h-4 w-4 text-muted-foreground" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEdit(obj)}>
                      <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                    </DropdownMenuItem>
                    {obj.status === "ACTIVE" && (
                      <>
                        <DropdownMenuItem
                          onClick={() => updateStatus(obj.id, "COMPLETED")}
                        >
                          <CheckCircle2 className="mr-2 h-3.5 w-3.5" /> Complete
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => updateStatus(obj.id, "FAILED")}
                        >
                          <XCircle className="mr-2 h-3.5 w-3.5" /> Mark Failed
                        </DropdownMenuItem>
                      </>
                    )}
                    {obj.status !== "ACTIVE" && (
                      <DropdownMenuItem
                        onClick={() => updateStatus(obj.id, "ACTIVE")}
                      >
                        <RotateCcw className="mr-2 h-3.5 w-3.5" /> Reactivate
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => deleteObjective(obj.id)}
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Objective</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Input
                placeholder="Quest or goal title..."
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </div>
            <div>
              <Textarea
                placeholder="Description (optional)"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={2}
              />
            </div>
            <div>
              <Select
                value={editPriority}
                onValueChange={(val) => setEditPriority(val ?? "0")}
                items={{ "0": "Low Priority", "1": "Medium Priority", "2": "High Priority" }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0" label="Low Priority">Low Priority</SelectItem>
                  <SelectItem value="1" label="Medium Priority">Medium Priority</SelectItem>
                  <SelectItem value="2" label="High Priority">High Priority</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={saveEdit}
              disabled={isPending || !editTitle.trim()}
              className="w-full"
            >
              {isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
