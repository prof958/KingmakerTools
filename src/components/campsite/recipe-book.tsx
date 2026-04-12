"use client";

/**
 * RecipeBook — manage discovered and undiscovered meal recipes.
 * Recipes persist in the database via the /api/recipes endpoints.
 */

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { BookOpen, Plus, Eye, EyeOff, Trash2, Pencil } from "lucide-react";

export interface RecipeData {
  id: string;
  name: string;
  ingredients: string | null;
  dc: number | null;
  dcSurvival: number | null;
  dcCookingLore: number | null;
  effectsCritSuccess: string | null;
  effectsSuccess: string | null;
  effectsFail: string | null;
  effectsCritFail: string | null;
  isDiscovered: boolean;
}

export function RecipeBook({
  initialRecipes,
}: {
  initialRecipes: RecipeData[];
}) {
  const [recipes, setRecipes] = useState<RecipeData[]>(initialRecipes);
  const [isPending, startTransition] = useTransition();
  const [addOpen, setAddOpen] = useState(false);

  // New recipe form state
  const [name, setName] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [dc, setDc] = useState("");
  const [dcSurvival, setDcSurvival] = useState("");
  const [dcCookingLore, setDcCookingLore] = useState("");
  const [effectsCritSuccess, setEffectsCritSuccess] = useState("");
  const [effectsSuccess, setEffectsSuccess] = useState("");
  const [effectsFail, setEffectsFail] = useState("");
  const [effectsCritFail, setEffectsCritFail] = useState("");
  const [isDiscovered, setIsDiscovered] = useState(false);

  function resetForm() {
    setName("");
    setIngredients("");
    setDc("");
    setDcSurvival("");
    setDcCookingLore("");
    setEffectsCritSuccess("");
    setEffectsSuccess("");
    setEffectsFail("");
    setEffectsCritFail("");
    setIsDiscovered(false);
  }

  function addRecipe() {
    if (!name.trim()) return;
    startTransition(async () => {
      const res = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          ingredients: ingredients.trim() || null,
          dc: dc ? parseInt(dc, 10) : null,
          dcSurvival: dcSurvival ? parseInt(dcSurvival, 10) : null,
          dcCookingLore: dcCookingLore ? parseInt(dcCookingLore, 10) : null,
          effectsCritSuccess: effectsCritSuccess.trim() || null,
          effectsSuccess: effectsSuccess.trim() || null,
          effectsFail: effectsFail.trim() || null,
          effectsCritFail: effectsCritFail.trim() || null,
          isDiscovered,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setRecipes((prev) => [created, ...prev]);
        resetForm();
        setAddOpen(false);
      }
    });
  }

  function toggleDiscovered(recipe: RecipeData) {
    startTransition(async () => {
      const res = await fetch(`/api/recipes/${recipe.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDiscovered: !recipe.isDiscovered }),
      });
      if (res.ok) {
        setRecipes((prev) =>
          prev.map((r) =>
            r.id === recipe.id ? { ...r, isDiscovered: !r.isDiscovered } : r,
          ),
        );
      }
    });
  }

  function deleteRecipe(id: string) {
    startTransition(async () => {
      const res = await fetch(`/api/recipes/${id}`, { method: "DELETE" });
      if (res.ok) {
        setRecipes((prev) => prev.filter((r) => r.id !== id));
      }
    });
  }

  function updateRecipe(id: string, data: Partial<RecipeData>) {
    startTransition(async () => {
      const res = await fetch(`/api/recipes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const updated = await res.json();
        setRecipes((prev) => prev.map((r) => (r.id === id ? updated : r)));
      }
    });
  }

  const discovered = recipes.filter((r) => r.isDiscovered);
  const undiscovered = recipes.filter((r) => !r.isDiscovered);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            <CardTitle>Recipe Book</CardTitle>
            <Badge variant="secondary">{discovered.length} discovered</Badge>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3">
              <Plus className="mr-1 h-4 w-4" />
              Add Recipe
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Add Recipe</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1">
                  <Label htmlFor="r-name">Name</Label>
                  <Input
                    id="r-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Basic Meal"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="r-ing">Ingredients</Label>
                  <Input
                    id="r-ing"
                    value={ingredients}
                    onChange={(e) => setIngredients(e.target.value)}
                    placeholder="2× rations, herbs"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="r-dc-s">DC Survival</Label>
                    <Input
                      id="r-dc-s"
                      type="text"
                      inputMode="numeric"
                      value={dcSurvival}
                      onChange={(e) => { if (e.target.value === "" || /^\d*$/.test(e.target.value)) setDcSurvival(e.target.value); }}
                      placeholder="18"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="r-dc-c">DC Cooking Lore</Label>
                    <Input
                      id="r-dc-c"
                      type="text"
                      inputMode="numeric"
                      value={dcCookingLore}
                      onChange={(e) => { if (e.target.value === "" || /^\d*$/.test(e.target.value)) setDcCookingLore(e.target.value); }}
                      placeholder="14"
                    />
                  </div>
                  <div className="flex items-end gap-2 pb-0.5">
                    <Button
                      variant={isDiscovered ? "default" : "outline"}
                      size="sm"
                      onClick={() => setIsDiscovered((d) => !d)}
                      type="button"
                    >
                      {isDiscovered ? (
                        <Eye className="mr-1 h-4 w-4" />
                      ) : (
                        <EyeOff className="mr-1 h-4 w-4" />
                      )}
                      {isDiscovered ? "Discovered" : "Undiscovered"}
                    </Button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="r-crit-suc">Effects on Critical Success</Label>
                  <Textarea
                    id="r-crit-suc"
                    value={effectsCritSuccess}
                    onChange={(e) => setEffectsCritSuccess(e.target.value)}
                    rows={2}
                    placeholder="Party gains +2 status bonus to saving throws"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="r-suc">Effects on Success</Label>
                  <Textarea
                    id="r-suc"
                    value={effectsSuccess}
                    onChange={(e) => setEffectsSuccess(e.target.value)}
                    rows={2}
                    placeholder="Party gains +1 status bonus to saving throws"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="r-fail">Effects on Failure</Label>
                  <Textarea
                    id="r-fail"
                    value={effectsFail}
                    onChange={(e) => setEffectsFail(e.target.value)}
                    rows={2}
                    placeholder="Party becomes sickened 1"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="r-crit-fail">Effects on Critical Failure</Label>
                  <Textarea
                    id="r-crit-fail"
                    value={effectsCritFail}
                    onChange={(e) => setEffectsCritFail(e.target.value)}
                    rows={2}
                    placeholder="Party becomes sickened 2"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={addRecipe}
                  disabled={isPending || !name.trim()}
                >
                  {isPending ? "Adding…" : "Add Recipe"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {recipes.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No recipes yet. Add one to get started.
          </p>
        )}

        {/* Discovered recipes */}
        {discovered.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">
              Discovered
            </h4>
            {discovered.map((recipe) => (
              <RecipeRow
                key={recipe.id}
                recipe={recipe}
                onToggle={() => toggleDiscovered(recipe)}
                onDelete={() => deleteRecipe(recipe.id)}
                onUpdate={(data) => updateRecipe(recipe.id, data)}
                isPending={isPending}
              />
            ))}
          </div>
        )}

        {/* Undiscovered recipes */}
        {undiscovered.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">
              Undiscovered
            </h4>
            {undiscovered.map((recipe) => (
              <RecipeRow
                key={recipe.id}
                recipe={recipe}
                onToggle={() => toggleDiscovered(recipe)}
                onDelete={() => deleteRecipe(recipe.id)}
                onUpdate={(data) => updateRecipe(recipe.id, data)}
                isPending={isPending}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RecipeRow({
  recipe,
  onToggle,
  onDelete,
  onUpdate,
  isPending,
}: {
  recipe: RecipeData;
  onToggle: () => void;
  onDelete: () => void;
  onUpdate: (data: Partial<RecipeData>) => void;
  isPending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  // Edit form state
  const [eName, setEName] = useState(recipe.name);
  const [eIngredients, setEIngredients] = useState(recipe.ingredients ?? "");
  const [eDcSurvival, setEDcSurvival] = useState(recipe.dcSurvival?.toString() ?? "");
  const [eDcCookingLore, setEDcCookingLore] = useState(recipe.dcCookingLore?.toString() ?? "");
  const [eEffectsCritSuccess, setEEffectsCritSuccess] = useState(recipe.effectsCritSuccess ?? "");
  const [eEffectsSuccess, setEEffectsSuccess] = useState(recipe.effectsSuccess ?? "");
  const [eEffectsFail, setEEffectsFail] = useState(recipe.effectsFail ?? "");
  const [eEffectsCritFail, setEEffectsCritFail] = useState(recipe.effectsCritFail ?? "");
  const [eIsDiscovered, setEIsDiscovered] = useState(recipe.isDiscovered);

  function openEdit() {
    setEName(recipe.name);
    setEIngredients(recipe.ingredients ?? "");
    setEDcSurvival(recipe.dcSurvival?.toString() ?? "");
    setEDcCookingLore(recipe.dcCookingLore?.toString() ?? "");
    setEEffectsCritSuccess(recipe.effectsCritSuccess ?? "");
    setEEffectsSuccess(recipe.effectsSuccess ?? "");
    setEEffectsFail(recipe.effectsFail ?? "");
    setEEffectsCritFail(recipe.effectsCritFail ?? "");
    setEIsDiscovered(recipe.isDiscovered);
    setEditOpen(true);
  }

  function saveEdit() {
    if (!eName.trim()) return;
    onUpdate({
      name: eName.trim(),
      ingredients: eIngredients.trim() || null,
      dcSurvival: eDcSurvival ? parseInt(eDcSurvival, 10) : null,
      dcCookingLore: eDcCookingLore ? parseInt(eDcCookingLore, 10) : null,
      effectsCritSuccess: eEffectsCritSuccess.trim() || null,
      effectsSuccess: eEffectsSuccess.trim() || null,
      effectsFail: eEffectsFail.trim() || null,
      effectsCritFail: eEffectsCritFail.trim() || null,
      isDiscovered: eIsDiscovered,
    });
    setEditOpen(false);
  }

  return (
    <div className="rounded-md border p-3 space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{recipe.name}</span>
          {recipe.dcSurvival && (
            <Badge variant="outline" className="text-xs">
              Survival DC {recipe.dcSurvival}
            </Badge>
          )}
          {recipe.dcCookingLore && (
            <Badge variant="outline" className="text-xs">
              Cooking Lore DC {recipe.dcCookingLore}
            </Badge>
          )}
          {!recipe.dcSurvival && !recipe.dcCookingLore && recipe.dc && (
            <Badge variant="outline" className="text-xs">
              DC {recipe.dc}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={openEdit}
            disabled={isPending}
            title="Edit recipe"
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onToggle}
            disabled={isPending}
            title={recipe.isDiscovered ? "Mark undiscovered" : "Mark discovered"}
          >
            {recipe.isDiscovered ? (
              <Eye className="h-3 w-3" />
            ) : (
              <EyeOff className="h-3 w-3" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
            onClick={onDelete}
            disabled={isPending}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {recipe.ingredients && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">Ingredients:</span> {recipe.ingredients}
        </p>
      )}

      {/* Expandable effects */}
      {(recipe.effectsCritSuccess || recipe.effectsSuccess || recipe.effectsFail || recipe.effectsCritFail) && (
        <>
          <button
            className="text-xs text-blue-400 hover:underline"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? "Hide effects" : "Show effects"}
          </button>
          {open && (
            <div className="mt-1 space-y-1 text-xs">
              {recipe.effectsCritSuccess && (
                <p>
                  <span className="font-medium text-emerald-400">Crit Success:</span>{" "}
                  {recipe.effectsCritSuccess}
                </p>
              )}
              {recipe.effectsSuccess && (
                <p>
                  <span className="font-medium text-green-400">Success:</span>{" "}
                  {recipe.effectsSuccess}
                </p>
              )}
              {recipe.effectsFail && (
                <p>
                  <span className="font-medium text-red-400">Failure:</span>{" "}
                  {recipe.effectsFail}
                </p>
              )}
              {recipe.effectsCritFail && (
                <p>
                  <span className="font-medium text-rose-400">Crit Failure:</span>{" "}
                  {recipe.effectsCritFail}
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Recipe</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor={`e-name-${recipe.id}`}>Name</Label>
              <Input
                id={`e-name-${recipe.id}`}
                value={eName}
                onChange={(e) => setEName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`e-ing-${recipe.id}`}>Ingredients</Label>
              <Input
                id={`e-ing-${recipe.id}`}
                value={eIngredients}
                onChange={(e) => setEIngredients(e.target.value)}
                placeholder="2× rations, herbs"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label htmlFor={`e-dc-s-${recipe.id}`}>DC Survival</Label>
                <Input
                  id={`e-dc-s-${recipe.id}`}
                  type="text"
                  inputMode="numeric"
                  value={eDcSurvival}
                  onChange={(e) => { if (e.target.value === "" || /^\d*$/.test(e.target.value)) setEDcSurvival(e.target.value); }}
                  placeholder="18"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`e-dc-c-${recipe.id}`}>DC Cooking Lore</Label>
                <Input
                  id={`e-dc-c-${recipe.id}`}
                  type="text"
                  inputMode="numeric"
                  value={eDcCookingLore}
                  onChange={(e) => { if (e.target.value === "" || /^\d*$/.test(e.target.value)) setEDcCookingLore(e.target.value); }}
                  placeholder="14"
                />
              </div>
              <div className="flex items-end gap-2 pb-0.5">
                <Button
                  variant={eIsDiscovered ? "default" : "outline"}
                  size="sm"
                  onClick={() => setEIsDiscovered((d) => !d)}
                  type="button"
                >
                  {eIsDiscovered ? (
                    <Eye className="mr-1 h-4 w-4" />
                  ) : (
                    <EyeOff className="mr-1 h-4 w-4" />
                  )}
                  {eIsDiscovered ? "Discovered" : "Undiscovered"}
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor={`e-crit-suc-${recipe.id}`}>Effects on Critical Success</Label>
              <Textarea
                id={`e-crit-suc-${recipe.id}`}
                value={eEffectsCritSuccess}
                onChange={(e) => setEEffectsCritSuccess(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`e-suc-${recipe.id}`}>Effects on Success</Label>
              <Textarea
                id={`e-suc-${recipe.id}`}
                value={eEffectsSuccess}
                onChange={(e) => setEEffectsSuccess(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`e-fail-${recipe.id}`}>Effects on Failure</Label>
              <Textarea
                id={`e-fail-${recipe.id}`}
                value={eEffectsFail}
                onChange={(e) => setEEffectsFail(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`e-crit-fail-${recipe.id}`}>Effects on Critical Failure</Label>
              <Textarea
                id={`e-crit-fail-${recipe.id}`}
                value={eEffectsCritFail}
                onChange={(e) => setEEffectsCritFail(e.target.value)}
                rows={2}
              />
            </div>
            <Button
              className="w-full"
              onClick={saveEdit}
              disabled={isPending || !eName.trim()}
            >
              {isPending ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
