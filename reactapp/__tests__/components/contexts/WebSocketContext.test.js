import React, { act } from "react";
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
      contextValue = React.useContext(WebsocketContext);
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

  it("sendMessage calls ws.send", async () => {
    let contextValue;
    const TestConsumer = () => {
      contextValue = React.useContext(WebsocketContext);
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
      contextValue = React.useContext(WebsocketContext);
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
});
