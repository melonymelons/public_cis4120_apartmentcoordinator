# Pixel apartment artwork

Original room artwork generated with the built-in ImageGen tool, using the user-provided cozy pixel apartment screenshot as a style reference. The art is decorative; room geometry, task pins, supply quantities, and interactions remain live application UI.

## Assets and prompts

- `kitchen.png` / `kitchen.webp`: Cozy square 16-bit RPG kitchen with brown pixel outlines, cream/slate checkerboard floor, wooden counters, cream refrigerator, sink and stove, cyan window, pink accents, plants, and a small wooden table. No text, UI, or characters.
- `living.png` / `living.webp`: Cozy original 16-bit RPG living room, orthographic top-down, brown outlines, honey wood floor, cream/sage/rose palette, readable sofa, coffee table, bookshelf, lamp, and plants. No text, UI, or characters.
- `bedroom.png` / `bedroom.webp`: Original cozy 16-bit RPG bedroom with brown pixel outlines, pastel lilac and pink, honey plank floor, heart-patterned duvet, curtained window, bookshelf, lamp, and plant. Landscape 6:5; no text, UI, or characters.
- `bedroom-square.png` / `bedroom-square.webp`: Original square cozy 16-bit RPG bedroom with reference-style brown pixel outlines and pastel palette, a mint/light-blue heart duvet, and fully contained furniture. No text, UI, or characters.
- `bathroom.png` / `bathroom.webp`: Cozy 16-bit RPG bathroom with brown pixel outlines, cream/gray tiles, slate wall, cyan window and shower curtain, pink towel, wooden vanity, round mirror, toilet, blue bathmat, and plant. Landscape 2:1; no text, UI, or characters.

All five assets use the built-in generation path, not the API/CLI fallback. Original PNGs are preserved. Runtime WebP files use nearest-neighbor downsampling to a pixel-appropriate 384-pixel width (512 for the wide bathroom), then lossless WebP compression. Run `npm run optimize:art` from the project root to regenerate runtime assets.

The UI icons come from [Pixelarticons](https://github.com/halfmage/pixelarticons), MIT © Gerrit Halfmann. The existing flower logo, Karla and Inter typography, and saved apartment data are retained.

## Roommate characters

`characters.png` is the original 1254 × 1254 transparent sprite atlas generated with the built-in ImageGen tool. `characters.webp` is the lossless 768-pixel runtime version, produced with nearest-neighbor resizing by `npm run optimize:art`. The original alpha is preserved. CSS selects one of six equal cells in a 3-column, 2-row atlas. This uses the built-in generation mode, without the API/CLI fallback.

Generation prompt:

> Use case: game-asset. Create ONE transparent PNG sprite atlas for a cozy pixel-art shared-apartment app called nest. Exactly six original human character sprites, arranged on a precise 3-column by 2-row equal-cell grid, square sheet. Each sprite fully inside its cell, centered at the cell center, identical scale, fully visible from head to shoes. No text, no labels, no backgrounds, no shadows outside characters, no grid dividers. True transparent alpha around each. Warm brown pixel outlines, chunky low-resolution 16-bit handheld game aesthetic, discrete square pixels, no antialiasing, no gradients. Friendly front-facing chibi adult roommates with tiny eyes and large heads, standing neutral pose. Top row left to right: 1 Sage green sweater, medium-brown skin, short curly dark hair; 2 Peach pink hoodie, light skin, shoulder-length wavy auburn hair; 3 Sky blue overalls, deep brown skin, short black natural hair. Bottom row left to right: 4 Lilac lavender cardigan, light tan skin, short straight dark hair and glasses; 5 Sunny mustard yellow sweater, warm brown skin, dark hair in two small buns; 6 Rose dusty pink overalls, fair skin, blond chin-length hair. All equally sized, occupy about 60 percent of each cell width and 84 percent of each cell height with transparent margins. Keep all six characters separate, no overlaps, cute readable silhouettes even at 32px. This single atlas will be used directly as a CSS sprite sheet.

Character choices are stored in each roommate's profile. Map markers show accepted task assignees and buyers of supplies needing restocking. Pending suggestions and completed tasks do not add an owner marker. People without a selected character retain their initial.
