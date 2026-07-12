import { ConvexClient } from "convex/browser";
import { anyApi } from "convex/server";
const client = new ConvexClient("https://dapper-robin-600.convex.cloud");
client.query(anyApi.dps.fetchDpsData, { userId: "test" }).then(res => {
  console.log("Success:", res);
  client.close();
}).catch(err => {
  console.error("Error:", err);
  client.close();
});
