import { createContext, useEffect, useRef, useState } from "react";

export const WebsocketContext = createContext();

const WebsocketProvider = ({ children }) => {
  const [websocketReady, setWebsocketReady] = useState(false);
  const [receivedMessage, setReceivedMessage] = useState(null);

  const ws = useRef(null);

  useEffect(() => {
    const socket = new WebSocket(process.env.REDIS_WS_URL);

    socket.onopen = () => setWebsocketReady(true);
    socket.onclose = () => setWebsocketReady(false);
    socket.onmessage = (event) => setReceivedMessage(event.data);

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

  if (!websocketReady && !timeoutReached) {
    return null;
  }

  return (
    <WebsocketContext.Provider
      value={{
        websocketReady,
        receivedMessage,
        sendMessage: ws.current?.send.bind(ws.current),
      }}
    >
      {children}
    </WebsocketContext.Provider>
  );
};

export default WebsocketProvider;
