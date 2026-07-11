import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase safely
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Request Google Drive file scope for specific app files
provider.addScope('https://www.googleapis.com/auth/drive.file');

let isSigningIn = false;
let cachedAccessToken: string | null = localStorage.getItem('gdrive_access_token');
let currentUser: User | null = null;

// Auth state listeners
let authChangeListeners: Array<(user: User | null, token: string | null) => void> = [];

export const initGoogleDriveAuth = (
  onStatusChange?: (user: User | null, token: string | null) => void
) => {
  if (onStatusChange) {
    authChangeListeners.push(onStatusChange);
    // Call immediately with current cached values
    if (currentUser || cachedAccessToken) {
      onStatusChange(currentUser, cachedAccessToken);
    }
  }

  return onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (!user) {
      cachedAccessToken = null;
      localStorage.removeItem('gdrive_access_token');
    }
    authChangeListeners.forEach(cb => cb(user, cachedAccessToken));
  });
};

export const googleDriveSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to retrieve Google Drive access token.');
    }

    cachedAccessToken = credential.accessToken;
    localStorage.setItem('gdrive_access_token', cachedAccessToken);
    currentUser = result.user;
    
    authChangeListeners.forEach(cb => cb(currentUser, cachedAccessToken));
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error('Google Drive authentication failed:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const googleDriveSignOut = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  currentUser = null;
  localStorage.removeItem('gdrive_access_token');
  authChangeListeners.forEach(cb => cb(null, null));
};

export const getGoogleDriveAccessToken = (): string | null => {
  return cachedAccessToken;
};

// Google Drive Folder Helpers
export const getOrCreateFolder = async (folderName: string, accessToken: string): Promise<string | null> => {
  try {
    const query = encodeURIComponent(`name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id)`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        return searchData.files[0].id;
      }
    }
    
    // Folder doesn't exist, create it
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    });
    
    if (createRes.ok) {
      const createData = await createRes.json();
      return createData.id;
    }
    return null;
  } catch (err) {
    console.error("Error with Google Drive folder lookup/creation:", err);
    return null;
  }
};

// Backup functions
export const uploadBackupToDrive = async (data: any, accessToken: string): Promise<{ id: string; name: string } | null> => {
  try {
    const folderId = await getOrCreateFolder("DPS Portal Cloud Sync", accessToken);
    
    const timestampStr = new Date().toISOString();
    const fileName = `dps_portal_backup_${new Date().toISOString().split('T')[0]}.json`;
    
    const fileMetadata = {
      name: fileName,
      mimeType: 'application/json',
      parents: folderId ? [folderId] : undefined,
    };
    
    const boundary = '----DriveBackupBoundary';
    const delimiter = `--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;
    
    const backupContent = JSON.stringify({
      ...data,
      backupSource: "Google Drive Cloud Backup",
      timestamp: timestampStr,
    });
    
    const parts = [
      `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(fileMetadata)}\r\n`,
      `${delimiter}Content-Type: application/json\r\n\r\n${backupContent}`,
      closeDelimiter
    ];
    
    const multipartBody = new Blob(parts, { type: `multipart/related; boundary=${boundary}` });
    
    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error("Google Drive backup failed:", errorText);
      return null;
    }
    
    const result = await res.json();
    
    // Persist last backup state in localStorage
    localStorage.setItem('last_gdrive_backup_time', timestampStr);
    
    return result;
  } catch (err) {
    console.error("Backup to Google Drive error:", err);
    return null;
  }
};

export const listBackupsFromDrive = async (accessToken: string): Promise<any[]> => {
  try {
    const folderId = await getOrCreateFolder("DPS Portal Cloud Sync", accessToken);
    if (!folderId) return [];
    
    const query = encodeURIComponent(`'${folderId}' in parents and mimeType='application/json' and name contains 'dps_portal_backup_' and trashed=false`);
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&orderBy=createdTime desc&fields=files(id,name,createdTime,size)&pageSize=30`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    if (res.ok) {
      const result = await res.json();
      return result.files || [];
    }
    return [];
  } catch (err) {
    console.error("Listing Drive backups error:", err);
    return [];
  }
};

export const downloadBackupFromDrive = async (fileId: string, accessToken: string): Promise<any> => {
  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    if (res.ok) {
      return await res.json();
    }
    return null;
  } catch (err) {
    console.error("Downloading backup error:", err);
    return null;
  }
};

export const deleteBackupFromDrive = async (fileId: string, accessToken: string): Promise<boolean> => {
  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.ok;
  } catch (err) {
    console.error("Deleting backup error:", err);
    return false;
  }
};

// Check and trigger auto backup if due (daily/weekly/etc.)
export const autoBackupIfDue = async (data: any, accessToken: string, intervalDays: number = 1): Promise<boolean> => {
  if (!accessToken) return false;
  
  const lastBackupStr = localStorage.getItem('last_gdrive_backup_time');
  const now = new Date();
  
  let shouldBackup = false;
  if (!lastBackupStr) {
    shouldBackup = true;
  } else {
    const lastBackup = new Date(lastBackupStr);
    const diffMs = now.getTime() - lastBackup.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays >= intervalDays) {
      shouldBackup = true;
    }
  }
  
  if (shouldBackup) {
    console.log(`Triggering auto Google Drive backup (interval: ${intervalDays} day(s))`);
    const res = await uploadBackupToDrive(data, accessToken);
    return res !== null;
  }
  return false;
};

// File Attachment Upload to Drive
export const uploadAttachmentToDrive = async (file: File, accessToken: string): Promise<{ id: string; name: string; url: string } | null> => {
  try {
    const folderId = await getOrCreateFolder("DPS Portal Cloud Sync", accessToken);
    
    const fileMetadata = {
      name: file.name,
      mimeType: file.type,
      parents: folderId ? [folderId] : undefined,
    };
    
    const boundary = '----DriveAttachmentBoundary';
    const delimiter = `--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;
    
    // Read file bytes
    const fileBytes = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
    
    const parts = [
      new TextEncoder().encode(`${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(fileMetadata)}\r\n`),
      new Uint8Array(fileBytes),
      new TextEncoder().encode(closeDelimiter)
    ];
    
    const multipartBody = new Blob(parts);
    
    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error("Google Drive upload of attachment failed:", errorText);
      return null;
    }
    
    const result = await res.json();
    
    // Return standard viewer url. For general images/video/docs, we use drive's direct view link:
    // https://docs.google.com/uc?export=view&id=FILE_ID
    const publicUrl = `https://docs.google.com/uc?export=view&id=${result.id}`;
    
    return {
      id: result.id,
      name: result.name,
      url: publicUrl
    };
  } catch (err) {
    console.error("Attachment upload to Drive error:", err);
    return null;
  }
};
