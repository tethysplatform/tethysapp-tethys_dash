import { act, useContext } from "react";
import { render, waitFor, screen } from "@testing-library/react";
import WebsocketProvider, {
  WebsocketContext,
} from "components/contexts/WebSocketContext";

// Mock WebSocket
class MockWebSocket {
  static instances = [];
  static reset() {
    MockWebSocket.instances = [];
  }
  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.onopen = null;
    this.onclose = null;
    this.onmessage = null;
    this.close = jest.fn();
    this.send = jest.fn();
    MockWebSocket.instances.push(this);
  }
  triggerOpen() {
    this.readyState = 1;
    this.onopen && this.onopen();
  }
  triggerClose() {
    this.readyState = 3;
    this.onclose && this.onclose();
  }
  triggerMessage(data) {
    this.onmessage && this.onmessage({ data });
  }
}

describe("WebsocketProvider", () => {
  let originalWebSocket;
  let originalEnv;
  beforeAll(() => {
    originalWebSocket = global.WebSocket;
    global.WebSocket = MockWebSocket;
    originalEnv = process.env.REDIS_WS_URL;
    process.env.REDIS_WS_URL = "ws://test-url";
  });
  afterAll(() => {
    global.WebSocket = originalWebSocket;
    process.env.REDIS_WS_URL = originalEnv;
  });
  afterEach(() => {
    MockWebSocket.reset();
    jest.clearAllMocks();
  });

  it("renders children when websocket is ready", async () => {
    const Child = () => <div>child</div>;

    render(
      <WebsocketProvider>
        <Child />
      </WebsocketProvider>
    );

    act(() => {
      MockWebSocket.instances[0].triggerOpen();
    });
    expect(await screen.findByText("child")).toBeInTheDocument();
  });

  it("returns null before websocket is ready and before timeout", async () => {
    const Child = () => <div>child</div>;

    render(
      <WebsocketProvider>
        <Child />
      </WebsocketProvider>
    );
    expect(screen.queryByText("child")).toBeNull();
  });

  it("renders children after timeout if websocket not ready", async () => {
    jest.useFakeTimers();
    const Child = () => <div>child</div>;

    render(
      <WebsocketProvider>
        <Child />
      </WebsocketProvider>
    );

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(await screen.findByText("child")).toBeInTheDocument();

    jest.useRealTimers();
  });

  it("stores and retrieves messages by requestId", async () => {
    let contextValue;
    const TestConsumer = () => {
      contextValue = useContext(WebsocketContext);
      return <div>test</div>;
    };

    render(
      <WebsocketProvider>
        <TestConsumer />
      </WebsocketProvider>
    );

    act(() => {
      MockWebSocket.instances[0].triggerOpen();
    });

    // Simulate a message
    const msg = JSON.stringify({ requestId: "abc", message: "hello" });
    act(() => {
      MockWebSocket.instances[0].triggerMessage(msg);
    });

    await waitFor(() => {
      expect(contextValue.messagesByRequestId["abc"]).toBe(msg);
    });
    // getMessageForRequest returns the message
    expect(contextValue.getMessageForRequest("abc")).toBe(msg);

    // getMessageForRequest for requestId that doesn't exist
    expect(contextValue.getMessageForRequest("nonexistent")).toBeUndefined();
  });

  it("doesnt store and retrieve messages if not requestId", async () => {
    let contextValue;
    const TestConsumer = () => {
      contextValue = useContext(WebsocketContext);
      return <div>test</div>;
    };

    render(
      <WebsocketProvider>
        <TestConsumer />
      </WebsocketProvider>
    );

    act(() => {
      MockWebSocket.instances[0].triggerOpen();
    });

    // Simulate a message
    const msg = JSON.stringify({ message: "hello" });
    act(() => {
      MockWebSocket.instances[0].triggerMessage(msg);
    });

    // getMessageForRequest for requestId that doesn't exist
    expect(contextValue.messagesByRequestId).toEqual({});
  });

  it("doesnt store and retrieve messages if missing message or error", async () => {
    let contextValue;
    const TestConsumer = () => {
      contextValue = useContext(WebsocketContext);
      return <div>test</div>;
    };

    render(
      <WebsocketProvider>
        <TestConsumer />
      </WebsocketProvider>
    );

    act(() => {
      MockWebSocket.instances[0].triggerOpen();
    });

    // Simulate a message
    const msg = JSON.stringify({ requestId: "abc" });
    act(() => {
      MockWebSocket.instances[0].triggerMessage(msg);
    });

    expect(contextValue.messagesByRequestId).toEqual({});
    expect(contextValue.errorMessagesByRequestId).toEqual({});
  });

  it("stores and retrieves error messages by requestId", async () => {
    let contextValue;
    const TestConsumer = () => {
      contextValue = useContext(WebsocketContext);
      return <div>test</div>;
    };

    render(
      <WebsocketProvider>
        <TestConsumer />
      </WebsocketProvider>
    );

    act(() => {
      MockWebSocket.instances[0].triggerOpen();
    });

    // Simulate a message
    const msg = JSON.stringify({ requestId: "abc", error: "Test Error" });
    act(() => {
      MockWebSocket.instances[0].triggerMessage(msg);
    });

    await waitFor(() => {
      expect(contextValue.errorMessagesByRequestId["abc"]).toBe(msg);
    });
    // getErrorMessageForRequest returns the message
    expect(contextValue.getErrorMessageForRequest("abc")).toBe(msg);

    // getMessageForRequest for requestId that doesn't exist
    expect(
      contextValue.getErrorMessageForRequest("nonexistent")
    ).toBeUndefined();
  });

  it("routes composite requestIds independently for per-layer correlation", async () => {
    // Dynamic map-layer plugins use composite requestIds of the form
    // ${sessionNonce}:${gridItemUUID}:${layerId} so that progress messages
    // for different layers on the same grid item (or different tabs with
    // different session nonces) don't collide.
    let contextValue;
    const TestConsumer = () => {
      contextValue = useContext(WebsocketContext);
      return <div>test</div>;
    };

    render(
      <WebsocketProvider>
        <TestConsumer />
      </WebsocketProvider>
    );

    act(() => {
      MockWebSocket.instances[0].triggerOpen();
    });

    // Two layers under the same grid item
    const layerA = JSON.stringify({
      requestId: "nonce-1:grid-x:layer-a",
      message: "layer A progress",
      percentageComplete: 40,
      layerId: "layer-a",
    });
    const layerB = JSON.stringify({
      requestId: "nonce-1:grid-x:layer-b",
      message: "layer B progress",
      percentageComplete: 10,
      layerId: "layer-b",
    });
    // Same layer id, different tab (different session nonce)
    const otherTab = JSON.stringify({
      requestId: "nonce-2:grid-x:layer-a",
      message: "other tab",
      percentageComplete: 99,
      layerId: "layer-a",
    });

    act(() => {
      MockWebSocket.instances[0].triggerMessage(layerA);
      MockWebSocket.instances[0].triggerMessage(layerB);
      MockWebSocket.instances[0].triggerMessage(otherTab);
    });

    await waitFor(() => {
      expect(
        contextValue.getMessageForRequest("nonce-1:grid-x:layer-a")
      ).toBe(layerA);
    });
    expect(
      contextValue.getMessageForRequest("nonce-1:grid-x:layer-b")
    ).toBe(layerB);
    expect(
      contextValue.getMessageForRequest("nonce-2:grid-x:layer-a")
    ).toBe(otherTab);
    // Partial matches must not leak between layers or tabs
    expect(
      contextValue.getMessageForRequest("nonce-1:grid-x:layer-c")
    ).toBeUndefined();
  });

  it("sendMessage calls ws.send", async () => {
    let contextValue;
    const TestConsumer = () => {
      contextValue = useContext(WebsocketContext);
      return <div>test</div>;
    };

    render(
      <WebsocketProvider>
        <TestConsumer />
      </WebsocketProvider>
    );

    act(() => {
      MockWebSocket.instances[0].triggerOpen();
    });
    act(() => {
      contextValue.sendMessage && contextValue.sendMessage("foo");
    });
    expect(MockWebSocket.instances[0].send).toHaveBeenCalledWith("foo");
  });

  it("getMessageForRequest returns undefined for missing or invalid messages", async () => {
    let contextValue;
    const TestConsumer = () => {
      contextValue = useContext(WebsocketContext);
      return <div>test</div>;
    };

    render(
      <WebsocketProvider>
        <TestConsumer />
      </WebsocketProvider>
    );

    act(() => {
      MockWebSocket.instances[0].triggerOpen();
    });
    // No message for id
    expect(contextValue.getMessageForRequest("notfound")).toBeUndefined();

    // Invalid JSON
    act(() => {
      MockWebSocket.instances[0].triggerMessage("notjson");
    });
    expect(contextValue.getMessageForRequest("notfound")).toBeUndefined();

    // Message with wrong requestId
    const wrongIdMsg = JSON.stringify({ requestId: "other", message: "hi" });
    act(() => {
      MockWebSocket.instances[0].triggerMessage(wrongIdMsg);
    });
    expect(contextValue.getMessageForRequest("notfound")).toBeUndefined();

    // Message missing requestId
    const missingIdMsg = JSON.stringify({ message: "hi" });
    act(() => {
      MockWebSocket.instances[0].triggerMessage(missingIdMsg);
    });
    expect(contextValue.getMessageForRequest("notfound")).toBeUndefined();
  });

  it("getErrorMessageForRequest returns undefined for missing or invalid messages", async () => {
    let contextValue;
    const TestConsumer = () => {
      contextValue = useContext(WebsocketContext);
      return <div>test</div>;
    };

    render(
      <WebsocketProvider>
        <TestConsumer />
      </WebsocketProvider>
    );

    act(() => {
      MockWebSocket.instances[0].triggerOpen();
    });
    // No message for id
    expect(contextValue.getErrorMessageForRequest("notfound")).toBeUndefined();

    // Invalid JSON
    act(() => {
      MockWebSocket.instances[0].triggerMessage("notjson");
    });
    expect(contextValue.getErrorMessageForRequest("notfound")).toBeUndefined();

    // Message with wrong requestId
    const wrongIdMsg = JSON.stringify({ requestId: "other", error: "hi" });
    act(() => {
      MockWebSocket.instances[0].triggerMessage(wrongIdMsg);
    });
    expect(contextValue.getErrorMessageForRequest("notfound")).toBeUndefined();

    // Message missing requestId
    const missingIdMsg = JSON.stringify({ error: "hi" });
    act(() => {
      MockWebSocket.instances[0].triggerMessage(missingIdMsg);
    });
    expect(contextValue.getErrorMessageForRequest("notfound")).toBeUndefined();
  });

  it("webSocketUrl not defined", async () => {
    delete process.env.REDIS_WS_URL;
    let contextValue;
    const TestConsumer = () => {
      contextValue = useContext(WebsocketContext);
      return <div>test</div>;
    };

    render(
      <WebsocketProvider>
        <TestConsumer />
      </WebsocketProvider>
    );

    expect(MockWebSocket.instances.length).toBe(0);

    expect(contextValue.sendMessage()).toEqual(undefined);
    expect(contextValue.messagesByRequestId).toEqual({});
    expect(contextValue.errorMessagesByRequestId).toEqual({});
  });
});
