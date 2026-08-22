"use client";

/**
 * WealthSummary — displays aggregate party wealth across all wallets.
 * Shows total in GP, breakdown by treasury vs individual, and coin distribution.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Coins, PawPrint } from "lucide-react";
import { walletToCp, formatAsGp, sumWallets } from "@/lib/pf2e/currency";

interface WalletData {
  id: string;
  characterId: string | null;
  cp: number;
  sp: number;
  gp: number;
  pp: number;
  character: { id: string; name: string; isCompanion?: boolean } | null;
}

export function WealthSummary({
  wallets,
}: {
  wallets: WalletData[];
}) {
  const treasuryWallets = wallets.filter((w) => !w.characterId);
  const treasury = treasuryWallets.length > 0 ? {
    ...treasuryWallets[0],
    cp: treasuryWallets.reduce((sum, w) => sum + w.cp, 0),
    sp: treasuryWallets.reduce((sum, w) => sum + w.sp, 0),
    gp: treasuryWallets.reduce((sum, w) => sum + w.gp, 0),
    pp: treasuryWallets.reduce((sum, w) => sum + w.pp, 0),
  } : undefined;

  const personalWallets = wallets.filter((w) => w.characterId && w.character);

  // Only sum wallets that are actually displayed (treasury + active character wallets)
  const displayedWallets = [...(treasury ? [treasury] : []), ...personalWallets];
  const allWalletValues = displayedWallets.map((w) => ({ cp: w.cp, sp: w.sp, gp: w.gp, pp: w.pp }));
  const totalWallet = sumWallets(allWalletValues);
  const totalCp = walletToCp(totalWallet);

  const treasuryCp = treasury ? walletToCp(treasury) : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Coins className="h-5 w-5" />
          <CardTitle>Party Wealth</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Total */}
          <div>
            <div className="text-3xl font-bold tracking-tight">
              {formatAsGp(totalCp)}
            </div>
            {totalCp > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {[
                  totalWallet.pp > 0 && `${totalWallet.pp} pp`,
                  totalWallet.gp > 0 && `${totalWallet.gp} gp`,
                  totalWallet.sp > 0 && `${totalWallet.sp} sp`,
                  totalWallet.cp > 0 && `${totalWallet.cp} cp`,
                ].filter(Boolean).join(", ")}
              </p>
            )}
          </div>

          {/* Treasury vs Personal breakdown */}
          {wallets.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t">
              {/* Treasury row */}
              {treasury && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Party Treasury
                  </span>
                  <span className="font-medium">
                    {treasuryCp > 0 ? formatAsGp(treasuryCp) : "0 gp"}
                  </span>
                </div>
              )}

              {/* PC wallets */}
              {personalWallets
                .filter((w) => !w.character?.isCompanion && walletToCp(w) > 0)
                .map((w) => {
                  const cp = walletToCp(w);
                  return (
                    <div
                      key={w.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-muted-foreground">
                        {w.character?.name ?? "Unknown"}
                      </span>
                      <span className="font-medium">
                        {formatAsGp(cp)}
                      </span>
                    </div>
                  );
                })}

              {/* Companion wallets */}
              {personalWallets.some((w) => w.character?.isCompanion && walletToCp(w) > 0) && (
                <>
                  <div className="flex items-center gap-2 pt-1">
                    <PawPrint className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Companions</span>
                    <div className="flex-1 border-t border-border" />
                  </div>
                  {personalWallets
                    .filter((w) => w.character?.isCompanion && walletToCp(w) > 0)
                    .map((w) => {
                      const cp = walletToCp(w);
                      return (
                        <div
                          key={w.id}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="text-muted-foreground">
                            {w.character?.name ?? "Unknown"}
                          </span>
                          <span className="font-medium">
                            {formatAsGp(cp)}
                          </span>
                        </div>
                      );
                    })}
                </>
              )}

              {personalWallets.length === 0 && !treasury && (
                <p className="text-xs text-muted-foreground">
                  No wallets found. Add characters in the Inventory tab.
                </p>
              )}
            </div>
          )}

        </div>
      </CardContent>
    </Card>
  );
}
