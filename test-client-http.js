import { ConvexHttpClient } from "convex/browser";
const client = new ConvexHttpClient("https://valuable-fish-943.convex.cloud");
client.query("dps:fetchDpsData", { userId: "test" }).then(console.log).catch(console.error);
