let state = "menu";
let walls = [];
let startPoint = null;
let endPoint = null;
let simulationFrozen = false;

// Sidebar UI
let genMazeButton, widthInput, heightInput, blockSizeInput, confirmButton;
let popInput, mutationInput, crossoverInput, maxGeneInput, startGAButton;
let backButton;
let simSpeedInput;

const sidebarWidth = 250;
let blockSize = 20;

// ==== GA STUFF ====
let population = [];
let populationSize = 100;
let mutationRate = 0.02;
let crossoverRate = 0.7;
let maxInitialGenes = 200;
let generation = 0;
let agentIndex = 0;
let simSpeed = 100;
let bestAgent = null;

// trails
let activeTrail = [];
let permanentTrails = [];

// TUNABLES
let deathPenaltyMultiplier = 0.15;
let reachBonus = 1000;
let replaceFraction = 0.2;
let tournamentK = 3;
let tabooThreshold = 2;
let tabooDuration = 6;
let tabooMap = {};

// ==================== SETUP =======================
function setup() {
  createCanvas(1280, 720);
  textAlign(LEFT, TOP);
  textSize(16);
  setupSidebar();
}

// ==================== DRAW =======================
function draw() {
  background(25);
  drawSidebar();

  if (state === "menu" || state === "gaMenu") drawMaze();
  else if (state === "simulation") runSimulation();
}

// ==================== SIDEBAR =======================
function setupSidebar() {
  removeElements();

  createLabel("Genetic Maze Solver", 20, 25, true);

  widthInput = createInput("21");
  widthInput.position(25, 80);
  widthInput.size(60);
  createLabel("Width", 100, 80);

  heightInput = createInput("21");
  heightInput.position(25, 120);
  heightInput.size(60);
  createLabel("Height", 100, 120);

  blockSizeInput = createInput("20");
  blockSizeInput.position(25, 160);
  blockSizeInput.size(60);
  createLabel("Block Size", 100, 160);

  genMazeButton = createButton("Generate Maze");
  genMazeButton.position(25, 200);
  genMazeButton.mousePressed(() => {
    let w = int(widthInput.value());
    let h = int(heightInput.value());
    let bs = int(blockSizeInput.value());
    generateMaze(w, h, bs);
  });
}

function drawSidebar() {
  fill(40);
  rect(0, 0, sidebarWidth, height);
  fill(255);
  textSize(22);

  if (state === "menu" && walls.length > 0) {
    let infoY = 280;
    textSize(14);
    fill("#FFFFFF");

    if (!startPoint) {
      text("Click to set START", 20, infoY);
    }
    else if (!endPoint) {
      text("Click to set END", 20, infoY);
    }
    else {
      text(`Start: (${startPoint.i},${startPoint.j})`, 20, infoY);
      text(`End: (${endPoint.i},${endPoint.j})`, 20, infoY + 20);

      // sim speed input
      if (!simSpeedInput) {
        simSpeedInput = createInput("" + simSpeed);
        simSpeedInput.position(25, infoY + 60);
        simSpeedInput.size(80);
        createLabel("Sim Speed (ms)", 120, infoY + 60);
      }

      // confirm
      if (!confirmButton) {
        confirmButton = createButton("CONFIRM");
        confirmButton.position(25, infoY + 100);
        confirmButton.mousePressed(() => {
          simSpeed = int(simSpeedInput.value());
          setupGAMenu();
        });
      }
    }
  }

  if (state === "simulation") {
    removeElements();
    fill(200);
    textSize(16);
    text(`Gen: ${generation}`, 20, 60);
    text(`Agent: ${agentIndex + 1}/${populationSize}`, 20, 90);
  }
}

function createLabel(txt, x, y, title = false) {
  let label = createP(txt);
  label.position(x, y - 15);
  label.style("color", title ? "#fff" : "#FFFFFF");
  label.style("font-size", title ? "18px" : "14px");
}

// ==================== MAZE =======================
function mazeOrigin() { return { x: sidebarWidth, y: 0 }; }

function drawMaze() {
  if (walls.length === 0) return;
  const origin = mazeOrigin();
  for (let y = 0; y < walls.length; y++) {
    for (let x = 0; x < walls[0].length; x++) {
      fill(walls[y][x] ? 0 : 255);
      noStroke();
      rect(origin.x + x * blockSize, origin.y + y * blockSize, blockSize, blockSize);
    }
  }

  if (startPoint) {
    fill(0, 255, 0);
    rect(origin.x + startPoint.i * blockSize, origin.y + startPoint.j * blockSize, blockSize, blockSize);
  }
  if (endPoint) {
    fill(255, 0, 0);
    rect(origin.x + endPoint.i * blockSize, origin.y + endPoint.j * blockSize, blockSize, blockSize);
  }
}

// ==================== CLICK START/END =======================
function mousePressed() {
  if (state !== "menu" || walls.length === 0) return;
  const origin = mazeOrigin();
  let mx = mouseX - origin.x;
  let my = mouseY - origin.y;
  if (mx < 0) return;

  let i = floor(mx / blockSize);
  let j = floor(my / blockSize);
  if (j < 0 || i < 0 || j >= walls.length || i >= walls[0].length) return;
  if (walls[j][i]) return;

  if (startPoint && i === startPoint.i && j === startPoint.j) {
    startPoint = null;
    return;
  }

  if (endPoint && i === endPoint.i && j === endPoint.j) {
    endPoint = null;
    return;
  }

  if (!startPoint) startPoint = { i, j };
  else if (!endPoint) endPoint = { i, j };
  else {
    let ds = dist(i, j, startPoint.i, startPoint.j);
    let de = dist(i, j, endPoint.i, endPoint.j);
    if (ds <= de) startPoint = { i, j };
    else endPoint = { i, j };
  }
}

// ==================== MAZE GEN =======================
function generateMaze(cols, rows, size) {
  if (cols % 2 === 0) cols++;
  if (rows % 2 === 0) rows++;
  blockSize = size;
  let maze = [];
  for (let y = 0; y < rows; y++) {
    maze[y] = [];
    for (let x = 0; x < cols; x++) maze[y][x] = true;
  }

  let stack = [];
  let cx = 1, cy = 1;
  maze[cy][cx] = false;
  stack.push({ x: cx, y: cy });

  while (stack.length > 0) {
    let current = stack[stack.length - 1];
    let neighbors = [];
    let dirs = [
      { x: 0, y: -2 },
      { x: 2, y: 0 },
      { x: 0, y: 2 },
      { x: -2, y: 0 },
    ];

    for (let d of dirs) {
      let nx = current.x + d.x;
      let ny = current.y + d.y;
      if (ny > 0 && ny < rows - 1 && nx > 0 && nx < cols - 1 && maze[ny][nx]) {
        neighbors.push({ x: nx, y: ny });
      }
    }

    if (neighbors.length > 0) {
      let chosen = random(neighbors);
      maze[(current.y + chosen.y) / 2][(current.x + chosen.x) / 2] = false;
      maze[chosen.y][chosen.x] = false;
      stack.push(chosen);
    } else stack.pop();
  }

  walls = maze;
  startPoint = null;
  endPoint = null;
  tabooMap = {};

  if (confirmButton) { confirmButton.remove(); confirmButton = null; }
  if (simSpeedInput) { simSpeedInput.remove(); simSpeedInput = null; }

  console.log("Maze generated:", cols, rows);
}

// ==================== GA MENU =======================
function setupGAMenu() {
  removeElements();
  state = "gaMenu";

  createLabel("GA Parameters", 20, 25, true);

  popInput = createInput("" + populationSize);
  popInput.position(25, 80);
  popInput.size(80);
  createLabel("Population", 120, 80);

  mutationInput = createInput("" + mutationRate);
  mutationInput.position(25, 120);
  mutationInput.size(80);
  createLabel("Mutation Rate", 120, 120);

  crossoverInput = createInput("" + crossoverRate);
  crossoverInput.position(25, 160);
  crossoverInput.size(80);
  createLabel("Crossover Rate", 120, 160);

  maxGeneInput = createInput("" + maxInitialGenes);
  maxGeneInput.position(25, 200);
  maxGeneInput.size(80);
  createLabel("Max initial genes", 140, 200);

  startGAButton = createButton("START GA");
  startGAButton.position(25, 260);
  startGAButton.mousePressed(startGA);

  // BACK BUTTON (fixed)
  backButton = createButton("BACK");
  backButton.position(25, 310);
  backButton.mousePressed(() => {
    state = "menu";
    // reset UI so confirm/speed reappear
    if (confirmButton) { confirmButton.remove(); confirmButton = null; }
    if (simSpeedInput) { simSpeedInput.remove(); simSpeedInput = null; }
    setupSidebar();
  });
}


// ==================== GA CORE =======================
function startGA() {
  populationSize = Math.max(2, int(popInput.value()));
  mutationRate = constrain(float(mutationInput.value()), 0, 1);
  crossoverRate = constrain(float(crossoverInput.value()), 0, 1);
  maxInitialGenes = Math.max(10, int(maxGeneInput.value()));

  generation = 0;
  population = [];
  bestAgent = null;
  tabooMap = {};

  const approxMax = Math.max(50, Math.floor((walls.length * walls[0].length) / 4));
  for (let i = 0; i < populationSize; i++) {
    let len = Math.floor(random(10, Math.min(maxInitialGenes, approxMax)));
    population.push(new Agent(randomGenes(len), []));
  }
  state = "simulation";
  agentIndex = 0;
}

function randomGenes(len) {
  const g = [];
  for (let i = 0; i < len; i++) g.push(floor(random(4)));
  return g;
}

function opposite(dir) { return dir === 0 ? 2 : dir === 1 ? 3 : dir === 2 ? 0 : 1; }

// Agent constructor
function Agent(genes, forbiddenPositions) {
  this.pos = { i: startPoint.i, j: startPoint.j };
  this.genes = genes ? genes.slice() : [];
  this.step = 0;
  this.dead = false;
  this.reached = false;
  this.fitness = 0;
  this.effectiveLength = 0;
  this.lastMoveDir = null;
  this.deathPos = null;

  this.forbiddenSet = new Set();
  if (forbiddenPositions && Array.isArray(forbiddenPositions)) {
    for (let p of forbiddenPositions) {
      if (p && typeof p.i === "number" && typeof p.j === "number") {
        this.forbiddenSet.add(`${p.i}_${p.j}`);
      }
    }
  }

  this.update = function () {
    if (this.dead || this.reached) return;

    if (this.step >= this.genes.length) this.genes.push(floor(random(4)));
    let dir = this.genes[this.step];

    if (this.lastMoveDir !== null && dir === opposite(this.lastMoveDir)) {
      let foundAlt = false;
      for (let alt = 0; alt < 4; alt++) {
        if (alt === opposite(this.lastMoveDir)) continue;
        let nx = this.pos.i + (alt === 1 ? 1 : alt === 3 ? -1 : 0);
        let ny = this.pos.j + (alt === 2 ? 1 : alt === 0 ? -1 : 0);
        if (ny >= 0 && ny < walls.length && nx >= 0 && nx < walls[0].length && !walls[ny][nx]) {
          dir = alt;
          this.genes[this.step] = alt;
          foundAlt = true;
          break;
        }
      }
      if (!foundAlt) {
        this.dead = true;
        this.effectiveLength = this.step;
        this.deathPos = { i: this.pos.i, j: this.pos.j };
        return;
      }
    }

    let next = { i: this.pos.i, j: this.pos.j };
    if (dir === 0) next.j--;
    if (dir === 1) next.i++;
    if (dir === 2) next.j++;
    if (dir === 3) next.i--;

    const intendedKey = `${next.i}_${next.j}`;
    if (this.forbiddenSet.has(intendedKey)) {
      let foundAlt = false;
      for (let alt = 0; alt < 4; alt++) {
        if (alt === dir) continue;
        if (this.lastMoveDir !== null && alt === opposite(this.lastMoveDir)) continue;
        let nx = this.pos.i + (alt === 1 ? 1 : alt === 3 ? -1 : 0);
        let ny = this.pos.j + (alt === 2 ? 1 : alt === 0 ? -1 : 0);
        let key = `${nx}_${ny}`;
        if (ny >= 0 && ny < walls.length && nx >= 0 && nx < walls[0].length && !walls[ny][nx] && !this.forbiddenSet.has(key)) {
          dir = alt;
          this.genes[this.step] = alt;
          next = { i: nx, j: ny };
          foundAlt = true;
          break;
        }
      }
      // if no alt found, proceed and let death/trapped handle it
    }

    if (next.i < 0 || next.j < 0 || next.i >= walls[0].length || next.j >= walls.length) {
      this.dead = true;
      this.effectiveLength = this.step;
      this.deathPos = { i: this.pos.i, j: this.pos.j };
      return;
    }

    if (!walls[next.j][next.i]) {
      this.pos = next;
      this.lastMoveDir = dir;
    } else {
      if (isTrappedExceptBacktrack(this.pos.i, this.pos.j, this.lastMoveDir)) {
        this.dead = true;
        this.effectiveLength = this.step;
        this.deathPos = { i: this.pos.i, j: this.pos.j };
        return;
      }
    }

    if (this.pos.i === endPoint.i && this.pos.j === endPoint.j) {
      this.reached = true;
      this.dead = true;
      this.effectiveLength = this.step + 1;
      return;
    }

    this.step++;
  };

  this.calcFitness = function () {
    let d = dist(this.pos.i, this.pos.j, endPoint.i, endPoint.j);
    let score = 1000 / Math.pow(d + 1, 2);
    if (this.reached) score = reachBonus + 1000;
    if (this.dead && !this.reached) score *= deathPenaltyMultiplier;
    this.fitness = Math.max(1e-9, score);
  };
}

// Utility
function isTrappedExceptBacktrack(i, j, lastDir) {
  const dirs = [
    { dx: 0, dy: -1, id: 0 },
    { dx: 1, dy: 0, id: 1 },
    { dx: 0, dy: 1, id: 2 },
    { dx: -1, dy: 0, id: 3 },
  ];
  let valid = 0;
  for (let d of dirs) {
    if (lastDir !== null) {
      let back = (lastDir === 0) ? 2 : (lastDir === 1 ? 3 : (lastDir === 2 ? 0 : 1));
      if (d.id === back) continue;
    }
    let x = i + d.dx, y = j + d.dy;
    if (y >= 0 && y < walls.length && x >= 0 && x < walls[0].length) {
      if (!walls[y][x]) valid++;
    }
  }
  return valid <= 0;
}

// ==================== SIMULATION =======================
function runSimulation() {
  drawMaze();

  // draw permanent trails first
  const origin = mazeOrigin();
  fill(0, 150, 255);
  noStroke();
  for (let t of permanentTrails) {
    rect(origin.x + t.i * blockSize, origin.y + t.j * blockSize, blockSize, blockSize);
  }

  if (simulationFrozen) {
    fill(255);
    textSize(18);
    text("🎯 Goal reached!", 20, 20);
    return;
  }

  if (!population.length) return;

  let agent = population[agentIndex];

  // move agent and record trail
  for (let i = 0; i < simSpeed; i++) {
    if (agent.dead || agent.reached) break;
    agent.update();
    if (!agent.dead && !agent.reached) {
      activeTrail.push({ i: agent.pos.i, j: agent.pos.j });
    }
  }

  // draw current trail
  fill(0, 100, 255);
  for (let t of activeTrail) {
    rect(origin.x + t.i * blockSize, origin.y + t.j * blockSize, blockSize, blockSize);
  }

  // draw agent
  fill(0, 0, 255);
  rect(origin.x + agent.pos.i * blockSize, origin.y + agent.pos.j * blockSize, blockSize, blockSize);

  // agent reached goal
  if (agent.reached) {
    agent.calcFitness();
    bestAgent = { genes: agent.genes.slice(), pos: agent.pos, fitness: agent.fitness };
    simulationFrozen = true;

    // keep the trail permanently
    permanentTrails.push(...activeTrail);
    activeTrail = [];
    console.log("Agent reached goal!");
    return;
  }

  // agent died
  if (agent.dead) {
    agent.calcFitness();
    if (!bestAgent || agent.fitness > bestAgent.fitness)
      bestAgent = { genes: agent.genes.slice(), pos: agent.pos, fitness: agent.fitness };

    // clear trail (agent died)
    activeTrail = [];

    agentIndex++;
    if (agentIndex >= populationSize) {
      for (let a of population) {
        if (!a.fitness || a.fitness === 0) a.calcFitness();
      }
      let evaluatedPool = population.map(a => ({
        genes: a.genes.slice(),
        fitness: a.fitness,
        dead: a.dead,
        reached: a.reached,
        effectiveLength: a.effectiveLength,
        deathPos: a.deathPos ? { i: a.deathPos.i, j: a.deathPos.j } : null
      }));
      nextGenerationFromPool(evaluatedPool);
      agentIndex = 0;
      generation++;
    }
  }
}
// ==================== CORE: reproduce from evaluated pool =======================
function nextGenerationFromPool(pool) {
  // pool is a frozen array of evaluated individuals (objects with genes, fitness, dead, reached, deathPos)

  // build deathCounts from pool
  let deathCounts = {};
  for (let p of pool) {
    if (p.deathPos && !p.reached) {
      let k = `${p.deathPos.i}_${p.deathPos.j}`;
      deathCounts[k] = (deathCounts[k] || 0) + 1;
    }
  }

  // update tabooMap (age existing, remove old, add new)
  for (let k in tabooMap) {
    tabooMap[k] = tabooMap[k] + 1;
    if (tabooMap[k] >= tabooDuration) delete tabooMap[k];
  }
  for (let k in deathCounts) {
    if (deathCounts[k] >= tabooThreshold) tabooMap[k] = 0;
  }

  // ensure all pool members have fitness values (they should)
  for (let p of pool) {
    if (!p.fitness || p.fitness === 0) p.fitness = 1e-9;
  }

  // sort pool by fitness desc
  let sorted = pool.slice().sort((a, b) => b.fitness - a.fitness);

  // steady-state / elitism
  let replaceCount = Math.max(1, Math.floor(populationSize * replaceFraction));
  let elitesKeep = Math.min(2, populationSize);

  let newPop = [];

  // copy top elites fully
  for (let i = 0; i < elitesKeep && i < sorted.length; i++) {
    newPop.push(new Agent(sorted[i].genes.slice(), []));
  }

  // survivors: keep best (populationSize - replaceCount)
  let survivorsTarget = Math.max(elitesKeep, populationSize - replaceCount);
  let idx = 0;
  while (newPop.length < survivorsTarget && idx < sorted.length) {
    if (idx < elitesKeep) { idx++; continue; }
    let a = sorted[idx++];
    let useLen = Math.max(1, a.effectiveLength || a.genes.length);
    if (a.dead && !a.reached) useLen = Math.max(1, Math.floor(useLen * 0.8));
    let prefix = a.genes.slice(0, useLen);
    newPop.push(new Agent(prefix, []));
  }
  if (newPop.length > populationSize) newPop.length = populationSize;

  // children: fill rest by selecting from the static pool
  while (newPop.length < populationSize) {
    let parentA = tournamentSelectFromPool(pool, tournamentK);
    let parentB = tournamentSelectFromPool(pool, tournamentK);
    if (parentA === parentB && pool.length > 1) {
      let idxAlt = pool.indexOf(parentA);
      parentB = pool[(idxAlt + 1) % pool.length];
    }

    let usefulA = Math.max(1, parentA.effectiveLength || parentA.genes.length);
    let usefulB = Math.max(1, parentB.effectiveLength || parentB.genes.length);
    if (parentA.dead && !parentA.reached) usefulA = Math.max(1, Math.floor(usefulA * 0.8));
    if (parentB.dead && !parentB.reached) usefulB = Math.max(1, Math.floor(usefulB * 0.8));

    let prefA = parentA.genes.slice(0, usefulA);
    let prefB = parentB.genes.slice(0, usefulB);

    let childGenes = crossoverByPrefixFromPool(prefA, prefB, parentA, parentB);

    let protect = Math.floor(Math.max(usefulA, usefulB) * 0.7);
    if (childGenes.length > maxInitialGenes) childGenes.length = maxInitialGenes;
    mutate(childGenes, protect);

    // build forbidden list: parents' deathPos + global tabooMap positions
    let forb = [];
    if (parentA.deathPos && !parentA.reached) forb.push(parentA.deathPos);
    if (parentB.deathPos && !parentB.reached) forb.push(parentB.deathPos);
    for (let k in tabooMap) {
      let parts = k.split("_");
      if (parts.length === 2) forb.push({ i: int(parts[0]), j: int(parts[1]) });
    }
    let seen = new Set();
    let uniqForb = [];
    for (let p of forb) {
      if (!p) continue;
      let kk = `${p.i}_${p.j}`;
      if (!seen.has(kk)) {
        seen.add(kk);
        uniqForb.push(p);
      }
    }

    newPop.push(new Agent(childGenes, uniqForb));
  }

  population = newPop;
  agentIndex = 0;
  console.log("Next gen (from pool):", generation + 1, "taboos:", Object.keys(tabooMap).length);
}

// Tournament selection from a frozen pool (does NOT touch global population)
function tournamentSelectFromPool(pool, k) {
  k = Math.max(1, Math.min(k, pool.length));
  let best = null;
  for (let i = 0; i < k; i++) {
    let idx = floor(random(pool.length));
    let cand = pool[idx];
    if (!best || cand.fitness > best.fitness) best = cand;
  }
  return best;
}

// Crossover using parent objects from the pool
function crossoverByPrefixFromPool(prefA, prefB, parentA_obj, parentB_obj) {
  if (random() > crossoverRate) {
    const use = (parentA_obj.fitness >= parentB_obj.fitness) ? prefA : prefB;
    return use.slice();
  }

  let minPref = Math.min(prefA.length, prefB.length);
  let cut = floor(random(minPref + 1));
  let newPrefix = prefA.slice(0, cut).concat(prefB.slice(cut));

  let tail = [];
  let extraA = parentA_obj.genes.slice(prefA.length, Math.min(parentA_obj.genes.length, prefA.length + 3));
  let extraB = parentB_obj.genes.slice(prefB.length, Math.min(parentB_obj.genes.length, prefB.length + 3));
  let ia = 0, ib = 0;
  let desiredTailLen = Math.max(0, Math.min(2, Math.floor((extraA.length + extraB.length) * 0.5) + floor(random(2))));
  while (tail.length < desiredTailLen) {
    if (ia < extraA.length) tail.push(extraA[ia++]);
    if (tail.length >= desiredTailLen) break;
    if (ib < extraB.length) tail.push(extraB[ib++]);
    if (ia >= extraA.length && ib >= extraB.length) break;
  }

  if ((parentA_obj.dead && !parentA_obj.reached) && (parentB_obj.dead && !parentB_obj.reached) && tail.length > 0) {
    tail.length = Math.max(0, tail.length - 1);
  }

  if (tail.length === 0) tail.push(floor(random(4)));

  let child = newPrefix.concat(tail);
  if (child.length === 0) child.push(floor(random(4)));
  return child.slice();
}

function mutate(genes, protect = 0) {
  for (let i = protect; i < genes.length; i++) {
    if (random() < mutationRate) genes[i] = floor(random(4));
  }
  if (random() < 0.02 && genes.length < maxInitialGenes) {
    genes.push(floor(random(4)));
  }
  if (genes.length > 8 && random() < 0.02) {
    let trim = Math.floor(random(1, Math.min(4, Math.floor(genes.length * 0.12))));
    genes.length = Math.max(4, genes.length - trim);
  }
}
