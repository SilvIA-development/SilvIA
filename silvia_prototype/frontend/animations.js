
// SILVIA animations.js — progressive, zero-dependency micro-animations
// Works with all three vanilla versions (A, B, C).
// Features:
// 1) Reveal-on-scroll (fade-up / fade-in / scale-in) via data-anim="..."
// 2) Auto-mark some common elements if you don't add data-anim manually
// 3) Button ripple effect for .btn
// 4) Simple counter-up for [data-count] elements
// 5) Spinner helper for .spinner
// 6) Map pulses for #regionDots circles (hover + selection)
// 7) Optional parallax for elements with data-parallax="ratio" (e.g., 0.2)

(function(){
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeUp { from { opacity:0; transform: translateY(12px) } to { opacity:1; transform: none } }
    @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
    @keyframes scaleIn { from { opacity:0; transform: scale(.96) } to { opacity:1; transform:none } }
    @keyframes pulseGlow { 0%{ r: 3; opacity:.7 } 50%{ r:5; opacity:.25 } 100%{ r:3; opacity:.7 } }
    @keyframes spin { to { transform: rotate(360deg) } }

    .anim-will { opacity: 0; }
    .anim-in { opacity: 1; }

    .fade-up.anim-in { animation: fadeUp .6s ease-out both; }
    .fade-in.anim-in { animation: fadeIn .6s ease-out both; }
    .scale-in.anim-in { animation: scaleIn .5s ease-out both; }

    .spinner { display:inline-block; animation: spin 1s linear infinite; }

    /* Button ripple */
    .btn { position: relative; overflow: hidden; }
    .btn .ripple {
      position:absolute; border-radius:50%; pointer-events:none;
      transform: translate(-50%, -50%); width: 4px; height: 4px;
      background: currentColor; opacity:.25; animation: ripple .6s ease-out forwards;
      mix-blend-mode: screen;
    }
    @keyframes ripple {
      to { opacity: 0; width: 240px; height: 240px; }
    }
  `;
  document.head.appendChild(style);

  // IntersectionObserver for reveal-on-scroll
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      if(e.isIntersecting){
        e.target.classList.add('anim-in');
        io.unobserve(e.target);
      }
    });
  }, { rootMargin: "0px 0px -10% 0px", threshold: 0.1 });

  // Auto-selectors to enhance without markup changes (safe, non-breaking)
  const autos = [
    "h1","h2","h3",".lead",".card",".grid > *",".brand",".hero-actions",".features .card",
    "#analysisPanel",".legend",".map-wrap",".map",".tabs",".footer"
  ];
  function primeAnimations(root=document){
    const manual = root.querySelectorAll("[data-anim]");
    manual.forEach(el=>{
      const kind = el.getAttribute("data-anim");
      el.classList.add("anim-will");
      if (kind === "fade-up") el.classList.add("fade-up");
      else if (kind === "scale-in") el.classList.add("scale-in");
      else el.classList.add("fade-in");
      io.observe(el);
    });

    autos.forEach(sel=>{
      root.querySelectorAll(sel).forEach(el=>{
        if(el.closest("[data-no-anim]")) return;
        if(el.classList.contains("anim-will") || el.classList.contains("anim-in")) return;
        el.classList.add("anim-will","fade-up");
        io.observe(el);
      });
    });
  }

  // Button ripple
  function primeRipples(root=document){
    root.querySelectorAll(".btn").forEach(btn=>{
      if(btn.__rippleBound) return;
      btn.__rippleBound = true;
      btn.addEventListener("click", (ev)=>{
        const r = document.createElement("span");
        r.className = "ripple";
        const rect = btn.getBoundingClientRect();
        r.style.left = (ev.clientX - rect.left) + "px";
        r.style.top = (ev.clientY - rect.top) + "px";
        btn.appendChild(r);
        setTimeout(()=>r.remove(), 650);
      });
    });
  }

  // Counter-up for numbers like <strong data-count="85">0</strong>
  function primeCounters(root=document){
    root.querySelectorAll("[data-count]").forEach(el=>{
      if(el.__countPrimed) return;
      el.__countPrimed = true;
      const target = parseFloat(el.getAttribute("data-count"));
      const dur = parseInt(el.getAttribute("data-count-duration") || "900", 10);
      const fmt = el.getAttribute("data-count-suffix") || "";
      const start = performance.now();
      const init = parseFloat(el.textContent.replace(/[^\d.-]/g,"")) || 0;
      function tick(now){
        const t = Math.min(1, (now - start) / dur);
        const val = Math.round((init + (target - init) * t) * 10) / 10;
        el.textContent = val + fmt;
        if(t < 1) requestAnimationFrame(tick);
      }
      const obs = new IntersectionObserver((ents)=>{
        ents.forEach(e=>{
          if(e.isIntersecting){ requestAnimationFrame(tick); obs.disconnect(); }
        });
      }, {threshold: .6});
      obs.observe(el);
    });
  }

  // Parallax (optional) — add data-parallax="0.2"
  function onScroll(){
    document.querySelectorAll("[data-parallax]").forEach(el=>{
      const ratio = parseFloat(el.getAttribute("data-parallax")) || 0.2;
      const y = window.scrollY * ratio;
      el.style.transform = `translate3d(0, ${y}px, 0)`;
      el.style.willChange = "transform";
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });

  // Map pulses for region dots if present
  function primeMapPulses(root=document){
    const g = root.getElementById("regionDots") || root.getElementById("dots");
    if(!g) return;
    // Hover pulse
    g.addEventListener("pointerover", (e)=>{
      const c = e.target;
      if(c.tagName === "circle" && (c.getAttribute("stroke") === "white" || c.getAttribute("stroke-width")==="1")){
        c.__origR = c.getAttribute("r");
        c.style.animation = "pulseGlow 1.2s ease-in-out infinite";
      }
    });
    g.addEventListener("pointerout", (e)=>{
      const c = e.target;
      if(c.tagName === "circle"){
        c.style.animation = "";
        if(c.__origR) c.setAttribute("r", c.__origR);
      }
    });
  }

  // Run now and also after SPA-like updates (our demos update DOM dynamically)
  function boot(root=document){
    primeAnimations(root);
    primeRipples(root);
    primeCounters(root);
    primeMapPulses(root);
  }

  // Observe mutations to auto-apply animations/ripples to new nodes
  const mo = new MutationObserver((muts)=>{
    muts.forEach(m=>{
      if(m.addedNodes && m.addedNodes.length){
        m.addedNodes.forEach(n=>{
          if(n.nodeType === 1) boot(n);
        });
      }
    });
  });
  mo.observe(document.documentElement, {childList:true, subtree:true});

  // Kick things off
  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", ()=>boot(document));
  } else {
    boot(document);
  }
})();
