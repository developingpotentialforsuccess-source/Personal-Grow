import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { AppData, BackupEntry, ModuleLocks } from '../types';
import { 
  ShieldCheck, RefreshCw, Clock, Lock, Unlock, Download, Upload, Database, ExternalLink, Camera, Sparkles,
  CalendarDays, CalendarRange, History, Cloud, Trash2, AlertTriangle, Check, ChevronDown, ChevronUp
} from 'lucide-react';
import { getCloudBackups, createCloudBackup, getFirebaseProjectId } from '../services/convex';
import { format, differenceInDays } from 'date-fns';
import { 
  initGoogleDriveAuth, 
  googleDriveSignIn, 
  googleDriveSignOut, 
  uploadBackupToDrive, 
  listBackupsFromDrive, 
  downloadBackupFromDrive, 
  deleteBackupFromDrive 
} from '../services/googleDrive';

interface Props {
  data: AppData;
  onUpdate: (newData: AppData) => void;
  currentUser: any;
}

export const MaintenancePanel: React.FC<Props> = ({ data, onUpdate, currentUser }) => {
  const [backups, setBackups] = useState<Partial<BackupEntry>[]>([]);
  const [loading, setLoading] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [activeTab, setActiveTab] = useState<'Backups' | 'Safety' | 'Locks' | 'GoogleDrive'>('Backups');

  // Google Drive Integration state
  const [gdriveUser, setGdriveUser] = useState<any>(null);
  const [gdriveToken, setGdriveToken] = useState<string | null>(null);
  const [gdriveBackups, setGdriveBackups] = useState<any[]>([]);
  const [loadingGDrive, setLoadingGDrive] = useState(false);
  const [uploadingGDrive, setUploadingGDrive] = useState(false);
  const [backupInterval, setBackupInterval] = useState<number>(() => {
    return Number(localStorage.getItem('gdrive_backup_interval_days') || '1');
  });
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(() => {
    return localStorage.getItem('last_gdrive_backup_time');
  });

  const [syncStatus, setSyncStatus] = useState<{ configured: boolean; connected: boolean; error: string | null }>({
    configured: false,
    connected: false,
    error: null
  });
  const [checkingSync, setCheckingSync] = useState(false);
  const [showSetupHelp, setShowSetupHelp] = useState(false);

  const checkSyncStatus = async () => {
    setCheckingSync(true);
    try {
      const { isConvexConfigured: isFirebaseConfigured, checkConvexConnection: checkFirebaseConnection } = await import('../services/convex');
      const configured = isFirebaseConfigured();
      const connected = await checkFirebaseConnection();
      setSyncStatus({ 
        configured, 
        connected, 
        error: !configured ? "Environment variables missing." : (connected ? null : "Could not reach Convex Cloud.")
      });
    } catch (err: any) {
      setSyncStatus({ configured: false, connected: false, error: err.message || String(err) });
    } finally {
      setCheckingSync(false);
    }
  };

  useEffect(() => {
    checkSyncStatus();
  }, []);

  // Set up Google Drive Authentication listeners
  useEffect(() => {
    const unsubscribe = initGoogleDriveAuth((user, token) => {
      setGdriveUser(user);
      setGdriveToken(token);
    });
    return () => unsubscribe();
  }, []);

  const loadGDriveBackups = async () => {
    if (!gdriveToken) return;
    setLoadingGDrive(true);
    try {
      const files = await listBackupsFromDrive(gdriveToken);
      setGdriveBackups(files);
    } catch (err) {
      console.error("Failed to load Google Drive backups:", err);
    } finally {
      setLoadingGDrive(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'GoogleDrive') {
      setLastBackupTime(localStorage.getItem('last_gdrive_backup_time'));
      if (gdriveToken) {
        loadGDriveBackups();
      }
    }
  }, [activeTab, gdriveToken]);

  const fetchBackups = async () => {
    if (!currentUser?.uid) return;
    setLoading(true);
    const list = await getCloudBackups(currentUser.uid);
    setBackups(list);
    setLoading(false);
  };

  useEffect(() => {
    if (activeTab === 'Backups') fetchBackups();
  }, [activeTab]);

  // Logic to identify Key Restore Points (Daily, Weekly, Monthly)
  const keyRestorePoints = useMemo(() => {
    if (backups.length === 0) return { daily: null, weekly: null, monthly: null };

    const sorted = [...backups].sort((a, b) => 
      new Date(b.timestamp!).getTime() - new Date(a.timestamp!).getTime()
    );

    const now = new Date();
    
    // Find latest backup that is at least 1 day old for "Daily"
    const daily = sorted.find(b => differenceInDays(now, new Date(b.timestamp!)) >= 1);
    
    // Find latest backup that is at least 7 days old for "Weekly"
    const weekly = sorted.find(b => differenceInDays(now, new Date(b.timestamp!)) >= 7);
    
    // Find latest backup that is at least 30 days old for "Monthly"
    const monthly = sorted.find(b => differenceInDays(now, new Date(b.timestamp!)) >= 30);

    return { daily, weekly, monthly };
  }, [backups]);

  const handleCreateSnapshot = async () => {
    if (creatingBackup || !currentUser?.uid) return;
    setCreatingBackup(true);
    try {
        await createCloudBackup(currentUser.uid, data);
        await fetchBackups();
        alert("Manual Snapshot created successfully!");
    } catch (err) {
        alert("Failed to create snapshot.");
    } finally {
        setCreatingBackup(false);
    }
  };

  const toggleModuleLock = (module: keyof ModuleLocks) => {
    const currentLocks = data.moduleLocks || { Hall: false, Attendance: false, Finance: false };
    const newState = !currentLocks[module];
    onUpdate({
        ...data,
        moduleLocks: { ...currentLocks, [module]: newState }
    });
  };

  const handleRestore = async (backup: any) => {
    if (confirm(`CRITICAL WARNING: You are about to restore data from ${format(new Date(backup.timestamp), 'PPPP p')}. This will delete all changes made after that time. Are you sure?`)) {
       try {
         setLoading(true);
         const { fetchBackupPayload } = await import('../services/convex');
         const fullData = await fetchBackupPayload(backup);
         if (fullData) {
           onUpdate({ ...fullData, systemLocked: false });
           alert("System Restored Successfully!");
         } else {
           alert("Failed to restore: Backup data is corrupted or missing.");
         }
       } catch (err) {
         console.error("Restore failed", err);
         alert("Restore failed. Please check your connection.");
       } finally {
         setLoading(false);
       }
    }
  };

  return (
    <div className="flex-1 flex flex-col p-3 md:p-8 overflow-hidden bg-slate-50 animate-fade-in">
      <div className="max-w-6xl mx-auto w-full space-y-4 md:space-y-8 h-full flex flex-col">
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3 md:gap-4">
                <div className="w-10 h-10 md:w-14 md:h-14 bg-indigo-600 rounded-xl md:rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-500/20 shrink-0">
                    <ShieldCheck className="w-5 h-5 md:w-8 md:h-8" />
                </div>
                <div>
                    <h2 className="text-xl md:text-3xl font-black text-[#1B254B] uppercase tracking-tighter leading-none">Maintenance & Recovery</h2>
                    <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase mt-1 tracking-widest">Admin Control • Data Integrity • Cloud Snapshots</p>
                </div>
            </div>

            <div className="flex flex-wrap md:flex-nowrap bg-white p-1 md:p-1.5 rounded-xl md:rounded-2xl shadow-sm border border-slate-200 w-full lg:w-auto gap-1">
                {(['Backups', 'GoogleDrive', 'Safety', 'Locks'] as const).map(tab => (
                    <button 
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 lg:flex-none text-center px-3 py-2 md:px-6 md:py-2.5 rounded-lg md:rounded-xl text-[10px] md:text-xs font-black uppercase transition-all ${
                            activeTab === tab ? 'bg-[#1B254B] text-white shadow-lg' : 'text-slate-500 hover:text-[#1B254B]'
                        }`}
                    >
                        {tab === 'Locks' ? 'Module Locks' : tab === 'GoogleDrive' ? 'Google Drive' : tab}
                    </button>
                ))}
            </div>
        </div>

        <div className="flex-1 bg-white rounded-2xl md:rounded-[40px] shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            
            {activeTab === 'Locks' && (
                <div className="p-4 md:p-12 space-y-6 md:space-y-10 overflow-y-auto">
                    <div className="text-center max-w-xl mx-auto">
                        <h3 className="text-xl md:text-2xl font-black text-[#1B254B] uppercase mb-2">Module Security Matrix</h3>
                        <p className="text-xs md:text-sm text-slate-500 font-medium">When locked, users can view data but CANNOT add, edit, or delete any records. Locks are applied instantly 100%.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                        {(['Hall', 'Attendance', 'Finance'] as const).map(module => {
                            const isLocked = data.moduleLocks?.[module] || false;
                            return (
                                <div key={module} className={`p-6 md:p-8 rounded-2xl md:rounded-[32px] border-2 transition-all flex flex-col items-center text-center gap-3 md:gap-4 ${isLocked ? 'border-red-100 bg-red-50/30' : 'border-slate-100 bg-white hover:border-indigo-100'}`}>
                                    <div className={`w-12 h-12 md:w-16 md:h-16 rounded-2xl md:rounded-3xl flex items-center justify-center mb-2 ${isLocked ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'bg-slate-100 text-slate-400'}`}>
                                        {isLocked ? <Lock size={32} /> : <Unlock size={32} />}
                                    </div>
                                    <div>
                                        <h4 className="font-black text-[#1B254B] uppercase text-lg">{module} Study</h4>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Status: {isLocked ? 'Locked (100%)' : 'Open'}</p>
                                    </div>
                                    <button 
                                        onClick={() => toggleModuleLock(module)}
                                        className={`mt-4 w-full py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${isLocked ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-red-500 text-white shadow-lg shadow-red-500/20'}`}
                                    >
                                        {isLocked ? `Unlock ${module}` : `Lock ${module} 100%`}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {activeTab === 'Backups' && (
                <div className="flex flex-col h-full overflow-hidden animate-fade-in">
                    <div className="p-4 md:p-8 border-b border-slate-100 flex flex-col sm:flex-row gap-4 sm:justify-between sm:items-center bg-slate-50/50">
                        <div className="flex items-center gap-3 md:gap-4">
                             <History className="text-emerald-500 shrink-0" />
                             <div>
                                <h3 className="text-lg md:text-xl font-black text-[#1B254B] uppercase">Restore Hub</h3>
                                <p className="text-[11px] md:text-sm font-bold text-slate-400 uppercase tracking-tighter">Recover accidentally deleted data from previous states</p>
                             </div>
                        </div>
                        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                            <button 
                                onClick={handleCreateSnapshot}
                                disabled={creatingBackup}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 md:px-6 md:py-3 bg-emerald-600 text-white rounded-2xl text-[10px] md:text-xs font-black uppercase shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition-all disabled:opacity-50"
                            >
                                {creatingBackup ? <RefreshCw size={14} className="animate-spin" /> : <Camera size={14} />} 
                                {creatingBackup ? 'Saving State...' : 'Manual Snapshot'}
                            </button>
                            <button onClick={fetchBackups} className="p-2.5 md:p-3 bg-white border border-slate-200 rounded-2xl text-slate-600 hover:text-primary-500 transition-all shadow-sm shrink-0">
                                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 md:space-y-8 custom-scrollbar">
                        
                        {/* Summary restore points */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[
                                { label: 'Daily Restore', point: keyRestorePoints.daily, icon: CalendarDays, color: 'blue' },
                                { label: 'Weekly Restore', point: keyRestorePoints.weekly, icon: CalendarRange, color: 'indigo' },
                                { label: 'Monthly Restore', point: keyRestorePoints.monthly, icon: CalendarDays, color: 'purple' }
                            ].map((item, idx) => (
                                <div key={idx} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex flex-col items-center text-center gap-4 hover:border-primary-500 transition-all group">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center bg-emerald-50 text-emerald-600 group-hover:scale-110 transition-transform`}>
                                        <item.icon size={28} />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-[#1B254B] uppercase">{item.label}</h4>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">
                                            {item.point ? format(new Date(item.point.timestamp!), 'PP') : 'No Point Found'}
                                        </p>
                                    </div>
                                    <button 
                                        disabled={!item.point}
                                        onClick={() => handleRestore(item.point as BackupEntry)}
                                        className={`mt-2 w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                            item.point ? 'bg-slate-800 text-white hover:bg-black' : 'bg-slate-50 text-slate-300 cursor-not-allowed'
                                        }`}
                                    >
                                        Restore this point
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[4px] pl-2 mb-4">Detailed Snapshot History</h3>
                            {backups.length === 0 && !loading ? (
                                <div className="text-center py-20 bg-slate-50/50 rounded-[40px] border-2 border-dashed border-slate-100">
                                    <Sparkles className="mx-auto text-slate-200 mb-4" size={48} />
                                    <p className="font-black text-slate-300 uppercase tracking-widest text-sm">No snapshots found yet</p>
                                </div>
                            ) : backups.map((b) => (
                                <div key={b.id} className="bg-white border border-slate-100 p-6 rounded-[30px] flex items-center justify-between hover:border-indigo-500 transition-all group shadow-sm">
                                    <div className="flex items-center gap-6">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${b.type === 'Auto' ? 'bg-emerald-500 text-white' : 'bg-green-500 text-white'}`}>
                                            <Clock size={24} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="text-lg font-black text-[#1B254B] uppercase leading-none">{b.type} Snapshot</h4>
                                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${b.type === 'Auto' ? 'bg-emerald-100 text-emerald-600' : 'bg-green-100 text-green-600'}`}>
                                                    {b.type === 'Auto' ? 'AUTO' : 'MANUAL'}
                                                </span>
                                            </div>
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">{format(new Date(b.timestamp!), 'PPPP p')}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button 
                                            onClick={() => handleRestore(b as BackupEntry)} 
                                            className="px-6 py-3 bg-red-500 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg hover:bg-red-600 transition-all opacity-0 group-hover:opacity-100"
                                        >
                                            Restore Now
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Convex Integration Control Panel */}
                        <div className="bg-slate-50 border border-slate-200 p-4 md:p-8 rounded-2xl md:rounded-[40px] mt-6 md:mt-12 space-y-4 md:space-y-6">
                            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                                <div className="flex flex-col sm:flex-row items-start gap-4 md:gap-5">
                                    <div className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl md:rounded-3xl flex items-center justify-center border shadow-sm transition-all shrink-0 ${
                                        syncStatus.connected 
                                            ? 'bg-emerald-50 border-emerald-200 text-emerald-600 shadow-emerald-100' 
                                            : !syncStatus.configured 
                                                ? 'bg-amber-50 border-amber-200 text-amber-600 shadow-amber-100' 
                                                : 'bg-rose-50 border-rose-200 text-rose-600 shadow-rose-100'
                                    }`}>
                                        <Database size={24} />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2.5 flex-wrap">
                                            <h4 className="font-black text-slate-800 uppercase text-sm md:text-base tracking-tight leading-none">Cloud Backup Database</h4>
                                            {syncStatus.connected ? (
                                                <span className="flex items-center gap-1.5 text-[8px] md:text-[9px] font-black text-emerald-600 bg-emerald-100/80 px-2.5 py-1 rounded-full uppercase tracking-wider animate-pulse whitespace-nowrap">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                    Active Cloud Sync
                                                </span>
                                            ) : !syncStatus.configured ? (
                                                <span className="flex items-center gap-1.5 text-[8px] md:text-[9px] font-black text-amber-600 bg-amber-100/80 px-2.5 py-1 rounded-full uppercase tracking-wider whitespace-nowrap">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                                    Missing Configuration
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1.5 text-[8px] md:text-[9px] font-black text-rose-600 bg-rose-100/80 px-2.5 py-1 rounded-full uppercase tracking-wider whitespace-nowrap">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                                    Connection Issue
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-500 font-medium">
                                            {syncStatus.connected 
                                                ? "Your master digital portal sheets, topics, and student ledger are actively saved in the cloud. Real-time multi-browser sync is enabled."
                                                : !syncStatus.configured 
                                                    ? "Connected to reactive local database storage. Please configure cloud synchronization to access records globally."
                                                    : `An issue occurred while reaching the cloud database: ${syncStatus.error}`
                                            }
                                        </p>
                                    </div>
                                </div>
                                <button 
                                    onClick={checkSyncStatus}
                                    disabled={checkingSync}
                                    className="w-full lg:w-auto justify-center px-6 py-3.5 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase shadow-xs hover:border-indigo-500 hover:text-indigo-600 hover:bg-slate-50 transition-all flex items-center gap-2 shrink-0 disabled:opacity-50"
                                >
                                    <RefreshCw size={14} className={checkingSync ? "animate-spin" : ""} />
                                    {checkingSync ? "Pinging..." : "Test Link"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'GoogleDrive' && (
                <div className="flex flex-col h-full overflow-hidden animate-fade-in">
                    <div className="p-4 md:p-8 border-b border-slate-100 flex flex-col md:flex-row md:justify-between md:items-center bg-slate-50/50 gap-4">
                        <div className="flex items-center gap-3 md:gap-4">
                            <Cloud size={32} className="text-[#4285F4] animate-pulse shrink-0" />
                            <div>
                                <h3 className="text-lg md:text-xl font-black text-[#1B254B] uppercase">Google Drive Sync Hub</h3>
                                <p className="text-[11px] md:text-sm font-bold text-slate-400 uppercase tracking-tighter">Automate backups & activate flawless 20 MB device-to-device cloud hosting</p>
                            </div>
                        </div>

                        {gdriveToken ? (
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 md:gap-4 bg-emerald-50 border border-emerald-100 px-4 py-3 md:px-6 rounded-2xl w-full md:w-auto">
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full shrink-0"></span>
                                    <p className="text-[10px] md:text-xs font-black text-emerald-800 uppercase break-all">Linked: {gdriveUser?.email || "Google Drive"}</p>
                                </div>
                                <button
                                    onClick={async () => {
                                        if (confirm("Disconnect Google Drive sync? Automatic backups and direct uploads will be paused.")) {
                                            await googleDriveSignOut();
                                            setGdriveBackups([]);
                                        }
                                    }}
                                    className="text-[10px] font-black uppercase text-rose-600 hover:text-rose-800 underline transition-all text-left"
                                >
                                    Disconnect
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={async () => {
                                    try {
                                        await googleDriveSignIn();
                                        alert("Google Drive linked successfully!");
                                    } catch (err: any) {
                                        console.error("Google Drive Link Error:", err);
                                        let errorMsg = "Authorization failed. Ensure you accept all permissions.";
                                        
                                        if (err.code === 'auth/unauthorized-domain' || (err.message && err.message.includes('unauthorized domain'))) {
                                            errorMsg = `DOMAIN NOT AUTHORIZED: You MUST add "${window.location.hostname}" to your Firebase Console (Authentication > Settings > Authorized Domains).`;
                                        } else if (err.code === 'auth/popup-blocked') {
                                            errorMsg = "Popup Blocked: Please allow popups for this site in your browser settings.";
                                        } else if (err.code === 'auth/popup-closed-by-user') {
                                            errorMsg = "Sign-in cancelled. Please complete the Google login flow.";
                                        }
                                        
                                        alert(errorMsg);
                                    }
                                }}
                                className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-[#4285F4] text-white rounded-2xl text-[10px] md:text-xs font-black uppercase shadow-lg shadow-[#4285F4]/20 hover:bg-[#357ae8] transition-all"
                            >
                                <Cloud size={16} /> Link Google Drive Account
                            </button>
                        )}
                    </div>

                    {/* OAuth & Sync Configuration Help */}
                    {!gdriveToken && (
                        <div className="mx-4 md:mx-8 mb-4">
                            <button 
                                onClick={() => setShowSetupHelp(!showSetupHelp)}
                                className="w-full flex items-center justify-between p-3 bg-amber-50 border border-amber-100 rounded-2xl text-[10px] font-black uppercase text-amber-800 hover:bg-amber-100/50 transition-all"
                            >
                                <div className="flex items-center gap-2">
                                    <AlertTriangle size={14} className="text-amber-600" />
                                    Troubleshoot Google Drive (Required for Sync)
                                </div>
                                {showSetupHelp ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>

                            {showSetupHelp && (
                                <motion.div 
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="mt-2 p-4 bg-white border-2 border-amber-200 rounded-2xl space-y-4 shadow-sm"
                                >
                                    <div className="space-y-3">
                                        <div className="flex flex-col gap-2">
                                            <div className="text-[10px] text-amber-800 font-black uppercase">Step 1: Fix "Access Blocked" Error</div>
                                            <p className="text-[10px] text-gray-600 leading-relaxed">
                                                Your app is in "Testing" mode. You MUST add your email to the <strong>Test Users</strong> list.
                                            </p>
                                            <a 
                                                href="https://console.cloud.google.com/auth/audience"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center justify-center gap-2 p-2 bg-amber-600 text-white rounded-lg text-[10px] font-black uppercase hover:bg-amber-700 transition-all"
                                            >
                                                Add email to Test Users
                                                <ExternalLink size={12} />
                                            </a>
                                        </div>

                                        <div className="flex flex-col gap-2 pt-2 border-t border-amber-100">
                                            <div className="text-[10px] text-amber-800 font-black uppercase">Step 2: Authorize Domain</div>
                                            <div className="flex items-center justify-between p-2 bg-amber-50 rounded-lg border border-amber-100">
                                                <code className="text-xs font-mono font-black text-amber-900">{window.location.hostname}</code>
                                                <button 
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(window.location.hostname);
                                                        alert("Domain copied!");
                                                    }}
                                                    className="px-2 py-1 bg-amber-200 text-amber-800 rounded text-[8px] font-black uppercase hover:bg-amber-300"
                                                >
                                                    Copy
                                                </button>
                                            </div>
                                            <a 
                                                href={`https://console.firebase.google.com/project/${process.env.VITE_FIREBASE_PROJECT_ID || 'gen-lang-client-0862414427'}/authentication/settings`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center justify-center gap-2 p-2 bg-amber-600 text-white rounded-lg text-[10px] font-black uppercase hover:bg-amber-700 transition-all"
                                            >
                                                Open Authorized Domains
                                                <ExternalLink size={12} />
                                            </a>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 md:space-y-8 custom-scrollbar">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                            {/* Backup Interval Card */}
                            <div className="bg-slate-50/50 border border-slate-100 p-4 md:p-8 rounded-2xl md:rounded-[32px] space-y-4 flex flex-col justify-between">
                                <div className="space-y-4">
                                    <h4 className="font-black text-[#1B254B] uppercase text-sm tracking-widest flex items-center gap-2">
                                        ⏱️ Auto-Backup Frequency
                                    </h4>
                                    <p className="text-xs text-slate-500 font-medium">
                                        The system automatically secures your portal ledger, folders, and study guides daily or on your preferred interval behind the scenes, ensuring zero data loss across devices.
                                    </p>
                                    {lastBackupTime && (
                                        <div className="text-[11px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-100/60 px-3 py-2 rounded-xl flex items-center gap-1.5 animate-fade-in w-fit">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                                            <span>Last Auto-Backup: {format(new Date(lastBackupTime), 'PPPP p')}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-2 mt-4">
                                    {[
                                        { label: "Daily (Best)", val: 1 },
                                        { label: "Every 2 Days", val: 2 },
                                        { label: "Weekly", val: 7 },
                                        { label: "Turned Off", val: 0 }
                                    ].map((opt) => (
                                        <button
                                            key={opt.val}
                                            onClick={() => {
                                                localStorage.setItem('gdrive_backup_interval_days', String(opt.val));
                                                setBackupInterval(opt.val);
                                            }}
                                            className={`py-2.5 px-3 md:py-3.5 md:px-4 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-wider border-2 transition-all ${
                                                backupInterval === opt.val
                                                    ? 'bg-[#1B254B] border-[#1B254B] text-white shadow-md'
                                                    : 'bg-white border-slate-100 text-slate-600 hover:border-slate-300'
                                            }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Manual Backup Card */}
                            <div className="bg-slate-50/50 border border-slate-100 p-4 md:p-8 rounded-2xl md:rounded-[32px] space-y-4 flex flex-col justify-between">
                                <div>
                                    <h4 className="font-black text-[#1B254B] uppercase text-sm tracking-widest flex items-center gap-2">
                                        ⚡ Secure Snapshot Now
                                    </h4>
                                    <p className="text-xs text-slate-500 font-medium">
                                        Trigger an instant, manual snapshot upload directly to your Google Drive folder. This bypasses the automatic timer to quickly save your state.
                                    </p>
                                </div>
                                <div className="pt-4 flex flex-col sm:flex-row gap-3">
                                    <button
                                        disabled={!gdriveToken || uploadingGDrive}
                                        onClick={async () => {
                                            setUploadingGDrive(true);
                                            try {
                                                const res = await uploadBackupToDrive(data, gdriveToken!);
                                                if (res) {
                                                    alert(`Cloud backup "${res.name}" completed successfully on Google Drive!`);
                                                    setLastBackupTime(new Date().toISOString());
                                                    loadGDriveBackups();
                                                } else {
                                                    alert("Backup failed. Check internet access.");
                                                }
                                            } catch (err) {
                                                console.error(err);
                                                alert("An error occurred during Google Drive transfer.");
                                            } finally {
                                                setUploadingGDrive(false);
                                            }
                                        }}
                                        className="flex-1 py-3 md:py-4 bg-emerald-600 text-white rounded-2xl text-[10px] md:text-xs font-black uppercase shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition-all disabled:opacity-40"
                                    >
                                        {uploadingGDrive ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <RefreshCw size={14} className="animate-spin" /> Saving to Drive...
                                            </span>
                                        ) : "Trigger Instant Backup"}
                                    </button>
                                    
                                    {gdriveToken && (
                                        <button
                                            onClick={loadGDriveBackups}
                                            disabled={loadingGDrive}
                                            className="py-3 md:py-4 px-4 bg-white border border-slate-200 rounded-2xl text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm flex items-center justify-center"
                                        >
                                            <RefreshCw size={16} className={loadingGDrive ? "animate-spin" : ""} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Device-to-Device Optimization Status */}
                        <div className="p-6 bg-emerald-50/40 border border-emerald-200/50 rounded-3xl flex items-start gap-4">
                            <Cloud className="text-emerald-500 shrink-0 mt-0.5" size={20} />
                            <div>
                                <h5 className="text-xs font-black text-emerald-950 uppercase tracking-wider">Device-to-Device Optimization: ACTIVE</h5>
                                <p className="text-[11px] text-emerald-900 leading-relaxed font-semibold mt-1">
                                    Cloud storage handles large attachments (pictures, PDFs, or videos) directly, ensuring instant synchronization across all your devices with maximum speed and stability.
                                </p>
                            </div>
                        </div>

                        {/* Backup List Section */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[4px] pl-2 mb-4">Drive Recovery Points</h3>
                            
                            {!gdriveToken ? (
                                <div className="text-center py-20 bg-slate-50/30 rounded-[40px] border-2 border-dashed border-slate-100 flex flex-col items-center">
                                    <Cloud className="text-slate-300 mb-4" size={48} />
                                    <p className="font-black text-slate-400 uppercase tracking-widest text-xs mb-1">Google Drive is not linked</p>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">Please link your account above to access cloud snapshots</p>
                                </div>
                            ) : loadingGDrive ? (
                                <div className="text-center py-20 bg-slate-50/30 rounded-[40px] border-2 border-dashed border-slate-100">
                                    <RefreshCw className="mx-auto text-indigo-500 animate-spin mb-4" size={32} />
                                    <p className="font-black text-slate-400 uppercase tracking-widest text-xs">Accessing Google Drive storage...</p>
                                </div>
                            ) : gdriveBackups.length === 0 ? (
                                <div className="text-center py-20 bg-slate-50/30 rounded-[40px] border-2 border-dashed border-slate-100 flex flex-col items-center">
                                    <Sparkles className="text-slate-300 mb-4 animate-pulse" size={48} />
                                    <p className="font-black text-slate-400 uppercase tracking-widest text-xs mb-1">No recovery points found in Drive</p>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">Click "Trigger Instant Backup" to create your first cloud snapshot</p>
                                </div>
                            ) : (
                                <div className="grid gap-4">
                                    {gdriveBackups.map((file) => {
                                        const sizeMB = file.size ? (Number(file.size) / (1024 * 1024)).toFixed(2) : "Unknown";
                                        return (
                                            <div key={file.id} className="bg-white border border-slate-100 p-4 md:p-6 rounded-2xl md:rounded-[30px] flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between hover:border-indigo-500 transition-all group shadow-sm">
                                                <div className="flex items-center gap-4 md:gap-6">
                                                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-sm shrink-0">
                                                        <Cloud size={20} />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm md:text-base font-black text-slate-800 uppercase leading-none mb-1">{file.name}</h4>
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                                                {format(new Date(file.createdTime), 'PPPP p')}
                                                            </p>
                                                            <span className="text-[8px] md:text-[9px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded">
                                                                Size: {sizeMB} MB
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                                                    <button
                                                        onClick={async () => {
                                                            if (confirm(`CRITICAL WARNING: You are about to restore all student folders, ledgers, and topics from Drive snapshot "${file.name}". All current changes made after this backup was created will be lost. Continue?`)) {
                                                                setLoadingGDrive(true);
                                                                try {
                                                                    const backupData = await downloadBackupFromDrive(file.id, gdriveToken!);
                                                                    if (backupData && (backupData.students || backupData.topics)) {
                                                                        onUpdate({ ...backupData, systemLocked: false });
                                                                        alert("System State Restored Successfully from Google Drive!");
                                                                    } else {
                                                                        alert("Failed to restore: Backup file is empty or formatted incorrectly.");
                                                                    }
                                                                } catch (err) {
                                                                    console.error(err);
                                                                    alert("An error occurred during retrieval.");
                                                                } finally {
                                                                    setLoadingGDrive(false);
                                                                }
                                                            }
                                                        }}
                                                        className="w-full sm:w-auto text-center px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-md hover:bg-indigo-700 transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                                                    >
                                                        Restore State
                                                    </button>
                                                    <button
                                                        onClick={async () => {
                                                            if (confirm(`Are you sure you want to permanently delete backup "${file.name}" from your Google Drive?`)) {
                                                                setLoadingGDrive(true);
                                                                try {
                                                                    const ok = await deleteBackupFromDrive(file.id, gdriveToken!);
                                                                    if (ok) {
                                                                        alert("Backup deleted successfully.");
                                                                        loadGDriveBackups();
                                                                    } else {
                                                                        alert("Failed to delete. Try again.");
                                                                    }
                                                                } catch (err) {
                                                                    console.error(err);
                                                                } finally {
                                                                    setLoadingGDrive(false);
                                                                }
                                                            }
                                                        }}
                                                        className="p-3.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition-all"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'Safety' && (
                <div className="p-4 md:p-12 space-y-6 md:space-y-12 max-w-2xl mx-auto w-full overflow-y-auto animate-fade-in">
                    <div className="text-center">
                        <h3 className="text-xl md:text-2xl font-black text-[#1B254B] uppercase mb-1">Manual Data Portability</h3>
                        <p className="text-xs md:text-sm font-bold text-slate-400 uppercase tracking-widest">Physical backups for your own Google Drive or PC</p>
                    </div>

                    <div className="grid gap-4 md:gap-6">
                        <div className="bg-slate-50 rounded-2xl md:rounded-[32px] p-6 md:p-8 border border-slate-200 flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4 sm:gap-8 shadow-sm">
                            <div className="w-12 h-12 md:w-16 md:h-16 bg-white rounded-2xl md:rounded-3xl flex items-center justify-center text-[#1B254B] shadow-lg border border-slate-100 shrink-0">
                                <Download size={24} className="md:w-8 md:h-8" />
                            </div>
                            <div className="flex-1">
                                <h4 className="font-black text-[#1B254B] uppercase text-sm md:text-base">Download Database File</h4>
                                <p className="text-[11px] md:text-xs text-slate-500 mt-1 leading-normal">Export your entire school data as a JSON file. We recommend doing this once a week and uploading it to your Google Drive.</p>
                                <button 
                                    onClick={() => { const blob = new Blob([JSON.stringify(data)], {type: 'application/json'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `dpss_backup_${format(new Date(), 'yyyy-MM-dd')}.json`; a.click(); }}
                                    className="mt-4 px-6 py-2.5 bg-[#1B254B] text-white rounded-xl text-[10px] font-black uppercase hover:scale-105 active:scale-95 transition-transform shadow-lg shadow-[#1B254B]/30 w-full sm:w-auto"
                                >
                                    Export JSON
                                </button>
                            </div>
                        </div>

                        <div className="bg-slate-50 rounded-2xl md:rounded-[32px] p-6 md:p-8 border border-slate-200 flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4 sm:gap-8 shadow-sm">
                            <div className="w-12 h-12 md:w-16 md:h-16 bg-white rounded-2xl md:rounded-3xl flex items-center justify-center text-emerald-500 shadow-lg border border-slate-100 shrink-0">
                                <Upload size={24} className="md:w-8 md:h-8" />
                            </div>
                            <div className="flex-1">
                                <h4 className="font-black text-[#1B254B] uppercase text-sm md:text-base">Import Backup File</h4>
                                <p className="text-[11px] md:text-xs text-slate-500 mt-1 leading-normal">Upload a previously exported JSON file to restore the portal state. This overwrites all current cloud data.</p>
                                <label className="inline-block mt-4 px-6 py-2.5 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase cursor-pointer hover:scale-105 active:scale-95 transition-transform shadow-lg shadow-emerald-500/30 text-center w-full sm:w-auto">
                                    Upload JSON
                                    <input type="file" className="hidden" accept=".json" onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        const reader = new FileReader();
                                        reader.onload = (event) => {
                                            try {
                                                const imported = JSON.parse(event.target?.result as string);
                                                if (imported.students && Array.isArray(imported.students)) {
                                                    if (confirm("Restore entire database from this file? Current data will be lost.")) {
                                                        onUpdate(imported);
                                                    }
                                                } else { alert("Invalid backup file."); }
                                            } catch (err) { alert("Error reading file."); }
                                        };
                                        reader.readAsText(file);
                                    }} />
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
      </div>
    </div>
  );
};