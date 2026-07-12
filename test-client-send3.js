import { ConvexHttpClient } from "convex/browser";
import { api } from "./convex/_generated/api.js";
const client = new ConvexHttpClient("https://dapper-robin-600.convex.cloud");
client.query(api.dps.fetchDpsData, { userId: "test" }).then(console.log).catch(console.error);
