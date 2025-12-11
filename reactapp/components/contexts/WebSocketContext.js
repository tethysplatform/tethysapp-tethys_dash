import { createContext, useEffect, useRef, useState } from "react";

export const WebsocketContext = createContext();

const WebsocketProvider = ({ children }) => {
  const [websocketReady, setWebsocketReady] = useState(false);
  const [messagesByRequestId, setMessagesByRequestId] = useState({});

  const ws = useRef(null);

  const onMessage = (event) => {
    const messageData = JSON.parse(event.data);
    const { requestId } = messageData;

    setMessagesByRequestId((prevMessages) => {
      const updatedMessages = { ...prevMessages };
      updatedMessages[requestId] = event.data;
      return updatedMessages;
    });
  };

  useEffect(() => {
    const socket = new WebSocket(process.env.REDIS_WS_URL);

    socket.onopen = () => setWebsocketReady(true);
    socket.onclose = () => setWebsocketReady(false);
    socket.onmessage = onMessage;

    ws.current = socket;

    return () => {
      socket.close();
    };
  }, []);

  const [timeoutReached, setTimeoutReached] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setTimeoutReached(true);
    }, 5000);
    if (websocketReady) {
      clearTimeout(timer);
    }
    return () => clearTimeout(timer);
  }, [websocketReady]);

  const getMessageForRequest = (requestId) => {
    if (messagesByRequestId[requestId]) {
      const receivedMessage = messagesByRequestId[requestId];
      try {
        const msg = JSON.parse(receivedMessage);
        if (msg.requestId === requestId && msg.message) {
          return receivedMessage;
        }
      } catch (e) {
        console.log("Error parsing WebSocket message:", e);
      }
    }
  };

  if (!websocketReady && !timeoutReached) {
    return null;
  }

  return (
    <WebsocketContext.Provider
      value={{
        websocketReady,
        messagesByRequestId,
        getMessageForRequest,
        sendMessage: ws.current?.send.bind(ws.current),
      }}
    >
      {children}
    </WebsocketContext.Provider>
  );
};

export default WebsocketProvider;
