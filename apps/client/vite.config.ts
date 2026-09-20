import vinext from "vinext";
import { defineConfig } from "vite";
import { nitro } from "nitro/vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(async () => {
  return {
    plugins: [
      vinext(),
      nitro(),
      tailwindcss(),
    ],
  };
});
