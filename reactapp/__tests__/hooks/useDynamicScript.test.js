import { renderHook } from "@testing-library/react";
import useDynamicScript from "hooks/useDynamicScript";
import { act } from "react";

// Mock the document.head.appendChild and document.head.removeChild
describe("useDynamicScript", () => {
  let appendChildSpy, removeChildSpy;

  beforeEach(() => {
    appendChildSpy = jest.spyOn(document.head, "appendChild");
    removeChildSpy = jest.spyOn(document.head, "removeChild");
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("should not load script if no URL is provided", () => {
    renderHook(() => useDynamicScript({}));

    expect(appendChildSpy).not.toHaveBeenCalled();
  });

  test("should load the script and set ready to true on successful load", async () => {
    const scriptUrl = "https://example.com/success.js";

    const { result, rerender } = renderHook((url) => useDynamicScript({ url }), {
      initialProps: null,
    });

    expect(result.current.ready).toBe(false);
    expect(result.current.failed).toBe(false);

    rerender(scriptUrl);

    // Simulate successful script load
    act(() => {
      const script = appendChildSpy.mock.calls[0][0];
      script.onload();
    });

    expect(result.current.ready).toBe(true);
    expect(result.current.failed).toBe(false);
    expect(appendChildSpy).toHaveBeenCalledWith(expect.any(HTMLScriptElement));
    expect(appendChildSpy.mock.calls[0][0].src).toBe(scriptUrl);
  });

  test("should set failed to true if the script fails to load", async () => {
    const scriptUrl = "https://example.com/fail.js";

    const { result, rerender } = renderHook((url) => useDynamicScript({ url }), {
      initialProps: null,
    });

    rerender(scriptUrl);

    // Simulate failed script load
    act(() => {
      const script = appendChildSpy.mock.calls[0][0];
      script.onerror();
    });

    expect(result.current.ready).toBe(false);
    expect(result.current.failed).toBe(true);
    expect(appendChildSpy).toHaveBeenCalledWith(expect.any(HTMLScriptElement));
    expect(appendChildSpy.mock.calls[0][0].src).toBe(scriptUrl);
  });

  test("should clean up and remove the script on unmount", () => {
    const scriptUrl = "https://example.com/cleanup.js";

    const { unmount } = renderHook(() => useDynamicScript({ url: scriptUrl }));

    expect(appendChildSpy).toHaveBeenCalledWith(expect.any(HTMLScriptElement));
    expect(appendChildSpy.mock.calls[0][0].src).toBe(scriptUrl);

    unmount();

    expect(removeChildSpy).toHaveBeenCalledWith(appendChildSpy.mock.calls[0][0]);
  });

  test("should remove the old script and load the new one when URL changes", () => {
    const initialUrl = "https://example.com/initial.js";
    const newUrl = "https://example.com/new.js";

    const { rerender } = renderHook((url) => useDynamicScript({ url }), {
      initialProps: initialUrl,
    });

    expect(appendChildSpy).toHaveBeenCalledWith(expect.any(HTMLScriptElement));
    expect(appendChildSpy.mock.calls[0][0].src).toBe(initialUrl);

    rerender(newUrl);

    expect(removeChildSpy).toHaveBeenCalledWith(appendChildSpy.mock.calls[0][0]);
    expect(appendChildSpy).toHaveBeenCalledWith(expect.any(HTMLScriptElement));
    expect(appendChildSpy.mock.calls[1][0].src).toBe(newUrl);
  });
});
