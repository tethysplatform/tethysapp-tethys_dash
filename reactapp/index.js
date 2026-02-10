import { BrowserRouter } from "react-router-dom";
import { createRoot } from "react-dom/client";
import { getTethysAppRoot } from "services/utilities";

import App from "App";

const APP_ROOT_URL = getTethysAppRoot();

let container = null;

document.addEventListener("DOMContentLoaded", () => {
  if (!container) {
    container = document.getElementById("root");
    const root = createRoot(container);
    root.render(
      <BrowserRouter basename={APP_ROOT_URL}>
        <App />
      </BrowserRouter>,
    );

    // istanbul ignore next
    if (module.hot) {
      // istanbul ignore next
      module.hot.accept();
    }
  }
});
