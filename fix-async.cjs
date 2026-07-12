const fs = require('fs');
let code = fs.readFileSync('services/convex.ts', 'utf8');

code = code.replace(/const unsubData = \(client as any\)\.onUpdate\(anyApi\.dps\.fetchDpsData, \{ userId \}, \(res: any\) => \{/, 'const unsubData = (client as any).onUpdate(anyApi.dps.fetchDpsData, { userId }, async (res: any) => {');

fs.writeFileSync('services/convex.ts', code);
