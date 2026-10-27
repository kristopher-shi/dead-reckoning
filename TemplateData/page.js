// Dead Reckoning: the page around the game (Unity web template "DeadReckoning").
//
//   loading  the painted plate; a hairline runs through the title as the build downloads, waking each
//            letter it passes; then "Click to enter".
//   enter    one click unlocks the sound, captures the mouse, gives the game the keyboard and dissolves the
//            plate into the live title view underneath.
//   Esc      while the mouse is captured the browser keeps Esc for itself: it only frees the cursor and
//            the game never sees the key. So Esc works in two steps while the game holds the mouse:
//            the first lets go of it, and the veil offers "Click to keep sailing / Esc to end the
//            sailing"; the second Esc then reaches the game as a normal key. If that second Esc leaves
//            fullscreen instead (the browser keeps it again), or the line is clicked, the page queues it:
//            window.DRPage.escapes, read by Plugins/WebGL/DeadReckoningPage.jslib → EndGame. In the
//            ending the mouse is only captured for looking around, so letting it go IS the Esc.
//            Switching tab or app frees the mouse too, but the page has lost focus by then.
//   restart  the ending's Esc reloads the game at its title with the mouse free. No veil there: the
//            visitor's next key press (Space, to drift forward) takes the mouse back, as does a click.
//            Should the browser refuse that (too soon after the Esc), the veil says "Click to restart".
//   modes    the game says which of these applies (WebPage.Mode): 0 ending, 1 intro, 2 sailing.
//   phones   a notice before anything downloads, with "Load anyway".
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const body = document.body;
  const canvas = $('#unity-canvas');
  const build = window.DRBuild;

  // ---- the bridge the game reads (DeadReckoningPage.jslib) ------------------------------------------
  const MODE = { ending: 0, intro: 1, sailing: 2 };
  let mode = MODE.intro;
  const DRPage = window.DRPage = {
    escapes: [],   // timestamps (performance.now) of Esc presses the browser kept for itself
    setMode(m) {
      if (m === MODE.ending) letGo = false;
      else if (mode === MODE.ending) restarted = true;   // ending → title: the game just restarted
      mode = m;
      updateVeil();
    },
  };

  // ---- title block: the game's title-card type, centred 50 px above the middle --------------------
  // Proportions measured from the game at a 1200 px tall window, so it scales with the window height.
  const REF_H = 1200;
  const GAME = { titleCapH: 52, titleInkW: 930, byCapH: 13, byInkW: 334, gap: 16 };
  const TITLE_SCALE = 0.78;   // the page's title vs the game's
  const LIFT = 50;            // px above the window's middle
  const measure = document.createElement('canvas').getContext('2d');

  const title = $('.card-title');
  title.innerHTML = Array.from(title.textContent)
    .map(c => '<span>' + (c === ' ' ? '&nbsp;' : c) + '</span>').join('');
  const letters = Array.from(title.children);

  // Size and track `el` so `match` (the game's wording) spans inkW with caps capH tall.
  function setType(el, match, capH, inkW, family) {
    measure.font = '300 100px ' + family;
    const fs = capH / (measure.measureText('H').actualBoundingBoxAscent / 100);
    measure.font = '300 ' + fs + 'px ' + family;
    const m = measure.measureText(match), shown = measure.measureText(el.textContent.toUpperCase());
    const ls = (inkW - (m.actualBoundingBoxLeft + m.actualBoundingBoxRight)) / (match.length - 1);
    el.style.fontSize = fs + 'px';
    el.style.letterSpacing = ls + 'px';
    el.style.lineHeight = '1';
    const halfLead = (fs - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2;
    return {
      capOffset: m.fontBoundingBoxAscent + halfLead - capH,                          // box top → cap top
      inkLeft: -shown.actualBoundingBoxLeft,                                          // box left → first ink
      inkRight: shown.actualBoundingBoxRight + (el.textContent.length - 1) * ls,      // box left → last ink
    };
  }

  function placeTitle() {
    const H = innerHeight, cx = innerWidth / 2, k = H / REF_H, mid = H / 2 - LIFT;
    const family = getComputedStyle(body).fontFamily;
    const capH = GAME.titleCapH * TITLE_SCALE * k, inkW = GAME.titleInkW * TITLE_SCALE * k;
    const t = setType(title, 'DEAD RECKONING', capH, inkW, family);
    const left = cx - inkW / 2, right = cx + inkW / 2;
    title.style.top = (mid - capH / 2 - t.capOffset) + 'px';
    title.style.left = (left - t.inkLeft) + 'px';

    const byTop = mid + capH / 2 + GAME.gap * k;
    for (const el of [$('.card-by'), $('.card-year')]) {
      const b = setType(el, 'BY KRISTOPHER SHI', GAME.byCapH * k, GAME.byInkW * k, family);
      el.style.top = (byTop - b.capOffset) + 'px';
      el.style.left = (el.classList.contains('card-by') ? right - b.inkRight : left - b.inkLeft) + 'px';
    }
    document.documentElement.style.setProperty('--through', mid + 'px');
  }
  addEventListener('resize', placeTitle);
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(placeTitle);
  placeTitle();

  // ---- loading ------------------------------------------------------------------------------------
  const bar = $('#bar'), pct = $('#pct');
  function setProgress(p) {
    bar.style.width = (p * 100) + '%';
    pct.textContent = Math.round(p * 100) + '%';
    const x = innerWidth * p;
    for (const l of letters) {
      const r = l.getBoundingClientRect();
      if (x >= r.left + r.width * 0.4) l.classList.add('lit');
    }
  }

  function notice(text, actionText, action) {
    body.classList.add('noticed');
    $('#notice-text').textContent = text;
    const a = $('#notice-action');
    a.hidden = !actionText;
    if (actionText) {
      a.textContent = actionText;
      a.onclick = e => { e.preventDefault(); body.classList.remove('noticed'); action(); };
    }
  }

  let instance = null;
  function load() {
    if (!document.createElement('canvas').getContext('webgl2')) {
      notice('This browser can’t show Dead Reckoning. Please try a current Chrome, Safari or Firefox on a computer.');
      return;
    }
    const config = Object.assign({}, build.config, {
      // Full sharpness on Retina screens (capped at 2× for the rare 3× display).
      devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      showBanner: (msg, type) => { if (type === 'error') notice(msg); else console.warn(msg); },
    });
    const script = document.createElement('script');
    script.src = build.loaderUrl;
    script.onload = () => {
      createUnityInstance(canvas, config, setProgress).then(unity => {
        instance = unity;
        setProgress(1);
        body.classList.remove('loading');
        body.classList.add('ready');
      }).catch(msg => notice(String(msg)));
    };
    script.onerror = () => notice('Dead Reckoning could not be loaded. Please reload the page.');
    document.body.appendChild(script);
  }

  // Phones and tablets: say so before downloading anything.
  const touchOnly = matchMedia('(hover: none) and (pointer: coarse)').matches;
  if (touchOnly) notice('Dead Reckoning is sailed with a mouse and keyboard. Please visit on a computer.', 'Load anyway', load);
  else load();

  // ---- entering, capturing the mouse ----------------------------------------------------------------
  let entered = false;
  let letGo = false;       // the visitor freed the mouse (Esc, another tab) while the game wanted it: veil
  let restarted = false;   // back at the title after the ending, the mouse not yet taken again
  // The browser said no (e.g. Chrome's short pause right after an Esc): fall back to the veil's click.
  // Checked a moment later, since the game may have asked for the same capture in the same event.
  function refused() {
    setTimeout(() => { if (!document.pointerLockElement) { letGo = true; updateVeil(); } }, 150);
  }
  function capture() {
    canvas.focus();
    try {
      const p = canvas.requestPointerLock();
      if (p && p.catch) p.catch(refused);
    } catch (e) { refused(); }
  }
  document.addEventListener('pointerlockerror', () => { if (entered) refused(); });   // Safari
  const wantsMouse = () => entered && mode !== MODE.ending && !document.pointerLockElement;
  function enter() {
    if (entered || !instance) return;
    entered = true;
    body.classList.remove('ready');
    body.classList.add('entered');
    capture();   // this click is also what lets the browser start the sound
  }
  addEventListener('click', e => {
    if (e.target.closest('.corner, .notice a, .resume-back')) return;
    if (!entered) enter();
    else if (wantsMouse()) capture();
  });
  // A key press is a gesture the browser accepts too: after a restart, Space at the title takes the
  // mouse back. Only plain typing keys, so Esc and shortcuts (⌘-Tab, ⌘-R) never grab it.
  addEventListener('keydown', e => {
    if (e.key.length !== 1 || e.metaKey || e.ctrlKey || e.altKey) return;
    if (wantsMouse()) capture();
  }, true);

  // ---- Esc ------------------------------------------------------------------------------------------
  let lastEscape = -1e9;
  function queueEscape() {
    const now = performance.now();
    if (now - lastEscape < 400) return;   // one Esc can free the mouse AND leave fullscreen
    lastEscape = now;
    DRPage.escapes.push(now);
  }
  const inFront = () => document.visibilityState === 'visible' && document.hasFocus();

  let lastRelease = -1e9;
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement) { letGo = restarted = false; updateVeil(); return; }
    if (!entered) return;
    lastRelease = performance.now();
    // Give a tab/app switch a moment to take the focus away first; only a release in front is an Esc.
    setTimeout(() => {
      if (document.pointerLockElement) return;
      if (mode === MODE.ending) { if (inFront()) queueEscape(); }   // the ending: letting go IS the Esc
      else letGo = true;                                            // intro / sailing: it only lets go
      updateVeil();
    }, 150);
  });

  let ownFullscreenChange = false;
  document.addEventListener('fullscreenchange', () => {
    body.classList.toggle('fullscreen', !!document.fullscreenElement);
    if (ownFullscreenChange) { ownFullscreenChange = false; return; }
    if (document.fullscreenElement || !entered) return;
    // Esc left fullscreen. If the same press also let go of the mouse (Firefox does both at once), that
    // was only the "let go"; otherwise it's the second Esc (or the ending's).
    const at = performance.now();
    setTimeout(() => {
      if (!inFront()) return;
      if (mode !== MODE.ending && Math.abs(lastRelease - at) < 400) return;
      queueEscape();
    }, 200);
  });
  $('.resume-back').addEventListener('click', e => { e.preventDefault(); canvas.focus(); queueEscape(); });
  $('#fullscreen').addEventListener('click', () => {
    ownFullscreenChange = true;
    if (document.fullscreenElement) document.exitFullscreen();
    else {
      const el = document.documentElement;
      const go = el.requestFullscreen || el.webkitRequestFullscreen;
      const p = go && go.call(el);
      if (p && p.catch) p.catch(() => { ownFullscreenChange = false; });
    }
  });

  // ---- "Click to continue" ----------------------------------------------------------------------------
  function updateVeil() {
    const free = wantsMouse();
    body.classList.toggle('free', free);   // the fullscreen corner shows while the game has no mouse
    body.classList.toggle('veiled', free && letGo && document.visibilityState === 'visible');
    body.classList.toggle('veil-sailing', mode === MODE.sailing);
    body.classList.toggle('veil-restart', mode === MODE.intro && restarted);
  }
  document.addEventListener('visibilitychange', updateVeil);
  addEventListener('focus', updateVeil);
})();
