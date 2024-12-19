import { BrowserRouter } from "react-router-dom";
import { createRoot } from "react-dom/client";
import App from "App";

const APP_ROOT_URL = process.env.TETHYS_APP_ROOT_URL;
let container = null;

document.addEventListener("DOMContentLoaded", () => {
  if (!container) {
    container = document.getElementById("root");
    const root = createRoot(container);
    root.render(
      <BrowserRouter basename={APP_ROOT_URL}>
        <App />
      </BrowserRouter>
    );

    if (module.hot) {
      module.hot.accept();
    }
  }
});
