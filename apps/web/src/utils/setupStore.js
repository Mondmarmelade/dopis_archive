import fs from "node:fs";
import path from "node:path";

function getSetupFilePath() {
  const primaryPath = path.resolve(process.cwd(), ".last_setup.json");
  const altPath = path.resolve(process.cwd(), "apps/web/.last_setup.json");
  if (fs.existsSync(primaryPath)) return primaryPath;
  if (fs.existsSync(altPath)) return altPath;
  return fs.existsSync(path.resolve(process.cwd(), "apps/web")) ? altPath : primaryPath;
}

/**
 * Reads saved login and AI provider setup preferences from disk.
 * Allows preserving configuration across database and session resets.
 */
export function getSavedSetup() {
  try {
    const filePath = getSetupFilePath();
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(raw);
    }
  } catch (err) {
    // Graceful fallback if file does not exist or cannot be parsed
  }
  return {};
}

/**
 * Saves login credentials and AI settings to disk.
 */
export function saveSetup(data = {}) {
  try {
    const filePath = getSetupFilePath();
    const existing = getSavedSetup();
    const merged = {
      ...existing,
      ...data,
      updatedAt: Date.now(),
    };
    fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), "utf-8");
    return merged;
  } catch (err) {
    console.warn("Could not write saved setup configuration:", err);
    return null;
  }
}
