/** Cache of the *serialized* canonical SQLite snapshot, not a substitute database.
 * Every consumer receives a clone. A changed SQL payload always forces reparse.
 * No persistence/ledger schema changes, no background tasks, no external telemetry.
 */
export function createSnapshotCache({maxBytes=4*1024*1024,enabled=true,ttlMs=60000}={}){
 if(!Number.isSafeInteger(maxBytes)||maxBytes<0)throw Error('Limite de cache inválido');
 let lastPacked=null,lastRoot=null,lastAt=0,hits=0,misses=0,skipped=0;
 function reset(){lastPacked=null;lastRoot=null;lastAt=0;}
 function get(packed,decode){
  if(typeof packed!=='string'||typeof decode!=='function')throw Error('Fonte SQLite inválida.');
  if(enabled&&lastRoot!==null&&Date.now()-lastAt<ttlMs&&packed===lastPacked){hits++;return structuredClone(lastRoot);}
  misses++;
  const root=decode(packed); // Throws intact if key, JSON or normalization fails.
  if(enabled&&Buffer.byteLength(packed,'utf8')<=maxBytes){
   // Never retain the instance returned to business logic: writers may mutate it.
   lastRoot=structuredClone(root);lastPacked=packed;lastAt=Date.now();
  }else{skipped++;reset();}
  return root;
 }
 return {get,reset,stats:()=>({enabled,limitBytes:maxBytes,hits,misses,skipped,holding:!!lastRoot})};
}
