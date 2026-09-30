// Module resolve hook: any https:// import (the pinned Firebase SDK) becomes tests/_stubs/firebase.mjs.
const STUB = new URL("./_stubs/firebase.mjs", import.meta.url).href;
export async function resolve(specifier, context, next){
  if (specifier.startsWith("https://")) return { url: STUB, shortCircuit: true };
  return next(specifier, context);
}
