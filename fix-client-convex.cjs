const fs = require('fs');
let code = fs.readFileSync('services/convex.ts', 'utf8');

// add import
code = `import LZString from 'lz-string';\n` + code;

// find saveDpsData
code = code.replace(/const dataStr = JSON\.stringify\(dataState\);/g, `
    const jsonStr = JSON.stringify(dataState);
    const compressed = LZString.compressToBase64(jsonStr);
    const CHUNK_SIZE = 800000;
    
    if (compressed.length > CHUNK_SIZE) {
      console.log(\`[Convex] Data is large (\${compressed.length} bytes), chunking...\`);
      const chunks = [];
      for (let i = 0; i < compressed.length; i += CHUNK_SIZE) {
        chunks.push(compressed.substring(i, i + CHUNK_SIZE));
      }
      for (let i = 0; i < chunks.length; i++) {
        await (client as any).mutation(anyApi.dps.saveDpsData, {
          userId: userId + "_chunk_" + i,
          dataStr: chunks[i],
          updatedAt,
          version
        });
      }
      // Save metadata
      const dataStr = JSON.stringify({ isChunked: true, totalChunks: chunks.length });
      await (client as any).mutation(anyApi.dps.saveDpsData, {
        userId,
        dataStr,
        updatedAt,
        version
      });
      console.log("[Convex] Save chunked successful.");
      lastSyncStatus = true;
      return;
    }
    
    // Else, normally stringify or keep compressed? 
    // Wait, let's just always compress if we can? 
    // Actually, to remain backward compatible, if it's small enough, just stringify.
    const dataStr = jsonStr;
`);

// find fetchDpsData inside onUpdate
code = code.replace(/const cloudData = JSON\.parse\(rawData\);[\s\S]*?onUpdate\(cloudData\);/g, `
          let cloudData;
          const parsedRaw = JSON.parse(rawData);
          if (parsedRaw && parsedRaw.isChunked) {
             console.log(\`[Convex] Fetching \${parsedRaw.totalChunks} chunks...\`);
             const chunks = await (client as any).query(anyApi.dps.fetchDpsChunks, { userId, totalChunks: parsedRaw.totalChunks });
             const fullStr = chunks.join('');
             const decompressed = LZString.decompressFromBase64(fullStr);
             if (decompressed) {
                cloudData = JSON.parse(decompressed);
             } else {
                throw new Error("Failed to decompress chunks");
             }
          } else {
             cloudData = parsedRaw;
          }
          cloudData.updatedAt = res.updatedAt || cloudData.updatedAt;
          onUpdate(cloudData);
`);

// wait, is there another JSON.parse(rawData)?
// Let's check how many times it happens in services/convex.ts
fs.writeFileSync('fix-client-convex-output.ts', code);
