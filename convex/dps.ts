import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getUser = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    return user;
  },
});

export const createUser = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.string(),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (existing) {
      throw new Error("User already exists");
    }
    const id = await ctx.db.insert("users", args);
    return id;
  },
});

export const fetchDpsData = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    console.log(`[Convex] Fetching data for user: ${args.userId}`);
    return await ctx.db
      .query("dps_data")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();
  },
});

export const saveDpsData = mutation({
  args: {
    userId: v.string(),
    dataStr: v.string(),
    updatedAt: v.number(),
    version: v.number(),
  },
  handler: async (ctx, args) => {
    console.log(`[Convex] Saving data for user: ${args.userId}`);
    const existing = await ctx.db
      .query("dps_data")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      if (args.updatedAt > (existing.updatedAt || 0)) {
        await ctx.db.patch(existing._id, {
          dataStr: args.dataStr,
          updatedAt: args.updatedAt,
          version: args.version,
        });
        return { status: "updated" };
      }
      return { status: "rejected", reason: "stale" };
    } else {
      await ctx.db.insert("dps_data", args);
      return { status: "inserted" };
    }
  },
});


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

export const fetchStudents = query({
  args: { owner_id: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("dps_students")
      .withIndex("by_owner_id", (q) => q.eq("owner_id", args.owner_id))
      .collect();
  },
});

export const saveStudent = mutation({
  args: {
    id: v.string(),
    owner_id: v.string(),
    name: v.string(),
    category: v.string(),
    order: v.number(),
    deletedAt: v.optional(v.string()),
    data: v.any(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("dps_students")
      .withIndex("by_owner_id", (q) => q.eq("owner_id", args.owner_id))
      .filter((q) => q.eq(q.field("id"), args.id))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("dps_students", args);
    }
  },
});

export const fetchTopics = query({
  args: { owner_id: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("dps_topics")
      .withIndex("by_owner_id", (q) => q.eq("owner_id", args.owner_id))
      .collect();
  },
});

export const saveTopic = mutation({
  args: {
    id: v.string(),
    owner_id: v.string(),
    category: v.string(),
    parentId: v.optional(v.string()),
    title: v.string(),
    content: v.string(),
    order: v.optional(v.number()),
    data: v.any(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("dps_topics")
      .withIndex("by_owner_id", (q) => q.eq("owner_id", args.owner_id))
      .filter((q) => q.eq(q.field("id"), args.id))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("dps_topics", args);
    }
  },
});
