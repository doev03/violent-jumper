const STORAGE_KEYS = {
    scores: "neon_ladder_scores",
    config: "neon_ladder_config",
};
const DEFAULT_CONFIG = {
    physics: {
        gravity: 14,
    },
    throwing: {
        speed: 9.5,
        cooldown: 0.2,
    },
    platform: {
        count: 12,
        width: 0.85,
        height: 0.18,
    },
    hero: {
        peakOffset: 2,
        peakRandomness: 0.5,
        minPeak: 1.6,
    },
    human: {
        jumpThreshold: 1.2,
        jumpDuration: 0.55,
        jumpArc: 0.35,
        worryDuration: 0.6,
    },
    camera: {
        offset: 2.4,
        followSpeed: 5.6,
    },
    features: {
        bonusCrawler: true,
        bonusReward: 3,
        bonusSpeed: 1.7,
        bonusRespawn: 4,
    },
    ui: {
        promptDuration: 2,
    },
};
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const lerp = (start, end, t) => start + (end - start) * t;
const randRange = (min, max) => min + Math.random() * (max - min);
const pseudoRandom = (seed) => {
    const value = Math.sin(seed * 12.9898) * 43758.5453;
    return value - Math.floor(value);
};
const easeInOut = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const formatScore = (score) => score.toFixed(3);
const toTitleCase = (value) => value
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
const cloneConfig = () => JSON.parse(JSON.stringify(DEFAULT_CONFIG));
const deepMerge = (base, update) => {
    const result = { ...base };
    Object.keys(update).forEach((key) => {
        const typedKey = key;
        const baseValue = base[typedKey];
        const updateValue = update[typedKey];
        if (baseValue &&
            typeof baseValue === "object" &&
            !Array.isArray(baseValue) &&
            updateValue &&
            typeof updateValue === "object") {
            result[typedKey] = deepMerge(baseValue, updateValue);
        }
        else if (updateValue !== undefined) {
            result[typedKey] = updateValue;
        }
    });
    return result;
};
const getConfigValue = (config, path) => {
    const parts = path.split(".");
    let current = config;
    for (const part of parts) {
        current = current?.[part];
    }
    return current;
};
const setConfigValue = (config, path, value) => {
    const parts = path.split(".");
    let current = config;
    parts.forEach((part, index) => {
        if (index === parts.length - 1) {
            current[part] = value;
        }
        else {
            current = current[part];
        }
    });
};
class BonusCrawlerFeature {
    constructor() {
        this.id = "bonus-crawler";
        this.y = 0;
        this.active = false;
        this.respawnTimer = 0;
        this.flashTime = 0;
    }
    update(dt, game) {
        const config = game.config.features;
        if (!config.bonusCrawler) {
            this.active = false;
            this.respawnTimer = 0;
            return;
        }
        if (!this.active) {
            this.respawnTimer -= dt;
            if (this.respawnTimer <= 0) {
                this.active = true;
                this.y = 0;
            }
            return;
        }
        this.y += config.bonusSpeed * dt;
        if (this.y > game.maxAltitude + game.viewHeightMeters) {
            this.active = false;
            this.respawnTimer = config.bonusRespawn;
        }
        if (this.flashTime > 0) {
            this.flashTime = Math.max(0, this.flashTime - dt);
        }
    }
    onProjectile(projectile, game) {
        if (!this.active) {
            return false;
        }
        const crawlerX = 0.25;
        const dx = projectile.pos.x - crawlerX;
        const dy = projectile.pos.y - this.y;
        const hitRadius = 0.35;
        if (dx * dx + dy * dy <= hitRadius * hitRadius) {
            this.active = false;
            this.flashTime = 0.35;
            this.respawnTimer = game.config.features.bonusRespawn;
            game.addPlatforms(game.config.features.bonusReward);
            return true;
        }
        return false;
    }
    render(ctx, game) {
        if (!this.active && this.flashTime <= 0) {
            return;
        }
        const wallX = game.wallScreenX;
        const screenY = game.worldToScreenY(this.y);
        ctx.save();
        ctx.translate(wallX + 16, screenY);
        const pulse = this.flashTime > 0 ? 1 + this.flashTime * 2 : 1;
        ctx.scale(pulse, pulse);
        ctx.beginPath();
        ctx.fillStyle = this.flashTime > 0 ? "rgba(255, 179, 71, 0.9)" : "rgba(57, 245, 154, 0.9)";
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 12;
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(5, 8, 14, 0.7)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-6, -8);
        ctx.lineTo(6, 8);
        ctx.moveTo(6, -8);
        ctx.lineTo(-6, 8);
        ctx.stroke();
        ctx.restore();
    }
    onReset(game) {
        this.active = false;
        this.respawnTimer = game.config.features.bonusRespawn;
        this.flashTime = 0;
    }
}
class Game {
    constructor(canvas) {
        this.mode = "playing";
        this.width = 0;
        this.height = 0;
        /** Screen X position of the wall ruler (px). */
        this.wallScreenX = 80;
        /** Pixels per meter. */
        this.meterPx = 120;
        /** Screen Y for world y=0 (px). */
        this.originY = 0;
        /** Camera base height in world meters. */
        this.cameraY = 0;
        /** Visible vertical span in meters. */
        this.viewHeightMeters = 6;
        /** Highest reached altitude, used for off-screen culling. */
        this.maxAltitude = 0;
        /** Static base platform height (m). */
        this.basePlatformY = 0;
        /** Trampoline ground height for the hero (m). */
        this.heroGroundY = -0.5;
        this.platforms = [];
        this.projectiles = [];
        this.features = [];
        this.platformsLeft = 0;
        this.score = 0;
        this.lastThrowAt = 0;
        this.time = 0;
        this.promptTimer = 0;
        this.lastFrame = 0;
        this.settingsInputs = [];
        this.settingsValueLabels = [];
        this.tick = (timestamp) => {
            if (!this.lastFrame) {
                this.lastFrame = timestamp;
            }
            const dt = Math.min(0.033, (timestamp - this.lastFrame) / 1000);
            this.lastFrame = timestamp;
            this.update(dt);
            this.render();
            requestAnimationFrame(this.tick);
        };
        this.canvas = canvas;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
            throw new Error("Canvas not supported");
        }
        this.ctx = ctx;
        this.config = this.loadConfig();
        this.hero = {
            pos: { x: 3.1, y: this.heroGroundY },
            vel: { x: 0, y: 0 },
            squish: 0,
        };
        this.human = {
            y: 0,
            state: "idle",
            jumpStart: 0,
            jumpTarget: 0,
            jumpTime: 0,
            worryTime: 0,
        };
        this.scoreValue = document.getElementById("score-value");
        this.platformIcons = document.getElementById("platform-icons");
        this.prompt = document.getElementById("prompt");
        this.gameover = document.getElementById("gameover");
        this.finalScore = document.getElementById("final-score");
        this.leaderboard = document.getElementById("leaderboard");
        this.leaderboardList = document.getElementById("leaderboard-list");
        this.settingsPanel = document.getElementById("settings");
        this.settingsInputs = Array.from(this.settingsPanel.querySelectorAll("[data-path]"));
        this.settingsValueLabels = Array.from(this.settingsPanel.querySelectorAll("[data-value]"));
        this.bindUi();
        this.bindSettings();
        this.bindControls();
        this.resetGame();
        this.resize();
        window.addEventListener("resize", () => this.resize());
    }
    loadConfig() {
        const saved = localStorage.getItem(STORAGE_KEYS.config);
        if (!saved) {
            return cloneConfig();
        }
        try {
            const parsed = JSON.parse(saved);
            return deepMerge(cloneConfig(), parsed);
        }
        catch (error) {
            console.warn("Failed to parse config", error);
            return cloneConfig();
        }
    }
    saveConfig() {
        localStorage.setItem(STORAGE_KEYS.config, JSON.stringify(this.config));
    }
    bindUi() {
        const restartButton = document.getElementById("restart");
        const showLeaderboard = document.getElementById("show-leaderboard");
        const saveScore = document.getElementById("save-score");
        const closeLeaderboard = document.getElementById("close-leaderboard");
        const settingsToggle = document.getElementById("settings-toggle");
        const settingsReset = document.getElementById("settings-reset");
        restartButton.addEventListener("click", () => this.resetGame());
        showLeaderboard.addEventListener("click", () => this.openLeaderboard());
        saveScore.addEventListener("click", () => this.saveScore());
        closeLeaderboard.addEventListener("click", () => this.closeLeaderboard());
        settingsToggle.addEventListener("click", () => this.toggleSettings());
        settingsReset?.addEventListener("click", () => this.resetSettings());
    }
    bindSettings() {
        this.settingsInputs.forEach((input) => {
            const path = input.dataset.path;
            if (!path) {
                return;
            }
            input.addEventListener("input", () => {
                const nextValue = input.type === "checkbox" ? input.checked : clamp(Number(input.value), 0, 999);
                setConfigValue(this.config, path, nextValue);
                if (path === "platform.count") {
                    if (typeof nextValue === "number") {
                        this.platformsLeft = Math.min(this.platformsLeft, Math.floor(nextValue));
                    }
                    this.refreshPlatformIcons();
                }
                this.updateSettingsLabels();
                this.saveConfig();
            });
        });
        this.syncSettingsInputs();
    }
    updateSettingsLabels() {
        this.settingsValueLabels.forEach((label) => {
            const path = label.dataset.value;
            if (!path) {
                return;
            }
            const value = getConfigValue(this.config, path);
            label.textContent = typeof value === "number" ? value.toFixed(2) : value ? "on" : "off";
        });
    }
    syncSettingsInputs() {
        this.settingsInputs.forEach((input) => {
            const path = input.dataset.path;
            if (!path) {
                return;
            }
            const value = getConfigValue(this.config, path);
            if (input.type === "checkbox") {
                input.checked = Boolean(value);
            }
            else {
                input.value = String(value);
            }
        });
        this.updateSettingsLabels();
    }
    bindControls() {
        window.addEventListener("pointerdown", (event) => {
            const target = event.target;
            if (target.closest("button") || target.closest("input") || target.closest("#settings")) {
                return;
            }
            if (this.mode === "playing") {
                this.throwPlatform();
            }
        });
        window.addEventListener("keydown", (event) => {
            if (event.code === "Space" || event.code === "Enter") {
                this.throwPlatform();
            }
            if (event.code === "KeyR") {
                this.resetGame();
            }
            if (event.code === "KeyS") {
                this.toggleSettings();
            }
        });
    }
    toggleSettings() {
        this.settingsPanel.classList.toggle("hidden");
    }
    resetSettings() {
        this.config = cloneConfig();
        this.saveConfig();
        this.platformsLeft = Math.min(this.platformsLeft, this.config.platform.count);
        this.syncSettingsInputs();
        this.refreshPlatformIcons();
    }
    resetGame() {
        this.mode = "playing";
        this.time = 0;
        this.platforms = [];
        this.projectiles = [];
        this.features = [new BonusCrawlerFeature()];
        this.features.forEach((feature) => feature.onReset?.(this));
        this.platformsLeft = this.config.platform.count;
        this.hero.pos = { x: 3.1, y: this.heroGroundY };
        this.hero.vel = { x: 0, y: 0 };
        this.hero.squish = 0;
        this.human.y = 0;
        this.human.state = "idle";
        this.human.jumpStart = this.human.y;
        this.human.jumpTarget = this.human.y;
        this.human.jumpTime = 0;
        this.human.worryTime = 0;
        this.score = 0;
        this.maxAltitude = 0;
        this.cameraY = 0;
        this.promptTimer = this.config.ui.promptDuration;
        this.lastThrowAt = 0;
        this.gameover.classList.add("hidden");
        this.closeLeaderboard();
        this.refreshPlatformIcons();
        this.updateScoreUi();
    }
    resize() {
        const dpr = window.devicePixelRatio || 1;
        this.width = this.canvas.clientWidth;
        this.height = this.canvas.clientHeight;
        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.meterPx = clamp(this.width * 0.12, 90, 150);
        this.wallScreenX = clamp(this.width * 0.08, 50, 110);
        this.originY = this.height - clamp(this.height * 0.2, 90, 160);
        this.viewHeightMeters = (this.originY + 30) / this.meterPx;
    }
    worldToScreenX(x) {
        return this.wallScreenX + x * this.meterPx;
    }
    worldToScreenY(y) {
        return this.originY - (y - this.cameraY) * this.meterPx;
    }
    throwPlatform() {
        const now = this.time;
        if (this.mode !== "playing") {
            return;
        }
        if (this.platformsLeft <= 0) {
            return;
        }
        if (now - this.lastThrowAt < this.config.throwing.cooldown) {
            return;
        }
        const projectile = {
            id: Date.now() + Math.random(),
            pos: { x: this.hero.pos.x - 0.2, y: this.hero.pos.y + 0.6 },
            vel: {
                x: -this.config.throwing.speed,
                y: randRange(0.5, 1.4),
            },
            rotation: randRange(0, Math.PI * 2),
            spin: randRange(-4, 4),
            active: true,
        };
        this.projectiles.push(projectile);
        this.platformsLeft -= 1;
        this.lastThrowAt = now;
        this.promptTimer = 0;
        this.refreshPlatformIcons();
    }
    addPlatforms(amount) {
        this.platformsLeft += amount;
        this.refreshPlatformIcons();
    }
    update(dt) {
        if (this.mode !== "playing") {
            return;
        }
        this.time += dt;
        this.promptTimer = Math.max(0, this.promptTimer - dt);
        this.updateHero(dt);
        this.updateProjectiles(dt);
        this.updateHuman(dt);
        this.updateCamera(dt);
        this.maxAltitude = Math.max(this.maxAltitude, this.hero.pos.y, this.human.y);
        for (const feature of this.features) {
            feature.update(dt, this);
        }
        this.score = Math.max(this.score, this.human.y);
        this.updateScoreUi();
        if (this.platformsLeft <= 0 && this.projectiles.length === 0 && this.human.state === "idle") {
            this.endGame();
        }
    }
    updateHero(dt) {
        this.hero.vel.y -= this.config.physics.gravity * dt;
        this.hero.pos.y += this.hero.vel.y * dt;
        if (this.hero.pos.y <= this.heroGroundY) {
            this.hero.pos.y = this.heroGroundY;
            this.hero.squish = 1;
            const peakBase = this.human.y + this.config.hero.peakOffset;
            const desiredApex = Math.max(this.config.hero.minPeak, peakBase + randRange(-this.config.hero.peakRandomness, this.config.hero.peakRandomness));
            const heightFromGround = Math.max(0.1, desiredApex - this.heroGroundY);
            const desiredVy = Math.sqrt(2 * this.config.physics.gravity * heightFromGround);
            this.hero.vel.y = desiredVy;
        }
        this.hero.squish = Math.max(0, this.hero.squish - dt * 2.8);
    }
    updateProjectiles(dt) {
        const gravity = this.config.physics.gravity * 0.85;
        const wallX = 0;
        for (const projectile of this.projectiles) {
            if (!projectile.active) {
                continue;
            }
            projectile.vel.y -= gravity * dt;
            projectile.pos.x += projectile.vel.x * dt;
            projectile.pos.y += projectile.vel.y * dt;
            projectile.rotation += projectile.spin * dt;
            for (const feature of this.features) {
                if (feature.onProjectile?.(projectile, this)) {
                    projectile.active = false;
                    break;
                }
            }
            if (!projectile.active) {
                continue;
            }
            if (projectile.pos.x <= wallX) {
                const platformY = Math.max(0, projectile.pos.y);
                this.platforms.push({
                    id: Date.now() + Math.random(),
                    y: platformY,
                    createdAt: this.time,
                });
                projectile.active = false;
                this.handlePlatformPlacement(platformY);
            }
            if (projectile.pos.y < -2 || projectile.pos.y > this.cameraY + this.viewHeightMeters + 6) {
                projectile.active = false;
            }
        }
        this.projectiles = this.projectiles.filter((projectile) => projectile.active);
    }
    handlePlatformPlacement(platformY) {
        if (this.attemptHumanJump()) {
            return;
        }
        this.human.state = "worry";
        this.human.worryTime = this.config.human.worryDuration;
    }
    updateHuman(dt) {
        if (this.human.state === "jumping") {
            this.human.jumpTime += dt;
            const t = clamp(this.human.jumpTime / this.config.human.jumpDuration, 0, 1);
            const eased = easeInOut(t);
            const arc = Math.sin(t * Math.PI) * this.config.human.jumpArc;
            this.human.y = lerp(this.human.jumpStart, this.human.jumpTarget, eased) + arc;
            if (t >= 1) {
                this.human.state = "idle";
                this.human.y = this.human.jumpTarget;
            }
        }
        if (this.human.state === "worry") {
            this.human.worryTime = Math.max(0, this.human.worryTime - dt);
            if (this.human.worryTime <= 0) {
                this.human.state = "idle";
            }
        }
        if (this.human.state === "idle") {
            this.attemptHumanJump();
        }
    }
    updateCamera(dt) {
        const target = Math.max(0, this.hero.pos.y - this.config.camera.offset);
        this.cameraY = lerp(this.cameraY, target, clamp(dt * this.config.camera.followSpeed, 0, 1));
    }
    findReachablePlatform() {
        let candidate = null;
        for (const platform of this.platforms) {
            if (platform.y <= this.human.y) {
                continue;
            }
            const delta = platform.y - this.human.y;
            if (delta <= this.config.human.jumpThreshold) {
                if (!candidate || platform.y > candidate.y) {
                    candidate = platform;
                }
            }
        }
        return candidate;
    }
    attemptHumanJump() {
        if (this.human.state === "jumping") {
            return false;
        }
        const target = this.findReachablePlatform();
        if (!target) {
            return false;
        }
        this.human.state = "jumping";
        this.human.jumpStart = this.human.y;
        this.human.jumpTarget = target.y;
        this.human.jumpTime = 0;
        this.human.worryTime = 0;
        return true;
    }
    updateScoreUi() {
        this.scoreValue.textContent = formatScore(this.score);
        if (this.promptTimer > 0) {
            this.prompt.classList.remove("hidden");
        }
        else {
            this.prompt.classList.add("hidden");
        }
    }
    endGame() {
        this.mode = "gameover";
        this.finalScore.textContent = `${formatScore(this.score)} m`;
        this.gameover.classList.remove("hidden");
    }
    refreshPlatformIcons() {
        const count = this.platformsLeft;
        const total = Math.max(this.config.platform.count, this.platformsLeft);
        this.platformIcons.innerHTML = "";
        for (let i = 0; i < total; i += 1) {
            const icon = document.createElement("div");
            icon.className = "platform-icon" + (i >= count ? " used" : "");
            this.platformIcons.appendChild(icon);
        }
    }
    openLeaderboard() {
        this.renderLeaderboard();
        this.leaderboard.classList.remove("hidden");
    }
    closeLeaderboard() {
        this.leaderboard.classList.add("hidden");
    }
    renderLeaderboard() {
        const entries = this.loadScores();
        if (entries.length === 0) {
            this.leaderboardList.innerHTML = "<div class=\"leaderboard-row\">No scores yet</div>";
            return;
        }
        this.leaderboardList.innerHTML = entries
            .map((entry, index) => {
            const name = toTitleCase(entry.name);
            return `<div class=\"leaderboard-row\"><span>#${index + 1} ${name}</span><span>${formatScore(entry.score)} m</span></div>`;
        })
            .join("");
    }
    saveScore() {
        const name = this.resolvePlayerName();
        if (!name) {
            return;
        }
        const entries = this.loadScores();
        entries.push({ name, score: this.score, timestamp: Date.now() });
        entries.sort((a, b) => b.score - a.score);
        const trimmed = entries.slice(0, 10);
        localStorage.setItem(STORAGE_KEYS.scores, JSON.stringify(trimmed));
        this.renderLeaderboard();
    }
    resolvePlayerName() {
        const webApp = window.Telegram?.WebApp;
        const user = webApp?.initDataUnsafe?.user;
        if (user) {
            return (user.username || [user.first_name, user.last_name].filter(Boolean).join(" ") || "Runner");
        }
        const input = window.prompt("Enter name for leaderboard", "Runner");
        if (!input) {
            return null;
        }
        const trimmed = input.trim();
        if (!trimmed) {
            return null;
        }
        return trimmed.slice(0, 20);
    }
    loadScores() {
        const saved = localStorage.getItem(STORAGE_KEYS.scores);
        if (!saved) {
            return [];
        }
        try {
            return JSON.parse(saved);
        }
        catch (error) {
            console.warn("Failed to parse scores", error);
            return [];
        }
    }
    render() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.drawBackground();
        this.drawWall();
        this.drawPlatforms();
        this.drawTrampoline();
        this.drawHero();
        this.drawHuman();
        this.drawProjectiles();
        for (const feature of this.features) {
            feature.render(this.ctx, this);
        }
    }
    drawBackground() {
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
        gradient.addColorStop(0, "#0c1528");
        gradient.addColorStop(0.4, "#09101f");
        gradient.addColorStop(1, "#05070d");
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.width, this.height);
        const haze = this.ctx.createRadialGradient(this.width * 0.2, this.height * 0.2, 40, this.width * 0.2, this.height * 0.2, this.width * 0.6);
        haze.addColorStop(0, "rgba(50, 242, 255, 0.2)");
        haze.addColorStop(1, "rgba(5, 10, 18, 0)");
        this.ctx.fillStyle = haze;
        this.ctx.fillRect(0, 0, this.width, this.height);
        const skylineCount = 12;
        const spacing = this.width / skylineCount;
        const span = this.width + spacing;
        const scroll = this.time * 18;
        const columns = skylineCount + 2;
        for (let i = 0; i < columns; i += 1) {
            const worldX = i * spacing + scroll;
            const x = (worldX % span) - spacing;
            const wrapCount = Math.floor(worldX / span);
            const seed = i + wrapCount * columns;
            const buildingHeight = 40 + pseudoRandom(seed) * 80;
            this.ctx.fillStyle = "rgba(11, 20, 35, 0.85)";
            this.ctx.fillRect(x - 20, this.height - buildingHeight - 60, 40, buildingHeight);
            this.ctx.fillStyle = "rgba(50, 242, 255, 0.25)";
            this.ctx.fillRect(x - 16, this.height - buildingHeight - 50, 32, 3);
        }
        this.ctx.strokeStyle = "rgba(50, 242, 255, 0.12)";
        this.ctx.lineWidth = 1;
        const gridStart = this.height * 0.55;
        for (let y = gridStart; y < this.height; y += 30) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.width, y + 20);
            this.ctx.stroke();
        }
    }
    drawWall() {
        this.ctx.save();
        this.ctx.fillStyle = "rgba(15, 24, 38, 0.95)";
        this.ctx.fillRect(this.wallScreenX - 18, 0, 36, this.height);
        this.ctx.strokeStyle = "rgba(50, 242, 255, 0.6)";
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(this.wallScreenX, 0);
        this.ctx.lineTo(this.wallScreenX, this.height);
        this.ctx.stroke();
        const startMeter = Math.floor(this.cameraY - 1);
        const endMeter = Math.ceil(this.cameraY + this.viewHeightMeters + 2);
        for (let meter = startMeter; meter <= endMeter; meter += 1) {
            const y = this.worldToScreenY(meter);
            if (y < -30 || y > this.height + 30) {
                continue;
            }
            const major = meter % 5 === 0;
            this.ctx.strokeStyle = major ? "rgba(50, 242, 255, 0.8)" : "rgba(50, 242, 255, 0.4)";
            this.ctx.lineWidth = major ? 3 : 1;
            this.ctx.beginPath();
            this.ctx.moveTo(this.wallScreenX - (major ? 14 : 10), y);
            this.ctx.lineTo(this.wallScreenX + (major ? 18 : 12), y);
            this.ctx.stroke();
            if (major && meter >= 0) {
                this.ctx.fillStyle = "rgba(230, 244, 255, 0.7)";
                this.ctx.font = "12px 'Share Tech Mono'";
                this.ctx.fillText(String(meter), this.wallScreenX - 38, y + 4);
            }
        }
        this.ctx.restore();
    }
    drawPlatforms() {
        this.ctx.save();
        const baseWidth = this.config.platform.width * 1.4 * this.meterPx;
        const baseHeight = this.config.platform.height * 1.3 * this.meterPx;
        const baseX = this.wallScreenX + 8;
        const baseY = this.worldToScreenY(this.basePlatformY);
        this.ctx.fillStyle = "rgba(50, 242, 255, 0.35)";
        this.ctx.shadowColor = "rgba(50, 242, 255, 0.5)";
        this.ctx.shadowBlur = 14;
        this.ctx.fillRect(baseX, baseY - baseHeight / 2, baseWidth, baseHeight);
        this.ctx.shadowBlur = 0;
        this.ctx.strokeStyle = "rgba(5, 8, 14, 0.7)";
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(baseX, baseY - baseHeight / 2, baseWidth, baseHeight);
        for (const platform of this.platforms) {
            const x = this.wallScreenX + 12;
            const y = this.worldToScreenY(platform.y);
            const width = this.config.platform.width * this.meterPx;
            const height = this.config.platform.height * this.meterPx;
            const growTime = 0.22;
            const growProgress = clamp((this.time - platform.createdAt) / growTime, 0, 1);
            const grow = easeInOut(growProgress);
            const growWidth = width * grow;
            const growHeight = height * grow;
            const glow = Math.min(1, (this.time - platform.createdAt) * 3);
            this.ctx.fillStyle = `rgba(57, 245, 154, ${0.6 + glow * 0.2})`;
            this.ctx.shadowColor = "rgba(57, 245, 154, 0.6)";
            this.ctx.shadowBlur = 12;
            this.ctx.fillRect(x, y - growHeight / 2, growWidth, growHeight);
            this.ctx.shadowBlur = 0;
            this.ctx.strokeStyle = "rgba(5, 8, 14, 0.6)";
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(x, y - growHeight / 2, growWidth, growHeight);
        }
        this.ctx.restore();
    }
    drawTrampoline() {
        const x = this.worldToScreenX(this.hero.pos.x);
        const y = this.worldToScreenY(this.heroGroundY);
        const squish = 1 - this.hero.squish * 0.3;
        this.ctx.save();
        this.ctx.translate(x, y + 8);
        this.ctx.scale(1.1, squish);
        this.ctx.beginPath();
        this.ctx.fillStyle = "rgba(50, 242, 255, 0.25)";
        this.ctx.strokeStyle = "rgba(50, 242, 255, 0.7)";
        this.ctx.lineWidth = 3;
        this.ctx.ellipse(0, 0, 40, 10, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.restore();
    }
    drawHero() {
        const x = this.worldToScreenX(this.hero.pos.x);
        const y = this.worldToScreenY(this.hero.pos.y);
        const bodyWidth = this.meterPx * 0.5;
        const bodyHeight = this.meterPx * 0.8;
        this.ctx.save();
        this.ctx.translate(x, y);
        const bob = Math.sin(this.time * 4) * 3;
        this.ctx.translate(0, bob - bodyHeight * 0.6);
        ///
        this.ctx.fillStyle = "rgba(57, 245, 154, 0.8)";
        this.ctx.fillRect(-bodyWidth / 2, -bodyHeight * 0.1, bodyWidth, bodyHeight * 0.2);
        this.ctx.fillStyle = "rgba(50, 242, 255, 0.85)";
        this.ctx.shadowColor = "rgba(50, 242, 255, 0.6)";
        this.ctx.shadowBlur = 12;
        this.ctx.fillRect(-bodyWidth / 2, bodyHeight * 0.15, bodyWidth, bodyHeight * 0.65);
        this.ctx.shadowBlur = 0;
        this.ctx.fillStyle = "rgba(5, 8, 14, 0.8)";
        this.ctx.fillRect(-bodyWidth * 0.3, bodyHeight * 0.25, bodyWidth * 0.6, bodyHeight * 0.3);
        this.ctx.fillStyle = "rgba(255, 179, 71, 0.9)";
        this.ctx.fillRect(-bodyWidth * 0.2, bodyHeight * 0.3, bodyWidth * 0.4, bodyHeight * 0.08);
        ///
        // this.ctx.fillStyle = "rgba(50, 242, 255, 0.85)";
        // this.ctx.shadowColor = "rgba(50, 242, 255, 0.6)";
        // this.ctx.shadowBlur = 12;
        // this.ctx.fillRect(-bodyWidth / 2, -bodyHeight / 2, bodyWidth, bodyHeight * 0.65);
        // this.ctx.shadowBlur = 0;
        // this.ctx.fillStyle = "rgba(5, 8, 14, 0.8)";
        // this.ctx.fillRect(-bodyWidth * 0.3, -bodyHeight * 0.2, bodyWidth * 0.6, bodyHeight * 0.3);
        // this.ctx.fillStyle = "rgba(255, 179, 71, 0.9)";
        // this.ctx.fillRect(-bodyWidth * 0.2, -bodyHeight * 0.15, bodyWidth * 0.4, bodyHeight * 0.08);
        // this.ctx.fillStyle = "rgba(57, 245, 154, 0.8)";
        // this.ctx.fillRect(-bodyWidth / 2, bodyHeight * 0.2, bodyWidth, bodyHeight * 0.2);
        ///
        this.ctx.restore();
    }
    drawHuman() {
        const x = this.worldToScreenX(0.55);
        const y = this.worldToScreenY(this.human.y);
        const wobble = this.human.state === "worry" ? Math.sin(this.time * 12) * 3 : Math.sin(this.time * 2) * 1.5;
        const bodyWidth = this.meterPx * 0.16;
        const bodyHeight = this.meterPx * 0.32;
        const headSize = this.meterPx * 0.18;
        this.ctx.save();
        this.ctx.translate(x + wobble, y - this.meterPx * 0.2);
        this.ctx.fillStyle = "rgba(255, 111, 110, 0.9)";
        this.ctx.shadowColor = "rgba(255, 111, 110, 0.6)";
        this.ctx.shadowBlur = 10;
        this.ctx.fillRect(-bodyWidth / 2, -bodyHeight, bodyWidth, bodyHeight);
        this.ctx.shadowBlur = 0;
        this.ctx.fillStyle = "rgba(230, 244, 255, 0.9)";
        this.ctx.fillRect(-headSize / 2, -bodyHeight - headSize, headSize, headSize);
        this.ctx.strokeStyle = "rgba(230, 244, 255, 0.5)";
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(-bodyWidth * 0.8, -bodyHeight * 0.4);
        this.ctx.lineTo(-bodyWidth * 1.2, bodyHeight * 0.2);
        this.ctx.moveTo(bodyWidth * 0.8, -bodyHeight * 0.4);
        this.ctx.lineTo(bodyWidth * 1.2, bodyHeight * 0.2);
        this.ctx.stroke();
        this.ctx.restore();
    }
    drawProjectiles() {
        for (const projectile of this.projectiles) {
            const x = this.worldToScreenX(projectile.pos.x);
            const y = this.worldToScreenY(projectile.pos.y);
            this.ctx.save();
            this.ctx.translate(x, y);
            this.ctx.rotate(projectile.rotation);
            this.ctx.fillStyle = "rgba(50, 242, 255, 0.8)";
            this.ctx.shadowColor = "rgba(50, 242, 255, 0.6)";
            this.ctx.shadowBlur = 10;
            this.ctx.beginPath();
            this.ctx.moveTo(0, -8);
            this.ctx.lineTo(18, 0);
            this.ctx.lineTo(0, 8);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.restore();
        }
    }
}
const initTelegram = () => {
    const webApp = window.Telegram?.WebApp;
    if (webApp) {
        webApp.ready();
        webApp.expand();
    }
};
const start = () => {
    initTelegram();
    const canvas = document.getElementById("game-canvas");
    if (!canvas) {
        return;
    }
    const game = new Game(canvas);
    requestAnimationFrame(game.tick);
};
window.addEventListener("DOMContentLoaded", start);
export {};
//# sourceMappingURL=main.js.map