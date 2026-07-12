import { api } from "./convex/_generated/api.js";
const func: any = api.dps.fetchDpsData;
console.log(func.isPublic, func.name, func);
