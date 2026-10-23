const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const batteryFill = document.getElementById("batteryFill");
const batteryText = document.getElementById("batteryText");
const crystalsText = document.getElementById("crystalsText");
const overlayScreen = document.getElementById("overlayScreen");
const overlayTitle = document.getElementById("overlayTitle");
const overlayMessage = document.getElementById("overlayMessage");
const restartBtn = document.getElementById("restartBtn");

let gameState = "playing"; // "playing", "gameover", "victory"

// Player
const player = {
    x: 50,
    y: 340,
    width: 24,
    height: 32,
    vx: 0,
    vy: 0,
    speed: 3.5,
    jumpPower: -8.8,
    isGrounded: false,
    battery: 100,
    maxBattery: 100,
    collectedCrystals: 0,
    facingRight: true
};

// Controls
const keys = {
    left: false,
    right: false,
    up: false
};

// Platforms
const platforms = [
    { x: 0, y: 410, w: 260, h: 40 },
    { x: 290, y: 350, w: 120, h: 20 },
    { x: 170, y: 280, w: 100, h: 20 },
    { x: 320, y: 220, w: 140, h: 20 },
    { x: 500, y: 270, w: 130, h: 20 },
    { x: 670, y: 200, w: 130, h: 20 },
    { x: 540, y: 140, w: 100, h: 20 },
    { x: 670, y: 410, w: 130, h: 40 }
];

// Crystals (+15 energy each)
let crystals = [
    { x: 215, y: 250, collected: false },
    { x: 380, y: 190, collected: false },
    { x: 585, y: 110, collected: false },
    { x: 730, y: 170, collected: false }
];

// Recharging Exit Portal
const portal = {
    x: 720,
    y: 340,
    w: 44,
    h: 70
};

// Ambient particles
const particles = [];
for (let i = 0; i < 40; i++) {
    particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 2 + 0.5,
        speedY: -(Math.random() * 0.4 + 0.1),
        alpha: Math.random() * 0.7 + 0.3
    });
}

function initGame() {
    player.x = 50;
    player.y = 340;
    player.vx = 0;
    player.vy = 0;
    player.battery = 100;
    player.collectedCrystals = 0;
    gameState = "playing";

    crystals.forEach(c => c.collected = false);
    overlayScreen.classList.add("hidden");
    updateHUD();
}

function updateHUD() {
    const b = Math.max(0, Math.min(100, Math.round(player.battery)));
    batteryFill.style.width = `${b}%`;
    batteryText.textContent = `${b}%`;
    if (b <= 25) {
        batteryFill.classList.add("low");
    } else {
        batteryFill.classList.remove("low");
    }

    crystalsText.textContent = `${player.collectedCrystals} / ${crystals.length}`;
}

// Input handling
window.addEventListener("keydown", (e) => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = true;
    if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = true;
    if (e.code === "ArrowUp" || e.code === "KeyW" || e.code === "Space") {
        keys.up = true;
        if (gameState === "playing" && player.isGrounded) {
            player.vy = player.jumpPower;
            player.isGrounded = false;
            player.battery -= 1.0; // Jump consumes extra 1%
        }
    }
    if (e.code === "KeyR") {
        initGame();
    }
});

window.addEventListener("keyup", (e) => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = false;
    if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = false;
    if (e.code === "ArrowUp" || e.code === "KeyW" || e.code === "Space") keys.up = false;
});

restartBtn.addEventListener("click", initGame);

// Update loop
let lastTime = performance.now();

function update(dt) {
    if (gameState !== "playing") return;

    // Battery drain (2% per second when moving, 0.2% passive idle)
    let isMoving = false;
    if (keys.left) {
        player.vx = -player.speed;
        player.facingRight = false;
        isMoving = true;
    } else if (keys.right) {
        player.vx = player.speed;
        player.facingRight = true;
        isMoving = true;
    } else {
        player.vx *= 0.75;
    }

    const drainRate = isMoving ? 2.0 : 0.25;
    player.battery -= drainRate * dt;

    if (player.battery <= 0) {
        player.battery = 0;
        gameOver("Заряд акумулятора вичерпано. Робот вимкнувся серед руїн.");
        return;
    }

    // Gravity
    player.vy += 0.38;

    // Horizontal move & collision
    player.x += player.vx;
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;

    // Vertical move & collision
    player.y += player.vy;
    player.isGrounded = false;

    platforms.forEach(p => {
        if (player.x + player.width > p.x && player.x < p.x + p.w) {
            // Landing on platform from above
            if (player.vy >= 0 && player.y + player.height >= p.y && player.y + player.height <= p.y + 16) {
                player.y = p.y - player.height;
                player.vy = 0;
                player.isGrounded = true;
            }
        }
    });

    // Fall into abyss
    if (player.y > canvas.height) {
        gameOver("Робот упав у прірву підземного саду.");
        return;
    }

    // Crystals pickup
    crystals.forEach(c => {
        if (!c.collected) {
            const dx = (player.x + player.width / 2) - c.x;
            const dy = (player.y + player.height / 2) - c.y;
            if (Math.hypot(dx, dy) < 24) {
                c.collected = true;
                player.collectedCrystals++;
                player.battery = Math.min(player.maxBattery, player.battery + 15);
            }
        }
    });

    // Portal check
    const portalCenter = portal.x + portal.w / 2;
    if (Math.abs((player.x + player.width / 2) - portalCenter) < 30 &&
        player.y + player.height > portal.y && player.y < portal.y + portal.h) {
        if (player.collectedCrystals >= 3) {
            victory();
        }
    }

    updateHUD();
}

function gameOver(reason) {
    gameState = "gameover";
    overlayTitle.textContent = "Місію провалено";
    overlayMessage.textContent = reason;
    overlayScreen.classList.remove("hidden");
}

function victory() {
    gameState = "victory";
    overlayTitle.textContent = "Рівень пройдено!";
    overlayMessage.textContent = `Робот дістався до зарядної станції! Зібрано кристалів: ${player.collectedCrystals} / ${crystals.length}, залишок батареї: ${Math.round(player.battery)}%.`;
    overlayScreen.classList.remove("hidden");
}

// Render loop
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bgGrad.addColorStop(0, "#080f18");
    bgGrad.addColorStop(1, "#03060a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Distant ruins arches
    ctx.strokeStyle = "rgba(40, 70, 75, 0.35)";
    ctx.lineWidth = 3;
    for (let x = 80; x < canvas.width; x += 220) {
        ctx.beginPath();
        ctx.arc(x, 260, 60, Math.PI, 0);
        ctx.stroke();
    }

    // Floating particles
    particles.forEach(p => {
        p.y += p.speedY;
        if (p.y < 0) p.y = canvas.height;
        ctx.fillStyle = `rgba(88, 225, 235, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
    });

    // Platforms
    platforms.forEach(p => {
        // Stone body
        ctx.fillStyle = "#1e2836";
        ctx.fillRect(p.x, p.y, p.w, p.h);

        // Moss top
        ctx.fillStyle = "#2ea043";
        ctx.fillRect(p.x, p.y, p.w, 5);

        // Stone outline
        ctx.strokeStyle = "#38495f";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(p.x, p.y, p.w, p.h);
    });

    // Portal
    ctx.save();
    ctx.fillStyle = player.collectedCrystals >= 3 ? "rgba(46, 204, 113, 0.25)" : "rgba(100, 100, 100, 0.15)";
    ctx.fillRect(portal.x, portal.y, portal.w, portal.h);
    ctx.strokeStyle = player.collectedCrystals >= 3 ? "#2ecc71" : "#7f8c8d";
    ctx.lineWidth = 2;
    ctx.strokeRect(portal.x, portal.y, portal.w, portal.h);

    ctx.fillStyle = player.collectedCrystals >= 3 ? "#2ecc71" : "#95a5a6";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("ШЛЮЗ", portal.x + portal.w / 2, portal.y - 8);
    ctx.restore();

    // Crystals
    const time = performance.now() * 0.003;
    crystals.forEach((c, idx) => {
        if (!c.collected) {
            const floatY = c.y + Math.sin(time + idx) * 4;

            ctx.save();
            ctx.shadowColor = "#00f2fe";
            ctx.shadowBlur = 12;
            ctx.fillStyle = "#4facfe";

            ctx.beginPath();
            ctx.moveTo(c.x, floatY - 10);
            ctx.lineTo(c.x + 7, floatY);
            ctx.lineTo(c.x, floatY + 10);
            ctx.lineTo(c.x - 7, floatY);
            ctx.closePath();
            ctx.fill();

            // Inner light
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.arc(c.x, floatY, 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    });

    // Player (Robot Spark)
    ctx.save();
    const px = player.x;
    const py = player.y;

    // Body
    ctx.fillStyle = "#2c3e50";
    ctx.beginPath();
    ctx.roundRect(px + 2, py + 6, player.width - 4, player.height - 10, 5);
    ctx.fill();
    ctx.strokeStyle = "#58a6ff";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Screen face
    ctx.fillStyle = "#0d1117";
    ctx.fillRect(px + 5, py + 9, player.width - 10, 10);

    // Glowing eyes
    ctx.fillStyle = player.battery > 25 ? "#39d353" : "#f85149";
    const eyeOffsetX = player.facingRight ? 2 : -2;
    ctx.fillRect(px + 8 + eyeOffsetX, py + 12, 3, 4);
    ctx.fillRect(px + 14 + eyeOffsetX, py + 12, 3, 4);

    // Antenna
    ctx.strokeStyle = "#58a6ff";
    ctx.beginPath();
    ctx.moveTo(px + player.width / 2, py + 6);
    ctx.lineTo(px + player.width / 2, py + 1);
    ctx.stroke();
    ctx.fillStyle = "#388bfd";
    ctx.beginPath();
    ctx.arc(px + player.width / 2, py + 1, 2, 0, Math.PI * 2);
    ctx.fill();

    // Wheels / legs
    ctx.fillStyle = "#161b22";
    ctx.fillRect(px + 4, py + player.height - 4, 6, 4);
    ctx.fillRect(px + player.width - 10, py + player.height - 4, 6, 4);
    ctx.restore();
}

function gameLoop(now) {
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    update(Math.min(dt, 0.1));
    draw();
    requestAnimationFrame(gameLoop);
}

initGame();
requestAnimationFrame(gameLoop);
