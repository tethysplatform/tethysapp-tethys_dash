import { createContext, useEffect, useRef, useState } from "react";
import LoadingAnimation from "components/loader/LoadingAnimation";
import PropTypes from "prop-types";

export const WebsocketContext = createContext();

const WebsocketProvider = ({ children }) => {
  const [websocketReady, setWebsocketReady] = useState(false);
  const [messagesByRequestId, setMessagesByRequestId] = useState({});
  const [errorMessagesByRequestId, setErrorMessagesByRequestId] = useState({});
  const [timeoutReached, setTimeoutReached] = useState(false);
  const ws = useRef(null);

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

  useEffect(() => {
    const timer = setTimeout(() => {
      setTimeoutReached(true);
    }, 5000);
    if (websocketReady) {
      clearTimeout(timer);
    }
    return () => clearTimeout(timer);
  }, [websocketReady]);

  const onMessage = (event) => {
    let messageData;
    try {
      messageData = JSON.parse(event.data);
    } catch (e) {
      return;
    }

    if (Object.prototype.hasOwnProperty.call(messageData, "requestId")) {
      const { requestId } = messageData;

      if (Object.prototype.hasOwnProperty.call(messageData, "message")) {
        setMessagesByRequestId((prevMessages) => {
          const updatedMessages = { ...prevMessages };
          updatedMessages[requestId] = event.data;
          return updatedMessages;
        });
      } else if (Object.prototype.hasOwnProperty.call(messageData, "error")) {
        setErrorMessagesByRequestId((prevErrors) => {
          const updatedErrors = { ...prevErrors };
          updatedErrors[requestId] = event.data;
          return updatedErrors;
        });
      }
    }
  };

  const getMessageForRequest = (requestId) => {
    return messagesByRequestId[requestId] && messagesByRequestId[requestId];
  };

  const getErrorMessageForRequest = (requestId) => {
    return (
      errorMessagesByRequestId[requestId] && errorMessagesByRequestId[requestId]
    );
  };

  const onSend = (data) => {
    if (ws.current && websocketReady) {
      ws.current.send(data);
    }
  };

  if (!websocketReady && !timeoutReached) {
    return <LoadingAnimation text="Connecting to WebSocket..." />;
  }

  return (
    <WebsocketContext.Provider
      value={{
        websocketReady,
        messagesByRequestId,
        errorMessagesByRequestId,
        getMessageForRequest,
        getErrorMessageForRequest,
        sendMessage: onSend,
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
