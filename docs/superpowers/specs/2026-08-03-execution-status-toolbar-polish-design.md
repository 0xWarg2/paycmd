# Execution Status And Toolbar Polish

## User and context

Payna users need to distinguish live transaction work from historical status snapshots without persistent motion after an execution finishes. Desktop users at the 1024px breakpoint also need network and wallet controls without those controls covering chat content.

## State and interaction model

- Only the latest non-terminal status snapshot for an execution may animate.
- An older `queued`, `running`, or `waiting_gateway` snapshot renders its reached step as complete, uses a static check icon, and shows `Step completed` beside its original status label.
- A successful snapshot renders `Completed` with all five timeline steps complete.
- A failed snapshot remains static and uses the existing failure treatment.
- Timeline node and connector color/scale transitions use 500ms ease-out motion. `prefers-reduced-motion` disables transitions and spinner motion.

## Desktop toolbar

- The toolbar remains a dedicated 64px grid row and never uses absolute positioning.
- At 1024–1279px, network and wallet controls use compact labels; wallet balance moves into the dropdown.
- At 1280px and above, network label and wallet balance may appear inline.
- Controls use `min-width: 0`, truncation, and bounded widths so they cannot push outside their row.
- Below the desktop breakpoint, these controls remain in the existing More sheet.

## Accessibility and acceptance criteria

- Historical timelines contain no `.animate-spin` element.
- The live timeline retains an accessible status label and spinner.
- Completion text is localized and announced through the existing polite live region.
- At 1024px, the toolbar bounding box ends before the chat workspace/content bounding box begins.
- The page has no horizontal overflow in light or dark themes.

## Engineering handoff

Target Next.js App Router components: `PayCmdShell`, `ExecutionStatus`, `ExecutionTimeline`, and the development UI fixture. Model behavior remains in `lib/paycmd/ui-models.ts` so it can be unit tested independently.
