import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// 1. Auth Helpers
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

// 2. Main DPS Data Monolith
export const fetchDpsData = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
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
    const existing = await ctx.db
      .query("dps_data")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        dataStr: args.dataStr,
        updatedAt: args.updatedAt,
        version: args.version,
      });
    } else {
      await ctx.db.insert("dps_data", args);
    }
  },
});

// 3. Granular Students
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

export const deleteStudent = mutation({
  args: { owner_id: v.string(), id: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("dps_students")
      .withIndex("by_owner_id", (q) => q.eq("owner_id", args.owner_id))
      .filter((q) => q.eq(q.field("id"), args.id))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

// 4. Granular Topics
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

export const deleteTopic = mutation({
  args: { owner_id: v.string(), id: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("dps_topics")
      .withIndex("by_owner_id", (q) => q.eq("owner_id", args.owner_id))
      .filter((q) => q.eq(q.field("id"), args.id))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

// 5. Shared Notes
export const fetchSharedNote = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("dps_shares")
      .withIndex("by_id", (q) => q.eq("id", args.id))
      .first();
  },
});

export const saveSharedNote = mutation({
  args: {
    id: v.string(),
    owner_id: v.string(),
    owner_name: v.string(),
    type: v.string(),
    title: v.string(),
    payload: v.any(),
    created_at: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("dps_shares")
      .withIndex("by_id", (q) => q.eq("id", args.id))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("dps_shares", args);
    }
  },
});

// 6. Backups
export const fetchBackups = query({
  args: { owner_id: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("dps_backups")
      .withIndex("by_owner_id", (q) => q.eq("owner_id", args.owner_id))
      .collect();
  },
});

export const saveBackup = mutation({
  args: {
    id: v.string(),
    owner_id: v.string(),
    type: v.string(),
    timestamp: v.string(),
    data: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("dps_backups", args);
  },
});
