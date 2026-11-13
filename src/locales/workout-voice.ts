// Spoken workout cues, music picker and start-bar labels. Burmese is provisional until reviewed by a fluent speaker.
export const workoutVoice = {
  en: {
    startsIn: '{name} starts in',
    encourage:'Keep breathing. Maintain your pace.',
    volume:'Volume',
    go: 'Go!',
    switchSide: 'Switch sides',
    rest: 'Rest. Stretch and relax.',
    nextUp: 'Next: {name}',
    getReady: 'Get ready. Next: {name}',
    done: 'Workout complete. Great job!',
    music: 'Music',
    musicTitle: 'Background music',
    noMusic: 'No music',
    preview: 'Preview',
    credit: 'Music by Kevin MacLeod (incompetech.com), licensed CC BY 3.0.',
    tryThis: 'Try this',
    setTitle: 'Make it a set',
    setHint: '{n} exercises · about {min} min',
    startSet: 'Start set',
    voiceOn: 'Voice guide on',
    voiceOff: 'Voice guide off',
  },
  my: {
    encourage:'အသက်ကို ပုံမှန်ရှူပါ။',
    volume:'အသံအတိုးအကျယ်',
    startsIn: '{name} စတင်ပါမည်',
    go: 'စတင်ပါ',
    switchSide: 'ဘက်ပြောင်းပါ',
    rest: 'ခဏနားပါ။ ကြွက်သားဆန့်ပြီး အနားယူပါ။',
    nextUp: 'နောက်တစ်ခု {name}',
    getReady: 'အသင့်ပြင်ပါ။ နောက်တစ်ခု {name}',
    done: 'လေ့ကျင့်ခန်း ပြီးဆုံးပါပြီ။ အရမ်းတော်ပါတယ်။',
    music: 'ဂီတ',
    musicTitle: 'နောက်ခံ ဂီတ',
    noMusic: 'ဂီတ မဖွင့်ပါ',
    preview: 'နားထောင်ရန်',
    credit: 'Music by Kevin MacLeod (incompetech.com), licensed CC BY 3.0.',
    tryThis: 'ဒီလေ့ကျင့်ခန်း စမ်းမည်',
    setTitle: 'အစုံလိုက် လေ့ကျင့်မည်',
    setHint: 'လေ့ကျင့်ခန်း {n} ခု · ခန့်မှန်း {min} မိနစ်',
    startSet: 'စတင်မည်',
    voiceOn: 'အသံလမ်းညွှန် ဖွင့်ထားသည်',
    voiceOff: 'အသံလမ်းညွှန် ပိတ်ထားသည်',
  },
} as const;
export type VoiceKey = keyof typeof workoutVoice.en;
export const voiceLine = (lang: 'en' | 'my', key: VoiceKey, vars: Record<string, string | number> = {}) =>
  Object.entries(vars).reduce<string>((s, [k, v]) => s.replaceAll(`{${k}}`, String(v)), workoutVoice[lang][key]);

// Home "today" strip: water + streak + week. Burmese provisional.
export const homeToday = {
  en: { water: 'Water', addGlass: '+250 ml', waterLow: 'Only {ml} ml of water so far today. Drink a glass now.', waterDone: 'Water goal reached today. Nice work!', streak: 'day streak', week: 'this week', today: 'Today' },
  my: { water: 'ရေ', addGlass: '+250 ml', waterLow: 'ယနေ့ ရေ {ml} မီလီလီတာသာ သောက်ရသေးသည်။ ယခု ရေတစ်ခွက် သောက်ပါ။', waterDone: 'ယနေ့ ရေသောက်ပန်းတိုင် ပြည့်ပါပြီ။ တော်ပါတယ်။', streak: 'ရက် ဆက်တိုက်', week: 'ဒီအပတ်', today: 'ယနေ့' },
} as const;
