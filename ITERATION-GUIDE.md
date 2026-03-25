# Mahjong Visual Iteration Guide

## Reference
The file `mockup-reference.png` is the TARGET visual style. Every iteration should bring `index-3d.html` closer to it.

## Iteration Process (REACTIVE, not preplanned!)

Each iteration:
1. **Open the game** in browser (http://localhost:8877/index-3d.html), click Play
2. **Take a screenshot** of the current game state
3. **Compare to mockup-reference.png** — identify the BIGGEST visual gap right now
4. **Fix that one gap** with 2-4 targeted edits via Claude Code
5. **Verify** JS syntax, git commit, update iteration-state.json
6. **Report** what changed + screenshot to Discord #mahjong

DO NOT preplan iterations. Each iteration should look at what's CURRENTLY wrong vs the mockup and fix the biggest issue.

## Mockup Key Features (for comparison reference)
- **Dramatic 3D isometric view** from bottom-left, significant tile depth visible
- **Stacked 2-layer tile walls** around perimeter (dark colored backs)
- **Large chunky tiles** in player hand with PICTORIAL suit artwork
- **Ink wash illustrated avatars** (people in traditional clothing, not emoji)
- **Bamboo leaf decorations** in corners
- **Cloud/swirl ink motifs** on table
- **Ensō circle** in center
- **Wood grain border** frame
- **Warm parchment** table surface with rice paper texture
- **Warm lantern lighting**
- **Face-up discards** scattered in center
- **Clean header** with game info

## CRITICAL — Tile Suit Artwork Must Be VISUAL, Not Text!

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

## Rules
- NEVER rewrite the entire file — only targeted edits
- NEVER break game logic — visual changes ONLY
- Each iteration: compare to mockup, fix biggest gap, verify, commit
- Use canvas drawing for tile suit symbols (procedural, resolution-independent)

## Asset Strategy
- **Tile suit artwork**: Canvas/Three.js procedural drawing (resolution-independent, fast iteration)
- **Player avatars** (ink wash style portraits): Generate with Nano Banana Pro (Gemini image gen) if needed for artistic quality. Save to /Users/adrianai/Projects/cubes-mahjong/assets/
- **Backgrounds/textures**: Procedural canvas (rice paper, bamboo, ensō)
- **Icons**: SVG inline or canvas-drawn

## Nano Banana Usage (for image generation)
When procedural rendering isn't enough (e.g., stylized avatar portraits), generate images using the image generation tool. Style prompt should include: "ink wash painting style, traditional East Asian, simple, minimalist, warm cream background"
