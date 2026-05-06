# Constitute UI Architecture

`constitute-ui` is the shared first-party browser UI layer for Constitution apps.

It is not:
- the runtime authority
- the account authority
- the protocol/security primitive package
- a domain-specific gateway or NVR repo

## Responsibilities
- shared topbar / drawer / footer account-state contract
- mini account center host surface
- generic primitives for panels, tiles, rows, tables, tabs, and state surfaces
- DOM-first composition helpers
- prepared-model subscription helpers
- shared account rail affordance, including the expandable footer summary and centered disclosure cue
- shared chrome interaction binding for drawer, notifications, account center, nav activation, and connection popover behavior
- generic loading/status affordances that can be reused without leaking debug detail into primary UI
- compact data-table rendering for retained projections and operator lists where card grids would be too noisy
- expandable data-table row slots for app-owned detail/subtable content

## Integration Contract
- apps provide prepared models
- apps dispatch named actions
- apps fill named slots / content regions
- apps use the shared chrome binder for generic topbar/drawer/footer interactions instead of reimplementing those event handlers
- runtime and gateway calls remain in app controllers, not shared UI components
- debug and diagnostics surfaces stay opt-in and out-of-band; shared UI does not place transport logs in the primary workflow by default
- CAAC, broker constants, Nostr helpers, and service-access contracts come from `constitute-protocol`, not `constitute-ui`

## Delivery
- build dependency first
- public ESM interface is stable enough to later publish as a pinned external artifact without changing the app-facing API
