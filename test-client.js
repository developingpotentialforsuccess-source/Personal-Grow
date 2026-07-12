import { anyApi } from "convex/server";
const fn = anyApi.dps.fetchDpsData;
console.log(JSON.stringify(fn));
