import { BrowserRouter } from "react-router-dom";
import { createRoot } from "react-dom/client";
import { getTethysAppRoot } from "services/utilities";

import App from "App";

const APP_ROOT_URL = getTethysAppRoot();

// Dashboard widgets fetch their data after mount, so the page is short when it
// first paints and only reaches full height once they resolve. The browser's
// default scroll restoration re-applies the pre-reload offset at that point,
// which reads as the page spontaneously scrolling away from the top a moment
// after load. Own the scroll position instead: a refresh starts at the top.
if ("scrollRestoration" in window.history) {
  window.history.scrollRestoration = "manual";
}

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
