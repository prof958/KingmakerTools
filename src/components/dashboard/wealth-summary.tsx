"use client";

/**
 * WealthSummary — displays aggregate party wealth across all wallets.
 * Shows total in GP, breakdown by treasury vs individual, and coin distribution.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Coins, PawPrint } from "lucide-react";
import { walletToCp, formatAsGp, formatCurrency, sumWallets } from "@/lib/pf2e/currency";

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
  const treasury = wallets.find((w) => !w.characterId);
  const personalWallets = wallets.filter((w) => w.characterId);

  const allWalletValues = wallets.map((w) => ({ cp: w.cp, sp: w.sp, gp: w.gp, pp: w.pp }));
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
                {formatCurrency(totalCp)}
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
                .filter((w) => !w.character?.isCompanion)
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
                        {cp > 0 ? formatAsGp(cp) : "0 gp"}
                      </span>
                    </div>
                  );
                })}

              {/* Companion wallets */}
              {personalWallets.some((w) => w.character?.isCompanion) && (
                <>
                  <div className="flex items-center gap-2 pt-1">
                    <PawPrint className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Companions</span>
                    <div className="flex-1 border-t border-border" />
                  </div>
                  {personalWallets
                    .filter((w) => w.character?.isCompanion)
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
                            {cp > 0 ? formatAsGp(cp) : "0 gp"}
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

          {/* Coin type breakdown */}
          {totalCp > 0 && (
            <div className="flex gap-2 pt-2 border-t">
              {totalWallet.pp > 0 && (
                <Badge variant="outline" className="text-xs">
                  {totalWallet.pp} PP
                </Badge>
              )}
              {totalWallet.gp > 0 && (
                <Badge variant="outline" className="text-xs">
                  {totalWallet.gp} GP
                </Badge>
              )}
              {totalWallet.sp > 0 && (
                <Badge variant="outline" className="text-xs">
                  {totalWallet.sp} SP
                </Badge>
              )}
              {totalWallet.cp > 0 && (
                <Badge variant="outline" className="text-xs">
                  {totalWallet.cp} CP
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
