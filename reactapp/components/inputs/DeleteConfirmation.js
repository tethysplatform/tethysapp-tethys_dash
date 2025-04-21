import { confirmable, createConfirmation } from "react-confirm";
import { Confirmation } from "./Confirmation";

export function confirm(
  confirmation,
  proceedLabel = "OK",
  cancelLabel = "Cancel",
  options = {}
) {
  return createConfirmation(confirmable(Confirmation))({
    confirmation,
    proceedLabel,
    cancelLabel,
    ...options,
  });
}
