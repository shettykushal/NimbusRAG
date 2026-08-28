import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "nimbus-rag-api-bridge",
      async configureServer(server) {
        const { setupApi } = await import("./api/ask");
        setupApi(server);
      },
      async configurePreviewServer(server) {
        const { setupApi } = await import("./api/ask");
        setupApi(server);
      },
    },
  ],
  server: {
    port: 5173,
    host: true,
  },
  test: {
    environment: "node",
    include: ["tests/**/*.ts"],
    exclude: ["tests/fakeEmbedder.ts", "**/node_modules/**", "**/dist/**"],
    globals: true,
    server: {
      deps: {
        // Allow ?raw imports of .md files in the test environment.
        inline: ["src/rag/loader.ts"],
      },
    },
  },
});
