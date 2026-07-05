import {
  createContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import LoadingAnimation from "components/loader/LoadingAnimation";
import PropTypes from "prop-types";

export const WebsocketContext = createContext();

const WebsocketProvider = ({ children }) => {
  const [websocketReady, setWebsocketReady] = useState(false);
  const [messagesByRequestId, setMessagesByRequestId] = useState({});
  const [errorMessagesByRequestId, setErrorMessagesByRequestId] = useState({});
  const [timeoutReached, setTimeoutReached] = useState(false);
  const ws = useRef(null);

  const hasWebSocketUrl = Boolean(process.env.REDIS_WS_URL);

  useEffect(() => {
    if (!hasWebSocketUrl) return;

    const socket = new WebSocket(process.env.REDIS_WS_URL);

    socket.onopen = () => setWebsocketReady(true);
    socket.onclose = () => setWebsocketReady(false);
    socket.onmessage = onMessage;

    ws.current = socket;

    return () => {
      socket.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hasWebSocketUrl) return;

    const timer = setTimeout(() => {
      setTimeoutReached(true);
    }, 5000);
    if (websocketReady) {
      clearTimeout(timer);
    }
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const getMessageForRequest = useCallback(
    (requestId) =>
      messagesByRequestId[requestId] && messagesByRequestId[requestId],
    [messagesByRequestId],
  );

  const getErrorMessageForRequest = useCallback(
    (requestId) =>
      errorMessagesByRequestId[requestId] &&
      errorMessagesByRequestId[requestId],
    [errorMessagesByRequestId],
  );

  const onSend = useCallback(
    (data) => {
      if (!hasWebSocketUrl) return;
      ws.current.send(data);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [websocketReady],
  );

  const contextValue = useMemo(
    () => ({
      websocketReady,
      messagesByRequestId,
      errorMessagesByRequestId,
      getMessageForRequest,
      getErrorMessageForRequest,
      sendMessage: onSend,
    }),
    [
      websocketReady,
      messagesByRequestId,
      errorMessagesByRequestId,
      getMessageForRequest,
      getErrorMessageForRequest,
      onSend,
    ],
  );

  if (hasWebSocketUrl && !websocketReady && !timeoutReached) {
    return <LoadingAnimation text="Connecting to WebSocket..." />;
  }

  return (
    <WebsocketContext.Provider value={contextValue}>
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
