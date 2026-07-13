(function() {
  const canvas = document.createElement('canvas');
  canvas.id = 'snow-canvas';
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9;';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  let w, h, particles = [];
  const count = 60;

  function resize() { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; }
  resize();
  window.addEventListener('resize', resize);

  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 3 + 1,
      speed: Math.random() * 1 + 0.3,
      wind: Math.random() * 0.5 - 0.25,
      opacity: Math.random() * 0.6 + 0.3
    });
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
      ctx.fill();
      p.y += p.speed;
      p.x += p.wind;
      if (p.y > h) { p.y = -5; p.x = Math.random() * w; }
      if (p.x > w) p.x = 0;
      if (p.x < 0) p.x = w;
    });
    requestAnimationFrame(draw);
  }
  draw();
})();
