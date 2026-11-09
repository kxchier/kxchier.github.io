function initializeWordFish() {
  const canvas = document.querySelector(".word-fish");
  if (!canvas || canvas.dataset.initialized) return;
  canvas.dataset.initialized = "true";

  const words = (canvas.dataset.words || "whimsical, serendipitous, inquisitive")
    .split(",")
    .map((word) => word.trim())
    .filter(Boolean);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ctx = canvas.getContext("2d");
  const ink = getComputedStyle(canvas).color;
  const base = buildOutline();
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  const school = words.map((word, i) => ({
    word,
    phrase: Array.from(word + " · "),
    widths: null,
    phraseWidth: 0,
    scale: 0.82 + Math.min(word.length, 14) * 0.025,
    len: 0,
    fontSize: 0,
    seed: i * 2.1 + Math.random() * 0.6,
    speed: 0.85 + Math.random() * 0.3,
    phase: Math.random() * 6,
    offset: Math.random() * 100,
    pos: null,
    velocity: { x: 0, y: 0 },
    face: i % 2 ? -1 : 1,
    faceTarget: i % 2 ? -1 : 1,
    tilt: 0,
    nextBubble: 1 + Math.random() * 2.5,
  }));

  let width = 0;
  let height = 0;
  let time = Math.random() * 60;
  let pointer = null;
  let bubbles = [];
  let last = performance.now();

  function buildOutline() {
    const curve = (a, c, b, n) =>
      Array.from({ length: n }, (_, i) => {
        const t = (i + 1) / n;
        const u = 1 - t;
        return [
          u * u * a[0] + 2 * u * t * c[0] + t * t * b[0],
          u * u * a[1] + 2 * u * t * c[1] + t * t * b[1],
        ];
      });

    const top = [];
    const bottom = [];
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = 0.5 - t * 0.72;
      const h = 0.2 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.7)), 0.85) + 0.035 * t;
      top.push([x, -h]);
      bottom.push([x, h]);
    }

    // Clockwise on screen (nose on the right), so text along the back reads upright.
    let loop = [
      ...bottom,
      ...curve([-0.22, 0.035], [-0.33, 0.06], [-0.46, 0.2], 9),
      ...curve([-0.46, 0.2], [-0.54, 0.25], [-0.5, 0.12], 6),
      ...curve([-0.5, 0.12], [-0.45, 0.05], [-0.41, 0], 5),
      ...curve([-0.41, 0], [-0.45, -0.05], [-0.5, -0.12], 5),
      ...curve([-0.5, -0.12], [-0.54, -0.25], [-0.46, -0.2], 6),
      ...curve([-0.46, -0.2], [-0.33, -0.06], [-0.22, -0.035], 9),
      ...top.reverse().slice(1, -1),
    ];

    // Round the corners so letters don't pile up at the nose and tail tips.
    for (let pass = 0; pass < 3; pass++) {
      loop = loop.flatMap((p, i) => {
        const q = loop[(i + 1) % loop.length];
        return [
          [p[0] * 0.75 + q[0] * 0.25, p[1] * 0.75 + q[1] * 0.25],
          [p[0] * 0.25 + q[0] * 0.75, p[1] * 0.25 + q[1] * 0.75],
        ];
      });
    }
    return [...loop, loop[0]];
  }

  function font(size) {
    return `italic ${size}px "EB Garamond", Georgia, serif`;
  }

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return false;
    const dpr = window.devicePixelRatio || 1;
    if (w !== width || h !== height) {
      width = w;
      height = h;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      const unit = Math.min(w * 0.27, h * 0.48);
      for (const fish of school) {
        fish.len = unit * fish.scale;
        const size = Math.max(6.5, Math.round(fish.len * 0.1 * 10) / 10);
        if (size !== fish.fontSize) {
          fish.fontSize = size;
          fish.widths = null;
        }
      }
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return true;
  }

  function measure(fish) {
    ctx.font = font(fish.fontSize);
    fish.widths = fish.phrase.map((ch) => ctx.measureText(ch).width + fish.fontSize * 0.08);
    fish.phraseWidth = fish.widths.reduce((sum, w) => sum + w, 0);
  }

  function toScreen(fish, x, y) {
    const cos = Math.cos(fish.face * fish.tilt);
    const sin = Math.sin(fish.face * fish.tilt);
    const fx = fish.face * x;
    return {
      x: fish.pos.x + fish.len * (cos * fx - sin * y),
      y: fish.pos.y + fish.len * (sin * fx + cos * y),
    };
  }

  function bounds(fish) {
    return {
      minX: fish.len * 0.55,
      maxX: width - fish.len * 0.55,
      minY: fish.len * 0.36,
      maxY: height - fish.len * 0.36,
    };
  }

  function wander(fish, i) {
    const b = bounds(fish);
    const t = time * fish.speed;
    const s = fish.seed;
    if (pointer) {
      const angle = (i / school.length) * Math.PI * 2 + time * 0.6;
      const spread = fish.len * 0.45;
      return {
        x: clamp(pointer.x + Math.cos(angle) * spread, b.minX, b.maxX),
        y: clamp(pointer.y + Math.sin(angle) * spread * 0.6, b.minY, b.maxY),
      };
    }
    const lane = (b.maxY - b.minY) / school.length;
    const cx = (b.minX + b.maxX) / 2;
    const cy = b.minY + lane * (i + 0.5);
    const rx = (b.maxX - b.minX) / 2;
    const ry = lane * 0.75;
    return {
      x: cx + rx * (0.78 * Math.sin(t * 0.31 + s) + 0.22 * Math.sin(t * 0.83 + s * 1.7)),
      y: cy + ry * (0.7 * Math.sin(t * 0.47 + s * 2.3) + 0.3 * Math.sin(t * 1.1 + s)),
    };
  }

  function step(dt) {
    time += dt;

    const targets = school.map(wander);
    school.forEach((fish, i) => {
      if (!fish.pos) fish.pos = { ...targets[i] };
    });

    // Nudge fish apart so the words don't tangle.
    school.forEach((fish, i) => {
      for (const other of school) {
        if (other === fish) continue;
        const dx = fish.pos.x - other.pos.x;
        const dy = (fish.pos.y - other.pos.y) * 1.8;
        const dist = Math.hypot(dx, dy) || 0.01;
        const room = (fish.len + other.len) * 0.5;
        if (dist < room) {
          const push = ((room - dist) / dist) * 1.2;
          targets[i].x += dx * push;
          targets[i].y += (dy / 1.8) * push;
        }
      }
      const b = bounds(fish);
      targets[i].x = clamp(targets[i].x, b.minX, b.maxX);
      targets[i].y = clamp(targets[i].y, b.minY, b.maxY);
    });

    school.forEach((fish, i) => {
      const target = targets[i];
      const prev = { ...fish.pos };
      const ease = Math.min(1, dt * (pointer ? 2.2 : 1.5) * fish.speed);
      fish.pos.x += (target.x - fish.pos.x) * ease;
      fish.pos.y += (target.y - fish.pos.y) * ease;

      if (dt > 0) {
        const smooth = Math.min(1, dt * 6);
        fish.velocity.x += ((fish.pos.x - prev.x) / dt - fish.velocity.x) * smooth;
        fish.velocity.y += ((fish.pos.y - prev.y) / dt - fish.velocity.y) * smooth;
      }

      if (Math.abs(fish.velocity.x) > fish.len * 0.06) fish.faceTarget = Math.sign(fish.velocity.x);
      fish.face += (fish.faceTarget - fish.face) * Math.min(1, dt * 5);
      if (Math.abs(fish.face) < 0.04) fish.face = fish.faceTarget * 0.04;

      const tiltTarget = clamp(
        Math.atan2(fish.velocity.y, Math.abs(fish.velocity.x) + fish.len * 0.25),
        -0.35,
        0.35
      );
      fish.tilt += (tiltTarget - fish.tilt) * Math.min(1, dt * 3);

      const speed = Math.hypot(fish.velocity.x, fish.velocity.y) / fish.len;
      fish.phase += dt * (3.6 + speed * 7);
      fish.offset += dt * fish.len * 0.1;

      fish.nextBubble -= dt;
      if (fish.nextBubble <= 0) {
        const mouth = toScreen(fish, 0.53, 0.02);
        const letters = fish.word.replace(/\s/g, "");
        bubbles.push({
          x: mouth.x,
          y: mouth.y,
          rise: fish.len * (0.12 + Math.random() * 0.08),
          sway: fish.len * 0.03,
          seed: Math.random() * 6,
          age: 0,
          life: 2.4 + Math.random() * 1.2,
          size: fish.fontSize * (0.8 + Math.random() * 0.35),
          ch: letters[Math.floor(Math.random() * letters.length)],
        });
        fish.nextBubble = 2.5 + Math.random() * 3;
      }
    });

    for (let i = 0; i < school.length; i++) {
      for (let j = i + 1; j < school.length; j++) {
        const a = school[i];
        const b = school[j];
        const dx = a.pos.x - b.pos.x;
        const dy = (a.pos.y - b.pos.y) * 2.2;
        const dist = Math.hypot(dx, dy) || 0.01;
        const room = (a.len + b.len) * 0.52;
        if (dist >= room) continue;
        const push = ((room - dist) / dist) * 0.5 * Math.min(1, dt * 10);
        a.pos.x += dx * push;
        a.pos.y += (dy / 2.2) * push;
        b.pos.x -= dx * push;
        b.pos.y -= (dy / 2.2) * push;
      }
    }
    for (const fish of school) {
      const b = bounds(fish);
      fish.pos.x = clamp(fish.pos.x, b.minX, b.maxX);
      fish.pos.y = clamp(fish.pos.y, b.minY, b.maxY);
    }

    bubbles = bubbles.filter((bubble) => {
      bubble.age += dt;
      bubble.y -= bubble.rise * dt;
      return bubble.age < bubble.life;
    });
  }

  function drawFish(fish) {
    if (!fish.widths) measure(fish);

    const pts = base.map(([x, y]) => {
      const tail = Math.pow(clamp((0.25 - x) / 0.75, 0, 1), 1.6);
      return [x, y + 0.06 * tail * Math.sin(fish.phase - x * 6)];
    });
    const cum = [0];
    for (let i = 1; i < pts.length; i++) {
      cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    }
    const perimeter = cum[cum.length - 1];

    const sample = (s) => {
      let lo = 0;
      let hi = cum.length - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (cum[mid] <= s) lo = mid;
        else hi = mid;
      }
      const t = (s - cum[lo]) / (cum[hi] - cum[lo] || 1);
      const [ax, ay] = pts[lo];
      const [bx, by] = pts[hi];
      return { x: ax + (bx - ax) * t, y: ay + (by - ay) * t, dx: bx - ax, dy: by - ay };
    };

    const { face, tilt, len } = fish;
    const cos = Math.cos(face * tilt);
    const sin = Math.sin(face * tilt);
    const reps = Math.max(1, Math.round((perimeter * len) / fish.phraseWidth));
    const spread = (perimeter * len) / (reps * fish.phraseWidth);

    ctx.font = font(fish.fontSize);
    let run = 0;
    for (let r = 0; r < reps; r++) {
      for (let i = 0; i < fish.phrase.length; i++) {
        const ch = fish.phrase[i];
        const w = fish.widths[i];
        const along = (run + w / 2) * spread;
        run += w;
        if (ch === " ") continue;

        let s = ((((fish.offset + along) / len) % perimeter) + perimeter) % perimeter;
        if (face < 0) s = perimeter - s;
        const p = sample(s);
        const screen = toScreen(fish, p.x, p.y);
        const tx = cos * face * p.dx - sin * p.dy;
        const ty = sin * face * p.dx + cos * p.dy;
        const angle = Math.atan2(ty, tx) + (face < 0 ? Math.PI : 0);

        ctx.globalAlpha = ch === "·" ? 0.4 : 0.85;
        ctx.save();
        ctx.translate(screen.x, screen.y);
        ctx.rotate(angle);
        ctx.fillText(ch, 0, 0);
        ctx.restore();
      }
    }

    const eye = toScreen(fish, 0.34, -0.05);
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(eye.x, eye.y, Math.max(1, fish.fontSize * 0.17), 0, Math.PI * 2);
    ctx.fill();
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = ink;
    for (const fish of school) drawFish(fish);

    for (const bubble of bubbles) {
      const k = bubble.age / bubble.life;
      ctx.globalAlpha = 0.6 * Math.min(1, k * 6) * (1 - k);
      ctx.font = font(bubble.size);
      ctx.fillText(
        bubble.ch,
        bubble.x + Math.sin(bubble.age * 2.6 + bubble.seed) * bubble.sway,
        bubble.y
      );
    }
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    if (!canvas.isConnected) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (resize()) {
      step(dt);
      draw();
    }
    requestAnimationFrame(frame);
  }

  function still() {
    if (!canvas.isConnected || !resize()) return;
    school.forEach((fish, i) => {
      const b = bounds(fish);
      const t = school.length > 1 ? i / (school.length - 1) : 0.5;
      fish.pos = {
        x: b.minX + (b.maxX - b.minX) * (i % 2 ? 0.8 : 0.2),
        y: b.minY + (b.maxY - b.minY) * t,
      };
    });
    bubbles = [];
    draw();
  }

  canvas.addEventListener("pointermove", (event) => {
    const rect = canvas.getBoundingClientRect();
    pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  });
  canvas.addEventListener("pointerleave", () => {
    pointer = null;
  });

  document.fonts.load(font(12)).then(() => {
    for (const fish of school) fish.widths = null;
    if (reduced) still();
  });

  if (reduced) {
    still();
    new ResizeObserver(still).observe(canvas);
  } else {
    requestAnimationFrame(frame);
  }
}

initializeWordFish();
document.addEventListener("pagechange", initializeWordFish);
