import PropTypes from "prop-types";
import { useContext, useRef, useState } from "react";
import Dropdown from "react-bootstrap/Dropdown";
import Spinner from "react-bootstrap/Spinner";
import { BsCamera } from "react-icons/bs";
import { LayoutContext } from "components/contexts/Contexts";
import { downloadBlob } from "components/visualizations/utilities";
import {
  useLayoutErrorAlertContext,
  useLayoutSuccessAlertContext,
  useLayoutWarningAlertContext,
} from "components/contexts/LayoutAlertContext";
import {
  captureDashboard,
  CaptureBusyError,
  CAPTURE_MODE,
  CAPTURE_PROBLEM,
  CaptureTimeoutError,
  exportFilename,
  isExpectedCaptureFailure,
  NothingToCaptureError,
} from "components/layout/captureDashboard";

/* Copying an image needs ClipboardItem, which the browser only offers to a
   secure page - so a portal served over plain http gets Download alone. */
export function canCopyImages() {
  return (
    typeof window.ClipboardItem === "function" &&
    typeof navigator.clipboard?.write === "function" &&
    window.isSecureContext !== false
  );
}

const PROBLEM_TEXT = {
  [CAPTURE_PROBLEM.image]: "an image",
  [CAPTURE_PROBLEM.mapLayer]: "a map layer",
};

/** "Rain Map (a map layer), Logo (an image)" */
export function describeProblems(problems) {
  return problems
    .map(({ tile, kind }) => `${tile} (${PROBLEM_TEXT[kind] ?? kind})`)
    .join(", ");
}

function captureFailureMessage(error) {
  if (error instanceof CaptureBusyError) {
    return "Another image is still being created. Try again in a moment.";
  }
  if (error instanceof NothingToCaptureError) {
    return "There is nothing on this tab to export.";
  }
  if (error instanceof CaptureTimeoutError) {
    return "Creating the image took too long. Try again, or export the visible area.";
  }
  return "The image could not be created.";
}

const ExportImageButton = ({ disabled = false }) => {
  const { uuid, name } = useContext(LayoutContext);
  const { setSuccessMessage, setShowSuccessMessage } =
    useLayoutSuccessAlertContext();
  const { setErrorMessage, setShowErrorMessage } = useLayoutErrorAlertContext();
  const { setWarningMessage, setShowWarningMessage } =
    useLayoutWarningAlertContext();
  const [capturing, setCapturing] = useState(false);
  // A second click can land before the state update disables the menu.
  const inFlight = useRef(false);
  const copyAvailable = canCopyImages();

  const showError = (message) => {
    setErrorMessage(message);
    setShowErrorMessage(true);
  };

  const report = ({ problems, downscaled }, output) => {
    const done = output === "copy" ? "Copied" : "Exported";
    const notes = [];
    if (problems.length) {
      notes.push(
        `Some content could not be included: ${describeProblems(problems)}.`,
      );
    }
    if (downscaled) {
      notes.push("The image was scaled down to fit the browser's size limit.");
    }

    if (notes.length) {
      setWarningMessage(`${done}. ${notes.join(" ")}`);
      setShowWarningMessage(true);
    } else if (output === "copy") {
      setSuccessMessage("Image copied to the clipboard.");
      setShowSuccessMessage(true);
    }
  };

  const exportImage = (mode, output) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setCapturing(true);

    const capture = captureDashboard({ mode, dashboardUuid: uuid });
    // Settled separately so a failed copy can tell a failed capture apart from
    // a clipboard that refused, and so the capture never rejects unhandled.
    const captureOutcome = capture.then(
      (result) => ({ result }),
      (error) => ({ error }),
    );

    let delivered;
    if (output === "copy") {
      /* Written now, inside the click, with the image still to come: the
         browser grants clipboard access to the user's gesture, and the capture
         can outlast it. Safari accepts only this form. */
      try {
        delivered = navigator.clipboard
          .write([
            new window.ClipboardItem({
              "image/png": capture.then(({ blob }) => blob),
            }),
          ])
          .then(() => capture);
      } catch (error) {
        // A browser that cannot take an image still to come throws here rather
        // than rejecting; routed into the same handling so the menu frees up.
        delivered = Promise.reject(error);
      }
    } else {
      delivered = capture.then((result) => {
        downloadBlob(result.blob, exportFilename(name));
        return result;
      });
    }

    delivered
      .then((result) => report(result, output))
      .catch(async (error) => {
        const { error: captureError } = await captureOutcome;
        if (captureError) {
          if (!isExpectedCaptureFailure(captureError)) {
            console.error("Dashboard image export failed:", captureError);
          }
          showError(captureFailureMessage(captureError));
        } else {
          console.error("Copying the dashboard image failed:", error);
          showError(
            "The image could not be copied to the clipboard. Try downloading it instead.",
          );
        }
      })
      .finally(() => {
        inFlight.current = false;
        setCapturing(false);
      });
  };

  return (
    <Dropdown as="span" className="d-inline-block">
      <Dropdown.Toggle
        variant="info"
        size="sm"
        className="me-2 exportImageButton"
        aria-label="exportImageButton"
        title="Export Image"
        disabled={disabled || capturing}
      >
        {capturing ? (
          <Spinner
            animation="border"
            size="sm"
            role="status"
            aria-label="Creating image"
          />
        ) : (
          <BsCamera size="1.5rem" />
        )}
      </Dropdown.Toggle>
      <Dropdown.Menu align="end">
        <Dropdown.Item
          onClick={() => exportImage(CAPTURE_MODE.whole, "download")}
        >
          Download whole tab
        </Dropdown.Item>
        <Dropdown.Item
          onClick={() => exportImage(CAPTURE_MODE.visible, "download")}
        >
          Download visible area
        </Dropdown.Item>
        {copyAvailable && (
          <>
            <Dropdown.Divider />
            <Dropdown.Item
              onClick={() => exportImage(CAPTURE_MODE.whole, "copy")}
            >
              Copy whole tab
            </Dropdown.Item>
            <Dropdown.Item
              onClick={() => exportImage(CAPTURE_MODE.visible, "copy")}
            >
              Copy visible area
            </Dropdown.Item>
          </>
        )}
      </Dropdown.Menu>
    </Dropdown>
  );
};

ExportImageButton.propTypes = {
  disabled: PropTypes.bool,
};

export default ExportImageButton;
