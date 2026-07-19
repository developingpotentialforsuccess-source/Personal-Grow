const fs = require('fs');
let code = fs.readFileSync('components/Sidebar.tsx', 'utf8');

// Replace isSyncing prop usage with local state
// 1. Remove isSyncing from props
code = code.replace(/isSyncing\?: boolean;/, '');
code = code.replace(/  isSyncing,\n/, '');

// 2. Add local state inside Sidebar
const stateHook = `  const [isSyncing, setIsSyncing] = useState(false);
  useEffect(() => {
    const handler = (e: CustomEvent) => setIsSyncing(e.detail);
    window.addEventListener('sync-status-change', handler as EventListener);
    return () => window.removeEventListener('sync-status-change', handler as EventListener);
  }, []);`;

code = code.replace('  const [isOnline, setIsOnline] = useState(true);', `  const [isOnline, setIsOnline] = useState(true);\n${stateHook}`);

fs.writeFileSync('components/Sidebar.tsx', code);
