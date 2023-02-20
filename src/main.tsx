import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { TRPCProvider } from "./utils/trpc";

import "@unocss/reset/tailwind.css";
import "uno.css";
import "./style.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <TRPCProvider>
      <App />
    </TRPCProvider>
  </React.StrictMode>
);
