const fs = require('fs');
let code = fs.readFileSync('services/convex.ts', 'utf8');
code = code.replace(/const CONVEX_URL = "https:\/\/dapper-robin-600.convex.cloud";\s+CONVEX_URL = "https:\/\/dapper-robin-600.convex.cloud";/, 'const CONVEX_URL = "https://dapper-robin-600.convex.cloud";');
fs.writeFileSync('services/convex.ts', code);
