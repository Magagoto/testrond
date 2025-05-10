const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// Suppression des références au cgu-background
// const cguCanvas = document.getElementById("cgu-background");
// const cguCtx = cguCanvas.getContext("2d");

const sound = document.getElementById("sound");
const mobileInfo = document.getElementById("mobile-info");

// Éléments pour l'affichage du numéro et des coordonnées du cercle
const numberDisplay = document.getElementById('circle-number-display');
const numberSpan = document.getElementById('circle-number');
const latSpan = document.getElementById('circle-lat');
const longSpan = document.getElementById('circle-long');

// Références aux éléments pour afficher les coordonnées au survol
const circleCoordDisplay = document.getElementById('circle-coord-display');
const hoverLatSpan = document.getElementById('hover-lat');
const hoverLongSpan = document.getElementById('hover-long');
const hoverPoiName = document.getElementById('hover-poi-name');

// Variables pour le système de numérotation et coordonnées des cercles
let circleMap = new Map(); // Pour stocker les numéros des cercles
let circleCoords = new Map(); // Pour stocker les coordonnées géographiques
let circleCounter = 1; // Compteur pour assigner des numéros aux cercles
let circlePOI = new Map(); // Pour associer les POI aux cercles
let assignedPOIs = new Set(); // Pour suivre les POI déjà assignés

// Limites géographiques d'Orléans (centre-ville uniquement)
// Médiathèque au nord (47.9045), Loire au sud (~47.8968)
const orleansLimits = {
  minLat: 47.8965, // Sud (juste au sud de la Loire)
  maxLat: 47.9080, // Nord (juste au nord de la Médiathèque et la Gare)
  minLong: 1.8950, // Ouest
  maxLong: 1.9200  // Est
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

// Liste des textes possibles pour les bulles
const bubbleTexts = [
  "De ce côté !",
  "C'est par là !",
  "Suis-moi !",
  "Viens donc !",
  "Par là, vite !",
  "Par ce chemin !",
  "Approche !",
  "Viens par ici !",
  "Par ici, l'ami !",
  "Par là que ça se passe !",
  "C'est ici que ça se passe !",
  "Suivez cette direction !",
  "Entre donc ici !",
  "C'est la bonne voie !",
  "Ce chemin, vite !"
];

// Pour stocker le texte attribué à chaque bulle spéciale (clé: `${x},${y}`)
let bubbleTextMap = new Map();

// Pour stocker la forme et la taille de queue attribuées à chaque bulle spéciale (clé: `${x},${y}`)
let bubbleShapeMap = new Map();

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

// Fonction pour normaliser des coordonnées géographiques à la grille du canvas
function mapCoordsToGrid(lat, long, rows, cols) {
  // Calculer la position relative aux limites d'Orléans
  const latRatio = (lat - orleansLimits.minLat) / (orleansLimits.maxLat - orleansLimits.minLat);
  const longRatio = (long - orleansLimits.minLong) / (orleansLimits.maxLong - orleansLimits.minLong);
  
  // Convertir en position de grille (inverser y pour correspondre à la convention cartographique)
  // La Médiathèque est en haut (petit y), la Loire en bas (grand y)
  const y = Math.floor((1 - latRatio) * (rows - 1));
  const x = Math.floor(longRatio * (cols - 1));
  
  // S'assurer que les valeurs sont dans les limites
  return {
    x: Math.max(0, Math.min(cols - 1, x)),
    y: Math.max(0, Math.min(rows - 1, y))
  };
}

// Associer les POI d'Orléans aux cercles
function associatePOIsToCircles() {
  if (!window.orleansPOI || !Array.isArray(window.orleansPOI)) {
    console.error("Les POI d'Orléans ne sont pas disponibles");
    return;
  }
  
  // Réinitialiser les POIs assignés
  assignedPOIs.clear();
  circlePOI.clear();
  
  const rows = colorGrid.length;
  const cols = colorGrid[0].length;
  
  // Parcourir tous les POI et les associer aux cercles les plus proches
  for (const poi of window.orleansPOI) {
    // Obtenir la position de grille correspondant aux coordonnées du POI
    const gridPos = mapCoordsToGrid(poi.lat, poi.long, rows, cols);
    const key = `${gridPos.x},${gridPos.y}`;
    
    // Vérifier si le cercle à cette position est visible
    if (!hiddenCircles.has(key)) {
      circlePOI.set(key, poi);
      assignedPOIs.add(poi.name);
      
      // Stocker également les coordonnées réelles du POI
      circleCoords.set(key, {
        lat: poi.lat,
        long: poi.long
      });
    }
  }
  
  console.log(`${assignedPOIs.size} POIs d'Orléans associés aux cercles`);
}

// Fonction pour générer des coordonnées aléatoires d'Orléans
function generateRandomOrleansCoords() {
  // Si nous avons déjà utilisé tous les POI, générer des coordonnées aléatoires
  // mais toujours dans les limites du centre-ville
  if (assignedPOIs.size >= window.orleansPOI.length) {
    const lat = orleansLimits.minLat + Math.random() * (orleansLimits.maxLat - orleansLimits.minLat);
    const long = orleansLimits.minLong + Math.random() * (orleansLimits.maxLong - orleansLimits.minLong);
    return {
      lat: parseFloat(lat.toFixed(6)),
      long: parseFloat(long.toFixed(6)),
      name: "Point du centre-ville" // Nom plus précis
    };
  }
  
  // Sinon, utiliser un POI non encore assigné
  const availablePOIs = window.orleansPOI.filter(poi => !assignedPOIs.has(poi.name));
  if (availablePOIs.length > 0) {
    const randomPOI = availablePOIs[Math.floor(Math.random() * availablePOIs.length)];
    assignedPOIs.add(randomPOI.name);
    return {
      lat: randomPOI.lat,
      long: randomPOI.long,
      name: randomPOI.name,
      description: randomPOI.description
    };
  }
  
  // Fallback si quelque chose ne va pas
  return {
    lat: 47.9025,
    long: 1.9046,
    name: "Orléans"
  };
}

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1; // Récupérer le ratio de pixels de l'appareil
  
  // Définir la taille du canvas en tenant compte du DPR
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  
  // Définir la taille CSS du canvas (dimensions visuelles)
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  
  // Appliquer la mise à l'échelle pour correspondre aux pixels physiques
  ctx.scale(dpr, dpr);
  
  // Réinitialiser le contexte pour éviter l'accumulation de transformations
  if (lastDpr !== dpr) {
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Réinitialiser la transformation
    ctx.scale(dpr, dpr); // Appliquer la nouvelle échelle
    lastDpr = dpr;
  }

  // Ajuster dynamiquement le rayon en fonction de la taille de l'écran
  if (isMobile) {
    const desiredCirclesWidth = window.innerWidth < 380 ? 12 : 15;
    radius = Math.min(16, Math.floor(window.innerWidth / desiredCirclesWidth / 2));
  } else {
    radius = baseRadius;
  }

  diameter = radius * 2;

  const cols = Math.ceil(window.innerWidth / diameter);
  const rows = Math.ceil(window.innerHeight / diameter);

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

  // Réinitialiser la numérotation des cercles après redimensionnement
  setTimeout(() => {
    // D'abord associer les POI aux cercles
    associatePOIsToCircles();
    // Puis compléter la numérotation et les coordonnées pour les cercles sans POI
    assignCircleNumbersAndCoords();
  }, 100);
}

// Ajouter cette variable pour suivre les changements de DPR
let lastDpr = window.devicePixelRatio || 1;

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

// Pour de meilleures formes de bulles, mettons à jour la façon dont nous attribuons les formes
function chooseSpecialCircles() {
  specialCircles = [];
  specialZones.clear();

  // Mélange les textes pour garantir unicité
  const shuffledTexts = bubbleTexts.slice().sort(() => Math.random() - 0.5);
  
  // On ne veut pas de ronds spéciaux sur les bords ni sur les deux dernières lignes
  const validPositions = [];
  const rows = colorGrid.length;
  const cols = colorGrid[0].length;
  for (let y = 1; y < rows - 2; y++) {
    for (let x = 1; x < cols - 1; x++) {
      validPositions.push({ x, y });
    }
  }

  // Sélectionne 4 positions valides aléatoires, jamais côte à côte
  const selected = [];
  const forbidden = new Set();
  while (selected.length < 4 && validPositions.length > 0) {
    // Filtrer les positions non interdites
    const candidates = validPositions.filter(
      pos => !forbidden.has(`${pos.x},${pos.y}`)
    );
    if (candidates.length === 0) break;
    const idx = Math.floor(Math.random() * candidates.length);
    const pos = candidates[idx];
    selected.push(pos);
    
    // Marquer les positions voisines comme interdites (8 directions)
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = pos.x + dx;
        const ny = pos.y + dy;
        forbidden.add(`${nx},${ny}`);
      }
    }
  }

  let count = 0;
  bubbleTextMap.clear();
  bubbleShapeMap.clear();
  for (const pos of selected) {
    const { x, y } = pos;
    specialCircles.push({ x, y, link: specialLinks[count++] });
    const zone = getZone(x, y, colorGrid[y][x]);
    for (const key of zone) {
      specialZones.add(key);
    }
    
    // Attribue un texte unique à cette bulle avec un espace fin avant le point d'exclamation
    let text = shuffledTexts.shift() || "Par ici !";
    
    // Remplacer les points d'exclamation par un espace fin + point d'exclamation
    text = text.replace(/\!/g, '\u202F!');
    
    bubbleTextMap.set(`${x},${y}`, text);

    // Nouveaux styles de bulles modernes
    const shapes = ["ellipse", "roundedRect"];
    const shape = shapes[Math.floor(Math.random() * shapes.length)];
    const tailSize = 0.8 + Math.random() * 0.7; // Entre 0.8 et 1.5 - queue plus subtile
    bubbleShapeMap.set(`${x},${y}`, { shape, tailSize });
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
  // Vérifier si le DPR a changé (par exemple lors d'un zoom du navigateur)
  const currentDpr = window.devicePixelRatio || 1;
  if (currentDpr !== lastDpr) {
    resizeCanvas(); // Redimensionner le canvas si le DPR a changé
  }
  
  // Effacer le canvas avec les dimensions correctes
  ctx.clearRect(0, 0, canvas.width / currentDpr, canvas.height / currentDpr);
  const t = time / 1000;

  // 1. Dessin de tous les cercles (normaux et spéciaux)
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
        const shake = isMobile ? 1 : 2;
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
          if (animationType === 'progression') {
            position = ((t * animationSpeed + phaseOffset) % (Math.PI * 2)) / (Math.PI * 2);
            gradient = ctx.createLinearGradient(
              cx - Math.cos(baseAngle) * r,
              cy - Math.sin(baseAngle) * r,
              cx + Math.cos(baseAngle) * r,
              cy + Math.sin(baseAngle) * r
            );
          } else {
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

  // 2. Dessin des bulles BD au-dessus des ronds spéciaux
  for (const { x, y } of specialCircles) {
    const key = `${x},${y}`;
    if (hiddenCircles.has(key)) continue;
    let cx = x * diameter + radius;
    let cy = y * diameter + radius;
    if (specialZones.has(key)) {
      const shake = isMobile ? 1 : 2;
      cx += (Math.random() - 0.5) * shake;
      cy += (Math.random() - 0.5) * shake;
    }
    
    // Dessiner les 4 traits autour du cercle spécial
    drawSpecialCircleMarkers(ctx, cx, cy, radius, t);
    
    // Récupère les coordonnées associées à ce rond
    const coords = circleCoords.get(key);
    // Récupère le texte unique pour cette bulle
    const bubbleText = bubbleTextMap.get(key) || "Par ici !";
    // Récupère la forme et la taille de queue pour cette bulle
    const bubbleShape = bubbleShapeMap.get(key) || { shape: "ellipse", tailSize: 1 };
    drawSpeechBubble(ctx, cx, cy, radius, x, y, t, coords, bubbleText, bubbleShape);
  }

  // Ajouter une mise en évidence spéciale pour les cercles avec un POI
  for (let y = 0; y < colorGrid.length; y++) {
    for (let x = 0; x < colorGrid[0].length; x++) {
      const key = `${x},${y}`;
      if (hiddenCircles.has(key)) continue;
      
      // Vérifier si ce cercle a un POI associé
      const poi = circlePOI.get(key);
      if (poi) {
        const cx = x * diameter + radius;
        const cy = y * diameter + radius;
        
        // Ajouter un effet visuel subtil pour indiquer les POI
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius + 2, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 255, 204, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        
        // Ajouter une pulsation
        const pulse = 0.5 + 0.5 * Math.sin(t * 2 + (x + y) / 3);
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 1.2 * pulse, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0, 255, 204, ${0.2 * pulse})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }
    }
  }
}

// Nouvelle fonction pour dessiner des marqueurs autour des cercles spéciaux
function drawSpecialCircleMarkers(ctx, cx, cy, r, t) {
  // Paramètres pour les traits - doublé la longueur et augmenté la distance
  const markerLength = r * 2.4; // Longueur doublée (environ 2 cercles)
  const markerDistance = r * 2.0; // Distance augmentée
  const markerWidth = 2.5;      // Légèrement plus épais
  
  // Couleur des traits avec une pulsation subtile basée sur le temps
  const opacity = 0.7 + 0.3 * Math.sin(t * 2);
  ctx.strokeStyle = `rgba(0, 255, 204, ${opacity})`;
  ctx.lineWidth = markerWidth;
  
  // Enregistrer l'état actuel du contexte
  ctx.save();
  
  // Effet de lueur grâce à une ombre
  ctx.shadowColor = 'rgba(0, 255, 204, 0.5)';
  ctx.shadowBlur = 12;
  
  // Rotation pour que les traits tournent dans le sens inverse des aiguilles d'une montre
  const rotationSpeed = 0.5; // Vitesse de rotation
  const angle = t * rotationSpeed;
  
  // Appliquer la rotation à partir du centre du cercle
  ctx.translate(cx, cy);
  ctx.rotate(-angle); // Sens anti-horaire (négatif)
  ctx.translate(-cx, -cy);
  
  // Trait du haut (devenu gauche avec la rotation)
  ctx.beginPath();
  ctx.moveTo(cx - markerLength/2, cy - markerDistance);
  ctx.lineTo(cx + markerLength/2, cy - markerDistance);
  ctx.stroke();
  
  // Trait du bas (devenu droit avec la rotation)
  ctx.beginPath();
  ctx.moveTo(cx - markerLength/2, cy + markerDistance);
  ctx.lineTo(cx + markerLength/2, cy + markerDistance);
  ctx.stroke();
  
  // Trait de gauche (devenu bas avec la rotation)
  ctx.beginPath();
  ctx.moveTo(cx - markerDistance, cy - markerLength/2);
  ctx.lineTo(cx - markerDistance, cy + markerLength/2);
  ctx.stroke();
  
  // Trait de droite (devenu haut avec la rotation)
  ctx.beginPath();
  ctx.moveTo(cx + markerDistance, cy - markerLength/2);
  ctx.lineTo(cx + markerDistance, cy + markerLength/2);
  ctx.stroke();
  
  ctx.restore();
}

// Fonction pour dessiner une bulle moderne à côté d'un cercle spécial
function drawSpeechBubble(ctx, cx, cy, r, x, y, t, coords, bubbleText, bubbleShape) {
  // *** POSITIONNEMENT DE LA BULLE ***
  // Cette section détermine où la bulle de texte sera placée par rapport au cercle
  const verticalOffset = r * 1.8; // Distance verticale entre le cercle et la bulle
  const offsetX = (x < colorGrid[0].length / 2) ? r * 2.4 : -r * 2.4; // Déplace la bulle à gauche ou à droite selon la position
  let bubbleX = cx + offsetX;
  let bubbleY = cy - verticalOffset;
  
  // Effet de rebond léger pour l'animation
  const bounce = Math.sin(t * 2) * 2; // Animation de rebond légère
  
  // *** CONFIGURATION DU TEXTE ***
  // Cette section définit la taille et le style du texte dans la bulle
  const fontSize = Math.round(r * 0.55); // Taille de police réduite (valeur à modifier pour changer la taille du texte)
  ctx.font = `500 ${fontSize}px 'Fira Mono', 'Consolas', monospace`;
  let textMetrics = ctx.measureText(bubbleText);
  let textWidth = textMetrics.width;
  
  // *** DIMENSIONS DE LA BULLE ***
  // Cette section calcule la largeur et hauteur de la bulle basées sur le texte
  const paddingX = r * 0.3; // Espace horizontal entre le texte et le bord de la bulle (valeur à réduire pour rétrécir la bulle)
  
  // Calculer les dimensions de la bulle
  const rectWidth = textWidth + paddingX * 2;
  
  // Hauteur de la bulle - à réduire pour rendre les bulles plus compactes
  const minRectHeight = fontSize * 1.3; // Hauteur minimale basée sur la taille du texte
  let rectHeight = coords ? fontSize * 2.8 : minRectHeight; // Plus haute si contient des coordonnées
  
  // Limites pour éviter de sortir du cadre
  const minX = (rectWidth/2 + 4) / (window.devicePixelRatio || 1);
  const maxX = (canvas.width / (window.devicePixelRatio || 1)) - rectWidth/2 - 4;
  const minY = (rectHeight/2 + 4) / (window.devicePixelRatio || 1);
  const maxY = (canvas.height / (window.devicePixelRatio || 1)) - rectHeight/2 - 4;
  
  // Ajuster si nécessaire
  if (bubbleX < minX) bubbleX = minX;
  if (bubbleX > maxX) bubbleX = maxX;
  if (bubbleY < minY) bubbleY = minY;
  if (bubbleY > maxY) bubbleY = maxY;
  
  // *** APPARENCE VISUELLE DE LA BULLE ***
  // Cette section définit le style graphique de la bulle
  const cornerRadius = r * 0.35; // Arrondi des coins (valeur à réduire pour coins moins arrondis)
  const shape = bubbleShape?.shape || "ellipse";
  const tailSize = bubbleShape?.tailSize || 1;
  
  // Couleur de fond et effets d'ombre
  ctx.fillStyle = 'rgba(0, 40, 30, 0.85)'; // Couleur de fond de la bulle
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 2;
  
  ctx.beginPath();
  
  // *** DESSIN DU CONTOUR DE LA BULLE ***
  // Cette section dessine réellement la forme de la bulle
  ctx.moveTo(bubbleX - rectWidth/2 + cornerRadius, bubbleY + bounce - rectHeight/2);
  ctx.arcTo(bubbleX + rectWidth/2, bubbleY + bounce - rectHeight/2, bubbleX + rectWidth/2, bubbleY + bounce - rectHeight/2 + cornerRadius, cornerRadius);
  ctx.arcTo(bubbleX + rectWidth/2, bubbleY + bounce + rectHeight/2, bubbleX + rectWidth/2 - cornerRadius, bubbleY + bounce + rectHeight/2, cornerRadius);
  ctx.arcTo(bubbleX - rectWidth/2, bubbleY + bounce + rectHeight/2, bubbleX - rectWidth/2, bubbleY + bounce + rectHeight/2 - cornerRadius, cornerRadius);
  ctx.arcTo(bubbleX - rectWidth/2, bubbleY + bounce - rectHeight/2, bubbleX - rectWidth/2 + cornerRadius, bubbleY + bounce - rectHeight/2, cornerRadius);
  ctx.closePath();
  
  // Remplir la bulle avec la couleur de fond
  ctx.globalAlpha = 1.0;
  ctx.fill();
  
  // Dessiner le contour
  ctx.strokeStyle = 'rgba(0, 255, 204, 0.6)';
  ctx.lineWidth = 1;
  ctx.stroke();
  
  // Réinitialiser les ombres pour le texte
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // *** RENDU DU TEXTE PRINCIPAL ***
  // Cette section dessine le texte dans la bulle
  ctx.font = `500 ${fontSize}px 'Fira Mono', 'Consolas', monospace`;
  ctx.fillStyle = '#00ffcc';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  
  // Position verticale du texte - ajuster pour centrer dans l'espace réduit
  let textYOffset = coords ? -fontSize * 0.7 : 0;
  ctx.fillText(bubbleText, bubbleX, bubbleY + bounce + textYOffset);

  // *** RENDU DES COORDONNÉES (si présentes) ***
  // Cette section ajoute les coordonnées géographiques sous le texte principal
  if (coords) {
    const coordsFontSize = Math.max(fontSize * 0.6, 8); // Taille de police pour les coordonnées
    ctx.font = `400 ${Math.round(coordsFontSize)}px 'Fira Mono', 'Consolas', monospace`;
    ctx.fillStyle = '#00ffcc';
    
    // Position des coordonnées - plus proches du texte principal pour compacter
    ctx.fillText(
      `${coords.lat.toFixed(4)}, ${coords.long.toFixed(4)}`,
      bubbleX,
      bubbleY + bounce + fontSize * 0.8 // Distance entre le texte principal et les coordonnées
    );
  }

  ctx.restore();
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

  // Vérifier si on survole un cercle valide et si les éléments DOM existent
  if (colorGrid[row]?.[col] && !hiddenCircles.has(key)) {
    const coords = circleCoords.get(key);
    
    // Vérifier si les coordonnées existent et si les éléments DOM sont disponibles
    if (coords && circleCoordDisplay && hoverLatSpan && hoverLongSpan) {
      // Afficher les coordonnées près du curseur
      hoverLatSpan.textContent = coords.lat.toFixed(6);
      hoverLongSpan.textContent = coords.long.toFixed(6);
      
      // Afficher le nom du POI s'il existe
      const poi = circlePOI.get(key);
      const poiNameContainer = document.querySelector('#circle-coord-display .poi-name-container');
      
      if (poi && poi.name && hoverPoiName) {
        hoverPoiName.textContent = poi.name;
        if (poiNameContainer) {
          poiNameContainer.style.display = 'block';
        }
      } else if (coords.name && hoverPoiName) {
        hoverPoiName.textContent = coords.name;
        if (poiNameContainer) {
          poiNameContainer.style.display = 'block';
        }
      } else {
        if (hoverPoiName) hoverPoiName.textContent = "Lieu inconnu";
        if (poiNameContainer) {
          poiNameContainer.style.display = 'block';
        }
      }
      
      circleCoordDisplay.style.display = 'block';
      
      // Positionner près du curseur
      circleCoordDisplay.style.top = `${my + 20}px`;
      circleCoordDisplay.style.left = `${mx + 20}px`;
      
      // Assurer que l'affichage ne sort pas de l'écran
      const displayRect = circleCoordDisplay.getBoundingClientRect();
      if (displayRect.right > window.innerWidth) {
        circleCoordDisplay.style.left = `${mx - displayRect.width - 20}px`;
      }
      if (displayRect.bottom > window.innerHeight) {
        circleCoordDisplay.style.top = `${my - displayRect.height - 20}px`;
      }
    }
  } else if (circleCoordDisplay) {
    circleCoordDisplay.style.display = 'none';
  }
}

// Fonction pour gérer la fin du survol
function handleHoverEnd() {
  if (numberDisplay) numberDisplay.style.display = 'none';
  if (circleCoordDisplay) circleCoordDisplay.style.display = 'none';
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
  const visited = new Set();
  const queue = [[col, row]];

  const toHide = new Set();

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

// Suppression des gestionnaires liés aux CGU
window.addEventListener("load", () => {
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

// Variables pour le jeu
let score = 0;
let timerSeconds = 70; // 1:10 en secondes
let timerInterval;
let gameActive = false;
const scoreDisplay = document.getElementById('score-display');
const backgroundMusic = document.getElementById('backgroundMusic');
const timerDisplay = document.getElementById('timer-display');
const startBtn = document.getElementById('start-game');
const gyroStatus = document.getElementById('gyro-status');

// Fonction pour mettre à jour l'affichage du score
function updateScoreDisplay() {
    if (scoreDisplay) {
        scoreDisplay.textContent = score;
    }
}

// Fonction pour mettre à jour le timer
function updateTimer() {
    if (timerSeconds <= 0) {
        endGame();
        return;
    }
    timerSeconds--;
    
    const minutes = Math.floor(timerSeconds / 60);
    const seconds = timerSeconds % 60;
    
    if (timerDisplay) {
        timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        // Alerte visuelle lorsque le temps est presque écoulé
        if (timerSeconds <= 10) {
            timerDisplay.style.color = "#ff0000";
            timerDisplay.style.animation = "pulse 1s infinite";
        }
    }
}

// Fonction pour démarrer le jeu
function startGame() {
    if (gameActive) return;
    
    gameActive = true;
    score = 0;
    updateScoreDisplay();
    
    // Cacher le bouton de démarrage
    if (startBtn) {
        startBtn.style.display = 'none';
    }
    
    // Afficher l'indicateur de gyroscope actif
    if (gyroStatus) {
        gyroStatus.classList.add("active");
        gyroStatus.style.opacity = 1;
    }
    
    // Démarrer la musique de fond
    if (backgroundMusic) {
        backgroundMusic.play().catch(e => console.log("Erreur de lecture audio:", e));
    }
    
    // Démarrer le timer
    timerInterval = setInterval(updateTimer, 1000);
}

// Fonction modifiée pour la fin du jeu qui sauvegarde le score dans le localStorage
function endGame() {
    clearInterval(timerInterval);
    gameActive = false;
    
    if (backgroundMusic) {
        backgroundMusic.pause();
        backgroundMusic.currentTime = 0;
    }
    
    // Sauvegarder le score dans le localStorage pour la page des scores
    localStorage.setItem('pending-score', score.toString());
    
    // Demander le nom du joueur
    let playerName = prompt(`Temps écoulé! Score final: ${score}\n\nEntrez votre nom:`, "Joueur");
    
    // Si l'utilisateur annule, on utilise "Joueur" par défaut
    if (playerName === null || playerName.trim() === '') {
        playerName = "Joueur";
    }
    
    // Sauvegarder le nom du joueur
    localStorage.setItem('pending-player', playerName);
    
    // Indiquer que le jeu est terminé pour que la page des scores puisse le détecter
    localStorage.setItem("game-state", "finished");
    
    // Proposer d'aller à la page des scores
    setTimeout(() => {
        if (confirm("Voulez-vous voir le tableau des scores?")) {
            window.location.href = "scores.html";
        } else {
            // Réinitialiser le jeu
            resetGame();
        }
    }, 500);
}

// Fonction pour réinitialiser le jeu
function resetGame() {
    score = 0;
    updateScoreDisplay();
    timerSeconds = 70; // Remettre à 70 secondes pour la prochaine partie
    if (timerDisplay) {
        timerDisplay.textContent = "01:10";
        timerDisplay.style.color = "white";
        timerDisplay.style.animation = "none";
    }
    
    // Afficher à nouveau le bouton de démarrage
    if (startBtn) {
        startBtn.style.display = 'block';
    }
    
    if (gyroStatus) {
        gyroStatus.classList.remove("active");
        gyroStatus.style.opacity = 0;
    }
}

// Initialiser les éléments du jeu si présents
document.addEventListener('DOMContentLoaded', () => {
    // Si les éléments du jeu sont présents, configurer les écouteurs d'événements
    if (startBtn) {
        startBtn.addEventListener('click', startGame);
    }
        // Initialiser l'affichage du score
    updateScoreDisplay();
});