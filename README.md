# Age Every Click

A Three.js / React Three Fiber idle-clicker. Click to gain Age, level up, buy Age Machines, spin the Lucky Wheel and rebirth.

## Run

```bash
npm install
npm run dev      # dev server
npm run build    # production build
```

## Level-based player character

The player's character changes automatically as their Age level rises. Levels 0–9 walk through the ten built-in characters in order; from level 9 onward the character stays as the ghost.

| Age level | Age range | Character | Look |
|---|---|---|---|
| 0 | 0 – 4 | `plain` | White figure, jagged white shirt hem, light-blue trousers |
| 1 | 5 – 17 | `striped` | Brown hair, red/white striped V-neck tee, jeans, sneakers |
| 2 | 18 – 29 | `suit` | Swept brown hair, black suit, white shirt, black tie |
| 3 | 30 – 44 | `shades` | Slicked-back hair, aviators, open black jacket, grey jeans |
| 4 | 45 – 69 | `beard` | Messy auburn hair, full beard, white tank top, navy jeans |
| 5 | 70 – 99 | `grandpa` | Bald, grey tufts and beard, argyle vest, tan trousers |
| 6 | 100 – 355 | `elder` | Floor-length white hair and beard, plaid shirt, navy trousers |
| 7 | 356 – 746 | `viking` | Horned helmet, grey beard, chainmail, leather bracers and boots |
| 8 | 747 – 1,264 | `skeleton` | Bare bones: skull, ribcage, spine, pelvis, limb bones |
| 9 and above | 1,265 and up | `ghost` | See-through body, grinning head, black claws, a tail instead of legs |

Notes:

- Age level is the highest Age milestone crossed (see `src/data/progression.js`). Levels 0–6 use hand-picked milestones (0, 5, 18, 30, 45, 70, 100); above that the curve grows smoothly to level 50,000 at 40 billion Age.
- Characters follow the level, not the Age, so changing a milestone in `progression.js` changes the Age at which each character appears.
- A rebirth that resets Age to 0 also returns the player to `plain`.
- Signed-in players with an equipped Bloxity avatar keep their own avatar; it does not change with level.

Where it lives:

- `src/systems/defaultCharacter.js`: builds the characters procedurally on the Bloxity base rig. `LEVEL_OUTFITS` holds the order and `outfitForLevel(level)` returns the outfit for a level.
- `src/components/Player.jsx`: reads the level from the store and rebuilds the character when the outfit changes.
