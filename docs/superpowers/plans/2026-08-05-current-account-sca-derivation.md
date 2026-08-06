# Current Account SCA Derivation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Safely derive the current Payna test account's existing Circle SCA onto Arbitrum Sepolia, OP Sepolia, Polygon Amoy, and Unichain Sepolia without moving funds.

**Architecture:** Put all plan construction, identity validation, and apply sequencing in a dependency-free module that can be tested without Circle or Supabase. Add a narrow administrative CLI that resolves one explicit Payna user, calls the Circle SDK only in `--apply` mode, and verifies the resulting chain-specific SCA records. Run preview first, then apply to the real test account and re-read Circle state.

**Tech Stack:** Node.js 24 TypeScript type stripping, Node test runner, Circle Developer-Controlled Wallets SDK 10.6, Supabase JS, zsh.

## Global Constraints

- Only `ARB-SEPOLIA`, `OP-SEPOLIA`, `MATIC-AMOY`, and `UNI-SEPOLIA` may be derived.
- This is a one-time backfill for one explicit Payna user; do not change signup behavior.
- Preview is the default; Circle mutation requires `--apply`.
- Never call delegate, approve, deposit, transfer, withdrawal, or Gateway APIs.
- Require the returned wallet to keep the original SCA address, wallet set, account type, custody type, and requested blockchain.
- Do not print credentials, entity secrets, Supabase keys, full user IDs, wallet IDs, or wallet-set IDs.
- Preserve all unrelated dirty-worktree changes and the user-owned `output/` and `tmp/` directories.

---

## File structure

- Create `lib/circle/sca-derivation.ts`: dependency-free target allowlist, plan construction, identity validation, CLI argument parsing, and sequential apply orchestration.
- Create `lib/paycmd/sca-derivation.test.ts`: Node tests for every safety branch and mutation boundary.
- Create `scripts/derive-current-user-sca.ts`: Supabase/Circle adapter and human-readable preview/apply entry point.
- Modify `package.json`: add the explicit administrative command `wallet:derive-sca`.

### Task 1: Pure derivation plan and validation

**Files:**
- Create: `lib/circle/sca-derivation.ts`
- Create: `lib/paycmd/sca-derivation.test.ts`

**Interfaces:**
- Produces `SCA_DERIVATION_TARGETS: readonly ["ARB-SEPOLIA", "OP-SEPOLIA", "MATIC-AMOY", "UNI-SEPOLIA"]`.
- Produces `CircleScaWalletIdentity` with `id`, `address`, `blockchain`, `walletSetId`, `accountType`, and `custodyType`.
- Produces `buildScaDerivationPlan(source, walletSet)` returning ordered `{ blockchain, status: "existing" | "missing" }[]` entries.
- Produces `validateDerivedScaWallet(source, expectedBlockchain, derived)` returning the validated wallet or throwing before the caller continues.

- [x] **Step 1: Write failing tests for target planning**

Add literal fixtures and assertions:

```ts
test("plans all four reviewed SCA targets when none are derived", () => {
  assert.deepEqual(buildScaDerivationPlan(source, [source]), [
    { blockchain: "ARB-SEPOLIA", status: "missing" },
    { blockchain: "OP-SEPOLIA", status: "missing" },
    { blockchain: "MATIC-AMOY", status: "missing" },
    { blockchain: "UNI-SEPOLIA", status: "missing" },
  ]);
});

test("skips matching SCA targets and rejects a conflicting target identity", () => {
  assert.equal(buildScaDerivationPlan(source, [source, arbSca])[0].status, "existing");
  assert.throws(
    () => buildScaDerivationPlan(source, [source, { ...arbSca, address: OTHER_ADDRESS }]),
    /conflicting SCA identity for ARB-SEPOLIA/,
  );
});
```

- [x] **Step 2: Run the new test and verify RED**

Run:

```bash
node --test lib/paycmd/sca-derivation.test.ts
```

Expected: FAIL because `lib/circle/sca-derivation.ts` and its exports do not exist.

- [x] **Step 3: Implement the minimal planner**

Implement case-insensitive EVM-address comparison, strict source validation, the fixed target tuple, and deterministic plan ordering. Ignore expected EOA records on each target. For a target SCA, require `custodyType === "DEVELOPER"`, the same `walletSetId`, and the same address before marking it existing.

- [x] **Step 4: Write failing tests for derived response validation**

Cover the four independent mutation bugs with literal records:

```ts
assert.throws(() => validateDerivedScaWallet(source, "OP-SEPOLIA", { ...opSca, address: OTHER_ADDRESS }), /address/);
assert.throws(() => validateDerivedScaWallet(source, "OP-SEPOLIA", { ...opSca, accountType: "EOA" }), /account type/);
assert.throws(() => validateDerivedScaWallet(source, "OP-SEPOLIA", { ...opSca, walletSetId: "other-set" }), /wallet set/);
assert.throws(() => validateDerivedScaWallet(source, "OP-SEPOLIA", { ...opSca, blockchain: "ARB-SEPOLIA" }), /blockchain/);
```

- [x] **Step 5: Run the validation tests and verify RED**

Run `node --test lib/paycmd/sca-derivation.test.ts`.

Expected: the planner tests pass and the new response-validation tests fail because validation is missing or incomplete.

- [x] **Step 6: Implement strict response validation**

Validate every identity field with a separate error message. Return a normalized `CircleScaWalletIdentity` only after all checks pass.

- [x] **Step 7: Run Task 1 tests and verify GREEN**

Run:

```bash
node --test lib/paycmd/sca-derivation.test.ts
```

Expected: all Task 1 tests PASS.

- [x] **Step 8: Commit Task 1**

```bash
git add lib/circle/sca-derivation.ts lib/paycmd/sca-derivation.test.ts
git commit -m "feat: validate SCA derivation plans"
```

### Task 2: Preview/apply orchestration and safe CLI

**Files:**
- Modify: `lib/circle/sca-derivation.ts`
- Modify: `lib/paycmd/sca-derivation.test.ts`
- Create: `scripts/derive-current-user-sca.ts`
- Modify: `package.json`

**Interfaces:**
- Produces `parseScaDerivationArgs(argv)` returning `{ userId: string, apply: boolean }` and rejecting missing/non-UUID user IDs or unknown flags.
- Produces `executeScaDerivationPlan({ source, wallets, apply, derive })` returning ordered result entries while calling `derive(source.id, blockchain)` only for missing targets in apply mode.
- The CLI runs as `npm run wallet:derive-sca -- --user-id <uuid>` and mutates only with an additional `--apply`.

- [x] **Step 1: Write failing tests for CLI safety and preview behavior**

Add tests that prove:

```ts
assert.deepEqual(parseScaDerivationArgs(["--user-id", USER_ID]), { userId: USER_ID, apply: false });
assert.deepEqual(parseScaDerivationArgs(["--user-id", USER_ID, "--apply"]), { userId: USER_ID, apply: true });
assert.throws(() => parseScaDerivationArgs(["--apply"]), /--user-id/);

let calls = 0;
const preview = await executeScaDerivationPlan({
  source,
  wallets: [source],
  apply: false,
  derive: async () => { calls += 1; return opSca; },
});
assert.equal(calls, 0);
assert.equal(preview.every((entry) => entry.status === "missing"), true);
```

- [x] **Step 2: Run the tests and verify RED**

Run `node --test lib/paycmd/sca-derivation.test.ts`.

Expected: FAIL because argument parsing and execution orchestration are not implemented.

- [x] **Step 3: Implement parser and sequential executor**

The executor must skip existing targets, call the supplied dependency one missing target at a time, validate each returned wallet immediately, and stop on the first rejection. It must never catch and continue a failed Circle mutation.

- [x] **Step 4: Add a failing test for apply ordering and stop-on-failure**

Use a derive fake that records blockchains, succeeds for `ARB-SEPOLIA`, and throws for `OP-SEPOLIA`. Assert the calls equal exactly `["ARB-SEPOLIA", "OP-SEPOLIA"]` and later targets are not called.

- [x] **Step 5: Run the test and verify RED, then implement the minimal stop behavior**

Run `node --test lib/paycmd/sca-derivation.test.ts` before and after the minimal implementation.

Expected before: FAIL due to calls continuing or result handling missing. Expected after: PASS.

- [x] **Step 6: Implement the administrative adapter**

The script must:

```ts
const { userId, apply } = parseScaDerivationArgs(process.argv.slice(2));
// Resolve exactly one Payna SCA row for userId.
// Fetch the source Circle wallet and validate it against the DB row.
// listWallets({ walletSetId, pageSize: 50 }) to avoid default pagination truncation.
// Execute preview/apply with circleDeveloperSdk.deriveWallet.
// In apply mode, re-list and require every target status to be existing.
```

Print the target blockchain, `existing`/`missing`/`derived`, and whether the address matched. Do not print internal IDs or credentials. Set a non-zero process exit code for every validation or Circle failure.

- [x] **Step 7: Add the package command**

Add:

```json
"wallet:derive-sca": "node --env-file=.env.local scripts/derive-current-user-sca.ts"
```

- [x] **Step 8: Run targeted and full unit tests**

Run:

```bash
node --test lib/paycmd/sca-derivation.test.ts
npm test
```

Expected: targeted tests PASS and the complete PayCmd suite PASS.

- [x] **Step 9: Commit Task 2**

```bash
git add lib/circle/sca-derivation.ts lib/paycmd/sca-derivation.test.ts scripts/derive-current-user-sca.ts package.json
git commit -m "feat: add safe SCA derivation command"
```

### Task 3: Real-account preview, apply, and verification

**Files:**
- No source-file changes expected.

**Interfaces:**
- Consumes `npm run wallet:derive-sca -- --user-id <uuid> [--apply]` from Task 2.
- Produces four verified Circle-side SCA records and no fund movement.

- [x] **Step 1: Resolve the explicit target safely**

Read the user ID associated with the single failed `arbitrumSepolia` deposit observed at `2026-08-05T16:13:11.098Z`. Require exactly one matching row, validate the value as a UUID, and retain it only in a shell variable for the two commands below. Do not print it.

- [x] **Step 2: Run read-only preview**

Run:

```bash
npm run wallet:derive-sca -- --user-id "$PAYNA_DERIVE_TARGET_USER_ID"
```

Expected: all four reviewed targets are reported as `missing` or already `existing`; no Circle derive call occurs.

- [x] **Step 3: Apply the four derivations**

Run:

```bash
npm run wallet:derive-sca -- --user-id "$PAYNA_DERIVE_TARGET_USER_ID" --apply
```

Expected: missing targets become `derived`; existing targets are skipped; the command's final verification reports all four as existing with matching address.

- [x] **Step 4: Re-run preview to prove idempotency**

Run the preview command again.

Expected: all four targets report `existing`, and no mutation is attempted.

- [x] **Step 5: Verify no funds-moving side effects**

Query the current user's transaction history after the derive run and confirm no new `deposit`, `transfer`, `withdraw`, or `gateway_delegate` transaction was inserted by the script. Circle wallet records may be new; on-chain transaction hashes must not be created by derivation.

- [x] **Step 6: Run final project verification**

Run:

```bash
git diff --check
npm run lint
npm run build
```

Expected: diff check and build PASS; lint has zero errors. Existing unrelated warnings may remain.

- [x] **Step 7: Report the exact outcome**

Report each of the four blockchain statuses, confirm the address matched without printing it, state that no USDC was deposited, and tell the user that a separately confirmed small deposit can now test Gateway delegate/approval execution.
