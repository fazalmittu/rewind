# Simulations

Standalone test environments for workflow recording. Each simulation is a self-contained app with its own database.

## Creating a New Simulation

### 1. Directory Structure

```
simulations/your-simulation/
├── package.json
├── tsconfig.json
├── .gitignore
├── src/
│   ├── types.ts      # TypeScript interfaces
│   ├── db.ts         # SQLite database operations
│   ├── seed.ts       # Database seeding script
│   └── server.ts     # Express server
└── public/
    └── index.html    # Frontend
```

### 2. Requirements

| Requirement | Details |
|------------|---------|
| **Port** | Use a unique port (not 3000). EHR uses 3001. |
| **Database** | SQLite via `sqlite3` package. Store as `{name}.db` in simulation root. |
| **Seeding** | Auto-seed on startup with realistic dummy data. |
| **API** | RESTful endpoints under `/api/`. |
| **Frontend** | Functional HTML served from `/public/`. |
| **Independence** | Must run standalone without main app dependencies. |

### 3. Required Files

#### `package.json`
```json
{
  "name": "your-simulation",
  "version": "1.0.0",
  "scripts": {
    "build": "tsc",
    "start": "npm run build && node dist/server.js",
    "dev": "ts-node src/server.ts"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "sqlite3": "^5.1.7",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.0",
    "@types/uuid": "^9.0.7",
    "ts-node": "^10.9.2",
    "typescript": "^5.3.2"
  }
}
```

#### `tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

#### `.gitignore`
```
node_modules/
dist/
*.db
```

### 4. Database Pattern

Follow the pattern in `ehr/src/db.ts`:

```typescript
import sqlite3 from "sqlite3";
import path from "path";

let db: sqlite3.Database;

export const initDb = (dbPath?: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const finalPath = dbPath || path.join(__dirname, "..", "your-app.db");
    db = new sqlite3.Database(finalPath, (err) => {
      if (err) return reject(err);
      
      db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS ...`, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  });
};

// CRUD operations as Promise-returning functions
export const insertItem = (item: Item): Promise<void> => { ... };
export const getItems = (): Promise<Item[]> => { ... };
export const updateItem = (item: Item): Promise<void> => { ... };
export const deleteItem = (id: string): Promise<void> => { ... };
```

### 5. Server Pattern

```typescript
import express from "express";
import cors from "cors";
import path from "path";
import { initDb } from "./db";
import { seedDatabase } from "./seed";

const app = express();
const PORT = 300X; // Pick unique port

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// API routes
app.get("/api/items", async (req, res) => { ... });
app.post("/api/items", async (req, res) => { ... });
app.put("/api/items/:id", async (req, res) => { ... });
app.delete("/api/items/:id", async (req, res) => { ... });

// Admin route to reseed
app.post("/api/admin/reseed", async (req, res) => {
  await seedDatabase();
  res.json({ success: true });
});

async function start() {
  await initDb();
  await seedDatabase();
  app.listen(PORT, () => console.log(`Running at http://localhost:${PORT}`));
}

start();
```

### 6. Seed Pattern

```typescript
import { v4 as uuidv4 } from "uuid";
import { clearAllData, insertItem } from "./db";

const DUMMY_DATA = [ ... ];

export async function seedDatabase(): Promise<void> {
  await clearAllData();
  for (const item of DUMMY_DATA) {
    await insertItem({ ...item, id: uuidv4(), createdAt: Date.now() });
  }
}
```

### 7. Frontend Requirements

- Single `public/index.html` file
- Vanilla JS (no build step)
- Calls API at `http://localhost:PORT/api/`
- Functional over pretty - focus on CRUD operations
- Include a "Reseed DB" button for easy reset

## Running a Simulation

```bash
cd simulations/your-simulation
npm install
npm run dev
```

## Existing Simulations

| Name | Port | Description |
|------|------|-------------|
| `ehr` | 3001 | Electronic Health Records - patients, demographics, insurance |

