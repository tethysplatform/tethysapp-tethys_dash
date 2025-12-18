import { createContext, useEffect, useRef, useState } from "react";
import LoadingAnimation from "components/loader/LoadingAnimation";
import PropTypes from "prop-types";

export const WebsocketContext = createContext();

const WebsocketProvider = ({ children }) => {
  const [websocketReady, setWebsocketReady] = useState(false);
  const [messagesByRequestId, setMessagesByRequestId] = useState({});

  const ws = useRef(null);

  const onMessage = (event) => {
    let messageData;
    try {
      messageData = JSON.parse(event.data);
    } catch (e) {
      return;
    }

    if (
      messageData === null ||
      !Object.prototype.hasOwnProperty.call(messageData, "requestId") ||
      !Object.prototype.hasOwnProperty.call(messageData, "message")
    ) {
      return;
    }

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
    return messagesByRequestId[requestId] && messagesByRequestId[requestId];
  };

  if (!websocketReady && !timeoutReached) {
    return <LoadingAnimation text="Connecting to WebSocket..." />;
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

WebsocketProvider.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.element),
    PropTypes.element,
  ]),
};

export default WebsocketProvider;
