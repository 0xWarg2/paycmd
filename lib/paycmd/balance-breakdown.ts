/**
 * `scaUnreadable` means the SCA read for that chain errored, not that it returned zero. The two used
 * to be indistinguishable downstream — a failed read summed as 0 and, with no Gateway balance on the
 * same chain, dropped the row entirely — so USDC that had actually arrived read as "not here".
 */
export type BalanceBreakdownRow = {
  chain: string;
  sca: number;
  gateway: number;
  scaUnreadable: boolean;
};

export type BalanceBreakdown = {
  scaTotal: number;
  gatewayTotal: number;
  total: number;
  rows: BalanceBreakdownRow[];
  chainsChecked: number;
};

export function balanceBreakdown(result: any, chain?: string): BalanceBreakdown {
  const balances: any[] = Array.isArray(result?.balances) ? result.balances : [];
  const perChain = new Map<string, { sca: number; gateway: number; scaUnreadable: boolean }>();
  const chainsChecked = new Set<string>();

  for (const entry of balances) {
    for (const item of entry?.chainBalances ?? []) {
      if (chain && item.chain !== chain) continue;
      chainsChecked.add(item.chain);
      const row = perChain.get(item.chain) ?? { sca: 0, gateway: 0, scaUnreadable: false };
      // A null balance is the read having failed (lib/paycmd/ai/wallet-context-server.ts sets it on
      // error). Adding it as 0 would report a floor as an exact figure.
      if (item.balance === null || item.balance === undefined) {
        row.scaUnreadable = true;
      } else {
        row.sca += Number(item.balance) || 0;
      }
      perChain.set(item.chain, row);
    }
    for (const item of entry?.gatewayBalances ?? []) {
      if (chain && item.chain !== chain) continue;
      chainsChecked.add(item.chain);
      const row = perChain.get(item.chain) ?? { sca: 0, gateway: 0, scaUnreadable: false };
      row.gateway += Number(item.balance) || 0;
      perChain.set(item.chain, row);
    }
  }

  const rows = [...perChain.entries()]
    .map(([chainKey, row]) => ({ chain: chainKey, ...row }))
    // An unreadable chain keeps its row even at zero: "we could not read this" is the one thing the
    // user needs to see, and hiding it is what made a credited payment look lost.
    .filter((row) => Boolean(chain) || row.sca > 0 || row.gateway > 0 || row.scaUnreadable)
    .sort((left, right) => right.sca + right.gateway - (left.sca + left.gateway));
  const scaTotal = rows.reduce((sum, row) => sum + row.sca, 0);
  const gatewayTotal = rows.reduce((sum, row) => sum + row.gateway, 0);

  return {
    scaTotal,
    gatewayTotal,
    total: scaTotal + gatewayTotal,
    rows,
    chainsChecked: chainsChecked.size,
  };
}
