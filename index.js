function findLineSegmentIntersection(p1, p2, p3, p4) {
  // Odcinek 1: od p1 do p2
  // Odcinek 2: od p3 do p4
  // Punkty: {x, y}
  
  const x1 = p1.x, y1 = p1.y;
  const x2 = p2.x, y2 = p2.y;
  const x3 = p3.x, y3 = p3.y;
  const x4 = p4.x, y4 = p4.y;
  
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
      t: t,  // parametr dla pierwszego odcinka
      u: u   // parametr dla drugiego odcinka
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
let textureBuffer = new ImageData(1,1);
const textureImage = new Image();
textureImage.src = "t_map.png";

const tileWidth = 16;
const tileHeight = 16;

const wallScale = 2;

textureImage.onload = function () {
    textureCanvas.width = textureImage.width;
    textureCanvas.height = textureImage.height;
    const ctx = textureCanvas.getContext("2d");
    ctx.drawImage(textureImage,0,0);
    textureBuffer = ctx.getImageData(0,0,textureImage.width,textureImage.height);
}

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

// Map (1 = wall, 0 = empty)
const map = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0, 0, 1],
    [1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
    [1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
    [1, 0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
    [1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
    [1, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

// Player
const player = {
    x: 2.5,
    y: 2.5,
    angle: 0,
    fov: Math.PI / 3,
    speed: 0.02,
    rotSpeed: 0.015,
};

// Input
const keys = {};
let mouseX = 0;

document.addEventListener(
    "keydown",
    (e) => (keys[e.key.toLowerCase()] = true)
);
document.addEventListener(
    "keyup",
    (e) => (keys[e.key.toLowerCase()] = false)
);

// Wall colors
const wallColors = ["#8B4513", "#A0522D", "#654321", "#D2691E"];

function castRay(angle) {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);

    let t = 0;
    const step = 0.01;

    const rox = player.x / wallScale;
    const roy = player.y / wallScale;

    while (t < 20) {
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
                { x: mapX + 1, y: mapY},
                { x: mapX + 1, y: mapY + 1},
                { x: mapX, y: mapY + 1},
            ];

            const sides = [
                [ps[0], ps[1]],
                [ps[1], ps[2]],
                [ps[2], ps[3]],
                [ps[3], ps[0]],
            ]

            for (const side of sides) {
                const intersection = findLineSegmentIntersection({x: rox, y: roy}, { x, y }, side[0], side[1]);
                if (intersection) {
                    const x = intersection.x;
                    const y = intersection.y;
                    const dist = Math.sqrt((rox-x)*(rox-x)+(roy-y)*(roy-y));
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
    height = height + height % 2;

    const color = wallColors[wallType];
    const darken = 1 / (1 + dist*dist);

    const t_x = Math.floor(side * tileWidth); 

    for (let i = 0; i < height; i++) {
        const t_y = Math.floor(i / height * tileHeight);

        const j = Math.min(4 * (t_x + textureBuffer.width * t_y), textureBuffer.data.length);

        const r = textureBuffer.data[j] * darken;
        const g = textureBuffer.data[j + 1] * darken;
        const b = textureBuffer.data[j + 2] * darken;

        drawPixel(
            framebuffer, 
            x, 
            Math.round(i + pixel_height / 2 - height / 2), 
            r, g, b
        )
    }
}

function render() {
    // Clear with floor and ceiling
    clearBuffer(framebuffer, 0, 0, 0)

    // Cast rays
    const numRays = pixel_width;

    for (let i = 0; i < numRays; i++) {
        const rayAngle =
            player.angle - player.fov / 2 + (i / numRays) * player.fov;
        const { dist, wallType, side } = castRay(rayAngle);

        if (dist == 0.0) {
            continue;
        }
        
        const correctedDist = dist * Math.cos(rayAngle - player.angle);

        const wallHeight = (canvas.height / correctedDist) * 0.6;

        drawWall(i, dist, wallHeight, wallType, side);
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
    let moveX = 0, moveY = 0;

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

    const mag = Math.sqrt(moveX*moveX + moveY*moveY);

    // Scale
    moveX = moveX / mag * player.speed;
    moveY = moveY / mag * player.speed;

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
