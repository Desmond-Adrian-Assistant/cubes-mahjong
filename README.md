# 🀄 Cubes Mahjong

A kawaii-styled 4-player classic Mahjong web game.

## Features

- **Classic Hong Kong-style Mahjong** with full 136-tile set
- **4 players**: You (South) vs 3 AI opponents
- **Full game mechanics**: Draw, Discard, Chi, Pong, Kong, Mahjong
- **Kawaii sticker art aesthetic**: Thick outlines, rounded corners, cute animal avatars
- **Responsive design**: Works on desktop and mobile

## How to Play

1. Open `index.html` in a browser (or run a local server)
2. Click "Start Game" to begin
3. You play as South (🐼)
4. **On your turn**:
   - Click a tile to select it
   - Click again or press "Discard" to discard
5. **When opponents discard**:
   - Action buttons appear if you can Chi/Pong/Kong/Mahjong
   - Click the action or Skip to pass

## Running Locally

```bash
cd /Users/adrianai/Projects/cubes-mahjong
python3 -m http.server 8877
```

Then open http://localhost:8877

## Tech Stack

- Pure HTML/CSS/JavaScript
- No dependencies or build tools
- Canvas for background, DOM for tiles
- Google Fonts (Nunito)

## Visual Style

- 🎨 Kawaii sticker art aesthetic
- 🟢 Green felt table (#3d6b4f)
- 🍦 Warm cream tiles with suit-colored gradients
- 🌸 Cherry blossom pattern on tile backs
- 🐱 Cute animal avatars (cat, fox, bunny, panda)

## Game Rules (Hong Kong Style)

- 136 tiles: 3 suits (Bamboo, Dots, Characters) × 9 ranks × 4 each
- 4 Winds × 4 each, 3 Dragons × 4 each
- 4 Flowers + 4 Seasons (auto-revealed, draw replacement)
- Win by forming 4 sets + 1 pair (14 tiles total)
- Sets can be: Pong (3 same), Chi (3 sequence), Kong (4 same)

## Future Improvements

- [ ] Scoring system
- [ ] Better AI (currently random discards)
- [ ] Sound effects
- [ ] 3D rendering with Three.js
- [ ] Multiplayer

---

Made with 💖 and lots of 🀄
