# Pixel apartment theme — visual QA

Date: 2026-11-04

## Target and scope

Source visual truth: `/Users/hluo/Downloads/Screenshot 2026-11-04 at 10.02.26 AM.png` (1160×1164 pixels).

The user requested the **theme and art direction** of this reference for the existing apartment app, rather than a reconstruction of its floor plan. Saved room positions, mobile canvas, live task markers, inventory, existing navigation, flower wordmark, and Karla/Inter typography are intentional product constraints. The illustration's cat and ghosts are not part of the requested application behavior.

## Browser-rendered evidence

- Local implementation: `http://127.0.0.1:5173/`.
- Mobile: `design-evidence/pixel/pixel-home-390.png`, 390×844 CSS px and image pixels, device scale factor 1.
- Desktop: `design-evidence/pixel/pixel-home-1280.png`, 1280×900 CSS px and image pixels, device scale factor 1.
- Availability: `design-evidence/pixel/pixel-dock-390.png` and `pixel-dock-1280.png`.
- Enlarged room: `design-evidence/pixel/pixel-room-390.png` and `pixel-room-1280.png`.
- Full-view combined comparison: `design-evidence/pixel/comparison-full.png`. Reference on the left, implementation apartment region on the right. Reference normalized to 580 px wide with nearest-neighbor sampling; implementation region captured at approximately native 580 px width. Their different floor-plan aspect ratios are intentional.
- Focused kitchen comparison: `design-evidence/pixel/comparison-kitchen.png`. Source kitchen crop on the left and browser-rendered kitchen on the right, each normalized to 512×512 with nearest-neighbor sampling. This comparison checks pixel outlines, checkerboard flooring, furniture readability, brown/cream palette, and the live marker overlays.

Captured states: initial home with intro skipped, availability expanded, and Kitchen enlarged. Capture animations were disabled for stable final-state evidence; the opening sweep and reduced-motion behavior were tested separately.

## Comparison history

1. Initial implementation review: **blocked** by a P2 crop in the square bedroom, where the wider bedroom asset clipped part of the bed. Small supporting text was also too pale in the first palette pass.
2. Fixes: generated an additional square mint-bedroom asset and selected the appropriate bedroom artwork by room aspect ratio. Darkened supporting text and made the availability panel opaque. Converted all room assets to pixel-sized, lossless WebP for mobile loading. The opening sweep now waits for the room artwork to decode.
3. Post-fix review: opened both combined comparison images and the mobile/desktop browser captures. Both beds are fully represented at the saved room proportions; art, room names, task markers, and panels are legible. No actionable P0/P1/P2 findings remain in the requested theme adaptation.

## Required fidelity surfaces

- **Typography:** Karla and Inter are retained from the user's prior request. Clear functional text is used around the pixel artwork; the reference illustration does not define an app type system. Room-name plaques, headings, and counts have readable hierarchy without introducing decorative copy.
- **Spacing/layout:** The saved room arrangement and full-height canvas remain intact. Panels and controls fit mobile, desktop, and landscape layouts. Existing editor and modal dimensions remain functional. The square-bedroom crop was resolved with a properly composed asset, rather than stretching the original image.
- **Colors/tokens:** Warm brown outlines, honey wood, lilac walls, rose and mint bedding, cyan windows, cream paper panels, and amber quest markers follow the reference direction. The previous rounded glass/gradient treatment is replaced by flat game-panel surfaces and crisp shadows. Supporting text uses stronger brown tones.
- **Image quality:** Five original imagegen room assets are used, not SVG/CSS approximations of furniture. All load successfully in-browser. Native PNG originals remain available; runtime WebP files preserve composition with nearest-neighbor pixel sizing. Pixelarticons supplies the UI icons under its MIT license.
- **Copy/content:** Existing household, task, room, and supply names are retained. No reference marketing text, fake game scores, or decorative slogans were added.
- **Interactions/accessibility:** Navigation, task requests and completion, availability docking, quantity editing, layout customization, pinch zoom, panning, keyboard navigation, and reduced motion pass existing browser checks. Controls retain semantic names and focus states. Pixel room images are decorative and do not replace accessible room/task controls.

## Validation and residual notes

- Production build passed.
- 61 browser tests passed, including pixel-theme image loading and panel interactions.
- No browser console errors were captured in the pixel-theme checks.
- No horizontal viewport overflow in checked mobile/desktop states.
- Source scene geometry and decorative characters intentionally differ from this functioning apartment coordinator.
- P3 follow-up: exceptionally stretched custom rooms may crop decorative furniture because backgrounds use `object-fit: cover`; the supplied default room ratios are validated. More art variants can support additional ratios later.

## Implementation checklist

- [x] Generate and inspect original kitchen, living room, bathroom, and two bedroom assets.
- [x] Replace vector furniture with pixel room backgrounds in the map, room view, and editor.
- [x] Apply coherent game-panel styling across application surfaces.
- [x] Preserve saved data, interactions, brand mark, and requested fonts.
- [x] Inspect combined source/implementation comparisons and fix P2 findings.
- [x] Pass production build and browser regression checks.

final result: passed
