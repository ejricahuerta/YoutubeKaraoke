import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/** Builds a no-restricted-imports rule from [pattern group, why] pairs. */
const forbidImports = (...rules) => ({
  "no-restricted-imports": ["error", { patterns: rules.map(([group, message]) => ({ group, message })) }],
});

const SERVER_ONLY = [["@/lib/server/*"], "Server code (cookies, database, YouTube search) cannot run in the browser. Call the API through lib/client/session-api."];

const config = [
  ...nextVitals,
  ...nextTs,
  // .claude holds Claude Code's own files, including whole worktrees with their own builds.
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts", ".claude/**"] },
  {
    rules: {
      // Thumbnails come straight from YouTube and the QR code is a data URL: next/image adds nothing.
      "@next/next/no-img-element": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },

  // Layer boundaries: see docs/ARCHITECTURE.md and docs/adr/0011-layered-lib.md.
  {
    files: ["lib/domain/**"],
    rules: forbidImports(
      [["@/lib/server/*", "@/lib/client/*", "@/components/*", "@/app/*"], "lib/domain is the innermost layer: it imports nothing from the rest of the app."],
      [["react", "react-dom", "next", "next/*", "node:*", "@supabase/*"], "lib/domain is plain TypeScript with no I/O, so it runs anywhere and tests without mocks."],
    ),
  },
  {
    files: ["lib/server/**"],
    rules: forbidImports([["@/lib/client/*", "@/components/*", "react"], "lib/server runs only on the server and knows nothing about React or the browser."]),
  },
  {
    files: ["lib/client/**", "components/**"],
    rules: forbidImports(SERVER_ONLY, [["node:*"], "Browser code cannot use Node built-ins."]),
  },
];

export default config;
