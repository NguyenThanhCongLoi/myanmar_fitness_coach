// Replaceable UI artwork (like the mascot manifest). Drop a file in public/images/ui/ and set its path here;
// null keeps the gradient tile. Use your own or licensed images only (record the source in THIRD_PARTY_NOTICES.md).
// Recommended: WebP, 800x600, subject on the right half (text sits bottom-left).
export const UI_IMAGES = {
  train: {
    home: null as string | null,   // e.g. '/images/ui/train-home.webp'
    gym: null as string | null,    // '/images/ui/train-gym.webp'
    quick: null as string | null,  // '/images/ui/train-quick.webp'
    build: null as string | null,  // '/images/ui/train-build.webp'
  },
} as const;
