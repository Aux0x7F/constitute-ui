# Constitute UI Architecture

`constitute-ui` is the shared first-party browser UI layer for Constitution apps.

It is not:
- the runtime authority
- the account authority
- a domain-specific gateway or NVR repo

## Responsibilities
- shared topbar / drawer / footer account-state contract
- mini account center host surface
- generic primitives for panels, tiles, rows, tabs, and state surfaces
- DOM-first composition helpers
- prepared-model subscription helpers
- shared account rail affordance, including the expandable footer summary and centered disclosure cue
- generic loading/status affordances that can be reused without leaking debug detail into primary UI

## Integration Contract
- apps provide prepared models
- apps dispatch named actions
- apps fill named slots / content regions
- runtime and gateway calls remain in app controllers, not shared UI components
- debug and diagnostics surfaces stay opt-in and out-of-band; shared UI does not place transport logs in the primary workflow by default

## Delivery
- build dependency first
- public ESM interface is stable enough to later publish as a pinned external artifact without changing the app-facing API
