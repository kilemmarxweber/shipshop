/** WebKit needs the legacy attribute so iOS does not force fullscreen video. */
export const iosInlineVideo = {
  playsInline: true,
  "webkit-playsinline": "true",
} as const;
