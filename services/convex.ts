import { anyApi } from "convex/server";
import { ConvexClient } from "convex/browser";
import { storage as localIndexedDB } from './storage';
import { v4 as uuidv4 } from 'uuid';

declare global {
  interface ImportMeta {
    readonly env: {
      readonly VITE_CONVEX_URL?: string;
      [key: string]: any;
    };
  }
}

// Try to load CONVEX_URL from environment variables
const CONVEX_URL = "https://dapper-robin-600.convex.cloud";


export const isConvexConfigured = () => {
  return CONVEX_URL !== "https://dummy-convex-url.convex.cloud" && CONVEX_URL.trim() !== "";
};

let client: ConvexClient | null = null;
if (isConvexConfigured()) {
  try {
    client = new ConvexClient(CONVEX_URL);
  } catch (e) {
    console.error("Failed to initialize ConvexClient", e);
  }
}

// Global connection state
let lastSyncStatus = false;
let isSyncingQueue = false;

export const getConvexUrl = () => CONVEX_URL;

export const checkFirebaseConnection = async () => {
  if (typeof window === 'undefined') return true;
  if (!window.navigator.onLine) return false;
  if (!client) return false;
  
  try {
    // We try the query, but we don't let it block the UI with a failure unless it's fatal.
    // Convex handles its own reconnection logic internally.
    await (client as any).query(anyApi.dps.fetchDpsData, { userId: "ping" });
    lastSyncStatus = true;
    return true;
  } catch (e: any) {
    const msg = e.message?.toLowerCase() || "";
    // Only return false if we have a definitive "this doesn't exist" or "not found" error.
    if (msg.includes("function not found") || msg.includes("404") || msg.includes("not found")) {
      lastSyncStatus = false;
      return false;
    }
    
    // For network timeouts or transient errors, we return true if we are online.
    // This prevents the "Offline" warning from appearing when Convex is just reconnecting.
    return window.navigator.onLine;
  }
};

export const checkConvexConnection = async () => {
  return checkFirebaseConnection();
};

// Architecture constants (20 MB limit as requested by user)
const MAX_CONVEX_SIZE = 20 * 1024 * 1024;

export const getFirebaseProjectId = () => "Convex";
export const getFirebaseAuthProvidersUrl = () => "https://dashboard.convex.dev";
export const isFirebaseConfigured = () => isConvexConfigured();

export const logOut = async () => {
  await authService.auth.signOut();
};

let authChangeCallbacks: Array<(event: string, session: any) => void> = [];

const triggerAuthChange = (session: any) => {
  authChangeCallbacks.forEach(cb => {
    try {
      cb('SIGNED_IN', session);
    } catch (e) {
      console.error(e);
    }
  });
};

import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut as firebaseSignOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { firebaseAuth } from './googleDrive';

export const authService = {
  auth: {
    onAuthStateChange: (callback: any) => {
      authChangeCallbacks.push(callback);
      const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
        if (user) {
          const session = {
            user: {
              id: user.uid,
              email: user.email,
              user_metadata: { full_name: user.displayName || user.email?.split('@')[0] || "User" }
            }
          };
          
          const role = "Admin";
          const newUser = { name: session.user.user_metadata.full_name, role, uid: user.uid, email: user.email };
          localStorage.setItem("dps_user", JSON.stringify(newUser));

          try {
            callback('SIGNED_IN', session);
          } catch (e) {}
        } else {
          localStorage.removeItem("dps_user");
          try {
            callback('SIGNED_OUT', null);
          } catch (e) {}
        }
      });
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              unsubscribe();
              authChangeCallbacks = authChangeCallbacks.filter(cb => cb !== callback);
            }
          }
        }
      };
    },
    getSession: async () => {
      const user = firebaseAuth.currentUser;
      if (user) {
        return {
          data: {
            session: {
              user: {
                id: user.uid,
                email: user.email,
                user_metadata: { full_name: user.displayName || user.email?.split('@')[0] || "User" }
              }
            }
          }
        };
      }
      return { data: { session: null } };
    },
    signUp: async ({ email, password, options }: any) => {
      try {
        const cred = await createUserWithEmailAndPassword(firebaseAuth, email, password);
        return { data: { user: { id: cred.user.uid, email: cred.user.email } }, error: null };
      } catch (e: any) {
        return { data: null, error: e };
      }
    },
    signInWithPassword: async ({ email, password }: any) => {
      try {
        const cred = await signInWithEmailAndPassword(firebaseAuth, email, password);
        return { 
          data: { 
            session: { 
              user: { 
                id: cred.user.uid, 
                email: cred.user.email, 
                user_metadata: { full_name: cred.user.displayName || cred.user.email?.split('@')[0] || "User" } 
              } 
            } 
          }, 
          error: null 
        };
      } catch (e: any) {
        return { data: null, error: e };
      }
    },
    signInWithOAuth: async ({ provider, email: customEmail }: { provider: string; email?: string }) => {
      try {
        const authProvider = new GoogleAuthProvider();
        const customParams: any = { prompt: 'select_account' };
        if (customEmail) {
          customParams.login_hint = customEmail;
        }
        authProvider.setCustomParameters(customParams);
        const cred = await signInWithPopup(firebaseAuth, authProvider);
        return { 
          data: { 
            session: { 
              user: { 
                id: cred.user.uid, 
                email: cred.user.email, 
                user_metadata: { full_name: cred.user.displayName || cred.user.email?.split('@')[0] || "User" } 
              } 
            } 
          }, 
          error: null 
        };
      } catch (e: any) {
        return { data: null, error: e };
      }
    },
    signInWithPhoneNumber: async (phone: string, appVerifier: any) => {
      return { data: { confirm: () => {} }, error: new Error("Phone auth not implemented") };
    },
    signOut: async () => {
      localStorage.removeItem("dps_user");
      await firebaseSignOut(firebaseAuth);
    },
    resetPassword: async (email: string) => {
      return { error: null };
    }
  },
  storage: {
    from: () => ({
      upload: () => {},
      remove: () => {},
      getPublicUrl: () => ({ data: { publicUrl: '' } })
    })
  }
};

export const subscribeToData = (userId: string, onUpdate: (data: any) => void, onError?: (error: any) => void) => {
  if (!client) {
    // Falls back to local storage
    setTimeout(async () => {
      try {
        const stored = await localIndexedDB.getItem("dps_data");
        if (stored) {
          onUpdate(JSON.parse(stored));
        } else {
          onUpdate({ students: [], dpssTopics: [], selfLearningTopics: [] });
        }
      } catch (err) {
        onUpdate({ students: [], dpssTopics: [], selfLearningTopics: [] });
      }
    }, 100);
    return () => {};
  }

  // Use the standard onUpdate method for ConvexClient
  console.log(`[Convex] Subscribing to data for user: ${userId}`);
  
  const unsubData = (client as any).onUpdate(anyApi.dps.fetchDpsData, { userId }, (res: any) => {
    console.log("[Convex] Received cloud update:", res ? "Data found" : "No data");
    
    // res will be null if no data exists for this user in Convex yet
    if (res === null) {
      onUpdate(null);
      return;
    }

    if (res) {
      try {
        const rawData = res.dataStr || res.data;
        if (rawData) {
          const cloudData = JSON.parse(rawData);
          // Preserve the cloud timestamp as source of truth for conflict resolution
          cloudData.updatedAt = res.updatedAt || cloudData.updatedAt;
          onUpdate(cloudData);
        } else {
          onUpdate(null);
        }
      } catch (e) {
        console.error("[Convex] Failed to parse cloud data:", e);
        onUpdate(null); // Fallback to allow initial local sync
        if (onError) onError(e);
      }
    }
  });

  return unsubData;
};

export const fetchData = async (userId: string) => {
  if (!client) {
    const stored = await localIndexedDB.getItem("dps_data");
    return stored ? JSON.parse(stored) : null;
  }
  try {
    const res = await (client as any).query(anyApi.dps.fetchDpsData, { userId });
    if (res) {
      const rawData = res.dataStr || res.data;
      return rawData ? JSON.parse(rawData) : null;
    }
    return null;
  } catch (error) {
    console.error("Convex fetch error:", error);
    return null;
  }
};

export const saveData = async (userId: string, dataState: any, instant: boolean = false) => {
  if (!userId || userId === 'unknown') return;

  // Sync to IndexedDB immediately
  await localIndexedDB.setItem("dps_data", JSON.stringify(dataState));

  if (!client) {
    lastSyncStatus = false;
    return;
  }

  try {
    const dataStr = JSON.stringify(dataState);
    const updatedAt = dataState.updatedAt || Date.now();
    const version = dataState.version || 1;

    console.log(`[Convex] Saving data monolith... (${dataStr.length} bytes)`);

    await (client as any).mutation(anyApi.dps.saveDpsData, {
      userId,
      dataStr,
      updatedAt,
      version
    });
    console.log("[Convex] Save successful.");
    lastSyncStatus = true;
  } catch (error) {
    console.error("[Convex] Convex save exception:", error);
    await localIndexedDB.queueSync(userId, dataState);
    lastSyncStatus = false;
  }
};

export const processSyncQueue = async () => {
  if (isSyncingQueue || !client || (typeof window !== 'undefined' && !window.navigator.onLine)) return;

  const queue = await localIndexedDB.getSyncQueue();
  if (queue.length === 0) return;

  isSyncingQueue = true;
  const idsToRemove: number[] = [];

  const syncPromises = queue.map(async (item) => {
    try {
      const dataStr = JSON.stringify(item.data);
      const updatedAt = item.timestamp;
      const version = item.data.version || 1;

      await (client as any).mutation(anyApi.dps.saveDpsData, {
        userId: item.userId,
        dataStr,
        updatedAt,
        version
      });
      idsToRemove.push(item.id);
    } catch (e) {
      console.error("Error processing sync queue item:", e);
    }
  });

  await Promise.all(syncPromises);

  if (idsToRemove.length > 0) {
    await localIndexedDB.clearSyncQueue(idsToRemove);
    lastSyncStatus = true;
  }

  isSyncingQueue = false;
};

if (typeof window !== 'undefined') {
  setInterval(processSyncQueue, 30000);
  window.addEventListener('online', processSyncQueue);
}

export const uploadFile = async (userId: string, file: File): Promise<string | null> => {
  try {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.readAsDataURL(file);
    });
  } catch (err) {
    console.error("File upload failed:", err);
    return null;
  }
};

export const deleteFile = async (path: string) => {
  // No-op for base64 inline images
};

export const saveTopic = async (userId: string, topic: any, category: string = 'dpss') => {
  if (!client) return;
  try {
    const { id, title, content, parentId, order, ...rest } = topic;
    await (client as any).mutation(anyApi.dps.saveTopic, {
      id,
      owner_id: userId,
      category,
      parentId: parentId || undefined,
      title: title || "",
      content: content || "",
      order: typeof order === 'number' ? order : undefined,
      data: rest
    });
  } catch (error) {
    console.error("Error saving topic:", error);
  }
};

export const deleteStudent = async (userId: string, studentId: string, category: string = 'dpss') => {
  if (!client) return;
  try {
    await (client as any).mutation(anyApi.dps.deleteStudent, {
      owner_id: userId,
      id: studentId
    });
  } catch (error) {
    console.error("Error deleting student:", error);
  }
};

export const saveStudent = async (userId: string, student: any, category: string = 'dpss') => {
  if (!client) return;
  try {
    const { id, name, order, deletedAt, ...rest } = student;
    await (client as any).mutation(anyApi.dps.saveStudent, {
      id,
      owner_id: userId,
      name: name || "",
      category,
      order: order || 0,
      deletedAt,
      data: rest
    });
  } catch (error) {
    console.error("Error saving student:", error);
  }
};

export const deleteTopic = async (userId: string, topicId: string, category: string = 'dpss') => {
  if (!client) return;
  try {
    await (client as any).mutation(anyApi.dps.deleteTopic, {
      owner_id: userId,
      id: topicId
    });
  } catch (error) {
    console.error("Error deleting topic:", error);
  }
};

export const saveAttendance = async (userId: string, attendance: any) => {
  return Promise.resolve();
};

export const saveDailyNote = async (userId: string, date: string, content: any) => {
  return Promise.resolve();
};

export const saveJournalEntry = async (userId: string, date: string, entry: any) => {
  return Promise.resolve();
};

export const saveExpense = async (userId: string, expense: any, isDelete: boolean = false) => {
  return Promise.resolve();
};

export const saveTopicsBulk = async (userId: string, topicsToSave: { topic: any, category: string }[], topicIdsToDelete: { id: string, category: string }[]) => {
  if (!client) return;
  try {
    for (const { topic, category } of topicsToSave) {
      await saveTopic(userId, topic, category);
    }
    for (const { id } of topicIdsToDelete) {
      await deleteTopic(userId, id);
    }
  } catch (error) {
    console.error("Error bulk saving topics:", error);
  }
};

export const saveHabitCompletionBulk = async (userId: string, date: string, completions: any) => {
  return Promise.resolve();
};

export const saveHabitList = async (userId: string, habits: any[]) => {
  return Promise.resolve();
};

export const deleteHabit = async (userId: string, habitId: string) => {
  return Promise.resolve();
};

export const saveHabitCompletion = async (userId: string, habitId: string, date: string, completed: boolean) => {
  return Promise.resolve();
};

export const getSharedNote = async (shareId: string) => {
  if (!client) return null;
  try {
    return await (client as any).query(anyApi.dps.fetchSharedNote, { id: shareId });
  } catch (error) {
    console.error("Error fetching shared note:", error);
    return null;
  }
};

export const createSharedNote = async (userId: string, ownerName: string, type: string, title: string, payload: any) => {
  const id = Math.random().toString(36).substring(2, 12);
  if (!client) return id;
  try {
    await (client as any).mutation(anyApi.dps.saveSharedNote, {
      id,
      owner_id: userId || "unknown",
      owner_name: ownerName,
      type,
      title,
      payload,
      created_at: new Date().toISOString()
    });
    return id;
  } catch (error) {
    console.error("Error creating shared note:", error);
    return id;
  }
};

export const getCloudBackups = async (userId: string) => {
  if (!client) return [];
  try {
    const list = await (client as any).query(anyApi.dps.fetchBackups, { owner_id: userId });
    return list || [];
  } catch (err) {
    return [];
  }
};

export const createCloudBackup = async (userId: string, data: any) => {
  if (!client) return;
  try {
    const backupId = uuidv4();
    await (client as any).mutation(anyApi.dps.saveBackup, {
      id: backupId,
      owner_id: userId,
      type: "Manual",
      timestamp: new Date().toISOString(),
      data
    });
  } catch (err) {
    console.error("Backup failed:", err);
    throw err;
  }
};

export const fetchBackupPayload = async (backupDoc: any) => {
  return backupDoc?.data || null;
};

export const getSyncStatus = () => lastSyncStatus;
