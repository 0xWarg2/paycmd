import assert from "node:assert/strict";
import test from "node:test";

import { normalizePayrollPreview } from "./payroll-snapshot.ts";

test("formats exact six-decimal payroll totals without floating point", () => {
  const preview = normalizePayrollPreview({
    group_id: "g1",
    group_name: "Core Team",
    recipients: [
      { contactId: "c1", label: "Minh", address: "0x1111111111111111111111111111111111111111", destinationChain: "arcTestnet" },
      { contactId: "c2", label: "Lan", address: "0x2222222222222222222222222222222222222222", destinationChain: "arcTestnet" },
      { contactId: "c3", label: "Vu", address: "0x3333333333333333333333333333333333333333", destinationChain: "baseSepolia" },
    ],
    excluded: [],
    per_recipient_amount: "0.100001",
    source_chain: "baseSepolia",
    recipient_fingerprint: "abc123",
  });
  assert.equal(preview.recipientCount, 3);
  assert.equal(preview.totalAmount, "0.300003");
});

test("does not accept an empty fingerprint or recipient set", () => {
  assert.throws(() => normalizePayrollPreview({
    group_id: "g1",
    group_name: "Core Team",
    recipients: [],
    excluded: [],
    per_recipient_amount: "1",
    source_chain: "baseSepolia",
    recipient_fingerprint: "",
  }), /PAYROLL_GROUP_EMPTY/);
});
