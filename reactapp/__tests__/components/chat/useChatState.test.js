import { withLiveProgress } from "components/chatbot/useChatState";

// Build the raw WS payload string the backend sends: {message, requestId}.
const payloadFor = (requestId, message) =>
  JSON.stringify({ requestId, message });

// getMessageForRequest(id) -> raw payload string, keyed by id (null if absent).
const gmr = (map) => (id) => map[id] ?? null;

describe("withLiveProgress", () => {
  const placeholder = { role: "assistant", text: "", id: "c1" };

  test("overlays live progress onto an empty assistant placeholder", () => {
    const messages = [{ role: "user", text: "hi", id: "u1" }, placeholder];
    const out = withLiveProgress(
      messages,
      gmr({ c1: payloadFor("c1", "Looking up plugin...") }),
    );
    expect(out).not.toBe(messages); // new array
    expect(out[out.length - 1].text).toBe("Looking up plugin...");
    expect(messages[1].text).toBe(""); // original not mutated
  });

  test("no overlay once the last bubble already has text (final reply)", () => {
    const messages = [{ role: "assistant", text: "done", id: "c1" }];
    expect(
      withLiveProgress(messages, gmr({ c1: payloadFor("c1", "late") })),
    ).toBe(messages);
  });

  test("ignored when the last message is not an assistant bubble", () => {
    const messages = [{ role: "user", text: "", id: "u1" }];
    expect(withLiveProgress(messages, gmr({ u1: payloadFor("u1", "x") }))).toBe(
      messages,
    );
  });

  test("ignored when the WebSocket context is unavailable", () => {
    const messages = [placeholder];
    expect(withLiveProgress(messages, undefined)).toBe(messages);
  });

  test("ignored when no payload has arrived for the request id yet", () => {
    const messages = [placeholder];
    expect(withLiveProgress(messages, gmr({}))).toBe(messages);
  });

  test("ignored for an unparseable payload", () => {
    const messages = [placeholder];
    expect(withLiveProgress(messages, gmr({ c1: "not json" }))).toBe(messages);
  });

  test("ignored when the payload requestId does not match the bubble id", () => {
    const messages = [placeholder];
    expect(
      withLiveProgress(messages, gmr({ c1: payloadFor("other", "x") })),
    ).toBe(messages);
  });

  test("ignored for an empty or non-string message", () => {
    const messages = [placeholder];
    expect(withLiveProgress(messages, gmr({ c1: payloadFor("c1", "") }))).toBe(
      messages,
    );
    expect(
      withLiveProgress(
        messages,
        gmr({ c1: JSON.stringify({ requestId: "c1", message: 42 }) }),
      ),
    ).toBe(messages);
  });

  test("handles an empty message list", () => {
    const messages = [];
    expect(withLiveProgress(messages, gmr({}))).toBe(messages);
  });
});
