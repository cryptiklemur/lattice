import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  root: ".",
  publicDir: "public",
  resolve: {
    alias: {
      "@lattice/shared": resolve(__dirname, "src/shared/index.ts"),
    },
  },
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/ws/, /^\/api/],
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\.(?:js|css|woff2)$/,
            handler: "NetworkFirst",
            options: {
              cacheName: "static-assets",
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: /^https?:\/\/.*\.(?:svg|png|jpg|jpeg|gif|webp)$/,
            handler: "NetworkFirst",
            options: {
              cacheName: "images",
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 50, maxAgeSeconds: 7 * 24 * 60 * 60 },
            },
          },
        ],
      },
      manifest: {
        name: "Lattice",
        short_name: "Lattice",
        description: "Multi-machine agentic dashboard for Claude Code",
        display: "standalone",
        start_url: "/",
        theme_color: "#0d0d0d",
        background_color: "#0d0d0d",
        icons: [
          { src: "/icons/icon-192.svg", sizes: "192x192", type: "image/svg+xml", purpose: "maskable" },
          { src: "/icons/icon-512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "maskable" },
        ],
      },
    }),
  ],
  build: {
    outDir: "dist/client",
  },
  server: {
    host: "0.0.0.0",
    hmr: {
      host: "localhost",
    },
    open: true,
  },
});
