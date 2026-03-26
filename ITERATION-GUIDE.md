# Mahjong Visual Iteration Guide

## Reference
The file `mockup-reference.png` is the TARGET visual style. Every iteration should bring `index-3d.html` closer to it.

## Key Mockup Features (priority order)

### TILE RENDERING — Most Important
1. **Actual suit symbols** — NOT just Chinese characters. Real mahjong tiles show:
   - **Dots (筒/Tong)**: Colored circles arranged in patterns (1-9 dots)
   - **Bamboo (條/Tiao)**: Green bamboo stick bundles (1 is a bird, 2-9 are sticks)
   - **Characters (萬/Wan)**: Chinese number + 萬 character in red/black
   - **Winds**: 東南西北 in dark calligraphy
   - **Dragons**: 中(red), 發(green), 白(white/empty frame)
   - Use canvas to DRAW these symbols, not just text
2. **Tile depth** — Chunky 3D look with clearly visible ivory/cream sides
3. **Tile face** — Clean white/cream with detailed suit art
4. **Tile shadows** — Soft shadows grounding tiles to table

### TABLE & ENVIRONMENT
5. **Warm parchment table** with visible rice paper texture
6. **Dark wood border** — prominent frame around playing area
7. **Ink wash decorations** — bamboo leaves, cloud wisps, ensō circle
8. **Background** — aged parchment with faint ink wash mountains
9. **Warm lighting** — lantern glow feel, not cold/clinical

### LAYOUT & UI
10. **Isometric camera** — ~35° showing tile depth
11. **Stacked tile walls** — 2 layers, dark backs with pattern
12. **Large player hand** — big readable tiles at bottom
13. **Clean header** — game title + round info
14. **Player avatars** — ink wash style (aim for stylized characters, not emoji)
15. **Action buttons** — warm brown/vermillion with icons

## Rules for Each Iteration
1. Read `iteration-state.json` to see what iteration you're on
2. Make 2-4 TARGETED edits (never rewrite entire file)
3. Focus on ONE area per iteration
4. Test that JS has no syntax errors after changes
5. Update `iteration-state.json` with what you changed
6. Keep all game logic intact — visual changes ONLY

## Iteration Focus Areas (rotate through these)
- Iterations 1-4: Tile suit artwork (draw actual dots, bamboo, characters)
- Iterations 5-7: Table surface, wood border, ink decorations
- Iterations 8-10: Lighting, shadows, material refinement
- Iterations 11-13: UI elements (header, buttons, player info)
- Iterations 14-16: Camera angle, composition, breathing room
- Iterations 17-20: Polish pass — compare to mockup pixel by pixel
- Iterations 21+: Final tweaks, consistency check

## Asset Strategy
- **Tile suit artwork**: Canvas/Three.js procedural drawing (resolution-independent, fast iteration)
- **Player avatars** (ink wash style portraits): Generate with Nano Banana Pro (Gemini image gen) if needed for artistic quality. Save to /Users/adrianai/Projects/cubes-mahjong/assets/
- **Backgrounds/textures**: Procedural canvas (rice paper, bamboo, ensō)
- **Icons**: SVG inline or canvas-drawn

## Nano Banana Usage (for image generation)
When procedural rendering isn't enough (e.g., stylized avatar portraits), generate images using the image generation tool. Style prompt should include: "ink wash painting style, traditional East Asian, simple, minimalist, warm cream background"

## CRITICAL — Tile Suit Artwork Must Be VISUAL, Not Text!
Adrian specifically wants PICTORIAL tile artwork, NOT Chinese characters:

### Dots (筒) — Draw colored CIRCLES/BALLS
- 1-dot: One large colored circle
- 2-dot: Two circles arranged vertically
- 3-dot: Three circles in triangle
- 4-dot: Four circles in 2x2 grid
- 5-dot: Five circles (4 corners + 1 center)
- 6-dot: Six circles in 2x3 grid
- 7-dot: Seven circles (3-1-3 pattern)
- 8-dot: Eight circles (2-2-2-2 pattern)
- 9-dot: Nine circles in 3x3 grid
- Colors: Use red/green/blue multicolored circles like real mahjong tiles

### Bamboo (條) — Draw actual BAMBOO STICKS
- 1-bamboo: A stylized bird/sparrow (traditional)
- 2-bamboo: Two green bamboo sticks
- 3-bamboo: Three bamboo sticks
- 4-bamboo: Four bamboo sticks (2+2 crossed)
- 5-bamboo: Five bamboo sticks
- 6-bamboo: Six bamboo sticks (3+3)
- 7-bamboo: Seven bamboo sticks
- 8-bamboo: Eight bamboo sticks (4+4)
- 9-bamboo: Nine bamboo sticks
- Each stick: Green tube with segment nodes/joints, slight shading

### Characters (萬) — These CAN use Chinese text
- Show the number (一二三四五六七八九) + 萬 below
- This is correct for Characters suit — they use text traditionally

### DO NOT just show "六竹" or "1" — draw the ACTUAL pictures!

## ⚠️ ABSOLUTE RULES — DO NOT DEVIATE FROM MOCKUP
- The mockup shows a **CREAM/PARCHMENT** table surface — NOT green felt
- The mockup has **warm rice paper texture** — NOT a billiard/mahjong table look
- The mockup has **ink wash/calligraphy** aesthetic — Paper & Ink theme
- Do NOT add green felt, do NOT change the fundamental color palette
- EVERY change must make the game look MORE like mockup-reference.png
- If a change would deviate from the mockup, DO NOT make it
- The mockup is the ONLY source of truth for visual decisions

## ⚠️ SVG vs Image Generation
DO NOT use hand-coded SVG for artistic/stylistic elements. They look generic and stiff.

**Use Nano Banana / image generation for:**
- Player avatar portraits (ink wash characters with traditional clothing)
- Table surface decorative textures (parchment, ink wash motifs)
- Decorative corner elements (bamboo paintings, cloud motifs)
- Any element that needs artistic quality

**Use procedural canvas/SVG for:**
- Tile suit symbols (dots, bamboo sticks, characters) — geometric/precise
- UI elements (buttons, panels, overlays)
- Simple geometric patterns (lattice, borders)

**How to generate with Nano Banana:**
Use the image generation capabilities available in the session. Prompt style: "sumi-e ink wash painting style, traditional East Asian, [subject], on transparent/cream background, minimalist brush strokes"

Save generated images to /Users/adrianai/Projects/cubes-mahjong/assets/ and reference as relative paths in the HTML.

## ⚠️ TILE BACK COLOR — DO NOT CHANGE
The tile back MUST be forest green (#3B7A5A). Do NOT change it to cream, white, ivory, or any neutral color.
This is the classic mahjong tile back color and provides visual distinction from the white face.
