import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { designerSettingsPlugin } from "./src/dev-server/designerSettingsPlugin";

export default defineConfig({
  plugins: [react(), designerSettingsPlugin()],
  server: {
    port: 5173,
    strictPort: false,
  },
});
