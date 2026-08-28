# Visual thesis — Lantern circuit

APK Release Pocket borrows from a night-market repair stall: ink-black canvas, weathered paper labels, hot coral neon, cyan tube light, and small amber inspection stamps. It should feel like a trustworthy technical counter open after hours—not a cyberpunk dashboard and never a generic gradient hero. Verification facts are the merchandise, so decoration frames them instead of competing with them.

## Palette

The product is intentionally single-mode because the night setting is its identity. Every page explicitly paints the background.

| Token | Value | Role |
|---|---:|---|
| `--ink` | `#090d12` | page background |
| `--stall` | `#101821` | raised surface |
| `--paper` | `#f4eddf` | primary copy |
| `--smoke` | `#b9c2c9` | secondary copy |
| `--coral` | `#ff6b57` | primary action / neon sign |
| `--coral-ink` | `#240704` | text on coral |
| `--cyan` | `#66e4dd` | verified / focus / links |
| `--amber` | `#ffc857` | caution / metadata stamp |
| `--danger` | `#ff8a8a` | errors, always paired with text/icon |

Core text pairs exceed 4.5:1. Coral and cyan are never used as small body text on the light surfaces.

## Type and spacing

Two local/system faces only: **Arial Narrow / Liberation Sans Narrow** for condensed market-sign headlines and **ui-monospace / SFMono-Regular / Consolas** for checksums, commands, and inspection labels. Body copy uses the platform sans stack for speed and legibility. No font files are shipped, so the font budget is zero and no third party receives a request.

The scale is 14 / 16 / 20 / 28 / clamp(42–76) px. Body text is at least 16 px. Spacing follows a strict 4 px base with 8, 12, 16, 24, 32, 48, 64, and 96 px steps. Reading measure tops out at 68 characters.

## Shape, assets, and interaction grammar

Corners are clipped like vendor tickets rather than softly rounded SaaS cards. Hairline borders resemble bent sign frames; dotted rules imply receipt perforations. “Verified” appears as a stamped word plus a check mark, never color alone. Buttons depress by 2 px. Details open in place. Copy controls announce completion in a live region.

The original hero artwork is a raster editorial illustration of a tiny night-market APK verification stall: phone, hanging signs, receipt printer, and a luminous shield-check. It explains the product journey without fake UI or text. Generated with `/opt/fleet/lib/gen-image.sh` using the factory image deployment, then converted to WebP. Prompt provenance is recorded beside the asset in `site/assets/hero.prompt.json`; the generated output is project-owned and used under the repository MIT license.

## Motion

Only the sign, result stamp, and disclosure transitions move. Entrances use 180–260 ms opacity/translate; button presses use 120 ms transform. No animation loops and nothing flashes. Under `prefers-reduced-motion: reduce`, all transforms and transitions become instant while hierarchy remains intact through scale, border, and contrast.

## Responsive intent

Desktop pairs release copy with the stall illustration and keeps inspection facts in a two-column receipt. At 390 px, the illustration drops below the primary command, nav becomes a compact wrap, facts become one column, fingerprints wrap anywhere, and every target remains at least 44 px. Decorative hanging wires are removed on small screens; product state and install guidance remain.
