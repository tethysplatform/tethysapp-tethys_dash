# Product

## Register

product

## Users

**Primary: the water-resource scientist building dashboards for their team.**

A hydrologist, forecaster, or research engineer — technical enough to know their own data (parquet files, NWM outputs, NRDS time series, geospatial layers) but not a frontend developer. They build dashboards to communicate forecasts and analyses internally and to stakeholders. They are mixed-permission: most of their time is spent as a dashboard *editor* (chatbox + edit modals + drag-reorder grid + tile config) and *viewer* (their colleagues open the same dashboard read-only).

**Context of use:** office work, weekday-daytime, 24"+ monitor, broadband. Mature professional with no patience for marketing inside their tool. Will return to this product daily for a single in-progress dashboard, every few weeks to set up a new one. They have other tools open (Jupyter, QGIS, Python REPL).

**Secondary: the dashboard viewer.** Colleague or stakeholder opening a shared dashboard read-only. Sees no chatbox. Quick-scan use, sometimes during a briefing. Should never see editor chrome.

**Tertiary: the workshop participant.** First-time user at a CIROH workshop running scripted prompts through the chatbox. The chatbox + LiveActivity + per-tile streaming surface is the demo path. Optimize separately when it conflicts with the editor's daily workflow; the daily user wins.

## Product Purpose

TethysDash is a low-code dashboard environment for water-resource analysis. The scientist composes draggable visualization tiles (charts, maps, tables, variable inputs, text, custom MFE plugins) backed by Intake plugins that fetch domain data; an MCP-driven chatbox lets the LLM create and edit those tiles via natural language. The output is a shareable, reactive dashboard URL.

**What success looks like:**

- The first surface the editor sees is **their dashboards, ready to open**. Not a marketing welcome, not a tour, not a "What's new?" panel. The list IS the welcome.
- Creating a new tile via the chatbox is faster than the equivalent dialog-driven workflow it replaces. Streamed dispatch means the first tile is visible mid-LLM-turn, not at end-of-turn.
- A dashboard the scientist last touched in May still opens, renders, and is recognizable in October. Backward compatibility on tile shapes and variable substitution is load-bearing.
- The viewer's first impression of a shared dashboard is the data, not the chrome.

## Brand Personality

**Three words: modern, fast, confident.**

The reference lane is the best-in-class developer tool: Linear, Figma, Raycast, Stripe Dashboard. Crisp typography, generous whitespace, snappy transitions, opinionated keyboard shortcuts, professional-but-not-stuffy. The product feels current and well-engineered, picked by the scientist because it's the best instrument for the job — not because it's friendly, not because it's institutional, not because it's fun.

**Voice:** direct, technical, ungilded. Error messages name the thing that broke and what to do. Empty states say "no dashboards yet — create one" and not "Welcome to your dashboard journey!" No exclamation points. No emoji in product copy. The chatbox is allowed to be more conversational (the user is talking to an LLM) but the surrounding UI does not adopt that voice.

## Anti-references

Four reflex categories to actively avoid. If a screenshot of a TethysDash surface could be mistaken for any of these, it has failed.

1. **Generic SaaS dashboard slop** — Tableau / Power BI / Klipfolio lookalikes. No identical-card grids of KPI tiles. No "hero metric template" (big number, small label, gradient accent). No rainbow data viz. No 12-row sidebar of icon-only menu items. The dashboard is composed by the scientist for a specific purpose; we do not impose a corporate-BI shape on it.

2. **Government-portal 2010s** — Bootstrap-default chrome, side-stripe alert callouts, navbar-heavy top bar with breadcrumbs and tabs and a logo and a search box all competing. This is the category gravity TethysDash *would* drift into (federal-research provenance, Bootstrap actually in the stack) and which it must explicitly resist. No `border-left: 4px solid blue` accents. No navy-and-gold institutional palette. No "official seal" treatment of the title bar.

3. **Crypto / AI startup neon** — 2024 LLM-tool slop. No dark-mode-as-default-because-LLM. No purple-gradient hero. No shimmering chatbox. No mesh-gradient backdrops. No glassmorphic floating panels stacked on a stock-photo blur. The MCP integration is a tool, not an identity.

4. **Consumer fitness-app warmth** — Headspace / Duolingo / Calm register. No rounded-everything (R=16+ on every surface). No soft pastel palette. No illustrative empty states with mascots. No "Great job!" microcopy. The user is a trained professional running federal forecasts; warmth would undermine the trust signal.

## Design Principles

Five strategic principles, derived from the answers above. These are *what the design must do*, not *what colors to use*. Visual rules live in DESIGN.md.

1. **The instrument, not the lab manual.** Best-tool feel demands we get out of the way of the work. The product does not introduce itself. No first-run tour as the default. No "What's new?" banner. The scientist opens their last dashboard and is already in their workflow. Onboarding lives in empty-state copy and inline help — not interruption.

2. **Show the data, not the chrome.** Every pixel surrounding a tile is a tax on the tile. Reduce surface texture, navigation density, decorative gradients, and incidental color until the tile is the loudest thing on the page. This is what separates a "data tool" from a "dashboard product" in the SaaS-slop lane.

3. **One vocabulary.** A modern/fast/confident product cannot afford four design systems coexisting in the same view (the current state, per the 2026-05-28 critique: Bootstrap-default chrome + custom styled-components + react-bootstrap modals + inline `style={{}}` one-offs). The unifying discipline is non-negotiable: one type ramp, one icon family, one button vocabulary, one canonical primary, one spacing rhythm. DESIGN.md owns the specifics; this principle says the convergence is a strategic priority, not cosmetic.

4. **The expert's pace.** Modern/fast/confident is a speed claim. Keyboard shortcuts on every common action. Optimistic UI on saves. Sub-100ms transitions. No theatrical loading state where a static skeleton would do. Power-user defaults are the default; novices discover them through empty states, not through being slowed down.

5. **Restraint as a trust signal.** Decoration must earn its place against the data. A gradient is a claim that the gradient matters; a shadow is a claim that the elevation matters. If the claim isn't true, the decoration is theater, and theater erodes the federal-research credibility the user came for. When in doubt, remove.

## Accessibility & Inclusion

**Floor: pragmatic best-effort, with WCAG 2.1 AA as the implicit target.** No formal compliance gate at present, but design review treats AA contrast (4.5:1 normal text, 3:1 large text) and full keyboard navigation as defaults. The 2026-05-28 critique flagged the header-chip family as failing this; that's a known carry-cost, not an accepted standard.

**Reduced motion is respected** — the per-tile streaming animation, the dashboard-load loader, and the chatbox typing indicator all gate on `prefers-reduced-motion: reduce`. This is non-negotiable for the editor demographic (long sessions, professional context).

**Color-blindness in data viz is a known soft spot.** The product principle is that all chart and map color encodings should be viable for the common deuteranopia / protanopia patterns. Plotly's default rainbow palette fails this; the dashboard renderer should ship perceptually-uniform sequential defaults and require categorical encodings to combine color + texture / marker. This is a future-state — current state has not been audited.

**Revisit this section if:** a federal procurement raises Section 508, a user reports a specific access barrier, or the formal accessibility audit gets resourced.
