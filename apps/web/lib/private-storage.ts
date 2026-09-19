/**
 * ASHVI CLIENT-SIDE PRIVATE CONVERSATION STORAGE
 *
 * Persists PRIVATE conversations strictly inside the user's browser via IndexedDB.
 * Ensures zero cloud PostgreSQL persistence and strict multi-user isolation.
 */

export interface PrivateStoredMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface PrivateStoredConversation {
  id: string;
  userId: string;
  title: string;
  isPrivate: true;
  messages: PrivateStoredMessage[];
  createdAt: string;
  updatedAt: string;
}

const DB_NAME = "ashvi_private_db";
const DB_VERSION = 1;
const STORE_NAME = "conversations";

function getIndexedDB(): IDBFactory | null {
  if (typeof window === "undefined") return null;
  return window.indexedDB || (window as unknown as { mozIndexedDB?: IDBFactory; webkitIndexedDB?: IDBFactory }).mozIndexedDB || null;
}

let dbPromise: Promise<IDBDatabase> | null = null;

export function openPrivateDB(): Promise<IDBDatabase> {
  const idb = getIndexedDB();
  if (!idb) {
    return Promise.reject(new Error("IndexedDB is not available in this environment."));
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = idb.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("userId", "userId", { unique: false });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
        store.createIndex("userId_updatedAt", ["userId", "updatedAt"], { unique: false });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      dbPromise = null;
      reject((event.target as IDBOpenDBRequest).error);
    };
  });

  return dbPromise;
}

/**
 * Saves or updates a private conversation in IndexedDB.
 */
export async function savePrivateConversation(conversation: PrivateStoredConversation): Promise<void> {
  const db = await openPrivateDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.put({
      ...conversation,
      isPrivate: true,
      updatedAt: conversation.updatedAt || new Date().toISOString(),
    });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Retrieves a single private conversation, enforcing userId isolation.
 */
export async function getPrivateConversation(id: string, userId: string): Promise<PrivateStoredConversation | null> {
  const db = await openPrivateDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
      const result = request.result as PrivateStoredConversation | undefined;
      if (!result) {
        resolve(null);
        return;
      }
      // Enforce user isolation: if owned by a different user, do not expose
      if (result.userId !== userId) {
        resolve(null);
        return;
      }
      resolve(result);
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Lists all private conversations for a specific authenticated user.
 */
export async function listPrivateConversations(userId: string): Promise<PrivateStoredConversation[]> {
  try {
    const db = await openPrivateDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const index = store.index("userId");
      const request = index.getAll(userId);

      request.onsuccess = () => {
        const results = (request.result || []) as PrivateStoredConversation[];
        // Sort descending by updatedAt
        results.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        resolve(results);
      };

      request.onerror = () => reject(request.error);
    });
  } catch {
    return [];
  }
}

/**
 * Permanently deletes a private conversation from IndexedDB (One-Click).
 */
export async function deletePrivateConversation(id: string, userId: string): Promise<boolean> {
  const db = await openPrivateDB();
  // First verify user ownership
  const existing = await getPrivateConversation(id, userId);
  if (!existing) return false;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Renames a private conversation in IndexedDB.
 */
export async function renamePrivateConversation(id: string, newTitle: string, userId: string): Promise<boolean> {
  const existing = await getPrivateConversation(id, userId);
  if (!existing) return false;

  existing.title = newTitle;
  existing.updatedAt = new Date().toISOString();
  await savePrivateConversation(existing);
  return true;
}

/**
 * Appends a message to an existing private conversation.
 */
export async function appendPrivateMessage(
  id: string,
  userId: string,
  message: PrivateStoredMessage
): Promise<void> {
  const existing = await getPrivateConversation(id, userId);
  if (!existing) {
    throw new Error(`Private conversation "${id}" not found for user "${userId}".`);
  }

  existing.messages.push(message);
  existing.updatedAt = new Date().toISOString();
  await savePrivateConversation(existing);
}
