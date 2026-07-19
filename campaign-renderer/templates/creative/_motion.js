window.__M = (() => {
  const anims = []
  const easeOutCubic = (p) => 1 - Math.pow(1 - p, 3)
  // Overshoot ease — the signature "motion graphics" pop (settles past 1 then back).
  const easeOutBack = (p) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2) }
  const easeInOut = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2)

  function reg(el, start, end, kind, opt) { anims.push({ el, start, end, kind, opt: opt || {} }) }

  function apply(a, t) {
    const e = a.el, o = a.opt
    // Continuous (looping) kinds use raw t, not windowed progress.
    if (a.kind === 'orbit') {
      const period = o.period || 6000
      const ph = o.phase || 0
      const x = Math.cos((t / period) * Math.PI * 2 + ph) * (o.ax || 20)
      const y = Math.sin((t / period) * Math.PI * 2 + ph) * (o.ay || 30)
      e.style.transform = `translate(${x}px, ${y}px)`
      return
    }
    if (a.kind === 'drift') {
      // Continuous particle drift: rises, wraps, fades in/out at the ends.
      const per = o.period || 9000
      let pr = ((t / per) + (o.phase || 0)) % 1; if (pr < 0) pr += 1
      const travel = o.travel || 300
      const y = travel * 0.5 - pr * travel
      const x = Math.sin(pr * Math.PI * 2 * (o.wob || 1)) * (o.ax || 14)
      e.style.transform = `translate(${x}px, ${y}px)`
      e.style.opacity = String((o.alpha || 0.22) * Math.sin(pr * Math.PI))
      return
    }
    if (a.kind === 'spin') { e.style.transform = `rotate(${(t / (o.period || 16000)) * 360}deg)`; return }
    if (a.kind === 'dashflow') { e.style.strokeDashoffset = String(-((t / (o.speed || 40)) % 100000)); return }
    if (a.kind === 'kenburns') {
      // Slow, linear drift across the whole window — cinematic, never "done".
      let p = (t - a.start) / (a.end - a.start); p = p < 0 ? 0 : p > 1 ? 1 : p
      const s = (o.from || 1.04) + ((o.to || 1.12) - (o.from || 1.04)) * p
      const dx = (o.dx || 0) * p, dy = (o.dy || -14) * p
      e.style.transform = `scale(${s}) translate(${dx}px, ${dy}px)`
      return
    }

    let p = (t - a.start) / (a.end - a.start); p = p < 0 ? 0 : p > 1 ? 1 : p
    const pb = easeOutBack(p)
    p = a.kind === 'sweep' ? easeInOut(p) : easeOutCubic(p)

    if (a.kind === 'rise') { e.style.opacity = p; e.style.transform = `translateY(${(1 - p) * (o.dy || 30)}px)` }
    else if (a.kind === 'fade') { e.style.opacity = p }
    else if (a.kind === 'underline') { e.style.transform = `scaleX(${p})` }
    else if (a.kind === 'bar') { e.style.transform = `scaleY(${p})` }
    else if (a.kind === 'draww') { e.style.transform = `scaleX(${p})` }
    else if (a.kind === 'pop') { e.style.opacity = p; e.style.transform = `scale(${0.85 + 0.15 * p})` }
    else if (a.kind === 'popback') { e.style.opacity = Math.min(1, p * 2); e.style.transform = `scale(${p <= 0 ? 0.6 : 0.6 + 0.4 * pb}) rotate(${(1 - p) * (o.rot || 0)}deg)` }
    else if (a.kind === 'parallax') { e.style.transform = `translateY(${(1 - p) * (o.dy || 40)}px) scale(${1.06 - 0.06 * p})` }
    else if (a.kind === 'clip') { e.style.clipPath = `inset(${(1 - p) * 100}% 0 0 0 round ${o.r || 0}px)` }
    else if (a.kind === 'clipup') { e.style.clipPath = `inset(0 0 ${(1 - p) * 100}% 0 round ${o.r || 0}px)` }
    else if (a.kind === 'slidex') { e.style.opacity = p; e.style.transform = `translateX(${(1 - p) * (o.dx || -40)}px)` }
    // Shine sweep: element is ~40% of its container's width, so it must travel
    // from -150% (own-width units; fully off the left edge) to +350% (fully off
    // the right edge: 350% × 0.4 = 140% of the container) to cross COMPLETELY.
    else if (a.kind === 'sweep') { e.style.opacity = p > 0 && p < 1 ? 1 : 0; e.style.transform = `translateX(${-150 + 500 * p}%) skewX(-18deg)` }
    else if (a.kind === 'ringdraw') { const c = o.circ || 1508; e.style.strokeDashoffset = String(c * (1 - p)) }
    else if (a.kind === 'exitfade') { if (p > 0) e.style.opacity = String(1 - p) }
    else if (a.kind === 'blurin') { e.style.opacity = p; e.style.filter = `blur(${(1 - p) * 14}px)` }
    else if (a.kind === 'flipup') { e.style.opacity = Math.min(1, p * 1.6); e.style.transform = `perspective(700px) rotateX(${(1 - p) * 72}deg)`; e.style.transformOrigin = 'center bottom' }
    else if (a.kind === 'zoomsettle') { e.style.opacity = Math.min(1, p * 2); e.style.transform = `scale(${1.35 - 0.35 * p})` }
    else if (a.kind === 'typein') { e.style.opacity = t >= a.start ? '1' : '0' }
    else if (a.kind === 'capword') {
      // Karaoke caption word: dim until spoken, accent while being spoken.
      const active = t >= a.start && t < a.end
      e.style.opacity = t >= a.start ? '1' : '0.45'
      e.style.color = active ? (a.opt.accent || '#ffd166') : '#ffffff'
    }
    else if (a.kind === 'countup') {
      // "3x" / "18%" / "$52k" — count the numeric part, keep prefix/suffix.
      if (!o._parsed) { const m = String(o.text || '').match(/^([^0-9]*)([0-9]+(?:\.[0-9]+)?)(.*)$/); o._parsed = m ? { pre: m[1], num: parseFloat(m[2]), suf: m[3], dec: (m[2].split('.')[1] || '').length } : null }
      if (o._parsed) { const v = (o._parsed.num * p).toFixed(o._parsed.dec); e.textContent = o._parsed.pre + v + o._parsed.suf } else { e.style.opacity = p }
      e.style.transform = `scale(${0.7 + 0.3 * pb})`
      if (!o._parsed) return
      e.style.opacity = Math.min(1, p * 3)
    }
  }

  // anime.js bridge: timelines/instances created with autoplay:false register
  // here and are SEEKED (not played) each frame — fully deterministic.
  const animeTls = []
  function regAnime(tl) { if (tl && typeof tl.seek === 'function') animeTls.push(tl) }

  window.render = (t) => {
    for (const a of anims) apply(a, t)
    for (const tl of animeTls) tl.seek(Math.max(0, t))
  }

  // Splits an element's text into word spans and registers a staggered rise for
  // each — the classic kinetic-typography reveal. Works for RTL/Arabic too
  // (words split on spaces; cursive joining is within words). Returns spans.
  function words(el, start, stagger, dur, opt, kind) {
    const text = el.textContent
    el.textContent = ''
    const spans = []
    const parts = text.split(/\s+/).filter(Boolean)
    parts.forEach((w, i) => {
      const s = document.createElement('span')
      s.textContent = w
      s.style.display = 'inline-block'
      s.style.whiteSpace = 'pre'
      el.appendChild(s)
      if (i < parts.length - 1) el.appendChild(document.createTextNode(' '))
      reg(s, start + i * stagger, start + i * stagger + dur, kind || 'rise', opt || { dy: 34 })
      spans.push(s)
    })
    return spans
  }

  // Title entrance dispatcher: the scene's titleFx (seeded per scene by the
  // pipeline, never repeating the previous scene) picks one of 8 entrances —
  // varied openings keep the ad feeling hand-animated.
  function titleIn(el, D, o) {
    const fx = (D && D.titleFx) || 'rise'
    const start = (o && o.start) || 300
    const rtl = D && D.lang === 'ar'
    if (fx === 'zoom') reg(el, start, start + 700, 'zoomsettle')
    else if (fx === 'blur') reg(el, start, start + 750, 'blurin')
    else if (fx === 'slide') words(el, start, 90, 560, { dx: rtl ? 120 : -120 }, 'slidex')
    else if (fx === 'pop') words(el, start, 120, 540, { rot: -5 }, 'popback')
    else if (fx === 'flip') words(el, start, 110, 560, {}, 'flipup')
    else if (fx === 'type') words(el, start, 130, 130, {}, 'typein')
    else if (fx === 'riseslow') words(el, start, 170, 700, { dy: 52 })
    else words(el, start, 110, 640, { dy: 46 })
  }

  // Scene exit: fades the given content elements out over the scene's final
  // ~360ms so the next scene's entrance reads as a designed transition, not a
  // hard cut. Registered AFTER entrances so it wins the opacity write. No-ops
  // when the job asked for hard cuts or durMs is unknown.
  function sceneExit(D, els) {
    if (!D || !D.durMs || D.transition === 'none') return
    const end = D.durMs - 40
    const start = Math.max(0, end - 320)
    for (const el of els) { if (el) reg(el, start, end, 'exitfade') }
  }

  // Resolves the job's AI-proposed, contrast-enforced palette (with safe
  // fallbacks for older jobs) and exposes it as CSS vars on the scene root:
  // --c (accent), --bg1/--bg2 (gradient), --tx (text), --mut (muted), --ctx (CTA text).
  function applyPalette(D) {
    const P = Object.assign(
      {
        bg1: '#101828', bg2: '#0a0f1c',
        accent: (D && D.brand && D.brand.color) || (D && D.color) || '#34e5a4',
        text: '#f5f7fb', muted: '#b9c2d0', ctaText: '#0b0f18',
      },
      (D && D.palette) || {}
    )
    const s = document.getElementById('s')
    if (s) {
      s.style.setProperty('--c', P.accent)
      s.style.setProperty('--bg1', P.bg1)
      s.style.setProperty('--bg2', P.bg2)
      s.style.setProperty('--tx', P.text)
      s.style.setProperty('--mut', P.muted)
      s.style.setProperty('--ctx', P.ctaText)
    }
    return P
  }

  // Simple premium stage: a clean two-stop vertical gradient in the palette's
  // deep tones + one soft accent glow at the top. Deliberately quiet.
  function stage(sceneEl, P) {
    sceneEl.style.background =
      `radial-gradient(90% 42% at 50% 0%, ${P.accent}14, transparent 60%), linear-gradient(180deg, ${P.bg1}, ${P.bg2})`
  }

  // Premium ambient canvas: two large blurred accent orbs drifting slowly
  // + a faint dot grid. Pure decoration, all t-driven (deterministic frames).
  function decorate(sceneEl, color, opts) {
    const o = opts || {}
    const mk = (styles) => { const d = document.createElement('div'); Object.assign(d.style, styles); sceneEl.insertBefore(d, sceneEl.firstChild); return d }
    // dot grid (very faint — texture, not noise)
    mk({
      position: 'absolute', inset: '0',
      backgroundImage: `radial-gradient(${color}22 1.6px, transparent 1.6px)`,
      backgroundSize: '56px 56px', opacity: '0.35', pointerEvents: 'none',
    })
    const orb = (size, top, left, blur, alpha, phase, period) => {
      const d = mk({
        position: 'absolute', width: size + 'px', height: size + 'px', top, left,
        borderRadius: '50%', filter: `blur(${blur}px)`, pointerEvents: 'none',
        background: `radial-gradient(circle at 35% 35%, ${color}${alpha}, transparent 70%)`,
      })
      reg(d, 0, 1, 'orbit', { ax: 26, ay: 40, period: period || 7000, phase })
      return d
    }
    orb(o.big || 560, '-6%', '-18%', 64, '3d', 0, 8200)
    orb(o.small || 380, '70%', '64%', 74, '30', 2.1, 6400)
  }

  // Arabic + RTL. The Linux render worker ships no Arabic font, so we embed
  // Cairo (OFL) locally — without it Arabic renders as tofu. Applied generically
  // from every template: sets dir=rtl, swaps the pinned brand/chip corners, and
  // drops the tight (Latin) letter-spacing that would break Arabic's cursive join.
  // Selectable Arabic font family (job.arFont): all OFL, vendored in ./fonts.
  const AR_FONTS = {
    cairo:   { file: 'Cairo.ttf',     family: 'Cairo',      weights: '200 1000' },
    tajawal: { file: 'Tajawal.ttf',   family: 'Tajawal',    weights: '100 1000' },
    almarai: { file: 'Almarai.ttf',   family: 'Almarai',    weights: '100 1000' },
    changa:  { file: 'Changa.ttf',    family: 'Changa',     weights: '200 800' },
    messiri: { file: 'ElMessiri.ttf', family: 'El Messiri', weights: '400 700' },
    amiri:   { file: 'Amiri.ttf',     family: 'Amiri',      weights: '100 1000' },
    lalezar: { file: 'Lalezar.ttf',   family: 'Lalezar',    weights: '100 1000' },
  }
  let arFamily = 'Cairo'
  let fontInjected = false
  function injectFont(D) {
    if (fontInjected) return; fontInjected = true
    const f = AR_FONTS[(D && D.arFont) || 'cairo'] || AR_FONTS.cairo
    arFamily = f.family
    const st = document.createElement('style')
    st.textContent =
      "@font-face{font-family:'" + f.family + "';src:url('./fonts/" + f.file + "') format('truetype');font-weight:" + f.weights + ";font-display:block}" +
      ".rtl{direction:rtl}" +
      ".rtl h1,.rtl .value,.rtl .pill,.rtl .name,.rtl .kicker{letter-spacing:normal}" +
      ".ar-font,.ar-font h1,.ar-font .sub,.ar-font .caption,.ar-font .label,.ar-font .value,.ar-font .pill,.ar-font .name,.ar-font .kicker,.ar-font .brand,.ar-font .chip,.ar-font .url{font-family:'" + f.family + "','Segoe UI',system-ui,Arial,sans-serif}" +
      // Arabic script sits tighter than Latin — give multi-line headings & body more breathing room.
      ".ar-font h1{line-height:1.75}.ar-font .sub,.ar-font .caption{line-height:1.65}.ar-font .label{line-height:1.5}"
    document.head.appendChild(st)
  }
  function applyLang(D) {
    injectFont(D)
    const rtl = (D && D.lang === 'ar') || /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(JSON.stringify(D || {}))
    if (!rtl) return
    // Apply RTL to the scene root, NOT <html>: dir=rtl on the document element
    // flips headless Chromium's screenshot clip origin and yields a blank frame.
    const s = document.getElementById('s')
    if (s) { s.setAttribute('dir', 'rtl'); s.classList.add('rtl', 'ar-font') }
    document.querySelectorAll('.brand').forEach((el) => { el.style.left = 'auto'; el.style.right = '90px' })
    document.querySelectorAll('.chip').forEach((el) => { el.style.right = 'auto'; el.style.left = '90px' })
    if (document.fonts && document.fonts.load) { try { document.fonts.load("900 100px '" + arFamily + "'"); document.fonts.load("500 100px '" + arFamily + "'") } catch (e) {} }
  }
  // ---------------------------------------------------------------------------
  // FX — minimal motion-graphic accents (lines, paths, particles, rings).
  // Seeded (deterministic per scene), palette-aware, always pointer-events:none
  // and low-opacity so they attract without competing with the copy.
  // Draw-ins use anime.js timelines (seeked via regAnime); continuous motion
  // uses the deterministic reg() kinds (drift/spin/dashflow).
  // ---------------------------------------------------------------------------
  function rng(seed) {
    let s = (seed >>> 0) || 1
    return () => {
      s = Math.imul(s ^ (s >>> 15), s | 1)
      s ^= s + Math.imul(s ^ (s >>> 7), s | 61)
      return ((s ^ (s >>> 14)) >>> 0) / 4294967296
    }
  }
  function seedFrom(D) {
    const txt = (D && (D.headline || D.title || D.caption || D.text || D.label || '')) || ''
    return ((D && D.index) || 0) * 131 + txt.length * 7 + 17
  }
  function fxLayer(sceneEl) {
    const d = document.createElement('div')
    Object.assign(d.style, { position: 'absolute', inset: '0', zIndex: '1', pointerEvents: 'none' })
    sceneEl.appendChild(d)
    return d
  }
  function mkSvg(layer) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', '0 0 1080 1920')
    Object.assign(svg.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' })
    layer.appendChild(svg)
    return svg
  }
  const fx = {
    seedFrom,
    // Tiny accent dots drifting slowly upward (wrapping) — ambient life.
    particles(sceneEl, color, seed, n, opts) {
      const o = opts || {}
      const r = rng(seed)
      const layer = fxLayer(sceneEl)
      for (let i = 0; i < (n || 8); i++) {
        const sz = 5 + r() * 9
        const d = document.createElement('div')
        Object.assign(d.style, {
          position: 'absolute', width: sz + 'px', height: sz + 'px', borderRadius: '50%',
          left: (r() * 96 + 2) + '%', top: (r() * 86 + 7) + '%',
          background: color, opacity: '0',
        })
        layer.appendChild(d)
        reg(d, 0, 1, 'drift', {
          period: 8000 + r() * 7000, phase: r(), travel: 240 + r() * 260,
          ax: 10 + r() * 16, wob: 0.5 + r(), alpha: (o.alpha || 0.2) * (0.6 + r() * 0.8),
        })
      }
      return layer
    },
    // Short diagonal accent strokes near the edges, drawing in via anime.js.
    lines(sceneEl, color, seed, n) {
      const r = rng(seed + 5)
      const layer = fxLayer(sceneEl)
      const svg = mkSvg(layer)
      const zones = [
        [70, 300, 240, 560], [740, 1010, 240, 560],
        [70, 300, 1360, 1680], [740, 1010, 1360, 1680],
      ]
      const tl = window.anime ? window.anime.timeline({ autoplay: false }) : null
      for (let i = 0; i < (n || 3); i++) {
        const z = zones[Math.floor(r() * zones.length)]
        const x1 = z[0] + r() * (z[1] - z[0] - 140)
        const y1 = z[2] + r() * (z[3] - z[2] - 140)
        const len = 110 + r() * 150
        const x2 = x1 + len * 0.85, y2 = y1 + len * (r() > 0.5 ? 0.5 : -0.5)
        const p = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        p.setAttribute('d', `M ${x1},${y1} L ${x2},${y2}`)
        p.setAttribute('stroke', color); p.setAttribute('stroke-width', '5')
        p.setAttribute('stroke-linecap', 'round'); p.setAttribute('fill', 'none')
        p.style.opacity = '0.32'
        const plen = Math.hypot(x2 - x1, y2 - y1)
        p.style.strokeDasharray = String(plen)
        p.style.strokeDashoffset = String(plen)
        svg.appendChild(p)
        if (tl) tl.add({ targets: p, strokeDashoffset: [plen, 0], duration: 700, easing: 'easeOutCubic' }, 350 + i * 240)
        else reg(p, 350 + i * 240, 1050 + i * 240, 'ringdraw', { circ: plen })
      }
      if (tl) regAnime(tl)
      return layer
    },
    // One big curved "energy path" drawing across the canvas behind content,
    // plus a fainter dashed twin that keeps flowing for the whole scene.
    swoosh(sceneEl, color, seed) {
      const r = rng(seed + 11)
      const layer = fxLayer(sceneEl)
      const svg = mkSvg(layer)
      const y0 = 1350 + r() * 260, y1 = 620 + r() * 300
      const d = `M -60,${y0} C 300,${y0 - 320 - r() * 120} 640,${y1 + 320 + r() * 120} 1140,${y1}`
      const mk = (w, op, dash) => {
        const p = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        p.setAttribute('d', d); p.setAttribute('stroke', color); p.setAttribute('fill', 'none')
        p.setAttribute('stroke-width', w); p.setAttribute('stroke-linecap', 'round')
        p.style.opacity = op
        if (dash) p.style.strokeDasharray = dash
        svg.appendChild(p)
        return p
      }
      const main = mk('4', '0.17')
      const plen = main.getTotalLength()
      main.style.strokeDasharray = String(plen)
      main.style.strokeDashoffset = String(plen)
      if (window.anime) {
        const tl = window.anime.timeline({ autoplay: false })
        tl.add({ targets: main, strokeDashoffset: [plen, 0], duration: 1500, easing: 'easeInOutCubic' }, 420)
        regAnime(tl)
      } else {
        reg(main, 420, 1920, 'ringdraw', { circ: plen })
      }
      const flow = mk('3', '0.10', '12 30')
      reg(flow, 0, 1, 'dashflow', { speed: 34 })
      return layer
    },
    // Radial burst: an accent ring expanding + fading from a point — the
    // "premium opener" ping. Runs via anime (attr animation), seeked per frame.
    burst(sceneEl, color, at, opts) {
      const o = opts || {}
      const layer = fxLayer(sceneEl)
      const svg = mkSvg(layer)
      const mk = (delay, w, maxR) => {
        const cir = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
        cir.setAttribute('cx', String(at.x)); cir.setAttribute('cy', String(at.y))
        cir.setAttribute('r', '10'); cir.setAttribute('fill', 'none')
        cir.setAttribute('stroke', color); cir.setAttribute('stroke-width', String(w))
        cir.style.opacity = '0'
        svg.appendChild(cir)
        if (window.anime) {
          const tl = window.anime.timeline({ autoplay: false })
          tl.add({ targets: cir, r: [10, maxR], duration: 850, easing: 'easeOutCubic' }, delay)
          tl.add({ targets: cir, opacity: [0.55, 0], duration: 850, easing: 'easeOutQuad' }, delay)
          regAnime(tl)
        }
      }
      mk(o.delay || 60, 6, o.maxR || 220)
      mk((o.delay || 60) + 160, 3, (o.maxR || 220) * 1.45)
      return layer
    },
    // One soft light band sweeping diagonally across the whole canvas — the
    // classic premium "light pass". Runs once, early.
    lightsweep(sceneEl, start, dur) {
      const layer = fxLayer(sceneEl)
      layer.style.overflow = 'hidden'
      const band = document.createElement('div')
      Object.assign(band.style, {
        position: 'absolute', top: '-10%', bottom: '-10%', left: '0', width: '46%',
        background: 'linear-gradient(105deg, transparent, rgba(255,255,255,.13), transparent)',
        opacity: '0', pointerEvents: 'none',
      })
      layer.appendChild(band)
      reg(band, start || 150, (start || 150) + (dur || 950), 'sweep')
      return layer
    },
    // Small dashed ring slowly spinning — a quiet technical accent.
    ring(sceneEl, color, seed, opts) {
      const o = opts || {}
      const r = rng(seed + 23)
      const layer = fxLayer(sceneEl)
      const size = o.size || 200 + r() * 90
      const wrap = document.createElement('div')
      Object.assign(wrap.style, {
        position: 'absolute', width: size + 'px', height: size + 'px',
        left: o.left || (r() > 0.5 ? '6%' : '74%'), top: o.top || (r() > 0.5 ? '12%' : '72%'),
        opacity: o.alpha || '0.3',
      })
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svg.setAttribute('viewBox', '0 0 100 100')
      Object.assign(svg.style, { width: '100%', height: '100%' })
      const cir = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      cir.setAttribute('cx', '50'); cir.setAttribute('cy', '50'); cir.setAttribute('r', '46')
      cir.setAttribute('fill', 'none'); cir.setAttribute('stroke', color); cir.setAttribute('stroke-width', '2')
      cir.style.strokeDasharray = '3 9'
      svg.appendChild(cir); wrap.appendChild(svg); layer.appendChild(wrap)
      reg(wrap, 0, 1, 'spin', { period: o.period || 18000 })
      return layer
    },
  }

  function splitWords(el) {
    const text = el.textContent
    el.textContent = ''
    const parts = text.split(/\s+/).filter(Boolean)
    const spans = []
    parts.forEach((w, i) => {
      const sp = document.createElement('span')
      sp.textContent = w
      sp.style.display = 'inline-block'
      sp.style.whiteSpace = 'pre'
      el.appendChild(sp)
      if (i < parts.length - 1) el.appendChild(document.createTextNode(' '))
      spans.push(sp)
    })
    return spans
  }
  // Word-synced karaoke captions, auto-installed on every scene that carries
  // caption timing (D.captions.words = [{w,s,e}] in scene-relative ms). Sits in
  // the platform-safe band (~y1420-1540 of 1920) so TikTok/IG UI never covers it.
  function buildCaptions(D) {
    const s = document.getElementById('s')
    if (!s) return
    const accent = (D.palette && D.palette.accent) || (D.brand && D.brand.color) || '#ffd166'
    const bar = document.createElement('div')
    Object.assign(bar.style, {
      position: 'absolute', left: '90px', right: '90px', bottom: '390px', zIndex: '6',
      display: 'flex', justifyContent: 'center', pointerEvents: 'none',
    })
    const pill = document.createElement('div')
    Object.assign(pill.style, {
      maxWidth: '880px', background: 'rgba(8,10,16,.55)', borderRadius: '20px',
      padding: '16px 26px', textAlign: 'center', lineHeight: '1.35',
      fontFamily: "'" + arFamily + "','Segoe UI',system-ui,Arial,sans-serif",
      fontSize: '38px', fontWeight: '700', letterSpacing: '0',
    })
    bar.appendChild(pill)
    for (const wd of D.captions.words) {
      const sp = document.createElement('span')
      sp.textContent = wd.w
      sp.style.display = 'inline-block'
      sp.style.whiteSpace = 'pre'
      sp.style.opacity = '0.45'
      sp.style.color = '#fff'
      pill.appendChild(sp)
      pill.appendChild(document.createTextNode(' '))
      reg(sp, wd.s, wd.e, 'capword', { accent })
    }
    s.appendChild(bar)
    // Mirror sceneExit so the bar leaves with the scene content.
    if (D.durMs && D.transition !== 'none') reg(bar, Math.max(0, D.durMs - 360), D.durMs - 40, 'exitfade')
  }
  document.addEventListener('DOMContentLoaded', () => {
    const D = window.__DATA
    if (D && D.captions && Array.isArray(D.captions.words) && D.captions.words.length) buildCaptions(D)
  })

  return { reg, easeOutCubic, easeOutBack, words, splitWords, titleIn, decorate, applyLang, sceneExit, applyPalette, stage, regAnime, fx }
})()
