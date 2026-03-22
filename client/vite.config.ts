import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: "prompt",
      workbox: {
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/ws/, /^\/api/],
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\.(?:js|css|woff2)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "static-assets",
              expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: /^https?:\/\/.*\.(?:svg|png|jpg|jpeg|gif|webp)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "images",
              expiration: { maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 },
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
        target: "ws://localhost:7654",
        ws: true,
        configure: function (proxy) {
          proxy.on("error", function () {});
          proxy.on("proxyReqWs", function (_proxyReq, _req, socket) {
            socket.on("error", function () {});
          });
        },
      },
      "/api": {
        target: "http://localhost:7654",
        configure: function (proxy) {
          proxy.on("error", function () {});
        },
      },
    },
  },
});
