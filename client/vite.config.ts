import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import svgr from "vite-plugin-svgr";

// https://vite.dev/config/
export default () => {
  return defineConfig({
    css: {
      preprocessorOptions: {
        scss: {
          quietDeps: true,
          silenceDeprecations: ["if-function"],
        },
      },
    },
    server: {
      port: 3000,
      allowedHosts: true,
      // proxy: {
      //   "/api": {
      //     target: env.VITE_CLIENT_API_DOMAIN,
      //   },
      // },
      watch: {
        ignored: ["build/**"],
      },
    },
    plugins: [react(), tailwindcss(), svgr()],
    build: {
      outDir: "./build",
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
