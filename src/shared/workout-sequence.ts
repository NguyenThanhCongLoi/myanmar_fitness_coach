/** Stable playback order shared by duration estimates and the player. Sets count includes both sides. */
export function orderedSets<T extends {exerciseId:string;sets:number}>(rows:T[], circuit:boolean) {
  const pair=(r:T)=>r.exerciseId==='curated-bird-dog'&&circuit;
  const make=(row:T,setIndex:number)=>({row,setIndex});
  if(!circuit)return rows.flatMap(row=>Array.from({length:row.sets},(_,i)=>make(row,i)));
  const rounds=Math.max(0,...rows.map(r=>Math.ceil(r.sets/(pair(r)?2:1))));
  return Array.from({length:rounds},(_,round)=>rows.flatMap(row=>pair(row)
    ? [round*2,round*2+1].filter(i=>i<row.sets).map(i=>make(row,i))
    : round<row.sets?[make(row,round)]:[])).flat();
}
