// Stars background canvas
(function() {
  const canvas = document.getElementById('stars-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let stars = [];
  const NUM_STARS = 200;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function createStars() {
    stars = [];
    for (let i = 0; i < NUM_STARS; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.2 + 0.2,
        alpha: Math.random() * 0.7 + 0.2,
        speed: Math.random() * 0.4 + 0.1,
        twinkleOffset: Math.random() * Math.PI * 2,
      });
    }
  }

  let animFrame;
  function draw(t) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const time = t * 0.001;
    stars.forEach(s => {
      const twinkle = 0.5 + 0.5 * Math.sin(time * s.speed + s.twinkleOffset);
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${s.alpha * twinkle})`;
      ctx.fill();
    });
    animFrame = requestAnimationFrame(draw);
  }

  resize();
  createStars();
  requestAnimationFrame(draw);

  window.addEventListener('resize', () => {
    resize();
    createStars();
  });
})();
