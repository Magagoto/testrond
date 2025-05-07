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

// Liste des textes possibles pour les bulles
const bubbleTexts = [
  "De ce côté !",
  "C’est par là !",
  "Suis-moi !",
  "Viens donc !",
  "Par là, vite !",
  "Par ce chemin !",
  "Approche !",
  "Viens par ici !",
  "Par ici, l’ami !",
  "Par là que ça se passe !",
  "C’est ici que ça se passe !",
  "Suivez cette direction !",
  "Entre donc ici !",
  "C’est la bonne voie !",
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

// Correction de la fonction pour générer des coordonnées aléatoires d'Orléans
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
    // Attribue un texte unique à cette bulle
    const text = shuffledTexts.shift() || "Par ici !";
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
  ctx.clearRect(0, 0, canvas.width, canvas.height);
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
  
  // Restaurer l'état du contexte
  ctx.restore();
}

// Fonction améliorée pour dessiner une bulle moderne à côté d'un cercle spécial
function drawSpeechBubble(ctx, cx, cy, r, x, y, t, coords, bubbleText, bubbleShape) {
  // Décalage horizontal et vertical pour ne pas masquer le rond
  const verticalOffset = r * 2.2;
  let offsetX = (x < colorGrid[0].length / 2) ? r * 2.6 : -r * 2.6;
  let bubbleX = cx + offsetX;
  let bubbleY = cy - r * 0.7 - verticalOffset;
  const bounce = Math.sin(t * 2 + x + y) * 3;

  ctx.save();
  
  // Utilise une police plus moderne
  ctx.font = `500 ${Math.round(r * 0.68)}px 'Segoe UI', Roboto, -apple-system, sans-serif`;
  const textMetrics = ctx.measureText(bubbleText);
  const textWidth = textMetrics.width;

  let coordsWidth = 0;
  if (coords) {
    ctx.font = `400 ${Math.round(r * 0.48)}px 'Segoe UI', Roboto, -apple-system, sans-serif`;
    coordsWidth = ctx.measureText(`${coords.lat.toFixed(4)}, ${coords.long.toFixed(4)}`).width;
  }

  const maxTextWidth = Math.max(textWidth, coordsWidth);
  const paddingX = r * 0.7;
  const paddingY = r * 0.7;
  const mainW = Math.max(r * 2.3, (maxTextWidth / 2) + paddingX);
  const mainH = r * 1.25 + paddingY * 0.3;

  // Ajustement pour éviter de sortir du cadre
  const minX = mainW + 4;
  const maxX = canvas.width / (window.devicePixelRatio || 1) - mainW - 4;
  const minY = mainH + 4;
  const maxY = canvas.height / (window.devicePixelRatio || 1) - mainH - 4;

  if (bubbleX < minX) bubbleX = minX;
  if (bubbleX > maxX) bubbleX = maxX;
  if (bubbleY < minY) bubbleY = minY;
  if (bubbleY > maxY) bubbleY = maxY;

  const shape = bubbleShape?.shape || "ellipse";
  const tailSize = bubbleShape?.tailSize || 1;

  // Aligner sur le style du rectangle de localisation
  // Fond avec transparence réduite
  ctx.fillStyle = "rgba(0, 255, 204, 0.2)"; // Même couleur que le user-location-box
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 2;

  // Dessiner la bulle principale comme un rectangle arrondi (comme user-location-box)
  const cornerRadius = r * 0.4; // Rayon des coins arrondi
  const rectWidth = mainW * 2;
  const rectHeight = mainH * 2;
  
  ctx.beginPath();
  // Dessiner un rectangle arrondi comme user-location-box
  ctx.moveTo(bubbleX - rectWidth/2 + cornerRadius, bubbleY + bounce - rectHeight/2);
  // Dessiner le haut
  ctx.arcTo(bubbleX + rectWidth/2, bubbleY + bounce - rectHeight/2, bubbleX + rectWidth/2, bubbleY + bounce - rectHeight/2 + cornerRadius, cornerRadius);
  // Dessiner le côté droit
  ctx.arcTo(bubbleX + rectWidth/2, bubbleY + bounce + rectHeight/2, bubbleX + rectWidth/2 - cornerRadius, bubbleY + bounce + rectHeight/2, cornerRadius);
  // Dessiner le bas
  ctx.arcTo(bubbleX - rectWidth/2, bubbleY + bounce + rectHeight/2, bubbleX - rectWidth/2, bubbleY + bounce + rectHeight/2 - cornerRadius, cornerRadius);
  // Dessiner le côté gauche
  ctx.arcTo(bubbleX - rectWidth/2, bubbleY + bounce - rectHeight/2, bubbleX - rectWidth/2 + cornerRadius, bubbleY + bounce - rectHeight/2, cornerRadius);
  
  ctx.closePath();
  
  // Appliquer couleur de fond et effet blur comme user-location-box
  ctx.fill();
  
  // Bordure identique au user-location-box
  ctx.strokeStyle = 'rgba(0, 255, 204, 0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();
  
  // Réinitialiser les ombres pour le texte
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Texte principal dans la couleur du user-location-box
  ctx.font = `500 ${Math.round(r * 0.68)}px 'Fira Mono', 'Consolas', monospace`;
  ctx.fillStyle = '#00ffcc'; // Couleur du texte identique au user-location-box
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(bubbleText, bubbleX, bubbleY + bounce - r * 0.18);

  // Coordonnées avec un style semblable au info-value du user-location-box
  if (coords) {
    ctx.font = `400 ${Math.round(r * 0.48)}px 'Fira Mono', 'Consolas', monospace`;
    ctx.fillStyle = '#00ffcc'; // Couleur du texte identique au user-location-box
    ctx.fillText(
      `${coords.lat.toFixed(4)}, ${coords.long.toFixed(4)}`,
      bubbleX,
      bubbleY + bounce + r * 0.38
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

// Suppression de la fonction initCguDecor qui n'est plus nécessaire

// Suppression des fonctions acceptCGU et refuseCGU qui ne sont plus nécessaires

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
  // initCguDecor(); - Supprimé
  
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

// Suppression de la vérification de redimensionnement liée aux CGU

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

// Fonction modifiée pour la fin du jeu qui sauvegarde le score dans le localStorage
function endGame() {
    clearInterval(timerInterval);
    gameActive = false;
    
    backgroundMusic.pause();
    backgroundMusic.currentTime = 0;
    
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
    timerDisplay.textContent = "01:10";
    timerDisplay.style.color = "white";
    timerDisplay.style.animation = "none";
    
    // Afficher à nouveau le bouton de démarrage
    startBtn.style.display = 'block';
    gyroStatus.classList.remove("active");
    gyroStatus.style.opacity = 0;
}