import { useEffect, useState } from "react";
import appAPI from "services/api/app";

// Fetch the chat backend's current model name once, for display in the header.
// apiClient's interceptor already unwraps `.data`, so the resolved value is the
// payload ({ model }).
export function useChatModel() {
  const [model, setModel] = useState("");

  useEffect(() => {
    let active = true;
    appAPI
      .getChatConfig()
      .then((res) => {
        if (active) setModel(res?.model || "");
      })
      .catch(() => {
        /* non-critical - just omit the label if it can't be fetched */
      });
    return () => {
      active = false;
    };
  }, []);

  return model;
}
