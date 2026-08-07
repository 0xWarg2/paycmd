export type PayrollRecipient = {
  contactId: string;
  label: string;
  address: string;
  destinationChain: string;
};

export type PayrollPreviewInput = {
  group_id: string;
  group_name: string;
  recipients: PayrollRecipient[];
  excluded: Array<{ contactId?: string; label?: string; reason: string }>;
  per_recipient_amount: string;
  source_chain: string;
  recipient_fingerprint: string;
};

export function usdcToAtomic(value: string) {
  const match = value.match(/^(\d+)(?:\.(\d{1,6}))?$/);
  if (!match) throw new Error("INVALID_USDC_AMOUNT");
  return BigInt(match[1]) * 1_000_000n + BigInt((match[2] ?? "").padEnd(6, "0"));
}

export function atomicToUsdc(value: bigint) {
  const whole = value / 1_000_000n;
  const fraction = (value % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function normalizePayrollPreview(input: PayrollPreviewInput) {
  if (!input.group_id || !input.group_name || !input.recipient_fingerprint || input.recipients.length === 0) {
    throw new Error("PAYROLL_GROUP_EMPTY");
  }
  const perRecipientAtomic = usdcToAtomic(input.per_recipient_amount);
  if (perRecipientAtomic <= 0n) throw new Error("INVALID_USDC_AMOUNT");
  const recipientCount = input.recipients.length;
  return {
    groupId: input.group_id,
    groupName: input.group_name,
    recipients: input.recipients,
    excluded: input.excluded,
    sourceChain: input.source_chain,
    recipientFingerprint: input.recipient_fingerprint,
    recipientCount,
    perRecipientAmount: atomicToUsdc(perRecipientAtomic),
    totalAmount: atomicToUsdc(perRecipientAtomic * BigInt(recipientCount)),
  };
}
