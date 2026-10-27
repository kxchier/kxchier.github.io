(function () {
  const letter = document.querySelector(".letter");
  const note = document.querySelector(".note");
  if (!letter || !note) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let dragging = false;
  let pointerId = null;
  let startY = 0;
  let origin = 0;
  let moved = false;

  function travel() {
    return -letter.clientHeight * 0.4;
  }

  function current() {
    return parseFloat(note.style.getPropertyValue("--shift")) || 0;
  }

  function apply(y, animate) {
    const min = travel();
    note.style.transition =
      animate && !reduced ? "transform 0.55s cubic-bezier(0.22, 0.8, 0.28, 1)" : "none";
    note.style.setProperty("--shift", y + "px");
    const open = y < min * 0.55;
    note.classList.toggle("is-out", open);
    note.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function settle(y) {
    const min = travel();
    apply(y < min * 0.4 ? min : 0, true);
  }

  note.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    dragging = true;
    moved = false;
    pointerId = event.pointerId;
    startY = event.clientY;
    origin = current();
    note.setPointerCapture(event.pointerId);
    note.classList.add("is-dragging");
    note.style.transition = "none";
  });

  note.addEventListener("pointermove", (event) => {
    if (!dragging || event.pointerId !== pointerId) return;
    const dy = event.clientY - startY;
    if (Math.abs(dy) > 4) moved = true;
    const min = travel();
    const max = 6;
    let y = origin + dy;
    if (y < min) y = min + (y - min) * 0.18;
    if (y > max) y = max + (y - max) * 0.18;
    apply(y, false);
  });

  function end(event) {
    if (!dragging || event.pointerId !== pointerId) return;
    dragging = false;
    note.classList.remove("is-dragging");
    if (!moved) {
      apply(note.classList.contains("is-out") ? 0 : travel(), true);
      return;
    }
    settle(current());
  }

  note.addEventListener("pointerup", end);
  note.addEventListener("pointercancel", end);

  note.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    apply(note.classList.contains("is-out") ? 0 : travel(), true);
  });

  window.addEventListener("resize", () => {
    apply(note.classList.contains("is-out") ? travel() : 0, false);
  });
})();
