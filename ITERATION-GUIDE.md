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
