export const MASCOT_STATES=['idle','happy','excited','proud','encouraging','concerned','sleepy','celebrating','thinking','cheering'] as const;
export type MascotState=typeof MASCOT_STATES[number];
export type MascotAsset={kind:'image';src:string;fallback:string}|{kind:'sprite';src:string;fallback:string;frames:number;durationMs:number;width:number;height:number}|{kind:'rive';src:string;fallback:string;stateMachine:string};
// Replace only this manifest when original artwork arrives. Public local assets only.
export const mascotManifest:Record<MascotState,MascotAsset>=Object.fromEntries(MASCOT_STATES.map(state=>[state,{kind:'image',src:`/mascot/seed-${state}.svg`,fallback:'/mascot/seed-idle.svg'}])) as Record<MascotState,MascotAsset>;
