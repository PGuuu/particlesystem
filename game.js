const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const messageEl = document.getElementById("message");

const TILE = 48;
const MAP_WIDTH = 28;
const MAP_HEIGHT = 18;

const palette = {
  grass: "#7bc96f",
  path: "#d8b384",
  water: "#4ea5d9",
  cliff: "#567d46",
  shadow: "rgba(0,0,0,0.2)",
  treeTop: "#2d6a4f",
  treeTrunk: "#8d6e63",
  house: "#c76d5b",
  roof: "#8d4b38",
  sign: "#a97155",
};

const map = Array.from({ length: MAP_HEIGHT }, (_, y) =>
  Array.from({ length: MAP_WIDTH }, (_, x) => {
    if (y < 4) return "water";
    if (y === 4) return "cliff";
    if (x === 6 && y > 6) return "path";
    if (x > 10 && x < 18 && y > 8 && y < 12) return "path";
    return "grass";
  })
);

const obstacles = new Set();

function key(x, y) {
  return `${x},${y}`;
}

const interactables = [];

function addObstacle(x, y, interaction) {
  obstacles.add(key(x, y));
  if (interaction) {
    interactables.push({ x, y, ...interaction });
  }
}

for (let x = 2; x < 6; x += 1) {
  addObstacle(x, 6, null);
}

const trees = [
  { x: 4, y: 9 },
  { x: 5, y: 12 },
  { x: 9, y: 10 },
  { x: 14, y: 7 },
  { x: 20, y: 11 },
];

trees.forEach((tree) => addObstacle(tree.x, tree.y, null));

addObstacle(16, 9, { text: "木牌：北方是海邊，南方是村落。" });
addObstacle(12, 13, { text: "你找到了一個小貝殼！" });

const npc = {
  x: 18,
  y: 10,
  color: "#f4d35e",
  text: "旅行者：這裡的風景像回到童年！",
};
addObstacle(npc.x, npc.y, { text: npc.text });

const house = { x: 10, y: 5 };
addObstacle(house.x, house.y, { text: "小屋裡傳來溫暖的燈光。" });

const player = {
  x: 8,
  y: 11,
  px: 8 * TILE,
  py: 11 * TILE,
  color: "#ff6b6b",
  dir: { x: 0, y: 1 },
  moving: false,
};

const keys = new Set();
let lastMessageTimeout = null;

function showMessage(text) {
  messageEl.textContent = text;
  if (lastMessageTimeout) clearTimeout(lastMessageTimeout);
  lastMessageTimeout = setTimeout(() => {
    if (messageEl.textContent === text) messageEl.textContent = "";
  }, 4000);
}

function inBounds(x, y) {
  return x >= 0 && y >= 0 && x < MAP_WIDTH && y < MAP_HEIGHT;
}

function canMove(x, y) {
  if (!inBounds(x, y)) return false;
  if (map[y][x] === "water" || map[y][x] === "cliff") return false;
  return !obstacles.has(key(x, y));
}

function tryMove(dx, dy) {
  if (player.moving) return;
  const nx = player.x + dx;
  const ny = player.y + dy;
  player.dir = { x: dx, y: dy };
  if (!canMove(nx, ny)) return;
  player.moving = true;
  const targetX = nx * TILE;
  const targetY = ny * TILE;
  const speed = 6;

  function step() {
    const distX = targetX - player.px;
    const distY = targetY - player.py;
    const stepX = Math.sign(distX) * Math.min(Math.abs(distX), speed);
    const stepY = Math.sign(distY) * Math.min(Math.abs(distY), speed);
    player.px += stepX;
    player.py += stepY;
    if (player.px === targetX && player.py === targetY) {
      player.x = nx;
      player.y = ny;
      player.moving = false;
      return;
    }
    requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

function interact() {
  const tx = player.x + player.dir.x;
  const ty = player.y + player.dir.y;
  const target = interactables.find((item) => item.x === tx && item.y === ty);
  if (target) {
    showMessage(target.text);
  } else {
    showMessage("這附近沒有可以互動的東西。");
  }
}

function drawTile(x, y, type) {
  const px = x * TILE;
  const py = y * TILE;
  ctx.fillStyle = palette[type];
  ctx.fillRect(px, py, TILE, TILE);

  if (type === "water") {
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(px, py + TILE * 0.2, TILE, 2);
    ctx.fillRect(px, py + TILE * 0.6, TILE, 2);
  }

  if (type === "cliff") {
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(px, py + TILE * 0.55, TILE, TILE * 0.45);
  }
}

function drawTree(x, y) {
  const px = x * TILE;
  const py = y * TILE;
  ctx.fillStyle = palette.shadow;
  ctx.beginPath();
  ctx.ellipse(px + TILE * 0.5, py + TILE * 0.75, 18, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = palette.treeTrunk;
  ctx.fillRect(px + TILE * 0.4, py + TILE * 0.45, TILE * 0.2, TILE * 0.35);

  ctx.fillStyle = palette.treeTop;
  ctx.beginPath();
  ctx.arc(px + TILE * 0.5, py + TILE * 0.3, TILE * 0.35, 0, Math.PI * 2);
  ctx.fill();
}

function drawHouse() {
  const px = house.x * TILE;
  const py = house.y * TILE;
  ctx.fillStyle = palette.shadow;
  ctx.fillRect(px + 6, py + 20, TILE - 12, TILE - 12);

  ctx.fillStyle = palette.house;
  ctx.fillRect(px + 6, py + 10, TILE - 12, TILE - 12);

  ctx.fillStyle = palette.roof;
  ctx.beginPath();
  ctx.moveTo(px + TILE * 0.1, py + 12);
  ctx.lineTo(px + TILE * 0.5, py - 6);
  ctx.lineTo(px + TILE * 0.9, py + 12);
  ctx.closePath();
  ctx.fill();
}

function drawSign(x, y) {
  const px = x * TILE;
  const py = y * TILE;
  ctx.fillStyle = palette.sign;
  ctx.fillRect(px + 18, py + 12, 12, 22);
  ctx.fillRect(px + 12, py + 6, 24, 10);
}

function drawNPC() {
  const px = npc.x * TILE;
  const py = npc.y * TILE;
  ctx.fillStyle = palette.shadow;
  ctx.beginPath();
  ctx.ellipse(px + TILE * 0.5, py + TILE * 0.75, 16, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = npc.color;
  ctx.beginPath();
  ctx.arc(px + TILE * 0.5, py + TILE * 0.45, 12, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#2b2d42";
  ctx.fillRect(px + TILE * 0.42, py + TILE * 0.65, 8, 12);
}

function drawPlayer() {
  const px = player.px;
  const py = player.py;
  ctx.fillStyle = palette.shadow;
  ctx.beginPath();
  ctx.ellipse(px + TILE * 0.5, py + TILE * 0.78, 16, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = player.color;
  ctx.beginPath();
  ctx.arc(px + TILE * 0.5, py + TILE * 0.45, 12, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#1d3557";
  ctx.fillRect(px + TILE * 0.42, py + TILE * 0.62, 8, 14);
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < MAP_HEIGHT; y += 1) {
    for (let x = 0; x < MAP_WIDTH; x += 1) {
      drawTile(x, y, map[y][x]);
    }
  }

  drawHouse();

  drawSign(16, 9);

  trees.forEach((tree) => drawTree(tree.x, tree.y));

  const sprites = [
    { y: npc.y, draw: drawNPC },
    { y: player.y, draw: drawPlayer },
  ].sort((a, b) => a.y - b.y);

  sprites.forEach((sprite) => sprite.draw());

  requestAnimationFrame(render);
}

window.addEventListener("keydown", (event) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(event.key)) {
    event.preventDefault();
  }

  keys.add(event.key.toLowerCase());

  if (event.key === " ") {
    interact();
  }

  if (keys.has("arrowup") || keys.has("w")) tryMove(0, -1);
  if (keys.has("arrowdown") || keys.has("s")) tryMove(0, 1);
  if (keys.has("arrowleft") || keys.has("a")) tryMove(-1, 0);
  if (keys.has("arrowright") || keys.has("d")) tryMove(1, 0);
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

showMessage("歡迎來到像早期冒險遊戲的世界！");
render();
