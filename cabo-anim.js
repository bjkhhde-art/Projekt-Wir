/* Cabo – Kartenanimationen: fliegende Karten zwischen Stapeln und Händen. */

const CaboAnim = (() => {
  const COVER = "cabo-cards/Cover.webp";
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const hiddenKeys = new Set();

  function enabled() {
    return !reducedMotion.matches && typeof Element.prototype.animate === "function";
  }

  function rectOf(el) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return null;
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  }

  function find(key) {
    return document.querySelector(`[data-anim-key="${CSS.escape(key)}"]`);
  }

  /* A card that is "in flight" stays invisible at its destination until the flying copy lands. */
  function tag(el, key) {
    el.dataset.animKey = key;
    el.classList.toggle("anim-hidden", hiddenKeys.has(key));
  }

  function hide(key) {
    hiddenKeys.add(key);
    const el = find(key);
    if (el) el.classList.add("anim-hidden");
  }

  function reveal(key) {
    hiddenKeys.delete(key);
    const el = find(key);
    if (el) el.classList.remove("anim-hidden");
  }

  function revealAll() {
    [...hiddenKeys].forEach(reveal);
  }

  function face(className, src) {
    const div = document.createElement("div");
    div.className = `cabo-ghost-face ${className}`;
    const img = document.createElement("img");
    img.src = src;
    img.alt = "";
    div.appendChild(img);
    return div;
  }

  /* Flies a card copy from one screen rect to another, optionally turning it over on the way. */
  function fly({ from, to, front, startFaceUp = false, endFaceUp = false, delay = 0, duration = 520, fade = false, arc = 30 }) {
    return new Promise(resolve => {
      if (!enabled() || !from || !to) {
        resolve();
        return;
      }

      const ghost = document.createElement("div");
      ghost.className = "cabo-ghost";
      Object.assign(ghost.style, {
        left: `${from.left}px`,
        top: `${from.top}px`,
        width: `${from.width}px`,
        height: `${from.height}px`
      });

      const inner = document.createElement("div");
      inner.className = "cabo-ghost-inner";
      inner.appendChild(face("cabo-ghost-back", COVER));
      inner.appendChild(face("cabo-ghost-front", front || COVER));
      ghost.appendChild(inner);
      document.body.appendChild(ghost);

      const dx = to.left - from.left;
      const dy = to.top - from.top;
      const sx = to.width / from.width;
      const sy = to.height / from.height;
      const lift = 1.1;
      const timing = { duration, delay, easing: "cubic-bezier(.3,.7,.2,1)", fill: "both" };

      const flight = ghost.animate([
        { transform: "translate(0px, 0px) scale(1, 1)", opacity: 1 },
        { transform: `translate(${dx / 2}px, ${dy / 2 - arc}px) scale(${(1 + sx) / 2 * lift}, ${(1 + sy) / 2 * lift})`, opacity: 1, offset: 0.5 },
        { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: fade ? 0 : 1 }
      ], timing);

      const startTurn = startFaceUp ? 180 : 0;
      const endTurn = endFaceUp ? 180 : 0;
      if (startTurn === endTurn) {
        inner.style.transform = `rotateY(${startTurn}deg)`;
      } else {
        inner.animate(
          [{ transform: `rotateY(${startTurn}deg)` }, { transform: `rotateY(${endTurn}deg)` }],
          { ...timing, easing: "ease-in-out" }
        );
      }

      const finish = () => {
        ghost.remove();
        resolve();
      };
      flight.onfinish = finish;
      flight.oncancel = finish;
    });
  }

  /* FLIP: lets an element glide from where it used to be to where it is now. */
  function slideFrom(el, fromRect, duration = 380) {
    const to = rectOf(el);
    if (!enabled() || !to || !fromRect) return;
    const dx = fromRect.left - to.left;
    const dy = fromRect.top - to.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    el.animate(
      [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0px, 0px)" }],
      { duration, easing: "cubic-bezier(.3,.7,.2,1)" }
    );
  }

  function shake(el, delay = 0) {
    if (!enabled() || !el) return;
    el.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-6px)" },
        { transform: "translateX(6px)" },
        { transform: "translateX(-4px)" },
        { transform: "translateX(4px)" },
        { transform: "translateX(0)" }
      ],
      { duration: 420, delay, easing: "ease-in-out" }
    );
  }

  return { enabled, rectOf, tag, hide, reveal, revealAll, fly, slideFrom, shake };
})();
