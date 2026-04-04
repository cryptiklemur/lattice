import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
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
  server: {
    host: "0.0.0.0",
    open: true,
    proxy: {
      "/ws": {
        target: "ws://localhost:" + (process.env.LATTICE_PORT || "17654"),
        ws: true,
        configure: function (proxy) {
          proxy.on("error", function () {});
          proxy.on("proxyReqWs", function (_proxyReq, _req, socket) {
            socket.on("error", function () {});
          });
        },
      },
      "/api": {
        target: "http://localhost:" + (process.env.LATTICE_PORT || "17654"),
        configure: function (proxy) {
          proxy.on("error", function () {});
        },
      },
    },
  },
});
