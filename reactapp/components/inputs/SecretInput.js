import { useCallback, useContext, useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import styled from "styled-components";
import { LayoutContext } from "components/contexts/Contexts";
import InfoTip from "components/inputs/InfoTip";
import { secretArgStatus } from "components/visualizations/utilities";

const Row = styled.div`
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: center;
`;

const Status = styled.span`
  margin-right: 0.25rem;
`;

const LabelRow = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.5rem;
`;

// Shown from the info icon beside a secret field's label.
const SECRET_INFO =
  "Secrets are saved with the dashboard and can never be read back to keep them secure.";

/**
 * A plugin's secret arg, in the tile and layer editors.
 *
 * Write-only. The server never serves a secret back, so the field never holds
 * one either: it starts empty, and what the author types is kept here, as they
 * type, then committed on blur, Enter or Apply to the dashboard's pending
 * secrets (see DashboardLoader), which the next save of the dashboard sends
 * once the editor is saved (see useDiscardSecretsEntered). Committing per
 * keystroke would re-render the whole dashboard for each one.
 *
 * The arg itself keeps its key in the tile's args with the value "": a save
 * that sets a secret for an arg its tile does not have is refused. Anything
 * else found there -- plain text saved before the plugin declared the arg
 * secret -- is blanked rather than shown.
 *
 * `place` names the secret: the tile's uuid, the dynamic layer's `layerId`
 * ("" for an arg of the tile itself), the arg, and the plugin source the tile
 * or layer has in the editor. A secret is stored for one plugin, so one stored
 * for another reads as none.
 */
const SecretInput = ({ label, value, onChange, place }) => {
  const {
    pendingSecrets,
    setPendingSecret,
    discardPendingSecrets,
    isSecretStored,
  } = useContext(LayoutContext) ?? {};
  const { tile, layer = "", arg, source } = place ?? {};
  const [typed, setTyped] = useState("");
  const [replacing, setReplacing] = useState(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (value !== "") onChangeRef.current?.("");
  }, [value]);

  const status = secretArgStatus(
    { pendingSecrets, isSecretStored },
    { tile, layer, arg, source },
  );
  const showInput = replacing || status === "unset";

  function commit() {
    if (typed === "") return;
    setPendingSecret?.({ tile, layer, arg, source, value: typed });
    setTyped("");
    setReplacing(false);
  }

  function undo() {
    discardPendingSecrets?.({ tile, layer, arg });
  }

  function clear() {
    setPendingSecret?.({ tile, layer, arg, source, value: null });
  }

  return (
    <div>
      {label && (
        <LabelRow>
          <InfoTip label={label}>{SECRET_INFO}</InfoTip>
          <Form.Label className="no-caret mb-0">
            <b>{label}</b>:
          </Form.Label>
        </LabelRow>
      )}
      {status === "stored" && !replacing && (
        <Row>
          <Status>Secret set</Status>
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => setReplacing(true)}
            aria-label={`Replace ${label}`}
          >
            Replace
          </Button>
          <Button
            variant="outline-danger"
            size="sm"
            onClick={clear}
            aria-label={`Clear ${label}`}
          >
            Clear
          </Button>
        </Row>
      )}
      {status === "pendingSet" && !replacing && (
        <Row>
          <Status>
            New secret entered. It is saved when you save the dashboard.
          </Status>
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => setReplacing(true)}
            aria-label={`Replace ${label}`}
          >
            Replace
          </Button>
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={undo}
            aria-label={`Undo ${label}`}
          >
            Undo
          </Button>
        </Row>
      )}
      {status === "pendingClear" && !replacing && (
        <Row>
          <Status>The secret is cleared when you save the dashboard.</Status>
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={undo}
            aria-label={`Undo ${label}`}
          >
            Undo
          </Button>
        </Row>
      )}
      {showInput && (
        <Row
          // Committed when the focus leaves the field and its buttons, so
          // tabbing to Apply or Cancel is not committing.
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) commit();
          }}
        >
          {/* A password field so the secret is never on screen, with no name
              or id for a password manager to save it under or fill it from. */}
          <Form.Control
            type="password"
            autoComplete="new-password"
            spellCheck={false}
            data-1p-ignore
            data-lpignore="true"
            aria-label={`${label} Input`}
            placeholder={replacing ? "Enter a new secret" : "Enter the secret"}
            value={typed}
            autoFocus={replacing}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
            }}
            style={{ flex: 1, minWidth: "12rem" }}
          />
          <Button
            variant="primary"
            size="sm"
            onClick={commit}
            disabled={typed === ""}
            aria-label={`Apply ${label}`}
          >
            Apply
          </Button>
          {replacing && (
            <Button
              variant="outline-secondary"
              size="sm"
              // Kept from taking focus, so the field's blur does not commit
              // what is being cancelled.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setTyped("");
                setReplacing(false);
              }}
              aria-label={`Cancel ${label}`}
            >
              Cancel
            </Button>
          )}
        </Row>
      )}
    </div>
  );
};

/**
 * For an editor holding secret fields -- the tile and layer editors and the
 * popup layout editor: a function that discards every secret entered or
 * cleared since the editor opened, for its Close and Cancel.
 *
 * A secret entered in an editor is pending at once, so its preview can run
 * with it, but it follows the editor's other fields: closing the editor
 * without saving discards it, and saving the editor keeps it pending until
 * the dashboard is saved. What an editor opened from this one entered and
 * kept -- a layer's secret in its Map tile's editor, a popup tile's in the
 * layer's -- is part of this editor's edit, and goes with it.
 *
 * The pending secrets are snapshotted as a whole, not just this editor's
 * place: nothing outside an open editor changes them, as an editor is modal.
 */
export function useDiscardSecretsEntered() {
  const { pendingSecrets, restorePendingSecrets } =
    useContext(LayoutContext) ?? {};
  const [atOpen] = useState(pendingSecrets);
  return useCallback(
    () => restorePendingSecrets?.(atOpen),
    [restorePendingSecrets, atOpen],
  );
}

SecretInput.propTypes = {
  label: PropTypes.string,
  // The arg's value in the tile's args, always kept "".
  value: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
    PropTypes.bool,
    PropTypes.object,
    PropTypes.array,
  ]),
  onChange: PropTypes.func,
  place: PropTypes.shape({
    tile: PropTypes.string,
    layer: PropTypes.string,
    arg: PropTypes.string,
    source: PropTypes.string,
  }),
};

export default SecretInput;
