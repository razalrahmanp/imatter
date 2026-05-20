---
name: sdlc-gdpr-consent-management
description: Use when designing consent collection (cookies, marketing, analytics, third-party sharing) — covers what valid consent looks like under GDPR, the technical record-keeping, and the withdrawal flow.
---

## Rule

Consent under GDPR must be: freely given, specific, informed, and unambiguous. Pre-checked boxes don't count. Bundled "click here to accept everything" doesn't count for separate purposes. Consent must be as easy to withdraw as to give. Every consent action is recorded with timestamp, scope, and version.

## Where consent applies

Consent is *one* of six lawful bases. You don't always need consent — for example, "contract" covers data needed to fulfill the contract (you need an email to send the order confirmation). Don't ask for consent when you don't need it; it weakens your position.

| Activity | Usual basis |
|---|---|
| Process the order the user just placed | Contract (Art. 6(1)(b)) |
| Send transactional email about that order | Contract |
| Marketing email about future products | **Consent** (Art. 6(1)(a)) |
| Analytics / tracking cookies | **Consent** (per ePrivacy; PECR in UK) |
| Sharing data with third-party advertisers | **Consent** |
| Storing essential cookies (login, cart) | "Legitimate interest" or "strictly necessary" exception |

## What valid consent looks like

| Requirement | Means |
|---|---|
| **Freely given** | No detriment if refused. Can't gate access to the service on consent that's not necessary for the service. |
| **Specific** | Per purpose. Not "I agree to everything." Separate consent for marketing vs analytics vs sharing. |
| **Informed** | Clear what each purpose is, who the controller is, what data, for how long. |
| **Unambiguous** | Active opt-in. Pre-checked boxes, silence, default-on do not count. |
| **Withdrawable** | One-click withdrawal, same ease as giving. |

## Pattern — consent record

```sql
CREATE TABLE consent_log (
  id              UUID PRIMARY KEY,
  subject_id      UUID NOT NULL,        -- user_id, or null for anonymous (cookies)
  anonymous_id    TEXT,                 -- if not yet logged in (cookie ID)
  purpose         TEXT NOT NULL,        -- 'marketing_email', 'analytics', 'third_party_ads'
  status          TEXT NOT NULL CHECK (status IN ('granted', 'withdrawn')),
  granted_at      TIMESTAMPTZ,
  withdrawn_at    TIMESTAMPTZ,
  source          TEXT NOT NULL,        -- 'cookie_banner', 'account_signup', 'settings_page'
  policy_version  TEXT NOT NULL,        -- 'privacy_policy_v3'
  ip_address      TEXT,                 -- evidence; consider hashing
  user_agent      TEXT,
  notes           TEXT
);
```

Every grant or withdrawal writes a new row. Don't update existing rows — keep history.

## Cookie consent — the implementation

```ts
// Default: deny all non-essential
let consentState = {
  essential: true,         // always on
  analytics: false,
  marketing: false,
  third_party: false,
};

// Show banner on first visit; load state from cookie/storage on subsequent
function loadConsent() {
  const stored = localStorage.getItem("consent");
  if (stored) consentState = JSON.parse(stored);
}

function setConsent(updates: Partial<typeof consentState>) {
  consentState = { ...consentState, ...updates };
  localStorage.setItem("consent", JSON.stringify(consentState));
  recordConsentChange(consentState);
}

// Gate loading of third-party scripts on consent
if (consentState.analytics) {
  loadAnalytics();
}
```

The banner must offer:
- "Accept all"
- "Reject all" (equally prominent — not buried in "manage preferences")
- "Manage preferences" with per-purpose toggles

"Reject all" buried, gray, or smaller than "Accept all" → not valid consent.

## Children

GDPR requires consent from a parent / guardian for users under 16 (or as low as 13, member-state choice). If your service is for adults but a minor signs up:

- Age verification at signup
- If under 16: collect parent's email; parent confirms consent
- Document the verification

For services aimed at children: design with full child-protection mode from the start.

## Withdrawal

- Visible in settings, not hidden
- One-click (or one tap) — same effort as the original consent
- Takes effect immediately
- Confirmation: "Your marketing emails will stop within 24 hours"
- Logged in consent_log

The "same ease" rule is teeth: if signup is 1 click, unsubscribe must be 1 click. If signup required entering email, unsubscribe must too — but no more.

## Refreshing consent

Consent expires:
- Practical default: re-confirm annually (some interpretations require this)
- Mandatory: when the privacy policy materially changes
- Mandatory: when adding a new purpose

Re-prompt the user; old consent records remain (audit trail) but are superseded by the new one.

## Anti-patterns

- ❌ Pre-checked consent boxes
- ❌ "By using this service, you consent to..." in fine print
- ❌ One consent for everything (marketing, analytics, ads — must be separate)
- ❌ "Reject all" hidden behind "Manage preferences"
- ❌ Cookie banner that times out and counts inaction as consent
- ❌ Loading analytics / tracking scripts before consent is granted
- ❌ Recording consent without timestamp, purpose, or policy version
- ❌ Withdrawing consent takes 5 clicks; giving was 1
- ❌ No re-confirmation when policy changes

## Cross-references

- [[sdlc-data-retention]] — how consented data is kept
- [[sdlc-gdpr-data-subject-rights]] — withdrawal triggers cascading actions
- [[sdlc-audit-logging]] — consent log is itself audit-worthy

## Gate criteria

- Consent collection points (signup form, cookie banner, marketing toggles) follow specific + informed + unambiguous rules
- "Reject all" is equally prominent on the cookie banner
- Per-purpose granularity (marketing, analytics, third-party each separately)
- A `consent_log` table records every grant and withdrawal with timestamp, purpose, version
- Third-party scripts (analytics, ads, chat widgets) are gated on the corresponding consent
- Withdrawal flow is one-click and visible in settings
- Privacy policy version is recorded with each consent
- A test exists that submits a consent and verifies the resulting cookie / state / log entry
