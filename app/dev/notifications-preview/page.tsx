import { notFound } from "next/navigation";

import { LanguageSwitcher } from "@/components/language-switcher";
import { ActivityView, type ActivityNotification } from "@/components/paycmd/activity-view";
import { ThemeSwitcher } from "@/components/theme-switcher";

// One row per notification shape the composer can produce, plus one legacy row whose body is
// the old multi-line receipt dump — that one must clamp to two lines instead of overflowing.
// The Transactions tab shows its error state here (no session) — expected, this fixture only
// verifies the Notifications tab.
const FIXTURES: ActivityNotification[] = [
  {
    id: "fx-transfer-unified",
    type: "command_success",
    title: "Đã chuyển 5 USDC → Base Sepolia",
    body: "Nguồn: Arbitrum 3 + Arc 2 · Phí 0.020001 USDC",
    status: "unread",
    command_execution_id: "fx-exec-1",
    created_at: "2026-08-25T09:12:00.000Z",
    metadata: {
      v: 1,
      command: "transfer",
      outcome: "success",
      amount: "5",
      sourceMode: "unified",
      sourceChain: null,
      destinationChain: "baseSepolia",
      sourceAllocations: [
        { sourceChain: "arbitrumSepolia", amount: "3" },
        { sourceChain: "arcTestnet", amount: "2" },
      ],
      fee: "0.020001",
      feeEstimated: false,
      txHash: "0x2f8a41c09be7d51f0f6f1f3a9d1e8b25c4a7d90113579bdf02468ace13579bdf",
    },
  },
  {
    id: "fx-pay",
    type: "command_success",
    title: "Đã thanh toán 2 USDC cho Minh",
    body: "Đến Ethereum Sepolia · Nguồn: Arbitrum · Phí ~0.01 USDC",
    status: "unread",
    command_execution_id: "fx-exec-2",
    created_at: "2026-08-25T08:47:00.000Z",
    metadata: {
      v: 1,
      command: "pay",
      outcome: "success",
      amount: "2",
      recipient: "Minh",
      sourceMode: "scoped",
      sourceChain: "arbitrumSepolia",
      destinationChain: "sepolia",
      fee: "0.01",
      feeEstimated: true,
      txHash: "0x9b3c5d7e9f1a3b5c7d9e1f2a4b6c8d0e2f4a6b8c0d2e4f6a8b0c2d4e6f8a0b2c",
    },
  },
  {
    id: "fx-deposit-pending",
    type: "gateway_deposit_pending",
    title: "Đang chờ xác nhận 10 USDC",
    body: "Circle đang xác nhận trên Base Sepolia, thường 13–19 phút.",
    status: "unread",
    command_execution_id: "fx-exec-3",
    created_at: "2026-08-25T08:30:00.000Z",
    metadata: {
      v: 1,
      command: "deposit",
      outcome: "pending",
      amount: "10",
      sourceChain: "baseSepolia",
      txHash: "0x4e6f8a0b2c4d6e8f0a1b3c5d7e9f1a3b5c7d9e1f2a4b6c8d0e2f4a6b8c0d2e4f",
    },
  },
  {
    id: "fx-deposit-available",
    type: "gateway_deposit_available",
    title: "Gateway balance đã sẵn sàng",
    body: "10 USDC trên Base Sepolia đã vào Circle Gateway và có thể dùng để transfer.",
    status: "read",
    command_execution_id: null,
    created_at: "2026-08-25T08:05:00.000Z",
    metadata: {
      v: 1,
      amount: "10",
      chain: "baseSepolia",
      sourceChain: "baseSepolia",
      txHash: "0x4e6f8a0b2c4d6e8f0a1b3c5d7e9f1a3b5c7d9e1f2a4b6c8d0e2f4a6b8c0d2e4f",
      finalitySource: "poll",
    },
  },
  {
    id: "fx-failed",
    type: "command_failed",
    title: "Chuyển 4 USDC không thành công",
    body: "Insufficient Gateway balance on the source chain. · Tiền có thể đã được chuyển — kiểm tra Lịch sử.",
    status: "unread",
    command_execution_id: "fx-exec-4",
    created_at: "2026-08-25T07:58:00.000Z",
    metadata: {
      v: 1,
      command: "transfer",
      outcome: "failed",
      amount: "4",
      sourceChain: "arbitrumSepolia",
      destinationChain: "arcTestnet",
    },
  },
  {
    id: "fx-legacy",
    type: "command_success",
    title: "Command completed",
    body: "Transfer success: ARB-SEPOLIA -> BASE-SEPOLIA Recipient nhận: 5 USDC Nguồn bị trừ: 5.020001 USDC Phí: 0.020001 USDC Bao gồm: Gateway base fee + transfer fee Destination gas do signer trả ID: 0x2f8a41c09be7d51f0f6f1f3a9d1e8b25c4a7d901 Mode: Manual gas — chuỗi receipt cũ nhiều dòng bị nhét vào một dòng, phải line-clamp.",
    status: "read",
    command_execution_id: "fx-exec-5",
    created_at: "2026-08-24T16:20:00.000Z",
    metadata: {},
  },
];

export default function NotificationsPreviewPage() {
  if (process.env.NODE_ENV === "production" || process.env.PAYNA_UI_FIXTURE !== "1") {
    notFound();
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/55 bg-surface/78 px-4 md:px-7">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Design fixture</div>
          <h1 className="text-base font-semibold">Notification inbox states</h1>
        </div>
        <div className="flex items-center gap-1.5">
          <LanguageSwitcher />
          <ThemeSwitcher />
        </div>
      </header>
      <div className="min-h-0 flex-1">
        <ActivityView initialTab="notifications" notifications={FIXTURES} />
      </div>
    </div>
  );
}
