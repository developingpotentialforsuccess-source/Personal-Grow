import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Users for custom/simple credential auth
  users: defineTable({
    email: v.string(),
    password: v.string(),
    name: v.string(),
    role: v.string(),
  }).index("by_email", ["email"]),

  // Main data monolith (settings, meta, etc.)
  dps_data: defineTable({
    userId: v.string(),
    dataStr: v.string(), // JSON stringified meta data
    updatedAt: v.number(),
    version: v.number(),
  }).index("by_userId", ["userId"]),

  // Granular students collection
  dps_students: defineTable({
    id: v.string(), // student's custom uuid/id
    owner_id: v.string(),
    name: v.string(),
    category: v.string(),
    order: v.number(),
    deletedAt: v.optional(v.string()),
    data: v.any(),
  }).index("by_owner_id", ["owner_id"]),

  // Granular topics collection
  dps_topics: defineTable({
    id: v.string(), // topic's custom uuid/id
    owner_id: v.string(),
    category: v.string(),
    parentId: v.optional(v.string()),
    title: v.string(),
    content: v.string(),
    order: v.optional(v.number()),
    data: v.any(),
  }).index("by_owner_id", ["owner_id"]),

  // Shares for cloud links
  dps_shares: defineTable({
    id: v.string(), // share custom id
    owner_id: v.string(),
    owner_name: v.string(),
    type: v.string(),
    title: v.string(),
    payload: v.any(),
    created_at: v.string(),
  }).index("by_share_id", ["id"]),

  // Backups
  dps_backups: defineTable({
    id: v.string(),
    owner_id: v.string(),
    type: v.string(),
    timestamp: v.string(),
    data: v.any(),
  }).index("by_owner_id", ["owner_id"]),
});
