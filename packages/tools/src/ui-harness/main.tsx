/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import { render } from "preact";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/cormorant-sc/600.css";
import "../../../client/src/ui/tokens.css";
import "../../../client/src/ui/components/components.css";
import "../../../client/src/ui/gallery/gallery.css";
import "../../../client/src/ui/screens/screens.css";
import { Gallery } from "../../../client/src/ui/gallery/Gallery";

const target = document.getElementById("app");
if (!target) throw new Error("Missing gallery harness target");
render(<Gallery />, target);
