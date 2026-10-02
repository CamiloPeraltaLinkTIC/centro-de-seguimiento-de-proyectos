// Copia el worker de PDF.js y sus recursos (cmaps, fuentes estándar, wasm) a public/pdfjs.
// Se sirven desde el mismo dominio para cumplir la CSP. Se ejecuta antes de `dev` y `build`.
import { cpSync, mkdirSync } from "node:fs";

const src = new URL("../node_modules/pdfjs-dist/", import.meta.url);
const dst = new URL("../public/pdfjs/", import.meta.url);
mkdirSync(dst, { recursive: true });
cpSync(new URL("build/pdf.worker.min.mjs", src), new URL("pdf.worker.min.mjs", dst));
for (const dir of ["cmaps", "standard_fonts", "wasm"]) cpSync(new URL(`${dir}/`, src), new URL(`${dir}/`, dst), { recursive: true });
console.log("PDF.js copiado a public/pdfjs");
