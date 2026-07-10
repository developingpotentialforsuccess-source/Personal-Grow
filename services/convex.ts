import { ConvexClient } from "convex/browser";
import { storage as localIndexedDB } from './storage';
import { v4 as uuidv4 } from 'uuid';

// Try to load CONVEX_URL from environment variables
const CONVEX_URL = ((import.meta as any).env?.VITE_CONVEX_URL || (process as any).env?.CONVEX_URL) || "https://dummy-convex-url.convex.cloud";

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

export const checkFirebaseConnection = async () => {
  return typeof window !== 'undefined' && window.navigator.onLine;
};

export const checkConvexConnection = async () => {
  return typeof window !== 'undefined' && window.navigator.onLine;
};

// Architecture constants
const MAX_CONVEX_SIZE = 400000;

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

export const authService = {
  auth: {
    onAuthStateChange: (callback: any) => {
      authChangeCallbacks.push(callback);
      // Immediately trigger with current session
      const stored = localStorage.getItem("dps_user");
      if (stored) {
        try {
          const user = JSON.parse(stored);
          const session = {
            user: {
              id: user.uid || "local-user",
              email: user.email,
              user_metadata: { full_name: user.name || "User" }
            }
          };
          setTimeout(() => {
            try {
              callback('SIGNED_IN', session);
            } catch (e) {}
          }, 10);
        } catch {
          setTimeout(() => {
            try {
              callback('SIGNED_OUT', null);
            } catch (e) {}
          }, 10);
        }
      } else {
        setTimeout(() => {
          try {
            callback('SIGNED_OUT', null);
          } catch (e) {}
        }, 10);
      }
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              authChangeCallbacks = authChangeCallbacks.filter(cb => cb !== callback);
            }
          }
        }
      };
    },
    getSession: async () => {
      const stored = localStorage.getItem("dps_user");
      if (stored) {
        try {
          const user = JSON.parse(stored);
          return {
            data: {
              session: {
                user: {
                  id: user.uid || "local-user",
                  email: user.email,
                  user_metadata: { full_name: user.name || "User" }
                }
              }
            }
          };
        } catch {}
      }
      return { data: { session: null } };
    },
    signUp: async ({ email, password, options }: any) => {
      try {
        const name = options?.data?.full_name || email.split('@')[0] || "User";
        const uid = uuidv4();

        if (client) {
          // Register in Convex DB
          await (client as any).mutation("dps:createUser", {
            email,
            password,
            name,
            role: "Admin"
          });
        }

        const newUser = { name, role: "Admin", uid, email };
        localStorage.setItem("dps_user", JSON.stringify(newUser));
        triggerAuthChange({ user: { id: uid, email, user_metadata: { full_name: name } } });
        return { data: { user: { id: uid, email } }, error: null };
      } catch (e: any) {
        return { data: null, error: e };
      }
    },
    signInWithPassword: async ({ email, password }: any) => {
      try {
        let name = email.split('@')[0] || "User";
        let uid = uuidv4();
        let role = "Admin";

        if (client) {
          // Validate with Convex DB
          const convexUser = await (client as any).query("dps:getUser", { email });
          if (!convexUser) {
            return { data: null, error: new Error("User not found.") };
          }
          if (convexUser.password !== password) {
            return { data: null, error: new Error("Invalid password.") };
          }
          name = convexUser.name;
          uid = convexUser._id;
          role = (convexUser.role as any) || "Admin";
        }

        const newUser = { name, role, uid, email };
        localStorage.setItem("dps_user", JSON.stringify(newUser));
        triggerAuthChange({ user: { id: uid, email, user_metadata: { full_name: name } } });
        return { data: { session: { user: { id: uid, email, user_metadata: { full_name: name } } } }, error: null };
      } catch (e: any) {
        return { data: null, error: e };
      }
    },
    signInWithOAuth: async ({ provider }: { provider: string }) => {
      const uid = uuidv4();
      const email = `${provider}_user@example.com`;
      const name = `${provider.toUpperCase()} User`;
      const newUser = { name, role: "Admin", uid, email };
      localStorage.setItem("dps_user", JSON.stringify(newUser));
      triggerAuthChange({ user: { id: uid, email, user_metadata: { full_name: name } } });
      return { data: { session: { user: { id: uid, email, user_metadata: { full_name: name } } } }, error: null };
    },
    signInWithPhoneNumber: async (phone: string, appVerifier: any) => {
      const uid = uuidv4();
      const email = `${phone}@example.com`;
      const name = `Phone User`;
      const newUser = { name, role: "Admin", uid, email };
      localStorage.setItem("dps_user", JSON.stringify(newUser));
      triggerAuthChange({ user: { id: uid, email, user_metadata: { full_name: name } } });
      return { data: { confirm: () => {} }, error: null };
    },
    signOut: async () => {
      localStorage.removeItem("dps_user");
      authChangeCallbacks.forEach(cb => {
        try {
          cb('SIGNED_OUT', null);
        } catch (e) {}
      });
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

export const subscribeToData = (userId: string, onUpdate: (data: any) => void, onError?: () => void) => {
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

  let mainDoc: any = null;
  let students: any[] = [];
  let topics: any[] = [];

  const mergeAndEmit = () => {
    if (!mainDoc) return;
    const combined = { ...mainDoc };

    combined.students = [...students].sort((a, b) => {
      return (a.name || '').localeCompare(b.name || '') || (a.id || '').localeCompare(b.id || '');
    });

    const buildTopicTree = (flatList: any[]) => {
      const map = new Map<string, any>();
      const roots: any[] = [];
      flatList.forEach(t => {
        map.set(t.id, { ...t, children: t.children || [] });
      });
      flatList.forEach(t => {
        const node = map.get(t.id);
        if (t.parentId && map.has(t.parentId)) {
          const parent = map.get(t.parentId);
          if (parent && !parent.children.some((c: any) => c.id === t.id)) {
            parent.children.push(node);
          }
        } else {
          roots.push(node);
        }
      });
      return roots;
    };

    const reconstructedTree = buildTopicTree(topics);
    combined.dpssTopics = reconstructedTree.filter(t => t.category === 'dpss');
    combined.selfLearningTopics = reconstructedTree.filter(t => t.category === 'selfLearning');

    onUpdate(combined);
  };

  const unsubData = client.onUpdate("dps:fetchDpsData" as any, { userId }, (res: any) => {
    if (res) {
      try {
        mainDoc = JSON.parse(res.dataStr);
        mainDoc.updatedAt = res.updatedAt;
        mainDoc.version = res.version;
      } catch (e) {
        mainDoc = { students: [], dpssTopics: [], selfLearningTopics: [] };
      }
    } else {
      mainDoc = { students: [], dpssTopics: [], selfLearningTopics: [] };
    }
    mergeAndEmit();
  });

  const unsubStudents = client.onUpdate("dps:fetchStudents" as any, { owner_id: userId }, (res: any) => {
    if (Array.isArray(res)) {
      students = res.map(item => ({ ...item.data, id: item.id }));
    }
    mergeAndEmit();
  });

  const unsubTopics = client.onUpdate("dps:fetchTopics" as any, { owner_id: userId }, (res: any) => {
    if (Array.isArray(res)) {
      topics = res.map(item => ({ ...item.data, id: item.id, content: item.content, title: item.title, parentId: item.parentId, category: item.category }));
    }
    mergeAndEmit();
  });

  return () => {
    unsubData();
    unsubStudents();
    unsubTopics();
  };
};

export const fetchData = async (userId: string) => {
  if (!client) {
    const stored = await localIndexedDB.getItem("dps_data");
    return stored ? JSON.parse(stored) : null;
  }
  try {
    const res = await (client as any).query("dps:fetchDpsData", { userId });
    if (res) {
      return JSON.parse(res.dataStr);
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
    const { students, dpssTopics, selfLearningTopics, ...metaOnly } = dataState;
    const dataStr = JSON.stringify(metaOnly);
    const updatedAt = dataState.updatedAt || Date.now();
    const version = dataState.version || 1;

    await (client as any).mutation("dps:saveDpsData", {
      userId,
      dataStr,
      updatedAt,
      version
    });
    lastSyncStatus = true;
  } catch (error) {
    console.error("Convex save exception during save:", error);
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
      const { students, dpssTopics, selfLearningTopics, ...metaOnly } = item.data;
      const dataStr = JSON.stringify(metaOnly);
      const updatedAt = item.timestamp;
      const version = item.data.version || 1;

      await (client as any).mutation("dps:saveDpsData", {
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
    await (client as any).mutation("dps:saveTopic", {
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
    await (client as any).mutation("dps:deleteStudent", {
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
    await (client as any).mutation("dps:saveStudent", {
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
    await (client as any).mutation("dps:deleteTopic", {
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
    return await (client as any).query("dps:fetchSharedNote", { id: shareId });
  } catch (error) {
    console.error("Error fetching shared note:", error);
    return null;
  }
};

export const createSharedNote = async (userId: string, ownerName: string, type: string, title: string, payload: any) => {
  const id = Math.random().toString(36).substring(2, 12);
  if (!client) return id;
  try {
    await (client as any).mutation("dps:saveSharedNote", {
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
    const list = await (client as any).query("dps:fetchBackups", { owner_id: userId });
    return list || [];
  } catch (err) {
    return [];
  }
};

export const createCloudBackup = async (userId: string, data: any) => {
  if (!client) return;
  try {
    const backupId = uuidv4();
    await (client as any).mutation("dps:saveBackup", {
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
