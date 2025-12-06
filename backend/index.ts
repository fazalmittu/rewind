import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { createApp } from "./server";
import { initDb } from "./db";

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3000;

async function main() {
  // Ensure screenshots directory exists
  const screenshotsDir = path.join(__dirname, "..", "storage", "screenshots");
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
    console.log("Created screenshots directory");
  }

  // Initialize database
  await initDb();
  console.log("Database initialized");

  // Start server
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

main().catch(console.error);


