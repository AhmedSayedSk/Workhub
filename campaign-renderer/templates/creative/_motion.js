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
  return { reg, easeOutCubic }
})()
