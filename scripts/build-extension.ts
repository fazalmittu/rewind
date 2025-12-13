const isWatch = process.argv.includes("--watch");
const API_URL = process.env.API_URL || "http://localhost:3000";

async function build() {
  console.log(`Building extension with API_URL: ${API_URL}`);

  const result = await Bun.build({
    entrypoints: [
      "./extension/src/background.ts",
      "./extension/src/contentScript.ts",
      "./extension/src/popup.ts",
    ],
    outdir: "./extension/dist",
    target: "browser",
    sourcemap: "external",
    define: {
      "process.env.API_URL": JSON.stringify(API_URL),
    },
  });

  if (!result.success) {
    console.error("Build failed:");
    for (const log of result.logs) {
      console.error(log);
    }
    process.exit(1);
  }

  console.log("Extension built successfully!");

  if (isWatch) {
    console.log("Watching for changes...");
    const { watch } = await import("fs");

    watch("./extension/src", { recursive: true }, async (event, filename) => {
      if (filename?.endsWith(".ts")) {
        console.log(`\n${filename} changed, rebuilding...`);
        await build();
      }
    });

    // Keep process alive
    await new Promise(() => {});
  }
}

build();
