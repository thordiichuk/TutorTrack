import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { AuthProvider } from "./state";
import { OverlayProvider } from "./ui/overlay";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <OverlayProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </OverlayProvider>
  </StrictMode>,
);
