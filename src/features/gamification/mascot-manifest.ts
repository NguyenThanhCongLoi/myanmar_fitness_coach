// Bee mascot: user-supplied artwork (originals in workspace image/, processed by scripts/process-bee-mascot.py).
// This manifest is the single mapping from mascot state to asset; components never hard-code image paths.
export const MASCOT_STATES=['idle','happy','excited','proud','encouraging','concerned','sleepy','celebrating','thinking','cheering','waving','determined','surprised','pointing','resting'] as const;
export type MascotState=typeof MASCOT_STATES[number];
export type MascotAsset={kind:'image';src:string;srcSmall:string;fallback:string}|{kind:'sprite';src:string;fallback:string;frames:number;durationMs:number;width:number;height:number}|{kind:'rive';src:string;fallback:string;stateMachine:string};
const base='/assets/mascot/bee';
const FALLBACK=`${base}/master/bee_mascot_2048x2048_transparent-320.webp`;
const file:Record<MascotState,string>={
  idle:'expressions/bee_idle',happy:'expressions/bee_happy',excited:'expressions/bee_excited',proud:'expressions/bee_proud',
  encouraging:'expressions/bee_encouraging',concerned:'expressions/bee_concerned',sleepy:'expressions/bee_sleepy',celebrating:'expressions/bee_celebrating',
  thinking:'expressions/bee_thinking',cheering:'poses/bee_pose_cheering',waving:'expressions/bee_waving',determined:'expressions/bee_determined',
  surprised:'expressions/bee_surprised',pointing:'poses/bee_pose_pointing',resting:'poses/bee_pose_sitting',
};
export const mascotManifest:Record<MascotState,MascotAsset>=Object.fromEntries(MASCOT_STATES.map(state=>[state,{kind:'image',src:`${base}/${file[state]}-320.webp`,srcSmall:`${base}/${file[state]}-160.webp`,fallback:FALLBACK}])) as Record<MascotState,MascotAsset>;
export const beeAvatar={idle:`${base}/avatars/bee_avatar_idle`,happy:`${base}/avatars/bee_avatar_happy`} as const;
// Event -> expression with priority, so a celebration is not immediately replaced by idle.
export const MASCOT_EVENTS={
  app_opened:{state:'waving',priority:1},onboarding_completed:{state:'happy',priority:2},ai_coach_processing:{state:'thinking',priority:2},
  ai_coach_answered:{state:'happy',priority:2},workout_started:{state:'encouraging',priority:2},exercise_completed:{state:'happy',priority:2},
  workout_completed:{state:'celebrating',priority:4},new_personal_record:{state:'proud',priority:4},streak_milestone:{state:'excited',priority:4},
  scheduled_rest_day:{state:'sleepy',priority:1},workout_missed:{state:'encouraging',priority:1},progress_improved:{state:'proud',priority:3},
  notification_reminder:{state:'waving',priority:1},unexpected_error:{state:'concerned',priority:3},
} as const satisfies Record<string,{state:MascotState;priority:number}>;
export type MascotEvent=keyof typeof MASCOT_EVENTS;
