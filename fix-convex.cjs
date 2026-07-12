const fs = require('fs');
let code = fs.readFileSync('convex/dps.ts', 'utf8');

const newCode = `
export const fetchDpsChunks = query({
  args: { userId: v.string(), totalChunks: v.number() },
  handler: async (ctx, args) => {
    const chunks = [];
    for (let i = 0; i < args.totalChunks; i++) {
      const doc = await ctx.db
        .query("dps_data")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId + "_chunk_" + i))
        .first();
      if (doc) {
        chunks.push(doc.dataStr);
      } else {
        chunks.push("");
      }
    }
    return chunks;
  }
});
`;

code = code.replace(/export const fetchStudents/, newCode + '\nexport const fetchStudents');
fs.writeFileSync('convex/dps.ts', code);
