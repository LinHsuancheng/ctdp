import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MiniApp } from "./MiniApp";
import "./styles/base.css";
import "./styles/kit.css";
import "./styles/mini.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MiniApp />
  </StrictMode>,
);
