import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default ({ mode: _mode }: { mode: string }) => {
  // const env = loadEnv(mode, "..", "CLIENT_");

  return defineConfig({
    server: {
      port: 3000,
      allowedHosts: true,
      watch: {
        ignored: ["build/**"],
      },
    },
    plugins: [react()],
    build: {
      outDir: "build",
    },
    resolve: {
      dedupe: ["react", "react-dom"],
      alias: {
        react: "react",
        "react-dom": "react-dom",
        "@": path.resolve(__dirname, "src"),
      },
    },
    optimizeDeps: {
      include: ["react", "react-dom"],
    },
  });
};
