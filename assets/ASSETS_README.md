# Instinct Fighter — Assets Guide

Drop sprites in the matching folders and audio in /audio/ to upgrade the programmatic graphics.
All sprites: PNG with transparent background. Style: bold black outlines, bright flat colors.

---

## 🎨 SPRITES

### gravity-fool/
| File | Size | What it is |
|------|------|------------|
| bird.png | 64x64 | Flying cartoon bird (one sprite is enough — flip/tint in code) |
| pipe.png | 64x300 | Pipe segment (tileable vertically) |
| pipe_cap.png | 74x28 | Pipe end cap (placed at open end) |
| bg.png | 480x300 | Sky background layer (tileable horizontally) |

### lane-dasher/ & chaos-runner/
| File | Size | What it is |
|------|------|------------|
| runner.png | 60x90 | Cartoon runner character |
| obstacle_block.png | 100x80 | Generic block/wall obstacle |
| bg_far.png | 480x300 | Far background (buildings, etc.) |

### tilt-runner/ & edge-roller/
| File | Size | What it is |
|------|------|------------|
| ball.png | 48x48 | Shiny rolling ball |
| road_tile.png | 120x50 | Road/path segment tile |

### gyro-pilot/
| File | Size | What it is |
|------|------|------------|
| ship.png | 80x36 | Cartoon spaceship/UFO |
| wall.png | 50x200 | Tunnel wall segment (tileable) |

### plate-panic/
| File | Size | What it is |
|------|------|------------|
| plate.png | 220x160 | Flat plate/tray |
| ball.png | 40x40 | Ball sitting on plate |

### reflex-riot/
| File | Size | What it is |
|------|------|------------|
| arrow.png | 80x80 | Single arrow sprite (rotate in code for all 4 directions) |

### target-panic/
| File | Size | What it is |
|------|------|------------|
| target_red.png | 80x80 | Fast target (3pts) |
| target_yellow.png | 80x80 | Medium target (2pts) |
| target_green.png | 80x80 | Slow target (1pt) |
| crosshair.png | 40x40 | Custom cursor/crosshair |

---

## 🔊 AUDIO (drop in /audio/)

| File | What it is |
|------|------------|
| bg_music.mp3 | Looping background music — upbeat, cartoonish, ~2 min loop |
| sfx_jump.wav | Jump / flap sound |
| sfx_hit.wav | Collision / miss sound |
| sfx_score.wav | Point scored |
| sfx_collect.wav | Item collected |
| sfx_flip.wav | Trauma mode control flip |
| sfx_gameover.wav | Game over jingle |
| sfx_click.wav | UI button click |

All audio files automatically replace the Web Audio API sounds when placed here.

---

**Total sprites needed: ~20 images across all games.**
**The game is fully playable without any of these — they are purely visual upgrades.**
