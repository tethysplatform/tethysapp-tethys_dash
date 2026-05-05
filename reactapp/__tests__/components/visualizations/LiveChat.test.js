import { useState, useImperativeHandle, createRef, act } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import LiveChat, { ChatMessage } from "components/visualizations/LiveChat";
import { AppContext } from "components/contexts/Contexts";
import { WebsocketContext } from "components/contexts/WebSocketContext";

const mockSendMessage = jest.fn();
const mockWebsocketContext = {
  websocketReady: true,
  sendMessage: mockSendMessage,
  messagesByRequestId: {},
  errorMessagesByRequestId: {},
};
const mockAppContext = {
  user: { username: "TestUser" },
};

const chatHistory = [
  {
    message: "Hello world!",
    sessionId: "session-1",
    sender: "Alice",
    timestamp: Date.now(),
    messageId: "msg-1",
    edited: false,
  },
  {
    message: "Hi Alice!",
    sessionId: "session-2",
    sender: "Bob",
    timestamp: Date.now(),
    messageId: "msg-2",
    edited: false,
  },
];

function renderWithContexts(props = {}) {
  return render(
    <AppContext.Provider value={mockAppContext}>
      <WebsocketContext.Provider value={mockWebsocketContext}>
        <LiveChat requestId="req-1" chatHistory={chatHistory} {...props} />
      </WebsocketContext.Provider>
    </AppContext.Provider>,
  );
}

describe("LiveChat", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
  });

  it("renders chat history and username", () => {
    renderWithContexts();
    expect(screen.getByText("Hello world!")).toBeInTheDocument();
    expect(screen.getByText("Hi Alice!")).toBeInTheDocument();
    expect(screen.getByLabelText("Change Username")).toBeInTheDocument();
  });

  it("renders chat history with a new line in a message", () => {
    render(
      <AppContext.Provider value={mockAppContext}>
        <WebsocketContext.Provider value={mockWebsocketContext}>
          <LiveChat
            requestId="req-1"
            chatHistory={[
              {
                message: "Hello \nworld!",
                sessionId: "session-1",
                sender: "Alice",
                timestamp: Date.now(),
                messageId: "msg-1",
                edited: false,
              },
            ]}
          />
        </WebsocketContext.Provider>
      </AppContext.Provider>,
    );

    const div = screen.getByText(
      (content, element) =>
        element.tagName.toLowerCase() === "div" &&
        element.textContent === "Hello world!",
    );
    // eslint-disable-next-line
    expect(div.querySelector("br")).toBeInTheDocument();
    expect(screen.getByLabelText("Change Username")).toBeInTheDocument();
  });

  it("set username if no cache", async () => {
    render(
      <AppContext.Provider value={{ user: { username: "" } }}>
        <WebsocketContext.Provider value={mockWebsocketContext}>
          <LiveChat requestId="req-1" chatHistory={chatHistory} />
        </WebsocketContext.Provider>
      </AppContext.Provider>,
    );

    expect(await screen.findByLabelText("Set Username")).toBeInTheDocument();
    expect(screen.queryByLabelText("Change Username")).not.toBeInTheDocument();
    const input = screen.getByPlaceholderText(/enter your username/i);

    fireEvent.change(input, { target: { value: "NewUser" } });
    fireEvent.click(screen.getByLabelText("Set Username"));
    expect(window.localStorage.getItem("livechat_username_req-1")).toBe(
      "NewUser",
    );
  });

  it("allows custom username change", () => {
    renderWithContexts();
    fireEvent.click(screen.getByLabelText("Change Username"));
    const input = screen.getByPlaceholderText(/enter your username/i);

    fireEvent.change(input, { target: { value: " " } });
    fireEvent.click(screen.getByLabelText("Set Username"));
    expect(window.localStorage.getItem("livechat_username_req-1")).toBe(null);

    fireEvent.change(input, { target: { value: "NewUser" } });
    fireEvent.click(screen.getByLabelText("Set Username"));
    expect(window.localStorage.getItem("livechat_username_req-1")).toBe(
      "NewUser",
    );
  });

  it("allows username change", () => {
    renderWithContexts();
    fireEvent.click(screen.getByLabelText("Change Username"));
    const input = screen.getByPlaceholderText(/enter your username/i);

    fireEvent.change(input, { target: { value: " " } });
    fireEvent.click(screen.getByLabelText("Set Username"));
    expect(window.localStorage.getItem("livechat_username_req-1")).toBe(null);

    fireEvent.change(input, { target: { value: "NewUser" } });
    fireEvent.click(screen.getByLabelText("Set Username"));
    expect(window.localStorage.getItem("livechat_username_req-1")).toBe(
      "NewUser",
    );
  });

  it("sends a message", async () => {
    // eslint-disable-next-line
    function TestWrapper({ rerenderRef, ...props }) {
      const [messagesByRequestId, setMessagesByRequestId] = useState({});
      useImperativeHandle(rerenderRef, () => ({ setMessagesByRequestId }), [
        setMessagesByRequestId,
      ]);
      const customWebsocketContext = {
        ...mockWebsocketContext,
        messagesByRequestId,
      };
      return (
        <AppContext.Provider value={mockAppContext}>
          <WebsocketContext.Provider value={customWebsocketContext}>
            <LiveChat requestId="req-1" chatHistory={chatHistory} {...props} />
          </WebsocketContext.Provider>
        </AppContext.Provider>
      );
    }
    const rerenderRef = createRef();
    render(<TestWrapper rerenderRef={rerenderRef} />);

    const textarea = screen.getByPlaceholderText(/type a message/i);
    fireEvent.change(textarea, { target: { value: "Test message" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(mockSendMessage).toHaveBeenCalled();
    const sent = JSON.parse(mockSendMessage.mock.calls[0][0]);
    expect(sent.message).toBe("Test message");
    expect(sent.sender).toBe("TestUser");

    rerenderRef.current.setMessagesByRequestId({
      "req-1": JSON.stringify({ ...sent, timestamp: Date.now() }),
    });
    expect(await screen.findByLabelText("Edit message")).toBeInTheDocument();

    // send a duplicate message to get an error message
    fireEvent.change(textarea, { target: { value: "Test message" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(textarea.value).toBe("Test message");
    expect(
      screen.getByText(
        "Duplicate message detected. Please send a different message.",
      ),
    ).toBeInTheDocument();
  });

  it("empty message disables button", async () => {
    renderWithContexts();
    const textarea = screen.getByPlaceholderText(/type a message/i);
    fireEvent.change(textarea, { target: { value: "" } });
    const sendButton = screen.getByRole("button", { name: /send/i });
    expect(sendButton).toBeDisabled();
  });

  it("adds a new line with Shift+Enter in message textarea", async () => {
    renderWithContexts();
    const textarea = screen.getByPlaceholderText(/type a message/i);
    fireEvent.change(textarea, { target: { value: "First line" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    // Simulate user input after Shift+Enter (since fireEvent.keyDown does not update value)
    fireEvent.change(textarea, { target: { value: "First line\n" } });
    expect(textarea.value).toBe("First line\n");
    expect(mockSendMessage).not.toHaveBeenCalled();
    // Add more text after new line
    fireEvent.change(textarea, {
      target: { value: "First line\nSecond line" },
    });
    expect(textarea.value).toBe("First line\nSecond line");
  });

  it("sends a message with Enter in message textarea", async () => {
    renderWithContexts();
    const textarea = screen.getByPlaceholderText(/type a message/i);
    fireEvent.change(textarea, { target: { value: "First line" } });
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(textarea.value).toBe("First line");
    expect(mockSendMessage).toHaveBeenCalledWith(
      JSON.stringify({
        requestId: "req-1",
        message: "First line",
        sender: "TestUser",
        sessionId: "12345678",
        messageId: 12345678,
      }),
    );
  });

  it("Updates previous messages", async () => {
    // eslint-disable-next-line
    function TestWrapper({ rerenderRef, ...props }) {
      const [messagesByRequestId, setMessagesByRequestId] = useState({});
      useImperativeHandle(rerenderRef, () => ({ setMessagesByRequestId }), [
        setMessagesByRequestId,
      ]);
      const customWebsocketContext = {
        ...mockWebsocketContext,
        messagesByRequestId,
      };
      return (
        <AppContext.Provider value={mockAppContext}>
          <WebsocketContext.Provider value={customWebsocketContext}>
            <LiveChat requestId="req-1" chatHistory={chatHistory} {...props} />
          </WebsocketContext.Provider>
        </AppContext.Provider>
      );
    }
    const rerenderRef = createRef();
    render(<TestWrapper rerenderRef={rerenderRef} />);

    expect(screen.getByText("Hello world!")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Hi Alice!")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();

    rerenderRef.current.setMessagesByRequestId({
      "req-1": JSON.stringify({
        message: "How are you?",
        sessionId: "session-1",
        sender: "Alice New Name",
        timestamp: Date.now(),
        messageId: "msg-3",
        edited: false,
      }),
    });

    expect(await screen.findByText("How are you?")).toBeInTheDocument();
    expect(screen.getAllByText("Alice New Name").length).toBe(2);
    expect(screen.queryByText("Alice")).not.toBeInTheDocument();
  });

  it("Show websocket error messages", async () => {
    // eslint-disable-next-line
    function TestWrapper({ rerenderRef, ...props }) {
      const [errorMessagesByRequestId, setErrorMessagesByRequestId] = useState(
        {},
      );

      useImperativeHandle(
        rerenderRef,
        () => ({ setErrorMessagesByRequestId }),
        [setErrorMessagesByRequestId],
      );
      const customWebsocketContext = {
        ...mockWebsocketContext,
        errorMessagesByRequestId,
      };
      return (
        <AppContext.Provider value={mockAppContext}>
          <WebsocketContext.Provider value={customWebsocketContext}>
            <LiveChat requestId="req-1" chatHistory={chatHistory} {...props} />
          </WebsocketContext.Provider>
        </AppContext.Provider>
      );
    }
    const rerenderRef = createRef();
    render(<TestWrapper rerenderRef={rerenderRef} />);

    const textarea = screen.getByPlaceholderText(/type a message/i);

    const sendBtn = await screen.findByLabelText("Send");
    fireEvent.change(textarea, { target: { value: `msg1` } });
    fireEvent.click(sendBtn);

    // Simulate message acknowledgment by updating messagesByRequestId
    const sent = JSON.parse(mockSendMessage.mock.calls[0][0]);
    // eslint-disable-next-line
    expect(sent.message).toBe(`msg1`);
    rerenderRef.current.setErrorMessagesByRequestId({
      "req-1": JSON.stringify({
        error: "Test error message",
        messageId: sent.messageId,
      }),
    });

    expect(await screen.findByText(/test error message/i)).toBeInTheDocument();
  });

  it("disables send button when websocket not ready", () => {
    render(
      <AppContext.Provider value={mockAppContext}>
        <WebsocketContext.Provider
          value={{ ...mockWebsocketContext, websocketReady: false }}
        >
          <LiveChat requestId="req-1" chatHistory={chatHistory} />
        </WebsocketContext.Provider>
      </AppContext.Provider>,
    );
    const textarea = screen.getByPlaceholderText(/connecting/i);
    expect(textarea).toBeDisabled();
    expect(screen.getByRole("button", { name: /send/i })).toBeDisabled();
  });

  it("shows rate limit message and disables send", async () => {
    jest.useFakeTimers();
    // eslint-disable-next-line
    function TestWrapper({ rerenderRef, ...props }) {
      const [messagesByRequestId, setMessagesByRequestId] = useState({});
      useImperativeHandle(rerenderRef, () => ({ setMessagesByRequestId }), [
        setMessagesByRequestId,
      ]);
      const customWebsocketContext = {
        ...mockWebsocketContext,
        messagesByRequestId,
      };
      return (
        <AppContext.Provider value={mockAppContext}>
          <WebsocketContext.Provider value={customWebsocketContext}>
            <LiveChat requestId="req-1" chatHistory={chatHistory} {...props} />
          </WebsocketContext.Provider>
        </AppContext.Provider>
      );
    }
    const rerenderRef = createRef();
    render(<TestWrapper rerenderRef={rerenderRef} />);

    const textarea = screen.getByPlaceholderText(/type a message/i);
    for (let i = 0; i < 6; i++) {
      const sendBtn = await screen.findByLabelText("Send");
      fireEvent.change(textarea, { target: { value: `msg${i}` } });
      fireEvent.click(sendBtn);
      if (i < 5) {
        // Simulate message acknowledgment by updating messagesByRequestId
        const sent = JSON.parse(mockSendMessage.mock.calls[i][0]);
        // eslint-disable-next-line
        expect(sent.message).toBe(`msg${i}`);
        rerenderRef.current.setMessagesByRequestId({
          "req-1": JSON.stringify({ ...sent, timestamp: Date.now() }),
        });
      }
    }

    // After the 6th send, do NOT rerender, so rateLimited state persists
    expect(
      screen.getByText(/sending messages too quickly/i),
    ).toBeInTheDocument();
    let sendBtn = screen.getByLabelText("Send");
    expect(sendBtn).toBeDisabled();

    expect(
      screen.getByText(/please wait 10 seconds before/i),
    ).toBeInTheDocument();

    // Fast-forward timer
    act(() => {
      jest.advanceTimersByTime(9000); // triggers the countdown decrement and reset
    });

    expect(
      screen.getByText(/please wait 1 second before/i),
    ).toBeInTheDocument();

    // Fast-forward timer to trigger countdown reset
    act(() => {
      jest.advanceTimersByTime(1000); // triggers the countdown decrement and reset
    });

    // Wait for the send button to be enabled again
    expect(await screen.findByLabelText("Send")).toBeEnabled();

    for (let i = 0; i < 6; i++) {
      const sendBtn = await screen.findByLabelText("Send");
      fireEvent.change(textarea, { target: { value: `msg${i}` } });
      fireEvent.click(sendBtn);
      if (i < 5) {
        // Simulate message acknowledgment by updating messagesByRequestId
        const sent = JSON.parse(mockSendMessage.mock.calls[i][0]);
        // eslint-disable-next-line
        expect(sent.message).toBe(`msg${i}`);
        rerenderRef.current.setMessagesByRequestId({
          "req-1": JSON.stringify({ ...sent, timestamp: Date.now() }),
        });
      }
    }

    // After the 6th send, do NOT rerender, so rateLimited state persists
    expect(
      screen.getByText(/sending messages too quickly/i),
    ).toBeInTheDocument();
    sendBtn = screen.getByLabelText("Send");
    expect(sendBtn).toBeDisabled();

    jest.useRealTimers();
  });

  it("shows error when send fails", async () => {
    mockWebsocketContext.sendMessage = () => {
      throw new Error("fail");
    };
    renderWithContexts();
    const textarea = screen.getByPlaceholderText(/type a message/i);
    fireEvent.change(textarea, { target: { value: "fail msg" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(
      await screen.findByText(/failed to send message/i),
    ).toBeInTheDocument();
  });
});

describe("ChatMessage", () => {
  it("allows editing own message", async () => {
    const ownMsg = { ...chatHistory[0], sessionId: "session-xyz" };
    const setPendingMessageId = jest.fn();
    const mockSend = jest.fn();
    const { rerender } = render(
      <WebsocketContext.Provider value={{ sendMessage: mockSend }}>
        <ChatMessage
          msg={ownMsg}
          sessionId="session-xyz"
          requestId="req-1"
          messageId={ownMsg.messageId}
          setPendingMessageId={setPendingMessageId}
          pendingMessageId={null}
        />
      </WebsocketContext.Provider>,
    );
    const editBtn = await screen.findByLabelText("Edit message");
    fireEvent.click(editBtn);
    const saveBtn = await screen.findByLabelText("Save Button");
    const editInput = screen.getByDisplayValue(ownMsg.message);
    fireEvent.change(editInput, { target: { value: "Edited message" } });
    fireEvent.click(saveBtn);
    expect(mockSend).toHaveBeenCalled();
    const sent = JSON.parse(mockSend.mock.calls[0][0]);
    expect(sent.message).toBe("Edited message");

    ownMsg.edited = true;
    rerender(
      <WebsocketContext.Provider value={{ sendMessage: mockSend }}>
        <ChatMessage
          msg={ownMsg}
          sessionId="session-xyz"
          requestId="req-1"
          messageId={ownMsg.messageId}
          setPendingMessageId={setPendingMessageId}
          pendingMessageId={ownMsg.messageId}
        />
      </WebsocketContext.Provider>,
    );

    expect(await screen.findByText(/- Edited/i)).toBeInTheDocument();
    expect(saveBtn).not.toBeInTheDocument();
  });

  it("fails editing own message", async () => {
    const ownMsg = { ...chatHistory[0], sessionId: "session-xyz" };
    const setPendingMessageId = jest.fn();
    // mockSend will throw to simulate failure
    const mockSend = jest.fn(() => {
      throw new Error("Failed to update message. Please try again.");
    });
    render(
      <WebsocketContext.Provider value={{ sendMessage: mockSend }}>
        <ChatMessage
          msg={ownMsg}
          sessionId="session-xyz"
          requestId="req-1"
          messageId={ownMsg.messageId}
          setPendingMessageId={setPendingMessageId}
          pendingMessageId={null}
        />
      </WebsocketContext.Provider>,
    );
    const editBtn = await screen.findByLabelText("Edit message");
    fireEvent.click(editBtn);
    const saveBtn = await screen.findByLabelText("Save Button");
    const editInput = screen.getByDisplayValue(ownMsg.message);
    fireEvent.change(editInput, { target: { value: "Edited message" } });
    fireEvent.click(saveBtn);
    expect(mockSend).toHaveBeenCalled();
    // Error message should be shown
    expect(
      await screen.findByText(/Failed to update message/i),
    ).toBeInTheDocument();
  });

  it("cancels editing own message", async () => {
    const ownMsg = { ...chatHistory[0], sessionId: "session-xyz" };
    const setPendingMessageId = jest.fn();
    render(
      <WebsocketContext.Provider value={mockWebsocketContext}>
        <ChatMessage
          msg={ownMsg}
          sessionId="session-xyz"
          requestId="req-1"
          messageId={ownMsg.messageId}
          setPendingMessageId={setPendingMessageId}
          pendingMessageId={null}
        />
      </WebsocketContext.Provider>,
    );
    const editBtn = await screen.findByLabelText("Edit message");
    fireEvent.click(editBtn);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByDisplayValue(ownMsg.message)).not.toBeInTheDocument();
  });

  it("renders edited message meta", async () => {
    const editedMsg = { ...chatHistory[0], edited: true };
    const setPendingMessageId = jest.fn();
    render(
      <WebsocketContext.Provider value={mockWebsocketContext}>
        <ChatMessage
          msg={editedMsg}
          sessionId={editedMsg.sessionId}
          requestId="req-1"
          messageId={editedMsg.messageId}
          setPendingMessageId={setPendingMessageId}
          pendingMessageId={null}
        />
      </WebsocketContext.Provider>,
    );
    expect(await screen.findByText(/edited/i)).toBeInTheDocument();
  });
});
