import path from "path";
import { createApp } from "./server";
import { initDb } from "./db";

const PORT = process.env.PORT || 3000;

async function main() {
  // Ensure screenshots directory exists using Bun native mkdir
  const screenshotsDir = path.join(import.meta.dir, "..", "storage", "screenshots");
  await Bun.write(path.join(screenshotsDir, ".keep"), "");
  console.log("Screenshots directory ready");

  // Initialize database
  initDb();
  console.log("Database initialized");

  // Start server
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

main().catch(console.error);
