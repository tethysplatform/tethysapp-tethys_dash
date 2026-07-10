import { useContext, useEffect, useState } from "react";
import styled from "styled-components";
import appAPI from "services/api/app";
import { AppContext } from "components/contexts/Contexts";
import PropTypes from "prop-types";

const PROVIDERS = [
  { value: "local", label: "Local (Ollama)" },
  { value: "anthropic", label: "Anthropic" },
  { value: "openai", label: "OpenAI" },
];

const MODEL_PLACEHOLDERS = {
  local: "qwen3:1.7b",
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-5.2",
};

const Pane = styled.div`
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 0.9rem;
`;

const Row = styled.label`
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-weight: 500;
  color: #343a40;

  select,
  input {
    padding: 6px 8px;
    border: 1px solid #ced4da;
    border-radius: 6px;
    font-size: 0.9rem;
    font-weight: 400;
  }
`;

const Hint = styled.div`
  font-size: 0.78rem;
  font-weight: 400;
  color: #868e96;
`;

const Buttons = styled.div`
  display: flex;
  gap: 8px;
  justify-content: flex-end;
`;

const Button = styled.button`
  padding: 6px 14px;
  border-radius: 6px;
  border: 1px solid ${(p) => (p.$primary ? "#4a90e2" : "#ced4da")};
  background: ${(p) => (p.$primary ? "#4a90e2" : "#fff")};
  color: ${(p) => (p.$primary ? "#fff" : "#495057")};
  cursor: pointer;
  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
`;

const Status = styled.div`
  font-size: 0.82rem;
  color: ${(p) => (p.$error ? "#c92a2a" : "#2b8a3e")};
`;

export default function ChatSettings({ onClose }) {
  const { csrf } = useContext(AppContext);
  const [provider, setProvider] = useState("local");
  const [modelName, setModelName] = useState("");
  const [hasKey, setHasKey] = useState(false);
  // Key lives only in this piece of state while the user types; it is
  // POSTed once and cleared. Never persisted client-side.
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    appAPI
      .getChatSettings()
      .then((data) => {
        setProvider(data.provider ?? "local");
        setModelName(data.model_name ?? "");
        setHasKey(Boolean(data.has_key));
      })
      .catch(() =>
        setStatus({ error: true, text: "Could not load settings." }),
      );
  }, []);

  const save = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const data = await appAPI.saveChatSettings({
        provider,
        modelName,
        apiKey,
        csrf,
      });
      setHasKey(Boolean(data.has_key));
      setApiKey("");
      setStatus({
        error: false,
        text: "Saved. Takes effect on your next message.",
      });
    } catch (e) {
      setStatus({ error: true, text: e.message || "Save failed." });
    } finally {
      setSaving(false);
    }
  };

  const needsKey = provider !== "local";

  return (
    <Pane>
      <Row>
        Provider
        <select value={provider} onChange={(e) => setProvider(e.target.value)}>
          {PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </Row>
      <Row>
        Model
        <input
          type="text"
          value={modelName}
          placeholder={MODEL_PLACEHOLDERS[provider]}
          onChange={(e) => setModelName(e.target.value)}
        />
        <Hint>Leave blank for the default shown above.</Hint>
      </Row>
      {needsKey && (
        <Row>
          API key
          <input
            type="password"
            value={apiKey}
            autoComplete="off"
            placeholder={
              hasKey ? "••••••••  (a key is saved)" : "paste your key"
            }
            onChange={(e) => setApiKey(e.target.value)}
          />
          <Hint>
            Stored encrypted on the server; never shown again. Leave blank to
            keep the saved key.
          </Hint>
        </Row>
      )}
      {status && <Status $error={status.error}>{status.text}</Status>}
      <Buttons>
        <Button onClick={onClose}>Back to chat</Button>
        <Button $primary onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </Buttons>
    </Pane>
  );
}

ChatSettings.propTypes = {
  onClose: PropTypes.func.isRequired,
};
