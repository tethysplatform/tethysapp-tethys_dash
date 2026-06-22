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
