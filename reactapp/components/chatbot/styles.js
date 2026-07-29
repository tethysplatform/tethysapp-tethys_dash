import styled, { css, keyframes } from "styled-components";

// Shared design tokens for the chatbot surface. Single source for the palette
// that was previously hard-coded across every chat component. Values match the
// host TethysDash app (Bootstrap / Open Color) so the assistant reads as part
// of the product, not a bolt-on.
export const colors = {
  accent: "#4a90e2",
  accentHover: "#3f82d1",
  accentActive: "#3573bd",
  accentSoft: "#eef4fc",
  accentSoftBorder: "#cfe2fb",
  link: "#1c7ed6",

  surface: "#ffffff",
  surfaceMuted: "#f8f9fa",
  bubbleAssistant: "#f1f3f5",

  border: "#dee2e6",
  borderStrong: "#ced4da",

  text: "#212529",
  textMuted: "#495057",
  textFaint: "#868e96",
  textFainter: "#adb5bd",

  errorBg: "#fff5f5",
  errorBorder: "#ffc9c9",
  errorText: "#c92a2a",

  // "Beta" is signalled in a restrained amber so it reads as experimental
  // without competing with the blue action accent.
  betaText: "#9a6700",
  betaBg: "#fff4e2",
  betaBorder: "#ffe0a6",
};

export const radii = {
  sm: "6px",
  md: "8px",
  lg: "12px",
  pill: "999px",
};

// One keyboard-focus treatment for every interactive element, so focus is
// always visible (a11y) and consistent across the surface.
export const focusRing = css`
  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.4);
  }
`;

// Small, glanceable "Beta" marker. Full border (never a side stripe), no
// gradient. Uppercase micro-label is a conventional beta affordance.
export const BetaBadge = styled.span`
  display: inline-flex;
  align-items: center;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 1px 6px;
  border-radius: ${radii.pill};
  color: ${colors.betaText};
  background: ${colors.betaBg};
  border: 1px solid ${colors.betaBorder};
`;

const dotPulse = keyframes`
  0%, 60%, 100% { opacity: 0.25; }
  30% { opacity: 1; }
`;

const Dots = styled.span`
  display: inline-flex;
  gap: 3px;
  span {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: currentColor;
    animation: ${dotPulse} 1.2s ease-in-out infinite;
  }
  span:nth-child(2) {
    animation-delay: 0.2s;
  }
  span:nth-child(3) {
    animation-delay: 0.4s;
  }
  /* Motion conveys the "working" state; drop it for reduced-motion users, who
     still get the static label + dots. */
  @media (prefers-reduced-motion: reduce) {
    span {
      animation: none;
      opacity: 0.6;
    }
  }
`;

// Animated ellipsis that signals the assistant is working. Label is provided
// by the caller so the meaning stays in the DOM for screen readers.
export function TypingDots() {
  return (
    <Dots aria-hidden="true">
      <span />
      <span />
      <span />
    </Dots>
  );
}
