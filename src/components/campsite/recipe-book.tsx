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
import { BookOpen, Plus, Eye, EyeOff, Trash2 } from "lucide-react";

export interface RecipeData {
  id: string;
  name: string;
  ingredients: string | null;
  dc: number | null;
  effectsSuccess: string | null;
  effectsFail: string | null;
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
  const [effectsSuccess, setEffectsSuccess] = useState("");
  const [effectsFail, setEffectsFail] = useState("");
  const [isDiscovered, setIsDiscovered] = useState(false);

  function resetForm() {
    setName("");
    setIngredients("");
    setDc("");
    setEffectsSuccess("");
    setEffectsFail("");
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
          effectsSuccess: effectsSuccess.trim() || null,
          effectsFail: effectsFail.trim() || null,
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
            <DialogContent>
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="r-dc">DC</Label>
                    <Input
                      id="r-dc"
                      type="text"
                      inputMode="numeric"
                      value={dc}
                      onChange={(e) => { if (e.target.value === "" || /^\d*$/.test(e.target.value)) setDc(e.target.value); }}
                      placeholder="18"
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
  isPending,
}: {
  recipe: RecipeData;
  onToggle: () => void;
  onDelete: () => void;
  isPending: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-md border p-3 space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{recipe.name}</span>
          {recipe.dc && (
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
      {(recipe.effectsSuccess || recipe.effectsFail) && (
        <>
          <button
            className="text-xs text-blue-400 hover:underline"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? "Hide effects" : "Show effects"}
          </button>
          {open && (
            <div className="mt-1 space-y-1 text-xs">
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
            </div>
          )}
        </>
      )}
    </div>
  );
}
