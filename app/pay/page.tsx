import { ArcWalletPaymentApp } from "@/components/arc-wallet-payment-app";

export const dynamic = "force-dynamic";
export const metadata = { title: "HeyPayna | Arc wallet payments" };

export default function ArcPaymentPage() {
  return <ArcWalletPaymentApp mainnetEnabled={process.env.ARC_MAINNET_PAYMENTS_ENABLED === "true"} />;
}
