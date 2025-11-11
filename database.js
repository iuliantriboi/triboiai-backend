// database.js
// Minimal file-based "database" for TriboiAI backend (ESM).
// Saves licenses to licenses.json in the same folder.

import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, 'licenses.json');

async function readDB() {
  try {
    if (!existsSync(DB_FILE)) {
      await fs.writeFile(DB_FILE, JSON.stringify({ licenses: [] }, null, 2), 'utf8');
      return { licenses: [] };
    }
    const txt = await fs.readFile(DB_FILE, 'utf8');
    return JSON.parse(txt || '{"licenses":[]}');
  } catch (err) {
    console.error('readDB error', err);
    return { licenses: [] };
  }
}

async function writeDB(db) {
  await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

// Utility: find license index
function findIndex(db, code) {
  return db.licenses.findIndex(l => String(l.code) === String(code));
}

export default {
  // Initialize: ensure file exists
  async initializeDatabase() {
    const exists = existsSync(DB_FILE);
    if (!exists) {
      await writeDB({ licenses: [] });
      console.log('Database initialized (licenses.json created).');
      return;
    }
    console.log('Database ready (licenses.json present).
