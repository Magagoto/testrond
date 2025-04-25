const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const cguCanvas = document.getElementById("cgu-background");
const cguCtx = cguCanvas.getContext("2d");

const sound = document.getElementById("sound");
const mobileInfo = document.getElementById("mobile-info");

// Éléments pour l'affichage du numéro et des coordonnées du cercle
const numberDisplay = document.getElementById('circle-number-display');
const numberSpan = document.getElementById('circle-number');
const latSpan = document.getElementById('circle-lat');
const longSpan = document.getElementById('circle-long');

// Variables pour le système de numérotation et coordonnées des cercles
let circleMap = new Map(); // Pour stocker les numéros des cercles
let circleCoords = new Map(); // Pour stocker les coordonnées géographiques
let circleCounter = 1; // Compteur pour assigner des numéros aux cercles

// Limites géographiques d'Orléans (approximatives)
// Centre approximatif d'Orléans : 47.9025, 1.9046
const orleansLimits = {
  minLat: 47.8700, // Sud
  maxLat: 47.9400, // Nord
  minLong: 1.8500, // Ouest
  maxLong: 1.9600  // Est
};

// Configuration responsive
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Ajuster la taille des cercles en fonction du dispositif
const baseRadius = isMobile ? 16 : 22;
let radius = baseRadius;
let diameter = radius * 2;

const colors = ["#00A993", "#E68B4A", "#7A1619", "#362777", "#EB7AAE",
  "#0069AA", "#DC0C15", "#E03A8D", "#FFFFFF", "#2A4899"];

const gradientMap = {
  "#00A993": "#E68B4A", "#E68B4A": "#7A1619", "#7A1619": "#362777",
  "#362777": "#EB7AAE", "#EB7AAE": "#0069AA", "#0069AA": "#DC0C15",
  "#DC0C15": "#E03A8D", "#E03A8D": "#FFFFFF", "#FFFFFF": "#2A4899",
  "#2A4899": "#00A993"
};

let colorGrid = [];
let specialCircles = [];
let specialZones = new Set();
let hiddenCircles = new Set();
let disappearing = [];
const specialLinks = ["page1.html", "page2.html", "page3.html", "page4.html"];

let linearGradientZones = new Map();

setInterval(() => {
  // Vérifier si le jeu du gyroscope (page1) est terminé
  let gameState = localStorage.getItem("game-state");
  let gamePage = localStorage.getItem("game-page");
  
  if (gameState === "finished" && gamePage === "page1") {
    // Réinitialiser immédiatement pour éviter les traitements multiples
    localStorage.setItem("game-state", "undefined");
    localStorage.removeItem("game-page");
    
    // Trouver le cercle spécial qui mène à la page 1
    const page1Circle = specialCircles.find(circle => circle.link === "page1.html");
    
    if (page1Circle) {
      const { x, y } = page1Circle;

      // Récupérer les coordonnées des 9 cercles autour (y compris le centre)
      const neighbors = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (
            ny >= 0 && ny < colorGrid.length &&
            nx >= 0 && nx < colorGrid[0].length
          ) {
            neighbors.push({ x: nx, y: ny });
          }
        }
      }

      // Identifier toutes les couleurs distinctes autour
      const colorsSet = new Set();
      neighbors.forEach(({ x: nx, y: ny }) => {
        const color = colorGrid[ny][nx];
        if (color) colorsSet.add(color);
      });

      // Pour chaque couleur, effacer la zone connectée à chaque voisin de cette couleur
      const processed = new Set();
      colorsSet.forEach(targetColor => {
        neighbors.forEach(({ x: nx, y: ny }) => {
          if (colorGrid[ny][nx] === targetColor) {
            // On utilise la version robuste de processConnectedCircles
            processConnectedCircles(nx, ny, targetColor, processed);
          }
        });
      });

      // Logs pour debug
      console.log(`Zones effacées pour ${colorsSet.size} couleurs autour du cercle spécial page1`);
      console.log(`Cercles à cacher: ${hiddenCircles.size}`);
      console.log(`Cercles disparaissant: ${disappearing.length}`);

      // Déclencher l'effet sonore
      try {
        sound.currentTime = 0;
        sound.play().catch(err => console.log("Impossible de jouer le son:", err));
      } catch (e) {
        console.log("Erreur audio:", e);
      }
      
      // Mettre à jour la numérotation des cercles après disparition
      setTimeout(assignCircleNumbersAndCoords, 500);
    }
  }
}, 100);

// Fonction robuste pour traiter les cercles connectés de même couleur.
// Utilisable ailleurs dans le code si besoin.
function processConnectedCircles(cx, cy, targetColor, processed) {
  const key = `${cx},${cy}`;
  // Vérifier si le cercle est déjà traité ou s'il n'existe pas ou s'il n'est pas de la même couleur
  if (
    processed.has(key) ||
    !colorGrid[cy] ||
    !colorGrid[cy][cx] ||
    colorGrid[cy][cx] !== targetColor
  ) {
    return;
  }
  
  processed.add(key);
  // Ajouter à la liste des cercles à cacher
  if (!hiddenCircles.has(key)) {
    hiddenCircles.add(key);
    disappearing.push({ x: cx, y: cy, start: performance.now() });
  }
  
  // Explorer les 8 directions autour du cercle
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue; // Sauter le cercle lui-même
      
      const nx = cx + dx;
      const ny = cy + dy;
      
      // Vérifier que les coordonnées sont valides avant d'appeler récursivement
      if (
        ny >= 0 && ny < colorGrid.length &&
        nx >= 0 && nx < colorGrid[0].length
      ) {
        processConnectedCircles(nx, ny, targetColor, processed);
      }
    }
  }
}

function generateRandomOrleansCoords() {
  const lat = orleansLimits.minLat + Math.random() * (orleansLimits.maxLat - orleansLimits.minLat);
  const long = orleansLimits.minLong + Math.random() * (orleansLimits.maxLong - orleansLimits.minLong);
  return {
    lat: parseFloat(lat.toFixed(6)),  // 6 décimales pour la précision
    long: parseFloat(long.toFixed(6))
  };
}

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1; // Récupérer le ratio de pixels de l'appareil
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.scale(dpr, dpr); // Adapter le contexte au ratio de pixels

  // Ajuster dynamiquement le rayon en fonction de la taille de l'écran
  if (isMobile) {
    const desiredCirclesWidth = window.innerWidth < 380 ? 12 : 15;
    radius = Math.min(16, Math.floor(window.innerWidth / desiredCirclesWidth / 2));
  } else {
    radius = baseRadius;
  }

  diameter = radius * 2;

  const cols = Math.ceil(canvas.width / diameter / dpr); // Diviser par le ratio pour compenser
  const rows = Math.ceil(canvas.height / diameter / dpr);

  colorGrid = new Array(rows).fill().map(() => new Array(cols).fill(null));

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const neighbors = getNeighborColors(x, y);
      let chosenColor;

      if (neighbors.length > 0 && Math.random() < 0.8) {
        chosenColor = neighbors[Math.floor(Math.random() * neighbors.length)];
      } else {
        chosenColor = colors[Math.floor(Math.random() * colors.length)];
      }

      colorGrid[y][x] = chosenColor;
    }
  }

  chooseLinearGradientZones();
  
  // Réinitialiser la numérotation et les coordonnées des cercles après redimensionnement
  setTimeout(assignCircleNumbersAndCoords, 100);
}

function getNeighborColors(cx, cy) {
  const neighborColors = [];
  for (let dy = -1; dy <= 0; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx >= 0 && ny >= 0 && ny < colorGrid.length && nx < colorGrid[0].length) {
        const color = colorGrid[ny][nx];
        if (color) neighborColors.push(color);
      }
    }
  }
  return neighborColors;
}

function getZone(x, y, targetColor) {
  const visited = new Set();
  const queue = [[x, y]];
  const zone = new Set();

  while (queue.length > 0) {
    const [cx, cy] = queue.shift();
    const key = `${cx},${cy}`;
    if (visited.has(key)) continue;
    visited.add(key);

    if (colorGrid[cy]?.[cx] === targetColor) {
      zone.add(key);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx !== 0 || dy !== 0) {
            queue.push([cx + dx, cy + dy]);
          }
        }
      }
    }
  }

  return zone;
}

function chooseLinearGradientZones() {
  linearGradientZones.clear();
  const zonesToConvert = isMobile ? 100 : 200; // Moins de zones sur mobile pour de meilleures performances
  const maxAttempts = 200;
  let attempts = 0;

  while (linearGradientZones.size < zonesToConvert && attempts < maxAttempts) {
    const x = Math.floor(Math.random() * colorGrid[0].length);
    const y = Math.floor(Math.random() * colorGrid.length);
    const color = colorGrid[y][x];
    const zone = getZone(x, y, color);

    if (zone.size > 5) {
      const baseAngle = Math.random() * 2 * Math.PI;
      const phaseOffset = Math.random() * Math.PI * 2;
      
      // Décider du type d'animation pour cette zone (30% de progression linéaire, 70% oscillation)
      const animationType = Math.random() < 0.3 ? 'progression' : 'oscillation';
      
      // Paramètres communs
      const animationSpeed = 0.5 + Math.random() * 1.5;
      
      // Paramètres spécifiques à l'oscillation
      const oscillationAmount = Math.PI / 4 + Math.random() * Math.PI / 4;
      
      let zoneCount = 0;
      for (const key of zone) {
        if (!linearGradientZones.has(key)) {
          linearGradientZones.set(key, {
            baseAngle,
            phaseOffset,
            animationType,
            animationSpeed,
            oscillationAmount
          });
          zoneCount++;
        }
        if (zoneCount > 10 + Math.random() * 20) break;
      }
    }

    attempts++;
  }
}

function chooseSpecialCircles() {
  specialCircles = [];
  specialZones.clear();

  const total = colorGrid.length * colorGrid[0].length;
  const selectedIndices = new Set();
  while (selectedIndices.size < 4) {
    const index = Math.floor(Math.random() * total);
    selectedIndices.add(index);
  }

  let count = 0;
  for (let y = 0; y < colorGrid.length; y++) {
    for (let x = 0; x < colorGrid[0].length; x++) {
      const index = y * colorGrid[0].length + x;
      if (selectedIndices.has(index)) {
        specialCircles.push({ x, y, link: specialLinks[count++] });
        const zone = getZone(x, y, colorGrid[y][x]);
        for (const key of zone) {
          specialZones.add(key);
        }
      }
    }
  }
}

function optimizeRendering(time) {
  // Sur mobile, limiter le rendu pour économiser la batterie
  if (isMobile && lastRenderTime && time - lastRenderTime < 16) { // ~60fps
    requestAnimationFrame(optimizeRendering);
    return;
  }
  
  lastRenderTime = time;
  animate(time);
  requestAnimationFrame(optimizeRendering);
}

let lastRenderTime = 0;

function animate(time) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const t = time / 1000;

  for (let y = 0; y < colorGrid.length; y++) {
    for (let x = 0; x < colorGrid[0].length; x++) {
      const key = `${x},${y}`;
      const anim = disappearing.find(a => a.x === x && a.y === y);

      if (hiddenCircles.has(key) && !anim) continue;

      const baseColor = colorGrid[y][x];
      let cx = x * diameter + radius;
      let cy = y * diameter + radius;

      let r = radius;
      if (anim) {
        const elapsed = time - anim.start;
        r *= 1 - elapsed / 400;
        if (elapsed > 400) {
          hiddenCircles.add(key);
          disappearing = disappearing.filter(a => a !== anim);
          continue;
        }
      }

      if (specialZones.has(key)) {
        const shake = isMobile ? 1 : 2; // Moins de secousse sur mobile
        cx += (Math.random() - 0.5) * shake;
        cy += (Math.random() - 0.5) * shake;
      }

      const isSpecial = specialCircles.some(c => c.x === x && c.y === y);
      if (isSpecial) {
        const blink = Math.sin(t * 10);
        if (blink <= 0) continue;
        const smallR = r * 0.5;
        ctx.beginPath();
        ctx.arc(cx, cy, smallR, 0, Math.PI * 2);
        ctx.fillStyle = "#FFFFFF";
        ctx.fill();
      } else {
        const endColor = gradientMap[baseColor.toUpperCase()] || baseColor;

        let gradient;
        if (linearGradientZones.has(key)) {
          const gradientInfo = linearGradientZones.get(key);
          const { baseAngle, phaseOffset, animationType, animationSpeed, oscillationAmount } = gradientInfo;
          
          let currentAngle, position;
          
          // Animation différente selon le type d'animation
          if (animationType === 'progression') {
            // Animation de progression linéaire à travers le cercle
            position = ((t * animationSpeed + phaseOffset) % (Math.PI * 2)) / (Math.PI * 2);
            
            // Calculer la position du dégradé qui traverse le cercle
            const offsetX = Math.cos(baseAngle) * r * 2 * (position - 0.5); 
            const offsetY = Math.sin(baseAngle) * r * 2 * (position - 0.5);
            
            // Créer le dégradé qui se déplace à travers le cercle
            gradient = ctx.createLinearGradient(
              cx - Math.cos(baseAngle) * r, 
              cy - Math.sin(baseAngle) * r,
              cx + Math.cos(baseAngle) * r, 
              cy + Math.sin(baseAngle) * r
            );
          } else {
            // Animation d'oscillation (comme dans la version précédente)
            currentAngle = baseAngle + Math.sin(t * animationSpeed + phaseOffset) * oscillationAmount;
            const dx = Math.cos(currentAngle) * r;
            const dy = Math.sin(currentAngle) * r;
            gradient = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
          }
        } else {
          const pulse = 0.3 + 0.2 * Math.sin(t + (x + y) / 5);
          gradient = ctx.createRadialGradient(cx, cy, r * pulse, cx, cy, r);
        }

        gradient.addColorStop(0, baseColor);
        gradient.addColorStop(1, endColor);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

// Fonction pour assigner des numéros et des coordonnées à tous les cercles visibles
function assignCircleNumbersAndCoords() {
  circleMap.clear();
  circleCoords.clear();
  circleCounter = 1;
  
  for (let y = 0; y < colorGrid.length; y++) {
    for (let x = 0; x < colorGrid[0].length; x++) {
      const key = `${x},${y}`;
      if (!hiddenCircles.has(key)) {
        circleMap.set(key, circleCounter++);
        // Générer et stocker des coordonnées aléatoires d'Orléans pour ce cercle
        circleCoords.set(key, generateRandomOrleansCoords());
      }
    }
  }
  
  console.log(`Total de ${circleCounter - 1} cercles numérotés avec coordonnées d'Orléans`);
}

// Gestionnaire d'événements pour le survol
function handleHover(e) {
  e.preventDefault();
  
  // Déterminer les coordonnées selon le type d'événement
  const rect = canvas.getBoundingClientRect();
  let mx, my;
  
  if (e.type.startsWith("touch")) {
    const touch = e.touches[0] || e.changedTouches[0];
    mx = touch.clientX - rect.left;
    my = touch.clientY - rect.top;
  } else {
    mx = e.clientX - rect.left;
    my = e.clientY - rect.top;
  }

  const col = Math.floor(mx / diameter);
  const row = Math.floor(my / diameter);
  const key = `${col},${row}`;

  // Vérifier si on survole un cercle valide
  if (colorGrid[row]?.[col] && !hiddenCircles.has(key)) {
    const circleNumber = circleMap.get(key);
    const coords = circleCoords.get(key);
    
    if (circleNumber && coords) {
      numberSpan.textContent = circleNumber;
      latSpan.textContent = coords.lat.toFixed(6);
      longSpan.textContent = coords.long.toFixed(6);
      numberDisplay.style.display = 'block';
    }
  } else {
    numberDisplay.style.display = 'none';
  }
}

// Fonction pour gérer la fin du survol
function handleHoverEnd() {
  numberDisplay.style.display = 'none';
}

// Gestionnaire d'événements unifié pour les clics et les touches
function handleInteraction(e) {
  e.preventDefault(); // Empêcher le zoom ou autres comportements par défaut sur mobile
  
  // Déterminer les coordonnées selon le type d'événement
  const rect = canvas.getBoundingClientRect();
  let mx, my;
  
  if (e.type === "touchstart" || e.type === "touchmove") {
    const touch = e.touches[0] || e.changedTouches[0];
    mx = touch.clientX - rect.left;
    my = touch.clientY - rect.top;
  } else {
    mx = e.clientX - rect.left;
    my = e.clientY - rect.top;
  }

  const col = Math.floor(mx / diameter);
  const row = Math.floor(my / diameter);

  // Vérifier si on a cliqué sur un cercle spécial
  for (const { x, y, link } of specialCircles) {
    const cx = x * diameter + radius;
    const cy = y * diameter + radius;
    const dist = Math.hypot(mx - cx, my - cy);
    if (dist < radius * 0.5) {
      window.location.href = link;
      return;
    }
  }


  
  localStorage.setItem("last-special-circle-clicked", JSON.stringify({ x: col, y: row }));
}

function hideSimilarCircles(row, col) {
  const color = colorGrid[row]?.[col];

  const toHide = new Set();
  const visited = new Set();
  const queue = [[col, row]];

  while (queue.length) {
    const [x, y] = queue.shift();
    // Vérifier que x et y sont dans la grille
    if (
      y < 0 || y >= colorGrid.length ||
      x < 0 || x >= colorGrid[0].length
    ) continue;

    const key = `${x},${y}`;
    if (visited.has(key)) continue;
    visited.add(key);

    if (colorGrid[y]?.[x] === color && !hiddenCircles.has(key)) {
      toHide.add(key);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx !== 0 || dy !== 0) {
            const nx = x + dx;
            const ny = y + dy;
            // N'ajouter à la queue que si dans la grille
            if (
              ny >= 0 && ny < colorGrid.length &&
              nx >= 0 && nx < colorGrid[0].length
            ) {
              queue.push([nx, ny]);
            }
          }
        }
      }
    }
  }

  if (toHide.size > 0) {
    // Essayer de jouer le son seulement après une interaction utilisateur
    try {
      sound.currentTime = 0;
      sound.play().catch(err => console.log("Impossible de jouer le son:", err));
    } catch (e) {
      console.log("Erreur audio:", e);
    }
    
    const now = performance.now();
    for (const key of toHide) {
      const [x, y] = key.split(',').map(Number);
      disappearing.push({ x, y, start: now });
    }
    
    // Mettre à jour la numérotation des cercles après disparition
    setTimeout(() => {
      assignCircleNumbersAndCoords();
    }, 500);
  }  
}

function showMobileInfo() {
  if (isMobile) {
    mobileInfo.style.display = "block";
    setTimeout(() => {
      mobileInfo.style.opacity = "1";
    }, 100);
    
    // Cacher l'info après quelques secondes
    setTimeout(() => {
      mobileInfo.style.opacity = "0";
      setTimeout(() => {
        mobileInfo.style.display = "none";
      }, 500);
    }, 5000);
  }
}

function initCguDecor() {
  cguCanvas.width = window.innerWidth;
  cguCanvas.height = window.innerHeight;
  
  // Ajuster l'espacement sur mobile
  const spacing = isMobile ? 40 : 60;
  
  const bounds = document.getElementById("cgu-content").getBoundingClientRect();
  const margin = isMobile ? 30 : 50;
  const startX = bounds.left - margin;
  const endX = bounds.right + margin;
  const startY = bounds.top - margin;
  const endY = bounds.bottom + margin;
  const cguCircles = [];

  for (let y = startY; y < endY; y += spacing) {
    for (let x = startX; x < endX; x += spacing) {
      if (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom) {
        const baseColor = colors[Math.floor(Math.random() * colors.length)];
        const endColor = gradientMap[baseColor.toUpperCase()] || baseColor;
        cguCircles.push({ 
          x, y, 
          baseColor, 
          endColor, 
          pulseOffset: Math.random() * Math.PI * 2,
          r: isMobile ? radius * 0.8 : radius // Cercles un peu plus petits sur mobile
        });
      }
    }
  }

  function animateCguDecor(time) {
    cguCtx.clearRect(0, 0, cguCanvas.width, cguCanvas.height);
    const t = time / 1000;
    for (const circle of cguCircles) {
      const pulse = 0.3 + 0.2 * Math.sin(t + circle.pulseOffset);
      const gradient = cguCtx.createRadialGradient(
        circle.x, circle.y, circle.r * pulse,
        circle.x, circle.y, circle.r
      );
      gradient.addColorStop(0, circle.baseColor);
      gradient.addColorStop(1, circle.endColor);

      cguCtx.beginPath();
      cguCtx.arc(circle.x, circle.y, circle.r, 0, Math.PI * 2);
      cguCtx.fillStyle = gradient;
      cguCtx.fill();
    }
    requestAnimationFrame(animateCguDecor);
  }

  requestAnimationFrame(animateCguDecor);
}

function acceptCGU() {
  document.getElementById("cgu-modal").style.display = "none";
  canvas.style.display = "block";
  
  // Ajouter les gestionnaires d'événements
  if (isMobile) {
    canvas.addEventListener("touchstart", handleInteraction, { passive: false });
    canvas.addEventListener("touchmove", handleHover, { passive: false });
    canvas.addEventListener("touchend", handleHoverEnd);
    showMobileInfo();
  } else {
    canvas.addEventListener("click", handleInteraction);
    canvas.addEventListener("mousemove", handleHover);
    canvas.addEventListener("mouseout", handleHoverEnd);
  }
  
  window.addEventListener("resize", debounce(resizeCanvas, 250));
  resizeCanvas();
  chooseSpecialCircles();
  assignCircleNumbersAndCoords(); // Numéroter les cercles et attribuer des coordonnées au démarrage
  requestAnimationFrame(optimizeRendering);
  document.getElementById('backgroundMusic').play();
}

function refuseCGU() {
  document.getElementById("cgu-content").innerHTML = `
    <h2>Accès refusé</h2>
    <p>Vous devez accepter les conditions pour accéder à l'expérience.</p>
  `;
}

// Fonction utilitaire pour limiter les appels de redimensionnement
function debounce(func, wait) {
  let timeout;
  return function() {
    const context = this;
    const args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
}

window.addEventListener("load", () => {
  initCguDecor();
  
  // Vérifier si nous sommes sur un appareil à écran tactile et adapter l'interface
  if (isMobile) {
    document.body.classList.add('mobile');
  }
});

// Vérifier si le paramètre disableGPU est présent dans l'URL
window.addEventListener('load', () => {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('disableGPU') === 'true') {
    disableGPU();
  }
});

window.addEventListener("resize", () => {
  if (document.getElementById("cgu-modal").style.display !== "none") {
    initCguDecor();
  }
});

// Gestion des problèmes audio sur iOS
document.addEventListener('touchstart', function() {
  // Créer et détruire un contexte audio pour débloquer l'API Web Audio sur iOS
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  audioContext.resume().then(() => {
    audioContext.close();
  });
  
  // Charger le son si possible
  sound.load();
}, { once: true });

function disableGPU() {
  canvas.style.display = 'none'; // Désactiver le rendu GPU en masquant le canvas
}
