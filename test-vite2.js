import { anyApi } from "convex/server";
const functionName = Symbol.for("functionName");
console.log(anyApi.dps.fetchDpsData[functionName]);
