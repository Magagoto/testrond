
document.getElementById('erase-circles').addEventListener('click', function() {
  // Retourner à la page précédente
  history.back();
});
   
  const ball = document.getElementById("ball");
    const startBtn = document.getElementById("start-btn");
    const info = document.getElementById("info");

    // Dégradés cycliques prédéfinis
    const gradients = [
      ["#00A993", "#E68B4A"],
      ["#E68B4A", "#7A1619"],
      ["#7A1619", "#362777"],
      ["#362777", "#EB7AAE"],
      ["#EB7AAE", "#0069AA"],
      ["#0069AA", "#DC0C15"],
      ["#DC0C15", "#E03A8D"],
      ["#E03A8D", "#FFFFFF"],
      ["#FFFFFF", "#2A4899"],
      ["#2A4899", "#00A993"]
    ];

    // Choix aléatoire d'un dégradé
    const gradient = gradients[Math.floor(Math.random() * gradients.length)];
    ball.style.background = `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`;

    let posX = window.innerWidth / 2;
    let posY = window.innerHeight / 2;
    let velX = 0;
    let velY = 0;

    const ballSize = 80;
    const friction = 0.98;
    const accelerationFactor = 0.3;

    function updateBallPosition() {
      posX += velX;
      posY += velY;

      if (posX <= 0) {
        posX = 0;
        velX *= -0.7;
      } else if (posX >= window.innerWidth - ballSize) {
        posX = window.innerWidth - ballSize;
        velX *= -0.7;
      }

      if (posY <= 0) {
        posY = 0;
        velY *= -0.7;
      } else if (posY >= window.innerHeight - ballSize) {
        posY = window.innerHeight - ballSize;
        velY *= -0.7;
      }

      velX *= friction;
      velY *= friction;

      ball.style.left = posX + "px";
      ball.style.top = posY + "px";

      requestAnimationFrame(updateBallPosition);
    }

    function startGyro() {
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
          .then(permissionState => {
            if (permissionState === 'granted') {
              enableGyro();
              startBtn.style.display = 'none';
              info.textContent = "Gyroscope activé ✔️";
            } else {
              info.textContent = "Permission refusée ❌";
            }
          })
          .catch(console.error);
      } else {
        enableGyro();
        startBtn.style.display = 'none';
        info.textContent = "Gyroscope activé ✔️";
      }
    }

    function enableGyro() {
      window.addEventListener("deviceorientation", (event) => {
        const gamma = event.gamma || 0;
        const beta = event.beta || 0;

        velX += gamma * accelerationFactor;
        velY += beta * accelerationFactor;
      });

      updateBallPosition();
    }

    startBtn.addEventListener("click", startGyro);
