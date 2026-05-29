---
name: TethysDash
description: Low-code dashboard environment for water-resource analysis; chatbox-driven tile composition.
colors:
  watershed-slate: "#1e6b8b"
  watershed-slate-deep: "#185571"
  watershed-slate-soft: "#3d8aa9"
  ink: "#15202a"
  ink-muted: "#4b5b6a"
  ink-subtle: "#7d8d9b"
  paper: "#fbfcfc"
  paper-raised: "#f4f6f7"
  paper-sunken: "#eef1f3"
  rule: "#e0e5e9"
  rule-strong: "#cbd3da"
  warn: "#c25a14"
  danger: "#b03434"
  ok: "#3f7d4f"
typography:
  display:
    fontFamily: "InterVariable, Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "32px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "InterVariable, Inter, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.005em"
  title:
    fontFamily: "InterVariable, Inter, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0"
  body:
    fontFamily: "InterVariable, Inter, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "0"
  label:
    fontFamily: "InterVariable, Inter, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.04em"
  mono:
    fontFamily: "JetBrains Mono, Menlo, Consolas, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "0"
rounded:
  none: "0px"
  sm: "2px"
  md: "4px"
  lg: "6px"
  full: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "20px"
  xl: "32px"
  xxl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.watershed-slate}"
    textColor: "{colors.paper}"
    typography: "{typography.title}"
    rounded: "{rounded.md}"
    padding: "8px 14px"
  button-primary-hover:
    backgroundColor: "{colors.watershed-slate-deep}"
    textColor: "{colors.paper}"
    typography: "{typography.title}"
    rounded: "{rounded.md}"
    padding: "8px 14px"
  button-ghost:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    rounded: "{rounded.md}"
    padding: "8px 14px"
  button-ghost-hover:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    rounded: "{rounded.md}"
    padding: "8px 14px"
  button-danger:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.danger}"
    typography: "{typography.title}"
    rounded: "{rounded.md}"
    padding: "8px 14px"
  input-text:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "6px 10px"
  input-text-focus:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "6px 10px"
  card-tile:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "12px"
  chip-tab:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "4px 10px"
  chip-tab-active:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.watershed-slate}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "4px 10px"
  nav-header:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    rounded: "{rounded.none}"
    padding: "8px 16px"
    height: "56px"
---

# Design System: TethysDash

## 1. Overview

**Creative North Star: "The Forecasting Desk"**

TethysDash is the operations-room calm of a working hydrologist's desk: slate ink on paper, the data is the loudest thing on the screen, the chrome stays out of the way. The reference is the NWS forecaster screen and the Bloomberg-terminal sobriety, modernized for the Linear/Figma/Stripe lane. A scientist's eye lands on a tile and reads it without first parsing the surrounding scaffolding.

The instrument is the dashboard tile. Every other element (header, sidebar, modal, popover, chatbox chrome) is sized, weighted, and colored to lose the contest for attention with that tile. This is what separates the data tool from the dashboard product in the SaaS-slop lane. The same principle frames what TethysDash explicitly refuses: corporate-BI KPI grids, government-portal Bootstrap-default chrome, 2024 LLM-tool neon, consumer-fitness rounded-warmth. None of these. The voice is professional, the surface is restrained.

The visual system is built on the **Restrained** color strategy: tinted-neutral paper, one accent (Watershed Slate, our canonical primary) used as ink rather than fill, and a 4px-base radius scale that gives every surface a structural decisiveness. Components are flat at rest. Shadows are reserved for state changes (hover, focus, the active drag of a tile being reordered) and for floating UI where overlap requires depth.

**Key Characteristics:**

- One accent color, used on ≤10% of any given screen, used as ink (text, focus rings, the active-state of a control) not as fill.
- Tinted-neutral paper for the base; the Watershed hue carries a trace into the neutrals so the whole surface feels like one system.
- 4px structural radius across product UI. Pill (`rounded.full`) only on numeric badges. Hard corners on tabs.
- Inter for the entire UI stack. JetBrains Mono for any tabular data, code, or numeric display where alignment matters.
- Flat surfaces by default. Shadow appears only on state, and only at one elevation step.

## 2. Colors: The Watershed Palette

The palette is a slate-teal accent (canonical primary) with a tinted-neutral ground. Every neutral carries a trace of the primary's hue (chroma ≈ 0.005 in OKLCH) so the system feels coherent even when the accent is absent. Sequential warn/danger/ok roles exist for status, with restraint: their job is to be unambiguous, not loud.

### Primary

- **Watershed Slate** (`#1e6b8b` / `oklch(45.4% 0.064 231)`): The single accent. Used as ink (label text, focus rings, active-state indicators, chatbox header chrome, the primary CTA fill) on no more than 10% of any given screen. Never used as a background fill across the whole header bar (that's the Committed strategy, which we rejected).
- **Watershed Slate Deep** (`#185571` / `oklch(38.0% 0.063 231)`): Hover and active state of any Slate-ink element.
- **Watershed Slate Soft** (`#3d8aa9` / `oklch(57.4% 0.064 231)`): Selection backgrounds at low opacity, sparkline strokes, secondary chart axis labels.

### Neutral (the system actually lives here)

- **Ink** (`#15202a` / `oklch(20.5% 0.012 231)`): Body text, primary headings. Trace of the watershed hue in the neutrals; never `#000`.
- **Ink Muted** (`#4b5b6a` / `oklch(43.0% 0.014 231)`): Secondary text, labels, metadata.
- **Ink Subtle** (`#7d8d9b` / `oklch(60.0% 0.014 231)`): Placeholder text, disabled state, the "+ create dashboard" affordance at rest.
- **Paper** (`#fbfcfc` / `oklch(98.5% 0.003 231)`): Default canvas. Tinted, never `#fff`. The dashboard background, the modal background.
- **Paper Raised** (`#f4f6f7` / `oklch(96.5% 0.003 231)`): The dashboard tile resting surface. One step above paper.
- **Paper Sunken** (`#eef1f3` / `oklch(94.5% 0.003 231)`): Input field background, the chatbox composer well, code blocks.
- **Rule** (`#e0e5e9` / `oklch(90.5% 0.005 231)`): 1px dividers and default borders.
- **Rule Strong** (`#cbd3da` / `oklch(83.5% 0.007 231)`): Focused input border, the tile-being-dragged border.

### Status (semantic only, never decorative)

- **Warn** (`#c25a14` / `oklch(54.2% 0.155 47)`): Patch-rejection banner. Used as ink + thin 1px border, never as fill.
- **Danger** (`#b03434` / `oklch(48.5% 0.156 27)`): Destructive confirm button, hard error state. Same rule: ink + border, not fill.
- **OK** (`#3f7d4f` / `oklch(50.0% 0.096 145)`): Successful save toast, healthy MCP server status. Used sparingly; success is the default state and rarely needs a green.

### Named Rules

**The One Voice Rule.** The primary accent is used on no more than 10% of any given screen. It is ink, not fill. If you find yourself fill-coloring a whole region Watershed Slate, you have left this system and entered the Committed strategy. Pick a Paper variant instead.

**The Trace Rule.** Every neutral carries a trace of the watershed hue (chroma ≈ 0.005). Pure `#fff` and pure `#000` are absolutely prohibited. They detach the neutral palette from the primary and the system stops feeling coherent.

**The Drift Kill Rule.** The legacy hex values `#007bff`, `#0d6efd`, `#0a62a9` (Bootstrap-default blue, dark blue, the slightly-darker-blue currently in `LoadingAnimation.scss`) are prohibited going forward. They are the visible signature of accumulated design-system fracture (the 2026-05-28 critique called this out as the dominant issue). Any new component touches and any audited refactors collapse these to `colors.watershed-slate`.

## 3. Typography

**Display + Body Font:** Inter Variable (with system-ui, -apple-system, Segoe UI, sans-serif as fallback).
**Mono / Data Font:** JetBrains Mono (with Menlo, Consolas, monospace as fallback).

**Character:** Inter for the entire UI stack. Inter is the modern/fast/confident default for product UI in the Linear/Figma/Stripe lane and avoids both the government-portal serif reflex (Times / Source Serif) and the consumer-fitness rounded-sans warmth (Nunito / Quicksand). JetBrains Mono carries the tabular data, the variable-substitution syntax (`${variable}`), and any inline code in the chatbox. Two families is the ceiling; a third would be evidence of design-system drift.

### Hierarchy

- **Display** (Inter, 600, 32px / 1.15, letter-spacing -0.01em): Reserved for the dashboard title at the top of an editor view. Never on dashboard tiles. Roughly 1.5× the headline step (≥1.25 contrast ratio satisfied).
- **Headline** (Inter, 600, 20px / 1.25, -0.005em): Section heading inside a modal, the "Available Dashboards" header on the landing page, the chatbox conversation title.
- **Title** (Inter, 600, 15px / 1.3): Tile title, modal section subhead, button label, primary navigation item.
- **Body** (Inter, 400, 14px / 1.45): The default reading size. Form labels, descriptive prose, the chatbox message body. Body line length is capped at 65–75ch in any reading context (long-form modals, the chatbox transcript).
- **Label** (Inter, 500, 11px / 1.2, letter-spacing 0.04em): Metadata, badge text, the "Last updated" line below a dashboard card, the tab label on the dashboard editor. Slightly tracked for legibility at the small size.
- **Mono** (JetBrains Mono, 400, 13px / 1.45): Tabular data inside a tile (when the renderer is data-table), variable-substitution syntax in input descriptions, the RFC-6902 path that appears in patch-rejection envelopes.

### Named Rules

**The Two Families Rule.** Inter + JetBrains Mono is the entire type stack. The TextEditor's `font-family: "Arial, sans-serif"` (`reactapp/components/inputs/TextEditor.js:241`) is an exception scoped to user-authored rich text content, not to the surrounding UI. No third UI face is permitted.

**The Title Anchor Rule.** The smallest size that may carry weight 600 is Title (15px). Below that, weight maxes at 500 and tracking opens slightly. A 12px / 600 piece of text is a visual artifact of the inline-style era and should be rewritten as Label or upsized to Title.

## 4. Elevation

**Flat by default. Shadow appears only as a response to state.** A dashboard tile at rest has no shadow. On hover, it gains a single 1px border-shift (Rule Strong). On the active drag, the tile gains the elevation shadow listed below. Modals, popovers, and dropdowns wear elevation at rest because they overlap content and the depth signal is the disambiguator. Nothing else uses shadow at rest.

Depth is conveyed primarily through tonal layering (Paper → Paper Raised → Paper Sunken). The whole system reads as one warm-cool tinted-neutral atmosphere with the data tiles slightly raised from the canvas. This is the "modern/fast/confident" lane's house elevation pattern; tactile material (Material 3, the layered shadow stack) is rejected as outside the register.

### Shadow Vocabulary

- **State Elevation** (`box-shadow: 0 4px 12px oklch(20% 0.01 231 / 0.08)`): The single shadow token. Used on (a) hover state of an interactive tile, (b) active drag, (c) modals, popovers, dropdowns at rest. Uses an Ink-tinted alpha rather than `rgba(0,0,0,...)` so the shadow inherits the system trace.

### Named Rules

**The No Rest Shadow Rule.** A dashboard tile at rest has zero shadow. If a tile needs to feel "raised", that's a hint that the canvas (`paper`) is too close to the tile fill (`paper-raised`). Adjust the tonal step instead of adding shadow.

**The Single Step Rule.** There is one elevation step. The legacy "stacks 3 transparency layers on hover" pattern (the 2026-05-28 critique called this out on the landing-page dashboard card) is prohibited. One step or zero, never two.

## 5. Components

### Buttons

- **Shape:** 4px radius (`rounded.md`). No pill buttons for actions; pill is reserved for numeric badges only (`rounded.full`).
- **Sizing:** 8px vertical / 14px horizontal padding. The label is Title (15px / 600). Height resolves to ~36px.
- **Primary:** Watershed Slate fill (`#1e6b8b`), Paper text (`#fbfcfc`). Hover: Watershed Slate Deep (`#185571`). Focus: 2px outer ring in Watershed Slate at 30% opacity, offset 2px from the button edge.
- **Ghost:** Paper background, Ink text. Hover: Paper Raised. No border at rest; on hover the surface change is the affordance.
- **Danger:** Paper background, Danger ink (`#b03434`). 1px Danger border. On hover: Danger fill, Paper text. Reserved for destructive confirms in modals.
- **Transition:** background and border-color, 120ms ease-out-quart. Never animate layout properties.

### Inputs

- **Style:** Paper Sunken background (`#eef1f3`), 1px Rule border (`#e0e5e9`), 4px radius. 6px / 10px padding. Body type (14px / 400).
- **Focus:** Border shifts to Rule Strong (`#cbd3da`), plus a 2px outer ring in Watershed Slate at 25% opacity offset by 1px. The ring is the system signal that focus is here; the border shift is the structural anchor.
- **Error:** Border shifts to Danger; helper-text below in Danger ink.
- **Disabled:** Paper Raised background, Ink Subtle text. No border.

### Tabs (the dashboard tab strip)

- **Style:** Inactive tab is a 2px-radius chip (`rounded.sm`), Paper background, Ink Muted text in Label type. Hard structural shape, sharp corners on the bottom edge that meet the content surface.
- **Active:** Paper Raised background, Watershed Slate text. A 2px Watershed Slate underline along the bottom edge.
- **Drag-reorder:** Active drag tab carries the State Elevation shadow.

### Dashboard Tile (the signature component)

- **Shape:** 4px radius, Paper Raised fill, 1px Rule border at rest.
- **At rest:** No shadow. The tonal step from the Paper canvas is the entire raised affordance.
- **Hover (editor mode only):** Border shifts to Rule Strong. The icon dropdown reveals in the corner; the tile body is unchanged.
- **Active drag:** State Elevation shadow appears, cursor switches to grabbing, the tile gains a 2px Watershed Slate outer ring.
- **Streaming arrival (chatbox-driven tile creation):** New tiles fade in with opacity 0 → 1 over 180ms ease-out-quart. Gated on `prefers-reduced-motion: reduce` (skip the fade, render immediately).
- **Edit-lock state (during chatbox turn):** Edit / Delete / Reorder controls inert; the dropdown chevron is Ink Subtle (50% opacity equivalent in our token system) and shows the inert cursor. No banner, no toast; the visual quietness is the affordance.

### Header (top navigation chrome)

- **Style:** Paper background (NOT Watershed Slate fill — that would be the Committed strategy; we are Restrained). 56px height (`--ts-header-height`). 1px Rule bottom border. Title type for the app name; Body type for the user menu.
- **Icons:** Label-sized, Ink Muted at rest, Ink on hover. No saturated-blue chrome chips on a blue navbar.

### Chatbox Sidebar

- **Style:** Paper background, 1px Rule left border separating it from the main canvas. Conversation transcript inside; composer well at the bottom in Paper Sunken.
- **Streaming indicator:** The LiveActivity strip inside the composer uses Label type, Ink Muted text. No spinner; the text content (e.g., "create_plotly_chart…") is the indicator.
- **Slash-prompt popover:** Single-row chip list, Label type, 4px radius chips, Paper raised background. Sticky-dismiss behavior is preserved per the 2026-05-09 fix.

### Modals & Popovers (floating UI)

- **Shape:** 4px radius. Paper background, 1px Rule border, State Elevation shadow. Never stack a modal over a modal.
- **Internal padding:** 20px (`spacing.lg`) on all sides, with section headers separated by `spacing.lg` of vertical rhythm.
- **Dismiss:** Escape always works. Click-outside dismisses for popovers; for modals with unsaved state, click-outside prompts.

### Empty States

- **Style:** Centered single-paragraph copy in Body type, Ink Muted. One primary CTA below in Watershed Slate button-primary style. No illustration, no mascot, no "Welcome to..." copy. Voice is direct and technical, per PRODUCT.md.
- **Example copy:** "No dashboards yet." + "Create dashboard" button. Not "Looks like you don't have any dashboards yet! Let's get started! 🎉".

## 6. Do's and Don'ts

### Do:

- **Do** use Watershed Slate (`#1e6b8b`) as the single accent; render it as ink (text, focus rings, active states) on no more than 10% of any screen.
- **Do** name colors by role from the palette (`paper-raised`, `ink-muted`, `watershed-slate-deep`), never by hex literal inside `style={{ color: "#007bff" }}`. Inline literal hex is the visible signature of the design-system fracture this DESIGN.md exists to retire.
- **Do** keep components flat at rest; let tonal layering carry the depth signal.
- **Do** reserve shadow for state changes (hover, focus, active drag) and for floating UI (modals, popovers, dropdowns) where overlap requires depth.
- **Do** use the 4px radius scale (`rounded.sm` = 2px for badges, `rounded.md` = 4px for buttons / tiles / inputs, `rounded.lg` = 6px for floating UI corners). Never invent a new radius step.
- **Do** keep the type stack at exactly two families: Inter for UI, JetBrains Mono for tabular / numeric data.
- **Do** use 4.5:1 contrast minimum for body text on its background; check before shipping a new color pairing.
- **Do** respect `prefers-reduced-motion: reduce` on every animation. The per-tile streaming fade, the dashboard-load loader, and the chatbox typing indicator all gate on it.

### Don't:

- **Don't** introduce a second accent color. The Restrained strategy means there is one accent. (PRODUCT.md anti-reference: SaaS-slop rainbow palette.)
- **Don't** use `#fff` or `#000` anywhere. Pure neutrals detach from the system. Use `paper` or `ink`. (Trace Rule above.)
- **Don't** reintroduce `#007bff`, `#0d6efd`, or `#0a62a9` — these are the drift values flagged in the 2026-05-28 critique. Collapse to `colors.watershed-slate`. (PRODUCT.md anti-reference: government-portal 2010s Bootstrap-default.)
- **Don't** use `border-left` or `border-right` greater than 1px as a colored accent on cards, callouts, alerts, or list items. (PRODUCT.md anti-reference: side-stripe accents on government-portal 2010s. Shared-design-law absolute ban. The 2026-05-28 critique flagged this at `components/modals/MapLayer/SourcePane.js:107`.)
- **Don't** ship a "hero metric template" (big number + small label + supporting stats + gradient accent). (PRODUCT.md anti-reference: SaaS-slop. Shared-design-law absolute ban.)
- **Don't** ship identical card grids of icon + heading + text repeating endlessly. (PRODUCT.md anti-reference: SaaS-slop. The current landing-page dashboard grid was flagged for this in the 2026-05-28 critique.)
- **Don't** use gradient text (`background-clip: text` + a gradient background). Emphasis comes from weight or size. (Shared-design-law absolute ban.)
- **Don't** use glassmorphism, mesh gradients, dark-mode-by-default, or purple-gradient hero treatments on any chatbox or MCP surface. (PRODUCT.md anti-reference: crypto / AI startup neon. Shared-design-law: glassmorphism as default.)
- **Don't** introduce rounded-everything (R≥16 on every surface), soft pastel palettes, illustrative empty states with mascots, or "Great job!" microcopy. (PRODUCT.md anti-reference: consumer fitness-app warmth.)
- **Don't** animate layout properties (`width`, `height`, `min-width`, `top`, `left`). Animate `transform`, `opacity`, or `color`. (The 2026-05-28 critique flagged `transition: width, min-width` at `components/sidebar/ChatSidebar.js:57` and `components/map/LayersControl.js:30`.) (Shared-design-law motion rule.)
- **Don't** mix seven icon families (Bs / Fa / Fa6 / Ci / Hi / Md / Io / Ai). Pick one: Bootstrap Icons (Bs) is the lowest-risk choice given Bootstrap is already in the stack; Lucide is the lane-appropriate choice if a full icon-vocabulary refactor is in scope. Whichever is picked, the others are deleted.
- **Don't** ship inline `style={{}}` with literal hex values for color, padding, or radius. The 311 styled-components are the chosen vocabulary; the 119 inline-style one-offs are the fracture. Refactor toward styled-components when you touch the file.
- **Don't** stack nested cards (a card inside a card). (Shared-design-law layout rule: nested cards are always wrong.)
- **Don't** ship "Welcome to your dashboard journey!" or any first-run modal that introduces the product. The list IS the welcome. (PRODUCT.md design principle: the instrument, not the lab manual.)
- **Don't** use exclamation points or emoji in product UI copy. The chatbox is exempt; the surrounding UI is not. (PRODUCT.md voice rule.)
