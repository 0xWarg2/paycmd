type PublicGatewayConfig = Record<
  string,
  {
    domain: number;
    label: string;
    circleBlockchain: unknown | null;
    eoaWalletBlockchain: unknown | null;
  }
>;

export function projectPublicGatewaySupport(configs: PublicGatewayConfig) {
  return Object.entries(configs).map(([key, config]) => ({
    key,
    label: config.label,
    domain: config.domain,
    walletSdk: Boolean(config.circleBlockchain && config.eoaWalletBlockchain),
  }));
}
