import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: {
    host: "0.0.0.0",
    open: true,
    proxy: {
      "/ws": {
        target: "ws://localhost:7654",
        ws: true,
      },
      "/api": {
        target: "http://localhost:7654",
      },
    },
  },
});
