# AI Quota X DM CTA Design

## Goal

When a limited user has used all 10 free AI calls, clearly direct them to contact the Payna admin through the provided X profile instead of referring generically to an admin.

## User Experience

- Keep the existing exhausted-quota message in the assistant response card.
- Replace the generic whitelist instruction with a direct instruction to DM `@0xWarg__` on X for continued access.
- Show a distinct CTA button below the message:
  - English: `DM @0xWarg__ on X`
  - Vietnamese: `DM @0xWarg__ trên X`
- Open `https://x.com/0xWarg__` in a new browser tab when the CTA is selected.
- Include safe external-link attributes so the new tab cannot access the Payna page.
- Show the CTA only for the `AI_QUOTA_EXHAUSTED` response. Other assistant messages and failures remain unchanged.

## Architecture

- Add localized exhausted-quota text and CTA labels to the existing i18n dictionaries.
- Preserve a structured marker in quota-exhausted chat-message metadata so rendering does not depend on matching translated prose and the CTA survives a chat reload.
- Extend the ordinary assistant-message renderer with an optional quota-contact CTA driven by that marker.
- Keep the X profile URL as a single named constant rather than duplicating it across branches or locales.

## Data Flow

1. An AI API returns `AI_QUOTA_EXHAUSTED`.
2. The submit handler creates the same assistant error message as today and marks it as quota-exhausted in persisted message metadata.
3. The message renderer displays the localized explanation.
4. The renderer detects the structured marker and adds the localized X CTA linked to `https://x.com/0xWarg__`.

Persisted historical messages that lack the new marker continue rendering as plain text. The existing JSON metadata column carries the new marker, so no database or API contract change is required.

## Error Handling and Safety

- A normal AI error must not display the X CTA.
- The link uses a fixed HTTPS URL, opens in a new tab, and uses `rel="noreferrer"`.
- The existing quota count, provider badge, and error fallback behavior remain unchanged.

## Testing

- Add a focused test for the pure rule that decides whether an assistant message receives the quota-contact CTA.
- Verify a quota-exhausted message enables the CTA.
- Verify unrelated messages and ordinary AI failures do not enable the CTA.
- Run the focused test, lint/type checks relevant to the changed files, and a production build if the project environment permits it.

## Out of Scope

- Opening X's DM composer directly, because the supplied URL is the X profile URL rather than a recipient-ID compose URL.
- Changing quota limits, whitelist behavior, database policies, or admin workflows.
- Adding contact CTAs to onboarding or other error states.
