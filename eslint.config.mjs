import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Werkzeuge und Artefakte des Design-System-Exports (.dc.html). Beide
    // stehen in .gitignore, ds-bundle enthaelt unter _vendor/ sogar eine
    // komplette React-Kopie: fremder, generierter Code. Er stellte 14 der 18
    // Fehler und ueber 1.180 der 1.188 Warnungen — Rauschen, das echte
    // Befunde im eigenen Code unsichtbar gemacht hat.
    "ds-bundle/**",
    ".ds-sync/**",
  ]),
]);

export default eslintConfig;
