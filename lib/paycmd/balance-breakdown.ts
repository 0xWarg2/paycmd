export type BalanceBreakdownRow = { chain: string; sca: number; gateway: number };

export type BalanceBreakdown = {
  scaTotal: number;
  gatewayTotal: number;
  total: number;
  rows: BalanceBreakdownRow[];
  chainsChecked: number;
};

export function balanceBreakdown(result: any, chain?: string): BalanceBreakdown {
  const balances: any[] = Array.isArray(result?.balances) ? result.balances : [];
  const perChain = new Map<string, { sca: number; gateway: number }>();
  const chainsChecked = new Set<string>();

  for (const entry of balances) {
    for (const item of entry?.chainBalances ?? []) {
      if (chain && item.chain !== chain) continue;
      chainsChecked.add(item.chain);
      const row = perChain.get(item.chain) ?? { sca: 0, gateway: 0 };
      if (item.balance !== null && item.balance !== undefined) {
        row.sca += Number(item.balance) || 0;
      }
      perChain.set(item.chain, row);
    }
    for (const item of entry?.gatewayBalances ?? []) {
      if (chain && item.chain !== chain) continue;
      chainsChecked.add(item.chain);
      const row = perChain.get(item.chain) ?? { sca: 0, gateway: 0 };
      row.gateway += Number(item.balance) || 0;
      perChain.set(item.chain, row);
    }
  }

  const rows = [...perChain.entries()]
    .map(([chainKey, row]) => ({ chain: chainKey, ...row }))
    .filter((row) => Boolean(chain) || row.sca > 0 || row.gateway > 0)
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
