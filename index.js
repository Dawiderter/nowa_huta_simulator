import map from "./map.js";

// Map preprocessing

for (let row of map) {
  for (let i = 0; i < row.length; i++) {
    if (row[i] == 1) {
      const f = Math.random();
      if (f <= 0.1) {
        row[i] = 2;
        continue;
      }
      if (f <= 0.2) {
        row[i] = 3;
        continue;
      }
      if (f <= 0.25) {
        row[i] = 4;
        continue;
      }
    }
  }
}

function findLineSegmentIntersection(p1, p2, p3, p4) {
  // Odcinek 1: od p1 do p2
  // Odcinek 2: od p3 do p4
  // Punkty: {x, y}

  const x1 = p1.x,
    y1 = p1.y;
  const x2 = p2.x,
    y2 = p2.y;
  const x3 = p3.x,
    y3 = p3.y;
  const x4 = p4.x,
    y4 = p4.y;

  // Oblicz mianownik
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);

  // Jeśli mianownik = 0, odcinki są równoległe
  if (Math.abs(denom) < 1e-10) {
    return null;
  }

  // Oblicz parametry t i u
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

  // Sprawdź czy przecięcie jest w obrębie obu odcinków
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      x: x1 + t * (x2 - x1),
      y: y1 + t * (y2 - y1),
      t: t, // parametr dla pierwszego odcinka
      u: u, // parametr dla drugiego odcinka
    };
  }

  // Odcinki się nie przecinają
  return null;
}

function isColliding(x, y, radius) {
  for (let dx of [-radius,0.0,radius]) {
    for (let dy of [-radius,0.0,radius]) {
      const mapX = Math.floor(x + dx);
      const mapY = Math.floor(y + dy);

      const wallType = map[mapY][mapX];

      if (wallType != 0) {
        return true;
      }
    }  
  }

  return false;
}

function hasLineOfSight(fromX, fromY, toX, toY) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  const steps = Math.ceil(distance * 10); // Check every 0.1 units
  const stepX = dx / steps;
  const stepY = dy / steps;
  
  for (let i = 0; i <= steps; i++) {
    const checkX = fromX + stepX * i;
    const checkY = fromY + stepY * i;
    
    const mapX = Math.floor(checkX);
    const mapY = Math.floor(checkY);
    
    // Check bounds
    if (mapY < 0 || mapY >= map.length || mapX < 0 || mapX >= map[mapY].length) {
      return false;
    }
    
    // If we hit a wall, no line of sight
    if (map[mapY][mapX] === 1) {
      return false;
    }
  }
  
  return true;
}

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const pixel_width = 160;
const pixel_height = 120;

canvas.width = pixel_width;
canvas.height = pixel_height;

const framebuffer = ctx.createImageData(pixel_width, pixel_height);

const textureCanvas = document.createElement("canvas");
let textureBuffer = new ImageData(1, 1);
const textureImage = new Image();
textureImage.src = "t_map.png";

const tileWidth = 16;
const tileHeight = 16;

textureImage.onload = function () {
  textureCanvas.width = textureImage.width;
  textureCanvas.height = textureImage.height;
  const ctx = textureCanvas.getContext("2d");
  ctx.drawImage(textureImage, 0, 0);
  textureBuffer = ctx.getImageData(
    0,
    0,
    textureImage.width,
    textureImage.height
  );
};

function clearBuffer(buffer, r, g, b) {
  const length = buffer.width * buffer.height;
  for (let i = 0; i < length; i++) {
    buffer.data[4 * i] = r;
    buffer.data[4 * i + 1] = g;
    buffer.data[4 * i + 2] = b;
    buffer.data[4 * i + 3] = 255;
  }
}

function drawPixel(buffer, x, y, r, g, b) {
  const i = (x + buffer.width * y) * 4;
  buffer.data[i] = r;
  buffer.data[i + 1] = g;
  buffer.data[i + 2] = b;
  buffer.data[i + 3] = 255;
}

// Player
const player = {
  x: 21,
  y: 53,
  angle: Math.PI / 2,
  fov: Math.PI / 2,
  speed: 0.03,
  rotSpeed: 0.01,
};

// Game state
let gameState = {
  isAlive: true,
  hasWon: false,
  deathMessage: "",
  winMessage: "Uciekłeś z labiryntu!",
  killDistance: 0.8 // Distance at which sprites kill the player
};

const sprites = [
  { 
    x: 8, 
    y: 55, 
    size: 1.0, 
    textureId: 0,
    type: 'follower',
    speed: 0.02,
    detectionRange: 20,
    hasLineOfSight: false,
    lastPlayerPos: { x: 8, y: 55 }
  },
  { 
    x: 15, 
    y: 20, 
    size: 1.0, 
    textureId: 0,
    type: 'follower',
    speed: 0.015,
    detectionRange: 20,
    hasLineOfSight: false,
    lastPlayerPos: { x: 15, y: 20 }
  },
  { 
    x: 40, 
    y: 35, 
    size: 1.0, 
    textureId: 0,
    type: 'follower',
    speed: 0.025,
    detectionRange: 20,
    hasLineOfSight: false,
    lastPlayerPos: { x: 40, y: 35 }
  }
];

// Define sprite texture coordinates in your texture image
const spriteTextures = {
  0: { x: 8, y: 0, width: 8, height: 8 }, // Second tile in texture
};

// Input
const keys = {};

document.addEventListener("keydown", (e) => {
  keys[e.key.toLowerCase()] = true;
  
  // Handle restart for both death and win
  if (e.key.toLowerCase() === 'r' && !gameState.isAlive) {
    restartGame();
  }
});
document.addEventListener("keyup", (e) => (keys[e.key.toLowerCase()] = false));

function castRay(angle) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);

  let t = 0;
  const step = 0.01;

  const rox = player.x;
  const roy = player.y;

  while (t < 40) {
    const x = rox + dx * t;
    const y = roy + dy * t;

    const mapX = Math.floor(x);
    const mapY = Math.floor(y);

    if (
      mapY >= 0 &&
      mapY < map.length &&
      mapX >= 0 &&
      mapX < map[mapY].length &&
      map[mapY][mapX] != 0
    ) {
      const ps = [
        { x: mapX, y: mapY },
        { x: mapX + 1, y: mapY },
        { x: mapX + 1, y: mapY + 1 },
        { x: mapX, y: mapY + 1 },
      ];

      const sides = [
        [ps[0], ps[1]],
        [ps[1], ps[2]],
        [ps[2], ps[3]],
        [ps[3], ps[0]],
      ];

      for (const side of sides) {
        const intersection = findLineSegmentIntersection(
          { x: rox, y: roy },
          { x, y },
          side[0],
          side[1]
        );
        if (intersection) {
          const x = intersection.x;
          const y = intersection.y;
          const dist = Math.sqrt((rox - x) * (rox - x) + (roy - y) * (roy - y));
          return { dist: dist , wallType: map[mapY][mapX], side: intersection.u };
        }
      }
    }
    t += step;
  }
  return { dist: 20, wallType: 0, side: 0 };
}

function drawWall(x, dist, height, wallType, side) {
  height = Math.round(height);
  height = height + (height % 2);

  const darken = 1 / (1 + dist * dist * dist * 0.05);

  const t_x = (wallType-1) * tileWidth + Math.floor(side * tileWidth);

  for (let i = 0; i < height; i++) {
    const y = Math.round(i + pixel_height / 2 - height / 2);

    const t_y = Math.floor((i / height) * tileHeight);

    const j = Math.min(
      4 * (t_x + textureBuffer.width * t_y),
      textureBuffer.data.length
    );

    const r = textureBuffer.data[j] * darken;
    const g = textureBuffer.data[j + 1] * darken;
    const b = textureBuffer.data[j + 2] * darken;

    drawPixel(framebuffer,x,y,r,g,b);
  }
}

function drawSprite(sprite) {
  // Calculate relative position to player
  const dx = sprite.x - player.x;
  const dy = sprite.y - player.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Skip if too far or too close
  if (distance < 0.1 || distance > 40) return;

  // Calculate angle to sprite
  const angleToSprite = Math.atan2(dy, dx);
  const relativeAngle = angleToSprite - player.angle;

  // Normalize angle
  let angle = relativeAngle;
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;

  // Skip if outside FOV
  if (Math.abs(angle) > player.fov / 2) return;

  // Calculate screen position
  const screenX = (angle / player.fov + 0.5) * pixel_width;

  // Calculate sprite size
  const spriteHeight = (pixel_height / distance) * 0.6;
  const spriteWidth = spriteHeight;

  // Draw textured sprite
  const startX = Math.floor(screenX - spriteWidth / 2);
  const endX = Math.floor(screenX + spriteWidth / 2);
  const startY = Math.floor(pixel_height / 2 - spriteHeight / 2);
  const endY = Math.floor(pixel_height / 2 + spriteHeight / 2);

  // Get sprite texture info
  const spriteTexture = spriteTextures[sprite.textureId];
  if (!spriteTexture) return;

  // Brightness based on distance
  const darken = 1 / (1 + distance * distance * distance * 0.02);

  for (let x = Math.max(0, startX); x < Math.min(pixel_width, endX); x++) {
    // Cast ray for this column to check if wall is closer
    const rayAngle =
      player.angle - player.fov / 2 + (x / pixel_width) * player.fov;
    const { dist: wallDist } = castRay(rayAngle);

    // Only draw sprite pixels if sprite is closer than the wall
    if (distance > wallDist) continue;

    // Calculate texture X coordinate
    const textureX = Math.floor(
      ((x - startX) / spriteWidth) * spriteTexture.width
    );

    for (let y = Math.max(0, startY); y < Math.min(pixel_height, endY); y++) {
      // Calculate texture Y coordinate
      const textureY = Math.floor(
        ((y - startY) / spriteHeight) * spriteTexture.height
      );

      // Get pixel from texture
      const texX = spriteTexture.x + textureX;
      const texY = spriteTexture.y + textureY;
      const texIndex = (texX + textureBuffer.width * texY) * 4;

      // Check bounds to prevent crashes
      if (texIndex < 0 || texIndex >= textureBuffer.data.length - 3) continue;

      // Get color from texture
      const r = textureBuffer.data[texIndex];
      const g = textureBuffer.data[texIndex + 1];
      const b = textureBuffer.data[texIndex + 2];

      // Skip transparent/black pixels
      if (r < 10 && g < 10 && b < 10) continue;

      // Apply distance-based darkening
      let finalR = r * darken;
      let finalG = g * darken;
      let finalB = b * darken;

      drawPixel(framebuffer, x, y, finalR, finalG, finalB);
    }
  }
}

function drawDeathScreen() {
  // Fill screen with dark red
  clearBuffer(framebuffer, 50, 0, 0);
  
  // Put the image data to show the death screen
  ctx.putImageData(framebuffer, 0, 0);
  
  // Draw text overlay using canvas context
  ctx.fillStyle = 'white';
  ctx.font = '8px monospace';
  ctx.textAlign = 'center';
  
  // Death message
  ctx.fillText(gameState.deathMessage, canvas.width / 2, canvas.height / 2 - 20);
  ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2);
  ctx.fillText('R - restart', canvas.width / 2, canvas.height / 2 + 20);
}

function drawWinScreen() {
  // Fill screen with golden yellow
  clearBuffer(framebuffer, 100, 200, 0);
  
  // Put the image data to show the win screen
  ctx.putImageData(framebuffer, 0, 0);
  
  // Draw text overlay using canvas context
  ctx.fillStyle = 'white';
  ctx.font = '8px monospace';
  ctx.textAlign = 'center';
  
  // Win message
  ctx.fillText(gameState.winMessage, canvas.width / 2, canvas.height / 2 - 20);
  ctx.fillText('YOU WIN!', canvas.width / 2, canvas.height / 2);
  ctx.fillText('R - restart', canvas.width / 2, canvas.height / 2 + 20);
}

function render() {
  if (!gameState.isAlive) {
    if (gameState.hasWon) {
      drawWinScreen();
    } else {
      drawDeathScreen();
    }
    return;
  }

  // Clear with floor and ceiling
  clearBuffer(framebuffer, 0, 0, 0);

  // Cast rays
  const numRays = pixel_width;

  for (let i = 0; i < numRays; i++) {
    const rayAngle = player.angle - player.fov / 2 + (i / numRays) * player.fov;
    const { dist, wallType, side } = castRay(rayAngle);

    if (dist == 0.0) {
      continue;
    }

    const correctedDist = dist * Math.cos(rayAngle - player.angle);

    const wallHeight = (canvas.height / correctedDist)*3;

    drawWall(i, dist, wallHeight, wallType, side);
  }

  // Draw sprites after walls
  for (const sprite of sprites) {
    drawSprite(sprite);
  }

  ctx.putImageData(framebuffer, 0, 0);
}

function checkWinCondition() {
  const mapX = Math.floor(player.x);
  const mapY = Math.floor(player.y);
  
  // Check if player is at the map boundaries where there are exits (value 0)
  // Check bounds first to avoid array access errors
  if (mapY < 0 || mapY >= map.length || mapX < 0 || mapX >= map[0].length) {
    // Player is outside the map boundaries - they escaped!
    gameState.hasWon = true;
    gameState.isAlive = false; // Stop normal gameplay
    return;
  }
  
  // Check if player is at map edge positions that are exits (0)
  if ((mapY === 0 || mapY === map.length - 1 || mapX === 0 || mapX === map[0].length - 1) 
      && map[mapY][mapX] === 0) {
    gameState.hasWon = true;
    gameState.isAlive = false; // Stop normal gameplay
  }
}

function updateSprites() {
  for (let sprite of sprites) {
    if (sprite.type === 'follower') {
      // Calculate distance to player
      const dx = player.x - sprite.x;
      const dy = player.y - sprite.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Check if sprite caught the player
      if (distance <= gameState.killDistance) {
        gameState.isAlive = false;
        gameState.deathMessage = "Zostałeś złapany!";
        return; // Stop updating sprites
      }
      
      // Check if player is within detection range
      if (distance <= sprite.detectionRange) {
        // Check line of sight
        sprite.hasLineOfSight = hasLineOfSight(sprite.x, sprite.y, player.x, player.y);
        
        if (sprite.hasLineOfSight) {
          // Update last known player position
          sprite.lastPlayerPos.x = player.x;
          sprite.lastPlayerPos.y = player.y;
        }
      } else {
        sprite.hasLineOfSight = false;
      }
      
      // Move towards target (current player position if line of sight, or last known position)
      let targetX, targetY;
      if (sprite.hasLineOfSight) {
        targetX = player.x;
        targetY = player.y;
      } 
      // else {
      //   targetX = sprite.lastPlayerPos.x;
      //   targetY = sprite.lastPlayerPos.y;
      // }
      
      // Calculate movement direction
      const moveX = targetX - sprite.x;
      const moveY = targetY - sprite.y;
      const moveDistance = Math.sqrt(moveX * moveX + moveY * moveY);
      
      // Only move if we have a target and we're not too close
      if (moveDistance > 0.5 && (sprite.hasLineOfSight || moveDistance > 0.1)) {
        // Normalize movement vector
        const normalizedX = (moveX / moveDistance) * sprite.speed;
        const normalizedY = (moveY / moveDistance) * sprite.speed;
        
        // Calculate new position
        const newX = sprite.x + normalizedX;
        const newY = sprite.y + normalizedY;
        
        // Check for collisions before moving
        if (!isColliding(newX, newY, 0.2)) {
          sprite.x = newX;
          sprite.y = newY;
        }
      }
    }
  }
}

function restartGame() {
  // Reset game state
  gameState.isAlive = true;
  gameState.hasWon = false;
  gameState.deathMessage = "";
  
  // Reset player position
  player.x = 21;
  player.y = 53;
  player.angle = Math.PI / 2;
  
  // Reset all sprites to their original positions
  sprites[0].x = 8;
  sprites[0].y = 55;
  sprites[0].hasLineOfSight = false;
  sprites[0].lastPlayerPos = { x: 8, y: 55 };
  
  sprites[1].x = 15;
  sprites[1].y = 20;
  sprites[1].hasLineOfSight = false;
  sprites[1].lastPlayerPos = { x: 15, y: 20 };
  
  sprites[2].x = 40;
  sprites[2].y = 35;
  sprites[2].hasLineOfSight = false;
  sprites[2].lastPlayerPos = { x: 40, y: 35 };
}

function update() {
  // Don't update if player is dead
  if (!gameState.isAlive) return;

  // Update sprites
  updateSprites();

  // Keyboard rotation
  let moveAngle = 0;
  if (keys["arrowleft"] || keys["q"]) {
    moveAngle -= 1;
  }
  if (keys["arrowright"] || keys["e"]) {
    moveAngle += 1;
  }
  if (moveAngle != 0) {
    player.angle += moveAngle * player.rotSpeed;
  }

  // Movement
  let moveX = 0,
    moveY = 0;

  if (keys["w"] || keys["arrowup"]) {
    moveY += 1;
  }
  if (keys["s"] || keys["arrowdown"]) {
    moveY -= 1;
  }
  if (keys["a"]) {
    moveX -= 1;
  }
  if (keys["d"]) {
    moveX += 1;
  }

  if (moveX == 0 && moveY == 0) {
    return;
  }

  const mag = Math.sqrt(moveX * moveX + moveY * moveY);

  // Scale
  moveX = (moveX / mag) * player.speed;
  moveY = (moveY / mag) * player.speed;

  // Rotate
  [moveX, moveY] = [
    Math.cos(player.angle) * moveY - Math.sin(player.angle) * moveX,
    Math.cos(player.angle) * moveX + Math.sin(player.angle) * moveY,
  ];

  const newX = player.x + moveX;
  const newY = player.y + moveY;

  if (!isColliding(newX, newY, 0.3)) {
    player.x = newX;
    player.y = newY;
  }

  // Check if player has escaped the labyrinth
  checkWinCondition();
}

function gameLoop() {
  update();
  render();
  requestAnimationFrame(gameLoop);
}

gameLoop();
