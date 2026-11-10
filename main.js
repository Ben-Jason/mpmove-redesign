/* MP Move — interactions
   GSAP drives the hero intro, parallax, marquee and magnetic buttons.
   Everything degrades to a fully visible static page if GSAP is missing or motion is reduced.

   The same file runs in two places:
   - on its own (index.html), where the form only shows a preview success state;
   - pasted into a systeme.io page (see build.py), where it finds the page's real opt-in form,
     keeps it off screen, copies the visitor's answers into it and presses its button, so
     sign-ups, emails and the thank-you page keep working exactly as they do today. */
(() => {
  // Optional: a URL that should receive the sign-up as a JSON POST when there is no systeme.io
  // form on the page. Left empty, a page without a systeme.io form sends nothing.
  const FORM_ENDPOINT = '';
  const GSAP_SRC = [
    'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js',
  ];

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const html = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

  function start(restarted) {
    const root = $('#mpm');
    if (!root || root.dataset.ready) return;
    root.dataset.ready = '1';

    // The intro only plays if the page was hidden before first paint (the tiny inline script
    // that adds .js ran ahead of us). Otherwise the visitor has already seen the hero, so
    // hiding it again to animate it in would just be a flicker.
    const playIntro = html.classList.contains('js') && !reduce && !restarted;
    html.classList.add('js');
    if (reduce || !('IntersectionObserver' in window)) html.classList.add('static');
    if (!playIntro) html.classList.add('no-intro');

    /* ---------- Fill the window when nested inside another page's layout ---------- */
    const fit = () => {
      root.style.width = '';
      root.style.marginLeft = '';
      root.style.marginTop = '';
      const r = root.getBoundingClientRect();
      const top = r.top + window.scrollY;
      if (Math.abs(r.left) < 1 && Math.abs(r.width - html.clientWidth) < 1 && top < 1) return;
      root.style.width = `${html.clientWidth}px`;
      root.style.marginLeft = `${-r.left}px`;
      if (top > 0 && top < 200) root.style.marginTop = `${-top}px`;
    };
    fit();
    window.addEventListener('resize', fit);

    /* ---------- Scroll reveals ---------- */
    if (!html.classList.contains('static')) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        });
      }, { threshold: .15, rootMargin: '0px 0px -6% 0px' });
      $$('.reveal', root).forEach((el) => io.observe(el));
    }

    /* ---------- Nav state + progress bar ---------- */
    const nav = $('#nav', root);
    const bar = $('.progress span', root);
    let ticking = false;
    const onScroll = () => {
      const y = window.scrollY;
      const max = html.scrollHeight - window.innerHeight;
      nav.classList.toggle('scrolled', y > 24);
      bar.style.setProperty('--p', max > 0 ? (y / max).toFixed(4) : 0);
      ticking = false;
    };
    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
    }, { passive: true });
    onScroll();

    /* ---------- Pointer effects that need no library (mouse only) ---------- */
    if (finePointer && !reduce) {
      const spotlight = (el, e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        el.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
        el.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
        return { x, y };
      };
      $$('[data-tilt]', root).forEach((el) => {
        el.addEventListener('pointermove', (e) => {
          const { x, y } = spotlight(el, e);
          el.style.setProperty('--ry', `${((x - .5) * 9).toFixed(2)}deg`);
          el.style.setProperty('--rx', `${((.5 - y) * 9).toFixed(2)}deg`);
        });
        el.addEventListener('pointerleave', () => {
          el.style.setProperty('--rx', '0deg');
          el.style.setProperty('--ry', '0deg');
        });
      });
      const formCard = $('.form', root);
      formCard.addEventListener('pointermove', (e) => spotlight(formCard, e));
    }

    /* ---------- CTAs scroll to the form and focus it ---------- */
    const signup = $('#signup', root);
    const firstField = $('#first_name', root);
    $$('[data-focus-form]', root).forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        signup.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
        if (!firstField.closest('[hidden]')) setTimeout(() => firstField.focus({ preventScroll: true }), reduce ? 0 : 700);
      });
    });

    /* ---------- Mobile sticky CTA: visible whenever the form is off screen ---------- */
    const sticky = $('#sticky', root);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => {
        sticky.classList.toggle('show', !entry.isIntersecting);
      }, { threshold: .1 }).observe(signup);
    }

    /* ---------- The systeme.io form behind the page ---------- */
    const findNative = () => {
      const button = $('[data-test-id="submit-form-button"]');
      const form = button && button.closest('form');
      if (!form || root.contains(form) || form.contains(root)) return null;
      return {
        form,
        button,
        first_name: $('input[name="first_name"]', form),
        email: $('input[name="email"]', form),
        phone: $('input[type="tel"]', form),
        consent: $('input[type="checkbox"]', form),
      };
    };

    // Move something out of sight without removing it, so its scripts keep working.
    const park = (el) => {
      Object.assign(el.style, {
        position: 'absolute', left: '-9999px', top: '0', width: '1px', height: '1px',
        overflow: 'hidden', opacity: '0', pointerEvents: 'none',
      });
      el.setAttribute('aria-hidden', 'true');
      $$('input, button, select, textarea, a', el).forEach((n) => { n.tabIndex = -1; });
    };

    // Hide the old page content around the block. Nothing is deleted: removing the block
    // from the page brings the old design straight back.
    const isolate = (native) => {
      const stop = $('#app') || document.body;
      let node = root;
      while (node.parentElement && node.parentElement !== stop && node.parentElement !== document.body) {
        [...node.parentElement.children].forEach((sib) => {
          if (sib === node || /^(SCRIPT|STYLE|LINK)$/.test(sib.tagName)) return;
          if (sib.matches('a[href*="systeme.io"]') || $('a[href*="systeme.io"]', sib)) return;
          if (sib.contains(native.form)) park(sib);
          else sib.style.setProperty('display', 'none', 'important');
        });
        node = node.parentElement;
      }
      if (!root.contains(native.form)) park(native.form);
    };

    let native = null;
    const phoneField = $('#phone-field', root);
    (function waitForNative(tries) {
      native = findNative();
      if (native) {
        html.classList.add('mpm-live');
        isolate(native);
        phoneField.hidden = !native.phone;
        fit();
        window.dispatchEvent(new Event('resize'));
        return;
      }
      // systeme.io builds its form after the page loads, so keep looking for a few seconds.
      if (tries < 100) setTimeout(() => waitForNative(tries + 1), 100);
    })(0);

    // React ignores a plain `input.value = x`; it only notices the prototype setter plus an event.
    const setNativeValue = (el, value) => {
      if (!el) return;
      const d = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
      if (d && d.set) d.set.call(el, value); else el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };

    // Every piece of text in the systeme.io form, except its button label.
    const nativeText = (n) => {
      const seen = new Set();
      const walker = document.createTreeWalker(n.form, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const text = walker.currentNode.textContent.trim();
        if (text && !n.button.contains(walker.currentNode)) seen.add(text);
      }
      return seen;
    };

    // Hand the answers to systeme.io and wait to see what it does with them.
    // Resolves on success; rejects with a message to show the visitor.
    const sendThroughNative = (n, values) => new Promise((resolve, reject) => {
      setNativeValue(n.first_name, values.first_name);
      setNativeValue(n.email, values.email);
      if (n.phone) setNativeValue(n.phone, values.phone);
      if (n.consent && !n.consent.checked) n.consent.click();

      setTimeout(() => {
        // Anything systeme.io writes into its form after this point is its answer (an error).
        const before = nativeText(n);
        n.button.click();
        const started = Date.now();
        const timer = setInterval(() => {
          // systeme.io normally sends the visitor to the next page, which ends this script.
          // If it swaps the form for its own thank-you message instead, the button disappears.
          if (!document.contains(n.button)) { clearInterval(timer); resolve(); return; }
          const fresh = [...nativeText(n)].filter((text) => !before.has(text));
          if (fresh.length) {
            clearInterval(timer);
            reject(new Error(fresh[0].slice(0, 160)));
          } else if (Date.now() - started > 12000) {
            clearInterval(timer);
            reject(new Error('That took longer than expected. Please try again.'));
          }
        }, 250);
      }, 150);
    });

    /* ---------- Form ---------- */
    const form = $('#optin', root);
    const fields = {
      first_name: { el: $('#first_name', root), test: (v) => v.trim().length > 0, msg: 'Please add your first name.' },
      email: { el: $('#email', root), test: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()), msg: 'Please enter a valid email address.' },
      phone: { el: $('#phone', root), test: (v) => phoneField.hidden || v.replace(/\D/g, '').length >= 7, msg: 'Please enter your phone number.' },
    };
    const consent = $('#consent', root);

    const setError = (name, msg) => {
      $(`#err-${name}`, root).textContent = msg || '';
      const field = fields[name];
      if (field) {
        field.el.closest('.field').classList.toggle('invalid', Boolean(msg));
        field.el.setAttribute('aria-invalid', msg ? 'true' : 'false');
      }
    };

    Object.keys(fields).forEach((name) => {
      fields[name].el.addEventListener('input', () => setError(name, ''));
    });
    consent.addEventListener('change', () => setError('consent', ''));

    const showDone = (name, sent) => {
      form.style.minHeight = `${form.offsetHeight}px`;
      form.style.display = 'grid';
      $('.form-body', root).hidden = true;
      $('#done-title', root).textContent = `You're in, ${name}.`;
      $('#preview-flag', root).hidden = sent;
      $('#done', root).hidden = false;
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      let firstBad = null;
      Object.entries(fields).forEach(([name, f]) => {
        const ok = f.test(f.el.value);
        setError(name, ok ? '' : f.msg);
        if (!ok && !firstBad) firstBad = f.el;
      });
      if (!consent.checked) {
        setError('consent', 'Please tick the box so we can email you the training.');
        if (!firstBad) firstBad = consent;
      }
      if (firstBad) {
        firstBad.focus();
        if (window.gsap && !reduce) gsap.fromTo(form, { x: -8 }, { x: 0, duration: .6, ease: 'elastic.out(1, .35)' });
        return;
      }

      const button = $('.btn-primary', form);
      const label = $('.btn-label', button);
      const values = {
        first_name: fields.first_name.el.value.trim(),
        email: fields.email.el.value.trim(),
        phone: fields.phone.el.value.trim(),
      };
      button.classList.add('loading');
      label.textContent = 'Sending…';

      try {
        native = findNative() || native;
        let sent = true;
        if (native && document.contains(native.button)) {
          await sendThroughNative(native, values);
        } else if (FORM_ENDPOINT) {
          const res = await fetch(FORM_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...values, consent: true }),
          });
          if (!res.ok) throw new Error('Something went wrong. Please try again in a moment.');
        } else {
          sent = false;
          await new Promise((resolve) => setTimeout(resolve, 600));
        }
        showDone(values.first_name, sent);
      } catch (err) {
        console.error(err);
        button.classList.remove('loading');
        label.textContent = 'Show me the system';
        setError('consent', err.message || 'Something went wrong. Please try again in a moment.');
      }
    });

    /* ---------- Motion that needs GSAP ---------- */
    const loadScript = (src) => new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
    const loadGsap = async () => {
      const load = async () => {
        if (!window.gsap) await loadScript(GSAP_SRC[0]);
        if (!window.ScrollTrigger) await loadScript(GSAP_SRC[1]);
      };
      const timeout = new Promise((_, reject) => setTimeout(reject, 3500));
      try { await Promise.race([load(), timeout]); return true; } catch (err) { return false; }
    };

    // Split the headline into masked words so each can slide up on its own.
    const splitWords = (el) => {
      const words = [];
      el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
      const walk = (node) => {
        [...node.childNodes].forEach((child) => {
          if (child.nodeType === Node.TEXT_NODE) {
            const frag = document.createDocumentFragment();
            child.textContent.split(/(\s+)/).forEach((part) => {
              if (!part) return;
              if (/^\s+$/.test(part)) { frag.append(' '); return; }
              const mask = document.createElement('span');
              const inner = document.createElement('span');
              mask.className = 'w';
              inner.className = 'wi';
              inner.textContent = part;
              mask.append(inner);
              frag.append(mask);
              words.push(inner);
            });
            child.replaceWith(frag);
          } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName.toLowerCase() !== 'svg') {
            walk(child);
          }
        });
      };
      walk(el);
      return words;
    };

    const motion = () => {
      gsap.registerPlugin(ScrollTrigger);

      const title = $('[data-split]', root);
      if (playIntro && title) {
        const words = splitWords(title);
        const hero = $$('[data-hero]', root);
        const card = $('[data-hero-card]', root);
        gsap.set(title, { visibility: 'visible' });
        gsap.set(hero, { y: 22 });
        gsap.set(card, { y: 40, scale: .97 });
        gsap.timeline({ delay: .15, defaults: { ease: 'power4.out' } })
          .from(words, { yPercent: 120, duration: 1.15, stagger: .05 })
          .to($('.hl-line path', root), { strokeDashoffset: 0, duration: .9, ease: 'power2.inOut' }, '-=.55')
          .to(hero, { opacity: 1, y: 0, duration: 1, stagger: .09 }, .5)
          .to(card, { opacity: 1, y: 0, scale: 1, duration: 1.3 }, .35);
      }

      gsap.fromTo($('#portrait', root), { yPercent: -7 }, {
        yPercent: 7, ease: 'none',
        scrollTrigger: { trigger: $('.portrait', root), start: 'top bottom', end: 'bottom top', scrub: true },
      });

      const track = $('#marquee', root);
      track.append($('.band-set', track).cloneNode(true));
      const loop = gsap.to(track, { xPercent: -50, duration: 32, ease: 'none', repeat: -1 });
      // Scrolling speeds the band up, then it eases back to its resting pace.
      const settle = gsap.to(loop, { timeScale: 1, duration: 1.2, ease: 'power2.out', paused: true });
      ScrollTrigger.create({
        onUpdate(self) {
          const boost = Math.min(Math.abs(self.getVelocity()) / 250, 6);
          loop.timeScale(1 + boost);
          settle.invalidate().restart();
        },
      });

      if (finePointer) {
        $$('[data-magnetic]', root).forEach((el) => {
          const xTo = gsap.quickTo(el, 'x', { duration: .5, ease: 'power3.out' });
          const yTo = gsap.quickTo(el, 'y', { duration: .5, ease: 'power3.out' });
          el.addEventListener('pointermove', (e) => {
            const r = el.getBoundingClientRect();
            xTo((e.clientX - (r.left + r.width / 2)) * .18);
            yTo((e.clientY - (r.top + r.height / 2)) * .3);
          });
          el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
        });
      }
    };

    if (reduce) {
      html.classList.add('no-intro');
    } else {
      loadGsap().then((ok) => {
        if (ok && window.gsap && window.ScrollTrigger) motion();
        else html.classList.add('no-intro');
      });
    }

    aurora($('#aurora', root));

    // If the host page rebuilds our markup after load, the new copy has no listeners.
    // Notice that and set it up again, without replaying the intro.
    let checks = 0;
    const watchdog = setInterval(() => {
      const current = $('#mpm');
      if (current && current !== root && !current.dataset.ready) { clearInterval(watchdog); start(true); }
      else if (++checks > 15) clearInterval(watchdog);
    }, 1000);
  }

  /* ---------- Hero background: a slow WebGL colour field ---------- */
  function aurora(canvas) {
    const gl = canvas && canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!gl) return;

    const vert = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
    const frag = `
      precision mediump float;
      uniform vec2 r; uniform float t; uniform vec2 m;
      float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}
      float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n(p);p=p*2.+vec2(3.1,1.7);a*=.5;}return v;}
      void main(){
        vec2 uv=gl_FragCoord.xy/r;
        vec2 p=uv; p.x*=r.x/r.y;
        vec2 q=p*1.25+vec2(t*.030,-t*.022)+(m-.5)*.35;
        float a=fbm(q+fbm(q*1.4+t*.05));
        float b=fbm(q*1.8-vec2(t*.04,0.)+a);
        vec3 cream=vec3(.973,.965,.949);
        vec3 plum=vec3(.431,.306,.451);
        vec3 blush=vec3(.914,.780,.753);
        vec3 gold=vec3(.851,.647,.376);
        vec3 c=cream;
        c=mix(c,blush,smoothstep(.40,.80,a)*.70);
        c=mix(c,plum,smoothstep(.50,.90,b)*.34);
        c=mix(c,gold,smoothstep(.30,.60,a*b)*.30);
        // Keep the left side, where the headline sits, calm.
        c=mix(cream,c,.35+.65*smoothstep(.05,.95,uv.x));
        gl_FragColor=vec4(c,1.);
      }`;

    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };
    const vs = compile(gl.VERTEX_SHADER, vert);
    const fs = compile(gl.FRAGMENT_SHADER, frag);
    if (!vs || !fs) return;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uR = gl.getUniformLocation(prog, 'r');
    const uT = gl.getUniformLocation(prog, 't');
    const uM = gl.getUniformLocation(prog, 'm');
    const mouse = { x: .5, y: .5, tx: .5, ty: .5 };

    // The field is soft, so half resolution is plenty and keeps phones cool.
    const resize = () => {
      const scale = Math.min(window.devicePixelRatio || 1, 2) * .5;
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * scale));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uR, canvas.width, canvas.height);
    };
    const draw = (ms) => {
      mouse.x += (mouse.tx - mouse.x) * .04;
      mouse.y += (mouse.ty - mouse.y) * .04;
      gl.uniform1f(uT, ms / 1000 + 40);
      gl.uniform2f(uM, mouse.x, mouse.y);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    resize();
    window.addEventListener('resize', () => { resize(); if (reduce) draw(0); });
    if (reduce) { draw(0); return; }

    window.addEventListener('pointermove', (e) => {
      mouse.tx = e.clientX / window.innerWidth;
      mouse.ty = 1 - e.clientY / window.innerHeight;
    }, { passive: true });

    let visible = true;
    let raf = 0;
    const frame = (ms) => { draw(ms); raf = visible ? requestAnimationFrame(frame) : 0; };
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(frame);
    }).observe(canvas);
    raf = requestAnimationFrame(frame);
  }

  start(false);
})();
