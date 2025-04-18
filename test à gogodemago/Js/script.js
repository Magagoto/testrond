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

  // Fonction pour générer des coordonnées aléatoires d'Orléans
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
                const color = colorGrid[y][x]; // Couleur du cercle spécial
                specialCircles.push({ x, y, link: specialLinks[count++], color });
                const zone = getZone(x, y, color);
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
            window.open(link, '_blank'); // Ouvrir la page annexe
            return;
        }
    }

    // Si ce n'est pas un cercle spécial, ne rien faire
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

  // Fonction pour effacer les cercles connectés à une couleur spécifique
  function eraseConnectedCircles(color) {
    const toHide = new Set();
    const visited = new Set();

    // Parcourir tous les cercles pour trouver ceux qui correspondent à la couleur
    for (let y = 0; y < colorGrid.length; y++) {
        for (let x = 0; x < colorGrid[0].length; x++) {
            const key = `${x},${y}`;
            if (colorGrid[y][x] === color && !hiddenCircles.has(key)) {
                const queue = [[x, y]];

                while (queue.length) {
                    const [cx, cy] = queue.shift();
                    const ckey = `${cx},${cy}`;
                    if (visited.has(ckey)) continue;
                    visited.add(ckey);

                    if (colorGrid[cy]?.[cx] === color && !hiddenCircles.has(ckey)) {
                        toHide.add(ckey);
                        for (let dy = -1; dy <= 1; dy++) {
                            for (let dx = -1; dx <= 1; dx++) {
                                if (dx !== 0 || dy !== 0) queue.push([cx + dx, cy + dy]);
                            }
                        }
                    }
                }
            }
        }
    }

    // Appliquer l'animation d'effacement
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

// Écouter les messages des pages annexes
window.addEventListener('message', (event) => {
    console.log("Message reçu :", event.data);
    if (event.data.action === 'eraseCircles') {
        const color = event.data.color; // Couleur à effacer
        if (color) {
            console.log(`Effacement des cercles de couleur : ${color}`);
            eraseConnectedCircles(color);
        } else {
            console.error("Aucune couleur spécifiée pour effacer les cercles.");
        }
    }
});

document.getElementById('erase-circles').addEventListener('click', () => {
    if (window.opener) {
        console.log("Envoi du message à la page principale...");
        window.opener.postMessage({ action: 'eraseCircles', color: '#E68B4A' }, '*');
    } else {
        console.error("La page principale n'est pas accessible.");
    }
});

