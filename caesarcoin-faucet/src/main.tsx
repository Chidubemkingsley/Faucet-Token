// src/main.tsx
// AppKit MUST be imported before React renders anything
import "./config/appkit";

import React    from "react";
import ReactDOM from "react-dom/client";
import App      from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);