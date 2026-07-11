import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    resolve: {
        alias: {
            "@sv": path.resolve(__dirname, "src"),
        },
    },
    test: {
        environment: "node",
        include: ["tests/**/*.test.ts", "src/tests/**/*.test.ts"],
        setupFiles: ["tests/setup/env.ts"],
        clearMocks: true,
        restoreMocks: true,
    },
});
