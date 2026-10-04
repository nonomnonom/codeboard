import type {PageOptions} from "./types.js";

export function pageBounds(options:PageOptions={}){
  const limit=options.limit??50,offset=options.offset??0;
  if(!Number.isSafeInteger(limit)||limit<1||!Number.isSafeInteger(offset)||offset<0)
    throw new Error("Query limit must be a positive safe integer and offset a nonnegative safe integer");
  return {limit:Math.min(200,limit),offset};
}
