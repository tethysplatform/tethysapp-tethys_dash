import { render, screen } from "@testing-library/react";

import Text from "components/visualizations/Text";

function renderText(overrides = {}) {
  return render(<Text textValue="" {...overrides} />);
}

describe("Text", () => {
  it("renders plain text", () => {
    renderText({ textValue: "Hello world" });

    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("renders HTML content", () => {
    renderText({ textValue: "<strong>Bold text</strong>" });

    expect(screen.getByText("Bold text").tagName).toBe("STRONG");
  });

  it("sanitizes dangerous HTML", () => {
    renderText({
      textValue: '<div>Safe</div><script>alert("xss")</script>',
    });

    expect(screen.getByText("Safe")).toBeInTheDocument();
    expect(screen.queryByText('alert("xss")')).not.toBeInTheDocument();
  });

  it("converts plain-text URLs into links", () => {
    renderText({ textValue: "Visit https://example.com for info" });

    const link = screen.getByRole("link", { name: "https://example.com" });
    expect(link).toHaveAttribute("href", "https://example.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("prepends https:// to www. URLs", () => {
    renderText({ textValue: "Go to www.example.com" });

    const link = screen.getByRole("link", { name: "www.example.com" });
    expect(link).toHaveAttribute("href", "https://www.example.com");
  });

  it("does not double-wrap URLs already inside anchor tags", () => {
    renderText({
      textValue: '<a href="https://example.com">Click here</a>',
    });

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveTextContent("Click here");
  });

  it("linkifies multiple URLs in the same text", () => {
    renderText({
      textValue: "See https://one.com and https://two.com",
    });

    expect(
      screen.getByRole("link", { name: "https://one.com" }),
    ).toHaveAttribute("href", "https://one.com");
    expect(
      screen.getByRole("link", { name: "https://two.com" }),
    ).toHaveAttribute("href", "https://two.com");
  });

  it("handles ftp URLs", () => {
    renderText({ textValue: "Download from ftp://files.example.com" });

    const link = screen.getByRole("link", { name: "ftp://files.example.com" });
    expect(link).toHaveAttribute("href", "ftp://files.example.com");
  });

  it("does not linkify text without URLs", () => {
    renderText({ textValue: "No links here" });

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("No links here")).toBeInTheDocument();
  });

  it("renders empty content when textValue is empty", () => {
    const { container } = renderText({ textValue: "" });

    expect(container.textContent).toBe("");
  });

  it("accepts a visualizationRef", () => {
    const ref = { current: null };
    renderText({ textValue: "test", visualizationRef: ref });

    expect(ref.current).not.toBeNull();
  });
});

// The CSS styled-components generated for an element's own classes.
const rulesFor = (element) => {
  // No Testing Library query reads injected stylesheets, and the project does
  // not use jest-styled-components, so the rules are read off the style tags.
  // eslint-disable-next-line testing-library/no-node-access
  const css = Array.from(document.querySelectorAll("style"))
    .map((style) => style.textContent)
    .join("");
  return Array.from(element.classList)
    .flatMap(
      (cls) => css.match(new RegExp(`\\.${cls}[^{]*\\{[^}]*\\}`, "g")) ?? [],
    )
    .join("");
};

describe("Text scrollbar", () => {
  it("scrolls with a visible scrollbar by default", () => {
    renderText({ textValue: "Hello" });

    const rules = rulesFor(screen.getByTestId("text-visualization"));
    expect(rules).toMatch(/overflow-y:\s*auto/);
    expect(rules).not.toMatch(/scrollbar-width:\s*none/);
  });

  it("hides the scrollbar but keeps scrolling when asked", () => {
    renderText({ textValue: "Hello", hideScrollbar: true });

    const rules = rulesFor(screen.getByTestId("text-visualization"));
    expect(rules).toMatch(/overflow-y:\s*auto/);
    expect(rules).toMatch(/scrollbar-width:\s*none/);
  });
});

describe("Text vertical alignment", () => {
  it.each([
    ["top", [], [/margin-top:\s*auto/, /margin-bottom:\s*auto/]],
    ["middle", [/margin-top:\s*auto/, /margin-bottom:\s*auto/], []],
    ["bottom", [/margin-top:\s*auto/], [/margin-bottom:\s*auto/]],
  ])(
    "places %s-aligned text with auto margins",
    (verticalAlign, has, lacks) => {
      renderText({ textValue: "Hello", verticalAlign });

      const rules = rulesFor(screen.getByTestId("text-content"));
      has.forEach((rule) => expect(rules).toMatch(rule));
      lacks.forEach((rule) => expect(rules).not.toMatch(rule));
    },
  );

  it("keeps the tile scrollable so tall centred text scrolls from its top", () => {
    renderText({ textValue: "Hello", verticalAlign: "middle" });

    const rules = rulesFor(screen.getByTestId("text-visualization"));
    expect(rules).toMatch(/overflow-y:\s*auto/);
    expect(rules).not.toMatch(/justify-content:\s*center/);
  });
});
