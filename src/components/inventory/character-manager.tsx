"use client";

/**
 * CharacterManager — add/edit/delete party members
 * Shows a list of characters with name + STR modifier, plus an add form.
 */

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil, Users, PawPrint } from "lucide-react";

interface Character {
  id: string;
  name: string;
  strModifier: number;
  isCompanion: boolean;
  miscBulk: number;
}

export function CharacterManager({
  initialCharacters,
}: {
  initialCharacters: Character[];
}) {
  const [characters, setCharacters] = useState<Character[]>(initialCharacters);
  const [name, setName] = useState("");
  const [strMod, setStrMod] = useState(0);
  const [isCompanion, setIsCompanion] = useState(false);
  const [miscBulk, setMiscBulk] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleAdd() {
    if (!name.trim()) return;

    startTransition(async () => {
      const res = await fetch("/api/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), strModifier: strMod, isCompanion, miscBulk }),
      });
      if (res.ok) {
        const character = await res.json();
        setCharacters((prev) => [...prev, character]);
        setName("");
        setStrMod(0);
        setIsCompanion(false);
        setMiscBulk(0);
        setDialogOpen(false);
      }
    });
  }

  async function handleEdit() {
    if (!editId || !name.trim()) return;

    startTransition(async () => {
      const res = await fetch(`/api/characters/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), strModifier: strMod, isCompanion, miscBulk }),
      });
      if (res.ok) {
        const updated = await res.json();
        setCharacters((prev) =>
          prev.map((c) => (c.id === editId ? updated : c))
        );
        setName("");
        setStrMod(0);
        setIsCompanion(false);
        setMiscBulk(0);
        setEditId(null);
        setDialogOpen(false);
      }
    });
  }

  async function handleDelete(id: string) {
    startTransition(async () => {
      const res = await fetch(`/api/characters/${id}`, { method: "DELETE" });
      if (res.ok) {
        setCharacters((prev) => prev.filter((c) => c.id !== id));
      }
    });
  }

  function openEdit(character: Character) {
    setEditId(character.id);
    setName(character.name);
    setStrMod(character.strModifier);
    setIsCompanion(character.isCompanion);
    setMiscBulk(character.miscBulk);
    setDialogOpen(true);
  }

  function openAdd() {
    setEditId(null);
    setName("");
    setStrMod(0);
    setIsCompanion(false);
    setMiscBulk(0);
    setDialogOpen(true);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Party Members
        </CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            onClick={openAdd}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3"
          >
            <Plus className="mr-1 h-4 w-4" /> Add
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editId ? "Edit Character" : "Add Character"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label htmlFor="char-name">Name</Label>
                <Input
                  id="char-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Valerie"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") editId ? handleEdit() : handleAdd();
                  }}
                />
              </div>
              <div>
                <Label htmlFor="str-mod">STR Modifier</Label>
                <NumberInput
                  id="str-mod"
                  value={strMod}
                  fallback={0}
                  onValueChange={setStrMod}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Used for encumbrance calculation (carry limit: 5+STR / 10+STR)
                </p>
              </div>
              <div>
                <Label htmlFor="misc-bulk">Misc Bulk</Label>
                <NumberInput
                  id="misc-bulk"
                  value={miscBulk}
                  fallback={0}
                  min={0}
                  onValueChange={setMiscBulk}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Untracked gear bulk (clothing, rations, etc.)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={isCompanion ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsCompanion(!isCompanion)}
                >
                  <PawPrint className="mr-1 h-4 w-4" />
                  {isCompanion ? "Companion" : "Mark as Companion"}
                </Button>
                {isCompanion && (
                  <span className="text-xs text-muted-foreground">
                    Will be shown separately from PCs
                  </span>
                )}
              </div>
              <Button
                onClick={editId ? handleEdit : handleAdd}
                disabled={isPending || !name.trim()}
                className="w-full"
              >
                {isPending ? "Saving..." : editId ? "Update" : "Add Character"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {characters.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No characters yet. Add your party members to get started.
          </p>
        ) : (
          <div className="space-y-2">
            {characters.filter((c) => !c.isCompanion).map((c) => (
              <CharacterRow key={c.id} character={c} onEdit={openEdit} onDelete={handleDelete} isPending={isPending} />
            ))}
            {characters.some((c) => c.isCompanion) && (
              <>
                <div className="flex items-center gap-2 pt-2">
                  <PawPrint className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Companions</span>
                  <div className="flex-1 border-t border-border" />
                </div>
                {characters.filter((c) => c.isCompanion).map((c) => (
                  <CharacterRow key={c.id} character={c} onEdit={openEdit} onDelete={handleDelete} isPending={isPending} />
                ))}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CharacterRow({
  character: c,
  onEdit,
  onDelete,
  isPending,
}: {
  character: Character;
  onEdit: (c: Character) => void;
  onDelete: (id: string) => void;
  isPending: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <div className="flex items-center gap-3">
        <span className="font-medium">{c.name}</span>
        <Badge variant="secondary" className="text-xs">
          STR {c.strModifier >= 0 ? "+" : ""}
          {c.strModifier}
        </Badge>
        {c.miscBulk > 0 && (
          <Badge variant="outline" className="text-xs">
            +{c.miscBulk} misc
          </Badge>
        )}
      </div>
      <div className="flex gap-1">
        <Button size="icon" variant="ghost" onClick={() => onEdit(c)}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onDelete(c.id)}
          disabled={isPending}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
