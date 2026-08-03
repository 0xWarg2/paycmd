# AI Quota Onboarding Banner Design

## Goal

Tell a new, limited user that Payna is in beta and includes 10 free lifetime AI requests. Show the notice once per account, without consuming quota or showing it to whitelisted users.

## Behavior

- Show the banner inside the empty-chat onboarding guide only when server quota is enabled, the user is not unlimited, successful usage is zero, and the account has not dismissed the notice.
- The Vietnamese message is: “Payna đang ở bản thử nghiệm. Bạn có 10 lượt AI miễn phí để trải nghiệm AskPayna và AI command.” English receives equivalent copy.
- Dismissing hides the banner immediately and stores an account-level timestamp. It stays dismissed across browsers and devices.
- Do not show the banner when quota is disabled, the user is whitelisted, the user has already used an AI request, quota status cannot be loaded, or the notice was already dismissed.
- Existing per-message quota badges and exhausted-quota handling remain unchanged.

## Data and Security

- Add nullable `profiles.ai_quota_notice_seen_at timestamptz`.
- Add an authenticated, `security definer` RPC that derives identity from `auth.uid()`, reads whitelist and successful usage, and returns a non-consuming quota snapshot. It accepts no user ID.
- Keep whitelist and reservation tables inaccessible directly to `anon` and `authenticated`.
- Add `/api/ai/quota`: `GET` returns `{ quota, noticeSeenAt }`; `POST` updates the authenticated user's notice timestamp. Authentication or access-check failures must fail closed and leave the banner hidden.

## UI Flow

1. When an authenticated empty chat renders, request the quota onboarding state.
2. Render the dismissible beta banner above the onboarding command grid only when all display conditions pass.
3. On dismiss, optimistically hide it and persist the timestamp through the API. A failed write may cause it to reappear after reload; it must not block chat usage.

## Verification

- Test the pure display predicate for new limited, whitelisted, quota-disabled, used, dismissed, and unavailable states.
- Verify the snapshot RPC does not insert or update reservations and uses only `auth.uid()`.
- Verify dismiss persistence and authenticated access.
- Run migration checks, scoped ESLint, production build, then apply the migration to the linked Supabase project and commit the feature separately.
