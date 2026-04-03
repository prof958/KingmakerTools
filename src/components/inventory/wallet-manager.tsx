"use client";

/**
 * WalletManager — view and edit party treasury and character wallets.
 * Includes a loot-split calculator.
 */

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Coins, Split, Save } from "lucide-react";
import { walletToCp, formatCurrency, formatAsGp, cpToWallet } from "@/lib/pf2e/currency";

interface Character {
  id: string;
  name: string;
}

interface WalletData {
  id: string;
  characterId: string | null;
  cp: number;
  sp: number;
  gp: number;
  pp: number;
  character: Character | null;
}

export function WalletManager({
  initialWallets,
  characters,
}: {
  initialWallets: WalletData[];
  characters: Character[];
}) {
  const [wallets, setWallets] = useState<WalletData[]>(initialWallets);
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ cp: 0, sp: 0, gp: 0, pp: 0 });

  // Loot split state
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitGp, setSplitGp] = useState("");

  const treasury = wallets.find((w) => !w.characterId);
  const characterWallets = wallets.filter((w) => w.characterId);

  const totalCp = wallets.reduce(
    (sum, w) => sum + walletToCp({ cp: w.cp, sp: w.sp, gp: w.gp, pp: w.pp }),
    0
  );

  function startEdit(wallet: WalletData) {
    setEditingId(wallet.id);
    setEditValues({ cp: wallet.cp, sp: wallet.sp, gp: wallet.gp, pp: wallet.pp });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id: string) {
    startTransition(async () => {
      const res = await fetch("/api/wallets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallets: [{ id, ...editValues }],
        }),
      });
      if (res.ok) {
        setWallets((prev) =>
          prev.map((w) => (w.id === id ? { ...w, ...editValues } : w))
        );
        setEditingId(null);
      }
    });
  }

  async function handleLootSplit() {
    const gpValue = parseFloat(splitGp);
    if (!gpValue || gpValue <= 0 || characters.length === 0) return;

    const totalCpToSplit = Math.round(gpValue * 100);

    startTransition(async () => {
      const res = await fetch("/api/wallets/loot-split", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalCp: totalCpToSplit,
          characterIds: characters.map((c) => c.id),
        }),
      });
      if (res.ok) {
        // Refresh wallets
        const walletsRes = await fetch("/api/wallets");
        if (walletsRes.ok) {
          setWallets(await walletsRes.json());
        }
        setSplitOpen(false);
        setSplitGp("");
      }
    });
  }

  const splitPreview = (() => {
    const gpValue = parseFloat(splitGp);
    if (!gpValue || gpValue <= 0 || characters.length === 0) return null;

    const totalCpVal = Math.round(gpValue * 100);
    const perPerson = Math.floor(totalCpVal / characters.length);
    const remainder = totalCpVal - perPerson * characters.length;

    return {
      perPerson: cpToWallet(perPerson),
      remainder,
    };
  })();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Coins className="h-5 w-5" />
          Wallets
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            Total: {formatAsGp(totalCp)}
          </Badge>
          <Dialog open={splitOpen} onOpenChange={setSplitOpen}>
            <DialogTrigger
              disabled={characters.length === 0}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3"
            >
              <Split className="mr-1 h-4 w-4" /> Split Loot
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Split Loot</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label>Total loot value (gp)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={splitGp}
                    onChange={(e) => setSplitGp(e.target.value)}
                    placeholder="e.g., 100"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Splitting among {characters.length} character{characters.length !== 1 ? "s" : ""}:
                  {" "}{characters.map((c) => c.name).join(", ")}
                </p>
                {splitPreview && (
                  <div className="rounded-md bg-muted p-3 space-y-1">
                    <p className="text-sm font-medium">
                      Each receives: {formatCurrency(walletToCp(splitPreview.perPerson))}
                    </p>
                    {splitPreview.remainder > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Remainder ({splitPreview.remainder} cp) goes to party treasury
                      </p>
                    )}
                  </div>
                )}
                <Button
                  onClick={handleLootSplit}
                  disabled={isPending || !splitPreview}
                  className="w-full"
                >
                  {isPending ? "Splitting..." : "Split & Apply"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Party Treasury */}
        {treasury && (
          <WalletRow
            label="Party Treasury"
            wallet={treasury}
            isEditing={editingId === treasury.id}
            editValues={editValues}
            onEditValues={setEditValues}
            onStartEdit={() => startEdit(treasury)}
            onSave={() => saveEdit(treasury.id)}
            onCancel={cancelEdit}
            isPending={isPending}
            isTreasury
          />
        )}

        {characterWallets.length > 0 && <Separator />}

        {/* Character Wallets */}
        {characterWallets.map((w) => (
          <WalletRow
            key={w.id}
            label={w.character?.name ?? "Unknown"}
            wallet={w}
            isEditing={editingId === w.id}
            editValues={editValues}
            onEditValues={setEditValues}
            onStartEdit={() => startEdit(w)}
            onSave={() => saveEdit(w.id)}
            onCancel={cancelEdit}
            isPending={isPending}
          />
        ))}

        {characterWallets.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Character wallets will appear here once you add party members.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function WalletRow({
  label,
  wallet,
  isEditing,
  editValues,
  onEditValues,
  onStartEdit,
  onSave,
  onCancel,
  isPending,
  isTreasury,
}: {
  label: string;
  wallet: WalletData;
  isEditing: boolean;
  editValues: { cp: number; sp: number; gp: number; pp: number };
  onEditValues: (val: { cp: number; sp: number; gp: number; pp: number }) => void;
  onStartEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  isPending: boolean;
  isTreasury?: boolean;
}) {
  const total = walletToCp({ cp: wallet.cp, sp: wallet.sp, gp: wallet.gp, pp: wallet.pp });

  if (isEditing) {
    return (
      <div className="rounded-md border p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-medium">
            {isTreasury ? "💰" : "🧑"} {label}
          </span>
          <div className="flex gap-1">
            <Button size="sm" onClick={onSave} disabled={isPending}>
              <Save className="mr-1 h-3 w-3" /> Save
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {(["pp", "gp", "sp", "cp"] as const).map((denom) => (
            <div key={denom}>
              <Label className="text-xs uppercase">{denom}</Label>
              <Input
                type="number"
                min={0}
                value={editValues[denom]}
                onChange={(e) =>
                  onEditValues({
                    ...editValues,
                    [denom]: parseInt(e.target.value) || 0,
                  })
                }
                className="h-8"
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-between rounded-md border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={onStartEdit}
    >
      <div className="flex items-center gap-2">
        <span className="font-medium">
          {isTreasury ? "💰" : "🧑"} {label}
        </span>
      </div>
      <div className="flex items-center gap-3 text-sm">
        {wallet.pp > 0 && <span>{wallet.pp} pp</span>}
        <span>{wallet.gp} gp</span>
        {wallet.sp > 0 && <span>{wallet.sp} sp</span>}
        {wallet.cp > 0 && <span>{wallet.cp} cp</span>}
        <Badge variant="outline" className="ml-2">
          {formatAsGp(total)}
        </Badge>
      </div>
    </div>
  );
}
