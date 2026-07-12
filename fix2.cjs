const fs = require('fs');
let code = fs.readFileSync('services/convex.ts', 'utf8');
code = code.replace(/const CONVEX_URL = .*/, `let CONVEX_URL = ((typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_CONVEX_URL) || (typeof process !== "undefined" && process.env?.CONVEX_URL) || "https://dapper-robin-600.convex.cloud").replace(/\\/$/, "");\n\nif (CONVEX_URL === "https://valuable-fish-943.convex.cloud") {\n  CONVEX_URL = "https://dapper-robin-600.convex.cloud";\n}`);
fs.writeFileSync('services/convex.ts', code);
