import { defineConfig } from "vitest/config";
import path from "node:path";
import dotenv from "dotenv";

const alias = { "@": path.resolve(__dirname, "src") };

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integracao",
          environment: "node",
          include: ["tests/integracao/**/*.test.ts"],
          fileParallelism: false,
          env: dotenv.config({ path: ".env.test.local", quiet: true }).parsed ?? {},
        },
      },
    ],
  },
});
