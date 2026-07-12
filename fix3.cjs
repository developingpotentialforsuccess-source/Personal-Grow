const fs = require('fs');
let code = fs.readFileSync('services/convex.ts', 'utf8');
code = code.replace(/if \(CONVEX_URL === "https:\/\/valuable-fish-943.convex.cloud"\) \{\n  console.warn\("\[Convex\] Detected dev URL in Vercel environment. Overriding with prod URL \(dapper-robin-600\) to match the deployment key."\);\n  \/\/ override since vercel deploy key is for prod\n\}/g, '');
fs.writeFileSync('services/convex.ts', code);
