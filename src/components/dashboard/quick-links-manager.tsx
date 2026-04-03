"use client";

/**
 * QuickLinksManager — CRUD for customizable reference links.
 * Users can add, edit, categorize, and delete quick-reference links.
 */

import { useState, useTransition, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link2, Plus, MoreVertical, Pencil, Trash2, ExternalLink } from "lucide-react";

export interface QuickLinkData {
  id: string;
  label: string;
  url: string;
  category: string | null;
  sortOrder: number;
}

// Default suggested links for PF2e Kingmaker
const SUGGESTED_LINKS = [
  { label: "Archives of Nethys", url: "https://2e.aonprd.com/", category: "Rules" },
  { label: "PF2e Tools", url: "https://pf2easy.com/", category: "Rules" },
  { label: "Pathbuilder 2e", url: "https://pathbuilder2e.com/", category: "Characters" },
];

export function QuickLinksManager({
  initialLinks,
}: {
  initialLinks: QuickLinkData[];
}) {
  const [links, setLinks] = useState<QuickLinkData[]>(initialLinks);
  const [isPending, startTransition] = useTransition();

  // Add dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newCategory, setNewCategory] = useState("");

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editCategory, setEditCategory] = useState("");

  // Group links by category
  const grouped = links.reduce<Record<string, QuickLinkData[]>>((acc, link) => {
    const cat = link.category || "Uncategorized";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(link);
    return acc;
  }, {});

  const categories = Object.keys(grouped).sort((a, b) => {
    if (a === "Uncategorized") return 1;
    if (b === "Uncategorized") return -1;
    return a.localeCompare(b);
  });

  const addLink = useCallback(
    (label: string, url: string, category: string) => {
      if (!label.trim() || !url.trim()) return;
      startTransition(async () => {
        const res = await fetch("/api/quick-links", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: label.trim(),
            url: url.trim(),
            category: category.trim() || null,
          }),
        });
        if (res.ok) {
          const link = await res.json();
          setLinks((prev) => [...prev, link]);
          setNewLabel("");
          setNewUrl("");
          setNewCategory("");
          setAddOpen(false);
        }
      });
    },
    [],
  );

  const saveEdit = useCallback(() => {
    if (!editId || !editLabel.trim() || !editUrl.trim()) return;
    startTransition(async () => {
      const res = await fetch(`/api/quick-links/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: editLabel.trim(),
          url: editUrl.trim(),
          category: editCategory.trim() || null,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setLinks((prev) =>
          prev.map((l) => (l.id === editId ? { ...l, ...updated } : l)),
        );
        setEditOpen(false);
        setEditId(null);
      }
    });
  }, [editId, editLabel, editUrl, editCategory]);

  const deleteLink = useCallback((id: string) => {
    startTransition(async () => {
      const res = await fetch(`/api/quick-links/${id}`, { method: "DELETE" });
      if (res.ok) {
        setLinks((prev) => prev.filter((l) => l.id !== id));
      }
    });
  }, []);

  function openEdit(link: QuickLinkData) {
    setEditId(link.id);
    setEditLabel(link.label);
    setEditUrl(link.url);
    setEditCategory(link.category || "");
    setEditOpen(true);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            <CardTitle>Quick Links</CardTitle>
            <Badge variant="outline" className="ml-1">
              {links.length}
            </Badge>
          </div>

          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-8 px-3">
              <Plus className="h-4 w-4" /> Add
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Quick Link</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Input
                    placeholder="Label (e.g., Archives of Nethys)"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                  />
                </div>
                <div>
                  <Input
                    placeholder="URL (e.g., https://2e.aonprd.com/)"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    type="url"
                  />
                </div>
                <div>
                  <Input
                    placeholder="Category (optional, e.g., Rules, Characters)"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                  />
                </div>
                <Button
                  onClick={() => addLink(newLabel, newUrl, newCategory)}
                  disabled={isPending || !newLabel.trim() || !newUrl.trim()}
                  className="w-full"
                >
                  {isPending ? "Adding..." : "Add Link"}
                </Button>

                {/* Suggested links */}
                {links.length === 0 && (
                  <div className="border-t pt-3 mt-3">
                    <p className="text-xs text-muted-foreground mb-2">
                      Quick add suggested links:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {SUGGESTED_LINKS.map((s) => (
                        <Button
                          key={s.url}
                          variant="outline"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => addLink(s.label, s.url, s.category)}
                          disabled={isPending}
                        >
                          + {s.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {links.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No links yet. Add reference links to PF2e rules, Foundry resources,
            house rules, or anything else your party needs quick access to.
          </p>
        ) : (
          <div className="space-y-4">
            {categories.map((cat) => (
              <div key={cat}>
                {categories.length > 1 && (
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    {cat}
                  </h4>
                )}
                <div className="grid gap-1.5">
                  {grouped[cat].map((link) => (
                    <div
                      key={link.id}
                      className={`flex items-center gap-2 rounded-md border px-3 py-2 hover:bg-muted/50 transition-colors group ${
                        isPending ? "opacity-50" : ""
                      }`}
                    >
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline truncate flex-1"
                      >
                        {link.label}
                      </a>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="shrink-0 rounded-md p-1 opacity-0 group-hover:opacity-100 hover:bg-muted transition-opacity">
                          <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(link)}>
                            <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => deleteLink(link.id)}
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Input
                placeholder="Label"
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
              />
            </div>
            <div>
              <Input
                placeholder="URL"
                value={editUrl}
                onChange={(e) => setEditUrl(e.target.value)}
                type="url"
              />
            </div>
            <div>
              <Input
                placeholder="Category (optional)"
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
              />
            </div>
            <Button
              onClick={saveEdit}
              disabled={isPending || !editLabel.trim() || !editUrl.trim()}
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
