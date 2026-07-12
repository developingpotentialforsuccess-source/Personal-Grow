import { anyApi } from "convex/server";
const fn = anyApi.dps.fetchDpsData;
console.log(typeof fn);
console.log(fn);
