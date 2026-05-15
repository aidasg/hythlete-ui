import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const hythleteApiHostname =
    env.HYTHLETE_API_HOSTNAME ||
    (mode !== "production" ? "http://localhost:18086" : undefined);

  return {
    define: {
      ...(hythleteApiHostname && {
        "import.meta.env.HYTHLETE_API_HOSTNAME": JSON.stringify(
          hythleteApiHostname
        ),
      }),
    },
    build: {
      sourcemap: mode === "development",
      minify: mode === "production" ? "esbuild" : false,
      target: "es2015",
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ["react", "react-dom"],
          },
          ...(mode === "production" && {
            entryFileNames: "assets/[hash].js",
            chunkFileNames: "assets/[hash].js",
            assetFileNames: "assets/[hash].[ext]",
          }),
        },
      },
      cssCodeSplit: true,
      chunkSizeWarningLimit: 1000,
      ...(mode === "production" && {
        esbuild: {
          drop: ["console", "debugger"],
          legalComments: "none",
          minifyIdentifiers: true,
          minifySyntax: true,
          minifyWhitespace: true,
        },
      }),
    },
    server: {
      host: "::",
      port: 80,
      proxy: {
        "/api": {
          target: hythleteApiHostname || "http://localhost:18086",
          rewrite: (requestPath) => requestPath.replace(/^\/api/, ""),
          cookieDomainRewrite: "localhost",
          changeOrigin: true,
          secure: false,
        },
      },
      allowedHosts: [".hythlete.com"],
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    ...(mode === "production" && {
      logLevel: "warn",
    }),
  };
});
