/** Colours from the approved Raft drawings. */
export const raftColours = {
  chocolate: "#6B4A33",
  cream: "#FAF6EE",
  lavender: "#B9A3E3",
  softOrange: "#F59E4B",
} as const;

/** Files written by scripts/build_assets.py. Apps copy them to /brand. */
export const raftAssets = {
  wave: "raft-wave.webp",
  raft: "raft-raft.webp",
  approve: "raft-approve.webp",
  wordmark: "raft-wordmark.webp",
  mark: "raft-mark.webp",
  icon16: "raft-app-icon-16.png",
  icon32: "raft-app-icon-32.png",
  icon180: "raft-app-icon-180.png",
  icon192: "raft-app-icon-192.png",
  icon512: "raft-app-icon-512.png",
  og: "og.png",
  manifest: "manifest.webmanifest",
} as const;

/**
 * Eye centres on the cropped wave pose, as fractions of the image.
 * scripts/build_assets.py measures these from the drawing.
 */
export const raftEyes = {
  left: { x: 0.383, y: 0.266 },
  right: { x: 0.598, y: 0.251 },
} as const;
