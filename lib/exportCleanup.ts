import * as FileSystem from 'expo-file-system/legacy';

// Exports are handed to the share sheet from the cache folder. The receiving app may still be reading
// the file for a moment after the sheet closes, so files are not deleted right away; instead anything
// older than a few minutes is removed the next time the export screen opens or an export starts.
// This also clears plaintext .xlsx files left behind by earlier versions of the app.
const MAX_AGE_SECONDS = 10 * 60;

export async function purgeOldExports(): Promise<void> {
  try {
    const dir = FileSystem.cacheDirectory;
    if (!dir) return;
    const names = await FileSystem.readDirectoryAsync(dir);
    const now = Date.now() / 1000;
    for (const name of names) {
      if (!/^WATER_READING_SYSTEM.*\.(xlsx|enc)$/i.test(name)) continue;
      const info = await FileSystem.getInfoAsync(dir + name);
      if (!info.exists) continue;
      const age = info.modificationTime ? now - info.modificationTime : Infinity;
      if (age > MAX_AGE_SECONDS) await FileSystem.deleteAsync(dir + name, { idempotent: true });
    }
  } catch (e) {
    console.warn('purgeOldExports failed', e);
  }
}
