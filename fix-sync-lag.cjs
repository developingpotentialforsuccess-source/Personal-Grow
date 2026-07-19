const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

// 1. Remove isSyncing state
code = code.replace(/const \[isSyncing, setIsSyncing\] = useState\(false\);/, '');

// 2. Add an event emitter
code = code.replace(
  'const isSyncingRef = useRef<boolean>(false);',
  'const isSyncingRef = useRef<boolean>(false);\n  const setSyncingStatus = (status: boolean) => {\n    isSyncingRef.current = status;\n    window.dispatchEvent(new CustomEvent("sync-status-change", { detail: status }));\n  };'
);

// 3. Replace setIsSyncing with setSyncingStatus
code = code.replaceAll('setIsSyncing(true)', 'setSyncingStatus(true)');
code = code.replaceAll('setIsSyncing(false)', 'setSyncingStatus(false)');
code = code.replaceAll('!currentUser?.uid || isSyncing', '!currentUser?.uid || isSyncingRef.current');

// 4. In useEffect dependencies, replace isSyncing with nothing or remove it
code = code.replace(', isSyncing]', ']');

// 5. In App.tsx JSX, where isSyncing is used directly (like in header), we need to handle it.
// Oh wait, in App.tsx header: `isSyncing ? 'bg-blue-500 animate-pulse' : 'bg-emerald-500'`
// We can just create a small component for the sync indicator in App.tsx!

fs.writeFileSync('App.tsx', code);
