const fs = require('fs');
let code = fs.readFileSync('services/convex.ts', 'utf8');

code = code.replace(/const dataStr = JSON\.stringify\(item\.data\);[\s\S]*?idsToRemove\.push\(item\.id\);/g, `
    const jsonStr = JSON.stringify(item.data);
    const compressed = LZString.compressToBase64(jsonStr);
    const CHUNK_SIZE = 800000;
    const updatedAt = item.timestamp;
    const version = item.data.version || 1;
    
    if (compressed.length > CHUNK_SIZE) {
      const chunks = [];
      for (let i = 0; i < compressed.length; i += CHUNK_SIZE) {
        chunks.push(compressed.substring(i, i + CHUNK_SIZE));
      }
      for (let i = 0; i < chunks.length; i++) {
        await (client as any).mutation(anyApi.dps.saveDpsData, {
          userId: item.userId + "_chunk_" + i,
          dataStr: chunks[i],
          updatedAt,
          version
        });
      }
      const dataStr = JSON.stringify({ isChunked: true, totalChunks: chunks.length });
      await (client as any).mutation(anyApi.dps.saveDpsData, {
        userId: item.userId,
        dataStr,
        updatedAt,
        version
      });
    } else {
      const dataStr = jsonStr;
      await (client as any).mutation(anyApi.dps.saveDpsData, {
        userId: item.userId,
        dataStr,
        updatedAt,
        version
      });
    }
    idsToRemove.push(item.id);
`);
fs.writeFileSync('services/convex.ts', code);
