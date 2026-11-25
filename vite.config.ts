import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [tailwindcss(), svelte()],
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
