window.__M = (() => {
  const anims = []
  const easeOutCubic = (p) => 1 - Math.pow(1 - p, 3)
  function reg(el, start, end, kind, opt) { anims.push({ el, start, end, kind, opt: opt || {} }) }
  function apply(a, t) {
    let p = (t - a.start) / (a.end - a.start); p = p < 0 ? 0 : p > 1 ? 1 : p; p = easeOutCubic(p)
    const e = a.el, o = a.opt
    if (a.kind === 'rise') { e.style.opacity = p; e.style.transform = `translateY(${(1 - p) * (o.dy || 30)}px)` }
    else if (a.kind === 'fade') { e.style.opacity = p }
    else if (a.kind === 'underline') { e.style.transform = `scaleX(${p})` }
    else if (a.kind === 'bar') { e.style.transform = `scaleY(${p})` }
    else if (a.kind === 'pop') { e.style.opacity = p; e.style.transform = `scale(${0.85 + 0.15 * p})` }
    else if (a.kind === 'parallax') { e.style.transform = `translateY(${(1 - p) * (o.dy || 40)}px) scale(${1.06 - 0.06 * p})` }
  }
  window.render = (t) => { for (const a of anims) apply(a, t) }

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
      ".ar-font,.ar-font h1,.ar-font .sub,.ar-font .caption,.ar-font .label,.ar-font .value,.ar-font .pill,.ar-font .name,.ar-font .kicker,.ar-font .brand,.ar-font .chip,.ar-font .url{font-family:'Cairo','Segoe UI',system-ui,Arial,sans-serif}"
    document.head.appendChild(st)
  }
  function applyLang(D) {
    injectFont()
    const rtl = (D && D.lang === 'ar') || /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(JSON.stringify(D || {}))
    if (!rtl) return
    document.documentElement.setAttribute('dir', 'rtl')
    const s = document.getElementById('s')
    if (s) { s.classList.add('rtl', 'ar-font') }
    // Mirror the physically-pinned corner chips (dir alone won't move left/right).
    document.querySelectorAll('.brand').forEach((el) => { el.style.left = 'auto'; el.style.right = '90px' })
    document.querySelectorAll('.chip').forEach((el) => { el.style.right = 'auto'; el.style.left = '90px' })
    // Nudge the glyph cache so document.fonts.ready reflects the real Arabic face.
    if (document.fonts && document.fonts.load) { try { document.fonts.load("900 100px 'Cairo'"); document.fonts.load("500 100px 'Cairo'") } catch (e) {} }
  }
  return { reg, easeOutCubic, applyLang }
})()
