import { createContext, useState, useCallback, useMemo } from "react";

export const ChatSidebarContext = createContext();

export function ChatSidebarProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);
  const value = useMemo(() => ({ isOpen, setIsOpen, toggle }), [isOpen, toggle]);
  return (
    <ChatSidebarContext.Provider value={value}>
      {children}
    </ChatSidebarContext.Provider>
  );
}
