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
    else if (a.kind === 'countup') {
      // "3x" / "18%" / "$52k" — count the numeric part, keep prefix/suffix.
      if (!o._parsed) { const m = String(o.text || '').match(/^([^0-9]*)([0-9]+(?:\.[0-9]+)?)(.*)$/); o._parsed = m ? { pre: m[1], num: parseFloat(m[2]), suf: m[3], dec: (m[2].split('.')[1] || '').length } : null }
      if (o._parsed) { const v = (o._parsed.num * p).toFixed(o._parsed.dec); e.textContent = o._parsed.pre + v + o._parsed.suf } else { e.style.opacity = p }
      e.style.transform = `scale(${0.7 + 0.3 * pb})`
      if (!o._parsed) return
      e.style.opacity = Math.min(1, p * 3)
    }
  }

  window.render = (t) => { for (const a of anims) apply(a, t) }

  // Splits an element's text into word spans and registers a staggered rise for
  // each — the classic kinetic-typography reveal. Works for RTL/Arabic too
  // (words split on spaces; cursive joining is within words). Returns spans.
  function words(el, start, stagger, dur, opt) {
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
      reg(s, start + i * stagger, start + i * stagger + dur, 'rise', opt || { dy: 34 })
      spans.push(s)
    })
    return spans
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
  let fontInjected = false
  function injectFont() {
    if (fontInjected) return; fontInjected = true
    const st = document.createElement('style')
    st.textContent =
      "@font-face{font-family:'Cairo';src:url('./fonts/Cairo.ttf') format('truetype');font-weight:200 1000;font-display:block}" +
      ".rtl{direction:rtl}" +
      ".rtl h1,.rtl .value,.rtl .pill,.rtl .name,.rtl .kicker{letter-spacing:normal}" +
      ".ar-font,.ar-font h1,.ar-font .sub,.ar-font .caption,.ar-font .label,.ar-font .value,.ar-font .pill,.ar-font .name,.ar-font .kicker,.ar-font .brand,.ar-font .chip,.ar-font .url{font-family:'Cairo','Segoe UI',system-ui,Arial,sans-serif}" +
      // Arabic script sits tighter than Latin — give multi-line headings & body more breathing room.
      ".ar-font h1{line-height:1.4}.ar-font .sub,.ar-font .caption{line-height:1.65}.ar-font .label{line-height:1.5}"
    document.head.appendChild(st)
  }
  function applyLang(D) {
    injectFont()
    const rtl = (D && D.lang === 'ar') || /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(JSON.stringify(D || {}))
    if (!rtl) return
    // Apply RTL to the scene root, NOT <html>: dir=rtl on the document element
    // flips headless Chromium's screenshot clip origin and yields a blank frame.
    const s = document.getElementById('s')
    if (s) { s.setAttribute('dir', 'rtl'); s.classList.add('rtl', 'ar-font') }
    document.querySelectorAll('.brand').forEach((el) => { el.style.left = 'auto'; el.style.right = '90px' })
    document.querySelectorAll('.chip').forEach((el) => { el.style.right = 'auto'; el.style.left = '90px' })
    if (document.fonts && document.fonts.load) { try { document.fonts.load("900 100px 'Cairo'"); document.fonts.load("500 100px 'Cairo'") } catch (e) {} }
  }
  return { reg, easeOutCubic, easeOutBack, words, decorate, applyLang, sceneExit, applyPalette, stage }
})()
