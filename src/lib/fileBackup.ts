// File System Access API + IndexedDB handle persistence. Chromium only; every
// entry point degrades gracefully where the API is missing. Not unit-tested
// (browser APIs) — exercised via the manual Chrome matrix.

type PermState = 'granted' | 'denied' | 'prompt';

interface PermissionedHandle extends FileSystemFileHandle {
  queryPermission?(d: { mode: 'read' | 'readwrite' }): Promise<PermState>;
  requestPermission?(d: { mode: 'read' | 'readwrite' }): Promise<PermState>;
}

declare global {
  interface Window {
    showSaveFilePicker?: (opts?: unknown) => Promise<FileSystemFileHandle>;
    showOpenFilePicker?: (opts?: unknown) => Promise<FileSystemFileHandle[]>;
  }
}

export function isFileBackupSupported(): boolean {
  return typeof window !== 'undefined' && 'showSaveFilePicker' in window;
}

const PICKER_TYPES = [
  { description: 'Schedule backup', accept: { 'application/json': ['.json'] } },
];

export async function pickSaveFile(
  suggestedName: string,
): Promise<FileSystemFileHandle | null> {
  if (!window.showSaveFilePicker) return null;
  return window.showSaveFilePicker({ suggestedName, types: PICKER_TYPES });
}

export async function pickOpenFile(): Promise<FileSystemFileHandle | null> {
  if (!window.showOpenFilePicker) return null;
  const [handle] = await window.showOpenFilePicker({
    types: PICKER_TYPES,
    multiple: false,
  });
  return handle ?? null;
}

export async function readHandle(
  handle: FileSystemFileHandle,
): Promise<string> {
  const file = await handle.getFile();
  return file.text();
}

export async function writeHandle(
  handle: FileSystemFileHandle,
  text: string,
): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
}

export async function queryGranted(
  handle: FileSystemFileHandle,
  mode: 'read' | 'readwrite' = 'readwrite',
): Promise<boolean> {
  const ph = handle as PermissionedHandle;
  if (!ph.queryPermission) return true;
  return (await ph.queryPermission({ mode })) === 'granted';
}

export async function ensurePermission(
  handle: FileSystemFileHandle,
  mode: 'read' | 'readwrite' = 'readwrite',
): Promise<boolean> {
  const ph = handle as PermissionedHandle;
  if (!ph.queryPermission) return true;
  if ((await ph.queryPermission({ mode })) === 'granted') return true;
  return (await ph.requestPermission?.({ mode })) === 'granted';
}

export function handleName(handle: FileSystemFileHandle): string {
  return handle.name;
}

// --- IndexedDB handle persistence -----------------------------------------
const DB_NAME = 'shift-scheduler';
const STORE = 'handles';
const KEY = 'backup';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = run(db.transaction(STORE, mode).objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveHandle(handle: FileSystemFileHandle): Promise<void> {
  const db = await openDb();
  await tx(db, 'readwrite', (store) => store.put(handle, KEY));
}

export async function loadHandle(): Promise<FileSystemFileHandle | null> {
  try {
    const db = await openDb();
    return (
      (await tx<FileSystemFileHandle | undefined>(db, 'readonly', (store) =>
        store.get(KEY),
      )) ?? null
    );
  } catch {
    return null;
  }
}

export async function clearHandle(): Promise<void> {
  const db = await openDb();
  await tx(db, 'readwrite', (store) => store.delete(KEY));
}
