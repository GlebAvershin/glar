import { DIFFS_TAG_NAME } from "@pierre/diffs"

/**
 * TypeScript declaration for the <diffs-container> custom element.
 * This tells TypeScript that <diffs-container> is a valid JSX element in SolidJS.
 * Required for using the @pierre/diffs web component in .tsx files.
 *
 * NOTE (ourapp): upstream ships this as a symlink to ../../ui/src/custom-elements.d.ts.
 * On Windows the symlink degrades to a text file containing the target path, which
 * tsc then parses as broken TS (TS1128). We inline the real content instead — see
 * PATCHES.md (Windows symlink nuance). Keep in sync with ui/src/custom-elements.d.ts.
 */

declare module "solid-js" {
  namespace JSX {
    interface IntrinsicElements {
      [DIFFS_TAG_NAME]: HTMLAttributes<HTMLElement>
    }
  }
}

export {}
