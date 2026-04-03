/**
 * PF2e Currency System
 *
 * Denominations: CP (copper), SP (silver), GP (gold), PP (platinum)
 * Conversion: 10 CP = 1 SP, 10 SP = 1 GP, 10 GP = 1 PP
 * Bulk: 1,000 coins of any denomination = 1 Bulk
 */

export interface Wallet {
  cp: number;
  sp: number;
  gp: number;
  pp: number;
}

/**
 * Convert a wallet to total value in copper pieces.
 */
export function walletToCp(wallet: Wallet): number {
  return wallet.cp + wallet.sp * 10 + wallet.gp * 100 + wallet.pp * 1000;
}

/**
 * Convert copper pieces to a wallet with optimal denominations.
 */
export function cpToWallet(totalCp: number): Wallet {
  const pp = Math.floor(totalCp / 1000);
  totalCp -= pp * 1000;
  const gp = Math.floor(totalCp / 100);
  totalCp -= gp * 100;
  const sp = Math.floor(totalCp / 10);
  const cp = totalCp - sp * 10;
  return { cp, sp, gp, pp };
}

/**
 * Get total number of coins in a wallet.
 */
export function totalCoins(wallet: Wallet): number {
  return wallet.cp + wallet.sp + wallet.gp + wallet.pp;
}

/**
 * Calculate the bulk from coins.
 * 1,000 coins = 1 Bulk.
 */
export function coinBulk(wallet: Wallet): number {
  return Math.floor(totalCoins(wallet) / 1000);
}

/**
 * Format a copper piece value as a readable string.
 * e.g., 1234 cp → "1 gp, 2 sp, 3 cp" (with optimal breakdown)
 */
export function formatCurrency(totalCp: number): string {
  const wallet = cpToWallet(totalCp);
  const parts: string[] = [];

  if (wallet.pp > 0) parts.push(`${wallet.pp} pp`);
  if (wallet.gp > 0) parts.push(`${wallet.gp} gp`);
  if (wallet.sp > 0) parts.push(`${wallet.sp} sp`);
  if (wallet.cp > 0) parts.push(`${wallet.cp} cp`);

  return parts.length > 0 ? parts.join(", ") : "0 cp";
}

/**
 * Format wallet value as GP (the most common display format).
 * Shows decimal GP for partial values.
 */
export function formatAsGp(totalCp: number): string {
  const gp = totalCp / 100;
  if (gp === Math.floor(gp)) {
    return `${gp} gp`;
  }
  return `${gp.toFixed(2)} gp`;
}

/**
 * Split a total CP value evenly among a number of players.
 * Returns an array of wallets and any remainder that couldn't be split evenly.
 */
export function splitLoot(
  totalCp: number,
  numPlayers: number
): { shares: Wallet[]; remainderCp: number } {
  if (numPlayers <= 0) {
    return { shares: [], remainderCp: totalCp };
  }

  const shareValue = Math.floor(totalCp / numPlayers);
  const remainder = totalCp - shareValue * numPlayers;

  const shares: Wallet[] = [];
  for (let i = 0; i < numPlayers; i++) {
    shares.push(cpToWallet(shareValue));
  }

  return { shares, remainderCp: remainder };
}

/**
 * Add two wallets together.
 */
export function addWallets(a: Wallet, b: Wallet): Wallet {
  return {
    cp: a.cp + b.cp,
    sp: a.sp + b.sp,
    gp: a.gp + b.gp,
    pp: a.pp + b.pp,
  };
}

/**
 * Sum multiple wallets into a total.
 */
export function sumWallets(wallets: Wallet[]): Wallet {
  return wallets.reduce(
    (total, w) => addWallets(total, w),
    { cp: 0, sp: 0, gp: 0, pp: 0 }
  );
}
