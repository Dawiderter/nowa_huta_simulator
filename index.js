import map from "./map.js";
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

const tileWidth = 8;
const tileHeight = 8;

const wallScale = 1;

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
  x: 21 * wallScale,
  y: 53 * wallScale,
  angle: Math.PI / 2,
  fov: Math.PI / 3,
  speed: 0.03 * wallScale,
  rotSpeed: 0.015,
};

const sprites = [{ x: 8, y: 55, size: 1.0, textureId: 0 }];

// Define sprite texture coordinates in your texture image
const spriteTextures = {
  0: { x: 8, y: 0, width: 8, height: 8 }, // Second tile in texture
};

// Input
const keys = {};
let mouseX = 0;

document.addEventListener("keydown", (e) => (keys[e.key.toLowerCase()] = true));
document.addEventListener("keyup", (e) => (keys[e.key.toLowerCase()] = false));

// Wall colors
const wallColors = ["#8B4513", "#A0522D", "#654321", "#D2691E"];

function castRay(angle) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);

  let t = 0;
  const step = 0.01 * wallScale;

  const rox = player.x / wallScale;
  const roy = player.y / wallScale;

  while (t < 20 * wallScale) {
    const x = rox + dx * t;
    const y = roy + dy * t;

    const mapX = Math.floor(x);
    const mapY = Math.floor(y);

    if (
      mapY >= 0 &&
      mapY < map.length &&
      mapX >= 0 &&
      mapX < map[mapY].length &&
      map[mapY][mapX] === 1
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
          return { dist: dist / wallScale, wallType: 0, side: intersection.u };
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

  const darken = 1 / (1 + dist * dist);

  const t_x = Math.floor(side * tileWidth);

  for (let i = 0; i < height; i++) {
    const t_y = Math.floor((i / height) * tileHeight);

    const j = Math.min(
      4 * (t_x + textureBuffer.width * t_y),
      textureBuffer.data.length
    );

    const r = textureBuffer.data[j] * darken;
    const g = textureBuffer.data[j + 1] * darken;
    const b = textureBuffer.data[j + 2] * darken;

    drawPixel(
      framebuffer,
      x,
      Math.round(i + pixel_height / 2 - height / 2),
      r,
      g,
      b
    );
  }
}

function drawSprite(sprite) {
  // Calculate relative position to player
  const dx = sprite.x - player.x / wallScale;
  const dy = sprite.y - player.y / wallScale;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Skip if too far or too close
  if (distance < 0.1 || distance > 10) return;

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
  const darken = Math.max(0.1, 1 / (1 + distance * distance * 0.1));

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
      const finalR = r * darken;
      const finalG = g * darken;
      const finalB = b * darken;

      drawPixel(framebuffer, x, y, finalR, finalG, finalB);
    }
  }
}

function render() {
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

    const wallHeight = (canvas.height / correctedDist) * 0.6;

    drawWall(i, dist, wallHeight, wallType, side);
  }

  // Draw sprites after walls
  for (const sprite of sprites) {
    drawSprite(sprite);
  }

  ctx.putImageData(framebuffer, 0, 0);
}

function update() {
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
    return;
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

  player.x = newX;
  player.y = newY;
}

function gameLoop() {
  update();
  render();
  requestAnimationFrame(gameLoop);
}

gameLoop();
