// --- CONFIG ---
const ROAD_WIDTH = 40;
const ROAD_LENGTH = 400;
const SPEED_INITIAL = 60; // Faster start
const SPEED_MAX = 250;
const OBSTACLE_INTERVAL_INITIAL = 0.8; // More obstacles (was 1.5)
const JUMP_FORCE = 15;
const GRAVITY = -40;


// --- STATE ---
let gameState = "start"; // start, playing, gameover
let score = 0;
let speed = SPEED_INITIAL;
let lastTime = 0;
let obstacleTimer = 0;
let velocityY = 0;
let isJumping = false;
let groundY = 0.25; // Original Y position of car

// --- DOM ---
const scoreEl = document.getElementById("score");
const speedEl = document.getElementById("speed");
const finalScoreEl = document.getElementById("final-score");
const startScreen = document.getElementById("main-menu");
const gameOverScreen = document.getElementById("game-over-screen");
const scoreBoard = document.getElementById("score-board");
const colorBtns = document.querySelectorAll(".color-btn");
const startBtn = document.getElementById("start-btn");
const retryBtn = document.getElementById("retry-btn");
const menuBtn = document.getElementById("menu-btn");

// --- BRIGHTNESS CONTROL (REMOVED) ---
// Slider removed from HTML


// --- THREE.JS SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xd0e0e3); // Sky Blue/White
scene.fog = new THREE.FogExp2(0xd0e0e3, 0.012);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 4, 12); // Slightly higher/back for F1 view
camera.lookAt(0, 0, -30);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.toneMapping = THREE.ACESFilmicToneMapping; // More realistic tone mapping
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true; // ENABLE SHADOWS
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById("game-container").appendChild(renderer.domElement);

// Post-Processing (REMOVED - Direct Render)
// const composer = new EffectComposer(renderer); ...

// --- LIGHTS ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // Was 0.2
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.5); // White light for realism
dirLight.position.set(50, 50, -20);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 500;
dirLight.shadow.camera.left = -100;
dirLight.shadow.camera.right = 100;
dirLight.shadow.camera.top = 100;
dirLight.shadow.camera.bottom = -100;
scene.add(dirLight);



// --- WORLD ---

// 1. FLOOR (Highway Asphalt)
const roadGeo = new THREE.PlaneGeometry(ROAD_WIDTH, ROAD_LENGTH);
const roadMat = new THREE.MeshStandardMaterial({ 
    color: 0x333333, // Dark Grey Asphalt
    roughness: 0.9,
    metalness: 0.1
});
const road1 = new THREE.Mesh(roadGeo, roadMat);
const road2 = new THREE.Mesh(roadGeo, roadMat);
road1.rotation.x = -Math.PI / 2;
road2.rotation.x = -Math.PI / 2;
road1.position.z = -ROAD_LENGTH / 2;
road2.position.z = -ROAD_LENGTH * 1.5;
road1.receiveShadow = true;
road2.receiveShadow = true;
scene.add(road1);
scene.add(road2);

// Center Lines (Dashed)
// Center Lines (Dashed)
const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
// Remove solid lines attached to road, keep only dashed group

const lines1 = new THREE.Group();
const l1 = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 10), lineMat);
l1.rotation.x = -Math.PI/2; 
// Create dashes
for(let i=0; i<20; i++) {
    const d = l1.clone();
    d.position.z = -i * 20;
    d.position.x = 0; // Center lane
    lines1.add(d);
}
lines1.position.y = 0.05; 
// Attach to road chunks directly
road1.add(lines1);
road2.add(lines1.clone());
// Remove separate scene add and logic
// scene.add(lines1); ...

// Side Barriers (Guardrails)
// Side Barriers (Guardrails) attached to road chunks directly
const barrierMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.5 });
// Remove static scene barriers, keep only moving chunks below

const railChunkL = new THREE.Mesh(new THREE.BoxGeometry(1, 1.5, ROAD_LENGTH), barrierMat);
const railChunkR = new THREE.Mesh(new THREE.BoxGeometry(1, 1.5, ROAD_LENGTH), barrierMat);
railChunkL.position.set(-ROAD_WIDTH/2, 0.75, 0);
railChunkR.position.set(ROAD_WIDTH/2, 0.75, 0);
road1.add(railChunkL); road1.add(railChunkR);
road2.add(railChunkL.clone()); road2.add(railChunkR.clone());

// Remove Grid Helpers
// (deleted code)

// 2. CITY BACKGROUND (Scrolling Buildings on sides)
const buildings = [];
const buildGeo = new THREE.BoxGeometry(4, 1, 4);
const buildMat = new THREE.MeshStandardMaterial({
    color: 0x010110,
    emissive: 0x000033,
    roughness: 0.1
});

// Function to create a building strip
function spawnBuildingStrip(zStart, count) {
    for (let i = 0; i < count; i++) {
        const h = 5 + Math.random() * 15;
        const mesh = new THREE.Mesh(buildGeo, buildMat);
        
        // Randomly Left or Right side of road
        const side = Math.random() > 0.5 ? 1 : -1;
        const xOff = (ROAD_WIDTH/2 + 5 + Math.random() * 10) * side;
        
        mesh.scale.y = h;
        mesh.position.set(xOff, h/2, zStart - i * 20);
        
        // Add neon edge
        const edges = new THREE.EdgesGeometry(buildGeo);
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x00ffff }));
        mesh.add(line);
        
        scene.add(mesh);
        buildings.push(mesh);
    }
}
// Initial Buildings
spawnBuildingStrip(0, 20);

// 3. F1 CAR PLAYER
const player = new THREE.Group();
// Car Paint Material
const carMatBody = new THREE.MeshPhysicalMaterial({ 
    color: 0xff0000, 
    metalness: 0.0, 
    roughness: 0.0, 
    clearcoat: 1.0, 
    clearcoatRoughness: 0.0 
});
const carMatBlack = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 }); 

// Chassis
const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 4), carMatBody);
chassis.position.y = 0.4;
chassis.castShadow = true;
player.add(chassis);

// Cockpit
const cockpit = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 1.2), carMatBlack);
cockpit.position.set(0, 0.7, -0.5);
cockpit.castShadow = true;
player.add(cockpit);

// Front Wing
const fWing = new THREE.Mesh(new THREE.BoxGeometry(3, 0.1, 0.8), carMatBody);
fWing.position.set(0, 0.2, -1.8);
fWing.castShadow = true;
player.add(fWing);

// Rear Wing
const rWing = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 0.8), carMatBody);
rWing.position.set(0, 1.0, 1.6);
rWing.castShadow = true;
player.add(rWing);
// Wing supports
const rWingSup = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, 0.5), carMatBlack);
rWingSup.position.set(0, 0.6, 1.6);
player.add(rWingSup);

// Wheels
const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.4, 16);
wheelGeo.rotateZ(Math.PI / 2);
const w1 = new THREE.Mesh(wheelGeo, carMatBlack); w1.position.set(1.0, 0.4, -1.4); player.add(w1);
const w2 = new THREE.Mesh(wheelGeo, carMatBlack); w2.position.set(-1.0, 0.4, -1.4); player.add(w2);
const w3 = new THREE.Mesh(wheelGeo, carMatBlack); w3.position.set(1.0, 0.4, 1.4); player.add(w3);
const w4 = new THREE.Mesh(wheelGeo, carMatBlack); w4.position.set(-1.0, 0.4, 1.4); player.add(w4);

// Engine Glow (Removed/Dimmed)
const trailGeo = new THREE.BoxGeometry(0.1, 0.1, 2);
const trailMat = new THREE.MeshStandardMaterial({ color: 0x555555 }); // Grey smoke/exhaust, no glow
const t1 = new THREE.Mesh(trailGeo, trailMat); t1.position.set(0.4, 0.4, 2); player.add(t1);
const t2 = new THREE.Mesh(trailGeo, trailMat); t2.position.set(-0.4, 0.4, 2); player.add(t2);

scene.add(player);


// 4. OBSTACLES POOL
const obstacles = [];
// Concrete Barrier shape (approximated)
const obstacleGeo = new THREE.BoxGeometry(4, 2, 1); 
const obstacleMat = new THREE.MeshStandardMaterial({ 
    color: 0xcccccc, // Concrete Grey
    roughness: 0.9,
    metalness: 0.1
});
// Add stripes texture? Procedural stripes:
// We can use a canvas texture or just add a child mesh for stripes.
const stripeGeo = new THREE.PlaneGeometry(0.5, 1.8);
const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 }); // Orange stripe

// --- INPUT ---
let moveLeft = false;
let moveRight = false;

// Menu Logic
colorBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        // Remove selected class
        colorBtns.forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
        
        // Update Car Color
        const hex = parseInt(btn.dataset.color);
        carMatBody.color.setHex(hex);
    });
});

startBtn.addEventListener("click", startGame);

// Game Over Buttons
retryBtn.addEventListener("click", startGame);

menuBtn.addEventListener("click", () => {
    gameOverScreen.classList.remove("active");
    startScreen.classList.add("active"); // Show Main Menu
    gameState = "start";
    
    // Reset car position visually so it's not stuck at obstacle
    player.position.set(0, 0.25, 0); 
    player.rotation.set(0, 0, 0);
    
    // Reset camera reset
    camera.position.set(0, 4, 12);
    camera.lookAt(0, 0, -30);
    
    // Clear obstacles
    for(let ob of obstacles) scene.remove(ob);
    obstacles.length = 0;
});

// Keyboard
window.addEventListener("keydown", (e) => {
    if (gameState === "playing") {
        if (e.code === "ArrowLeft" || e.code === "KeyA") moveLeft = true;
        if (e.code === "ArrowRight" || e.code === "KeyD") moveRight = true;
        
        // Jump
        if (e.code === "Space" && !isJumping) {
            velocityY = JUMP_FORCE;
            isJumping = true;
        }
    } else if (gameState === "gameover" && e.code === "Enter") {
        startGame();
    }
});
window.addEventListener("keyup", (e) => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") moveLeft = false;
    if (e.code === "ArrowRight" || e.code === "KeyD") moveRight = false;
});
window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

// --- LOGIC ---
function startGame() {
    gameState = "playing";
    score = 0;
    speed = SPEED_INITIAL;
    player.position.x = 0;
    player.rotation.z = 0;
    
    for(let ob of obstacles) scene.remove(ob);
    obstacles.length = 0;

    for(let ob of obstacles) scene.remove(ob);
    obstacles.length = 0;

    startScreen.classList.remove("active");
    gameOverScreen.classList.remove("active");
    scoreBoard.style.display = "flex";
    
    lastTime = performance.now();
    requestAnimationFrame(animate);
}

function endGame() {
    gameState = "gameover";
    finalScoreEl.innerText = Math.floor(score);
    scoreBoard.style.display = "none";
    gameOverScreen.classList.add("active");
}

function spawnObstacle() {
    const ob = new THREE.Mesh(obstacleGeo, obstacleMat);
    // Add stripe visual
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.set(0, 0, 0.51); // Front face
    ob.add(stripe);
    const stripeBack = new THREE.Mesh(stripeGeo, stripeMat);
    stripeBack.rotation.y = Math.PI;
    stripeBack.position.set(0, 0, -0.51);
    ob.add(stripeBack);

    ob.castShadow = true;
    const range = ROAD_WIDTH / 2 - 3;
    ob.position.x = (Math.random() * range * 2) - range;
    ob.position.y = 1.0; // Half height
    ob.position.z = -150; 
    scene.add(ob);
    obstacles.push(ob);
}

function animate(time) {
    if (gameState === "start") return;

    if (gameState === "gameover") {
         renderer.render(scene, camera);
         requestAnimationFrame(animate);
         return;
    }

    const dt = Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;

    speed = Math.min(SPEED_MAX, speed + dt * 4); // Ramp speed faster
    score += speed * dt;
    scoreEl.innerText = Math.floor(score);
    speedEl.innerText = Math.floor(speed);

    // Player Move
    const moveSpeed = 45; 
    if (moveLeft) player.position.x -= moveSpeed * dt;
    if (moveRight) player.position.x += moveSpeed * dt;
    const limit = ROAD_WIDTH / 2 - 1.5;
    player.position.x = Math.max(-limit, Math.min(limit, player.position.x));

    // Jump / Physics
    if (isJumping) {
        player.position.y += velocityY * dt;
        velocityY += GRAVITY * dt;

        if (player.position.y <= groundY) {
            player.position.y = groundY;
            isJumping = false;
            velocityY = 0;
            // Particles?
        }
    }

    // Tilt (Disabled)
    player.rotation.z = 0;
    // Pitch when jumping
    if (isJumping) {
         player.rotation.x = THREE.MathUtils.lerp(player.rotation.x, -0.2, dt * 5);
    } else {
         player.rotation.x = THREE.MathUtils.lerp(player.rotation.x, 0, dt * 10);
    }


    // Move World
    const dist = speed * dt;
       
    road1.position.z += dist; road2.position.z += dist;
    if (road1.position.z > ROAD_LENGTH/2) road1.position.z -= ROAD_LENGTH * 2;
    if (road2.position.z > ROAD_LENGTH/2) road2.position.z -= ROAD_LENGTH * 2;
    
    // Dashed lines move with road chunks now.


    // Buildings Loop

    // Buildings Loop
    for (let b of buildings) {
        b.position.z += dist;
        if (b.position.z > 20) {
            // Recycle
            b.position.z = -ROAD_LENGTH + 20;
            // Randomize height again potentially? keeping it simple for perf
        }
    }

    // Obstacles
    obstacleTimer -= dt;
    const interval = Math.max(0.3, OBSTACLE_INTERVAL_INITIAL - (speed / SPEED_MAX)*0.5);
    
    if (obstacleTimer <= 0) {
        spawnObstacle();
        obstacleTimer = interval;
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
        const ob = obstacles[i];
        ob.position.z += dist;

        // Collision detected?
        if (Math.abs(ob.position.z - player.position.z) < 3.5) {
             // Check X
             if (Math.abs(ob.position.x - player.position.x) < 2.5) {
                // Check Y (Jump over!)
                // Obstacle height is 3 (centered at y=1.5). Top is y=3. 
                // Player at ground is y=0.25. 
                // We need to be above ~3 to be safe-ish? Or at least center + extent. 
                // Box height 3 => range [0, 3].
                if (player.position.y < 3.2) {
                    endGame();
                }
             }
        }

        if (ob.position.z > 20) {
            scene.remove(ob);
            obstacles.splice(i, 1);
        }
    }

    // Cam follows
    camera.position.x = player.position.x * 0.4;
    camera.position.y = 5 + (speed/500);

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

// Stop auto-start, wait for menu
renderer.render(scene, camera);
// Animation loop logic handles menu state rendering if we called it, 
// but since we want static until start, we can just render once or loop 
// so the "glitch" effect on title works if it was canvas? 
// No, glitch is CSS.
// We should run animate loop but not update physics if state is start.
requestAnimationFrame(animate);
