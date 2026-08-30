"use client";

/**
 * CharacterManager — add/edit/delete party members
 * Shows a list of characters with name + STR modifier, plus an add form.
 */

import { useState, useEffect, useTransition } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Pencil, Users, PawPrint, Skull, HeartPulse } from "lucide-react";


interface Character {
  id: string;
  name: string;
  emoji: string | null;
  imageUrl: string | null;
  strModifier: number;
  isCompanion: boolean;
  miscBulk: number;
  status: "ACTIVE" | "FALLEN";
  kiaAt: string | null;
  kiaNote: string | null;
}

export function CharacterManager({
  initialCharacters,
  onUpdate,
}: {
  initialCharacters: Character[];
  onUpdate?: () => void;
}) {
  const [characters, setCharacters] = useState<Character[]>(initialCharacters);
  useEffect(() => { setCharacters(initialCharacters); }, [initialCharacters]);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [strMod, setStrMod] = useState(0);
  const [isCompanion, setIsCompanion] = useState(false);
  const [miscBulk, setMiscBulk] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // K.I.A. flow
  const [kiaId, setKiaId] = useState<string | null>(null);
  const [kiaNote, setKiaNote] = useState("");
  const [fallenOpen, setFallenOpen] = useState(false);
  const kiaTarget = characters.find((c) => c.id === kiaId) ?? null;

  const activePcs = characters.filter((c) => !c.isCompanion && c.status !== "FALLEN");
  const activeCompanions = characters.filter((c) => c.isCompanion && c.status !== "FALLEN");
  const fallen = characters.filter((c) => c.status === "FALLEN");

  function openKia(character: Character) {
    setKiaId(character.id);
    setKiaNote("");
  }

  async function confirmKia() {
    if (!kiaId) return;
    startTransition(async () => {
      const res = await fetch(`/api/characters/${kiaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "FALLEN", kiaNote: kiaNote.trim() || null }),
      });
      if (res.ok) {
        const updated = await res.json();
        setCharacters((prev) => prev.map((c) => (c.id === kiaId ? updated : c)));
        setKiaId(null);
        setKiaNote("");
        setFallenOpen(true);
        onUpdate?.();
      }
    });
  }

  async function handleRevive(id: string) {
    startTransition(async () => {
      const res = await fetch(`/api/characters/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACTIVE" }),
      });
      if (res.ok) {
        const updated = await res.json();
        setCharacters((prev) => prev.map((c) => (c.id === id ? updated : c)));
        onUpdate?.();
      }
    });
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 128;
        const MAX_HEIGHT = 128;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        setImageUrl(canvas.toDataURL("image/png"));
        setEmoji(null);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  async function handleAdd() {
    if (!name.trim()) return;

    startTransition(async () => {
      const res = await fetch("/api/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), emoji, imageUrl, strModifier: strMod, isCompanion, miscBulk }),
      });
      if (res.ok) {
        const character = await res.json();
        setCharacters((prev) => [...prev, character]);
        setName("");
        setEmoji(null);
        setImageUrl(null);
        setStrMod(0);
        setIsCompanion(false);
        setMiscBulk(0);
        setDialogOpen(false);
        onUpdate?.();
      }
    });
  }

  async function handleEdit() {
    if (!editId || !name.trim()) return;

    startTransition(async () => {
      const res = await fetch(`/api/characters/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), emoji, imageUrl, strModifier: strMod, isCompanion, miscBulk }),
      });
      if (res.ok) {
        const updated = await res.json();
        setCharacters((prev) =>
          prev.map((c) => (c.id === editId ? updated : c))
        );
        setName("");
        setEmoji(null);
        setImageUrl(null);
        setStrMod(0);
        setIsCompanion(false);
        setMiscBulk(0);
        setEditId(null);
        setDialogOpen(false);
        onUpdate?.();
      }
    });
  }

  async function handleDelete(id: string) {
    startTransition(async () => {
      const res = await fetch(`/api/characters/${id}`, { method: "DELETE" });
      if (res.ok) {
        setCharacters((prev) => prev.filter((c) => c.id !== id));
        onUpdate?.();
      }
    });
  }

  function openEdit(character: Character) {
    setEditId(character.id);
    setName(character.name);
    setEmoji(character.emoji);
    setImageUrl(character.imageUrl);
    setStrMod(character.strModifier);
    setIsCompanion(character.isCompanion);
    setMiscBulk(character.miscBulk);
    setDialogOpen(true);
  }

  function openAdd() {
    setEditId(null);
    setName("");
    setEmoji(null);
    setImageUrl(null);
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
                <Label>Icon (Custom Emoji OR Image Upload)</Label>
                <div className="flex items-center gap-4 mt-1">
                  <div className="flex flex-col gap-2">
                    <Input
                      value={emoji ?? ""}
                      onChange={(e) => {
                        setEmoji(e.target.value);
                        if (e.target.value) setImageUrl(null);
                      }}
                      placeholder="e.g. 🧙"
                      maxLength={2}
                      className="w-20 text-center text-lg"
                    />
                    <span className="text-[10px] text-muted-foreground">Type emoji</span>
                  </div>
                  <span className="text-muted-foreground text-sm font-medium">OR</span>
                  <div className="flex flex-col gap-2">
                    <Input
                      type="file"
                      accept="image/png, image/jpeg, image/webp"
                      onChange={handleFileChange}
                      className="max-w-[200px]"
                    />
                    <span className="text-[10px] text-muted-foreground">Upload image (Max 128x128)</span>
                  </div>
                </div>
                {imageUrl && (
                  <div className="mt-2">
                    <span className="text-xs text-muted-foreground block mb-1">Preview:</span>
                    <img src={imageUrl} alt="Preview" className="w-10 h-10 object-cover rounded-full border" />
                  </div>
                )}
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
            {activePcs.map((c) => (
              <CharacterRow key={c.id} character={c} onEdit={openEdit} onDelete={handleDelete} onMarkKia={openKia} onRevive={handleRevive} isPending={isPending} />
            ))}
            {activeCompanions.length > 0 && (
              <>
                <div className="flex items-center gap-2 pt-2">
                  <PawPrint className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Companions</span>
                  <div className="flex-1 border-t border-border" />
                </div>
                {activeCompanions.map((c) => (
                  <CharacterRow key={c.id} character={c} onEdit={openEdit} onDelete={handleDelete} onMarkKia={openKia} onRevive={handleRevive} isPending={isPending} />
                ))}
              </>
            )}

            {fallen.length > 0 && (
              <details
                className="pt-2"
                open={fallenOpen}
                onToggle={(e) => setFallenOpen((e.target as HTMLDetailsElement).open)}
              >
                <summary className="flex cursor-pointer items-center gap-2 list-none">
                  <Skull className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Fallen ({fallen.length})
                  </span>
                  <div className="flex-1 border-t border-border" />
                </summary>
                <div className="space-y-2 pt-2">
                  {fallen.map((c) => (
                    <CharacterRow key={c.id} character={c} onEdit={openEdit} onDelete={handleDelete} onMarkKia={openKia} onRevive={handleRevive} isPending={isPending} />
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </CardContent>

      {/* Mark K.I.A. confirmation */}
      <Dialog open={kiaId !== null} onOpenChange={(open) => { if (!open) setKiaId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Mark {kiaTarget?.name ?? "character"} as killed in action?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              They move to the <strong>Fallen</strong> section and are left out of
              party counts. Their inventory, wallet, and leadership history are
              kept, and you can revive them later. A log entry is recorded.
            </p>
            <div>
              <Label htmlFor="kia-note">How did they fall? (optional)</Label>
              <Textarea
                id="kia-note"
                value={kiaNote}
                onChange={(e) => setKiaNote(e.target.value)}
                placeholder="Slain by the Stag Lord at the fort..."
                rows={2}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setKiaId(null)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-red-700 text-white hover:bg-red-800"
                onClick={confirmKia}
                disabled={isPending}
              >
                <Skull className="mr-1 h-4 w-4" />
                {isPending ? "Marking..." : "Mark K.I.A."}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function CharacterRow({
  character: c,
  onEdit,
  onDelete,
  onMarkKia,
  onRevive,
  isPending,
}: {
  character: Character;
  onEdit: (c: Character) => void;
  onDelete: (id: string) => void;
  onMarkKia: (c: Character) => void;
  onRevive: (id: string) => void;
  isPending: boolean;
}) {
  const fallen = c.status === "FALLEN";
  return (
    <div
      className={`flex items-center justify-between rounded-md border p-3 ${
        fallen ? "opacity-70" : ""
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {c.imageUrl ? (
          <img src={c.imageUrl} alt={c.name} className={`w-8 h-8 rounded-full object-cover shrink-0 ${fallen ? "grayscale" : ""}`} />
        ) : c.emoji ? (
          <span className="text-lg w-8 h-8 flex items-center justify-center shrink-0">{fallen ? "💀" : c.emoji}</span>
        ) : (
          <span className="text-lg w-8 h-8 flex items-center justify-center shrink-0">{fallen ? "💀" : c.isCompanion ? "🐾" : "🧑"}</span>
        )}
        <span className={`font-medium ${fallen ? "line-through text-muted-foreground" : ""}`}>{c.name}</span>
        {fallen ? (
          <Badge className="bg-red-700 text-white hover:bg-red-800 text-xs">K.I.A.</Badge>
        ) : (
          <Badge variant="secondary" className="text-xs">
            STR {c.strModifier >= 0 ? "+" : ""}
            {c.strModifier}
          </Badge>
        )}
        {!fallen && c.miscBulk > 0 && (
          <Badge variant="outline" className="text-xs">
            +{c.miscBulk} misc
          </Badge>
        )}
        {fallen && c.kiaNote && (
          <span className="truncate text-xs text-muted-foreground">{c.kiaNote}</span>
        )}
      </div>
      <div className="flex shrink-0 gap-1">
        {fallen ? (
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onRevive(c.id)}
            disabled={isPending}
            title="Revive"
          >
            <HeartPulse className="h-4 w-4 text-emerald-600" />
          </Button>
        ) : (
          <>
            <Button size="icon" variant="ghost" onClick={() => onEdit(c)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onMarkKia(c)}
              disabled={isPending}
              title="Mark K.I.A."
            >
              <Skull className="h-4 w-4 text-muted-foreground" />
            </Button>
          </>
        )}
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
