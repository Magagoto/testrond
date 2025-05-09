// Variables globales
let stream;
let currentFilter = 'normal';
let facingMode = 'user'; // Par défaut, caméra frontale
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusMessage = document.getElementById('statusMessage');
const photoGallery = document.getElementById('photoGallery');
const videoPlaceholder = document.getElementById('videoPlaceholder');
let photos = JSON.parse(localStorage.getItem('capturedPhotos')) || [];

// Définir les dégradés possibles
const gradientMap = {
    "#00A993": "#E68B4A", "#E68B4A": "#7A1619", "#7A1619": "#362777",
    "#362777": "#EB7AAE", "#EB7AAE": "#0069AA", "#0069AA": "#DC0C15",
    "#DC0C15": "#E03A8D", "#E03A8D": "#FFFFFF", "#FFFFFF": "#2A4899",
    "#2A4899": "#00A993"
};

// Fonction pour choisir un dégradé aléatoire
function setRandomGradient() {
    const colors = Object.entries(gradientMap);
    const randomIndex = Math.floor(Math.random() * colors.length);
    const [startColor, endColor] = [colors[randomIndex][0], colors[randomIndex][1]];
    videoPlaceholder.style.background = `linear-gradient(135deg, ${startColor}, ${endColor})`;
}

// Appliquer un dégradé aléatoire au démarrage
setRandomGradient();

// Changer de mode (caméra ou galerie)
document.getElementById('cameraMode').addEventListener('click', () => {
    document.getElementById('cameraMode').classList.add('active');
    document.getElementById('galleryMode').classList.remove('active');
    document.getElementById('cameraModeContainer').classList.remove('hidden');
    document.getElementById('galleryModeContainer').classList.add('hidden');
    
    // Redémarrer l'analyse de couleur si nécessaire
    if (stream && !colorAnalysisInterval) {
        startRealtimeColorAnalysis();
    }
});

document.getElementById('galleryMode').addEventListener('click', () => {
    document.getElementById('galleryMode').classList.add('active');
    document.getElementById('cameraMode').classList.remove('active');
    document.getElementById('cameraModeContainer').classList.add('hidden');
    document.getElementById('galleryModeContainer').classList.remove('hidden');
    
    // Arrêter l'analyse de couleur en mode galerie pour économiser les ressources
    stopRealtimeColorAnalysis();
    
    loadGallery();
});

// Gestion des effets
document.querySelectorAll('.effect-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.effect-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        applyVideoFilter();
    });
});

// Fonction pour appliquer les filtres à la vidéo
function applyVideoFilter() {
    switch(currentFilter) {
        case 'grayscale':
            video.style.filter = 'grayscale(100%)';
            break;
        case 'sepia':
            video.style.filter = 'sepia(100%)';
            break;
        case 'invert':
            video.style.filter = 'invert(100%)';
            break;
        default:
            video.style.filter = 'none';
    }
}

// Variables pour l'analyse en temps réel
const realtimeColor = document.getElementById('realtime-color');
const colorPreview = document.getElementById('color-preview');
const colorValue = document.getElementById('color-value');
const focusGrid = document.getElementById('focus-grid');
let colorAnalysisInterval;

// Fonction améliorée pour extraire la couleur dominante, privilégiant la zone centrale
function extractDominantColor(imageData, focusOnCenter = false) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const colorCounts = {};
    
    // Déterminer la zone centrale (40% de l'image au centre)
    const centerStartX = Math.floor(width * 0.3);
    const centerEndX = Math.floor(width * 0.7);
    const centerStartY = Math.floor(height * 0.3);
    const centerEndY = Math.floor(height * 0.7);
    
    // Pas d'échantillonnage (plus petit = plus précis mais plus lent)
    const step = 5;
    
    // Analyser les pixels
    for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
            // Si on se concentre sur le centre et que le pixel est hors de cette zone, on le saute
            if (focusOnCenter && (
                x < centerStartX || x > centerEndX || 
                y < centerStartY || y > centerEndY
            )) {
                continue;
            }
            
            const i = (y * width + x) * 4;
            
            // Ignorer les pixels transparents ou trop sombres
            if (data[i + 3] < 128 || (data[i] < 30 && data[i + 1] < 30 && data[i + 2] < 30)) {
                continue;
            }
            
            // Simplifier les valeurs RGB pour réduire le nombre total de couleurs
            const r = Math.floor(data[i] / 10) * 10;
            const g = Math.floor(data[i + 1] / 10) * 10;
            const b = Math.floor(data[i + 2] / 10) * 10;
            
            const colorKey = `${r},${g},${b}`;
            
            if (!colorCounts[colorKey]) {
                colorCounts[colorKey] = 0;
            }
            
            // Donner plus de poids aux couleurs vives
            const saturation = Math.max(r, g, b) - Math.min(r, g, b);
            const weight = 1 + saturation / 255;
            
            colorCounts[colorKey] += weight;
        }
    }
    
    // Trouver la couleur avec le plus grand nombre d'occurrences
    let maxCount = 0;
    let dominantColor = '0,0,0';
    
    for (const colorKey in colorCounts) {
        if (colorCounts[colorKey] > maxCount) {
            maxCount = colorCounts[colorKey];
            dominantColor = colorKey;
        }
    }
    
    const [r, g, b] = dominantColor.split(',').map(Number);
    return {
        rgb: `rgb(${r}, ${g}, ${b})`,
        hex: `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
    };
}

// Fonction pour analyser en temps réel la couleur dominante
function startRealtimeColorAnalysis() {
    if (colorAnalysisInterval) {
        clearInterval(colorAnalysisInterval);
    }
    
    if (!realtimeColor) return;
    
    // Créer un canvas temporaire pour l'analyse
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true }); // Optimisation pour la lecture fréquente
    
    // Ajuster l'intervalle selon le type d'appareil
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const interval = isMobile ? 500 : 300; // Encore moins fréquent sur mobile
    
    let analysisCount = 0;
    colorAnalysisInterval = setInterval(() => {
        if (!stream || !video.videoWidth || video.paused || video.ended) {
            // Si pas encore de flux vidéo, garder l'élément masqué
            realtimeColor.classList.add('hidden');
            return;
        }
        
        try {
            // Définir les dimensions du canvas temporaire
            if (tempCanvas.width !== video.videoWidth || tempCanvas.height !== video.videoHeight) {
                tempCanvas.width = video.videoWidth;
                tempCanvas.height = video.videoHeight;
            }
            
            // Dessiner la frame actuelle sur le canvas temporaire
            tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
            
            // Extraire la couleur dominante de la zone centrale
            const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
            const dominantColor = extractDominantColor(imageData, true);
            
            // Mettre à jour l'affichage de la couleur
            colorPreview.style.backgroundColor = dominantColor.rgb;
            colorValue.textContent = dominantColor.hex;
            
            // Montrer l'élément après la première analyse réussie
            realtimeColor.classList.remove('hidden');
            
            // Sur mobile, après quelques analyses réussies, ralentir encore plus l'intervalle
            if (isMobile && ++analysisCount > 10) {
                clearInterval(colorAnalysisInterval);
                colorAnalysisInterval = setInterval(arguments.callee, 800); // Intervalle plus lent
                analysisCount = -1000; // Éviter de réinitialiser à nouveau
            }
        } catch (e) {
            console.error('Erreur dans l\'analyse de couleur:', e);
            // Ne pas masquer l'élément en cas d'erreur temporaire
        }
    }, interval);
}

function stopRealtimeColorAnalysis() {
    if (colorAnalysisInterval) {
        clearInterval(colorAnalysisInterval);
        colorAnalysisInterval = null;
    }
}

// Initialiser la caméra
async function initCamera() {
    try {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stopRealtimeColorAnalysis();
        }

        // Masquer le panneau de couleur en temps réel jusqu'à ce que la caméra soit prête
        if (realtimeColor) realtimeColor.classList.add('hidden');

        // Montrer le placeholder pendant le chargement
        videoPlaceholder.style.display = 'flex';

        // Détection spécifique pour iPhone/iPad
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        let constraints;
        
        if (isIOS) {
            // Paramètres spécifiques pour iOS qui ont tendance à mieux fonctionner
            constraints = {
                audio: false,
                video: {
                    facingMode: facingMode,
                    width: { ideal: 480 },
                    height: { ideal: 360 }
                }
            };
        } else if (isMobile) {
            constraints = {
                audio: false,
                video: {
                    facingMode: facingMode,
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                }
            };
        } else {
            constraints = {
                audio: false,
                video: {
                    facingMode: facingMode,
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            };
        }

        console.log("Tentative d'accès à la caméra avec les contraintes:", constraints);
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // S'assurer que l'élément vidéo est visible et correctement configuré
        video.style.display = 'block';
        video.setAttribute('playsinline', true); // Important pour iOS
        video.setAttribute('autoplay', true);
        video.srcObject = stream;
        
        // Forcer le démarrage de la vidéo
        try {
            await video.play();
            console.log("La vidéo est en cours de lecture");
        } catch (e) {
            console.error("Erreur lors du démarrage de la vidéo:", e);
            // Sur iOS, l'autoplay peut être bloqué - invitez l'utilisateur à interagir
            if (isIOS) {
                statusMessage.textContent = "Touchez l'écran pour activer la caméra";
                document.body.addEventListener('touchstart', function iosVideoFix() {
                    video.play();
                    document.body.removeEventListener('touchstart', iosVideoFix);
                }, { once: true });
            }
        }
        
        // Masquer le placeholder une fois que la vidéo est en lecture
        video.addEventListener('playing', function onPlaying() {
            console.log("Événement 'playing' déclenché");
            videoPlaceholder.style.display = 'none';
            statusMessage.textContent = 'Caméra active et fonctionnelle.';
            video.removeEventListener('playing', onPlaying);
        });
        
        video.onloadedmetadata = () => {
            console.log("Métadonnées vidéo chargées:", video.videoWidth, "x", video.videoHeight);
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            // Démarrer l'analyse de couleur avec un léger délai
            setTimeout(() => {
                startRealtimeColorAnalysis();
            }, 500);
        };

        applyVideoFilter();
    } catch (error) {
        console.error('Erreur complète d\'accès à la caméra:', error);
        statusMessage.textContent = `Erreur d'accès à la caméra: ${error.message}`;
        videoPlaceholder.style.display = 'flex';
        videoPlaceholder.innerHTML = `
            <div style="text-align: center;">
                <p>Erreur d'accès à la caméra: ${error.message}</p>
                <button onclick="requestCameraAgain()" style="margin-top: 15px; padding: 8px 15px; background: rgba(0,255,204,0.2); color: #00ffcc; border: 1px solid #00ffcc; border-radius: 8px;">
                    Réessayer
                </button>
            </div>
        `;
    }
}

// Fonction pour réessayer d'accéder à la caméra (à ajouter)
function requestCameraAgain() {
    videoPlaceholder.innerHTML = 'Nouvelle tentative d\'accès à la caméra...';
    setTimeout(() => {
        initCamera();
    }, 500);
}

// Capturer une photo
document.getElementById('captureBtn').addEventListener('click', () => {
    // Dessiner l'image actuelle de la vidéo sur le canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Appliquer le même filtre au canvas
    let filterCSS = '';
    switch(currentFilter) {
        case 'grayscale':
            filterCSS = 'grayscale(100%)';
            break;
        case 'sepia':
            filterCSS = 'sepia(100%)';
            break;
        case 'invert':
            filterCSS = 'invert(100%)';
            break;
    }
    
    if (filterCSS) {
        ctx.filter = filterCSS;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.filter = 'none';
    }
    
    // Extraire la couleur dominante avec focus sur la zone centrale
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const dominantColor = extractDominantColor(imageData, true);
    
    // Convertir en URL data
    const photoDataUrl = canvas.toDataURL('image/jpeg');
    
    // Sauvegarder la photo avec la couleur dominante
    savePhoto(photoDataUrl, dominantColor);
    
    // Afficher message de confirmation
    statusMessage.textContent = 'Photo capturée et enregistrée!';
    setTimeout(() => {
        statusMessage.textContent = 'Caméra prête. Vous pouvez prendre une photo.';
    }, 2000);
});

// Sauvegarder une photo
function savePhoto(dataUrl, dominantColor) {
    const timestamp = new Date().toISOString();
    photos.push({
        id: Date.now().toString(),
        url: dataUrl,
        timestamp: timestamp,
        dominantColor: dominantColor
    });
    localStorage.setItem('capturedPhotos', JSON.stringify(photos));
}

// Charger la galerie de photos
function loadGallery() {
    photoGallery.innerHTML = '';
    
    if (photos.length === 0) {
        photoGallery.innerHTML = '<p>Aucune photo dans la galerie. Prenez des photos pour les voir ici.</p>';
        return;
    }
    
    photos.forEach((photo, index) => {
        const photoElement = document.createElement('div');
        photoElement.className = 'gallery-item';
        
        // Vérifier si la photo a une couleur dominante (pour la compatibilité avec les anciennes photos)
        const dominantColor = photo.dominantColor || { rgb: 'rgb(128, 128, 128)', hex: '#808080' };
        
        photoElement.innerHTML = `
            <img class="gallery-img" src="${photo.url}" alt="Photo ${index + 1}">
            <button class="delete-btn" data-id="${photo.id}">✕</button>
            <div class="color-info">
                <div class="color-swatch" style="background-color: ${dominantColor.rgb}"></div>
                <span>${dominantColor.hex}</span>
            </div>
        `;
        photoGallery.appendChild(photoElement);
    });

    // Ajouter des gestionnaires d'événements pour les boutons de suppression
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const photoId = e.target.dataset.id;
            deletePhoto(photoId);
        });
    });
}

// Supprimer une photo
function deletePhoto(photoId) {
    photos = photos.filter(photo => photo.id !== photoId);
    localStorage.setItem('capturedPhotos', JSON.stringify(photos));
    loadGallery();
}

// Supprimer toutes les photos
document.getElementById('clearAllBtn').addEventListener('click', () => {
    if (confirm('Êtes-vous sûr de vouloir supprimer toutes les photos?')) {
        photos = [];
        localStorage.setItem('capturedPhotos', JSON.stringify(photos));
        loadGallery();
    }
});

// Vérifier si le navigateur prend en charge getUserMedia
if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    statusMessage.textContent = 'Votre navigateur ne prend pas en charge l\'accès à la caméra.';
    videoPlaceholder.textContent = 'Votre navigateur ne prend pas en charge l\'accès à la caméra.';
} else {
    initCamera();
}

// Arrêter l'analyse de couleur lorsque l'utilisateur quitte la page
window.addEventListener('beforeunload', () => {
    stopRealtimeColorAnalysis();
});

// Fonction pour détecter les changements d'orientation sur mobile
function handleOrientationChange() {
    // Recalculer les dimensions si nécessaire
    if (video.videoWidth && video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
    }
    
    // S'assurer que les panneaux s'adaptent correctement
    const galleryContainer = document.getElementById('galleryModeContainer');
    if (!galleryContainer.classList.contains('hidden')) {
        loadGallery(); // Réorganiser la galerie après rotation
    }
}

// Ajouter des écouteurs pour les changements d'orientation
window.addEventListener('orientationchange', function() {
    setTimeout(handleOrientationChange, 300); // Attendre que le navigateur termine le changement
});

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', function() {
    // Pour iOS: demander la permission audio/vidéo au chargement
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIOS) {
        // En iOS 13+, les permissions audio/vidéo nécessitent une interaction utilisateur
        document.body.addEventListener('touchstart', function iosPermissionFix() {
            document.body.removeEventListener('touchstart', iosPermissionFix);
            // Juste pour forcer une demande de permission
            navigator.mediaDevices.getUserMedia({audio: false, video: true})
                .then(tempStream => {
                    // Arrêter immédiatement ce flux temporaire
                    tempStream.getTracks().forEach(track => track.stop());
                    initCamera();
                })
                .catch(err => {
                    console.error("Erreur lors de la demande de permission iOS:", err);
                    initCamera();
                });
        }, { once: true });
    }
    
    // Gérer les événements de visibilité pour économiser la batterie
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            // La page n'est pas visible, suspendre l'analyse de couleur
            stopRealtimeColorAnalysis();
        } else if (video.srcObject && !document.getElementById('galleryModeContainer').classList.contains('hidden')) {
            // La page est visible à nouveau et nous sommes en mode caméra
            startRealtimeColorAnalysis();
        }
    });
    
    // Fixer l'orientation sur mobile pour éviter les problèmes de redimensionnement
    window.addEventListener('resize', function() {
        const isMobile = window.innerWidth <= 768;
        if (isMobile && video.srcObject) {
            // Recalculer les dimensions pour s'adapter à la nouvelle orientation
            setTimeout(() => {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
            }, 300);
        }
    });

    // S'assurer que l'interface s'adapte correctement au chargement
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        statusMessage.textContent = 'Votre navigateur ne prend pas en charge l\'accès à la caméra.';
        videoPlaceholder.textContent = 'Votre navigateur ne prend pas en charge l\'accès à la caméra.';
    } else {
        initCamera();
    }
});

// Ajouter un gestionnaire d'événements pour le bouton de changement de caméra
document.getElementById('switchCamera').addEventListener('click', () => {
    // Changer le mode de la caméra
    facingMode = facingMode === 'user' ? 'environment' : 'user';
    // Réinitialiser la caméra avec la nouvelle orientation
    initCamera();
});

// Rendre la fonction requestCameraAgain accessible globalement
window.requestCameraAgain = requestCameraAgain;
