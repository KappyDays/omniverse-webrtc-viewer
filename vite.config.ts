import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { viteExternalsPlugin } from "vite-plugin-externals";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const port = Number(env.VITE_WEB_SERVER_PORT || 5173);
    const host = env.VITE_WEB_SERVER_HOST || '0.0.0.0';

    return {
        server: {
            host,
            port,
            strictPort: true
        },
        plugins: [
            react(),
            viteExternalsPlugin({
                GFN: "GFN",
            }),
        ],
        test: {
            environment: "jsdom",
            globals: true
        }
    };
});
