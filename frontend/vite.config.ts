import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [tailwindcss(), svelte()],
    server: {
        host: "127.0.0.1",
        port: Number(process.env.WAILS_VITE_PORT) || 9245,
        strictPort: true,
    },
    build: {
        sourcemap: "hidden",
        rolldownOptions: {
            checks: {
                pluginTimings: false,
            },
            output: {
                comments: false,
            },
        },
    },
    resolve: {
        alias: {
            $lib: resolve("./src/lib"),
        },
    },
});
