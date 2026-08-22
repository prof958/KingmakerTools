"use client";

/**
 * WalletManager — view and edit party treasury and character wallets.
 * Includes a loot-split calculator.
 */

import { useState, useEffect, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
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
import { Coins, Split, Save, PawPrint } from "lucide-react";
import { walletToCp, formatCurrency, formatAsGp, cpToWallet } from "@/lib/pf2e/currency";

interface Character {
  id: string;
  name: string;
  emoji: string | null;
  imageUrl: string | null;
  isCompanion: boolean;
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
  useEffect(() => { setWallets(initialWallets); }, [initialWallets]);
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ cp: 0, sp: 0, gp: 0, pp: 0 });

  // Loot split state
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitGp, setSplitGp] = useState("");

  const treasuryWallets = wallets.filter((w) => !w.characterId);
  const treasury = treasuryWallets.length > 0 ? {
    ...treasuryWallets[0],
    cp: treasuryWallets.reduce((sum, w) => sum + w.cp, 0),
    sp: treasuryWallets.reduce((sum, w) => sum + w.sp, 0),
    gp: treasuryWallets.reduce((sum, w) => sum + w.gp, 0),
    pp: treasuryWallets.reduce((sum, w) => sum + w.pp, 0),
  } : undefined;

  const characterWallets = wallets.filter((w) => w.characterId && w.character);

  // Only sum wallets that are actually displayed (treasury + active character wallets)
  const displayedWallets = [...(treasury ? [treasury] : []), ...characterWallets];
  const totalCp = displayedWallets.reduce(
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
                    type="text"
                    inputMode="decimal"
                    value={splitGp}
                    onChange={(e) => { if (e.target.value === "" || /^\d*\.?\d*$/.test(e.target.value)) setSplitGp(e.target.value); }}
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
      <CardContent className="space-y-1">
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

        {characterWallets.length > 0 && treasury && <Separator className="my-1" />}

        {/* PC Wallets */}
        {characterWallets
          .filter((w) => !w.character?.isCompanion)
          .map((w) => (
            <WalletRow
              key={w.id}
              label={w.character?.name ?? "Unknown"}
              emoji={w.character?.emoji}
              imageUrl={w.character?.imageUrl}
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

        {/* Companion Wallets */}
        {characterWallets.some((w) => w.character?.isCompanion) && (
          <>
            <div className="flex items-center gap-2 pt-0.5">
              <PawPrint className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Companions</span>
              <div className="flex-1 border-t border-border" />
            </div>
            {characterWallets
              .filter((w) => w.character?.isCompanion)
              .map((w) => (
                <WalletRow
                  key={w.id}
                  label={w.character?.name ?? "Unknown"}
                  emoji={w.character?.emoji}
                  imageUrl={w.character?.imageUrl}
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
          </>
        )}

        {characterWallets.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Character wallets will appear here once you add party members.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function WalletRow({
  label,
  emoji,
  imageUrl,
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
  emoji?: string | null;
  imageUrl?: string | null;
  wallet: WalletData;
  isEditing: boolean;
  editValues: { cp: number; sp: number; gp: number; pp: number };
  onEditValues: React.Dispatch<React.SetStateAction<{ cp: number; sp: number; gp: number; pp: number }>>;
  onStartEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  isPending: boolean;
  isTreasury?: boolean;
}) {
  const total = walletToCp({ cp: wallet.cp, sp: wallet.sp, gp: wallet.gp, pp: wallet.pp });

  if (isEditing) {
    return (
      <div className="rounded-md border p-2 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium flex items-center gap-1.5">
            {isTreasury ? "💰" : imageUrl ? (
              <img src={imageUrl} alt={label} className="w-4 h-4 rounded-full object-cover inline-block" />
            ) : emoji ?? "🧑"} {label}
          </span>
          <div className="flex gap-1">
            <Button size="sm" className="h-7 text-xs" onClick={onSave} disabled={isPending}>
              <Save className="mr-1 h-3 w-3" /> Save
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {(["pp", "gp", "sp", "cp"] as const).map((denom) => (
            <div key={denom}>
              <Label className="text-[10px] uppercase">{denom}</Label>
              <NumberInput
                min={0}
                fallback={0}
                value={editValues[denom]}
                commitOnChange={true}
                onValueChange={(val) =>
                  onEditValues((prev) => ({
                    ...prev,
                    [denom]: val,
                  }))
                }
                className="h-7 text-xs"
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-between rounded-md border px-2.5 py-1.5 cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={onStartEdit}
    >
      <span className="text-sm font-medium flex items-center gap-1.5">
        {isTreasury ? "💰" : imageUrl ? (
          <img src={imageUrl} alt={label} className="w-4 h-4 rounded-full object-cover inline-block" />
        ) : emoji ?? "🧑"} {label}
      </span>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {wallet.pp > 0 && <span>{wallet.pp} pp</span>}
        <span>{wallet.gp} gp</span>
        {wallet.sp > 0 && <span>{wallet.sp} sp</span>}
        {wallet.cp > 0 && <span>{wallet.cp} cp</span>}
        <Badge variant="outline" className="ml-1 text-[10px] px-1.5 py-0">
          {formatAsGp(total)}
        </Badge>
      </div>
    </div>
  );
}
