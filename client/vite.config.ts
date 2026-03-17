import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    open: true,
    proxy: {
      "/ws": {
        target: "ws://localhost:7654",
        ws: true,
      },
    },
  },
});
