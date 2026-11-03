import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { AuthProvider } from "./state";
import { OverlayProvider } from "./ui/overlay";
import "@fontsource/plus-jakarta-sans/latin-400.css";
import "@fontsource/plus-jakarta-sans/latin-ext-400.css";
import "@fontsource/plus-jakarta-sans/latin-500.css";
import "@fontsource/plus-jakarta-sans/latin-ext-500.css";
import "@fontsource/plus-jakarta-sans/latin-600.css";
import "@fontsource/plus-jakarta-sans/latin-ext-600.css";
import "@fontsource/plus-jakarta-sans/latin-700.css";
import "@fontsource/plus-jakarta-sans/latin-ext-700.css";
import "@fontsource/nunito/latin-600.css";
import "@fontsource/nunito/latin-ext-600.css";
import "@fontsource/nunito/latin-700.css";
import "@fontsource/nunito/latin-ext-700.css";
import "@fontsource/nunito/latin-800.css";
import "@fontsource/nunito/latin-ext-800.css";
import "@fontsource/nunito/latin-900.css";
import "@fontsource/nunito/latin-ext-900.css";
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
