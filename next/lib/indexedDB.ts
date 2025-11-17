// IndexedDB utility functions for storing debate recordings

const DB_NAME = 'DebateRecordings';
const STORE_NAME = 'recordings';
const DB_VERSION = 1;

interface RecordingData {
  blob: Blob;
  duration: number;
  timestamp: string;
}

// Open or create the IndexedDB database
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

// Save a recording to IndexedDB
export async function saveRecording(index: number, data: RecordingData): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(data, index);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Get a specific recording from IndexedDB
export async function getRecording(index: number): Promise<RecordingData | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(index);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Get all recordings from IndexedDB
export async function getAllRecordings(): Promise<{[key: number]: RecordingData}> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const getAllRequest = store.getAll();
    const getAllKeysRequest = store.getAllKeys();

    const results: {[key: number]: RecordingData} = {};

    getAllRequest.onsuccess = () => {
      getAllKeysRequest.onsuccess = () => {
        const values = getAllRequest.result;
        const keys = getAllKeysRequest.result;
        keys.forEach((key, i) => {
          results[key as number] = values[i];
        });
        resolve(results);
      };
    };
    getAllRequest.onerror = () => reject(getAllRequest.error);
  });
}

// Clear all recordings from IndexedDB
export async function clearAllRecordings(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
