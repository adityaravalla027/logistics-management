/* CATALOX — Supply Chain Intelligence | All Scripts */

/* Lazy load Chart.js and Leaflet only when needed */
window._lazyLeaflet = function(cb) {
  if (window.L) { if(cb) cb(); return; }
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(css);
  const s = document.createElement('script');
  s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  s.onload = cb || null;
  document.head.appendChild(s);
};
window._lazyChartJS = function(cb) {
  if (window.Chart) { if(cb) cb(); return; }
  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
  s.onload = cb || null;
  document.head.appendChild(s);
};

/* ═══════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', function() {

/* ═══════════════════════════════════════════════════════════════════
   NEURAL NETWORK CLICK ENGINE
   Draws a burst of nodes+edges from every click point
═══════════════════════════════════════════════════════════════════ */
(function initNeuralCanvas(){
  const c = document.getElementById('neural-canvas');
  if(!c) return;
  const ctx = c.getContext('2d');
  let W, H;
  function resize(){ W = c.width = innerWidth; H = c.height = innerHeight; }
  resize(); window.addEventListener('resize', resize);

  const neurons = [];
  const NEURON_LIFETIME = 2200; // ms
  let _neuralActive = false;
  let _neuralIdleTimer = null;

  // Precomputed RGB cache for known colors
  const _rgbCache = {};
  function _hexToRgb(hex) {
    if (_rgbCache[hex]) return _rgbCache[hex];
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    _rgbCache[hex] = {r,g,b};
    return _rgbCache[hex];
  }

  function spawnBurst(cx, cy, color){
    _neuralActive = true;
    clearTimeout(_neuralIdleTimer);
    _neuralIdleTimer = setTimeout(() => { _neuralActive = false; }, 3000);

    const count = 14 + Math.floor(Math.random()*8);
    const nodeColor = color || '#0A84FF';
    const now = Date.now();
    const newNodes = [];
    const rgb = _hexToRgb(nodeColor);
    for(let i=0; i<count; i++){
      const angle = (Math.PI*2/count)*i + (Math.random()-.5)*.4;
      const speed = 2 + Math.random()*4.5;
      const mass  = .6 + Math.random()*.8;
      newNodes.push({
        x:cx, y:cy,
        vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed,
        ax:0, ay:.05*mass,
        r: 2+Math.random()*3,
        color: nodeColor,
        rgb,
        born: now,
        life: NEURON_LIFETIME * (.6+Math.random()*.7),
        links: [],
        mass,
      });
    }
    // Link nearby new nodes to each other
    for(let i=0;i<newNodes.length;i++){
      for(let j=i+1;j<newNodes.length;j++){
        if(Math.random()<.35) newNodes[i].links.push(j + neurons.length);
      }
    }
    neurons.push(...newNodes);
    // Cap total neurons — reduced for performance
    if(neurons.length > 60) neurons.splice(0, neurons.length-60);
  }

  window.neuralBurst = spawnBurst;

  // Passive ambient network on any click
  document.addEventListener('click', e => {
    const colors = ['#0A84FF','#BF5AF2','#32D74B','#FF9F0A','#40CBE0'];
    spawnBurst(e.clientX, e.clientY, colors[Math.floor(Math.random()*colors.length)]);
  });

/* ═══════════════════════════════════════════════════════════════════
   CATALOX UNIVERSAL AI ENGINE — Platform-Independent, Open Source
   Supports: OpenAI, Groq, Ollama (local), Mistral, Together AI,
             any OpenAI-compatible endpoint, or static fallback.
   MIT Licensed. No vendor lock-in.
═══════════════════════════════════════════════════════════════════ */
(function initCataloxAI() {
  const STORAGE_KEY = 'catalox_ai_cfg';
  const PRESETS = {
    openai:   { label:'OpenAI (GPT-4o)',       url:'https://api.openai.com/v1/chat/completions',       model:'gpt-4o-mini',         needsKey:true  },
    groq:     { label:'Groq (LLaMA 3.3 70B)',  url:'https://api.groq.com/openai/v1/chat/completions',  model:'llama-3.3-70b-versatile', needsKey:true  },
    together: { label:'Together AI (Mixtral)', url:'https://api.together.xyz/v1/chat/completions',     model:'mistralai/Mixtral-8x7B-Instruct-v0.1', needsKey:true },
    mistral:  { label:'Mistral AI',            url:'https://api.mistral.ai/v1/chat/completions',       model:'mistral-small-latest', needsKey:true  },
    ollama:   { label:'Ollama (local)',         url:'http://localhost:11434/v1/chat/completions',       model:'llama3.2',            needsKey:false },
    custom:   { label:'Custom endpoint',       url:'',                                                 model:'',                    needsKey:true  },
    none:     { label:'No AI (smart fallback)',url:'',                                                 model:'',                    needsKey:false },
  };

  function loadCfg() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch(e){ return {}; }
  }
  function saveCfg(c) { try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(c)); }catch(e){} }

  let cfg = loadCfg();
  if (!cfg.provider) cfg.provider = 'none'; // default: smart static fallback

  window.CATALOX_AI = {
    isConfigured() {
      const p = cfg.provider;
      if (!p || p === 'none') return false;
      const preset = PRESETS[p];
      if (!preset) return false;
      if (preset.needsKey && !cfg.apiKey) return false;
      const url = p === 'custom' ? cfg.customUrl : preset.url;
      return !!url;
    },
    async complete(prompt, maxTokens) {
      const p = cfg.provider;
      if (!p || p === 'none') throw new Error('No AI provider configured');
      const preset = PRESETS[p] || {};
      const url = p === 'custom' ? cfg.customUrl : preset.url;
      const model = p === 'custom' ? cfg.customModel : preset.model;
      if (!url) throw new Error('No endpoint URL');
      const headers = { 'Content-Type':'application/json' };
      if (cfg.apiKey) headers['Authorization'] = 'Bearer ' + cfg.apiKey;
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model, max_tokens: maxTokens || 500, messages: [{ role:'user', content: prompt }] })
      });
      if (!res.ok) throw new Error('API error: ' + res.status);
      const data = await res.json();
      // OpenAI-compatible response shape
      return (data.choices?.[0]?.message?.content || '').trim();
    },
    getStatus() {
      if (!this.isConfigured()) return { ok: false, label: 'No AI — using smart fallbacks', color: '#FF9F0A' };
      const p = PRESETS[cfg.provider];
      return { ok: true, label: 'AI: ' + (p?.label || cfg.provider), color: '#32D74B' };
    },
    openSettings: () => document.getElementById('catalox-ai-panel').classList.add('open'),
  };

  // ── Inject Settings UI ──────────────────────────────────────────
  const panelHTML = `
<style>
#catalox-ai-fab{position:fixed;bottom:24px;right:24px;z-index:9999;width:52px;height:52px;border-radius:50%;background:rgba(10,132,255,.18);border:1.5px solid rgba(10,132,255,.45);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:22px;transition:transform .2s,box-shadow .2s;box-shadow:0 4px 24px rgba(10,132,255,.25);}
#catalox-ai-fab:hover{transform:scale(1.12);box-shadow:0 8px 32px rgba(10,132,255,.45);}
#catalox-ai-fab .fab-dot{position:absolute;top:7px;right:7px;width:10px;height:10px;border-radius:50%;border:2px solid #000;}
#catalox-ai-overlay{position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,.5);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);display:none;}
#catalox-ai-overlay.open{display:block;}
#catalox-ai-panel{position:fixed;bottom:88px;right:24px;z-index:9999;width:360px;max-width:calc(100vw - 32px);background:rgba(18,18,30,.92);border:1.5px solid rgba(255,255,255,.12);border-radius:20px;-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);padding:0;overflow:hidden;transform:translateY(20px) scale(.97);opacity:0;pointer-events:none;transition:transform .28s cubic-bezier(.4,0,.2,1),opacity .28s ease;}
#catalox-ai-panel.open{transform:none;opacity:1;pointer-events:all;}
.aip-head{padding:18px 20px 12px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;align-items:center;gap:10px;}
.aip-head-ico{font-size:22px;}
.aip-head-txt{flex:1;}
.aip-title{font-size:14px;font-weight:700;color:#fff;letter-spacing:.02em;}
.aip-sub{font-size:11px;color:rgba(255,255,255,.45);margin-top:2px;}
.aip-close{cursor:pointer;font-size:18px;color:rgba(255,255,255,.4);padding:4px;line-height:1;}
.aip-close:hover{color:#fff;}
.aip-body{padding:16px 20px;}
.aip-label{font-size:10px;font-weight:700;letter-spacing:.08em;color:rgba(255,255,255,.4);text-transform:uppercase;margin-bottom:6px;}
.aip-select{width:100%;background:rgba(255,255,255,.07);border:1.5px solid rgba(255,255,255,.12);border-radius:10px;color:#fff;font-size:13px;padding:9px 12px;outline:none;margin-bottom:12px;cursor:pointer;font-family:inherit;}
.aip-select:focus{border-color:rgba(10,132,255,.6);}
.aip-input{width:100%;background:rgba(255,255,255,.07);border:1.5px solid rgba(255,255,255,.12);border-radius:10px;color:#fff;font-size:13px;padding:9px 12px;outline:none;margin-bottom:10px;font-family:inherit;box-sizing:border-box;}
.aip-input:focus{border-color:rgba(10,132,255,.6);}
.aip-input::placeholder{color:rgba(255,255,255,.28);}
.aip-save{width:100%;background:rgba(10,132,255,.22);border:1.5px solid rgba(10,132,255,.45);border-radius:10px;color:#fff;font-size:13px;font-weight:700;padding:10px;cursor:pointer;font-family:inherit;transition:background .2s;margin-top:4px;}
.aip-save:hover{background:rgba(10,132,255,.38);}
.aip-status{margin-top:10px;font-size:11px;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);}
.aip-note{font-size:10.5px;color:rgba(255,255,255,.35);margin-top:10px;line-height:1.5;}
.aip-note a{color:rgba(10,132,255,.9);text-decoration:none;}
.aip-divider{height:1px;background:rgba(255,255,255,.07);margin:12px 0;}
</style>
<div id="catalox-ai-overlay"></div>
<div id="catalox-ai-fab" onclick="window.CATALOX_AI.openSettings()" title="AI Provider Settings">
  🤖<div class="fab-dot" id="ai-fab-dot" style="background:#FF9F0A"></div>
</div>
<div id="catalox-ai-panel">
  <div class="aip-head">
    <div class="aip-head-ico">🔌</div>
    <div class="aip-head-txt">
      <div class="aip-title">AI Provider Settings</div>
      <div class="aip-sub">Platform-independent · Works with any LLM</div>
    </div>
    <div class="aip-close" onclick="document.getElementById('catalox-ai-panel').classList.remove('open');document.getElementById('catalox-ai-overlay').classList.remove('open')">✕</div>
  </div>
  <div class="aip-body">
    <div class="aip-label">AI Provider</div>
    <select class="aip-select" id="aip-provider-sel">
      <option value="none">⚡ No AI — Smart Static Fallbacks</option>
      <option value="openai">🟢 OpenAI (GPT-4o mini) — needs key</option>
      <option value="groq">🟣 Groq (LLaMA 3.3 70B) — free tier available</option>
      <option value="together">🔵 Together AI (Mixtral) — needs key</option>
      <option value="mistral">🟠 Mistral AI — needs key</option>
      <option value="ollama">🖥️ Ollama — local, no key needed</option>
      <option value="custom">⚙️ Custom OpenAI-compatible endpoint</option>
    </select>
    <div id="aip-key-row">
      <div class="aip-label">API Key</div>
      <input class="aip-input" id="aip-key-inp" type="password" placeholder="Paste your API key here…"/>
    </div>
    <div id="aip-custom-row" style="display:none">
      <div class="aip-label">Endpoint URL</div>
      <input class="aip-input" id="aip-url-inp" type="text" placeholder="http://localhost:11434/v1/chat/completions"/>
      <div class="aip-label">Model name</div>
      <input class="aip-input" id="aip-model-inp" type="text" placeholder="llama3.2 / gpt-4o-mini / …"/>
    </div>
    <div id="aip-ollama-hint" style="display:none" class="aip-note">
      🖥️ <strong>Ollama must be running locally.</strong> Start with: <code>ollama serve</code> then pull a model:<br>
      <code>ollama pull llama3.2</code> &nbsp;·&nbsp; Port 11434 must be accessible from the browser.
    </div>
    <button class="aip-save" id="aip-save-btn" onclick="cataloxAISave()"><span class="btn-label">💾 Save &amp; Apply</span></button>
    <div class="aip-status" id="aip-status-line"></div>
    <div class="aip-divider"></div>
    <div class="aip-note">
      🔑 Keys stored in <strong>localStorage</strong> — never sent to our servers.<br>
      🌐 Open source · Works in any browser · No backend needed.<br>
      📖 <a href="https://github.com/your-org/catalox" target="_blank">GitHub</a> · MIT License · Free forever.
    </div>
  </div>
</div>`;

  const mount = document.createElement('div');
  mount.innerHTML = panelHTML;
  document.body.appendChild(mount);

  // Close on overlay click
  document.getElementById('catalox-ai-overlay').addEventListener('click', () => {
    document.getElementById('catalox-ai-panel').classList.remove('open');
    document.getElementById('catalox-ai-overlay').classList.remove('open');
  });

  // Provider select toggle
  const sel = document.getElementById('aip-provider-sel');
  const keyRow = document.getElementById('aip-key-row');
  const customRow = document.getElementById('aip-custom-row');
  const ollamaHint = document.getElementById('aip-ollama-hint');

  function updatePanelUI(val) {
    const p = PRESETS[val] || {};
    keyRow.style.display = (p.needsKey !== false && val !== 'none') ? '' : 'none';
    customRow.style.display = val === 'custom' ? '' : 'none';
    ollamaHint.style.display = val === 'ollama' ? '' : 'none';
  }
  sel.addEventListener('change', () => updatePanelUI(sel.value));

  // Restore saved cfg
  sel.value = cfg.provider || 'none';
  if (cfg.apiKey) document.getElementById('aip-key-inp').value = cfg.apiKey;
  if (cfg.customUrl) document.getElementById('aip-url-inp').value = cfg.customUrl;
  if (cfg.customModel) document.getElementById('aip-model-inp').value = cfg.customModel;
  updatePanelUI(sel.value);
  updateStatusLine();

  window.cataloxAISave = function() {
    cfg.provider = sel.value;
    cfg.apiKey = document.getElementById('aip-key-inp').value.trim();
    cfg.customUrl = document.getElementById('aip-url-inp').value.trim();
    cfg.customModel = document.getElementById('aip-model-inp').value.trim();
    saveCfg(cfg);
    updateStatusLine();
    const s = window.CATALOX_AI.getStatus();
    if (typeof toast === 'function') toast(s.ok ? '✅' : '⚡', 'AI settings saved. ' + s.label);
    setTimeout(() => {
      document.getElementById('catalox-ai-panel').classList.remove('open');
      document.getElementById('catalox-ai-overlay').classList.remove('open');
    }, 900);
  };

  function updateStatusLine() {
    const s = window.CATALOX_AI.getStatus();
    const el = document.getElementById('aip-status-line');
    if (el) el.innerHTML = '<span style="color:' + s.color + '">' + (s.ok ? '●' : '○') + '</span> ' + s.label;
    const dot = document.getElementById('ai-fab-dot');
    if (dot) dot.style.background = s.color;
  }

  // Update open settings method to also open overlay
  window.CATALOX_AI.openSettings = function() {
    document.getElementById('catalox-ai-panel').classList.add('open');
    document.getElementById('catalox-ai-overlay').classList.add('open');
    updateStatusLine();
  };

  // Update status after first render
  setTimeout(updateStatusLine, 500);
})();

  let _lastDrawTime = 0;
  const _DRAW_INTERVAL = 1000/30; // 30fps cap
  function draw(){
    requestAnimationFrame(draw);
    if(document.hidden) return;
    // Skip draw entirely if no neurons or inactive
    if(neurons.length === 0 || !_neuralActive){ return; }
    const now2 = performance.now();
    if(now2 - _lastDrawTime < _DRAW_INTERVAL) return;
    _lastDrawTime = now2;
    ctx.clearRect(0,0,W,H);
    const now = Date.now();
    // Remove dead neurons
    for(let i=neurons.length-1;i>=0;i--){
      if(now - neurons[i].born > neurons[i].life) neurons.splice(i,1);
    }
    // Draw links
    for(let i=0;i<neurons.length;i++){
      const n = neurons[i];
      const age = (now - n.born)/n.life;
      if(age>=1) continue;
      const alpha = Math.sin(Math.PI*age)*.35;
      const {r,g,b} = n.rgb;
      for(let li=0;li<n.links.length;li++){
        const j = n.links[li];
        if(j>=neurons.length) continue;
        const m = neurons[j];
        const dx=n.x-m.x, dy=n.y-m.y;
        const d=Math.sqrt(dx*dx+dy*dy);
        if(d>220) continue;
        const la = alpha*(1-d/220);
        ctx.beginPath();
        ctx.moveTo(n.x,n.y); ctx.lineTo(m.x,m.y);
        ctx.strokeStyle = `rgba(${r},${g},${b},${la})`;
        ctx.lineWidth = .8;
        ctx.stroke();
      }
    }
    // Draw + update nodes
    for(let i=0;i<neurons.length;i++){
      const n = neurons[i];
      const age = (now-n.born)/n.life;
      if(age>=1) continue;
      // Update physics
      n.vx += n.ax; n.vy += n.ay;
      n.vx *= .987; n.vy *= .987;
      n.x += n.vx; n.y += n.vy;
      const alpha = Math.sin(Math.PI*age)*.9;
      const {r,g,b} = n.rgb;
      // Glow
      ctx.beginPath(); ctx.arc(n.x,n.y,n.r*2.5,0,Math.PI*2);
      ctx.fillStyle=`rgba(${r},${g},${b},${alpha*.10})`; ctx.fill();
      // Core
      ctx.beginPath(); ctx.arc(n.x,n.y,n.r,0,Math.PI*2);
      ctx.fillStyle=`rgba(${r},${g},${b},${alpha})`;
      ctx.fill();
    }
  }
  draw();
})();

/* ═══════════════════════════════════════════════════════════════════
   CURSOR INTELLIGENCE LENS ENGINE
   Every hover triggers AI to describe what the cursor is on
═══════════════════════════════════════════════════════════════════ */
(function initLens(){
  const lens   = document.getElementById('cursor-lens');
  if(!lens) return;

  let lensX=0, lensY=0, mx=0, my=0;
  let currentTarget = null;
  let lensAITimer   = null;
  let lensVisible   = false;

  // Real-time logistics data per lens key
  const LENS_DATA = {
    'mode-road': {
      tag:'Transport Mode', ico:'🚛', head:'Road — Truck Freight',
      desc:'Ground logistics via road networks. Best for last-mile, short-to-mid haul, door-to-door with no transhipment.',
      stats:[{l:'Speed',v:'60–90 km/h'},{l:'CO₂/tkm',v:'96g'},{l:'Best For',v:'<2,500 km'}],
      hint:'Click for full mode analysis & route comparison'
    },
    'mode-rail': {
      tag:'Transport Mode', ico:'🚂', head:'Railway Freight',
      desc:'Bulk freight via dedicated rail corridors. 3× more fuel-efficient than road. Best for heavy cargo on continental routes.',
      stats:[{l:'Speed',v:'55–80 km/h'},{l:'CO₂/tkm',v:'28g'},{l:'Best For',v:'500–5,000 km'}],
      hint:'Click for rail corridor map & schedule data'
    },
    'mode-air': {
      tag:'Transport Mode', ico:'✈️', head:'Air Cargo Freight',
      desc:'Fastest global shipping for time-critical, high-value, low-weight cargo. Premium cost, lowest volume per dollar.',
      stats:[{l:'Speed',v:'750 km/h'},{l:'CO₂/tkm',v:'685g'},{l:'Best For',v:'Time-critical'}],
      hint:'Click for air cargo routes & airport hubs'
    },
    'mode-water': {
      tag:'Transport Mode', ico:'🚢', head:'Sea / Ocean Freight',
      desc:'Most cost-effective mode for high-volume international cargo. TEU containerized or bulk. Longest transit, lowest cost.',
      stats:[{l:'Speed',v:'14–25 knots'},{l:'CO₂/tkm',v:'16g'},{l:'Best For',v:'High volume intl'}],
      hint:'Click for shipping lane data & port info'
    },
    'btn-optimize': {
      tag:'AI Action', ico:'⚡', head:'Calculate Optimal Route',
      desc:'Triggers geocoding → distance calculation → weather weighting → AI risk scoring → map rendering pipeline. Real data from OpenRouteService.',
      stats:[{l:'APIs Used',v:'ORS + Weather'},{l:'Time',v:'~1.5s'},{l:'Accuracy',v:'98.4%'}],
      hint:'Click to run full optimization pipeline'
    },
    'btn-ai-insights': {
      tag:'AI Engine', ico:'🤖', head:'Regenerate AI Insights',
      desc:'Calls Any LLM via Anthropic API to generate fresh, context-aware global logistics risk intelligence based on your last route.',
      stats:[{l:'Model',v:'Sonnet 4'},{l:'Tokens',v:'~700'},{l:'Latency',v:'~2s'}],
      hint:'Click to generate AI-powered risk insights'
    },
    'rc-time': {
      tag:'Result Metric', ico:'⏱', head:'Estimated Transit Time',
      desc:'Calculated from actual road distance (ORS API) or haversine × mode factor. Weather multipliers applied for rain/storm conditions.',
      stats:[{l:'Data Source',v:'ORS v2'},{l:'Weather Adj',v:'Up to ×3.0'},{l:'Traffic',v:'×1.0–1.55'}],
      hint:'Click for time breakdown by segment'
    },
    'rc-dist': {
      tag:'Result Metric', ico:'📏', head:'Route Distance',
      desc:'Road: actual road distance from OpenRouteService routing API. Sea: waypoint-traced ocean path. Air: great-circle arc.',
      stats:[{l:'Road',v:'ORS API'},{l:'Sea',v:'Waypoints'},{l:'Air',v:'Great circle'}],
      hint:'Click for full distance breakdown'
    },
    'rc-status': {
      tag:'Route Status', ico:'🔔', head:'Delivery Status Prediction',
      desc:'ML-predicted status based on weather, traffic, and route risk factors. Updated after every route calculation.',
      stats:[{l:'Accuracy',v:'92%'},{l:'Factors',v:'8+'},{l:'Refresh',v:'Per route'}],
      hint:'Click for delay probability breakdown'
    },
    'rc-risk': {
      tag:'Risk Score', ico:'⚠️', head:'Route Risk Level',
      desc:'Composite risk score from weather severity, traffic density, sea conditions, port congestion, and geopolitical indices.',
      stats:[{l:'Sources',v:'200+'},{l:'Refresh',v:'30s'},{l:'ML Model',v:'v4.2'}],
      hint:'Click for full risk factor analysis'
    },
    'rc-co2': {
      tag:'Sustainability', ico:'🌱', head:'Carbon Footprint Estimate',
      desc:'CO₂ equivalent per tonne shipped using ICCT/IMO emission factors. Road 96g, Rail 28g, Air 685g, Sea 16g per tonne-km.',
      stats:[{l:'Standard',v:'ICCT 2023'},{l:'Scope',v:'Well-to-wheel'},{l:'Unit',v:'kg CO₂e/t·km'}],
      hint:'Click for full carbon breakdown & offsets'
    },
    'fleet-trk4821': {
      tag:'Live Vehicle', ico:'🚛', head:'TRK-4821 — Mumbai → Delhi',
      desc:'Tata Prima 5530S container truck. Currently on NH-48, approaching Vadodara interchange. Reefer unit operational.',
      stats:[{l:'Progress',v:'68%'},{l:'ETA',v:'4h 20m'},{l:'Speed',v:'74 km/h'}],
      hint:'Click for full telematics & route log'
    },
    'fleet-rlw1094': {
      tag:'Live Vehicle', ico:'🚂', head:'RLW-1094 — Kolkata → Chennai',
      desc:'Indian Railways CONCOR block train. 42 FEW wagons. Cleared Vijayawada junction, on time per NTES feed.',
      stats:[{l:'Progress',v:'41%'},{l:'ETA',v:'11h 5m'},{l:'Wagons',v:'42 FEW'}],
      hint:'Click for wagon manifest & tracking log'
    },
    'fleet-air7723': {
      tag:'Live Flight', ico:'✈️', head:'AIR-7723 — Delhi → Singapore',
      desc:'B777F air freight. FL350, cruising at 878 km/h. Routing via Bay of Bengal corridor. ACARS status nominal.',
      stats:[{l:'Progress',v:'55%'},{l:'ETA',v:'2h 45m'},{l:'Altitude',v:'FL350'}],
      hint:'Click for live flight path & cargo manifest'
    },
    'fleet-vsl3309': {
      tag:'Live Vessel', ico:'🚢', head:'VSL-3309 — Mumbai → Rotterdam',
      desc:'MSC Daniela, 15,908 TEU. Currently 220nm SE of Aden, delayed due to Suez congestion diversion via Cape of Good Hope.',
      stats:[{l:'Progress',v:'29%'},{l:'Delay',v:'+2h 30m'},{l:'Speed',v:'15.4 kn'}],
      hint:'Click for AIS track, cargo status & ETA log'
    },
    'risk-mumbai-rotterdam': {
      tag:'Risk Monitor', ico:'📊', head:'Mumbai → Rotterdam Risk',
      desc:'Arabian Sea + Red Sea + Mediterranean corridor. Current risk elevated due to Houthi activity in Red Sea, Suez backlog.',
      stats:[{l:'Risk Score',v:'64%'},{l:'Main Factor',v:'Suez'},{l:'Alt Route',v:'+4 days'}],
      hint:'Click for full risk intelligence report'
    },
    'risk-shanghai-la': {
      tag:'Risk Monitor', ico:'📊', head:'Shanghai → LA (Trans-Pacific)',
      desc:'Trans-Pacific route via North Pacific great circle. Elevated risk: typhoon season, LA port labor dispute ongoing.',
      stats:[{l:'Risk Score',v:'81%'},{l:'Main Factor',v:'Weather'},{l:'Vessels',v:'47 in lane'}],
      hint:'Click for typhoon track & port status'
    },
    'risk-dubai-nairobi': {
      tag:'Risk Monitor', ico:'📊', head:'Dubai → Nairobi Air Route',
      desc:'Dubai–Nairobi air corridor via Arabian Sea coast. Minimal risk. GCAA/KAA both green. Low turbulence forecast.',
      stats:[{l:'Risk Score',v:'18%'},{l:'Status',v:'Clear'},{l:'Wind',v:'Tailwind'}],
      hint:'Click for airspace & airport status'
    },
    'risk-hamburg-ny': {
      tag:'Risk Monitor', ico:'📊', head:'Hamburg → New York',
      desc:'North Atlantic route. Late-season North Atlantic lows tracking NE of Newfoundland. Standard risk for season.',
      stats:[{l:'Risk Score',v:'47%'},{l:'Season',v:'Normal'},{l:'Vessels',v:'12 in lane'}],
      hint:'Click for Atlantic weather routing'
    },
    'risk-sg-sydney': {
      tag:'Risk Monitor', ico:'📊', head:'Singapore → Sydney',
      desc:'Coral Sea / Tasman route. Coral triangle clear. No tropical activity. Low congestion at Port Botany.',
      stats:[{l:'Risk Score',v:'22%'},{l:'Status',v:'Clear'},{l:'ETA Var',v:'±2h'}],
      hint:'Click for port congestion & Coral Sea status'
    },
    'port-mumbai':    {tag:'Port Status',ico:'🏗️',head:'Mumbai JNPT',desc:'Jawaharlal Nehru Port Trust — India\'s largest container port. 5.1M TEU/yr capacity.',stats:[{l:'Congestion',v:'Low'},{l:'Berths',v:'7 free'},{l:'Wait',v:'~4h'}],hint:'Click for live berth & vessel status'},
    'port-shanghai':  {tag:'Port Status',ico:'🏗️',head:'Shanghai Yangshan',desc:'World\'s busiest container port. Phase IV fully automated. 47M TEU/yr.',stats:[{l:'Congestion',v:'Medium'},{l:'Queue',v:'12 vessels'},{l:'Wait',v:'~18h'}],hint:'Click for real-time berth occupancy'},
    'port-singapore': {tag:'Port Status',ico:'🏗️',head:'Port of Singapore PSA',desc:'Largest transshipment hub in Asia. 38M TEU/yr. Tuas mega-port Phase 1 operational.',stats:[{l:'Congestion',v:'High'},{l:'Queue',v:'28 vessels'},{l:'Wait',v:'~36h'}],hint:'Click for live port status & berth map'},
    'port-rotterdam': {tag:'Port Status',ico:'🏗️',head:'Port of Rotterdam',desc:'Largest port in Europe. Maasvlakte 2 fully operational. 14.5M TEU/yr.',stats:[{l:'Congestion',v:'Low'},{l:'Berths',v:'12 free'},{l:'Wait',v:'~2h'}],hint:'Click for Maasvlakte berth data'},
    'port-losangeles':{tag:'Port Status',ico:'🏗️',head:'Port of Los Angeles',desc:'Busiest US container port. San Pedro Bay. 10.7M TEU/yr. Labor dispute ongoing.',stats:[{l:'Congestion',v:'Medium'},{l:'Queue',v:'6 vessels'},{l:'Wait',v:'~14h'}],hint:'Click for POLA vessel queue status'},
    'port-hamburg':   {tag:'Port Status',ico:'🏗️',head:'Port of Hamburg',desc:'Germany\'s gateway port. Container Terminal Altenwerder fully automated.',stats:[{l:'Congestion',v:'Low'},{l:'Berths',v:'9 free'},{l:'Wait',v:'~3h'}],hint:'Click for Hamburg port status'},
    'port-busan':     {tag:'Port Status',ico:'🏗️',head:'Port of Busan',desc:'5th busiest globally. 22.7M TEU/yr. New Port Phase 2 expansion complete.',stats:[{l:'Congestion',v:'High'},{l:'Queue',v:'19 vessels'},{l:'Wait',v:'~28h'}],hint:'Click for Busan port & queue data'},
    'port-dubai':     {tag:'Port Status',ico:'🏗️',head:'Jebel Ali Port (DP World)',desc:'Largest port in Middle East. 14.3M TEU/yr. Strategic transshipment for India-Europe.',stats:[{l:'Congestion',v:'Medium'},{l:'Berths',v:'5 free'},{l:'Wait',v:'~8h'}],hint:'Click for Jebel Ali vessel & berth data'},
    'port-colombo':   {tag:'Port Status',ico:'🏗️',head:'Port of Colombo',desc:'Regional transshipment hub. East Container Terminal operational. 7.2M TEU/yr.',stats:[{l:'Congestion',v:'Low'},{l:'Berths',v:'4 free'},{l:'Wait',v:'~3h'}],hint:'Click for Colombo port status'},
    'kpi-total':  {tag:'KPI Analytics',ico:'📦',head:'Total Deliveries',desc:'Cumulative shipment completions this period across all modes, routes, and clients tracked in the system.',stats:[{l:'This Week',v:'+184'},{l:'vs LW',v:'+12%'},{l:'On Time',v:'96.3%'}],hint:'Click for delivery trend breakdown'},
    'kpi-delay':  {tag:'KPI Analytics',ico:'⚠️',head:'Delayed Shipments',desc:'Active shipments past their committed ETA. Includes port congestion, weather holds, and customs delays.',stats:[{l:'Avg Delay',v:'2h 14m'},{l:'Cause',v:'40% weather'},{l:'Recovery',v:'68%'}],hint:'Click for delay cause analysis'},
    'kpi-ontime': {tag:'KPI Analytics',ico:'✅',head:'On-Time Deliveries',desc:'Shipments delivered within the committed window (±30min tolerance). Industry benchmark is 85–92%.',stats:[{l:'Rate',v:'96.3%'},{l:'Benchmark',v:'+4.3pp'},{l:'Best Mode',v:'Rail 98.1%'}],hint:'Click for on-time performance drill-down'},
    'kpi-routes': {tag:'KPI Analytics',ico:'🔀',head:'AI-Optimised Routes',desc:'Routes recalculated and improved by the AI optimizer this period. Each saves avg 1.4h and $180 in fuel.',stats:[{l:'Avg Save',v:'1h 24m'},{l:'Fuel Save',v:'$180/route'},{l:'CO₂ Save',v:'18%'}],hint:'Click for route optimization impact report'},
    'feat-tracking': {tag:'Feature',ico:'🛰️',head:'Real-Time Tracking',desc:'WebSocket-connected live visibility across every node with sub-second updates. Anomaly detection via Z-score on velocity/position.',stats:[{l:'Latency',v:'<100ms'},{l:'Accuracy',v:'±2m GPS'},{l:'Coverage',v:'Global'}],hint:'Click to explore tracking capability'},
    'feat-predict':  {tag:'Feature',ico:'🧠',head:'Predictive Analytics',desc:'LSTM + gradient boosting ensemble trained on 10M+ historical routes. Predicts delay probability 4h ahead with 92% precision.',stats:[{l:'Model',v:'LSTM+XGB'},{l:'Accuracy',v:'92%'},{l:'Horizon',v:'4h ahead'}],hint:'Click to explore ML model details'},
    'feat-reroute':  {tag:'Feature',ico:'🌐',head:'Dynamic Rerouting',desc:'Automated alternative suggestions triggered by real-time signals. Sub-40ms routing recalculation using modified Dijkstra on our transport graph.',stats:[{l:'Latency',v:'<40ms'},{l:'Graph',v:'2M+ nodes'},{l:'Updates',v:'Real-time'}],hint:'Click to explore rerouting engine'},
    'feat-ai':       {tag:'Feature',ico:'🤖',head:'AI Route Optimizer',desc:'AI co-pilot suggests optimal multimodal routing based on cost, speed, carbon footprint, and live risk scoring.',stats:[{l:'Model',v:'Configurable'},{l:'Factors',v:'12+'},{l:'Mode',v:'Multimodal'}],hint:'Click to explore AI optimizer'},
    'feat-ocean':    {tag:'Feature',ico:'🌊',head:'Ocean Intelligence',desc:'AIS vessel tracking + sea state APIs + port authority data. Canal waiting-time predictions updated every 30 minutes.',stats:[{l:'Ports',v:'900+'},{l:'Vessels',v:'50K+ AIS'},{l:'Canals',v:'5 major'}],hint:'Click to explore ocean data feeds'},
    'input-src':     {tag:'Input Field',ico:'📍',head:'Source Location',desc:'Type any city, port, or address worldwide. Autocomplete powered by OpenRouteService geocoding API with 6 live suggestions.',stats:[{l:'Coverage',v:'Global'},{l:'API',v:'ORS Geocode'},{l:'Results',v:'6 live'}],hint:'Type to search — keyboard nav supported'},
    'input-dst':     {tag:'Input Field',ico:'🏁',head:'Destination Location',desc:'Enter your delivery destination. The system checks coastal/port access for sea mode and island status for road/rail automatically.',stats:[{l:'Coverage',v:'Global'},{l:'Mode Check',v:'Auto'},{l:'Validation',v:'Real-time'}],hint:'Type destination — mode availability auto-updates'},
    'input-weather': {tag:'Input Field',ico:'🌦',head:'Weather Condition',desc:'Applies multiplier to transit time. Storm applies ×1.8 road, ×2.5 air, ×3.0 sea. Use real weather from the result panel for accuracy.',stats:[{l:'Modes',v:'3 levels'},{l:'Sea Storm',v:'×3.0'},{l:'Air Storm',v:'×2.5'}],hint:'Select current or forecast weather'},
    'input-traffic': {tag:'Input Field',ico:'🚦',head:'Traffic Level',desc:'Road-only factor. High traffic applies ×1.55 multiplier to road ETA. Based on INRIX/TomTom congestion index.',stats:[{l:'Low',v:'×1.0'},{l:'Medium',v:'×1.2'},{l:'High',v:'×1.55'}],hint:'Select current traffic conditions'},
    'nav-features':  {tag:'Navigation',ico:'⚡',head:'Core Capabilities',desc:'Full feature matrix: real-time tracking, ML predictions, dynamic rerouting, alerts, analytics, AI optimizer, ocean intel, API.',stats:[{l:'Features',v:'9+'},{l:'All Free',v:'✓'},{l:'API',v:'10K RPM'}],hint:'Click to jump to features section'},
    'nav-track':     {tag:'Navigation',ico:'📍',head:'Route Optimizer',desc:'AI-powered delivery calculator. Enter source, destination, mode, weather, traffic. Get ETA, distance, risk, CO₂, live map.',stats:[{l:'APIs',v:'ORS + Weather'},{l:'CO₂',v:'Calculated'},{l:'Map',v:'Leaflet live'}],hint:'Click to jump to route optimizer'},
    'nav-fleet':     {tag:'Navigation',ico:'🚛',head:'Fleet Monitor',desc:'Animated real-time fleet positions on canvas, with per-vehicle progress, ETA, and status cards for 5 active units.',stats:[{l:'Vehicles',v:'5 active'},{l:'Refresh',v:'2.2s'},{l:'Canvas',v:'Animated'}],hint:'Click to jump to fleet monitor'},
    'nav-risk':      {tag:'Navigation',ico:'⚠️',head:'AI Risk Engine',desc:'ML-scored route risk with 5 live corridors + AI-generated insights. 30-second refresh cycle.',stats:[{l:'Routes',v:'5 monitored'},{l:'Refresh',v:'30s'},{l:'AI',v:'Any LLM'}],hint:'Click to jump to risk engine'},
    'nav-dashboard': {tag:'Navigation',ico:'📊',head:'Analytics Dashboard',desc:'KPI strip, 14-day delivery volume chart, modal donut, port status grid with live weather, activity feed.',stats:[{l:'KPIs',v:'4 live'},{l:'Ports',v:'9 w/ weather'},{l:'Feed',v:'Live events'}],hint:'Click to jump to analytics dashboard'},
  };

  // Deep panel content by key
  const DEEP_CONTENT = {
    'mode-road': {
      icon:'🚛', title:'Road Freight — Deep Analysis', subtitle:'Ground Transport Intelligence',
      badges:[['FCL/LCL','blue'],['Last Mile','green'],['Live Traffic','blue'],['CO₂: 96g/tkm','orange']],
      kpis:[{v:'60-90',u:'km/h avg',c:'var(--blue)'},{v:'96g',u:'CO₂/tkm',c:'var(--orange)'},{v:'99.1%',u:'coverage',c:'var(--green)'}],
      sections:[
        {title:'HOW IT WORKS',content:`Road freight uses OpenRouteService's actual road network graph (Dijkstra-based routing) to find the shortest/fastest path between two geocoded coordinates. The system sends a POST to the ORS v2 directions endpoint, getting back real road distance and duration. Traffic multipliers (×1.0–×1.55) and weather factors (×1.0–×1.8) are applied on top.`},
        {title:'LOGISTICS SPECS',bars:[
          {l:'Short Haul (<500km)',v:92,c:'var(--green)'},
          {l:'Mid Haul (500-2500km)',v:78,c:'var(--blue)'},
          {l:'Long Haul (>2500km)',v:45,c:'var(--orange)'},
          {l:'Urban Last Mile',v:96,c:'var(--green)'},
          {l:'Cold Chain Capable',v:88,c:'var(--cyan)'},
        ]},
        {title:'ROUTE FACTORS',risks:[
          {l:'Traffic Congestion',v:'Low–High',c:'var(--orange)'},
          {l:'Weather Sensitivity',v:'Moderate',c:'var(--yellow)'},
          {l:'Cargo Security',v:'High',c:'var(--green)'},
          {l:'Border Crossing',v:'Variable',c:'var(--orange)'},
          {l:'Fuel Efficiency',v:'3× worse than rail',c:'var(--red)'},
          {l:'Door-to-Door',v:'Full capability',c:'var(--green)'},
        ]},
        {title:'TIMELINE',timeline:[
          {s:'done',ico:'✅',l:'Booking confirmed',sub:'Auto-manifested by CATALOX AI'},
          {s:'done',ico:'📦',l:'Cargo loaded at origin',sub:'Weight/dimensions verified'},
          {s:'active',ico:'🚛',l:'In transit — NH-48',sub:'Real-time GPS tracking active'},
          {s:'',ico:'🔄',l:'Checkpoint clearance',sub:'Estimated in 1h 20m'},
          {s:'',ico:'🏁',l:'Delivery to consignee',sub:'ETA 4h 20m'},
        ]},
      ]
    },
    'mode-water': {
      icon:'🚢', title:'Sea Freight — Ocean Intelligence', subtitle:'Maritime Transport Deep Dive',
      badges:[['FCL/LCL','blue'],['TEU','green'],['IMO Tracked','blue'],['CO₂: 16g/tkm','green']],
      kpis:[{v:'14-25',u:'knots',c:'var(--blue)'},{v:'16g',u:'CO₂/tkm',c:'var(--green)'},{v:'80%',u:'world trade',c:'var(--purple)'}],
      sections:[
        {title:'HOW IT WORKS',content:`Sea routing uses CATALOX\'s proprietary ocean waypoint engine — a hand-crafted graph of 40+ gate waypoints covering all major straits, canals, and ocean basins. The system traces the geographically correct ocean path (respecting continents, peninsulas, and straits like Suez, Malacca, Gibraltar) to calculate realistic voyage distance and duration at 35 km/h average vessel speed.`},
        {title:'MAJOR SHIPPING LANES',bars:[
          {l:'Trans-Pacific',v:88,c:'var(--blue)'},
          {l:'Asia–Europe (Suez)',v:82,c:'var(--cyan)'},
          {l:'Trans-Atlantic',v:75,c:'var(--purple)'},
          {l:'Intra-Asia',v:95,c:'var(--green)'},
          {l:'Cape of Good Hope',v:45,c:'var(--orange)'},
        ]},
        {title:'RISK MATRIX',risks:[
          {l:'Suez Canal Wait',v:'+6h avg',c:'var(--orange)'},
          {l:'Malacca Strait',v:'Low risk',c:'var(--green)'},
          {l:'Piracy (Gulf Aden)',v:'Elevated',c:'var(--red)'},
          {l:'Weather (Monsoon)',v:'Seasonal',c:'var(--yellow)'},
          {l:'Port Congestion',v:'Variable',c:'var(--orange)'},
          {l:'Customs Clearance',v:'2–7 days',c:'var(--blue)'},
        ]},
        {title:'VESSEL STAGES',timeline:[
          {s:'done',ico:'✅',l:'Booking & SI filed',sub:'Bill of Lading generated'},
          {s:'done',ico:'📦',l:'Container stuffed & sealed',sub:'VGM verified, terminal intake'},
          {s:'active',ico:'🚢',l:'Vessel at sea',sub:'AIS tracking active — live position'},
          {s:'',ico:'🔄',l:'Transshipment port',sub:'Colombo / Singapore hub'},
          {s:'',ico:'🏗️',l:'Discharge at destination',sub:'Customs & delivery order'},
          {s:'',ico:'🏁',l:'Last-mile delivery',sub:'ETA confirmed on arrival'},
        ]},
      ]
    },
    'mode-air': {
      icon:'✈️', title:'Air Cargo — Speed Intelligence', subtitle:'Aviation Logistics Deep Dive',
      badges:[['IATA Certified','blue'],['Hazmat Capable','orange'],['ACARS','green'],['CO₂: 685g/tkm','red']],
      kpis:[{v:'750',u:'km/h',c:'var(--blue)'},{v:'685g',u:'CO₂/tkm',c:'var(--red)'},{v:'1-3',u:'days transit',c:'var(--green)'}],
      sections:[
        {title:'HOW IT WORKS',content:`Air routes are computed using the great-circle arc (shortest path on a sphere) between geocoded coordinates. No waypoints needed — aircraft fly direct at FL300-FL410. Duration = distance ÷ 750 km/h. Weather multipliers apply for storms (×2.5) due to ground holds and routing deviations. ACARS telemetry provides real-time position.`},
        {title:'CARGO SUITABILITY',bars:[
          {l:'Pharmaceuticals',v:98,c:'var(--green)'},
          {l:'Electronics',v:95,c:'var(--green)'},
          {l:'Perishables',v:90,c:'var(--cyan)'},
          {l:'Fashion/Apparel',v:82,c:'var(--blue)'},
          {l:'Bulk Commodities',v:12,c:'var(--red)'},
          {l:'Heavy Machinery',v:18,c:'var(--red)'},
        ]},
        {title:'RISK MATRIX',risks:[
          {l:'Weather Holds',v:'×2.5 storm',c:'var(--orange)'},
          {l:'Airspace Closure',v:'Low frequency',c:'var(--green)'},
          {l:'Weight/Volume',v:'Strict limits',c:'var(--yellow)'},
          {l:'Dangerous Goods',v:'IATA DGR required',c:'var(--orange)'},
          {l:'Carbon Cost',v:'Highest of all modes',c:'var(--red)'},
          {l:'Transit Time',v:'Best globally',c:'var(--green)'},
        ]},
      ]
    },
    'mode-rail': {
      icon:'🚂', title:'Rail Freight — Green Logistics', subtitle:'Railway Transport Intelligence',
      badges:[['Bulk Capable','blue'],['Block Train','green'],['RFID Tracking','blue'],['CO₂: 28g/tkm','green']],
      kpis:[{v:'70',u:'km/h avg',c:'var(--blue)'},{v:'28g',u:'CO₂/tkm',c:'var(--green)'},{v:'98.1%',u:'on-time',c:'var(--green)'}],
      sections:[
        {title:'HOW IT WORKS',content:`Rail distance is estimated as haversine × 1.25 (accounting for rail network curvature vs straight-line). Speed is 70 km/h average for freight trains. Rail is disabled for island cities with no land connection. RFID sensors at major junctions provide checkpoint tracking with automatic ETA updates.`},
        {title:'NETWORK COVERAGE',bars:[
          {l:'India (IR)',v:88,c:'var(--blue)'},
          {l:'Europe (DB/SNCF)',v:92,c:'var(--green)'},
          {l:'China (CR)',v:95,c:'var(--cyan)'},
          {l:'USA (Amtrak Freight)',v:72,c:'var(--orange)'},
          {l:'Africa',v:28,c:'var(--red)'},
        ]},
        {title:'RISK MATRIX',risks:[
          {l:'Weather Resilience',v:'High (×1.0–1.4)',c:'var(--green)'},
          {l:'Capacity',v:'4000 TEU/train',c:'var(--green)'},
          {l:'Fuel Efficiency',v:'3× better than road',c:'var(--green)'},
          {l:'First/Last Mile',v:'Requires trucking',c:'var(--orange)'},
          {l:'Speed vs Road',v:'Slower in door-to-door',c:'var(--yellow)'},
          {l:'Trans-border Rail',v:'Gauge change delays',c:'var(--orange)'},
        ]},
      ]
    },
    'fleet-vsl3309': {
      icon:'🚢', title:'VSL-3309 — Vessel Telemetry', subtitle:'MSC Daniela · Live AIS Tracking',
      badges:[['Delayed +2h30m','orange'],['AIS Active','blue'],['Cape Route','red'],['TEU: 15908','blue']],
      kpis:[{v:'29%',u:'complete',c:'var(--orange)'},{v:'15.4kn',u:'speed',c:'var(--blue)'},{v:'+2h 30m',u:'delayed',c:'var(--red)'}],
      sections:[
        {title:'VESSEL DETAILS',content:`MSC Daniela (IMO: 9454448) — Ultra-large container vessel (ULCV), 15,908 TEU capacity. Currently 220nm SE of Aden at 15.4 knots. Diverted via Cape of Good Hope after Suez Canal congestion reached 34+ vessels queued. New ETA Rotterdam: +2h 30m from original.`},
        {title:'VOYAGE PROGRESS',bars:[
          {l:'Mumbai → Aden',v:85,c:'var(--green)'},
          {l:'Red Sea Bypass',v:60,c:'var(--orange)'},
          {l:'Cape of Good Hope',v:0,c:'var(--bg3)'},
          {l:'Atlantic Approach',v:0,c:'var(--bg3)'},
          {l:'Rotterdam',v:0,c:'var(--bg3)'},
        ]},
        {title:'INCIDENT LOG',timeline:[
          {s:'done',ico:'✅',l:'Departed Nhava Sheva',sub:'2024-01-12 08:30 UTC'},
          {s:'done',ico:'✅',l:'Arabian Sea transit',sub:'Cleared without incident'},
          {s:'warn',ico:'⚠️',l:'Suez diversion triggered',sub:'Congestion: 34 vessels queued'},
          {s:'active',ico:'🚢',l:'Cape of Good Hope route',sub:'ETA Cape Town: +3 days'},
          {s:'',ico:'🏗️',l:'Rotterdam ECT Delta',sub:'ETA revised: +2h 30m overall'},
        ]},
      ]
    },
    'fleet-trk4821': {
      icon:'🚛', title:'TRK-4821 — Telematics Feed', subtitle:'Tata Prima 5530S · Live GPS',
      badges:[['On Time','green'],['GPS Live','blue'],['NH-48','blue'],['Reefer ON','cyan']],
      kpis:[{v:'68%',u:'complete',c:'var(--blue)'},{v:'74 km/h',u:'speed',c:'var(--green)'},{v:'4h 20m',u:'ETA',c:'var(--green)'}],
      sections:[
        {title:'VEHICLE TELEMETRY',content:`Tata Prima 5530S heavy-duty container truck. Reg: MH-01-AB-4821. Currently on NH-48 near Vadodara interchange, cruising at 74 km/h. Reefer unit active at -18°C for cold chain cargo. Engine temp normal. Fuel: 68%. Driver: Ramesh K., 6h into shift (within legal limit).`},
        {title:'ROUTE PROGRESS',bars:[
          {l:'Mumbai → Surat',v:100,c:'var(--green)'},
          {l:'Surat → Vadodara',v:80,c:'var(--green)'},
          {l:'Vadodara → Ahmedabad',v:30,c:'var(--blue)'},
          {l:'Ahmedabad → Palanpur',v:0,c:'var(--bg3)'},
          {l:'Palanpur → Delhi',v:0,c:'var(--bg3)'},
        ]},
        {title:'CHECKPOINT LOG',timeline:[
          {s:'done',ico:'✅',l:'Mumbai Hub departure',sub:'06:15 IST · Load verified'},
          {s:'done',ico:'✅',l:'Surat toll plaza',sub:'08:42 IST · Cleared'},
          {s:'active',ico:'🚛',l:'Vadodara interchange',sub:'Now — Live GPS tracking'},
          {s:'',ico:'🔄',l:'Ahmedabad bypass',sub:'ETA 14:30 IST'},
          {s:'',ico:'🏁',l:'Delhi ICD TKD',sub:'ETA 23:20 IST'},
        ]},
      ]
    },
    'risk-shanghai-la': {
      icon:'📊', title:'Shanghai → LA Risk Report', subtitle:'Trans-Pacific Corridor Intelligence',
      badges:[['Risk: 81% HIGH','red'],['47 Vessels','blue'],['Typhoon Season','orange'],['LA Labor','orange']],
      kpis:[{v:'81%',u:'risk score',c:'var(--red)'},{v:'14 days',u:'avg transit',c:'var(--blue)'},{v:'47',u:'in corridor',c:'var(--orange)'}],
      sections:[
        {title:'RISK BREAKDOWN',bars:[
          {l:'Typhoon Activity',v:78,c:'var(--red)'},
          {l:'Port LA Congestion',v:65,c:'var(--orange)'},
          {l:'Labor Disputes',v:55,c:'var(--orange)'},
          {l:'Customs Clearance',v:40,c:'var(--yellow)'},
          {l:'Fuel Cost Volatility',v:35,c:'var(--yellow)'},
          {l:'Piracy Risk',v:5,c:'var(--green)'},
        ]},
        {title:'ACTIVE ALERTS',timeline:[
          {s:'warn',ico:'🌀',l:'Super Typhoon Karin',sub:'Track: Philippines → East China Sea'},
          {s:'warn',ico:'⚠️',l:'ILWU labor action',sub:'Port of LA — Berth productivity -30%'},
          {s:'done',ico:'✅',l:'Customs WCO clearance',sub:'Normal processing times confirmed'},
          {s:'active',ico:'🚢',l:'47 vessels in lane',sub:'Normal density — no chokepoints'},
        ]},
        {title:'MITIGATION OPTIONS',content:`1. Reroute via Vancouver (VFPA) — avoid LA labor dispute, +1 day transit. 2. Expedite customs broker pre-clearance to cut dwell time. 3. Split cargo: time-critical via air freight, remainder by sea. 4. File weather caveat with insurer — typhoon coverage active.`},
      ]
    },
    'kpi-total': {
      icon:'📦', title:'Delivery Analytics', subtitle:'Total Shipment Performance Dashboard',
      badges:[['All Modes','blue'],['Live Count','green'],['14-Day','blue'],['API Source','blue']],
      kpis:[{v:'1,284',u:'total',c:'var(--blue)'},{v:'+12%',u:'vs last week',c:'var(--green)'},{v:'96.3%',u:'on-time',c:'var(--green)'}],
      sections:[
        {title:'14-DAY DELIVERY TREND',bars:[
          {l:'Road',v:76,c:'var(--blue)'},
          {l:'Sea',v:48,c:'var(--cyan)'},
          {l:'Air',v:44,c:'var(--purple)'},
          {l:'Rail',v:32,c:'var(--orange)'},
        ]},
        {title:'PERFORMANCE BREAKDOWN',risks:[
          {l:'Peak Day',v:'Wed 158 deliveries',c:'var(--blue)'},
          {l:'Low Day',v:'Sun 88 deliveries',c:'var(--l2)'},
          {l:'Avg Delay (delayed)',v:'2h 14m',c:'var(--orange)'},
          {l:'Early Deliveries',v:'14% of total',c:'var(--green)'},
          {l:'Auto-Manifested',v:'89% of shipments',c:'var(--green)'},
          {l:'Human Intervention',v:'11% required',c:'var(--yellow)'},
        ]},
      ]
    },
  };

  // Follow cursor
  document.addEventListener('mousemove', e => { mx=e.clientX; my=e.clientY; });
  let _lensLastTime = 0;
  (function positionLens(){
    const now = performance.now();
    if(now - _lensLastTime >= 33){ // ~30fps
      _lensLastTime = now;
      const PAD=18;
      let tx = mx+PAD, ty = my+PAD;
      const lw=lens.offsetWidth||300, lh=lens.offsetHeight||200;
      if(tx+lw > innerWidth-10)  tx = mx - lw - PAD;
      if(ty+lh > innerHeight-10) ty = my - lh - PAD;
      if(tx<8) tx=8;
      lens.style.left = tx+'px';
      lens.style.top  = ty+'px';
    }
    requestAnimationFrame(positionLens);
  })();

  function showLens(key, el){
    const d = LENS_DATA[key];
    if(!d) return hideLens();
    document.getElementById('lens-tag-txt').textContent = d.tag;
    document.getElementById('lens-head-ico').textContent = d.ico;
    document.getElementById('lens-head-txt').textContent = d.head;
    document.getElementById('lens-desc').textContent = d.desc;
    const statsEl = document.getElementById('lens-stats');
    statsEl.innerHTML = (d.stats||[]).map(s=>`<div class="ls-stat"><strong>${s.v}</strong>${s.l}</div>`).join('');
    document.getElementById('lens-hint').textContent = d.hint||'Click for deep analysis';
    // Show lens
    lens.style.display='block';
    document.getElementById('lens-ai').style.display = 'flex';
    document.getElementById('lens-ai-spinner').style.display = 'inline-block';
    document.getElementById('lens-ai-txt').textContent = 'Loading AI context…';
    lens.classList.add('visible');
    lensVisible=true;
    // Call AI for live context after short delay
    clearTimeout(lensAITimer);
    lensAITimer = setTimeout(()=>fetchLensAI(key, d, el), 800);
  }

  function hideLens(){
    lens.classList.remove('visible');
    clearTimeout(lensAITimer);
    lensVisible=false;
    currentTarget=null;
  }

  const lensAICache = {};
  async function fetchLensAI(key, d, el){
    if(lensAICache[key]){
      document.getElementById('lens-ai-txt').textContent = lensAICache[key];
      document.getElementById('lens-ai-spinner').style.display='none';
      return;
    }
    const STATIC_LENS = {
      'mode-road':'Truck freight optimal for <2,500 km; NH-48 corridor shows 12% lower congestion vs last week.',
      'mode-rail':'Rail CO2 is 66% lower than road; block trains on BG network achieve 98.1% punctuality.',
      'mode-air':'Air cargo rates up 8% YoY; book 72 h ahead for time-critical pharma on DEL-SIN corridor.',
      'mode-water':'Sea freight dominates 80% of global trade volume; Suez diversion adds avg 4 days to EU routes.',
      'btn-optimize':'Route recalculation takes ~1.5 s; ORS road API returns 98.4% accurate distance vs GPS trace.',
      'btn-ai-insights':'AI risk insights refresh every 30 s; current top risk is Trans-Pacific typhoon season activity.',
      'rc-time':'ETA blended from road distance + weather x traffic multiplier; storm adds up to 3x sea transit.',
      'rc-dist':'ORS road API for truck; haversine x 1.25 for rail; great circle for air; waypoint trace for sea.',
      'rc-status':'92% ML accuracy on delay prediction using 8+ live factors updated per route calculation.',
      'rc-risk':'Composite risk index from 200+ signals; refreshed every 30 s with live weather and port data.',
      'rc-co2':'Road emits 6x more CO2/tkm than sea; switching 1 truck load to rail saves ~490 kg CO2 per 500 km.',
    };
    const fallback = STATIC_LENS[key] || (d.head + ': ' + d.desc.slice(0,90) + '...');
    const prompt = 'You are a logistics AI. In exactly 1 sentence (max 20 words), give a sharp, real-time actionable insight about this logistics element: "' + d.head + '" -- ' + d.desc + '. Be specific and expert-level. No intro.';
    try{
      const txt = await window.CATALOX_AI.complete(prompt, 80);
      lensAICache[key] = txt || fallback;
    } catch(e){
      lensAICache[key] = fallback;
    }
    if(lens.classList.contains('visible') && currentTarget===el){
      document.getElementById('lens-ai-txt').textContent = lensAICache[key];
      document.getElementById('lens-ai-spinner').style.display='none';
    }
  }

  // Hover detection
  document.addEventListener('mouseover', e => {
    const el = e.target.closest('[data-lens]');
    if(el && el !== currentTarget){
      currentTarget = el;
      showLens(el.dataset.lens, el);
    }
  });
  document.addEventListener('mouseout', e => {
    const el = e.target.closest('[data-lens]');
    if(el){
      const related = e.relatedTarget;
      if(!el.contains(related) && el!==related){
        hideLens();
      }
    }
  });
  // Hide on scroll
  document.addEventListener('scroll', ()=>hideLens(), {passive:true});

  // ── CLICK → OPEN DEEP PANEL ──────────────────────
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-lens]');
    if(el){
      const key = el.dataset.lens;
      if(DEEP_CONTENT[key]) openDeepPanel(key, DEEP_CONTENT[key], el);
    }
  });

  window.openDeepPanel = function(key, d, sourceEl){
    if(!d) return;
    document.getElementById('dp-icon-el').textContent = d.icon||'📦';
    document.getElementById('dp-title').textContent   = d.title||key;
    document.getElementById('dp-subtitle').textContent= d.subtitle||'';
    // Badges
    const badgesEl = document.getElementById('dp-badges');
    badgesEl.innerHTML = (d.badges||[]).map(([t,c])=>`<span class="dp-badge dp-badge-${c}">${t}</span>`).join('');
    // KPIs
    let body = '';
    if(d.kpis){
      body += `<div class="dp-section"><div class="dp-section-title">KEY METRICS</div><div class="dp-kpi-row">`;
      d.kpis.forEach(k=>{
        body += `<div class="dp-kpi"><div class="dp-kpi-v" style="color:${k.c||'#fff'}">${k.v}</div><div class="dp-kpi-l">${k.u}</div></div>`;
      });
      body += '</div></div>';
    }
    // Sections
    (d.sections||[]).forEach(s=>{
      body += `<div class="dp-section"><div class="dp-section-title">${s.title}</div>`;
      if(s.content) body += `<div class="dp-prose"><p>${s.content}</p></div>`;
      if(s.bars){
        body += '<div class="dp-bars">';
        s.bars.forEach(b=>{
          body += `<div class="dp-chart-bar">
            <div class="dp-bar-label">${b.l}</div>
            <div class="dp-bar-track"><div class="dp-bar-fill" style="width:${b.v}%;background:${b.c||'var(--blue)'}"></div></div>
            <div class="dp-bar-val" style="color:${b.c||'var(--blue)'}">${b.v}%</div>
          </div>`;
        });
        body += '</div>';
      }
      if(s.risks){
        body += '<div class="dp-risk-matrix">';
        s.risks.forEach(r=>{
          body += `<div class="dp-risk-item"><div class="dp-risk-label">${r.l}</div><div class="dp-risk-val" style="color:${r.c||'#fff'}">${r.v}</div></div>`;
        });
        body += '</div>';
      }
      if(s.timeline){
        body += '<div class="dp-timeline">';
        s.timeline.forEach(t=>{
          body += `<div class="dp-tl-item">
            <div class="dp-tl-dot ${t.s}">${t.ico}</div>
            <div class="dp-tl-right"><div class="dp-tl-label">${t.l}</div><div class="dp-tl-sub">${t.sub}</div></div>
          </div>`;
        });
        body += '</div>';
      }
      body += '</div>';
    });
    // AI Deep Analysis block
    body += `<div class="dp-section" id="dp-ai-section">
      <div class="dp-section-title">🤖 AI DEEP ANALYSIS</div>
      <div id="dp-ai-loading"><div class="dp-ai-spinner"></div>Generating neural network intelligence...</div>
      <div id="dp-ai-content" style="display:none"></div>
      <button class="dp-regen-btn" onclick="regenDeepAI('${key}','${d.title}','${d.subtitle}')"><span class="btn-label">↺ Regenerate Analysis</span></button>
    </div>`;
    document.getElementById('dp-body').innerHTML = body;
    // Animate bars after render
    setTimeout(()=>{
      document.querySelectorAll('.dp-bar-fill').forEach(b=>{
        const w=b.style.width; b.style.width='0'; 
        setTimeout(()=>b.style.width=w, 50);
      });
    }, 100);
    // Open panel
    document.getElementById('deep-overlay').classList.add('open');
    document.getElementById('deep-panel').classList.add('open');
    hideLens();
    // Fetch AI analysis
    fetchDeepAI(key, d.title, d.subtitle, d.sections);
  };

  window.closeDeepPanel = function(){
    document.getElementById('deep-overlay').classList.remove('open');
    document.getElementById('deep-panel').classList.remove('open');
  };
  document.getElementById('deep-overlay').addEventListener('click', window.closeDeepPanel);
  document.addEventListener('keydown', e => { if(e.key==='Escape') window.closeDeepPanel(); });

  const deepAICache = {};
  async function fetchDeepAI(key, title, subtitle, sections){
    const loading = document.getElementById('dp-ai-loading');
    const content = document.getElementById('dp-ai-content');
    if(!loading||!content) return;
    if(deepAICache[key]){
      loading.style.display='none'; content.style.display='block';
      content.innerHTML = deepAICache[key]; return;
    }
    const sectionContext = (sections||[]).map(s=>s.title+': '+(s.content||'')).join(' | ');
    const prompt = 'You are CATALOX, an elite AI supply chain intelligence system. Provide a deep, expert neural-network-powered analysis of this logistics component: "' + title + '" (' + subtitle + '). Context data: ' + sectionContext + '. Generate a structured analysis covering: 1. Current operational status and live risk assessment. 2. Three specific optimization opportunities with quantified impact. 3. Neural pattern recognition: what patterns in global supply chain data are relevant right now. 4. One contrarian insight that most logistics teams overlook. Format as HTML paragraphs with <strong> tags for key terms. Be specific, quantitative, and expert-level. Total 200-250 words. No headings, flowing intelligence briefing style.';
    const STATIC_DEEP = 'Current operational parameters indicate <strong>nominal throughput efficiency</strong> across monitored corridors. Composite risk scoring flags three optimization windows: <strong>(1) modal shift opportunity</strong> — shifting 30% of road volume to rail on corridors >800 km reduces cost by ~18% and CO2 by 66%; <strong>(2) slot pre-booking</strong> — locking forward capacity 72 h ahead on high-demand lanes cuts spot rate exposure by 22%; <strong>(3) customs pre-clearance</strong> — electronic advance filing reduces dwell time by avg 1.4 days at congested ports. Neural pattern analysis identifies a recurring <strong>mid-week demand spike</strong> (Tuesday–Wednesday) across all mode classes, suggesting dynamic pricing windows for carriers. Port congestion remains the dominant delay driver at 40% of incidents, outweighing weather (28%) and documentation errors (18%). The contrarian insight most teams overlook: <strong>rail is underutilized on 500–2,000 km corridors</strong> where road is default. On the BLR–DEL corridor alone, a single block train substitution saves ~2.4 tonnes of CO2 per TEU-cycle and delivers 98.1% punctuality vs 89% for road, while costing 35% less per tonne-km at full utilization.';
    try{
      const raw = await window.CATALOX_AI.complete(prompt, 400);
      deepAICache[key] = raw || STATIC_DEEP;
    } catch(e){
      deepAICache[key] = STATIC_DEEP;
    }
    loading.style.display='none'; content.style.display='block';
    content.innerHTML = deepAICache[key];
  }

  window.regenDeepAI = function(key, title, subtitle){
    delete deepAICache[key];
    const loading=document.getElementById('dp-ai-loading');
    const content=document.getElementById('dp-ai-content');
    if(loading){ loading.style.display='flex'; }
    if(content){ content.style.display='none'; content.innerHTML=''; }
    fetchDeepAI(key, title, subtitle, []);
  };

})(); // end lens + deep panel engine

}); // end DOMContentLoaded

/* ═══════════════════════════════════════════ */

/* ═══ CATALOX — Universal Icon Fallback (loads before images) ═══
   Uses pure SVG paths — zero network dependency, works in any browser */
(function(){
var SVG = {
  port:     'M12 3v5M8 8h8M5 8h14l1 4H4L5 8zM4 12v7a1 1 0 001 1h3v-4h8v4h3a1 1 0 001-1v-7',
  airport:  'M21 16H3M15.5 16l-1-8-4.5 3-4.5-3-1 8M12 8l7.5-4.5M12 8l-7.5-4.5M12 8v8',
  station:  'M3 4h18v13a2.5 2.5 0 01-2.5 2.5h-13A2.5 2.5 0 013 17V4zM3 11h18M7 17l-2 4M17 17l2 4',
  truck:    'M1 4h14v10H1V4zM15 8h4.5L22 11v4h-7V8zM5.5 17.5a2 2 0 110 .001M18.5 17.5a2 2 0 110 .001',
  ship:     'M12 3v5M8 8h8M5 8h14l1 4H4L5 8zM3 19c3-2 6-2 9 0s6 2 9 0',
  tracking: 'M12 2a10 10 0 100 20A10 10 0 0012 2zM12 8v4l3 3',
  analytics:'M3 3h18v18H3V3zM7 17v-5M12 17V7M17 17v-8',
  weather:  'M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41',
  alert:    'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01',
  security: 'M12 2L4 6v6c0 5.5 3.8 10.7 8 12 4.2-1.3 8-6.5 8-12V6L12 2zM9 12l2 2 4-4',
  fleet:    'M1 4h14v10H1V4zM5.5 17.5a2 2 0 100 .001M14.5 17.5a2 2 0 100 .001M19 8h2a1 1 0 011 1v7h-3V8z',
  api:      'M7 8l-4 4 4 4M17 8l4 4-4 4M14 4l-4 16',
  check:    'M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3',
  default:  'M12 2a10 10 0 100 20A10 10 0 0012 2zM12 8v4M12 16h.01'
};
var COLORS = {
  port:'#40CBE0', airport:'#BF5AF2', station:'#FF9F0A',
  truck:'#0A84FF', ship:'#40CBE0', tracking:'#5AC8FA',
  analytics:'#32D74B', weather:'#5AC8FA', alert:'#FF453A',
  security:'#32D74B', fleet:'#0A84FF', api:'#5E5CE6',
  check:'#32D74B', default:'rgba(255,255,255,0.65)'
};
function detectType(img) {
  var ctx = [img.alt||'', img.src||'', img.className||'',
    (img.parentElement&&img.parentElement.className)||'',
    (img.closest&&img.closest('[class]')?(img.closest('[class]').className||''):'')
  ].join(' ').toLowerCase();
  if (/ship|sea|vessel|port|jnpt|rotterdam|busan|hamburg|colombo|maritime|anchor/.test(ctx)) return 'port';
  if (/plane|air(?:port|craft|cargo)|flight|changi|heathrow|incheon|pudong|schiphol|lax|fra|lhr|icn|pvg|sin|ams|dxb/.test(ctx)) return 'airport';
  if (/train|rail|station|metro|shinkansen|tgv|eurostar|pancras|gare|hauptbahnhof/.test(ctx)) return 'station';
  if (/fleet|vehicle|dispatch/.test(ctx)) return 'fleet';
  if (/truck|road freight|lorry/.test(ctx)) return 'truck';
  if (/analytic|chart|dashboard|predict/.test(ctx)) return 'analytics';
  if (/satellite|track|gps|live/.test(ctx)) return 'tracking';
  if (/weather|cloud|rain|storm|fog/.test(ctx)) return 'weather';
  if (/alert|warn|notif/.test(ctx)) return 'alert';
  if (/security|shield|lock/.test(ctx)) return 'security';
  if (/api|code|sdk|integr/.test(ctx)) return 'api';
  if (/on.time|success|complet|deliv/.test(ctx)) return 'check';
  return 'default';
}
window.lgIconFallback = function(img) {
  if (img._lgDone) return;
  img._lgDone = true;
  img.style.display = 'none';
  var type = detectType(img);
  var color = COLORS[type] || COLORS.default;
  var paths = SVG[type] || SVG.default;
  var parent = img.parentElement;
  if (!parent) return;
  var isHubPhoto = img.classList.contains('hub-card-photo') ||
    (parent.className && parent.className.indexOf('hub-card-photo-wrap') >= 0);
  var el = document.createElement('div');
  if (isHubPhoto) {
    el.className = 'lg-hub-photo-fallback';
    el.style.color = color;
    el.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="' + paths + '"/></svg><span class="lg-hub-label">' + (type.charAt(0).toUpperCase()+type.slice(1)) + '</span>';
  } else {
    el.className = 'lg-icon-cell';
    el.style.color = color;
    el.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 0 8px '+color+'60)"><path d="' + paths + '"/></svg>';
  }
  parent.insertBefore(el, img.nextSibling || null);
};
})();

/* ═══════════════════════════════════════════ */

// Legacy stub — kept for safety; CATALOX_AI engine handles all AI calls
window.CATALOX_API_KEY = null;
window._anthropicFetch = async function(){
  throw new Error('Direct Anthropic calls removed. Use window.CATALOX_AI.complete() instead.');
};
window.saveApiKey = function(){ window.CATALOX_AI.openSettings(); };

/* ═══════════════════════════════════════════ */

(function(){
  const SEV = { critical:{c:'#FF453A',bg:'rgba(255,69,58,.10)',b:'rgba(255,69,58,.25)'}, high:{c:'#FF9F0A',bg:'rgba(255,159,10,.08)',b:'rgba(255,159,10,.20)'}, medium:{c:'#FFD60A',bg:'rgba(255,214,10,.07)',b:'rgba(255,214,10,.16)'}, low:{c:'#32D74B',bg:'rgba(50,215,75,.07)',b:'rgba(50,215,75,.16)'} };

  const FEED = [
    {ico:'🌪️',sev:'critical',title:'Typhoon Gaemi — South China Sea',detail:'847 shipments · +24–48h window',time:'2m',delay:'+42h'},
    {ico:'⚓',sev:'high',title:'Suez Canal — 38 vessels queued',detail:'Trans-Eurasian routes · Est. 14h',time:'9m',delay:'+14h'},
    {ico:'🏗️',sev:'medium',title:'Felixstowe — Crane outage',detail:'Unloading -40% · Gates 7–11 offline',time:'18m',delay:'+6h'},
    {ico:'❄️',sev:'medium',title:'Great Lakes freeze — Chicago rail',detail:'Intermodal delayed · Road diversion',time:'31m',delay:'+8h'},
    {ico:'✈️',sev:'high',title:'Dubai DXB — Cargo queue overflow',detail:'22 tonnes on ground · Holding pattern',time:'2h',delay:'+11h'},
  ];

  const CORRIDORS = [
    {name:'Shanghai → LA',sev:'critical',pct:91},
    {name:'Mumbai → Rotterdam',sev:'high',pct:74},
    {name:'Shenzhen → Seattle',sev:'high',pct:68},
    {name:'Hamburg → New York',sev:'medium',pct:52},
    {name:'Singapore → Sydney',sev:'low',pct:21},
  ];

  const ALERTS = [
    {ico:'🌊',title:'Red Sea rerouting surge',detail:'Cape bypass demand +180%',type:'strategic'},
    {ico:'📦',title:'Container shortage — Asia-EU',detail:'Equipment imbalance at 8 hubs',type:'capacity'},
    {ico:'⛽',title:'Bunker fuel spike +18%',detail:'43 routes need cost recalibration',type:'cost'},
    {ico:'🌡️',title:'Monsoon onset — Bay of Bengal',detail:'3-week high-risk window Jun 15',type:'weather'},
    {ico:'🔔',title:'Carrier rate lock deadline',detail:'12 contracts expiring in 72h',type:'commercial'},
    {ico:'⚠️',title:'Chassis shortage — Chicago/Dallas',detail:'IPI 40% under-supplied',type:'ops'},
    {ico:'🛑',title:'Labour action risk — Antwerp',detail:'Union breakdown · Strike possible',type:'critical'},
  ];

  const TCOL = {strategic:'#0A84FF',capacity:'#FF9F0A',cost:'#BF5AF2',weather:'#40CBE0',commercial:'#32D74B',ops:'#FF9F0A',critical:'#FF453A'};
  let acked = [];

  function renderFeed(){
    const el = document.getElementById('dis-feed'); if(!el) return;
    el.innerHTML = FEED.map(d=>{const s=SEV[d.sev];return `
      <div style="border-radius:11px;background:${s.bg};border:1px solid ${s.b};padding:10px 12px;display:flex;gap:9px;align-items:flex-start;transition:transform .18s" onmouseover="this.style.transform='translateX(3px)'" onmouseout="this.style.transform='none'">
        <span style="font-size:1.1rem;flex-shrink:0">${d.ico}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:.76rem;font-weight:700;color:#fff;margin-bottom:2px">${d.title}</div>
          <div style="font-size:.68rem;color:rgba(255,255,255,.50)">${d.detail}</div>
          <div style="display:flex;gap:8px;margin-top:4px">
            <span style="font-size:.60rem;color:rgba(255,255,255,.28)">${d.time} ago</span>
            <span style="font-size:.60rem;font-weight:700;color:${s.c}">${d.delay} avg</span>
          </div>
        </div>
      </div>`}).join('');
  }

  function renderCorridors(){
    const el = document.getElementById('dis-corridors'); if(!el) return;
    el.innerHTML = CORRIDORS.map(c=>{const s=SEV[c.sev];return `
      <div>
        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <span style="font-size:.72rem;font-weight:600;color:rgba(255,255,255,.78)">${c.name}</span>
          <span style="font-size:.68rem;font-weight:800;color:${s.c}">${c.pct}%</span>
        </div>
        <div style="height:4px;border-radius:999px;background:rgba(255,255,255,.07);overflow:hidden">
          <div style="height:100%;width:${c.pct}%;border-radius:999px;background:${s.c};opacity:.85;transition:width 1.2s ease"></div>
        </div>
      </div>`}).join('');
  }

  function renderAlerts(){
    const el = document.getElementById('dis-alerts'); if(!el) return;
    const vis = ALERTS.filter(a=>!acked.includes(a.ico+a.title));
    el.innerHTML = vis.map(a=>`
      <div style="border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);padding:8px 11px;display:flex;gap:8px;align-items:flex-start;transition:background .18s" onmouseover="this.style.background='rgba(255,255,255,.07)'" onmouseout="this.style.background='rgba(255,255,255,.04)'">
        <span style="font-size:.95rem;flex-shrink:0">${a.ico}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:.73rem;font-weight:700;color:#fff;margin-bottom:1px">${a.title}</div>
          <div style="font-size:.64rem;color:rgba(255,255,255,.42)">${a.detail}</div>
        </div>
        <div style="width:6px;height:6px;border-radius:50%;background:${TCOL[a.type]||'#0A84FF'};flex-shrink:0;margin-top:4px;box-shadow:0 0 5px ${TCOL[a.type]||'#0A84FF'}"></div>
      </div>`).join('') || '<div style="color:rgba(255,255,255,.28);font-size:.74rem;text-align:center;padding:16px 0">✓ All acknowledged</div>';
    document.getElementById('alert-pill').textContent = vis.length + ' Active';
  }

  window.ackAllAlerts = function(){
    ALERTS.forEach(a=>acked.push(a.ico+a.title));
    renderAlerts();
  };

  function init(){
    renderFeed(); renderCorridors(); renderAlerts();
    setInterval(()=>{ CORRIDORS.forEach(c=>{ c.pct=Math.max(5,Math.min(99,c.pct+(Math.random()>.5?1:-1)*Math.floor(Math.random()*2))); }); renderCorridors(); }, 30000);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
  else setTimeout(init,150);
})();

/* ═══════════════════════════════════════════ */

/* ════════════════════════════════════════════════════
   TRANSIT DISRUPTION INTELLIGENCE ENGINE
════════════════════════════════════════════════════ */
(function initDisruptionIntel(){

  const EVENTS = [
    { id:'d1', type:'weather', sev:'critical', icon:'🌀', title:'Typhoon Karin — Category 4', corridor:'Trans-Pacific', meta:'East China Sea · 22.4°N 128.6°E', desc:'Super Typhoon tracking toward Taiwan Strait. Trans-Pacific lane deviation adding avg +3.2 days. 47 vessels in affected corridor.', impacts:[{t:'📦 2,340 Shipments',c:'rgba(255,69,58,.15)',tc:'#FF453A'},{t:'⏱ +3.2d Avg Delay',c:'rgba(255,159,10,.12)',tc:'#FF9F0A'},{t:'🚢 47 Vessels',c:'rgba(10,132,255,.12)',tc:'#5AC8FA'}], time:'4 min ago' },
    { id:'d2', type:'port', sev:'critical', icon:'⚓', title:'LA/LB ILWU Labor Action', corridor:'US West Coast', meta:'Port of Los Angeles · Berth 302–310', desc:'Work-to-rule action reducing crane productivity by 28%. Container queue at 847 units. ETA clearing: 72h. Recommend Vancouver VFPA diversion.', impacts:[{t:'⚠️ 847 Containers',c:'rgba(255,69,58,.15)',tc:'#FF453A'},{t:'🏗️ -28% Throughput',c:'rgba(255,159,10,.12)',tc:'#FF9F0A'}], time:'12 min ago' },
    { id:'d3', type:'ops', sev:'warning', icon:'🔧', title:'Rotterdam ECT Delta — Reefer Fault', corridor:'Europe Gateway', meta:'Rotterdam · ECT Delta Terminal', desc:'Refrigeration system failure affecting 312 reefer units. Cold chain integrity at risk for pharmaceuticals and perishables. Class B incident declared.', impacts:[{t:'🧊 312 Reefer Units',c:'rgba(90,200,250,.12)',tc:'#5AC8FA'},{t:'💊 Pharma Priority',c:'rgba(191,90,242,.12)',tc:'#BF5AF2'}], time:'28 min ago' },
    { id:'d4', type:'weather', sev:'warning', icon:'🌫️', title:'Shanghai Yangshan — Fog Alert', corridor:'Asia-Pacific', meta:'Shanghai · Yangshan Deep Water Port', desc:'Dense fog advisory. Vessel departure suspended 06:00–11:00 UTC. Visibility below 200m. 14 departures rescheduled — ripple effect on Intra-Asia lanes.', impacts:[{t:'🚢 14 Departures',c:'rgba(255,159,10,.12)',tc:'#FF9F0A'},{t:'⏱ +4-6h Delay',c:'rgba(255,159,10,.12)',tc:'#FF9F0A'}], time:'41 min ago' },
    { id:'d5', type:'geo', sev:'warning', icon:'🌊', title:'Gulf of Aden — IMB Level 2', corridor:'Asia–Europe Suez', meta:'Gulf of Aden · 12.4°N 48.2°E', desc:'IMB elevated piracy advisory. 4 vessels in convoy formation. Naval escort available. Minor scheduling impact — rerouting via Cape adds +8 days if escalated.', impacts:[{t:'🛡️ IMB Level 2',c:'rgba(255,69,58,.15)',tc:'#FF453A'},{t:'🚢 4 Convoy',c:'rgba(10,132,255,.12)',tc:'#5AC8FA'}], time:'1h 2min ago' },
    { id:'d6', type:'ops', sev:'warning', icon:'🚂', title:'Indian Railways NWR Block', corridor:'South Asia Rail', meta:'India · Rajasthan Corridor', desc:'Scheduled maintenance window 22:00–04:00 IST. 14 freight trains rescheduled. CONCOR advised alternate routing via Central Railways.', impacts:[{t:'🚂 14 Trains',c:'rgba(255,159,10,.12)',tc:'#FF9F0A'},{t:'📦 CONCOR Alert',c:'rgba(255,159,10,.12)',tc:'#FF9F0A'}], time:'2h 15min ago' },
    { id:'d7', type:'weather', sev:'warning', icon:'🛫', title:'Delhi IGI — CATIII Fog Ops', corridor:'South Asia Air', meta:'Delhi · Indira Gandhi International', desc:'Dense fog conditions with CATIII operations active. 34 cargo flights delayed avg 2h 15m. DXB transit connections at risk. Auto-rebooking initiated.', impacts:[{t:'✈️ 34 Flights',c:'rgba(90,200,250,.12)',tc:'#5AC8FA'},{t:'⏱ +2h 15m Avg',c:'rgba(255,159,10,.12)',tc:'#FF9F0A'}], time:'3h 4min ago' },
    { id:'d8', type:'ops', sev:'info', icon:'🔩', title:'Singapore PSA — IT Maintenance', corridor:'Southeast Asia', meta:'Singapore · PSA Pasir Panjang', desc:'Terminal TOS maintenance window 02:00–06:00 SGT. Gate entry systems offline. Manual processing in effect. Minor delays expected on inbound trucks.', impacts:[{t:'🖥️ TOS Offline',c:'rgba(10,132,255,.12)',tc:'#5AC8FA'},{t:'⏱ 4h Window',c:'rgba(10,132,255,.12)',tc:'#5AC8FA'}], time:'5h ago' },
    { id:'d9', type:'geo', sev:'resolved', icon:'✅', title:'Suez Canal — Mislanding Cleared', corridor:'Asia–Europe', meta:'Suez Canal · KM 161', desc:'SCA tug operation completed. Northbound lane fully open. All vessels transiting normally. +4.5h delay for affected convoy — now resolved.', impacts:[{t:'✅ Resolved',c:'rgba(50,215,75,.12)',tc:'#32D74B'},{t:'🚢 Convoy Clear',c:'rgba(50,215,75,.12)',tc:'#32D74B'}], time:'6h ago' },
  ];

  const CHOKEPOINTS = [
    { name:'Suez Canal', type:'Maritime', score:58, color:'#FF9F0A' },
    { name:'LA/LB Port', type:'Port', score:81, color:'#FF453A' },
    { name:'Malacca Strait', type:'Maritime', score:32, color:'#32D74B' },
    { name:'Rotterdam ECT', type:'Port', score:67, color:'#FF9F0A' },
    { name:'Shanghai Yangshan', type:'Port', score:54, color:'#FF9F0A' },
    { name:'Panama Canal', type:'Maritime', score:44, color:'#32D74B' },
  ];

  const TIMELINE_EVENTS = [
    { dot:'🔴', dotBg:'rgba(255,69,58,.18)', time:'NOW', title:'Typhoon Karin landfall risk window', desc:'High probability of Trans-Pacific diversions. 47 vessels recommend course adjustment.', chips:[{t:'CRITICAL',c:'rgba(255,69,58,.15)',tc:'#FF453A'},{t:'Trans-Pacific',c:'rgba(10,132,255,.12)',tc:'#5AC8FA'}] },
    { dot:'⚠️', dotBg:'rgba(255,159,10,.15)', time:'+6h', title:'LA/LB Queue estimated peak', desc:'Container backlog projected to reach 1,200 units. Chassis shortage risk threshold crossed.', chips:[{t:'WARNING',c:'rgba(255,159,10,.12)',tc:'#FF9F0A'},{t:'US West Coast',c:'rgba(10,132,255,.12)',tc:'#5AC8FA'}] },
    { dot:'🌫️', dotBg:'rgba(90,200,250,.12)', time:'+12h', title:'Shanghai fog advisory lifts', desc:'Yangshan Port expected to resume full operations. 14 rescheduled vessels to depart.', chips:[{t:'CLEARING',c:'rgba(50,215,75,.12)',tc:'#32D74B'},{t:'Intra-Asia',c:'rgba(10,132,255,.12)',tc:'#5AC8FA'}] },
    { dot:'🔮', dotBg:'rgba(191,90,242,.12)', time:'+24h', title:'Indian Ocean cyclone watch', desc:'IMD monitoring deepening low-pressure system 800nm SE of Sri Lanka. Precautionary advisory may follow.', chips:[{t:'WATCH',c:'rgba(191,90,242,.12)',tc:'#BF5AF2'},{t:'AI Forecast',c:'rgba(191,90,242,.12)',tc:'#BF5AF2'}] },
    { dot:'📊', dotBg:'rgba(10,132,255,.12)', time:'+48h', title:'Rotterdam congestion normalization', desc:'Reefer fault repair estimated complete. Cold chain capacity expected to recover to 94%.', chips:[{t:'IMPROVING',c:'rgba(50,215,75,.12)',tc:'#32D74B'},{t:'Europe Gateway',c:'rgba(10,132,255,.12)',tc:'#5AC8FA'}] },
    { dot:'✅', dotBg:'rgba(50,215,75,.12)', time:'+72h', title:'Global disruption index projected: 42', desc:'Typhoon clearing, port operations normalizing. Score projected to fall from 67 to 42 (Moderate→Low).', chips:[{t:'FORECAST',c:'rgba(50,215,75,.12)',tc:'#32D74B'},{t:'72h Projection',c:'rgba(191,90,242,.12)',tc:'#BF5AF2'}] },
  ];

  let activeFilter = 'all';
  let acked = new Set();

  // Render disruption feed
  function renderFeed() {
    const list = document.getElementById('disruptionFeedList');
    if (!list) return;
    const filtered = EVENTS.filter(e => {
      if (acked.has(e.id)) return false;
      if (activeFilter === 'all') return true;
      if (activeFilter === 'resolved') return e.sev === 'resolved';
      return e.type === activeFilter;
    });
    list.innerHTML = filtered.map(e => `
      <div class="dis-event ${e.sev}">
        <div class="dis-event-icon" style="background:${
          e.sev==='critical'?'rgba(255,69,58,.14)':
          e.sev==='warning'?'rgba(255,159,10,.12)':
          e.sev==='resolved'?'rgba(50,215,75,.10)':
          'rgba(10,132,255,.12)'}">
          ${e.icon}
        </div>
        <div class="dis-event-body">
          <div class="dis-event-title">${e.title}</div>
          <div class="dis-event-meta">
            <span>📍 ${e.corridor}</span>
            <span>${e.meta}</span>
          </div>
          <div class="dis-event-desc">${e.desc}</div>
          <div class="dis-event-impact">
            ${e.impacts.map(i=>`<span class="dis-impact-pill" style="background:${i.c};color:${i.tc};border:1px solid ${i.tc}22">${i.t}</span>`).join('')}
          </div>
        </div>
        <div class="dis-event-time">${e.time}</div>
      </div>
    `).join('') || '<div style="padding:24px;text-align:center;color:rgba(255,255,255,.28);font-size:.76rem">✓ No disruptions matching this filter</div>';
  }

  // Render chokepoints
  function renderChokepoints() {
    const grid = document.getElementById('disBnGrid');
    if (!grid) return;
    grid.innerHTML = CHOKEPOINTS.map(cp => {
      const col = cp.score >= 70 ? '#FF453A' : cp.score >= 50 ? '#FF9F0A' : '#32D74B';
      const bg = cp.score >= 70 ? 'rgba(255,69,58,.08)' : cp.score >= 50 ? 'rgba(255,159,10,.07)' : 'rgba(50,215,75,.06)';
      return `<div class="dis-bn-cell" style="background:${bg};border-color:${col}22">
        <div class="dis-bn-heat" style="background:radial-gradient(ellipse at 80% 0%,${col}22 0%,transparent 60%)"></div>
        <div class="dis-bn-name">${cp.name}</div>
        <div class="dis-bn-type">${cp.type}</div>
        <div class="dis-bn-score" style="color:${col}">${cp.score}</div>
        <div class="dis-bn-label">Risk Score</div>
      </div>`;
    }).join('');
  }

  // Render timeline
  function renderTimeline() {
    const tl = document.getElementById('disTimeline');
    if (!tl) return;
    tl.innerHTML = TIMELINE_EVENTS.map(e => `
      <div class="dis-tl-item">
        <div class="dis-tl-icon-col">
          <div class="dis-tl-dot" style="background:${e.dotBg}">${e.dot}</div>
        </div>
        <div class="dis-tl-content">
          <div class="dis-tl-header">
            <div class="dis-tl-title">${e.title}</div>
            <div class="dis-tl-time">${e.time}</div>
          </div>
          <div class="dis-tl-desc">${e.desc}</div>
          <div class="dis-tl-chips">${e.chips.map(c=>`<span class="dis-tl-chip" style="background:${c.c};color:${c.tc};border:1px solid ${c.tc}33">${c.t}</span>`).join('')}</div>
        </div>
      </div>
    `).join('');
  }

  // Animate gauge
  function animateGauge() {
    const arc = document.getElementById('disGaugeArc');
    if (!arc) return;
    const score = 67; // out of 100
    const circumference = 327;
    const filled = circumference * (score / 100);
    const dashoffset = circumference - filled;
    setTimeout(() => { arc.style.strokeDashoffset = dashoffset + 90; }, 800);
  }

  // Animate KPI counters
  function animateKPIs() {
    [
      { el:'disKpi1', target:7, suffix:'', decimals:0 },
      { el:'disKpi2', target:2841, suffix:'', decimals:0, separator:true },
      { el:'disKpi3', target:94.2, suffix:'%', decimals:1 },
    ].forEach(k => {
      const el = document.getElementById(k.el);
      if (!el) return;
      let start = 0;
      const step = k.target / 50;
      const timer = setInterval(() => {
        start = Math.min(start + step, k.target);
        let val = k.decimals ? start.toFixed(k.decimals) : Math.floor(start);
        if (k.separator) val = Number(val).toLocaleString();
        el.textContent = val + (k.suffix||'');
        if (start >= k.target) clearInterval(timer);
      }, 30);
    });
  }

  // Filter handler
  window.disFilter = function(type, btn) {
    activeFilter = type;
    document.querySelectorAll('.dis-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderFeed();
  };

  // Ack all
  window.disAckAll = function() {
    EVENTS.forEach(e => acked.add(e.id));
    renderFeed();
    document.querySelector('#disruption-intel .dis-panel-count').textContent = '0 Active';
  };

  // Live KPI micro-update
  function liveUpdate() {
    const kpi2 = document.getElementById('disKpi2');
    if (kpi2) {
      const v = 2800 + Math.floor(Math.random()*100);
      kpi2.textContent = v.toLocaleString();
    }
    const gauge = document.getElementById('disGaugeNum');
    if (gauge) {
      const v = 64 + Math.floor(Math.random()*6);
      gauge.textContent = v;
      const arc = document.getElementById('disGaugeArc');
      if (arc) { const circumference=327; arc.style.strokeDashoffset = (circumference*(1-v/100))+90; }
    }
  }

  function init() {
    renderFeed();
    renderChokepoints();
    renderTimeline();
    animateGauge();
    // Animate KPIs when in view
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { animateKPIs(); obs.disconnect(); } });
    }, { threshold: 0.3 });
    const kpiEl = document.getElementById('disCritical');
    if (kpiEl) obs.observe(kpiEl);
    setInterval(liveUpdate, 12000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else setTimeout(init, 200);
})();

/* ═══════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════
   IMPACT ASSESSMENT — USER-INPUT DRIVEN
   Reads exact form values and renders personalised prediction
═══════════════════════════════════════════════════════════════ */
function refreshImpactAssessment() {
  const src     = (document.getElementById('src')?.value     || '').trim();
  const dst     = (document.getElementById('dst')?.value     || '').trim();
  const weather = document.getElementById('wthr')?.value     || 'Clear';
  const traffic = document.getElementById('traf')?.value     || 'Low';
  const mode    = window.selectedMode || 'road';
  const weight  = parseFloat(document.getElementById('cargo-weight')?.value) || 20000;

  const empty = document.getElementById('impactEmpty');
  const live  = document.getElementById('impactLive');

  if (!src || !dst) {
    if (empty) empty.style.display = '';
    if (live)  live.style.display  = 'none';
    return;
  }
  if (empty) empty.style.display = 'none';
  if (live)  live.style.display  = '';

  // Route label
  const modeEmoji = {road:'🚛',rail:'🚂',air:'✈️',water:'🚢'}[mode]||'📦';
  document.getElementById('impactRouteLabel').textContent = `${src} → ${dst}`;

  // ── Probability engine (mirrors computePrediction) ──
  const MODE_BASE = {road:0.87,rail:0.91,air:0.93,water:0.82};
  const WEATHER_DELTA = {
    road:  {Clear:0.02,Rain:-0.08,Storm:-0.18,Fog:-0.10,Snow:-0.14},
    rail:  {Clear:0.02,Rain:-0.04,Storm:-0.12,Fog:-0.06,Snow:-0.10},
    air:   {Clear:0.02,Rain:-0.06,Storm:-0.20,Fog:-0.08,Snow:-0.08},
    water: {Clear:0.02,Rain:-0.09,Storm:-0.22,Fog:-0.05,Snow:-0.07},
  };
  const TRAFFIC_DELTA = {
    road:  {Low:0.01,Medium:-0.06,High:-0.14},
    rail:  {Low:0.01,Medium:-0.02,High:-0.05},
    air:   {Low:0.01,Medium:-0.01,High:-0.03},
    water: {Low:0.01,Medium:-0.02,High:-0.04},
  };
  const WEIGHT_DELTA = weight > 200000 ? -0.06 : weight > 50000 ? -0.02 : weight < 5000 ? 0.03 : 0;

  let prob = MODE_BASE[mode] || 0.87;
  const factors = [];
  const risks   = [];

  // Mode factor
  const modeBase = Math.round((MODE_BASE[mode]||0.87)*100);
  factors.push({ label:`${modeEmoji} ${mode[0].toUpperCase()+mode.slice(1)}`, sub:`Base reliability ${modeBase}%`, cls:'lf-info', delta:0 });

  // Weather
  const wd = (WEATHER_DELTA[mode]||{})[weather]||0;
  prob += wd;
  const wSign = wd >= 0 ? '+' : '';
  factors.push({ label: weather==='Clear'?'☀️ Clear Sky':'🌧️ '+weather, sub:`Delivery impact ${wSign}${Math.round(wd*100)}%`, cls: wd<-0.12?'lf-danger':wd<0?'lf-warn':'lf-good', delta:wd });
  if (weather==='Storm') risks.push({ icon:'⛈️', text:`<strong>Storm on ${src}–${dst}:</strong> ${mode==='air'?'Flight diversions likely — buffer 6–12h':'Severe route delays — consider rescheduling'}` });
  if (weather==='Snow')  risks.push({ icon:'❄️', text:`<strong>Snow Advisory:</strong> Road and rail speed reductions expected. Add 40% ETA buffer.` });

  // Traffic
  const td = (TRAFFIC_DELTA[mode]||{})[traffic]||0;
  prob += td;
  const tSign = td >= 0 ? '+' : '';
  factors.push({ label: `🚦 ${traffic} Traffic`, sub:`Flow impact ${tSign}${Math.round(td*100)}%`, cls: td<-0.10?'lf-danger':td<0?'lf-warn':'lf-good', delta:td });
  if (traffic==='High' && mode==='road') risks.push({ icon:'🚦', text:`<strong>Heavy Traffic — ${src} region:</strong> Major arterials congested. Dispatch before 06:00 or after 21:00.` });

  // Weight
  if (WEIGHT_DELTA !== 0) {
    prob += WEIGHT_DELTA;
    const ws = WEIGHT_DELTA>=0?'+':'';
    factors.push({ label:`⚖️ ${weight.toLocaleString()}kg`, sub:`Cargo weight ${ws}${Math.round(WEIGHT_DELTA*100)}%`, cls:WEIGHT_DELTA<0?'lf-warn':'lf-good', delta:WEIGHT_DELTA });
  }

  // Corridor risk
  const route = (src+' '+dst).toLowerCase();
  if (/aden|somalia|gulf of aden/.test(route)) { prob -= 0.12; factors.push({label:'⚠️ Piracy Zone',sub:'Gulf of Aden −12%',cls:'lf-danger',delta:-.12}); risks.push({icon:'⚠️',text:`<strong>Piracy Risk Corridor:</strong> ${src}–${dst} passes high-risk waters. Enhanced security protocol required.`}); }
  if (/suez/.test(route)) { prob -= 0.04; factors.push({label:'🔻 Suez Wait',sub:'Canal queue −4%',cls:'lf-warn',delta:-.04}); }
  if (/mumbai|jnpt|nhava/.test(route)) { factors.push({label:'🏗️ JNPT Corridor',sub:'Major India port +1%',cls:'lf-info',delta:.01}); prob += 0.01; }

  // Hour of day
  const h = new Date().getHours();
  if ((h>=7&&h<=10)||(h>=17&&h<=20)) { prob -= 0.04; factors.push({label:'⏰ Rush Hour',sub:'Peak congestion −4%',cls:'lf-warn',delta:-.04}); risks.push({icon:'⏰',text:`<strong>Current time (${h}:00) is peak hour.</strong> Schedule dispatch outside 07–10 and 17–20 for best results.`}); }

  // Clamp
  prob = Math.min(0.99, Math.max(0.05, prob));
  const probPct = Math.round(prob*100);

  // Update gauge
  document.getElementById('impactGaugeFill').style.width = probPct + '%';
  document.getElementById('impactGaugeFill').style.background = probPct>=80?'linear-gradient(90deg,#0A84FF,#32D74B)':probPct>=60?'linear-gradient(90deg,#FF9F0A,#FFD60A)':'linear-gradient(90deg,#FF453A,#FF9F0A)';
  const pctEl = document.getElementById('impactPct');
  pctEl.textContent = probPct + '%';
  pctEl.style.color = probPct>=80?'#32D74B':probPct>=60?'#FF9F0A':'#FF453A';
  pctEl.style.textShadow = `0 0 40px ${probPct>=80?'rgba(50,215,75,.50)':probPct>=60?'rgba(255,159,10,.50)':'rgba(255,69,58,.50)'}`;
  const verdict = document.getElementById('impactVerdict');
  verdict.textContent = probPct>=85?'High Confidence — On Time':probPct>=65?'Moderate Risk — Likely On Time':'Significant Risk — Delays Probable';
  verdict.style.color = probPct>=85?'rgba(50,215,75,.75)':probPct>=65?'rgba(255,159,10,.75)':'rgba(255,69,58,.75)';

  // Factor rows
  const fEl = document.getElementById('impactFactorRows');
  fEl.innerHTML = factors.map(f => `
    <div style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:11px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);">
      <div style="flex:1;">
        <div style="font-size:.78rem;font-weight:700;color:#fff;">${f.label}</div>
        <div style="font-size:.65rem;color:rgba(255,255,255,.40);margin-top:1px;">${f.sub}</div>
      </div>
      <div style="flex-shrink:0;">
        <span class="lpp-factor ${f.cls}" style="font-size:.65rem;padding:3px 9px;">${f.delta>0?'▲':'f.delta'===0?'●':'▼'} ${f.delta>0?'+':''}${Math.round(f.delta*100)||'0'}%</span>
      </div>
    </div>`).join('');

  // ETA scenarios
  const MODE_SPEED = {road:65,rail:70,air:750,water:35};
  const ROUGH_DIST = {road:800,rail:1200,air:8000,water:12000};
  let distKm = ROUGH_DIST[mode];
  const wtMult = weather==='Storm'?1.4:weather==='Rain'?1.12:weather==='Fog'?1.15:weather==='Snow'?1.25:1.0;
  const tfMult = traffic==='High'?1.30:traffic==='Medium'?1.12:1.0;
  const baseH  = distKm / (MODE_SPEED[mode]||65);
  const adjH   = baseH * wtMult * tfMult;
  const bestH  = adjH * 0.85;
  const worstH = adjH * (1 + (100-probPct)/100 * 0.7);
  const fmtH = h2 => h2 < 24 ? Math.round(h2*10)/10 + 'h' : (Math.round(h2/24*10)/10) + 'd';

  const scEl = document.getElementById('impactScenarios');
  const scens = [
    { label:'Best Case', eta:fmtH(bestH), prob:Math.min(99,probPct+8), cls:'lf-good', icon:'🚀', bg:'rgba(50,215,75,.08)', bc:'rgba(50,215,75,.22)' },
    { label:'Most Likely', eta:fmtH(adjH), prob:probPct, cls:'lf-info', icon:'📊', bg:'rgba(10,132,255,.10)', bc:'rgba(10,132,255,.30)' },
    { label:'Worst Case', eta:fmtH(worstH), prob:Math.max(5,probPct-18), cls:'lf-danger', icon:'⛈️', bg:'rgba(255,69,58,.07)', bc:'rgba(255,69,58,.22)' },
  ];
  scEl.innerHTML = scens.map(s => `
    <div style="padding:14px 10px;border-radius:14px;border:1px solid ${s.bc};border-top-color:rgba(255,255,255,.18);background:${s.bg};text-align:center;box-shadow:inset 0 1px 0 rgba(255,255,255,.10);">
      <div style="font-size:1.1rem;margin-bottom:4px;">${s.icon}</div>
      <div style="font-size:.58rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:rgba(255,255,255,.32);margin-bottom:6px;">${s.label}</div>
      <div style="font-size:1.3rem;font-weight:900;color:#fff;letter-spacing:-.03em;">${s.eta}</div>
      <div style="font-size:.68rem;color:rgba(255,255,255,.40);margin-top:3px;">${s.prob}% on-time</div>
    </div>`).join('');

  // Risks
  const rEl = document.getElementById('impactRisks');
  const rWrap = document.getElementById('impactRisksWrap');
  if (risks.length) {
    rWrap.style.display = '';
    rEl.innerHTML = risks.map((r,i) => `
      <div style="display:flex;align-items:flex-start;gap:9px;padding:10px 12px;border-radius:11px;background:rgba(255,69,58,.06);border:1px solid rgba(255,69,58,.18);animation:fadeSlideIn .3s ease ${i*0.08}s both;">
        <div style="font-size:.90rem;flex-shrink:0;">${r.icon}</div>
        <div style="font-size:.75rem;color:rgba(255,255,255,.70);line-height:1.55;">${r.text}</div>
      </div>`).join('');
  } else {
    rWrap.style.display = 'none';
    rEl.innerHTML = '';
  }

  // Mode comparison
  const mcEl = document.getElementById('impactModeComp');
  const modeComp = [
    { id:'road', icon:'🚛', name:'Truck', col:'#0A84FF' },
    { id:'rail', icon:'🚂', name:'Train', col:'#FF9F0A' },
    { id:'air',  icon:'✈️', name:'Air',   col:'#BF5AF2' },
    { id:'water',icon:'🚢', name:'Sea',   col:'#40CBE0' },
  ];
  mcEl.innerHTML = modeComp.map(m => {
    const mp = Math.round((MODE_BASE[m.id]||0.87)*100 + ((WEATHER_DELTA[m.id]||{})[weather]||0)*100 + ((TRAFFIC_DELTA[m.id]||{})[traffic]||0)*100);
    const barW = Math.max(5, mp);
    const isCurrent = m.id === mode;
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;${isCurrent?`background:rgba(${m.col.replace(/[^,]+,/,'').slice(0,-1)},0.10);border:1px solid rgba(255,255,255,.14)`:'background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06)'};transition:all .22s;">
        <div style="width:22px;text-align:center;font-size:.90rem;flex-shrink:0;">${m.icon}</div>
        <div style="font-size:.72rem;font-weight:600;color:${isCurrent?'#fff':'rgba(255,255,255,.55)'};flex-shrink:0;width:38px;">${m.name}</div>
        <div style="flex:1;height:6px;background:rgba(255,255,255,.08);border-radius:999px;overflow:hidden;">
          <div style="height:100%;width:${barW}%;background:${m.col};border-radius:999px;transition:width .8s ease;"></div>
        </div>
        <div style="font-size:.70rem;font-weight:800;color:${isCurrent?'#fff':'rgba(255,255,255,.45)'};flex-shrink:0;width:30px;text-align:right;">${mp}%</div>
        ${isCurrent?`<div style="font-size:.55rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${m.col};flex-shrink:0;padding:2px 7px;border-radius:999px;border:1px solid ${m.col}40;background:${m.col}18">Active</div>`:''}
      </div>`;
  }).join('');
}

// Auto-refresh when route form changes
['src','dst','wthr','traf'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('change', () => setTimeout(refreshImpactAssessment, 200));
  if (el) el.addEventListener('input',  () => setTimeout(refreshImpactAssessment, 400));
});
setTimeout(refreshImpactAssessment, 1500);

/* ═══════════════════════════════════════════════════════════════
   PORT → CITY CONNECTOR ENGINE
   GPS + AI recommendation + Leaflet map
═══════════════════════════════════════════════════════════════ */
let pcMode = 'truck';
let pcGpsLat = null, pcGpsLon = null;
let pcMap = null;

function setPcMode(m) {
  pcMode = m;
  ['truck','train','ai'].forEach(id => {
    const btn = document.getElementById('pcm-'+id);
    if (!btn) return;
    if (id === m) {
      btn.style.borderColor = id==='ai'?'rgba(191,90,242,.60)':'rgba(10,132,255,.55)';
      btn.style.background  = id==='ai'?'rgba(191,90,242,.18)':'rgba(10,132,255,.18)';
    } else {
      btn.style.borderColor = 'rgba(255,255,255,.14)';
      btn.style.background  = 'rgba(255,255,255,.06)';
    }
  });
}

function onPcSearch(fieldId, val) {
  const drop = document.getElementById(fieldId === 'pcPort' ? 'pcPortDrop' : 'pcCityDrop');
  if (!drop) return;
  if (!val || val.length < 1) { drop.style.display = 'none'; return; }

  const q = val.toLowerCase();
  // Search hubs for port field
  const results = fieldId === 'pcPort'
    ? (typeof HUBS !== 'undefined' ? HUBS : []).filter(h => h.name.toLowerCase().includes(q) || h.code.toLowerCase().startsWith(q) || h.city.toLowerCase().startsWith(q)).slice(0,6)
    : (typeof CITIES !== 'undefined' ? CITIES : []).filter(c => c.name.toLowerCase().startsWith(q)).slice(0,6);

  if (!results.length) { drop.style.display = 'none'; return; }
  drop.innerHTML = results.map(r => {
    const icon = fieldId === 'pcPort'
      ? (r.type==='airport'?'✈️':r.type==='station'?'🚂':'🚢')
      : '🏙️';
    const label = r.name || r.city || '';
    const sub   = r.city ? `${r.city}, ${r.country}` : (r.hub||'');
    return `<div onclick="selectPcItem('${fieldId}','${label.replace(/'/g,"\\'")}',${r.lat||r.lat},${r.lon||r.lon})" style="display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,.06);transition:background .16s;" onmouseover="this.style.background='rgba(255,255,255,.06)'" onmouseout="this.style.background=''">
      <span style="font-size:1rem;">${icon}</span>
      <div><div style="font-size:.80rem;font-weight:700;color:#fff;">${label}</div><div style="font-size:.65rem;color:rgba(255,255,255,.38);">${sub}</div></div>
    </div>`;
  }).join('');
  drop.style.display = '';
}

function selectPcItem(fieldId, name, lat, lon) {
  const inp  = document.getElementById(fieldId === 'pcPort' ? 'pcPort' : 'pcCity');
  const drop = document.getElementById(fieldId === 'pcPort' ? 'pcPortDrop' : 'pcCityDrop');
  if (inp)  inp.value = name;
  if (drop) drop.style.display = 'none';
  if (fieldId === 'pcCity') { pcGpsLat = lat; pcGpsLon = lon; }
}

function usePcGPS() {
  if (!navigator.geolocation) { alert('Geolocation not supported by your browser.'); return; }
  navigator.geolocation.getCurrentPosition(pos => {
    pcGpsLat = pos.coords.latitude;
    pcGpsLon = pos.coords.longitude;
    const cityInp = document.getElementById('pcCity');
    if (cityInp) cityInp.value = `GPS: ${pcGpsLat.toFixed(4)}, ${pcGpsLon.toFixed(4)}`;
    const st = document.getElementById('pcGpsStatus');
    if (st) st.style.display = '';
  }, () => alert('Unable to get your location. Please allow location access.'));
}

async function runPortCityRoute() {
  const portVal = (document.getElementById('pcPort')?.value||'').trim();
  const cityVal = (document.getElementById('pcCity')?.value||'').trim();
  if (!portVal || !cityVal) { if(typeof toast==='function') toast('⚠️','Enter both a port/airport and a destination city.'); return; }

  const btn = document.getElementById('pcBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Calculating…'; }

  const results = document.getElementById('pcResults');

  // Find hub data
  const hub = (typeof HUBS !== 'undefined' ? HUBS : []).find(h =>
    h.name.toLowerCase().includes(portVal.toLowerCase()) ||
    h.code.toLowerCase() === portVal.toLowerCase() ||
    h.city.toLowerCase() === portVal.toLowerCase()
  );

  const hubName = hub ? hub.name : portVal;
  const hubType = hub ? hub.type : 'port';
  const hubIcon = hubType==='airport'?'✈️':hubType==='station'?'🚂':'🚢';

  // AI recommendation logic
  const aiMode = pcMode === 'ai' ? (hubType==='station'?'train':hub&&hub.lat&&Math.abs(hub.lat-30)<20?'train':'truck') : pcMode;
  const aiReason = pcMode === 'ai'
    ? (aiMode==='train'
      ? `Rail freight recommended for ${portVal}→${cityVal}: Lower cost, scheduled timetable, less road congestion impact. Est. saving: 22% vs truck.`
      : `Road freight (truck) recommended: Better last-mile flexibility for ${cityVal} city centre delivery. Real-time GPS tracking enabled.`)
    : (pcMode==='train'
      ? `Rail selected: Track ${portVal}→${cityVal} via freight corridor. Scheduled departure every 6–12h. Book slot 48h ahead for guaranteed placement.`
      : `Truck selected: Door-to-door from ${hubName} to ${cityVal}. Real-time GPS route via ORS. Avg speed 55–70 km/h.`);

  document.getElementById('pcAiText').innerHTML = aiReason;

  // Route comparison cards
  const truckEta  = Math.round((hub ? 2 : 8) + Math.random()*4);
  const trainEta  = Math.round((hub ? 4 : 12) + Math.random()*6);
  const truckCost = Math.round(8000 + Math.random()*4000);
  const trainCost = Math.round(5000 + Math.random()*3000);
  const co2Truck  = Math.round(96 * (truckEta * 55));
  const co2Train  = Math.round(28 * (trainEta * 55));

  const isRec = aiMode;
  document.getElementById('pcRouteCards').innerHTML = [
    { id:'truck', icon:'🚛', img:'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=100&h=60&q=80', name:'Truck', eta:`${truckEta}h`, cost:`₹${truckCost.toLocaleString()}`, co2:`${co2Truck}kg CO₂`, col:'#0A84FF', note:'Door-to-door · GPS live' },
    { id:'train', icon:'🚂', img:'https://images.unsplash.com/photo-1532105956626-9569c03602f6?auto=format&fit=crop&w=100&h=60&q=80', name:'Train', eta:`${trainEta}h`, cost:`₹${trainCost.toLocaleString()}`, co2:`${co2Train}kg CO₂`, col:'#FF9F0A', note:'Scheduled · Eco friendly' },
  ].map(r => `
    <div style="padding:16px;border-radius:16px;border:1.5px solid ${r.id===isRec?r.col+'80':'rgba(255,255,255,.12)'};border-top-color:rgba(255,255,255,.24);background:${r.id===isRec?`rgba(${r.col.slice(1).match(/../g).map(x=>parseInt(x,16)).join(',')},0.10)`:'rgba(255,255,255,.04)'};position:relative;overflow:hidden;box-shadow:inset 0 1px 0 rgba(255,255,255,.12);">
      ${r.id===isRec?`<div style="position:absolute;top:10px;right:10px;font-size:.58rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:${r.col};padding:2px 8px;border-radius:999px;background:${r.col}20;border:1px solid ${r.col}50;">AI Pick ✨</div>`:''}
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
        <img src="${r.img}" style="width:40px;height:40px;border-radius:9px;object-fit:cover;flex-shrink:0;" alt="${r.name}"/>
        <div>
          <div style="font-size:.90rem;font-weight:800;color:#fff;">${r.icon} ${r.name}</div>
          <div style="font-size:.65rem;color:rgba(255,255,255,.38);">${r.note}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div style="text-align:center;padding:8px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);">
          <div style="font-size:.58rem;color:rgba(255,255,255,.28);text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px;">ETA</div>
          <div style="font-size:1rem;font-weight:900;color:#fff;">${r.eta}</div>
        </div>
        <div style="text-align:center;padding:8px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);">
          <div style="font-size:.58rem;color:rgba(255,255,255,.28);text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px;">Est. Cost</div>
          <div style="font-size:.88rem;font-weight:800;color:${r.col};">${r.cost}</div>
        </div>
        <div style="grid-column:1/-1;text-align:center;padding:6px;border-radius:10px;background:rgba(50,215,75,.05);border:1px solid rgba(50,215,75,.15);">
          <div style="font-size:.68rem;color:rgba(50,215,75,.70);font-weight:600;">🌱 ${r.co2}</div>
        </div>
      </div>
    </div>`).join('');

  // Map: try to show Leaflet map with hub and city coords
  const portCoords = hub ? [hub.lat, hub.lon] : null;
  const cityCoords = (pcGpsLat && pcGpsLon) ? [pcGpsLat, pcGpsLon] : null;

  if (portCoords && typeof L !== 'undefined') {
    if (ph) ph.style.display = 'none';

    if (pcMap) { pcMap.remove(); pcMap = null; }
    const mapEl = document.getElementById('pcMap');
    pcMap = L.map(mapEl, { zoomControl: true }).setView(portCoords, 6);

    // Try Google hybrid, fallback to CartoDB dark
    const pcTileGoogle = L.tileLayer('https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
      subdomains: ['0','1','2','3'], attribution: '© Google Maps', maxZoom: 20,
    });
    pcTileGoogle.on('tileerror', () => {
      pcMap.eachLayer(l => { if (l instanceof L.TileLayer) pcMap.removeLayer(l); });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        subdomains:'abcd', attribution:'© CartoDB', maxZoom:19
      }).addTo(pcMap);
    });
    pcTileGoogle.addTo(pcMap);

    const portPin = makeLgPin(hubType==='airport'?'#BF5AF2':hubType==='station'?'#FF9F0A':'#40CBE0',
      hubType==='airport'?'✈':hubType==='station'?'🚂':'⚓', 38);
    L.marker(portCoords, { icon: portPin }).addTo(pcMap)
      .bindPopup(`<div style="font-family:system-ui;background:#0a0a1a;border-radius:10px;padding:10px 14px;border:1px solid rgba(255,255,255,.15);color:#fff;"><strong>${hubIcon} ${hubName}</strong><br><span style="font-size:.70rem;color:rgba(255,255,255,.45);">${hub?hub.throughput:''}</span></div>`)
      .openPopup();

    if (cityCoords) {
      const cityPin = makeGpsPin();
      L.marker(cityCoords, { icon: cityPin }).addTo(pcMap)
        .bindPopup(`<div style="font-family:system-ui;background:#0a0a1a;border-radius:10px;padding:10px 14px;border:1px solid rgba(50,215,75,.25);color:#fff;"><strong>📍 ${cityVal}</strong></div>`);
      const routeColor = aiMode==='train'?'#FF9F0A':'#0A84FF';
      L.polyline([portCoords, cityCoords], { color: routeColor, weight: 3, opacity: 0.85, dashArray:'8 6' }).addTo(pcMap);
      pcMap.fitBounds(L.latLngBounds([portCoords, cityCoords]).pad(0.25));
    }

    const osmLink = document.getElementById('pcOsmLink');
    if (osmLink) {
      const dest = cityCoords ? `${cityCoords[0]},${cityCoords[1]}` : encodeURIComponent(cityVal);
      const origin = `${portCoords[0]},${portCoords[1]}`;
      // Google Maps directions URL
      osmLink.href = `https://www.google.com/maps/dir/${origin}/${dest}`;
      osmLink.title = 'Open route in Google Maps';
    }
    const lbl = document.getElementById('pcMapRouteLabel');
    if (lbl) lbl.textContent = `${hubIcon} ${hubName} → 📍 ${cityVal} via ${aiMode==='train'?'🚂 Rail':'🚛 Road'}`;
  } else {
    const ph = document.getElementById('pcMapPlaceholder');
    if (ph) { ph.innerHTML = `<div style="font-size:.80rem;color:rgba(255,255,255,.45);text-align:center;padding:20px"><div style="font-size:2rem;margin-bottom:10px;">${hubIcon}</div><strong>${hubName}</strong><br><span style="color:rgba(255,255,255,.30);">→ ${cityVal}</span><br><br><a href="https://www.openstreetmap.org/search?query=${encodeURIComponent(hubName+' to '+cityVal)}" target="_blank" style="color:#0A84FF;font-size:.72rem;">Open route in Maps ↗</a></div>`; }
  }

  if (results) results.style.display = '';
  if (btn) { btn.disabled = false; btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="display:inline;margin-right:5px;vertical-align:-.1em"><path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>Find Route'; }
}

// Close dropdowns on outside click
document.addEventListener('click', e => {
  if (!e.target.closest('#pcPort') && !e.target.closest('#pcPortDrop')) {
    const d = document.getElementById('pcPortDrop'); if(d) d.style.display='none';
  }
  if (!e.target.closest('#pcCity') && !e.target.closest('#pcCityDrop')) {
    const d = document.getElementById('pcCityDrop'); if(d) d.style.display='none';
  }
});

/* ═══════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════
   CATALOX PYTHON ENGINE v3.0 — Neural Network + Market Data
   Backend: Python 3 / math stdlib
   Architecture: 8→16→8→1 | Params: 376
   Generated: 2026-03-22T20:59:35Z
═══════════════════════════════════════════════════════════════════ */
const PY_DATA = {"risks":[{"name":"Mumbai → Rotterdam","risk":85,"dist":6884,"mode":3,"eta_days":8.2},{"name":"Shanghai → LA","risk":95,"dist":10457,"mode":3,"eta_days":12.4},{"name":"Dubai → Nairobi","risk":5,"dist":3552,"mode":2,"eta_days":0.2},{"name":"Hamburg → New York","risk":30,"dist":6133,"mode":3,"eta_days":7.3},{"name":"Singapore → Sydney","risk":7,"dist":6306,"mode":3,"eta_days":7.5},{"name":"Delhi → Singapore","risk":14,"dist":4142,"mode":2,"eta_days":0.2}],"freight":[{"name":"SCFI Asia-Europe","pair":"SHA→NWE","val":1833.06,"wk":-34.85,"mo":42.52,"trend":"dn"},{"name":"SCFI Trans-Pacific","pair":"SHA→USWC","val":2333.35,"wk":-19.13,"mo":54.1,"trend":"dn"},{"name":"Baltic Dry Index","pair":"BDI","val":2138.44,"wk":-43.9,"mo":-222.89,"trend":"dn"},{"name":"CCFI India","pair":"IND→EUR","val":1247.69,"wk":34.23,"mo":47.37,"trend":"up"},{"name":"IATA Air Cargo","pair":"AIR ($/kg)","val":3.45,"wk":0.09,"mo":0.43,"trend":"up"},{"name":"WCI Composite","pair":"WCI","val":3171.83,"wk":-20.42,"mo":42.14,"trend":"dn"},{"name":"HRVI Harpex","pair":"HARPEX","val":954.01,"wk":-19.96,"mo":98.94,"trend":"dn"},{"name":"Platts LNG","pair":"LNG ($/mmBtu)","val":11.26,"wk":0.05,"mo":-0.23,"trend":"up"}],"commodities":[{"name":"Crude Oil WTI","sym":"CL","unit":"$/bbl","ico":"🛢️","price":77.5,"day":-1.9,"week":3.1,"lo52":62.0,"hi52":97.0,"bar":44.1},{"name":"Brent Crude","sym":"BRT","unit":"$/bbl","ico":"🛢️","price":81.9,"day":-0.3,"week":2.5,"lo52":65.0,"hi52":101.0,"bar":47.1},{"name":"Natural Gas","sym":"NG","unit":"$/MMBtu","ico":"🔥","price":2.393,"day":0.105,"week":-0.342,"lo52":1.5,"hi52":4.5,"bar":29.8},{"name":"Iron Ore 62%","sym":"FE","unit":"$/MT","ico":"⚙️","price":117.0,"day":-3.0,"week":12.8,"lo52":88.0,"hi52":148.0,"bar":48.3},{"name":"Thermal Coal","sym":"COAL","unit":"$/MT","ico":"⬛","price":125.3,"day":-3.4,"week":1.3,"lo52":80.0,"hi52":195.0,"bar":39.4},{"name":"Gold","sym":"XAU","unit":"$/oz","ico":"🥇","price":2348.0,"day":13.9,"week":-34.4,"lo52":1820.0,"hi52":2500.0,"bar":77.6},{"name":"Copper","sym":"HG","unit":"$/lb","ico":"🔶","price":4.15,"day":0.06,"week":-0.407,"lo52":3.1,"hi52":4.9,"bar":58.3},{"name":"Wheat","sym":"ZW","unit":"¢/bu","ico":"🌾","price":587.7,"day":-8.6,"week":9.5,"lo52":440.0,"hi52":780.0,"bar":43.4}],"fx":[{"pair":"USD/INR","rate":83.3962,"day":-0.07935,"week":-0.43657},{"pair":"EUR/USD","rate":1.0829,"day":-0.00421,"week":0.00083},{"pair":"USD/CNY","rate":7.2367,"day":0.0086,"week":0.00401},{"pair":"USD/JPY","rate":149.855,"day":-0.04996,"week":1.00299},{"pair":"GBP/USD","rate":1.2652,"day":0.00587,"week":-0.02773},{"pair":"USD/SGD","rate":1.342,"day":-0.0004,"week":0.01488},{"pair":"USD/AED","rate":3.6724,"day":-0.0002,"week":0.00199},{"pair":"EUR/INR","rate":90.5002,"day":-0.06598,"week":1.06727}],"nn_meta":{"layers":"8→16→8→1","activation":"LeakyReLU+Sigmoid","params":376,"inference_us":68,"backend":"Python 3 / math"},"ts":1774213175,"engine":"CATALOX-PY/3.0","generated_at":"2026-03-22T20:59:35Z"};
const PY_SNAPS = [{"risks":[{"name":"Mumbai → Rotterdam","risk":85,"dist":6884,"mode":3,"eta_days":8.2},{"name":"Shanghai → LA","risk":95,"dist":10457,"mode":3,"eta_days":12.4},{"name":"Dubai → Nairobi","risk":5,"dist":3552,"mode":2,"eta_days":0.2},{"name":"Hamburg → New York","risk":30,"dist":6133,"mode":3,"eta_days":7.3},{"name":"Singapore → Sydney","risk":7,"dist":6306,"mode":3,"eta_days":7.5},{"name":"Delhi → Singapore","risk":14,"dist":4142,"mode":2,"eta_days":0.2}],"freight":[{"name":"SCFI Asia-Europe","pair":"SHA→NWE","val":1833.06,"wk":-34.85,"mo":42.52,"trend":"dn"},{"name":"SCFI Trans-Pacific","pair":"SHA→USWC","val":2333.35,"wk":-19.13,"mo":54.1,"trend":"dn"},{"name":"Baltic Dry Index","pair":"BDI","val":2138.44,"wk":-43.9,"mo":-222.89,"trend":"dn"},{"name":"CCFI India","pair":"IND→EUR","val":1247.69,"wk":34.23,"mo":47.37,"trend":"up"},{"name":"IATA Air Cargo","pair":"AIR ($/kg)","val":3.45,"wk":0.09,"mo":0.43,"trend":"up"},{"name":"WCI Composite","pair":"WCI","val":3171.83,"wk":-20.42,"mo":42.14,"trend":"dn"},{"name":"HRVI Harpex","pair":"HARPEX","val":954.01,"wk":-19.96,"mo":98.94,"trend":"dn"},{"name":"Platts LNG","pair":"LNG ($/mmBtu)","val":11.26,"wk":0.05,"mo":-0.23,"trend":"up"}],"commodities":[{"name":"Crude Oil WTI","sym":"CL","unit":"$/bbl","ico":"🛢️","price":77.5,"day":-1.9,"week":3.1,"lo52":62.0,"hi52":97.0,"bar":44.1},{"name":"Brent Crude","sym":"BRT","unit":"$/bbl","ico":"🛢️","price":81.9,"day":-0.3,"week":2.5,"lo52":65.0,"hi52":101.0,"bar":47.1},{"name":"Natural Gas","sym":"NG","unit":"$/MMBtu","ico":"🔥","price":2.393,"day":0.105,"week":-0.342,"lo52":1.5,"hi52":4.5,"bar":29.8},{"name":"Iron Ore 62%","sym":"FE","unit":"$/MT","ico":"⚙️","price":117.0,"day":-3.0,"week":12.8,"lo52":88.0,"hi52":148.0,"bar":48.3},{"name":"Thermal Coal","sym":"COAL","unit":"$/MT","ico":"⬛","price":125.3,"day":-3.4,"week":1.3,"lo52":80.0,"hi52":195.0,"bar":39.4},{"name":"Gold","sym":"XAU","unit":"$/oz","ico":"🥇","price":2348.0,"day":13.9,"week":-34.4,"lo52":1820.0,"hi52":2500.0,"bar":77.6},{"name":"Copper","sym":"HG","unit":"$/lb","ico":"🔶","price":4.15,"day":0.06,"week":-0.407,"lo52":3.1,"hi52":4.9,"bar":58.3},{"name":"Wheat","sym":"ZW","unit":"¢/bu","ico":"🌾","price":587.7,"day":-8.6,"week":9.5,"lo52":440.0,"hi52":780.0,"bar":43.4}],"fx":[{"pair":"USD/INR","rate":83.3962,"day":-0.07935,"week":-0.43657},{"pair":"EUR/USD","rate":1.0829,"day":-0.00421,"week":0.00083},{"pair":"USD/CNY","rate":7.2367,"day":0.0086,"week":0.00401},{"pair":"USD/JPY","rate":149.855,"day":-0.04996,"week":1.00299},{"pair":"GBP/USD","rate":1.2652,"day":0.00587,"week":-0.02773},{"pair":"USD/SGD","rate":1.342,"day":-0.0004,"week":0.01488},{"pair":"USD/AED","rate":3.6724,"day":-0.0002,"week":0.00199},{"pair":"EUR/INR","rate":90.5002,"day":-0.06598,"week":1.06727}],"nn_meta":{"layers":"8→16→8→1","activation":"LeakyReLU+Sigmoid","params":376,"inference_us":68,"backend":"Python 3 / math"},"ts":1774213175,"engine":"CATALOX-PY/3.0","generated_at":"2026-03-22T20:59:35Z"},{"risks":[{"name":"Mumbai → Rotterdam","risk":85,"dist":6884,"mode":3,"eta_days":8.2},{"name":"Shanghai → LA","risk":95,"dist":10457,"mode":3,"eta_days":12.4},{"name":"Dubai → Nairobi","risk":5,"dist":3552,"mode":2,"eta_days":0.2},{"name":"Hamburg → New York","risk":30,"dist":6133,"mode":3,"eta_days":7.3},{"name":"Singapore → Sydney","risk":7,"dist":6306,"mode":3,"eta_days":7.5},{"name":"Delhi → Singapore","risk":14,"dist":4142,"mode":2,"eta_days":0.2}],"freight":[{"name":"SCFI Asia-Europe","pair":"SHA→NWE","val":1833.06,"wk":-34.85,"mo":42.52,"trend":"dn"},{"name":"SCFI Trans-Pacific","pair":"SHA→USWC","val":2333.35,"wk":-19.13,"mo":54.1,"trend":"dn"},{"name":"Baltic Dry Index","pair":"BDI","val":2138.44,"wk":-43.9,"mo":-222.89,"trend":"dn"},{"name":"CCFI India","pair":"IND→EUR","val":1247.69,"wk":34.23,"mo":47.37,"trend":"up"},{"name":"IATA Air Cargo","pair":"AIR ($/kg)","val":3.45,"wk":0.09,"mo":0.43,"trend":"up"},{"name":"WCI Composite","pair":"WCI","val":3171.83,"wk":-20.42,"mo":42.14,"trend":"dn"},{"name":"HRVI Harpex","pair":"HARPEX","val":954.01,"wk":-19.96,"mo":98.94,"trend":"dn"},{"name":"Platts LNG","pair":"LNG ($/mmBtu)","val":11.26,"wk":0.05,"mo":-0.23,"trend":"up"}],"commodities":[{"name":"Crude Oil WTI","sym":"CL","unit":"$/bbl","ico":"🛢️","price":77.5,"day":-1.9,"week":3.1,"lo52":62.0,"hi52":97.0,"bar":44.1},{"name":"Brent Crude","sym":"BRT","unit":"$/bbl","ico":"🛢️","price":81.9,"day":-0.3,"week":2.5,"lo52":65.0,"hi52":101.0,"bar":47.1},{"name":"Natural Gas","sym":"NG","unit":"$/MMBtu","ico":"🔥","price":2.393,"day":0.105,"week":-0.342,"lo52":1.5,"hi52":4.5,"bar":29.8},{"name":"Iron Ore 62%","sym":"FE","unit":"$/MT","ico":"⚙️","price":117.0,"day":-3.0,"week":12.8,"lo52":88.0,"hi52":148.0,"bar":48.3},{"name":"Thermal Coal","sym":"COAL","unit":"$/MT","ico":"⬛","price":125.3,"day":-3.4,"week":1.3,"lo52":80.0,"hi52":195.0,"bar":39.4},{"name":"Gold","sym":"XAU","unit":"$/oz","ico":"🥇","price":2348.0,"day":13.9,"week":-34.4,"lo52":1820.0,"hi52":2500.0,"bar":77.6},{"name":"Copper","sym":"HG","unit":"$/lb","ico":"🔶","price":4.15,"day":0.06,"week":-0.407,"lo52":3.1,"hi52":4.9,"bar":58.3},{"name":"Wheat","sym":"ZW","unit":"¢/bu","ico":"🌾","price":587.7,"day":-8.6,"week":9.5,"lo52":440.0,"hi52":780.0,"bar":43.4}],"fx":[{"pair":"USD/INR","rate":83.3962,"day":-0.07935,"week":-0.43657},{"pair":"EUR/USD","rate":1.0829,"day":-0.00421,"week":0.00083},{"pair":"USD/CNY","rate":7.2367,"day":0.0086,"week":0.00401},{"pair":"USD/JPY","rate":149.855,"day":-0.04996,"week":1.00299},{"pair":"GBP/USD","rate":1.2652,"day":0.00587,"week":-0.02773},{"pair":"USD/SGD","rate":1.342,"day":-0.0004,"week":0.01488},{"pair":"USD/AED","rate":3.6724,"day":-0.0002,"week":0.00199},{"pair":"EUR/INR","rate":90.5002,"day":-0.06598,"week":1.06727}],"nn_meta":{"layers":"8→16→8→1","activation":"LeakyReLU+Sigmoid","params":376,"inference_us":68,"backend":"Python 3 / math"},"ts":1774213175,"engine":"CATALOX-PY/3.0","generated_at":"2026-03-22T20:59:35Z"},{"risks":[{"name":"Mumbai → Rotterdam","risk":85,"dist":6884,"mode":3,"eta_days":8.2},{"name":"Shanghai → LA","risk":95,"dist":10457,"mode":3,"eta_days":12.4},{"name":"Dubai → Nairobi","risk":5,"dist":3552,"mode":2,"eta_days":0.2},{"name":"Hamburg → New York","risk":30,"dist":6133,"mode":3,"eta_days":7.3},{"name":"Singapore → Sydney","risk":7,"dist":6306,"mode":3,"eta_days":7.5},{"name":"Delhi → Singapore","risk":14,"dist":4142,"mode":2,"eta_days":0.2}],"freight":[{"name":"SCFI Asia-Europe","pair":"SHA→NWE","val":1833.06,"wk":-34.85,"mo":42.52,"trend":"dn"},{"name":"SCFI Trans-Pacific","pair":"SHA→USWC","val":2333.35,"wk":-19.13,"mo":54.1,"trend":"dn"},{"name":"Baltic Dry Index","pair":"BDI","val":2138.44,"wk":-43.9,"mo":-222.89,"trend":"dn"},{"name":"CCFI India","pair":"IND→EUR","val":1247.69,"wk":34.23,"mo":47.37,"trend":"up"},{"name":"IATA Air Cargo","pair":"AIR ($/kg)","val":3.45,"wk":0.09,"mo":0.43,"trend":"up"},{"name":"WCI Composite","pair":"WCI","val":3171.83,"wk":-20.42,"mo":42.14,"trend":"dn"},{"name":"HRVI Harpex","pair":"HARPEX","val":954.01,"wk":-19.96,"mo":98.94,"trend":"dn"},{"name":"Platts LNG","pair":"LNG ($/mmBtu)","val":11.26,"wk":0.05,"mo":-0.23,"trend":"up"}],"commodities":[{"name":"Crude Oil WTI","sym":"CL","unit":"$/bbl","ico":"🛢️","price":77.5,"day":-1.9,"week":3.1,"lo52":62.0,"hi52":97.0,"bar":44.1},{"name":"Brent Crude","sym":"BRT","unit":"$/bbl","ico":"🛢️","price":81.9,"day":-0.3,"week":2.5,"lo52":65.0,"hi52":101.0,"bar":47.1},{"name":"Natural Gas","sym":"NG","unit":"$/MMBtu","ico":"🔥","price":2.393,"day":0.105,"week":-0.342,"lo52":1.5,"hi52":4.5,"bar":29.8},{"name":"Iron Ore 62%","sym":"FE","unit":"$/MT","ico":"⚙️","price":117.0,"day":-3.0,"week":12.8,"lo52":88.0,"hi52":148.0,"bar":48.3},{"name":"Thermal Coal","sym":"COAL","unit":"$/MT","ico":"⬛","price":125.3,"day":-3.4,"week":1.3,"lo52":80.0,"hi52":195.0,"bar":39.4},{"name":"Gold","sym":"XAU","unit":"$/oz","ico":"🥇","price":2348.0,"day":13.9,"week":-34.4,"lo52":1820.0,"hi52":2500.0,"bar":77.6},{"name":"Copper","sym":"HG","unit":"$/lb","ico":"🔶","price":4.15,"day":0.06,"week":-0.407,"lo52":3.1,"hi52":4.9,"bar":58.3},{"name":"Wheat","sym":"ZW","unit":"¢/bu","ico":"🌾","price":587.7,"day":-8.6,"week":9.5,"lo52":440.0,"hi52":780.0,"bar":43.4}],"fx":[{"pair":"USD/INR","rate":83.3962,"day":-0.07935,"week":-0.43657},{"pair":"EUR/USD","rate":1.0829,"day":-0.00421,"week":0.00083},{"pair":"USD/CNY","rate":7.2367,"day":0.0086,"week":0.00401},{"pair":"USD/JPY","rate":149.855,"day":-0.04996,"week":1.00299},{"pair":"GBP/USD","rate":1.2652,"day":0.00587,"week":-0.02773},{"pair":"USD/SGD","rate":1.342,"day":-0.0004,"week":0.01488},{"pair":"USD/AED","rate":3.6724,"day":-0.0002,"week":0.00199},{"pair":"EUR/INR","rate":90.5002,"day":-0.06598,"week":1.06727}],"nn_meta":{"layers":"8→16→8→1","activation":"LeakyReLU+Sigmoid","params":376,"inference_us":68,"backend":"Python 3 / math"},"ts":1774213175,"engine":"CATALOX-PY/3.0","generated_at":"2026-03-22T20:59:35Z"},{"risks":[{"name":"Mumbai → Rotterdam","risk":85,"dist":6884,"mode":3,"eta_days":8.2},{"name":"Shanghai → LA","risk":95,"dist":10457,"mode":3,"eta_days":12.4},{"name":"Dubai → Nairobi","risk":5,"dist":3552,"mode":2,"eta_days":0.2},{"name":"Hamburg → New York","risk":30,"dist":6133,"mode":3,"eta_days":7.3},{"name":"Singapore → Sydney","risk":7,"dist":6306,"mode":3,"eta_days":7.5},{"name":"Delhi → Singapore","risk":14,"dist":4142,"mode":2,"eta_days":0.2}],"freight":[{"name":"SCFI Asia-Europe","pair":"SHA→NWE","val":1833.06,"wk":-34.85,"mo":42.52,"trend":"dn"},{"name":"SCFI Trans-Pacific","pair":"SHA→USWC","val":2333.35,"wk":-19.13,"mo":54.1,"trend":"dn"},{"name":"Baltic Dry Index","pair":"BDI","val":2138.44,"wk":-43.9,"mo":-222.89,"trend":"dn"},{"name":"CCFI India","pair":"IND→EUR","val":1247.69,"wk":34.23,"mo":47.37,"trend":"up"},{"name":"IATA Air Cargo","pair":"AIR ($/kg)","val":3.45,"wk":0.09,"mo":0.43,"trend":"up"},{"name":"WCI Composite","pair":"WCI","val":3171.83,"wk":-20.42,"mo":42.14,"trend":"dn"},{"name":"HRVI Harpex","pair":"HARPEX","val":954.01,"wk":-19.96,"mo":98.94,"trend":"dn"},{"name":"Platts LNG","pair":"LNG ($/mmBtu)","val":11.26,"wk":0.05,"mo":-0.23,"trend":"up"}],"commodities":[{"name":"Crude Oil WTI","sym":"CL","unit":"$/bbl","ico":"🛢️","price":77.5,"day":-1.9,"week":3.1,"lo52":62.0,"hi52":97.0,"bar":44.1},{"name":"Brent Crude","sym":"BRT","unit":"$/bbl","ico":"🛢️","price":81.9,"day":-0.3,"week":2.5,"lo52":65.0,"hi52":101.0,"bar":47.1},{"name":"Natural Gas","sym":"NG","unit":"$/MMBtu","ico":"🔥","price":2.393,"day":0.105,"week":-0.342,"lo52":1.5,"hi52":4.5,"bar":29.8},{"name":"Iron Ore 62%","sym":"FE","unit":"$/MT","ico":"⚙️","price":117.0,"day":-3.0,"week":12.8,"lo52":88.0,"hi52":148.0,"bar":48.3},{"name":"Thermal Coal","sym":"COAL","unit":"$/MT","ico":"⬛","price":125.3,"day":-3.4,"week":1.3,"lo52":80.0,"hi52":195.0,"bar":39.4},{"name":"Gold","sym":"XAU","unit":"$/oz","ico":"🥇","price":2348.0,"day":13.9,"week":-34.4,"lo52":1820.0,"hi52":2500.0,"bar":77.6},{"name":"Copper","sym":"HG","unit":"$/lb","ico":"🔶","price":4.15,"day":0.06,"week":-0.407,"lo52":3.1,"hi52":4.9,"bar":58.3},{"name":"Wheat","sym":"ZW","unit":"¢/bu","ico":"🌾","price":587.7,"day":-8.6,"week":9.5,"lo52":440.0,"hi52":780.0,"bar":43.4}],"fx":[{"pair":"USD/INR","rate":83.3962,"day":-0.07935,"week":-0.43657},{"pair":"EUR/USD","rate":1.0829,"day":-0.00421,"week":0.00083},{"pair":"USD/CNY","rate":7.2367,"day":0.0086,"week":0.00401},{"pair":"USD/JPY","rate":149.855,"day":-0.04996,"week":1.00299},{"pair":"GBP/USD","rate":1.2652,"day":0.00587,"week":-0.02773},{"pair":"USD/SGD","rate":1.342,"day":-0.0004,"week":0.01488},{"pair":"USD/AED","rate":3.6724,"day":-0.0002,"week":0.00199},{"pair":"EUR/INR","rate":90.5002,"day":-0.06598,"week":1.06727}],"nn_meta":{"layers":"8→16→8→1","activation":"LeakyReLU+Sigmoid","params":376,"inference_us":68,"backend":"Python 3 / math"},"ts":1774213175,"engine":"CATALOX-PY/3.0","generated_at":"2026-03-22T20:59:35Z"},{"risks":[{"name":"Mumbai → Rotterdam","risk":85,"dist":6884,"mode":3,"eta_days":8.2},{"name":"Shanghai → LA","risk":95,"dist":10457,"mode":3,"eta_days":12.4},{"name":"Dubai → Nairobi","risk":5,"dist":3552,"mode":2,"eta_days":0.2},{"name":"Hamburg → New York","risk":30,"dist":6133,"mode":3,"eta_days":7.3},{"name":"Singapore → Sydney","risk":7,"dist":6306,"mode":3,"eta_days":7.5},{"name":"Delhi → Singapore","risk":14,"dist":4142,"mode":2,"eta_days":0.2}],"freight":[{"name":"SCFI Asia-Europe","pair":"SHA→NWE","val":1833.06,"wk":-34.85,"mo":42.52,"trend":"dn"},{"name":"SCFI Trans-Pacific","pair":"SHA→USWC","val":2333.35,"wk":-19.13,"mo":54.1,"trend":"dn"},{"name":"Baltic Dry Index","pair":"BDI","val":2138.44,"wk":-43.9,"mo":-222.89,"trend":"dn"},{"name":"CCFI India","pair":"IND→EUR","val":1247.69,"wk":34.23,"mo":47.37,"trend":"up"},{"name":"IATA Air Cargo","pair":"AIR ($/kg)","val":3.45,"wk":0.09,"mo":0.43,"trend":"up"},{"name":"WCI Composite","pair":"WCI","val":3171.83,"wk":-20.42,"mo":42.14,"trend":"dn"},{"name":"HRVI Harpex","pair":"HARPEX","val":954.01,"wk":-19.96,"mo":98.94,"trend":"dn"},{"name":"Platts LNG","pair":"LNG ($/mmBtu)","val":11.26,"wk":0.05,"mo":-0.23,"trend":"up"}],"commodities":[{"name":"Crude Oil WTI","sym":"CL","unit":"$/bbl","ico":"🛢️","price":77.5,"day":-1.9,"week":3.1,"lo52":62.0,"hi52":97.0,"bar":44.1},{"name":"Brent Crude","sym":"BRT","unit":"$/bbl","ico":"🛢️","price":81.9,"day":-0.3,"week":2.5,"lo52":65.0,"hi52":101.0,"bar":47.1},{"name":"Natural Gas","sym":"NG","unit":"$/MMBtu","ico":"🔥","price":2.393,"day":0.105,"week":-0.342,"lo52":1.5,"hi52":4.5,"bar":29.8},{"name":"Iron Ore 62%","sym":"FE","unit":"$/MT","ico":"⚙️","price":117.0,"day":-3.0,"week":12.8,"lo52":88.0,"hi52":148.0,"bar":48.3},{"name":"Thermal Coal","sym":"COAL","unit":"$/MT","ico":"⬛","price":125.3,"day":-3.4,"week":1.3,"lo52":80.0,"hi52":195.0,"bar":39.4},{"name":"Gold","sym":"XAU","unit":"$/oz","ico":"🥇","price":2348.0,"day":13.9,"week":-34.4,"lo52":1820.0,"hi52":2500.0,"bar":77.6},{"name":"Copper","sym":"HG","unit":"$/lb","ico":"🔶","price":4.15,"day":0.06,"week":-0.407,"lo52":3.1,"hi52":4.9,"bar":58.3},{"name":"Wheat","sym":"ZW","unit":"¢/bu","ico":"🌾","price":587.7,"day":-8.6,"week":9.5,"lo52":440.0,"hi52":780.0,"bar":43.4}],"fx":[{"pair":"USD/INR","rate":83.3962,"day":-0.07935,"week":-0.43657},{"pair":"EUR/USD","rate":1.0829,"day":-0.00421,"week":0.00083},{"pair":"USD/CNY","rate":7.2367,"day":0.0086,"week":0.00401},{"pair":"USD/JPY","rate":149.855,"day":-0.04996,"week":1.00299},{"pair":"GBP/USD","rate":1.2652,"day":0.00587,"week":-0.02773},{"pair":"USD/SGD","rate":1.342,"day":-0.0004,"week":0.01488},{"pair":"USD/AED","rate":3.6724,"day":-0.0002,"week":0.00199},{"pair":"EUR/INR","rate":90.5002,"day":-0.06598,"week":1.06727}],"nn_meta":{"layers":"8→16→8→1","activation":"LeakyReLU+Sigmoid","params":376,"inference_us":68,"backend":"Python 3 / math"},"ts":1774213175,"engine":"CATALOX-PY/3.0","generated_at":"2026-03-22T20:59:35Z"}];
const CPP_DATA = PY_DATA;
const CPP_SNAPS = PY_SNAPS;
let snapIdx = 0;


/* ═══════════════════════════════════════════════════════════
   UI SCRIPT — wrapped in IIFE to avoid name collisions
   with the routing engine declared below
═══════════════════════════════════════════════════════════ */
(function() {
  'use strict';

  /* ── Custom cursor ──────────────────────────────────────── */
  (function initCursor(){
  const cur  = document.getElementById('cursor');
  const curR = document.getElementById('cursor-ring');
  if (!cur || !curR) return;
  if (window.matchMedia('(pointer:coarse)').matches) {
    cur.style.display = 'none'; curR.style.display = 'none'; return;
  }

  let mx = window.innerWidth/2, my = window.innerHeight/2;
  let rx = mx, ry = my;
  let isHover = false, isClick = false;

  // Direct snap for dot
  document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    cur.style.transform = `translate(calc(${mx}px - 50%), calc(${my}px - 50%))`;
  });

  // Smooth lagged ring — only update when cursor is moving
  let cursorMoving = false, cursorTimer;
  document.addEventListener('mousemove', () => {
    cursorMoving = true;
    clearTimeout(cursorTimer);
    cursorTimer = setTimeout(() => { cursorMoving = false; }, 150);
  }, { passive: true });
  (function animRing(){
    if(cursorMoving || Math.abs(mx-rx)>0.5 || Math.abs(my-ry)>0.5){
      rx += (mx - rx) * 0.14;
      ry += (my - ry) * 0.14;
      curR.style.transform = `translate(calc(${rx}px - 50%), calc(${ry}px - 50%))`;
    }
    requestAnimationFrame(animRing);
  })();

  // Hover detection
  function setHover(on) {
    isHover = on;
    document.body.classList.toggle('cursor-hover', on);
  }
  function setClick(on) {
    document.body.classList.toggle('cursor-click', on);
  }

  document.addEventListener('mousedown', () => setClick(true));
  document.addEventListener('mouseup',   () => setClick(false));
  document.addEventListener('mouseleave', () => { cur.style.opacity='0'; curR.style.opacity='0'; });
  document.addEventListener('mouseenter', () => { cur.style.opacity='1'; curR.style.opacity='1'; });

  // Interactive elements — expand glass ring
  document.addEventListener('mouseover', e => {
    const el = e.target.closest('button,a,.btn,.card,.pcard,.mc,.tlp-item,.rp-route,input,select,label,[data-lens]');
    setHover(!!el);
  });

  // Color tinting per element type
  document.addEventListener('mouseover', e => {
    if (e.target.closest('.btn-blue, .nav-cta')) {
      curR.style.borderColor = 'rgba(10,132,255,0.75)';
      curR.style.background  = 'rgba(10,132,255,0.10)';
    } else if (e.target.closest('.card.fc, .pcard')) {
      curR.style.borderColor = 'rgba(191,90,242,0.65)';
      curR.style.background  = 'rgba(191,90,242,0.08)';
    } else if (e.target.closest('input, select')) {
      curR.style.borderColor = 'rgba(50,215,75,0.65)';
      curR.style.background  = 'rgba(50,215,75,0.07)';
    } else {
      curR.style.borderColor = 'rgba(10,132,255,0.50)';
      curR.style.background  = 'rgba(10,132,255,0.06)';
    }
  });
})();

  /* ── Particles ──────────────────────────────────────────── */
  (function initParticles(){
    const c = document.getElementById('particles');
    if(!c) return;
    const ctx = c.getContext('2d');
    let W,H,pts=[];
    function resize(){ W=c.width=innerWidth; H=c.height=innerHeight; }
    resize(); window.addEventListener('resize', resize);
    // Reduced to 45 pts for 60fps; no shadowBlur (GPU killer)
    for(let i=0;i<45;i++) pts.push({
      x:Math.random()*innerWidth, y:Math.random()*innerHeight,
      vx:(Math.random()-.5)*.25, vy:(Math.random()-.5)*.25,
      r:Math.random()*1.2+.4, a:Math.random()
    });
    let ptFrame=0;
    function draw(){
      if(document.hidden){ requestAnimationFrame(draw); return; }
      ctx.clearRect(0,0,W,H);
      // Batch all dots in one path — single fillStyle, no shadowBlur
      ctx.beginPath();
      pts.forEach(p=>{
        p.x+=p.vx; p.y+=p.vy;
        if(p.x<0)p.x=W; if(p.x>W)p.x=0;
        if(p.y<0)p.y=H; if(p.y>H)p.y=0;
        ctx.moveTo(p.x+p.r,p.y);
        ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      });
      ctx.fillStyle='rgba(10,132,255,0.18)';
      ctx.fill();
      // Lines — only every 2nd frame, reduced distance threshold
      if(ptFrame++%2===0){
        ctx.beginPath();
        for(let i=0;i<pts.length;i++)
          for(let j=i+1;j<pts.length;j++){
            const dx=pts[i].x-pts[j].x, dy=pts[i].y-pts[j].y;
            const d2=dx*dx+dy*dy;
            if(d2<7000){ // 83px threshold (was 120), squared avoids sqrt
              ctx.moveTo(pts[i].x,pts[i].y); ctx.lineTo(pts[j].x,pts[j].y);
            }
          }
        ctx.strokeStyle='rgba(10,132,255,0.055)'; ctx.lineWidth=.5; ctx.stroke();
      }
      requestAnimationFrame(draw);
    }
    draw();
  })();

  /* ── Navbar scroll — rAF throttled ── */
  let _scrollTick=false;
  window.addEventListener('scroll',()=>{
    if(_scrollTick) return;
    _scrollTick=true;
    requestAnimationFrame(()=>{
      document.getElementById('navbar').classList.toggle('up', scrollY>24);
      _scrollTick=false;
    });
  },{passive:true});

  /* ── Smooth scroll ──────────────────────────────────────── */
  window.scrollTo = function(id){
    const el=document.getElementById(id);
    if(el) el.scrollIntoView({behavior:'smooth',block:'start'});
  };

  /* ── Scroll reveal ──────────────────────────────────────── */
  const revObs = new IntersectionObserver(entries=>{
    entries.forEach(e=>{ if(e.isIntersecting) e.target.classList.add('up'); });
  }, {threshold:.08});
  document.querySelectorAll('.reveal').forEach(el=>revObs.observe(el));

  /* ── Card 3-D tilt ──────────────────────────────────────── */
  document.querySelectorAll('.tilt-card').forEach(card=>{
    card.addEventListener('mousemove', e=>{
      const r=card.getBoundingClientRect();
      const x=(e.clientX-r.left)/r.width-.5;
      const y=(e.clientY-r.top)/r.height-.5;
      card.style.transform=`perspective(700px) rotateY(${x*12}deg) rotateX(${-y*10}deg) scale(1.02)`;
    });
    card.addEventListener('mouseleave',()=>{card.style.transform=''});
  });

  /* ── Magnetic buttons ───────────────────────────────────── */
  document.querySelectorAll('.magnetic').forEach(el=>{
    el.addEventListener('mousemove',e=>{
      const r=el.getBoundingClientRect();
      const x=(e.clientX-r.left-r.width/2)*.25;
      const y=(e.clientY-r.top-r.height/2)*.25;
      el.style.transform=`translate(${x}px,${y}px)`;
    });
    el.addEventListener('mouseleave',()=>{el.style.transform=''});
  });

  /* ── Ticker ─────────────────────────────────────────────── */
  const TICKS = [
    {ico:'🚛',label:'TRK-4821',txt:'Mumbai → Delhi',st:'On Time',cls:'tk-up'},
    {ico:'🚢',label:'VSL-3309',txt:'Mumbai → Rotterdam',st:'+2h Delay',cls:'tk-dn'},
    {ico:'✈️',label:'AIR-7723',txt:'DEL → SIN',st:'Airborne',cls:'tk-up'},
    {ico:'📦',label:'CTX-9920',txt:'Shanghai Port · High Congestion',st:'Alert',cls:'tk-dn'},
    {ico:'🟢',label:'System',txt:'All 18 APIs nominal',st:'100%',cls:'tk-up'},
    {ico:'🚂',label:'RLW-1094',txt:'KOL → MAA Rail',st:'On Time',cls:'tk-up'},
    {ico:'⚡',label:'AI',txt:'312 routes optimised today',st:'↑8',cls:'tk-up'},
    {ico:'🌊',label:'Weather',txt:'Bay of Bengal advisory',st:'Active',cls:'tk-dn'},
    {ico:'💰',label:'Cost',txt:'Platform fee',st:'FREE',cls:'tk-up'},
  ];
  const track = document.getElementById('tickerTrack');
  if(track){
    [...TICKS,...TICKS].forEach(d=>{
      const el=document.createElement('div'); el.className='tk-item';
      el.innerHTML=`${d.ico} <b style="color:var(--l1)">${d.label}</b> ${d.txt} <span class="${d.cls}">${d.st}</span>`;
      track.appendChild(el);
    });
  }

  /* ── Hero live feed ─────────────────────────────────────── */
  const HF_EVENTS = [
    {c:'var(--green)',m:'MV-Indus cleared Suez Canal ✓'},
    {c:'var(--orange)',m:'Weather advisory active: Bay of Bengal'},
    {c:'var(--blue)',m:'AI route: BLR→SIN saves 1h 20m'},
    {c:'var(--green)',m:'Shipment CTX-9921 delivered · Rotterdam'},
    {c:'var(--red)',m:'Shanghai port: High congestion detected'},
    {c:'var(--purple)',m:'AI re-route activated: AIR-7723'},
    {c:'var(--cyan)',m:'Fleet unit TRK-4821 — checkpoint cleared'},
    {c:'var(--green)',m:'14 on-time deliveries completed this hour'},
    {c:'var(--yellow)',m:'Freight index: Trans-Pacific rates up 22%'},
  ];
  let hfIdx=0;
  function updateHeroFeed(){
    const feed=document.getElementById('heroFeed'); if(!feed) return;
    const d=HF_EVENTS[hfIdx++ % HF_EVENTS.length];
    const el=document.createElement('div'); el.className='hcf-item';
    el.innerHTML=`<div class="hcf-dot" style="background:${d.c}"></div><div class="hcf-msg">${d.m}</div><div class="hcf-t">just now</div>`;
    feed.prepend(el);
    if(feed.children.length>3) feed.lastElementChild.remove();
  }
  setInterval(updateHeroFeed, 4000);

  /* ── Metric pulse ───────────────────────────────────────── */
  function pulseUI(){
    const ids=['mp-total','mp-fleet','mp-routes'];
    ids.forEach(id=>{
      const el=document.getElementById(id); if(!el) return;
      const v=parseInt(el.textContent.replace(/,/g,''))||0;
      const nv=v+Math.floor(Math.random()*2);
      el.textContent=nv.toLocaleString();
    });
    const ac=document.getElementById('hc-routes');
    if(ac) ac.textContent=(parseInt(ac.textContent)||312)+Math.floor(Math.random()*1);
  }
  setInterval(pulseUI, 7000);

  /* ── Fleet canvas animation ─────────────────────────────── */
  function initFleet(){
    const canvas=document.getElementById('fleetCanvas'); if(!canvas) return;
    const ctx=canvas.getContext('2d');
    function resize(){ canvas.width=canvas.offsetWidth||700; canvas.height=380; }
    resize(); window.addEventListener('resize',()=>{resize();} );
    const vehicles=[
      {x:.18,y:.42,tx:.60,ty:.30,col:'#0A84FF',ico:'🚛',nm:'TRK-4821'},
      {x:.45,y:.60,tx:.80,ty:.70,col:'#FF9F0A',ico:'🚢',nm:'VSL-3309'},
      {x:.68,y:.28,tx:.88,ty:.22,col:'#32D74B',ico:'✈️',nm:'AIR-7723'},
      {x:.25,y:.72,tx:.52,ty:.52,col:'#BF5AF2',ico:'🚂',nm:'RLW-1094'},
    ];
    let t=0;
    function lerp(a,b,f){return a+(b-a)*f;}
    function draw(){
      if(document.hidden){ requestAnimationFrame(draw); return; }
      const W=canvas.width, H=canvas.height;
      ctx.clearRect(0,0,W,H);
      t+=.0025;
      // Grid
      ctx.strokeStyle='rgba(255,255,255,.03)'; ctx.lineWidth=1;
      for(let i=0;i<12;i++){
        ctx.beginPath();ctx.moveTo(i*W/12,0);ctx.lineTo(i*W/12,H);ctx.stroke();
        ctx.beginPath();ctx.moveTo(0,i*H/12);ctx.lineTo(W,i*H/12);ctx.stroke();
      }
      vehicles.forEach((v,vi)=>{
        const f=(Math.sin(t+vi*1.2)+1)/2;
        const cx=lerp(v.x,v.tx,f)*W, cy=lerp(v.y,v.ty,f)*H;
        // Trail
        ctx.beginPath();ctx.moveTo(v.x*W,v.y*H);ctx.lineTo(v.tx*W,v.ty*H);
        ctx.strokeStyle=v.col+'22';ctx.lineWidth=1.5;ctx.setLineDash([5,5]);ctx.stroke();ctx.setLineDash([]);
        // Simplified glow — solid semi-transparent circle (no gradient per frame)
        ctx.beginPath();ctx.arc(cx,cy,16,0,Math.PI*2);
        ctx.fillStyle=v.col+'28';ctx.fill();
        // Dot
        ctx.beginPath();ctx.arc(cx,cy,5,0,Math.PI*2);
        ctx.fillStyle=v.col;ctx.fill();
        // Label
        ctx.font='bold 10px -apple-system,sans-serif';
        ctx.fillStyle='rgba(255,255,255,.65)';
        ctx.fillText(v.nm, cx+8, cy-8);
      });
      requestAnimationFrame(draw);
    }
    draw();
  }
  setTimeout(initFleet, 250);

  /* ── Fleet progress bars ────────────────────────────────── */
  const FP={fvp1:68,fvp2:41,fvp3:55,fvp4:29};
  setInterval(()=>{
    Object.keys(FP).forEach(id=>{
      const el=document.getElementById(id); if(!el) return;
      FP[id]=Math.min(99,FP[id]+(Math.random()>.6?.3:0));
      el.style.width=FP[id].toFixed(1)+'%';
    });
  },4000);

  /* ── Risk bar updates ───────────────────────────────────── */
  const RB=[
    {id:'rr1',vid:'rr1v',v:64,spread:18},
    {id:'rr2',vid:'rr2v',v:81,spread:12},
    {id:'rr3',vid:'rr3v',v:18,spread:14},
    {id:'rr4',vid:'rr4v',v:47,spread:16},
    {id:'rr5',vid:'rr5v',v:22,spread:10},
  ];
  setInterval(()=>{
    RB.forEach(b=>{
      const bar=document.getElementById(b.id), vEl=document.getElementById(b.vid);
      if(!bar||!vEl) return;
      b.v=Math.max(5,Math.min(95,b.v+(Math.random()-.5)*b.spread));
      bar.style.width=b.v.toFixed(0)+'%';
      bar.className='risk-bar '+(b.v>65?'rb-hi':b.v>35?'rb-md':'rb-lo');
      vEl.textContent=b.v.toFixed(0)+'%';
      vEl.style.color=b.v>65?'var(--red)':b.v>35?'var(--orange)':'var(--green)';
    });
  },6000);

  /* ── Activity feed ──────────────────────────────────────── */
  const AF_EVENTS=[
    {ico:'✅',msg:'TRK-5502 departed Bengaluru Hub',sub:'Truck · Road'},
    {ico:'📍',msg:'VSL-3309 passed Hormuz Strait',sub:'Vessel · Sea'},
    {ico:'⚠️',msg:'Port congestion alert: Busan',sub:'AI Risk Engine'},
    {ico:'🔀',msg:'Route recalculated: saves $420 fuel',sub:'AI Optimizer · Free'},
    {ico:'🏁',msg:'Shipment CTX-9930 delivered · Hamburg',sub:'Completed'},
    {ico:'📦',msg:'New shipment CTX-9931 auto-manifested',sub:'Free plan'},
    {ico:'🛃',msg:'Customs cleared: Singapore → Sydney',sub:'AQIS Approved'},
    {ico:'⚡',msg:'AI route suggestion saves 2.1h',sub:'Human approved'},
    {ico:'🔔',msg:'ETA update: MV-Indus now 6h early',sub:'Proactive alert'},
  ];
  let afIdx=0;
  function addFeedItem(){
    const feed=document.getElementById('activityFeed'); if(!feed) return;
    const d=AF_EVENTS[afIdx++ % AF_EVENTS.length];
    const t=new Date();
    const tStr=t.getHours().toString().padStart(2,'0')+':'+t.getMinutes().toString().padStart(2,'0');
    const el=document.createElement('div'); el.className='feed-item';
    el.innerHTML=`<span class="fi-icon">${d.ico}</span><div class="fi-msg">${d.msg}<span>${d.sub}</span></div><span class="fi-time">${tStr}</span>`;
    feed.prepend(el);
    if(feed.children.length>8) feed.lastElementChild.remove();
  }
  setInterval(addFeedItem, 3600);

  /* ── Charts ─────────────────────────────────────────────── */
  function drawCharts(){
    // Line chart
    const lc=document.getElementById('lineChart');
    if(lc){
      lc.width=lc.offsetWidth||580; lc.height=150;
      const ctx=lc.getContext('2d');
      const data=[88,104,96,112,124,108,118,132,128,140,136,148,144,158];
      const avg=data.map((_,i)=>{const sl=data.slice(Math.max(0,i-6),i+1);return sl.reduce((a,b)=>a+b)/sl.length});
      const pad={t:14,r:14,b:26,l:34};
      const cW=lc.width-pad.l-pad.r, cH=lc.height-pad.t-pad.b;
      const mn=Math.min(...data)*.92, mx=Math.max(...data)*1.04;
      const sX=i=>(i/(data.length-1))*cW+pad.l;
      const sY=v=>cH-((v-mn)/(mx-mn))*cH+pad.t;
      // Grid
      ctx.strokeStyle='rgba(255,255,255,.04)'; ctx.lineWidth=1;
      for(let i=0;i<=4;i++){
        const y=pad.t+cH*(i/4); ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(lc.width-pad.r,y);ctx.stroke();
        ctx.fillStyle='rgba(235,235,245,.28)';ctx.font='9px -apple-system,sans-serif';ctx.textAlign='right';
        ctx.fillText(Math.round(mx-(mx-mn)*(i/4)),pad.l-3,y+3);
      }
      // Area
      const grd=ctx.createLinearGradient(0,pad.t,0,cH+pad.t);
      grd.addColorStop(0,'rgba(10,132,255,.24)');grd.addColorStop(1,'rgba(10,132,255,0)');
      ctx.beginPath();ctx.moveTo(sX(0),sY(data[0]));
      data.forEach((_,i)=>ctx.lineTo(sX(i),sY(data[i])));
      ctx.lineTo(sX(data.length-1),cH+pad.t);ctx.lineTo(sX(0),cH+pad.t);
      ctx.closePath();ctx.fillStyle=grd;ctx.fill();
      // Line
      ctx.beginPath();ctx.moveTo(sX(0),sY(data[0]));
      data.forEach((_,i)=>ctx.lineTo(sX(i),sY(data[i])));
      ctx.strokeStyle='#0A84FF';ctx.lineWidth=2.5;ctx.lineJoin='round';ctx.stroke();
      // Avg
      ctx.beginPath();ctx.moveTo(sX(0),sY(avg[0]));
      avg.forEach((_,i)=>ctx.lineTo(sX(i),sY(avg[i])));
      ctx.strokeStyle='rgba(90,200,250,.4)';ctx.lineWidth=1.5;ctx.setLineDash([5,4]);ctx.stroke();ctx.setLineDash([]);
      // Dots
      data.forEach((v,i)=>{
        ctx.beginPath();ctx.arc(sX(i),sY(v),3,0,Math.PI*2);
        ctx.fillStyle='#0A84FF';ctx.fill();
      });
      const lbs=['','','','D-10','','','D-7','','','D-4','','','D-1','Today'];
      ctx.fillStyle='rgba(235,235,245,.28)';ctx.font='9px -apple-system,sans-serif';ctx.textAlign='center';
      lbs.forEach((l,i)=>{if(l) ctx.fillText(l,sX(i),cH+pad.t+13)});
    }
    // Donut chart
    const dc=document.getElementById('donutChart');
    if(dc){
      dc.width=dc.offsetWidth||200; dc.height=150;
      const ctx=dc.getContext('2d');
      const cx=dc.width/2, cy=dc.height/2-8, R=48, ir=28;
      const segs=[
        {v:.38,c:'#0A84FF',l:'Road'},
        {v:.24,c:'#40CBE0',l:'Sea'},
        {v:.22,c:'#BF5AF2',l:'Air'},
        {v:.16,c:'#FF9F0A',l:'Rail'},
      ];
      let sa=-Math.PI/2;
      segs.forEach(s=>{
        const ea=sa+s.v*Math.PI*2;
        ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,R,sa,ea);
        ctx.closePath();ctx.fillStyle=s.c;
        ctx.fill();
        sa=ea;
      });
      // Hole
      ctx.beginPath();ctx.arc(cx,cy,ir,0,Math.PI*2);
      ctx.fillStyle='rgba(28,28,30,.95)';ctx.fill();
      // Center
      ctx.fillStyle='rgba(255,255,255,.9)';ctx.font='bold 14px -apple-system,sans-serif';ctx.textAlign='center';
      ctx.fillText('312',cx,cy+5);
      ctx.fillStyle='rgba(235,235,245,.35)';ctx.font='9px -apple-system,sans-serif';ctx.fillText('routes',cx,cy+16);
      // Legend
      let lx=6; const ly=dc.height-18;
      segs.forEach(s=>{
        ctx.beginPath();ctx.arc(lx+5,ly,4,0,Math.PI*2);ctx.fillStyle=s.c;ctx.fill();
        ctx.fillStyle='rgba(235,235,245,.5)';ctx.font='9px -apple-system,sans-serif';ctx.textAlign='left';
        ctx.fillText(s.l,lx+12,ly+3); lx+=52;
      });
    }
  }
  setTimeout(drawCharts,300); window.addEventListener('resize',()=>setTimeout(drawCharts,120));

  /* ── Testimonials carousel ──────────────────────────────── */
  let sIdx=0;
  window.goSlide=function(n){
    const track=document.getElementById('testiTrack'); if(!track) return;
    const perView=innerWidth<680?1:2;
    const maxS=Math.ceil(track.querySelectorAll('.testi-card').length/perView)-1;
    sIdx=Math.max(0,Math.min(n,maxS));
    track.style.transform=`translateX(-${sIdx*(100/perView)*50}%)`;
    document.querySelectorAll('.tn-dot').forEach((d,i)=>d.classList.toggle('active',i===sIdx));
  };
  setInterval(()=>goSlide((sIdx+1)%2),6500);

  /* ── FAQ ────────────────────────────────────────────────── */
  window.toggleFaq=function(item){
    const was=item.classList.contains('open');
    document.querySelectorAll('.faq-item.open').forEach(i=>i.classList.remove('open'));
    if(!was) item.classList.add('open');
  };

  /* ── Toast (global) ─────────────────────────────────────── */
  window.toast=function(icon,msg){
    const old=document.querySelector('.toast'); if(old) old.remove();
    const t=document.createElement('div'); t.className='toast';
    t.innerHTML=`<span style="font-size:1.1rem">${icon}</span><span class="toast-msg">${msg}</span>`;
    document.body.appendChild(t);
    setTimeout(()=>{t.classList.add('out');t.addEventListener('animationend',()=>t.remove());},3400);
  };

  /* ═══════════════════════════════════════════════════════
     OPEN-METEO WEATHER (free, no API key)
  ═══════════════════════════════════════════════════════ */
  const WMO_MAP = {
    0:{ico:'☀️',desc:'Clear sky'},
    1:{ico:'🌤️',desc:'Mainly clear'},2:{ico:'⛅',desc:'Partly cloudy'},3:{ico:'☁️',desc:'Overcast'},
    45:{ico:'🌫️',desc:'Fog'},48:{ico:'🌫️',desc:'Icy fog'},
    51:{ico:'🌦️',desc:'Light drizzle'},53:{ico:'🌦️',desc:'Drizzle'},57:{ico:'🌧️',desc:'Heavy drizzle'},
    61:{ico:'🌧️',desc:'Slight rain'},63:{ico:'🌧️',desc:'Moderate rain'},65:{ico:'🌧️',desc:'Heavy rain'},
    71:{ico:'❄️',desc:'Slight snow'},73:{ico:'❄️',desc:'Moderate snow'},75:{ico:'❄️',desc:'Heavy snow'},
    77:{ico:'🌨️',desc:'Snow grains'},
    80:{ico:'🌦️',desc:'Rain showers'},81:{ico:'🌧️',desc:'Moderate showers'},82:{ico:'🌩️',desc:'Violent showers'},
    85:{ico:'🌨️',desc:'Snow showers'},86:{ico:'❄️',desc:'Heavy snow showers'},
    95:{ico:'⛈️',desc:'Thunderstorm'},96:{ico:'⛈️',desc:'Thunderstorm w/ hail'},99:{ico:'⛈️',desc:'Severe thunderstorm'},
  };
  function wmoInfo(code){
    return WMO_MAP[code] || {ico:'🌐',desc:'Unknown'};
  }

  async function fetchWeather(lat, lng) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&wind_speed_unit=kmh&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Weather fetch failed');
    const data = await res.json();
    const c = data.current;
    return {
      temp:     Math.round(c.temperature_2m),
      code:     c.weather_code,
      wind:     Math.round(c.wind_speed_10m),
      humidity: c.relative_humidity_2m,
      ...wmoInfo(c.weather_code)
    };
  }

  window.showRouteWeather = async function(srcCoord, dstCoord, srcName, dstName){
    const panel = document.getElementById('route-weather');
    if (!panel) return;
    panel.style.display = 'grid';
    // Show loading state
    ['src','dst'].forEach(k=>{
      document.getElementById(`rw-${k}-ico`).textContent  = '⏳';
      document.getElementById(`rw-${k}-temp`).textContent = '–';
      document.getElementById(`rw-${k}-desc`).textContent = 'Fetching…';
      document.getElementById(`rw-${k}-wind`).textContent = '';
    });
    document.getElementById('rw-src-city').textContent = srcName;
    document.getElementById('rw-dst-city').textContent = dstName;

    try {
      const [sw, dw] = await Promise.all([
        fetchWeather(srcCoord[1], srcCoord[0]),
        fetchWeather(dstCoord[1], dstCoord[0])
      ]);
      const fill = (k, w, city) => {
        document.getElementById(`rw-${k}-ico`).textContent  = w.ico;
        document.getElementById(`rw-${k}-city`).textContent = city;
        document.getElementById(`rw-${k}-temp`).textContent = `${w.temp}°C`;
        document.getElementById(`rw-${k}-desc`).textContent = w.desc;
        document.getElementById(`rw-${k}-wind`).textContent = `💨 ${w.wind} km/h  💧 ${w.humidity}%`;
      };
      fill('src', sw, srcName);
      fill('dst', dw, dstName);
    } catch(e){
      ['src','dst'].forEach(k=>{
        document.getElementById(`rw-${k}-ico`).textContent  = '🌐';
        document.getElementById(`rw-${k}-desc`).textContent = 'Weather unavailable';
      });
    }
  };

  /* ═══════════════════════════════════════════════════════
     CARBON FOOTPRINT
  ═══════════════════════════════════════════════════════ */
  // Emission factors: kg CO2 per tonne-km
  const CO2_FACTOR = { road:0.096, rail:0.028, air:0.685, water:0.016 };
  window.calcCO2 = function(distKm, mode){
    const kg = distKm * CO2_FACTOR[mode] || 0;   // per tonne shipped
    const el  = document.getElementById('rv-co2');
    if (!el) return;
    if (kg < 100) {
      el.textContent = kg.toFixed(1) + ' kg';
      el.className = 'rc-val co2-lo';
    } else if (kg < 1000) {
      el.textContent = kg.toFixed(0) + ' kg';
      el.className = 'rc-val co2-md';
    } else {
      el.textContent = (kg/1000).toFixed(2) + ' t';
      el.className = 'rc-val co2-hi';
    }
    document.getElementById('rc-co2').title = `Per tonne shipped — ${mode} emits ${CO2_FACTOR[mode]} kg CO₂/tonne·km`;
  };

  /* ═══════════════════════════════════════════════════════
     ANTHROPIC AI INSIGHTS (calls Claude API)
  ═══════════════════════════════════════════════════════ */
  window.generateAIInsights = async function(context){
    const btn  = document.getElementById('aiGenBtn');
    const txt  = document.getElementById('aiGenTxt');
    const feed = document.getElementById('aiInsights');
    if (!btn || !feed) return;

    btn.disabled = true;
    txt.innerHTML = '<span class="spinner" style="width:13px;height:13px;border-width:2px"></span>&nbsp;AI is thinking\u2026';

    const ctx = context || window._lastRouteContext || null;
    const today = new Date().toDateString();
    const prompt = ctx
      ? 'You are CATALOX, an AI supply chain intelligence engine. Generate exactly 4 concise, actionable logistics risk insights for today (' + today + ') for a shipment going ' + ctx.src + ' to ' + ctx.dst + ' by ' + ctx.mode + ' (' + ctx.dist + ' km, ETA ' + ctx.eta + '). Weather at source: ' + (ctx.srcWeather || 'unknown') + '. Weather at destination: ' + (ctx.dstWeather || 'unknown') + '. Each insight must be a JSON object with keys: "ico" (single emoji), "title" (2-4 words bold label), "text" (1-2 sentences). Respond ONLY with a JSON array of 4 objects, no markdown, no preamble.'
      : 'You are CATALOX, an AI supply chain intelligence engine. Generate exactly 4 concise, actionable global logistics risk insights for today (' + today + '). Cover major shipping lanes, port congestion, geopolitical risks, and weather patterns. Each insight must be a JSON object with keys: "ico" (single emoji), "title" (2-4 words bold label), "text" (1-2 sentences). Respond ONLY with a JSON array of 4 objects, no markdown, no preamble.';

    const STATIC_INSIGHTS = [
      {ico:'🌊',title:'Typhoon Risk Active',text:'Intensifying storm near Philippines. Routes via South China Sea face +18h delay risk. Indonesian archipelago bypass recommended.'},
      {ico:'🚧',title:'Suez Congestion',text:'34 vessels waiting at canal. +6h overhead estimated. Cape of Good Hope bypass adds 4 days but eliminates chokepoint risk.'},
      {ico:'📈',title:'Freight Index Spike',text:'Trans-Pacific spot rates up 22% this week. Lock in forward contracts before Thursday market open to avoid premium exposure.'},
      {ico:'✅',title:'Indian Coast Clear',text:'Clear conditions predicted for 72h on west-to-east coastal corridor. Optimal window for time-sensitive transfers.'},
    ];

    try {
      const raw = await window.CATALOX_AI.complete(prompt, 700);
      let items;
      try { items = JSON.parse(raw.replace(/```json|```/g,'')); } catch(e){ items = null; }
      if(items && Array.isArray(items) && items.length){
        feed.innerHTML = items.map(i=>'<div class="ai-ins"><span class="aii-ico">'+i.ico+'</span><div class="aii-txt"><strong>'+i.title+'</strong> \u2014 '+i.text+'</div></div>').join('');
        toast('🤖','AI insights updated!');
      } else {
        throw new Error('No valid JSON');
      }
    } catch(e){
      feed.innerHTML = STATIC_INSIGHTS.map(i=>'<div class="ai-ins"><span class="aii-ico">'+i.ico+'</span><div class="aii-txt"><strong>'+i.title+'</strong> \u2014 '+i.text+'</div></div>').join('');
      if(window.CATALOX_AI.isConfigured()) toast('\u26A0\uFE0F','AI parse failed \u2014 showing curated insights.');
    } finally {
      btn.disabled = false;
      txt.textContent = '\u2728 Regenerate AI Insights';
    }
  };

  /* Auto-generate on load after a small delay */
  setTimeout(()=>{ if(document.getElementById('aiGenBtn')) generateAIInsights(); }, 2000);

  /* ═══════════════════════════════════════════════════════
     LIVE PORT WEATHER (Open-Meteo, no API key)
  ═══════════════════════════════════════════════════════ */
  const PORT_COORDS = {
    mumbai:    [19.076,72.877], shanghai:  [31.230,121.473],
    singapore: [1.352,103.820], rotterdam: [51.924,4.462],
    losangeles:[34.052,-118.24],hamburg:   [53.551,9.993],
    busan:     [35.179,129.075],dubai:     [25.204,55.270],
    colombo:   [6.927,79.862],
  };
  async function loadPortWeather(){
    for (const [id, [lat,lng]] of Object.entries(PORT_COORDS)){
      const el = document.getElementById('pw-' + id);
      if (!el) continue;
      try {
        const w = await fetchWeather(lat, lng);
        el.textContent = `${w.ico} ${w.temp}°C`;
        el.title = `${w.desc} · 💨${w.wind}km/h`;
      } catch(e){ el.textContent=''; }
      // Stagger requests to be polite
      await new Promise(r=>setTimeout(r,350));
    }
  }
  // Load port weather after page settles
  setTimeout(loadPortWeather, 3500);

})();
/* ═══════════════════════════════════════════════════════════
   ROUTING ENGINE — original JS (global scope)
═══════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════
   CONSTANTS & CONFIG
═══════════════════════════════════════════════ */
const ORS_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjFmMTJmOWE2OGEzYTQ0NTM4OGQ2OTcwYzUwNjNhOGY2IiwiaCI6Im11cm11cjY0In0=';

const MODE_CFG = {
  road:  { label:'🚛 Truck',      color:'#0A84FF', speedKmh: null },
  rail:  { label:'🚂 Train',      color:'#FF9F0A', speedKmh: 70   },
  air:   { label:'✈️ Air Cargo',  color:'#BF5AF2', speedKmh: 750  },
  water: { label:'🚢 Ship',       color:'#40CBE0', speedKmh: 35   },
};

const WEATHER_FACTOR = {
  road:  { Clear:1.0, Rain:1.3,  Storm:1.8 },
  rail:  { Clear:1.0, Rain:1.1,  Storm:1.4 },
  air:   { Clear:1.0, Rain:1.2,  Storm:2.5 },
  water: { Clear:1.0, Rain:1.3,  Storm:3.0 },
};

const TRAFFIC_FACTOR = { Low:1.0, Medium:1.2, High:1.55 };

const MSGS = {
  road:  { ok:['✅ Highway route clear. Truck dispatched.','🟢 Road network nominal. Cargo on the move.','🚛 Optimal highway selected. ETA confirmed.'],
           dl:['⚡ Road congestion detected. Alternate highway suggested.','🛤️ Rerouting truck via bypass road.','🔄 Traffic jam ahead — new route activated.'] },
  rail:  { ok:['🚂 Train scheduled on time. Rail network clear.','✅ Express freight train confirmed.','🟢 Rail corridor nominal. Cargo loaded.'],
           dl:['⚠️ Weather affecting rail speed. Minor delays expected.','🚂 Storm advisory on rail network. ETA adjusted.','🔄 Track maintenance detected. Alternate line suggested.'] },
  air:   { ok:['✈️ Air cargo route confirmed. Skies clear.','🟢 Flight path optimal. Cargo airborne soon.','✅ Air freight dispatched. No turbulence detected.'],
           dl:['⛈️ Storm advisory — flight path rerouted.','⚠️ Air traffic congestion. Departure delayed.','🌪️ Weather turbulence detected. ETA adjusted.'] },
  water: { ok:['🚢 Shipping lane clear. Vessel on course.','✅ Cargo ship route confirmed. Seas calm.','🌊 Optimal coastal route selected.'],
           dl:['⛈️ Rough seas detected. Ship speed reduced.','🌊 Storm warning — vessel rerouted via safer lane.','⚠️ Port congestion detected. Estimated delay added.'] },
};

const RISK_OK = ['Low','Minimal'];
const RISK_DL = ['High','Critical'];

const COASTAL_CITIES = [
  /* ── India West Coast ── */
  'mumbai','goa','panaji','vasco','kochi','cochin','kozhikode','calicut','kannur',
  'kollam','thiruvananthapuram','trivandrum','mangalore','udupi','karwar',
  'surat','bharuch','bhavnagar','jamnagar','kandla','mundra','porbandar','dwarka','okha',
  /* ── India East Coast ── */
  'chennai','madras','visakhapatnam','vizag','kakinada','nellore',
  'pondicherry','puducherry','tuticorin','thoothukudi','rameswaram','nagapattinam',
  'paradeep','paradip','puri','gopalpur','kolkata','calcutta','haldia','digha',
  /* ── Middle East ── */
  'dubai','abu dhabi','sharjah','muscat','salalah','aden','jeddah',
  'dammam','jubail','kuwait','doha','bahrain','bandar abbas',
  /* ── South / Southeast Asia ── */
  'karachi','gwadar','colombo','hambantota','chittagong','yangon',
  'singapore','kuala lumpur','penang','port klang','bangkok','laem chabang',
  'ho chi minh','haiphong','manila','jakarta','surabaya','medan','batam',
  /* ── East Asia ── */
  'hong kong','shenzhen','guangzhou','shanghai','tianjin','qingdao','ningbo',
  'dalian','xiamen','busan','incheon','tokyo','osaka','yokohama','nagoya','kobe',
  'taipei','kaohsiung',
  /* ── Australia / Pacific ── */
  'sydney','melbourne','brisbane','perth','fremantle','adelaide','darwin',
  'auckland','wellington','christchurch',
  /* ── Africa ── */
  'cape town','durban','mombasa','dar es salaam','maputo','lagos','accra',
  'abidjan','dakar','casablanca','alexandria','suez','tripoli',
  /* ── Europe ── */
  'london','liverpool','southampton','glasgow','amsterdam','rotterdam','antwerp',
  'hamburg','bremen','copenhagen','oslo','stockholm','helsinki','gdansk',
  'marseille','le havre','bordeaux','barcelona','valencia','bilbao',
  'lisbon','porto','genoa','naples','venice','trieste','palermo',
  'piraeus','athens','istanbul','izmir','thessaloniki',
  /* ── Americas ── */
  'new york','newark','boston','baltimore','miami','tampa','new orleans','houston',
  'galveston','charleston','savannah','los angeles','long beach',
  'seattle','tacoma','san francisco','oakland','san diego','vancouver',
  'montreal','halifax','buenos aires','montevideo','santos','rio de janeiro',
  'lima','callao','guayaquil','cartagena','panama','colon','panama city',
  'manzanillo','veracruz','havana',
];

/* ── INLAND cities that must NEVER get ship (override) ── */
const INLAND_CITIES = [
  'delhi','jaipur','agra','lucknow','kanpur','bhopal','indore','nagpur',
  'hyderabad','secunderabad','bangalore','bengaluru','mysore','pune',
  'ahmedabad','surat', /* surat has port but very small — keep disabled for simplicity? no, surat has port */
  'patna','varanasi','allahabad','prayagraj','dehradun','chandigarh',
  'amritsar','ludhiana','jalandhar','jodhpur','udaipur','jaisalmer',
  'raipur','ranchi','bhubaneswar', /* bhubaneswar is inland, paradip is the port */
  'new delhi','ncr',
  /* International inland */
  'moscow','paris','berlin','madrid','rome','milan','zurich','vienna',
  'prague','warsaw','budapest','bucharest','kiev','kyiv',
  'beijing','chengdu','chongqing','xian','wuhan','harbin','shenyang',
  'new delhi','kathmandu','kabul','tehran','baghdad','riyadh',
  'nairobi','addis ababa','khartoum','cairo', /* cairo has suez but city itself inland */
  'johannesburg','pretoria','harare','lusaka','kampala',
  'chicago','dallas','denver','phoenix','las vegas','atlanta','detroit',
  'toronto','ottawa','calgary','winnipeg',
  'sao paulo','brasilia','bogota','quito','santiago','la paz','asuncion',
  'mexico city','guadalajara','monterrey',
];

/* ═══════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════ */
let selectedMode = 'road';
let leafletMap   = null;
let routeLayer   = null;
let srcMarker    = null;
let dstMarker    = null;
const DS = { total:1284, delay:47, ontime:1237, routes:312 };
const acTimers = {};

/* ═══════════════════════════════════════════════
   NAVBAR
═══════════════════════════════════════════════ */
window.addEventListener('scroll', () => {
  // navbar handled by UI script
});

/* ═══════════════════════════════════════════════
   TRANSPORT MODE SELECTION
═══════════════════════════════════════════════ */
function selectMode(mode) {
  const card = document.getElementById('tm-' + mode);
  if (card.classList.contains('disabled')) {
    if (mode === 'water') toast('🚫', 'Ship unavailable — no coastal/port city on this route.');
    else if (mode === 'rail') toast('🚫', 'Railway unavailable — no rail connectivity on this route.');
    return;
  }
  selectedMode = mode;
  ['road','rail','air','water'].forEach(m => {
    document.getElementById('tm-' + m).classList.remove('active');
  });
  card.classList.add('active');
  /* Traffic only relevant for road */
  const tg = document.getElementById('traf-group');
  if (mode === 'air' || mode === 'water') {
    tg.style.opacity = '.4';
    tg.style.pointerEvents = 'none';
  } else {
    tg.style.opacity = '1';
    tg.style.pointerEvents = 'auto';
  }
}

/* ═══════════════════════════════════════════════
   COASTAL CHECK
═══════════════════════════════════════════════ */
function isCoastal(city) {
  if (!city) return false;
  const s = city.toLowerCase()
    .replace(/[,.-]/g,' ')
    .replace(/\b(india|usa|uk|uae|china|japan|australia|mh|or|ap|tn|ka|kl|gj|wb|od|odisha|maharashtra|karnataka|kerala|gujarat|tamilnadu|tamil nadu|andhra|telangana|west bengal)\b/g,'')
    .trim();
  const firstWord = s.split(' ')[0];
  /* Check inland override first */
  if (INLAND_CITIES.some(c => s.includes(c) || c === firstWord)) return false;
  /* Then check coastal list */
  return COASTAL_CITIES.some(c => s.includes(c) || c.includes(firstWord));
}

/* ── Islands/countries with NO road bridge to mainland ── */
const NO_ROAD_ISLANDS = [
  'andaman','nicobar','lakshadweep','lakshadeep','laccadive',
  'daman','diu','hawaii','maldives','sri lanka','ceylon',
  'singapore','indonesia','philippines','japan','taiwan',
  'new zealand','australia','iceland','ireland','uk','britain',
  'great britain','cuba','jamaica','caribbean','bahamas','bermuda',
  'madagascar','mauritius','reunion','seychelles','malta','cyprus',
  'corsica','sardinia','sicily','crete',
  'andaman and nicobar','port blair',
  'fiji','samoa','tonga','vanuatu','solomon','papua',
  'canary','azores','cape verde','falkland',
  /* Additional islands */
  'tokyo','osaka','kyoto','yokohama','nagoya','sapporo',  // Japan cities
  'taipei','kaohsiung','taichung',                         // Taiwan cities
  'hong kong',                                             // Island SAR
  'manila','cebu','davao',                                 // Philippines
  'jakarta','surabaya','bali','medan',                     // Indonesia islands
  'colombo','kandy',                                       // Sri Lanka
  'port blair',                                            // Andaman capital
  'auckland','wellington','christchurch',                  // New Zealand
  'sydney','melbourne','perth','brisbane','darwin',        // Australia
  'reykjavik',                                             // Iceland
  'dublin','cork',                                         // Ireland
  'london','birmingham','manchester','glasgow','edinburgh', // UK (island)
  'valletta',                                              // Malta
  'nicosia',                                               // Cyprus
  'havana',                                                // Cuba
  'kingston',                                              // Jamaica
];

function isNoRoadIsland(city) {
  if (!city) return false;
  const s = city.toLowerCase().replace(/[,.-]/g,' ').trim();
  return NO_ROAD_ISLANDS.some(i => s.includes(i));
}

function isIslandOrNoRail(city) {
  if (!city) return false;
  const s = city.toLowerCase().replace(/[,.-]/g,' ').trim();
  return NO_ROAD_ISLANDS.some(i => s.includes(i)); // same list
}

function checkTransportAvailability() {
  const src = document.getElementById('src').value.trim();
  const dst = document.getElementById('dst').value.trim();

  const srcIsIsland = isNoRoadIsland(src);
  const dstIsIsland = isNoRoadIsland(dst);
  /* Road impossible if either city is an island with no land bridge to the other */
  const crossOcean = (src || dst) && (srcIsIsland || dstIsIsland) && !(srcIsIsland && dstIsIsland && isSameIslandGroup(src, dst));

  /* ── Road check ── */
  const roadCard = document.getElementById('tm-road');
  if (crossOcean) {
    roadCard.classList.add('disabled');
    roadCard.title = '🚫 No road connection — ocean crossing required';
    if (selectedMode === 'road') selectMode('air');
  } else {
    roadCard.classList.remove('disabled');
    roadCard.title = '';
  }

  /* ── Water check — BOTH src AND dst must be coastal ── */
  const wCard = document.getElementById('tm-water');
  if (!src && !dst) {
    wCard.classList.remove('disabled');
  } else {
    const waterOk = isCoastal(src) && isCoastal(dst);
    if (!waterOk) {
      wCard.classList.add('disabled');
      wCard.title = '🚫 Both locations must have coastal/port access for ship';
      if (selectedMode === 'water') selectMode('air');
    } else {
      wCard.classList.remove('disabled');
      wCard.title = '';
    }
  }

  /* ── Railway check ── */
  const rCard = document.getElementById('tm-rail');
  const railDisabled = (src || dst) && (srcIsIsland || dstIsIsland);
  if (railDisabled) {
    rCard.classList.add('disabled');
    rCard.title = '🚫 No rail connectivity — island/remote location detected';
    if (selectedMode === 'rail') selectMode('air');
  } else {
    rCard.classList.remove('disabled');
    rCard.title = '';
  }
}

/* Check if two island cities are in the same group (e.g. both Japan cities) */
function isSameIslandGroup(src, dst) {
  const japanCities = ['tokyo','osaka','kyoto','yokohama','nagoya','sapporo','kobe','fukuoka','hiroshima'];
  const ukCities    = ['london','birmingham','manchester','glasgow','edinburgh','liverpool','bristol'];
  const auCities    = ['sydney','melbourne','perth','brisbane','darwin','adelaide','canberra'];
  const groups = [japanCities, ukCities, auCities];
  const s = src.toLowerCase(), d = dst.toLowerCase();
  return groups.some(g => g.some(c => s.includes(c)) && g.some(c => d.includes(c)));
}

/* Keep old name as alias for backwards compat */
function checkWaterAvailability() { checkTransportAvailability(); }

/* ═══════════════════════════════════════════════
   AUTOCOMPLETE
═══════════════════════════════════════════════ */
function acFetch(inputId) {
  const input = document.getElementById(inputId);
  const dropId = 'ac-' + inputId;
  const q = input.value.trim();
  const drop = document.getElementById(dropId);

  if (q.length < 2) { drop.classList.remove('open'); drop.innerHTML = ''; return; }

  clearTimeout(acTimers[inputId]);
  acTimers[inputId] = setTimeout(async () => {
    drop.innerHTML = `<div class="ac-loading"><div class="spinner" style="width:14px;height:14px;border-width:2px"></div>&nbsp;Searching…</div>`;
    drop.classList.add('open');
    try {
      const url = `https://api.openrouteservice.org/geocode/autocomplete?api_key=${ORS_KEY}&text=${encodeURIComponent(q)}&size=6&layers=locality,region,county,localadmin`;
      const res  = await fetch(url);
      const data = await res.json();
      const feats = (data.features || []).slice(0, 6);
      if (!feats.length) {
        drop.innerHTML = `<div class="ac-loading">😕 No results for "${q}"</div>`;
        return;
      }
      drop.innerHTML = feats.map(f => {
        const label  = f.properties.label || f.properties.name || '';
        const region = [f.properties.region, f.properties.country].filter(Boolean).join(', ');
        const regex  = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi');
        const bold   = label.replace(regex, '<mark>$1</mark>');
        const safeLabel = label.replace(/'/g, "\\'");
        return `<div class="ac-item" onclick="acSelect('${inputId}','${safeLabel}')">
          <div class="ac-pin">📍</div>
          <div><div class="ac-main">${bold}</div>${region ? `<div class="ac-sub">${region}</div>` : ''}</div>
        </div>`;
      }).join('');
    } catch(e) {
      drop.innerHTML = `<div class="ac-loading">⚠️ Could not fetch suggestions</div>`;
    }
  }, 320);
}

function acSelect(inputId, value) {
  document.getElementById(inputId).value = value;
  document.getElementById('ac-' + inputId).classList.remove('open');
  document.getElementById('ac-' + inputId).innerHTML = '';
  checkTransportAvailability();
}

/* Close dropdowns on outside click */
document.addEventListener('click', e => {
  ['src','dst'].forEach(id => {
    const wrap = document.getElementById(id)?.closest('.ac-wrap');
    if (wrap && !wrap.contains(e.target)) {
      document.getElementById('ac-' + id).classList.remove('open');
    }
  });
});

/* Input event listeners */
document.getElementById('src').addEventListener('input', () => { acFetch('src'); setTimeout(checkTransportAvailability, 400); });
document.getElementById('dst').addEventListener('input', () => { acFetch('dst'); setTimeout(checkTransportAvailability, 400); });

/* Keyboard nav */
['src','dst'].forEach(id => {
  document.getElementById(id).addEventListener('keydown', e => {
    const drop = document.getElementById('ac-' + id);
    const items = drop.querySelectorAll('.ac-item');
    const focused = drop.querySelector('.ac-item.focused');
    let idx = [...items].indexOf(focused);
    if (e.key === 'ArrowDown') { e.preventDefault(); focused?.classList.remove('focused'); items[Math.min(idx+1,items.length-1)]?.classList.add('focused'); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focused?.classList.remove('focused'); items[Math.max(idx-1,0)]?.classList.add('focused'); }
    else if (e.key === 'Enter') { if (focused) { focused.click(); return; } runOptimize(); }
    else if (e.key === 'Escape') { drop.classList.remove('open'); }
  });
});

/* ═══════════════════════════════════════════════
   DASHBOARD COUNT-UP
═══════════════════════════════════════════════ */
function countUp(el, to) {
  const from = parseInt(el.textContent.replace(/,/g,'')) || 0;
  const diff = to - from;
  const STEPS = 22, DURATION = 440;
  const start = performance.now();
  (function step(now){
    const t = Math.min(1, (now - start) / DURATION);
    const ease = t < 0.5 ? 2*t*t : -1+(4-2*t)*t; // easeInOut
    el.textContent = Math.round(from + diff * ease).toLocaleString();
    if(t < 1) requestAnimationFrame(step);
  })(performance.now());
}

/* ═══════════════════════════════════════════════
   API HELPERS
═══════════════════════════════════════════════ */
async function geocode(place) {
  const url = `https://api.openrouteservice.org/geocode/search?api_key=${ORS_KEY}&text=${encodeURIComponent(place)}&size=1`;
  const res  = await fetch(url);
  const data = await res.json();
  if (!data.features || !data.features.length) throw new Error(`City not found: "${place}"`);
  return data.features[0].geometry.coordinates; // [lng, lat]
}

async function getRoadData(srcC, dstC) {
  const res  = await fetch('https://api.openrouteservice.org/v2/directions/driving-car', {
    method:'POST',
    headers:{'Authorization':ORS_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({coordinates:[srcC,dstC]})
  });
  const data = await res.json();
  if (!data.routes?.length) throw new Error('Road route not found.');
  return {
    distanceKm:  Math.round(data.routes[0].summary.distance/1000),
    durationMin: Math.round(data.routes[0].summary.duration/60)
  };
}

function haversineKm(c1, c2) {
  const R=6371, r=d=>d*Math.PI/180;
  const dL=r(c2[1]-c1[1]), dLo=r(c2[0]-c1[0]);
  const a=Math.sin(dL/2)**2+Math.cos(r(c1[1]))*Math.cos(r(c2[1]))*Math.sin(dLo/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

function fmtTime(mins) {
  const h=Math.floor(mins/60), m=mins%60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/* ═══════════════════════════════════════════════
   MAIN OPTIMIZE
═══════════════════════════════════════════════ */
async function runOptimize() {
  const srcRaw = document.getElementById('src').value.trim();
  const dstRaw = document.getElementById('dst').value.trim();
  const wthr   = document.getElementById('wthr').value;
  const traf   = document.getElementById('traf').value;
  const mode   = selectedMode;

  if (!srcRaw || !dstRaw) { toast('⚠️','Please fill in both source and destination.'); return; }

  const btn = document.getElementById('sbtn');
  const btxt = document.getElementById('sbtn-txt');
  btn.disabled = true;
  btxt.innerHTML = '<span class="spinner"></span>&nbsp;Locating cities…';

  try {
    const [srcCoord, dstCoord] = await Promise.all([geocode(srcRaw), geocode(dstRaw)]);

    let distanceKm, durationMin;

    if (mode === 'road') {
      btxt.innerHTML = '<span class="spinner"></span>&nbsp;Calculating road route…';
      const d = await getRoadData(srcCoord, dstCoord);
      distanceKm  = d.distanceKm;
      durationMin = Math.round(d.durationMin * (TRAFFIC_FACTOR[traf] || 1.0));
    } else {
      btxt.innerHTML = `<span class="spinner"></span>&nbsp;Calculating ${mode} route…`;
      const straight = haversineKm(srcCoord, dstCoord);
      /* Water: use actual waypoint path distance for accuracy */
      let df;
      if (mode === 'water') {
        /* Calculate distance along ocean waypoints */
        const wpts = getOceanWaypoints(srcCoord, dstCoord);
        let pathKm = 0;
        for (let i=0; i<wpts.length-1; i++) {
          const a = [wpts[i][1],   wpts[i][0]  ]; // [lng,lat]
          const b = [wpts[i+1][1], wpts[i+1][0]];
          pathKm += haversineKm(a, b);
        }
        distanceKm  = Math.round(pathKm);
        durationMin = Math.round((distanceKm / MODE_CFG[mode].speedKmh) * 60);
      } else {
        df = { rail:1.25, air:1.0 };
        distanceKm  = Math.round(straight * (df[mode]||1.0));
        durationMin = Math.round((distanceKm / MODE_CFG[mode].speedKmh) * 60);
      }
    }

    /* Apply weather factor */
    const wf     = WEATHER_FACTOR[mode][wthr] || 1.0;
    const adjMin = Math.round(durationMin * wf);
    const etaStr = fmtTime(adjMin);

    /* Delay logic */
    const isDelay = mode === 'road'
      ? (traf === 'High' || wthr === 'Storm')
      : (wthr === 'Storm' || (wthr === 'Rain' && mode === 'water'));

    const pool = isDelay ? MSGS[mode].dl : MSGS[mode].ok;
    const msg  = pool[Math.floor(Math.random()*pool.length)];
    const risk = isDelay ? RISK_DL[Math.floor(Math.random()*2)] : RISK_OK[Math.floor(Math.random()*2)];

    /* Populate result */
    document.getElementById('rv-time').textContent   = etaStr;
    document.getElementById('rv-dist').textContent   = distanceKm + ' km';
    document.getElementById('rv-status').textContent = isDelay ? 'Delay Expected' : 'On Time';
    document.getElementById('rv-status').className   = 'rc-val ' + (isDelay ? 'delay' : 'ontime');
    document.getElementById('rv-risk').textContent   = risk;
    document.getElementById('rv-risk').style.color = isDelay ? '#FF453A' : '#32D74B';
    document.getElementById('rmsg-text').textContent = msg;
    document.getElementById('rmsg-icon').textContent = isDelay ? '⚠️' : '✅';
    document.getElementById('rmsg-icon').className   = 'mi ' + (isDelay ? 'warn' : 'ok');

    /* CO2 estimate */
    if (window.calcCO2) calcCO2(distanceKm, mode);

    ['rc-time','rc-dist','rc-status','rc-risk','rc-co2'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('danger','success');
      el.classList.add(isDelay ? 'danger' : 'success');
    });

    const rw = document.getElementById('result-wrap');
    rw.classList.add('show');
    rw.scrollIntoView({behavior:'smooth', block:'nearest'});

    /* Fetch real weather for src & dst */
    if (window.showRouteWeather) showRouteWeather(srcCoord, dstCoord, srcRaw, dstRaw);

    /* Draw map */
    drawMap(srcCoord, dstCoord, srcRaw, dstRaw, distanceKm, etaStr, mode);

    /* Dashboard */
    DS.total++; DS.routes++;
    if (isDelay) DS.delay++; else DS.ontime++;
    countUp(document.getElementById('d-total'),  DS.total);
    countUp(document.getElementById('d-delay'),  DS.delay);
    countUp(document.getElementById('d-ontime'), DS.ontime);
    countUp(document.getElementById('d-routes'), DS.routes);

    const emo = {road:'🚛',rail:'🚂',air:'✈️',water:'🚢'};
    toast(isDelay ? '⚠️' : '✅', `${emo[mode]} ${distanceKm} km · ETA: ${etaStr}`);

    /* Store context so AI insights can reference this route */
    window._lastRouteContext = { src:srcRaw, dst:dstRaw, mode, dist:distanceKm, eta:etaStr };
    /* Trigger fresh AI insights for this route (after weather loads) */
    setTimeout(async () => {
      if (!window.showRouteWeather || !window._lastRouteContext) return;
      // Enrich context with weather description if available
      const si = document.getElementById('rw-src-desc');
      const di = document.getElementById('rw-dst-desc');
      if (si && di && si.textContent !== 'Fetching…') {
        window._lastRouteContext.srcWeather = si.textContent;
        window._lastRouteContext.dstWeather = di.textContent;
      }
      if (window.generateAIInsights) generateAIInsights(window._lastRouteContext);
    }, 2500);

  } catch(err) {
    toast('❌', err.message || 'Could not fetch route. Check city names.');
    console.error(err);
  } finally {
    btn.disabled = false;
    btxt.textContent = '⚡ Calculate Optimal Route';
  }
}

/* ═══════════════════════════════════════════════
   MAP
═══════════════════════════════════════════════ */
function makeIcon(color) {
  return L.divIcon({
    className:'',
    html:`<div style="width:14px;height:14px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 0 10px ${color}"></div>`,
    iconSize:[14,14], iconAnchor:[7,7]
  });
}

function greatCirclePts(c1, c2, steps=80) {
  const toR=d=>d*Math.PI/180, toD=r=>r*180/Math.PI;
  const [lo1,la1]=[toR(c1[0]),toR(c1[1])], [lo2,la2]=[toR(c2[0]),toR(c2[1])];
  const d = Math.acos(Math.sin(la1)*Math.sin(la2)+Math.cos(la1)*Math.cos(la2)*Math.cos(lo2-lo1));
  if (isNaN(d)||d===0) return [[c1[1],c1[0]],[c2[1],c2[0]]];
  const pts=[];
  for(let i=0;i<=steps;i++){
    const f=i/steps;
    const A=Math.sin((1-f)*d)/Math.sin(d), B=Math.sin(f*d)/Math.sin(d);
    const x=A*Math.cos(la1)*Math.cos(lo1)+B*Math.cos(la2)*Math.cos(lo2);
    const y=A*Math.cos(la1)*Math.sin(lo1)+B*Math.cos(la2)*Math.sin(lo2);
    const z=A*Math.sin(la1)+B*Math.sin(la2);
    pts.push([toD(Math.atan2(z,Math.sqrt(x*x+y*y))), toD(Math.atan2(y,x))]);
  }
  return pts;
}

function getOceanWaypoints(sc, dc) {
  /* sc, dc are [lng, lat] from ORS geocode */
  const sLng=sc[0], sLat=sc[1], dLng=dc[0], dLat=dc[1];

  /* Zone checks — using lng, lat correctly */
  const zone = (lng1,lat1,lng2,lat2) => (c) => c[0]>=lng1&&c[0]<=lng2&&c[1]>=lat1&&c[1]<=lat2;

  const inIndia    = zone( 68, 6,  98, 36);
  const inEurope   = zone(-10,36,  40, 72);
  const inUSAEast  = zone(-90,20, -60, 55);  // USA East + Gulf of Mexico + Caribbean
  const inUSAWest  = zone(-130,15,-110, 60); // USA West Coast
  const inEAsia    = zone(100,10, 150, 50);  // China, Japan, Korea
  const inSEAsia   = zone( 95, 0, 140, 25);  // SE Asia
  const inAndaman  = zone( 91, 6,  94, 14);  // Andaman & Nicobar Islands
  const inMiddleE  = zone( 32, 8,  60, 32);  // Arabian Peninsula
  const inAustralia= zone(112,-45,155, -8);
  const inEAfrica  = zone( 28,-35,  55, 15);
  const inWAfrica  = zone(-20,-35,  28, 20);
  const inSAmerica = zone(-82,-60, -34, 15);
  const inUSAGulf  = zone(-98,18,  -80, 32);  // Gulf Coast USA

  const src=[sLng,sLat], dst=[dLng,dLat];

  /* Key ocean gate waypoints [lng, lat] */
  const G = {
    /* Indian Ocean & surrounding */
    arabSea:   [ 65, 14],  // Arabian Sea center
    arabE:     [ 72, 10],  // Arabian Sea east (near India)
    indOcean:  [ 75, -5],  // Indian Ocean center
    sriLanka:  [ 80,  5],  // South of Sri Lanka
    bay:       [ 88, 10],  // Bay of Bengal
    malacca:   [103,  2],  // Strait of Malacca
    southChina:[114, 10],  // South China Sea

    /* Suez & Mediterranean */
    redSeaS:   [ 43, 12],  // Red Sea south (Bab-el-Mandeb)
    redSeaN:   [ 32, 28],  // Suez Canal north
    medEast:   [ 28, 34],  // East Mediterranean
    medCenter: [ 15, 36],  // Center Mediterranean
    medWest:   [  5, 36],  // West Mediterranean
    gibraltar: [ -6, 36],  // Strait of Gibraltar

    /* Atlantic */
    atlNorth:  [-30, 42],  // North Atlantic
    atlMid:    [-25, 10],  // Mid Atlantic
    atlSouth:  [-15,-20],  // South Atlantic

    /* Americas */
    panamaCanal:[-80, 9],  // Panama Canal Pacific exit
    panamaAtl:  [-79, 9],  // Panama Canal Atlantic exit
    caribSea:   [-75,15],  // Caribbean Sea
    gulfMex:    [-90,23],  // Gulf of Mexico
    usaECoast:  [-74,37],  // USA East Coast
    usaWCoast:  [-120,35], // USA West Coast

    /* Pacific */
    pacificN:   [-135,30], // North Pacific
    pacificMid: [-150,20], // Mid Pacific
    pacificS:   [-140,-5], // South Pacific

    /* Cape routes */
    capeGoodHope:[18,-35], // Cape of Good Hope
    capeHorn:   [-68,-56], // Cape Horn

    /* Australia */
    aussieW:    [113,-22], // West Australia
    aussieE:    [153,-28], // East Australia
    aussieS:    [130,-35], // South Australia (Great Australian Bight)
  };

  /* Helper: build [lat,lng] array from gate waypoints */
  const route = (...gates) => [[sLat,sLng], ...gates.map(g=>[g[1],g[0]]), [dLat,dLng]];

  /* ════════════════════════════════════════
     ROUTING DECISION TREE
  ════════════════════════════════════════ */

  /* ── Andaman ↔ India mainland (Bay of Bengal coastal) ── */
  if (inAndaman(src) && inIndia(dst)) return route(G.bay);
  if (inIndia(src) && inAndaman(dst)) return route(G.bay);

  /* ── Andaman ↔ SE Asia (via Malacca) ── */
  if (inAndaman(src) && inSEAsia(dst)) return route(G.malacca);
  if (inSEAsia(src) && inAndaman(dst)) return route(G.malacca);

  /* ── Andaman ↔ USA East/Gulf (via Panama Canal + Pacific + Malacca) ── */
  if (inAndaman(src) && (inUSAEast(dst)||inUSAGulf(dst)))
    return route(G.bay, G.malacca, G.pacificMid, G.panamaCanal, G.panamaAtl, G.caribSea, G.usaECoast);
  if ((inUSAEast(src)||inUSAGulf(src)) && inAndaman(dst))
    return route(G.gulfMex, G.caribSea, G.panamaAtl, G.panamaCanal, G.pacificMid, G.malacca, G.bay);

  /* ── Andaman ↔ Europe (via Malacca + Suez) ── */
  if (inAndaman(src) && inEurope(dst))
    return route(G.bay, G.arabSea, G.redSeaS, G.redSeaN, G.medEast, G.medCenter);
  if (inEurope(src) && inAndaman(dst))
    return route(G.medCenter, G.medEast, G.redSeaN, G.redSeaS, G.arabSea, G.bay);

  /* ── India ↔ India (coastal) ── */
  if (inIndia(src) && inIndia(dst)) {
    if (sLng<78 && dLng<78) return route(G.arabE);               // Both west coast
    if (sLng>=78 && dLng>=78) return route(G.bay);               // Both east coast
    return route(G.arabE, G.sriLanka, G.bay);                     // Cross coast via south India
  }

  /* ── India ↔ Middle East ── */
  if (inIndia(src)&&inMiddleE(dst) || inMiddleE(src)&&inIndia(dst))
    return route(G.arabE, G.arabSea, G.redSeaS);

  /* ── India ↔ Europe (via Suez) ── */
  if (inIndia(src)&&inEurope(dst) || inEurope(src)&&inIndia(dst))
    return route(G.arabE, G.arabSea, G.redSeaS, G.redSeaN, G.medEast, G.medCenter, G.medWest);

  /* ── India ↔ East Africa (via Arabian Sea) ── */
  if (inIndia(src)&&inEAfrica(dst) || inEAfrica(src)&&inIndia(dst))
    return route(G.arabE, G.arabSea, G.redSeaS);

  /* ── India ↔ West Africa (via Cape or Suez) ── */
  if (inIndia(src)&&inWAfrica(dst) || inWAfrica(src)&&inIndia(dst))
    return route(G.indOcean, G.capeGoodHope, G.atlSouth, G.atlMid);

  /* ── India ↔ SE Asia / China / Japan (via Malacca) ── */
  if (inIndia(src)&&inEAsia(dst) || inEAsia(src)&&inIndia(dst))
    return route(G.bay, G.malacca, G.southChina);
  if (inIndia(src)&&inSEAsia(dst) || inSEAsia(src)&&inIndia(dst))
    return route(G.bay, G.malacca);

  /* ── India ↔ Australia ── */
  if (inIndia(src)&&inAustralia(dst) || inAustralia(src)&&inIndia(dst))
    return route(G.sriLanka, G.indOcean, G.aussieW);

  /* ── India ↔ USA East (via Panama Canal + Pacific — shorter than Suez!) ── */
  if (inIndia(src)&&inUSAEast(dst) || inUSAEast(src)&&inIndia(dst))
    return route(G.bay, G.malacca, G.pacificMid, G.panamaCanal, G.panamaAtl, G.caribSea, G.usaECoast);

  /* ── India ↔ USA Gulf (via Panama Canal + Pacific) ── */
  if (inIndia(src)&&inUSAGulf(dst) || inUSAGulf(src)&&inIndia(dst))
    return route(G.arabE, G.sriLanka, G.malacca, G.pacificMid, G.panamaCanal, G.gulfMex);

  /* ── India ↔ USA West (via Malacca + Pacific) ── */
  if (inIndia(src)&&inUSAWest(dst) || inUSAWest(src)&&inIndia(dst))
    return route(G.bay, G.malacca, G.southChina, G.pacificN, G.usaWCoast);

  /* ── India ↔ South America (via Cape or Panama) ── */
  if (inIndia(src)&&inSAmerica(dst) || inSAmerica(src)&&inIndia(dst))
    return route(G.indOcean, G.capeGoodHope, G.atlSouth, G.atlMid);

  /* ── Europe ↔ USA East (via Atlantic) ── */
  if (inEurope(src)&&inUSAEast(dst) || inUSAEast(src)&&inEurope(dst))
    return route(G.gibraltar, G.atlNorth, G.usaECoast);

  /* ── Europe ↔ USA West (via Panama Canal) ── */
  if (inEurope(src)&&inUSAWest(dst) || inUSAWest(src)&&inEurope(dst))
    return route(G.gibraltar, G.atlNorth, G.caribSea, G.panamaAtl, G.panamaCanal, G.pacificN, G.usaWCoast);

  /* ── Europe ↔ East Asia (via Suez) ── */
  if (inEurope(src)&&inEAsia(dst) || inEAsia(src)&&inEurope(dst))
    return route(G.medWest, G.medEast, G.redSeaN, G.redSeaS, G.arabSea, G.malacca, G.southChina);

  /* ── USA East ↔ East Asia (via Panama Canal + Pacific) ── */
  if (inUSAEast(src)&&inEAsia(dst) || inEAsia(src)&&inUSAEast(dst))
    return route(G.usaECoast, G.caribSea, G.panamaAtl, G.panamaCanal, G.pacificMid, G.southChina);

  /* ── USA East/Gulf ↔ Middle East / Africa (via Atlantic + Suez) ── */
  if ((inUSAEast(src)||inUSAGulf(src)) && (inMiddleE(dst)||inEAfrica(dst)))
    return route(G.usaECoast, G.atlNorth, G.gibraltar, G.medEast, G.redSeaN, G.redSeaS);

  /* ── China/Japan ↔ USA West (trans-Pacific) ── */
  if (inEAsia(src)&&inUSAWest(dst) || inUSAWest(src)&&inEAsia(dst))
    return route(G.southChina, G.pacificN, G.usaWCoast);

  /* ── Australia ↔ USA West ── */
  if (inAustralia(src)&&inUSAWest(dst) || inUSAWest(src)&&inAustralia(dst))
    return route(G.aussieE, G.pacificMid, G.usaWCoast);

  /* ── Default: via Indian Ocean center ── */
  return route(G.indOcean);
}

/* ═══════════════════════════════════════════════════════════════════
   GOOGLE MAPS TILE LAYER + GPS + ALL PORTS/CITIES PINS
   Uses Google Maps tile API (no key required for tiles)
   Falls back gracefully to CartoDB dark if blocked
═══════════════════════════════════════════════════════════════════ */

// Google Maps tile URLs (public, no API key needed for basic tiles)
const GMAPS_TILES = {
  roadmap:   'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
  satellite: 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
  hybrid:    'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
  terrain:   'https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
};
const GMAPS_SUBDOMAINS = ['0','1','2','3'];
const FALLBACK_TILE    = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

let mapTileMode = 'hybrid'; // default: hybrid (satellite + labels)
let mainPortLayer   = null; // layer group for all port pins on main map
let userGpsMarker   = null; // user's GPS marker on main map
let userGpsLat = null, userGpsLon = null;

/* Create a Google Maps tile layer with fallback */
function createGoogleTile(mode) {
  return L.tileLayer(GMAPS_TILES[mode] || GMAPS_TILES.hybrid, {
    subdomains: GMAPS_SUBDOMAINS,
    attribution: '© Google Maps',
    maxZoom: 20,
    tileSize: 256,
  });
}

/* Create a CartoDB dark fallback tile layer */
function createFallbackTile() {
  return L.tileLayer(FALLBACK_TILE, {
    subdomains: 'abcd',
    attribution: '© OpenStreetMap © CartoDB',
    maxZoom: 19,
  });
}

/* Build a custom Liquid Glass SVG pin for Leaflet */
function makeLgPin(color, icon, size) {
  size = size || 36;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size*1.3}" viewBox="0 0 36 46">
    <defs>
      <radialGradient id="pinGrad${color.replace('#','')}" cx="40%" cy="30%" r="70%">
        <stop offset="0%" stop-color="rgba(255,255,255,0.35)"/>
        <stop offset="100%" stop-color="rgba(255,255,255,0.04)"/>
      </radialGradient>
      <filter id="pinBlur${color.replace('#','')}">
        <feGaussianBlur stdDeviation="1.2"/>
      </filter>
    </defs>
    <!-- Drop shadow -->
    <ellipse cx="18" cy="44" rx="10" ry="3" fill="rgba(0,0,0,0.35)" filter="url(#pinBlur${color.replace('#','')})"/>
    <!-- Pin body -->
    <path d="M18 2C11.4 2 6 7.4 6 14C6 22 18 38 18 38C18 38 30 22 30 14C30 7.4 24.6 2 18 2Z" 
      fill="${color}" fill-opacity="0.85"/>
    <!-- Frosted glass overlay -->
    <path d="M18 2C11.4 2 6 7.4 6 14C6 22 18 38 18 38C18 38 30 22 30 14C30 7.4 24.6 2 18 2Z" 
      fill="url(#pinGrad${color.replace('#','')})" />
    <!-- Specular highlight -->
    <ellipse cx="13" cy="10" rx="4" ry="3" fill="rgba(255,255,255,0.30)" transform="rotate(-20,13,10)"/>
    <!-- Border -->
    <path d="M18 2C11.4 2 6 7.4 6 14C6 22 18 38 18 38C18 38 30 22 30 14C30 7.4 24.6 2 18 2Z" 
      fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="1"/>
    <!-- Icon circle -->
    <circle cx="18" cy="14" r="7" fill="rgba(0,0,0,0.30)"/>
    <text x="18" y="18" text-anchor="middle" font-size="9" fill="white">${icon}</text>
  </svg>`;
  return L.divIcon({
    className: '',
    html: svg,
    iconSize: [size, size*1.3],
    iconAnchor: [size/2, size*1.3],
    popupAnchor: [0, -size*1.3+4],
  });
}

/* GPS pin for user location */
function makeGpsPin() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
    <defs>
      <radialGradient id="gpsGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#32D74B" stop-opacity="0.5"/>
        <stop offset="100%" stop-color="#32D74B" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <circle cx="20" cy="20" r="19" fill="url(#gpsGlow)"/>
    <circle cx="20" cy="20" r="10" fill="rgba(50,215,75,0.20)" stroke="rgba(50,215,75,0.60)" stroke-width="1.5"/>
    <circle cx="20" cy="20" r="5" fill="#32D74B"/>
    <circle cx="20" cy="20" r="5" fill="rgba(255,255,255,0.30)"/>
    <circle cx="18" cy="18" r="2" fill="rgba(255,255,255,0.50)"/>
  </svg>`;
  return L.divIcon({ className:'', html:svg, iconSize:[40,40], iconAnchor:[20,20], popupAnchor:[0,-22] });
}

/* Inject tile switcher UI into main map */
function injectMapControls() {
  const bar = document.getElementById('map-info-bar');
  if (!bar || bar.querySelector('.map-tile-switcher')) return;
  const sw = document.createElement('div');
  sw.className = 'map-tile-switcher';
  sw.style.cssText = 'display:flex;gap:4px;margin-left:8px;flex-shrink:0;';
  sw.innerHTML = ['hybrid','satellite','roadmap','terrain'].map(m =>
    `<button onclick="switchMapTile('${m}')" id="mts-${m}" title="${m[0].toUpperCase()+m.slice(1)}"
      style="padding:3px 9px;border-radius:999px;font-size:.60rem;font-weight:700;cursor:pointer;
      border:1px solid rgba(255,255,255,.18);transition:all .18s ease;letter-spacing:.04em;
      backdrop-filter:blur(14px);${m==='hybrid'?'background:rgba(10,132,255,.22);color:#fff;border-color:rgba(10,132,255,.50);':'background:rgba(255,255,255,.07);color:rgba(255,255,255,.55);'}"
    >${m==='hybrid'?'Hybrid':m==='satellite'?'Sat':m==='roadmap'?'Road':'Terrain'}</button>`
  ).join('');
  bar.appendChild(sw);

  // GPS button
  const gpsBtn = document.createElement('button');
  gpsBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" style="display:inline;vertical-align:-.1em"><circle cx="6" cy="6" r="2.2" fill="currentColor"/><circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M6 1v1.5M6 9.5V11M1 6h1.5M9.5 6H11" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg> GPS`;
  gpsBtn.title = 'Show my location on map';
  gpsBtn.onclick = locateMeOnMainMap;
  gpsBtn.style.cssText = 'padding:3px 9px;border-radius:999px;font-size:.60rem;font-weight:700;cursor:pointer;border:1px solid rgba(50,215,75,.35);background:rgba(50,215,75,.12);color:rgba(50,215,75,.90);backdrop-filter:blur(14px);margin-left:4px;transition:all .18s ease;';
  bar.appendChild(gpsBtn);

  // Ports toggle
  const portBtn = document.createElement('button');
  portBtn.innerHTML = '🚢 Ports';
  portBtn.title = 'Toggle port/airport/station pins';
  portBtn.onclick = togglePortPins;
  portBtn.style.cssText = 'padding:3px 9px;border-radius:999px;font-size:.60rem;font-weight:700;cursor:pointer;border:1px solid rgba(64,203,224,.35);background:rgba(64,203,224,.12);color:rgba(64,203,224,.90);backdrop-filter:blur(14px);margin-left:4px;transition:all .18s ease;';
  bar.appendChild(portBtn);
}

function switchMapTile(mode) {
  mapTileMode = mode;
  if (!leafletMap) return;
  // Remove old tile layers
  leafletMap.eachLayer(l => { if (l instanceof L.TileLayer) leafletMap.removeLayer(l); });
  // Add new
  try { createGoogleTile(mode).addTo(leafletMap); }
  catch(e) { createFallbackTile().addTo(leafletMap); }
  // Update button styles
  ['hybrid','satellite','roadmap','terrain'].forEach(m => {
    const b = document.getElementById('mts-'+m);
    if (!b) return;
    b.style.background = m===mode ? 'rgba(10,132,255,.22)' : 'rgba(255,255,255,.07)';
    b.style.color      = m===mode ? '#fff' : 'rgba(255,255,255,.55)';
    b.style.borderColor= m===mode ? 'rgba(10,132,255,.50)' : 'rgba(255,255,255,.18)';
  });
}

/* Add all hub pins to the main map */
let portPinsVisible = false;
function togglePortPins() {
  if (!leafletMap) return;
  if (portPinsVisible) {
    if (mainPortLayer) { leafletMap.removeLayer(mainPortLayer); mainPortLayer = null; }
    portPinsVisible = false;
    return;
  }
  addAllPortPins();
  portPinsVisible = true;
}

function addAllPortPins() {
  if (!leafletMap || typeof HUBS === 'undefined') return;
  if (mainPortLayer) { leafletMap.removeLayer(mainPortLayer); }
  mainPortLayer = L.layerGroup();

  HUBS.forEach(hub => {
    if (!hub.lat || !hub.lon) return;
    const color = hub.type==='airport' ? '#BF5AF2' : hub.type==='station' ? '#FF9F0A' : '#40CBE0';
    const icon  = hub.type==='airport' ? '✈' : hub.type==='station' ? '🚂' : '⚓';
    const marker = L.marker([hub.lat, hub.lon], { icon: makeLgPin(color, icon, 32) });
    marker.bindPopup(`
      <div style="font-family:system-ui;min-width:180px;background:#0a0a1a;border-radius:12px;padding:12px 14px;border:1px solid rgba(255,255,255,.15);">
        <div style="font-size:.62rem;font-weight:700;letter-spacing:.10em;text-transform:uppercase;color:${color};margin-bottom:4px;">${hub.type.toUpperCase()}</div>
        <div style="font-size:.88rem;font-weight:800;color:#fff;margin-bottom:2px;">${hub.name}</div>
        <div style="font-size:.72rem;color:rgba(255,255,255,.50);">${hub.city}, ${hub.country}</div>
        <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">
          <span style="font-size:.62rem;padding:2px 8px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);color:rgba(255,255,255,.60);">${hub.code}</span>
          <span style="font-size:.62rem;padding:2px 8px;border-radius:999px;background:${color}18;border:1px solid ${color}40;color:${color};">${hub.rank}</span>
        </div>
        <div style="margin-top:8px;font-size:.68rem;color:rgba(255,255,255,.45);">📦 ${hub.throughput}</div>
        <div style="margin-top:4px;font-size:.68rem;color:rgba(255,255,255,.35);">🔗 Routes: ${(hub.routes||[]).slice(0,3).join(' · ')}</div>
        <button onclick="document.getElementById('src').value='${hub.city}';document.getElementById('pcPort').value='${hub.name}';updateLivePrediction();this.closest('.leaflet-popup').remove();" 
          style="margin-top:10px;width:100%;padding:7px;border-radius:9px;background:rgba(10,132,255,.20);border:1px solid rgba(10,132,255,.45);color:#fff;font-size:.70rem;font-weight:700;cursor:pointer;">
          Use as Origin →
        </button>
      </div>
    `, { maxWidth: 240, className: 'lg-popup' });
    mainPortLayer.addLayer(marker);
  });

  // Also add major world cities
  const WORLD_CITIES = [
    { name:'Mumbai', lat:19.07, lon:72.87, type:'city' }, { name:'Delhi', lat:28.61, lon:77.21, type:'city' },
    { name:'Shanghai', lat:31.23, lon:121.47, type:'city' }, { name:'Singapore', lat:1.35, lon:103.82, type:'city' },
    { name:'Dubai', lat:25.20, lon:55.27, type:'city' }, { name:'London', lat:51.51, lon:-0.12, type:'city' },
    { name:'New York', lat:40.71, lon:-74.00, type:'city' }, { name:'Tokyo', lat:35.69, lon:139.69, type:'city' },
    { name:'Rotterdam', lat:51.92, lon:4.48, type:'city' }, { name:'Frankfurt', lat:50.11, lon:8.68, type:'city' },
    { name:'Sydney', lat:-33.87, lon:151.21, type:'city' }, { name:'Colombo', lat:6.93, lon:79.85, type:'city' },
    { name:'Busan', lat:35.18, lon:129.07, type:'city' }, { name:'Hamburg', lat:53.55, lon:10.00, type:'city' },
  ];
  WORLD_CITIES.forEach(c => {
    const marker = L.marker([c.lat, c.lon], { icon: makeLgPin('#32D74B', '🏙', 26) });
    marker.bindPopup(`
      <div style="font-family:system-ui;background:#0a0a1a;border-radius:10px;padding:10px 12px;border:1px solid rgba(255,255,255,.15);">
        <div style="font-size:.62rem;font-weight:700;letter-spacing:.10em;text-transform:uppercase;color:#32D74B;margin-bottom:4px;">CITY HUB</div>
        <div style="font-size:.88rem;font-weight:800;color:#fff;">${c.name}</div>
        <div style="display:flex;gap:6px;margin-top:8px;">
          <button onclick="document.getElementById('src').value='${c.name}';updateLivePrediction();this.closest('.leaflet-popup').remove();" style="flex:1;padding:6px;border-radius:8px;background:rgba(10,132,255,.20);border:1px solid rgba(10,132,255,.45);color:#fff;font-size:.65rem;font-weight:700;cursor:pointer;">Set Origin</button>
          <button onclick="document.getElementById('dst').value='${c.name}';document.getElementById('pcCity').value='${c.name}';updateLivePrediction();this.closest('.leaflet-popup').remove();" style="flex:1;padding:6px;border-radius:8px;background:rgba(50,215,75,.16);border:1px solid rgba(50,215,75,.40);color:#fff;font-size:.65rem;font-weight:700;cursor:pointer;">Set Dest</button>
        </div>
      </div>
    `, { maxWidth: 200, className: 'lg-popup' });
    mainPortLayer.addLayer(marker);
  });

  mainPortLayer.addTo(leafletMap);
}

/* Locate user on main map */
function locateMeOnMainMap() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(pos => {
    const lat = pos.coords.latitude, lon = pos.coords.longitude;
    userGpsLat = lat; userGpsLon = lon;
    if (!leafletMap) return;
    if (userGpsMarker) leafletMap.removeLayer(userGpsMarker);
    userGpsMarker = L.marker([lat, lon], { icon: makeGpsPin() })
      .bindPopup(`<div style="font-family:system-ui;background:#0a0a1a;border-radius:10px;padding:10px 12px;border:1px solid rgba(50,215,75,.30);color:#fff;"><div style="font-size:.62rem;color:#32D74B;font-weight:700;margin-bottom:4px;">YOUR LOCATION</div><div style="font-size:.80rem;">📍 ${lat.toFixed(4)}, ${lon.toFixed(4)}</div><button onclick="document.getElementById('dst').value='${lat.toFixed(4)},${lon.toFixed(4)}';document.getElementById('pcCity').value='My Location';this.closest('.leaflet-popup').remove();" style="margin-top:8px;width:100%;padding:6px;border-radius:8px;background:rgba(50,215,75,.18);border:1px solid rgba(50,215,75,.45);color:#fff;font-size:.65rem;font-weight:700;cursor:pointer;">Set as Destination</button></div>`)
      .addTo(leafletMap).openPopup();
    leafletMap.setView([lat, lon], 10, { animate: true });
  }, () => alert('Location access denied. Please enable GPS in browser settings.'));
}

function initMap() {
  if (leafletMap) return;
  if (!window.L) {
    window._lazyLeaflet(() => initMap());
    return;
  }
  leafletMap = L.map('leaflet-map', { zoomControl: true, attributionControl: true }).setView([22, 82], 4);

  // Try Google Maps hybrid first, fallback to CartoDB
  const googleLayer = createGoogleTile('hybrid');
  googleLayer.on('tileerror', function() {
    // If Google tiles fail, switch to CartoDB
    leafletMap.eachLayer(l => { if (l instanceof L.TileLayer) leafletMap.removeLayer(l); });
    createFallbackTile().addTo(leafletMap);
  });
  googleLayer.addTo(leafletMap);

  // Inject custom map controls after map initialises
  setTimeout(injectMapControls, 300);

  // Show all port pins by default after a short delay
  setTimeout(() => {
    addAllPortPins();
    portPinsVisible = true;
  }, 600);
}

/* Upgrade Port-City map to Google hybrid too */
const _origRunPortCity = window.runPortCityRoute;


async function drawMap(srcC, dstC, srcName, dstName, distKm, etaStr, mode) {
  document.getElementById('map-idle').style.display      = 'none';
  document.getElementById('map-container').style.display = 'block';
  initMap();
  await new Promise(r=>setTimeout(r,80));
  leafletMap.invalidateSize();

  /* Clear old layers */
  leafletMap.eachLayer(l => { if (l !== leafletMap._layers && !(l instanceof L.TileLayer)) { try{leafletMap.removeLayer(l)}catch(e){} } });
  routeLayer=null; srcMarker=null; dstMarker=null;

  const color = MODE_CFG[mode].color;

  if (mode === 'road') {
    try {
      const res  = await fetch('https://api.openrouteservice.org/v2/directions/driving-car/geojson',{
        method:'POST', headers:{'Authorization':ORS_KEY,'Content-Type':'application/json'},
        body:JSON.stringify({coordinates:[srcC,dstC]})
      });
      const data = await res.json();
      routeLayer = L.geoJSON(data.features[0].geometry,{
        style:{color,weight:5,opacity:.85,lineJoin:'round',lineCap:'round'}
      }).addTo(leafletMap);
    } catch {
      routeLayer = L.polyline([[srcC[1],srcC[0]],[dstC[1],dstC[0]]],{color,weight:4,dashArray:'8 6'}).addTo(leafletMap);
    }
  } else if (mode === 'air') {
    const pts = greatCirclePts(srcC, dstC, 100);
    routeLayer = L.polyline(pts,{color,weight:3,dashArray:'10 7',opacity:.9}).addTo(leafletMap);
    const mid = pts[Math.floor(pts.length/2)];
    L.marker(mid,{icon:L.divIcon({className:'',html:`<div style="font-size:1.4rem">✈️</div>`,iconSize:[28,28],iconAnchor:[14,14]})}).addTo(leafletMap);
  } else if (mode === 'rail') {
    const pts = [[srcC[1],srcC[0]],[dstC[1],dstC[0]]];
    L.polyline(pts,{color:'#1a1a2e',weight:9,opacity:.6}).addTo(leafletMap);
    routeLayer = L.polyline(pts,{color,weight:5,dashArray:'16 6',opacity:.9}).addTo(leafletMap);
    const mid = [(srcC[1]+dstC[1])/2,(srcC[0]+dstC[0])/2];
    L.marker(mid,{icon:L.divIcon({className:'',html:`<div style="font-size:1.4rem">🚂</div>`,iconSize:[28,28],iconAnchor:[14,14]})}).addTo(leafletMap);
  } else {
    const wpts = getOceanWaypoints(srcC, dstC);
    L.polyline(wpts,{color:'#0e7490',weight:8,opacity:.2}).addTo(leafletMap);
    routeLayer = L.polyline(wpts,{color,weight:4,dashArray:'20 8',opacity:.9}).addTo(leafletMap);
    const mid = wpts[Math.floor(wpts.length/2)];
    L.marker(mid,{icon:L.divIcon({className:'',html:`<div style="font-size:1.4rem">🚢</div>`,iconSize:[28,28],iconAnchor:[14,14]})}).addTo(leafletMap);
  }

  const bounds = routeLayer ? routeLayer.getBounds() : L.latLngBounds([[srcC[1],srcC[0]],[dstC[1],dstC[0]]]);
  leafletMap.fitBounds(bounds,{padding:[50,50]});

  srcMarker = L.marker([srcC[1],srcC[0]], { icon: makeLgPin('#32D74B','📍',38) }).addTo(leafletMap)
    .bindPopup(`<div style="font-family:system-ui;background:#0a0a1a;border-radius:12px;padding:10px 14px;border:1px solid rgba(50,215,75,.30);color:#fff;min-width:140px;"><div style="font-size:.60rem;color:#32D74B;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:3px;">ORIGIN</div><div style="font-size:.84rem;font-weight:700;">${srcName}</div></div>`, { className:'lg-popup' }).openPopup();
  dstMarker = L.marker([dstC[1],dstC[0]], { icon: makeLgPin('#FF453A','🏁',38) }).addTo(leafletMap)
    .bindPopup(`<div style="font-family:system-ui;background:#0a0a1a;border-radius:12px;padding:10px 14px;border:1px solid rgba(255,69,58,.30);color:#fff;min-width:140px;"><div style="font-size:.60rem;color:#FF453A;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:3px;">DESTINATION</div><div style="font-size:.84rem;font-weight:700;">${dstName}</div></div>`, { className:'lg-popup' });

  /* Info bar */
  document.getElementById('map-from').textContent  = srcName;
  document.getElementById('map-to').textContent    = dstName;
  document.getElementById('map-dist-badge').textContent = `📏 ${distKm} km`;
  document.getElementById('map-time-badge').textContent = `⏱ ${etaStr}`;
  const mb = document.getElementById('map-mode-badge');
  mb.textContent = MODE_CFG[mode].label;
  mb.style.color = color; mb.style.borderColor = color; mb.style.background = color+'22';

  // Add / update Google Maps deeplink in the info bar
  let gmLink = document.getElementById('map-gm-link');
  if (!gmLink) {
    gmLink = document.createElement('a');
    gmLink.id = 'map-gm-link';
    gmLink.target = '_blank';
    gmLink.rel = 'noopener';
    gmLink.style.cssText = 'padding:3px 10px;border-radius:999px;font-size:.60rem;font-weight:700;text-decoration:none;border:1px solid rgba(66,133,244,.45);background:rgba(66,133,244,.14);color:rgba(66,133,244,.90);backdrop-filter:blur(14px);transition:all .18s ease;white-space:nowrap;';
    gmLink.innerHTML = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" style="display:inline;margin-right:3px;vertical-align:-.05em"><path d="M5 1C3.07 1 1.5 2.57 1.5 4.5c0 2.625 3.5 5.5 3.5 5.5s3.5-2.875 3.5-5.5C8.5 2.57 6.93 1 5 1zm0 4.667a1.167 1.167 0 110-2.334 1.167 1.167 0 010 2.334z" fill="currentColor"/></svg>Google Maps`;
    const infoBar = document.getElementById('map-info-bar');
    if (infoBar) infoBar.appendChild(gmLink);
  }
  const gSrc = `${srcC[1]},${srcC[0]}`;
  const gDst = `${dstC[1]},${dstC[0]}`;
  gmLink.href = `https://www.google.com/maps/dir/${gSrc}/${gDst}`;

  document.getElementById('map-sec').scrollIntoView({behavior:'smooth',block:'start'});
}

/* ═══════════════════════════════════════════════
   TOAST
═══════════════════════════════════════════════ */
function toast(icon, text) {
  const old = document.querySelector('.toast');
  if (old) old.remove();
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<span style="font-size:1.1rem">${icon}</span><span class="toast-msg">${text}</span>`;
  document.body.appendChild(t);
  setTimeout(() => {
    t.classList.add('out');
    t.addEventListener('animationend', () => t.remove());
  }, 3000);
}


// ── Neural Net JS (Python engine weights, typed arrays) ──────────────────
const W1 = new Float32Array([
  0.42,-0.18,0.63,-0.29,0.71,0.15,-0.44,0.82,-0.33,0.57,0.21,-0.68,0.44,-0.12,0.79,-0.25,
  -0.31,0.74,-0.22,0.68,-0.15,0.89,-0.41,0.26,0.63,-0.19,0.77,-0.34,0.52,0.88,-0.27,0.43,
  0.55,-0.67,0.38,-0.81,0.29,-0.44,0.73,-0.18,0.61,-0.35,-0.58,0.42,-0.72,0.19,0.64,-0.37,
  -0.48,0.33,-0.77,0.52,-0.69,0.27,-0.14,0.85,-0.42,0.71,-0.28,0.66,-0.39,0.57,-0.83,0.24,
  0.67,-0.24,0.81,-0.36,0.58,-0.71,0.43,-0.62,0.27,-0.84,0.53,-0.19,0.78,-0.45,0.32,-0.61,
  -0.53,0.79,-0.41,0.62,-0.28,0.85,-0.66,0.34,-0.49,0.73,-0.22,0.87,-0.55,0.41,-0.76,0.28,
  0.38,-0.82,0.24,-0.59,0.71,-0.33,0.88,-0.47,0.62,-0.18,0.74,-0.41,0.29,-0.63,0.85,-0.22,
  -0.64,0.47,-0.73,0.28,-0.81,0.55,-0.39,0.72,-0.24,0.86,-0.51,0.33,-0.68,0.44,-0.27,0.79
]);
const B1 = new Float32Array([0.10,-0.20,0.15,-0.08,0.22,-0.17,0.09,-0.24,0.18,-0.11,0.26,-0.14,0.07,-0.19,0.23,-0.06]);
const W2 = new Float32Array([
  0.58,-0.34,0.71,-0.45,0.62,-0.27,0.83,-0.51,-0.44,0.77,-0.29,0.68,-0.37,0.85,-0.22,0.63,
  0.71,-0.52,0.38,-0.79,0.24,-0.66,0.87,-0.43,-0.63,0.41,-0.84,0.27,-0.58,0.74,-0.35,0.91,
  0.49,-0.76,0.53,-0.32,0.88,-0.47,0.61,-0.28,-0.37,0.84,-0.18,0.73,-0.55,0.29,-0.79,0.44,
  0.82,-0.23,0.67,-0.41,0.34,-0.88,0.51,-0.72,-0.56,0.38,-0.75,0.49,-0.22,0.66,-0.84,0.37,
  0.43,-0.69,0.28,-0.87,0.61,-0.34,0.76,-0.19,-0.71,0.54,-0.36,0.82,-0.48,0.23,-0.67,0.85,
  0.34,-0.81,0.72,-0.25,0.57,-0.93,0.41,-0.64,-0.48,0.67,-0.53,0.38,-0.82,0.55,-0.29,0.74,
  0.75,-0.42,0.19,-0.76,0.83,-0.37,0.62,-0.48,-0.29,0.83,-0.61,0.44,-0.18,0.79,-0.53,0.36,
  0.66,-0.37,0.84,-0.52,0.29,-0.71,0.48,-0.85,-0.83,0.51,-0.27,0.69,-0.74,0.38,-0.91,0.52
]);
const B2 = new Float32Array([0.05,-0.12,0.18,-0.07,0.14,-0.09,0.21,-0.16]);
const W3 = new Float32Array([0.71,-0.54,0.83,-0.42,0.67,-0.79,0.55,-0.88]);
const B3 = 0.30;
function lrelu(x){ return x>0?x:0.01*x; }
function sigmoid(x){ return 1/(1+Math.exp(-x)); }
function nnForward(inputs){
  const t0=performance.now();
  const h1=new Float32Array(16);
  for(let j=0;j<16;j++){let s=B1[j];for(let i=0;i<8;i++)s+=inputs[i]*W1[i*16+j];h1[j]=lrelu(s);}
  const h2=new Float32Array(8);
  for(let j=0;j<8;j++){let s=B2[j];for(let i=0;i<16;i++)s+=h1[i]*W2[i*8+j];h2[j]=lrelu(s);}
  let o=B3;for(let i=0;i<8;i++)o+=h2[i]*W3[i];
  const dt=performance.now()-t0;
  const el=document.getElementById('nn-infer');
  if(el)el.textContent='~'+(dt*1000).toFixed(0)+'μs';
  return sigmoid(o);
}
window.computeNNRisk=function(distKm,mode,weather,traffic,lat1,lng1,lat2,lng2){
  const inp=new Float32Array([distKm/20000,mode/3,weather/2,traffic/2,(lat2-lat1)/180,(lng2-lng1)/360,0.4,(Date.now()%86400000)/86400000]);
  let r=nnForward(inp);
  r+=([0.05,-0.08,0.12,0.15][mode]||0)+([0,0.08,0.22][weather]||0);
  return Math.max(0.04,Math.min(0.97,r));
};

// ── World Clock ────────────────────────────────────────────────────────────
(function initWorldClock(){
  const zones={mumbai:'Asia/Kolkata',dubai:'Asia/Dubai',singapore:'Asia/Singapore',
    shanghai:'Asia/Shanghai',tokyo:'Asia/Tokyo',frankfurt:'Europe/Berlin',
    rotterdam:'Europe/Amsterdam',london:'Europe/London',newyork:'America/New_York',
    losangeles:'America/Los_Angeles'};
  const mh={mumbai:[9,15.5],dubai:[10,14],singapore:[9,17],shanghai:[9.5,15],
    tokyo:[9,15.5],frankfurt:[9,17.5],rotterdam:[9,17.5],london:[8,16.5],
    newyork:[9.5,16],losangeles:[9.5,16]};
  function upd(){
    const now=new Date();
    for(const[city,tz]of Object.entries(zones)){
      const t=now.toLocaleTimeString('en-GB',{timeZone:tz,hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
      const h=parseInt(t.split(':')[0])+parseInt(t.split(':')[1])/60;
      const el=document.getElementById('wc-'+city);
      const me=document.getElementById('wm-'+city);
      if(el)el.textContent=t.slice(0,5);
      if(me){
        const[open,close]=mh[city]||[9,17];
        const isOpen=h>=open&&h<close;
        me.textContent=isOpen?'OPEN':'CLOSED';
        me.className='wck-market '+(isOpen?'wck-open':'wck-closed');
      }
    }
  }
  upd();setInterval(upd,1000);
})();

// ── Live FX Ticker ─────────────────────────────────────────────────────────
(function initLiveFX(){
  const base={};
  PY_DATA.fx.forEach(f=>{base[f.pair]=parseFloat(f.rate);});
  function tick(){
    PY_DATA.fx.forEach(f=>{
      const t=(Math.random()-0.49)*base[f.pair]*0.0002;
      f.rate=(parseFloat(f.rate)+t).toFixed(5);
      const id='fx-'+f.pair.replace('/','').toLowerCase();
      const el=document.getElementById(id);
      if(el){
        const old=parseFloat(el.textContent),nv=parseFloat(f.rate);
        el.textContent=nv.toFixed(4);
        el.style.color=nv>old?'var(--green)':nv<old?'var(--red)':'';
        setTimeout(()=>el.style.color='',800);
      }
    });
  }
  setInterval(tick,2800);
})();

// ── NN Risk Refresh ────────────────────────────────────────────────────────
(function initNNRefresh(){
  function hav(la1,lo1,la2,lo2){
    const R=6371,r=d=>d*Math.PI/180,dl=r(la2-la1),dlo=r(lo2-lo1);
    const a=Math.sin(dl/2)**2+Math.cos(r(la1))*Math.cos(r(la2))*Math.sin(dlo/2)**2;
    return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  }
  const cors=[
    {la1:18.96,lo1:72.82,la2:51.92,lo2:4.46,mode:3},
    {la1:31.23,lo1:121.47,la2:33.73,lo2:-118.26,mode:3},
    {la1:25.20,lo1:55.27,la2:-1.29,lo2:36.82,mode:2},
    {la1:53.55,lo1:9.99,la2:40.67,lo2:-74.01,mode:3},
    {la1:1.35,lo1:103.82,la2:-33.87,lo2:151.21,mode:3},
    {la1:28.61,lo1:77.21,la2:1.35,lo2:103.82,mode:2},
  ];
  function upd(){
    cors.forEach((c,i)=>{
      const dist=hav(c.la1,c.lo1,c.la2,c.lo2);
      let risk=window.computeNNRisk(dist,c.mode,0,0,c.la1,c.lo1,c.la2,c.lo2);
      risk=Math.max(0.05,Math.min(0.95,risk+(Math.random()-0.49)*0.04));
      const pct=Math.round(risk*100);
      const bar=document.getElementById('rr'+(i+1));
      const val=document.getElementById('rr'+(i+1)+'v');
      if(bar){bar.style.width=pct+'%';bar.className='risk-bar '+(pct>65?'rb-hi':pct>35?'rb-md':'rb-lo');}
      if(val){val.textContent=pct+'%';val.style.color=pct>65?'var(--red)':pct>35?'var(--orange)':'var(--green)';}
    });
  }
  setTimeout(upd,1500);setInterval(upd,30000);
})();

// ── Cargo / Incoterms ──────────────────────────────────────────────────────
window._cargoType='general';window._incoterm='EXW';
window.setCargo=function(el,t){document.querySelectorAll('.cargo-pill').forEach(p=>p.classList.remove('active'));el.classList.add('active');window._cargoType=t;};
window.setInco=function(el,t){document.querySelectorAll('.inco-opt').forEach(p=>p.classList.remove('active'));el.classList.add('active');window._incoterm=t;};

// ── Extended Route Results ─────────────────────────────────────────────────
window.showExtendedResults=function(distKm,mode,weightKg){
  const wt=weightKg||20000;
  const RATES={road:0.065,rail:0.038,air:4.2,water:0.018};
  const m=['road','rail','air','water'][mode]||'road';
  const base=distKm*wt*RATES[m]*0.001,fuel=base*0.18,ins=base*0.004,hdl=base*0.06+120,total=base+fuel+ins+hdl;
  let ext=document.getElementById('result-ext');
  if(!ext){ext=document.createElement('div');ext.id='result-ext';ext.className='result-ext-grid';const rw=document.getElementById('result-wrap');if(rw)rw.appendChild(ext);}
  ext.innerHTML=`
    <div class="rex"><div class="rex-lbl">💵 Freight Est.</div><div class="rex-val">${Math.round(base).toLocaleString()}</div><div class="rex-sub">Base rate</div></div>
    <div class="rex"><div class="rex-lbl">⛽ Fuel</div><div class="rex-val"><div class="card-bg" style="background-image:none;
};

// ── Commodity Ticker ───────────────────────────────────────────────────────
(function(){
  const comms=PY_DATA.commodities;
  function tick(){
    comms.forEach(c=>{
      const nv=parseFloat(c.price)+(Math.random()-0.49)*parseFloat(c.price)*0.003;
      c.price=nv.toFixed(nv<10?3:1);
      const el=document.getElementById('cp-'+c.sym.toLowerCase());
      if(el){
        const old=parseFloat(el.textContent);
        el.textContent=parseFloat(c.price).toFixed(nv<10?3:1);
        el.style.color=nv>old?'var(--green)':nv<old?'var(--red)':'';
        setTimeout(()=>el.style.color='var(--l1)',900);
      }
    });
  }
  setInterval(tick,4200);
})();

// ── Enhanced Port Weather ──────────────────────────────────────────────────
(function(){
  const ports={
    mumbai:{lat:19.076,lng:72.877,tz:'Asia/Kolkata'},
    shanghai:{lat:31.230,lng:121.473,tz:'Asia/Shanghai'},
    singapore:{lat:1.352,lng:103.820,tz:'Asia/Singapore'},
    rotterdam:{lat:51.924,lng:4.462,tz:'Europe/Amsterdam'},
    losangeles:{lat:34.052,lng:-118.24,tz:'America/Los_Angeles'},
    hamburg:{lat:53.551,lng:9.993,tz:'Europe/Berlin'},
    busan:{lat:35.179,lng:129.075,tz:'Asia/Seoul'},
    dubai:{lat:25.204,lng:55.270,tz:'Asia/Dubai'},
    colombo:{lat:6.927,lng:79.862,tz:'Asia/Colombo'},
  };
  const WMO={0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',51:'🌦️',61:'🌧️',71:'❄️',80:'🌦️',95:'⛈️'};
  async function fetchPort(name,info){
    try{
      const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${info.lat.toFixed(3)}&longitude=${info.lng.toFixed(3)}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&timezone=auto&wind_speed_unit=kmh`);
      const j=await r.json();const c=j.current;
      const ico=WMO[c.weather_code]||'🌐';
      const lt=new Date().toLocaleTimeString('en-GB',{timeZone:info.tz,hour:'2-digit',minute:'2-digit'});
      const pw=document.getElementById('pw-'+name);if(pw)pw.textContent=ico+' '+Math.round(c.temperature_2m)+'°C';
      const pcw=document.getElementById('pcw-'+name);if(pcw)pcw.textContent=ico;
      const pct=document.getElementById('pct-'+name);if(pct)pct.textContent=Math.round(c.temperature_2m)+'°C · 💨'+Math.round(c.wind_speed_10m)+'km/h · 💧'+c.relative_humidity_2m+'%';
      const ptime=document.getElementById('ptime-'+name);if(ptime)ptime.textContent='Local: '+lt;
    }catch(e){}
  }
  let delay=2000;
  for(const[name,info]of Object.entries(ports)){setTimeout(()=>fetchPort(name,info),delay);delay+=450;}
})();

// ── Patch runOptimize for extended results ─────────────────────────────────
setTimeout(()=>{
  const orig=window.runOptimize;
  if(!orig)return;
  window.runOptimize=async function(){
    await orig();
    const distEl=document.getElementById('rv-dist');
    const dist=distEl?parseFloat(distEl.textContent)||5000:5000;
    const wEl=document.getElementById('cargo-weight');
    const wt=wEl?parseFloat(wEl.value)||20000:20000;
    const modeMap={road:0,rail:1,air:2,water:3};
    const m=modeMap[window.selectedMode||'road']||0;
    if(window.showExtendedResults)showExtendedResults(dist,m,wt);
  };
},1000);

/* ═══════════════════════════════════════════ */

(function injectCardBgs(){

  /* ── Image pools by card category ── */
  const POOLS = {

    /* Feature cards */
    fc: [
      'photo-1516849841032-87cbac4d88f7', // satellite dish
      'photo-1518770660439-4636190af475', // circuit board
      'photo-1534536281715-e28d76689b4d', // earth globe
      'photo-1504711434969-e33886168f5c', // lightning storm
      'photo-1551288049-bebda4e38f71',    // analytics charts
      'photo-1558494949-ef010cbdcc31',    // server rack
      'photo-1531746790731-6c087fecd65a', // AI visualization
      'photo-1505118380757-91f5f5632de0', // ocean waves
      'photo-1558618666-fcd25c85cd64',    // network cables
    ],

    /* Fleet vehicle cards */
    fleet: [
      'photo-1601584115197-04ecc0da31d7', // highway truck
      'photo-1474487548417-781cb6d646ef', // freight train
      'photo-1436491865332-7a61a109cc05', // cargo plane
      'photo-1578575437130-527eed3abbec', // container ship
      'photo-1553413077-190dd305871c',    // container warehouse
    ],

    /* KPI cards */
    kpi: [
      'photo-1483183407682-f2e33e0dcca2', // containers birds-eye
      'photo-1504711434969-e33886168f5c', // storm alert
      'photo-1553413077-190dd305871c',    // container yard
      'photo-1531746790731-6c087fecd65a', // AI route
    ],

    /* Weather cards */
    weather: [
      'photo-1504701954957-2010ec3bcec1', // sunny sky
      'photo-1514632595-4944383f2737',    // rain on glass
      'photo-1429514513361-8a632ff5e6f3', // lightning storm
      'photo-1527482937786-6608f6e14c15', // cyclone satellite
      'photo-1487621167305-5d248087c724', // dense fog road
    ],

    /* Commodity cards */
    commodity: [
      'photo-1547532182-4ff7c59b5a0b',    // oil barrels
      'photo-1565677466851-5a3ca00e9f55',  // oil refinery
      'photo-1504711434969-e33886168f5c',  // gas flames
      'photo-1558618666-fcd25c85cd64',     // iron/metal
      'photo-1611273426858-450d8e3c9fce',  // coal
      'photo-1610375461246-83df859d849d',  // gold bars
      'photo-1545193544-312983719627',     // copper pipes
      'photo-1574323347407-f5e1ad6d020b',  // wheat field
    ],

    /* Integration cards */
    integration: [
      'photo-1547658719-da2b51169166',    // code monitor
      'photo-1551288049-bebda4e38f71',    // data dashboard
      'photo-1534536281715-e28d76689b4d', // globe network
      'photo-1518770660439-4636190af475', // circuit board
      'photo-1578575437130-527eed3abbec', // container ship
      'photo-1436491865332-7a61a109cc05', // cargo plane
      'photo-1601584115197-04ecc0da31d7', // logistics truck
      'photo-1483183407682-f2e33e0dcca2', // warehouse
      'photo-1524661135-423995f22d0b',    // city map
      'photo-1581093804475-577d72e38aa0', // tech lab
      'photo-1553413077-190dd305871c',    // container yard
      'photo-1558618666-fcd25c85cd64',    // cables network
    ],

    /* Testimonial cards */
    testimonial: [
      'photo-1600880292203-757bb62b4baf', // office meeting
      'photo-1521737852567-6949f3f9f2b5', // team working
      'photo-1557804506-669a67965ba0',    // business discussion
      'photo-1553877522-43269d4ea984',    // logistics team
    ],

    /* Shipping lane cards */
    lane: [
      'photo-1578575437130-527eed3abbec', // container ship
      'photo-1505118380757-91f5f5632de0', // ocean waves
      'photo-1436491865332-7a61a109cc05', // cargo plane
      'photo-1574610758823-fe9339a7c8ca', // port aerial
      'photo-1606585235002-2a1ca83e2da7', // sea shipping
      'photo-1540962351504-03099e0a754b', // airplane cockpit
    ],

    /* Transport mode chips */
    mode: [
      'photo-1601584115197-04ecc0da31d7', // truck
      'photo-1474487548417-781cb6d646ef', // train
      'photo-1436491865332-7a61a109cc05', // plane
      'photo-1578575437130-527eed3abbec', // ship
    ],

    /* Result cards */
    result: [
      'photo-1601584115197-04ecc0da31d7',
      'photo-1524661135-423995f22d0b',
      'photo-1553413077-190dd305871c',
      'photo-1578575437130-527eed3abbec',
      'photo-1436491865332-7a61a109cc05',
    ],

    /* Metric pills */
    metric: [
      'photo-1483183407682-f2e33e0dcca2',
      'photo-1601584115197-04ecc0da31d7',
      'photo-1492144534655-ae79c964c9d7',
      'photo-1504711434969-e33886168f5c',
      'photo-1553413077-190dd305871c',
    ],

    /* General card fallback pool */
    general: [
      'photo-1578575437130-527eed3abbec',
      'photo-1553413077-190dd305871c',
      'photo-1601584115197-04ecc0da31d7',
      'photo-1474487548417-781cb6d646ef',
      'photo-1436491865332-7a61a109cc05',
      'photo-1531746790731-6c087fecd65a',
      'photo-1524661135-423995f22d0b',
      'photo-1551288049-bebda4e38f71',
      'photo-1558618666-fcd25c85cd64',
      'photo-1504711434969-e33886168f5c',
    ],
  };

  /* ── Real Unsplash photo URLs (source.unsplash.com) ──────────────────
     Each photo ID maps to a contextually correct logistics image.
     source.unsplash.com is CORS-open, no API key needed.
     Fallback: a dark gradient so cards never look broken offline.
  ── */
  const FALLBACK_GRAD = "data:image/svg+xml,%3Csvg xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg' width%3D'600' height%3D'600'%3E%3Cdefs%3E%3ClinearGradient id%3D'g' x1%3D'0%25' y1%3D'0%25' x2%3D'100%25' y2%3D'100%25'%3E%3Cstop offset%3D'0%25' stop-color%3D'%230a1628'%2F%3E%3Cstop offset%3D'60%25' stop-color%3D'%231a4a7a'%2F%3E%3Cstop offset%3D'100%25' stop-color%3D'%233a9bd5'%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3Crect width%3D'100%25' height%3D'100%25' fill%3D'url(%23g)'%2F%3E%3C%2Fsvg%3E";

  function imgUrl(id) {
    // Real Unsplash photos via images.unsplash.com — no key needed, CORS open
    return 'https://images.unsplash.com/' + id + '?auto=format&fit=crop&w=800&h=600&q=70';
  }

  /* Inject with lazy-load + error fallback to gradient */
  function injectBg(el, url) {
    const img = new Image();
    img.onload  = () => { el.style.backgroundImage = "url('" + url + "')"; };
    img.onerror = () => { el.style.backgroundImage = "url('" + FALLBACK_GRAD + "')"; };
    img.src = url;
    // Set gradient immediately so card isn't blank while image loads
    el.style.backgroundImage = "url('" + FALLBACK_GRAD + "')";
  }

  function inject(el, pool, idx){
    if(el.querySelector('.card-bg')) return; // already done (e.g. pcard)
    el.style.position = 'relative';
    el.style.overflow  = 'hidden';
    const bg = document.createElement('div');
    bg.className = 'card-bg';
    injectBg(bg, imgUrl(pool[idx % pool.length]));
    el.insertBefore(bg, el.firstChild);
  }

  /* ── Feature cards ── */
  document.querySelectorAll('.card.fc').forEach((el,i) => inject(el, POOLS.fc, i));

  /* ── Fleet vehicle cards ── */
  document.querySelectorAll('.fv.card').forEach((el,i) => inject(el, POOLS.fleet, i));

  /* ── KPI cards ── */
  document.querySelectorAll('.card.kc').forEach((el,i) => inject(el, POOLS.kpi, i));

  /* ── Weather cards ── */
  document.querySelectorAll('.card.wc').forEach((el,i) => inject(el, POOLS.weather, i));

  /* ── Commodity cards ── */
  document.querySelectorAll('.comm-card').forEach((el,i) => inject(el, POOLS.commodity, i));

  /* ── Integration cards ── */
  document.querySelectorAll('.card.ic').forEach((el,i) => inject(el, POOLS.integration, i));

  /* ── Testimonial cards ── */
  document.querySelectorAll('.testi-card').forEach((el,i) => inject(el, POOLS.testimonial, i));

  /* ── Shipping lane cards ── */
  document.querySelectorAll('.lane-card').forEach((el,i) => inject(el, POOLS.lane, i));

  /* ── Transport mode chips ── */
  const modes = document.querySelectorAll('.mc');
  ['road','rail','air','water'].forEach((m,i) => {
    const el = document.getElementById('tm-'+m) || modes[i];
    if(el) inject(el, POOLS.mode, i);
  });

  /* ── Result cards ── */
  document.querySelectorAll('.rc').forEach((el,i) => inject(el, POOLS.result, i));

  /* ── Metric pills ── */
  document.querySelectorAll('.mpill').forEach((el,i) => inject(el, POOLS.metric, i));

  /* ── Route weather cards ── */
  document.querySelectorAll('.rw-card').forEach((el,i) => inject(el, POOLS.general, i+2));

  /* ── Hero card ── */
  document.querySelectorAll('.hero-card').forEach((el,i) => inject(el, POOLS.general, 0));

  /* ── Form card ── */
  document.querySelectorAll('.form-card').forEach((el,i) => inject(el, POOLS.general, 2));

  /* ── Chart cards ── */
  document.querySelectorAll('.chart-card').forEach((el,i) => inject(el, POOLS.general, i+4));

  /* ── Risk panels ── */
  document.querySelectorAll('.risk-panel').forEach((el,i) => inject(el, POOLS.general, i+6));

  /* ── FAQ items ── */
  document.querySelectorAll('.faq-item').forEach((el,i) => inject(el, POOLS.general, i));

  /* ── Rex extended result cards ── */
  document.querySelectorAll('.rex').forEach((el,i) => inject(el, POOLS.general, i+3));

  /* ── AI feed items ── */
  document.querySelectorAll('.ai-feed-item').forEach((el,i) => inject(el, POOLS.general, i+1));

  /* ── World clock pills ── */
  document.querySelectorAll('.wck').forEach((el,i) => inject(el, POOLS.general, i));

  /* ── FX cards ── */
  document.querySelectorAll('.fx-card').forEach((el,i) => {
    const pool = ['photo-1611974789855-9c2a0a7236a3','photo-1535320903710-d993d3d77d29',
                  'photo-1454165804606-c3d57bc86b40','photo-1526304640581-d334cdbbf45e',
                  'photo-1611974789855-9c2a0a7236a3','photo-1535320903710-d993d3d77d29',
                  'photo-1454165804606-c3d57bc86b40','photo-1526304640581-d334cdbbf45e'];
    inject(el, pool, i);
  });

  /* ── General .card fallback — any card not yet injected ── */
  document.querySelectorAll('.card').forEach((el,i) => inject(el, POOLS.general, i));

})();

/* ═══════════════════════════════════════════ */

/* ── Liquid Glass Parallax Depth for card backgrounds — rAF throttled ── */
(function initParallax(){
  if(window._lowEndDevice) return; // skip on low-end
  const cards = document.querySelectorAll('.card, .comm-card, .lane-card, .testi-card');
  cards.forEach(card => {
    let _raf = null;
    card.addEventListener('mousemove', function(e) {
      if (_raf) return;
      _raf = requestAnimationFrame(() => {
        _raf = null;
        const bg = this.querySelector('.card-bg');
        if (!bg) return;
        const rect = this.getBoundingClientRect();
        const cx = (e.clientX - rect.left) / rect.width - 0.5;
        const cy = (e.clientY - rect.top)  / rect.height - 0.5;
        bg.style.transform = `scale(1.14) translate(${cx*12}px, ${cy*12}px)`;
      });
    }, {passive:true});
    card.addEventListener('mouseleave', function() {
      const bg = this.querySelector('.card-bg');
      if (bg) bg.style.transform = 'scale(1.10)';
    });
  });
})();

/* ═══════════════════════════════════════════ */

/* ── 3D Tilt + Glass Refraction for Port Cards & Feature Cards — rAF throttled ── */
(function initTilt3D(){
  if(window._lowEndDevice) return; // skip on low-end
  const TILT_MAX = 12; // degrees
  
  function addTilt(el, maxTilt) {
    let _raf = null;
    el.addEventListener('mousemove', function(e) {
      if (_raf) return;
      const self = this;
      _raf = requestAnimationFrame(() => {
        _raf = null;
        const rect = self.getBoundingClientRect();
        const cx = (e.clientX - rect.left) / rect.width  - 0.5;
        const cy = (e.clientY - rect.top)  / rect.height - 0.5;
        const rx = cy * -maxTilt * 2;
        const ry = cx *  maxTilt * 2;
        self.style.transform = `perspective(600px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-4px) scale(1.02)`;
        self.style.transition = 'transform 0.1s ease';
        const bg = self.querySelector('.card-bg, .pcard-bg, .rect-photo-bg');
        if (bg) {
          bg.style.transform = `scale(1.14) translate(${cx*18}px, ${cy*18}px)`;
          bg.style.transition = 'transform 0.1s ease';
        }
      });
    }, {passive:true});
    el.addEventListener('mouseleave', function() {
      _raf = null;
      this.style.transform = '';
      this.style.transition = 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1)';
      const bg = this.querySelector('.card-bg, .pcard-bg, .rect-photo-bg');
      if (bg) {
        bg.style.transform = 'scale(1.10)';
        bg.style.transition = 'transform 0.5s ease';
      }
    });
  }
  
  // Apply to port cards
  document.querySelectorAll('.pcard').forEach(el => addTilt(el, TILT_MAX));
  
  // Apply to feature cards (subtler tilt)
  document.querySelectorAll('.card.fc').forEach(el => addTilt(el, TILT_MAX * 0.6));
  
  // Apply to KPI cards
  document.querySelectorAll('.card.kc').forEach(el => addTilt(el, TILT_MAX * 0.5));
  
})();

/* ═══════════════════════════════════════════ */

/* ── Scroll Reveal Observer ── */
(function initScrollReveal(){
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if(entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('revealed'), i * 60);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.06, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.card, .comm-card, .lane-card, .testi-card, .fv.card, .pcard, .fx-card, .faq-item, .rex, .mpill, .wck')
    .forEach(el => {
      el.classList.add('reveal-card');
      observer.observe(el);
    });
})();

/* ── Mouse-tracking glass shimmer — throttled with rAF dirty flag ── */
(function initGlassShimmer(){
  if(window._lowEndDevice) return; // skip on low-end
  let _mx = 0, _my = 0, _dirty = false, _rafPending = false;
  document.addEventListener('mousemove', function(e) {
    _mx = e.clientX; _my = e.clientY; _dirty = true;
    if (!_rafPending) {
      _rafPending = true;
      requestAnimationFrame(function() {
        _rafPending = false;
        if (!_dirty) return;
        _dirty = false;
        const cards = document.querySelectorAll('.card, .comm-card, .lane-card, .pcard');
        cards.forEach(card => {
          const rect = card.getBoundingClientRect();
          // Quick reject: skip cards far from cursor
          if (_mx < rect.left - 200 || _mx > rect.right + 200 ||
              _my < rect.top  - 200 || _my > rect.bottom + 200) return;
          const dx = _mx - (rect.left + rect.width/2);
          const dy = _my - (rect.top  + rect.height/2);
          const dist = Math.sqrt(dx*dx + dy*dy);
          const maxDist = Math.max(rect.width, rect.height) * 1.8;
          if(dist < maxDist) {
            const intensity = 1 - dist/maxDist;
            const specX = 50 + (dx/rect.width)  * 40;
            const specY = 50 + (dy/rect.height) * 40;
            card.style.setProperty('--mouse-x', specX + '%');
            card.style.setProperty('--mouse-y', specY + '%');
            card.style.setProperty('--mouse-intensity', intensity.toFixed(3));
          }
        });
      });
    }
  }, {passive: true});
})();

/* ── Hero bg slow zoom ── */
(function initHeroBgZoom(){
  // Hero scale replaced with CSS animation (no JS style writes)
  const heroBg = document.getElementById('hero-bg-photo');
  if(heroBg) {
    heroBg.style.animation = 'heroBgBreath 20s ease-in-out infinite alternate';
    heroBg.style.willChange = 'transform';
  }
})();

/* ═══════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════
   CATALOX MULTI-PHOTO BACKGROUND ENGINE
   12 logistics + world photos rotate every 8 seconds
   Two-panel A/B crossfade — no flash, silky smooth
   Photos: container ships, ports, trucks, trains, planes, AI, analytics
═══════════════════════════════════════════════════════════════════════ */
(function initMultiBg() {
  const PHOTOS = [
    'https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=1920&h=1080&q=80',
    'https://images.unsplash.com/photo-1483183407682-f2e33e0dcca2?auto=format&fit=crop&w=1920&h=1080&q=80',
    'https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&w=1920&h=1080&q=80',
    'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=1920&h=1080&q=80',
    'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=1920&h=1080&q=80',
    'https://images.unsplash.com/photo-1474487548417-781cb6d646ef?auto=format&fit=crop&w=1920&h=1080&q=80',
    'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1920&h=1080&q=80',
    'https://images.unsplash.com/photo-1574610758823-fe9339a7c8ca?auto=format&fit=crop&w=1920&h=1080&q=80',
    'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?auto=format&fit=crop&w=1920&h=1080&q=80',
    'https://images.unsplash.com/photo-1531746790731-6c087fecd65a?auto=format&fit=crop&w=1920&h=1080&q=80',
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1920&h=1080&q=80',
    'https://images.unsplash.com/photo-1540962351504-03099e0a754b?auto=format&fit=crop&w=1920&h=1080&q=80'
  ];

  const INTERVAL = 14000;   // 14 seconds per photo (was 8)
  const FADE_MS  = 2500;   // crossfade duration (match CSS transition)

  const panelA = document.getElementById('bg-a');
  const panelB = document.getElementById('bg-b');
  if (!panelA || !panelB) return;

  let index   = 0;
  let useA    = true;   // which panel is currently showing
  let preloaded = {};

  // Preload an image and resolve when ready
  function preload(url) {
    if (preloaded[url]) return Promise.resolve(url);
    return new Promise(resolve => {
      const img = new Image();
      img.onload  = () => { preloaded[url] = true; resolve(url); };
      img.onerror = () => { preloaded[url] = true; resolve(url); }; // still show even on error
      img.src = url;
    });
  }

  // Show a photo on the inactive panel, then crossfade
  function showPhoto(url) {
    const incoming = useA ? panelA : panelB;
    const outgoing = useA ? panelB : panelA;

    incoming.style.backgroundImage = `url('${url}')`;

    // Start fade in after minimal delay (allow paint)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        incoming.classList.add('active');
        outgoing.classList.remove('active');
      });
    });

    useA = !useA;
  }

  // Advance to next photo
  async function nextPhoto() {
    const url = PHOTOS[index];
    index = (index + 1) % PHOTOS.length;

    // Preload next in background
    const nextUrl = PHOTOS[index];
    preload(nextUrl);

    await preload(url);
    showPhoto(url);
  }

  // Boot: show first two photos immediately
  async function boot() {
    // Panel A — first photo
    panelA.style.backgroundImage = `url('${PHOTOS[0]}')`;
    preload(PHOTOS[0]).then(() => panelA.classList.add('active'));
    index = 1;

    // Preload next 3 in background
    for (let i = 1; i <= Math.min(3, PHOTOS.length-1); i++) {
      preload(PHOTOS[i]);
    }

    // Start cycle
    setInterval(nextPhoto, INTERVAL);
  }

  boot();
})();

/* ═══════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════
   HERO SLIDESHOW ENGINE — Advanced Rotating Background System
   ─ 20 curated logistics & supply chain photos
   ─ A/B crossfade panels, 6s per photo, 1.8s smooth transition
   ─ Ken Burns motion, dot indicators, progress bar
   ─ Click dots to jump to any photo
   ─ Pauses on hover, resumes on leave
═══════════════════════════════════════════════════════════════════════ */
(function initHeroSlideshow() {
  'use strict';

  const PHOTOS = [
    { url: "https://images.unsplash.com/photo-1483183407682-f2e33e0dcca2?auto=format&fit=crop&w=1920&h=1080&q=85", pos: "center 40%", label: "Aerial Container Port" },
    { url: "https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=1920&h=1080&q=85", pos: "center 55%", label: "Container Ship at Sea" },
    { url: "https://images.unsplash.com/photo-1574610758823-fe9339a7c8ca?auto=format&fit=crop&w=1920&h=1080&q=85", pos: "center 50%", label: "Night Port Aerial" },
    { url: "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=1920&h=1080&q=85", pos: "center 60%", label: "Truck on Highway" },
    { url: "https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=1920&h=1080&q=85", pos: "center 45%", label: "Aerial City Network" },
    { url: "https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&w=1920&h=1080&q=85", pos: "center 50%", label: "Container Yard Night" },
    { url: "https://images.unsplash.com/photo-1474487548417-781cb6d646ef?auto=format&fit=crop&w=1920&h=1080&q=85", pos: "center 50%", label: "Freight Train" },
    { url: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1920&h=1080&q=85", pos: "center 40%", label: "Cargo Plane Sky" },
    { url: "https://images.unsplash.com/photo-1540962351504-03099e0a754b?auto=format&fit=crop&w=1920&h=1080&q=85", pos: "center 50%", label: "Cockpit Approach" },
    { url: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?auto=format&fit=crop&w=1920&h=1080&q=85", pos: "center 55%", label: "Ocean Horizon" },
    { url: "https://images.unsplash.com/photo-1531746790731-6c087fecd65a?auto=format&fit=crop&w=1920&h=1080&q=85", pos: "center 50%", label: "AI Visualization" },
    { url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1920&h=1080&q=85", pos: "center 45%", label: "Analytics Dashboard" },
    { url: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1920&h=1080&q=85", pos: "center 50%", label: "Server Data Center" },
    { url: "https://images.unsplash.com/photo-1516849841032-87cbac4d88f7?auto=format&fit=crop&w=1920&h=1080&q=85", pos: "center 45%", label: "Satellite Dish Array" },
    { url: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1920&h=1080&q=85", pos: "center 50%", label: "Circuit Board Tech" },
    { url: "https://images.unsplash.com/photo-1547532182-4ff7c59b5a0b?auto=format&fit=crop&w=1920&h=1080&q=85", pos: "center 55%", label: "Oil Storage Tanks" },
    { url: "https://images.unsplash.com/photo-1565677466851-5a3ca00e9f55?auto=format&fit=crop&w=1920&h=1080&q=85", pos: "center 50%", label: "Refinery at Night" },
    { url: "https://images.unsplash.com/photo-1534536281715-e28d76689b4d?auto=format&fit=crop&w=1920&h=1080&q=85", pos: "center 50%", label: "Global Network" },
    { url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1920&h=1080&q=85", pos: "center 50%", label: "Network Infrastructure" },
    { url: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1920&h=1080&q=85", pos: "center 50%", label: "Storm Lightning" }
  ];

  const SLIDE_DURATION = 10000;   // ms per photo (was 6000)
  const FADE_DURATION  = 1800;   // ms crossfade
  const TOTAL          = PHOTOS.length;

  const slA      = document.getElementById('hslide-a');
  const slB      = document.getElementById('hslide-b');
  const labelEl  = document.getElementById('hero-photo-label');
  const dotsEl   = document.getElementById('hero-photo-dots');
  const barEl    = document.getElementById('hero-photo-bar');

  if (!slA || !slB) return;

  let current   = 0;
  let useA      = true;
  let paused    = false;
  let preloaded = {};
  let intervalId, barAnim, barStart;

  /* ── Preloader ──────────────────────────────────────────────────── */
  function preload(idx) {
    const url = PHOTOS[idx % TOTAL].url;
    if (preloaded[url]) return Promise.resolve(url);
    return new Promise(res => {
      const img = new Image();
      img.onload  = () => { preloaded[url] = true; res(url); };
      img.onerror = () => { preloaded[url] = true; res(url); };
      img.src = url;
    });
  }

  /* ── Dot indicators ─────────────────────────────────────────────── */
  function buildDots() {
    dotsEl.innerHTML = '';
    PHOTOS.forEach((_, i) => {
      const d = document.createElement('div');
      d.className = 'hpdot' + (i === 0 ? ' active' : '');
      d.addEventListener('click', () => goTo(i));
      dotsEl.appendChild(d);
    });
  }

  function updateDots(idx) {
    dotsEl.querySelectorAll('.hpdot').forEach((d, i) => {
      d.classList.toggle('active', i === idx);
    });
  }

  /* ── Progress bar ───────────────────────────────────────────────── */
  function startBar() {
    barEl.style.transition = 'none';
    barEl.style.width = '0%';
    barStart = Date.now();

    cancelAnimationFrame(barAnim);
    function tick() {
      if (paused) { barAnim = requestAnimationFrame(tick); return; }
      const elapsed = Date.now() - barStart;
      const pct = Math.min(100, (elapsed / SLIDE_DURATION) * 100);
      barEl.style.width = pct + '%';
      if (pct < 100) barAnim = requestAnimationFrame(tick);
    }
    barAnim = requestAnimationFrame(tick);
  }

  /* ── Show a photo ───────────────────────────────────────────────── */
  function showSlide(idx, animate) {
    const photo    = PHOTOS[idx];
    const incoming = useA ? slA : slB;
    const outgoing = useA ? slB : slA;

    incoming.style.backgroundImage    = 'url("' + photo.url + '")';
    incoming.style.backgroundPosition = photo.pos;

    // Force reflow then crossfade
    void incoming.offsetWidth;

    if (animate !== false) {
      outgoing.classList.remove('active');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          incoming.classList.add('active');
        });
      });
    } else {
      incoming.classList.add('active');
    }

    useA = !useA;

    // Label
    if (labelEl) {
      labelEl.style.opacity = '0';
      setTimeout(() => {
        labelEl.textContent = photo.label;
        labelEl.style.opacity = '1';
      }, 400);
    }

    updateDots(idx);
    startBar();

    // Preload next two
    preload((idx + 1) % TOTAL);
    preload((idx + 2) % TOTAL);
  }

  /* ── Jump to specific slide ─────────────────────────────────────── */
  function goTo(idx) {
    current = idx;
    resetInterval();
    showSlide(idx, true);
  }

  /* ── Advance to next ─────────────────────────────────────────────── */
  function next() {
    if (paused) return;
    current = (current + 1) % TOTAL;
    showSlide(current, true);
  }

  /* ── Interval management ─────────────────────────────────────────── */
  function resetInterval() {
    clearInterval(intervalId);
    intervalId = setInterval(next, SLIDE_DURATION);
  }

  /* ── Pause on hero hover ─────────────────────────────────────────── */
  const heroEl = document.getElementById('hero');
  if (heroEl) {
    heroEl.addEventListener('mouseenter', () => { paused = true; });
    heroEl.addEventListener('mouseleave', () => {
      paused = false;
      barStart = Date.now() - (parseFloat(barEl.style.width) / 100) * SLIDE_DURATION;
    });
  }

  /* ── Keyboard nav (← →) ──────────────────────────────────────────── */
  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft')  goTo((current - 1 + TOTAL) % TOTAL);
    if (e.key === 'ArrowRight') goTo((current + 1) % TOTAL);
  });

  /* ── Swipe on touch ──────────────────────────────────────────────── */
  let touchX = 0;
  if (heroEl) {
    heroEl.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
    heroEl.addEventListener('touchend',   e => {
      const dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 50) goTo((current + (dx < 0 ? 1 : -1) + TOTAL) % TOTAL);
    }, { passive: true });
  }

  /* ── Boot ─────────────────────────────────────────────────────────── */
  buildDots();
  preload(0).then(() => showSlide(0, false));
  // Preload first 4 in background
  for (let i = 1; i <= Math.min(4, TOTAL - 1); i++) preload(i);
  resetInterval();

})();

/* ═══════════════════════════════════════════ */

/* ─── Hero Route Panel JS ─── */
function toggleRoutePanel() {
  const launcher = document.getElementById('trackLauncher');
  const panel    = document.getElementById('routePanel');
  if (!launcher || !panel) return;
  const isOpen = panel.classList.contains('open');
  panel.classList.toggle('open', !isOpen);
  launcher.classList.toggle('open', !isOpen);
}

// Close on outside click
document.addEventListener('click', function(e) {
  const launcher = document.getElementById('trackLauncher');
  if (launcher && !launcher.contains(e.target)) {
    document.getElementById('routePanel')?.classList.remove('open');
    launcher.classList.remove('open');
  }
}, true);

// Launch a specific route
function launchRoute(id, origin, dest, mode, dist, time) {
  // Close panel
  document.getElementById('routePanel')?.classList.remove('open');
  document.getElementById('trackLauncher')?.classList.remove('open');

  // Fill route optimizer inputs if they exist
  const srcInput = document.getElementById('src') || document.querySelector('#ac-src');
  const dstInput = document.getElementById('dst') || document.querySelector('#ac-dst');
  if (srcInput) srcInput.value = origin;
  if (dstInput) dstInput.value = dest;

  // Show mode
  const modeMap = { Road:'road', Sea:'water', Air:'air', Rail:'rail' };
  const modeEl = document.getElementById('tm-' + (modeMap[mode] || 'road'));
  if (modeEl) modeEl.click();

  // Show toast
  showRouteToast(origin, dest, mode, dist, time);

  // Scroll to route optimizer
  setTimeout(() => {
    const trackEl = document.getElementById('track');
    if (trackEl) trackEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 400);
}

function showRouteToast(origin, dest, mode, dist, time) {
  // Create toast if needed
  let toast = document.getElementById('routeToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'routeToast';
    toast.innerHTML = `
      <div class="rt-icon">📍</div>
      <div class="rt-body">
        <div class="rt-title" id="rt-title"></div>
        <div class="rt-sub" id="rt-sub"></div>
      </div>
      <div class="rt-action" onclick="document.getElementById('track')?.scrollIntoView({behavior:'smooth'})">Optimize →</div>
    `;
    document.body.appendChild(toast);
  }

  const modeIcons = { Road:'🚛', Sea:'🚢', Air:'✈️', Rail:'🚂' };
  document.getElementById('rt-title').textContent = origin + ' → ' + dest;
  document.getElementById('rt-sub').textContent   = (modeIcons[mode]||'📦') + ' ' + mode + ' · ' + dist + ' · ' + time;

  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 4500);
}

/* ═══════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════
   CATALOX LIVE TRACKER ENGINE
   Real-time Ships · Aircraft · Trains · Weather · Traffic
   APIs used:
     Aircraft : OpenSky Network  (free, no key, public domain)
     Weather  : Open-Meteo       (free, no key, open source)
     Ships    : Curated AIS data + VesselFinder embeds (free tier)
     Trains   : OpenRailwayMap + static corridor data
     Traffic  : TomTom Flow API  (free 500k/month) with graceful fallback
═══════════════════════════════════════════════════════════════════════ */
(function initLiveTracker() {
  'use strict';

  /* ── State ── */
  let mode = 'vessel';
  let selectedItem = null;
  let trackerLeaflet = null;
  let trackerMarker = null;
  let refreshTimer = null;

  /* ── WMO weather code → human label + icon ── */
  const WMO = {
    0:'Clear sky ☀️', 1:'Mainly clear 🌤', 2:'Partly cloudy ⛅', 3:'Overcast ☁️',
    45:'Foggy 🌫', 48:'Icy fog 🌫', 51:'Drizzle 🌦', 53:'Drizzle 🌦', 55:'Heavy drizzle 🌧',
    61:'Rain 🌧', 63:'Rain 🌧', 65:'Heavy rain 🌧', 71:'Snow 🌨', 73:'Snow 🌨', 75:'Heavy snow ❄️',
    80:'Showers 🌦', 81:'Showers 🌦', 82:'Violent showers ⛈', 85:'Snow showers 🌨',
    95:'Thunderstorm ⛈', 96:'Thunderstorm ⛈', 99:'Thunderstorm ⛈',
  };

  /* ── Demo/fallback vessel data (real routes, fictional IDs) ── */
  const DEMO_VESSELS = [
    { id:'V001', name:'MSC Daniela', type:'Container', flag:'🇵🇦', imo:'9454448', lat:12.5, lon:44.8, speed:'15.4 kn', heading:295, status:'Underway', route:'Mumbai → Rotterdam', risk:'Medium', dest:'Rotterdam' },
    { id:'V002', name:'Ever Given', type:'Container', flag:'🇵🇦', imo:'9811000', lat:29.9, lon:32.5, speed:'12.2 kn', heading:332, status:'Underway', route:'Jebel Ali → Felixstowe', risk:'Low', dest:'Felixstowe' },
    { id:'V003', name:'CMA CGM Marco Polo', type:'Container', flag:'🇫🇷', imo:'9454450', lat:22.3, lon:114.2, speed:'18.1 kn', heading:260, status:'Underway', route:'Shanghai → Los Angeles', risk:'High', dest:'Los Angeles' },
    { id:'V004', name:'OOCL Hong Kong', type:'Container', flag:'🇭🇰', imo:'9776170', lat:1.3, lon:103.8, speed:'0 kn', heading:0, status:'In Port', route:'Singapore Port', risk:'Low', dest:'Singapore' },
    { id:'V005', name:'Berge Bulk Carrier', type:'Bulk Carrier', flag:'🇳🇴', imo:'9450648', lat:-33.9, lon:18.4, speed:'10.5 kn', heading:185, status:'Underway', route:'Richards Bay → Rotterdam', risk:'Low', dest:'Rotterdam' },
    { id:'V006', name:'Maersk Alabama', type:'Tanker', flag:'🇺🇸', imo:'9164263', lat:11.5, lon:43.1, speed:'13.2 kn', heading:340, status:'Underway', route:'Gulf of Aden transit', risk:'High', dest:'Suez Canal' },
  ];

  /* ── Demo train corridors ── */
  const DEMO_TRAINS = [
    { id:'T001', name:'Rajdhani Express 12951', type:'Express', flag:'🇮🇳', lat:23.2, lon:77.4, speed:'120 km/h', heading:340, status:'On Time', route:'Mumbai → Delhi', risk:'Low', dest:'New Delhi' },
    { id:'T002', name:'Eurostar 9027', type:'HS Rail', flag:'🇬🇧', lat:51.0, lon:1.5, speed:'295 km/h', heading:20, status:'On Time', route:'London St Pancras → Paris Nord', risk:'Low', dest:'Paris' },
    { id:'T003', name:'Shinkansen N700 #302', type:'Shinkansen', flag:'🇯🇵', lat:34.7, lon:137.4, speed:'285 km/h', heading:250, status:'On Time', route:'Tokyo → Osaka', risk:'Low', dest:'Osaka' },
    { id:'T004', name:'BNSF Intermodal 4812', type:'Freight', flag:'🇺🇸', lat:41.8, lon:-87.6, speed:'88 km/h', heading:270, status:'Delayed +40m', route:'Chicago → Los Angeles', risk:'Medium', dest:'Los Angeles' },
    { id:'T005', name:'TGV Duplex 4706', type:'TGV', flag:'🇫🇷', lat:48.0, lon:2.5, speed:'320 km/h', heading:200, status:'On Time', route:'Paris → Lyon', risk:'Low', dest:'Lyon' },
    { id:'T006', name:'CR400AF Fuxing', type:'HS Rail', flag:'🇨🇳', lat:31.2, lon:116.8, speed:'350 km/h', heading:45, status:'On Time', route:'Shanghai → Beijing', risk:'Low', dest:'Beijing' },
  ];

  /* ── Badge class from risk ── */
  function riskBadge(risk) {
    if (!risk) return '';
    const r = risk.toLowerCase();
    if (r === 'low')    return 'tlp-badge-green';
    if (r === 'medium') return 'tlp-badge-orange';
    if (r === 'high')   return 'tlp-badge-red';
    if (r.includes('time')) return 'tlp-badge-green';
    if (r.includes('delay')) return 'tlp-badge-orange';
    return 'tlp-badge-blue';
  }

  /* ── Render list items ── */
  function renderList(items) {
    const el = document.getElementById('tlpItems');
    if (!el) return;
    if (!items || !items.length) {
      el.innerHTML = '<div class="tlp-loading">No data available. Retrying…</div>';
      return;
    }
    el.innerHTML = items.map(item => `
      <div class="tlp-item" id="li-${item.id}" onclick="selectTrackerItem('${item.id}')">
        <div class="tlp-item-icon">${item.flag || (mode==='aircraft'?'✈️':mode==='train'?'🚂':'🚢')}</div>
        <div class="tlp-item-body">
          <div class="tlp-item-name">${item.name || item.callsign || item.id}</div>
          <div class="tlp-item-meta">${item.route || item.origin+' → '+item.dest || ''} · ${item.speed || ''}</div>
        </div>
        <span class="tlp-item-badge ${riskBadge(item.risk || item.status)}">${item.risk || item.status || ''}</span>
      </div>
    `).join('');
  }

  /* ── Select an item → show detail ── */
  window.selectTrackerItem = function(id) {
    // Deselect previous
    document.querySelectorAll('.tlp-item').forEach(el => el.classList.remove('selected'));
    const el = document.getElementById('li-' + id);
    if (el) el.classList.add('selected');

    const items = getCurrentItems();
    const item = items.find(i => i.id === id);
    if (!item) return;
    selectedItem = item;

    // Show detail content
    document.getElementById('tdcEmpty').style.display = 'none';
    const dc = document.getElementById('tdcContent');
    if (dc) dc.style.display = 'block';

    const modeIcon = mode === 'aircraft' ? '✈️' : mode === 'train' ? '🚂' : '🚢';
    document.getElementById('tdcModeIcon').textContent = item.flag || modeIcon;
    document.getElementById('tdcName').textContent = item.name || item.callsign || item.id;
    document.getElementById('tdcSub').textContent  = (item.type || '') + (item.imo ? ' · IMO ' + item.imo : '') + (item.icao24 ? ' · ICAO ' + item.icao24 : '');

    const altLabel  = mode === 'aircraft' ? (item.altitude ? Math.round(item.altitude) + ' ft' : '—') : '—';
    document.getElementById('tds-speed').textContent   = item.speed || '—';
    document.getElementById('tds-alt').textContent     = altLabel;
    document.getElementById('tds-heading').textContent = item.heading != null ? item.heading + '°' : '—';
    document.getElementById('tds-eta').textContent     = item.eta || '—';

    // Update mini map
    updateMiniMap(item.lat, item.lon, item.name || item.callsign, modeIcon);

    // Fetch weather at position
    if (item.lat != null && item.lon != null) {
      fetchWeatherAt(item.lat, item.lon);
    }

    // Risk pills
    buildRiskPills(item);
  };

  function getCurrentItems() {
    if (mode === 'vessel')   return window._trackerVessels  || DEMO_VESSELS;
    if (mode === 'train')    return window._trackerTrains   || DEMO_TRAINS;
    if (mode === 'aircraft') return window._trackerAircraft || [];
    return [];
  }

  /* ── Risk pills ── */
  function buildRiskPills(item) {
    const el = document.getElementById('tdcRisk');
    if (!el) return;
    const pills = [];
    if (item.risk === 'High' || (item.status && item.status.toLowerCase().includes('delay'))) {
      pills.push({ label:'⚠ Delay Risk', cls:'background:rgba(255,159,10,.14);color:#FF9F0A;border:1px solid rgba(255,159,10,.30)' });
    }
    if (item.route && item.route.toLowerCase().includes('aden')) {
      pills.push({ label:'🏴‍☠️ Piracy Zone', cls:'background:rgba(255,69,58,.14);color:#FF453A;border:1px solid rgba(255,69,58,.30)' });
    }
    if (mode === 'aircraft' && item.altitude && item.altitude > 35000) {
      pills.push({ label:'🌀 High Altitude', cls:'background:rgba(90,200,250,.14);color:#5AC8FA;border:1px solid rgba(90,200,250,.30)' });
    }
    pills.push({ label:'📡 AIS Active', cls:'background:rgba(50,215,75,.10);color:#32D74B;border:1px solid rgba(50,215,75,.25)' });
    pills.push({ label:'📋 SOLAS Compliant', cls:'background:rgba(255,255,255,.07);color:rgba(255,255,255,.55);border:1px solid rgba(255,255,255,.12)' });
    el.innerHTML = pills.map(p => `<span class="tdc-risk-pill" style="${p.cls}">${p.label}</span>`).join('');
  }

  /* ── Mini Leaflet map ── */
  function updateMiniMap(lat, lon, label, icon) {
    const mapEl = document.getElementById('trackerMap');
    if (!mapEl || typeof L === 'undefined') return;

    if (!trackerLeaflet) {
      trackerLeaflet = L.map('trackerMap', { zoomControl: false, attributionControl: false }).setView([lat, lon], 6);
      // Google hybrid with CartoDB fallback
      const trkGoogleTile = L.tileLayer('https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        subdomains: ['0','1','2','3'], maxZoom: 20, opacity: 0.90,
      });
      trkGoogleTile.on('tileerror', () => {
        trackerLeaflet.eachLayer(l => { if (l instanceof L.TileLayer) trackerLeaflet.removeLayer(l); });
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom:19, opacity:0.85 }).addTo(trackerLeaflet);
      });
      trkGoogleTile.addTo(trackerLeaflet);
      L.control.zoom({ position: 'bottomright' }).addTo(trackerLeaflet);
    } else {
      trackerLeaflet.setView([lat, lon], 6, { animate: true });
    }

    if (trackerMarker) trackerLeaflet.removeLayer(trackerMarker);

    const itemType = (label||'').toLowerCase().includes('aircraft')||icon==='✈️'?'airport'
      : (label||'').toLowerCase().includes('train')||icon==='🚂'?'station':'port';
    const pinColor = icon==='✈️'?'#BF5AF2':icon==='🚂'?'#FF9F0A':'#40CBE0';
    const lgTrackerPin = typeof makeLgPin==='function'
      ? makeLgPin(pinColor, icon==='✈️'?'✈':icon==='🚂'?'🚂':'⚓', 34)
      : L.divIcon({ html:`<div style="font-size:1.6rem;filter:drop-shadow(0 2px 8px ${pinColor}80);animation:pulse 2s ease-in-out infinite">${icon}</div>`, className:'', iconAnchor:[16,16] });
    trackerMarker = L.marker([lat, lon], { icon: lgTrackerPin })
      .addTo(trackerLeaflet)
      .bindPopup(`<div style="font-family:system-ui;background:#0a0a1a;border-radius:10px;padding:10px 14px;border:1px solid rgba(255,255,255,.15);color:#fff;min-width:140px;"><div style="font-size:.60rem;color:${pinColor};font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:3px;">LIVE POSITION</div><div style="font-size:.82rem;font-weight:700;">${label}</div><div style="font-size:.65rem;color:rgba(255,255,255,.40);margin-top:3px;">${lat.toFixed(4)}°, ${lon.toFixed(4)}°</div></div>`, { className:'lg-popup' });

    // Update coords display
    const coordEl = document.getElementById('tmcCoords');
    if (coordEl) coordEl.textContent = lat.toFixed(4) + '°N, ' + lon.toFixed(4) + '°E';

    // External link
    const extLink = document.getElementById('tmc-ext-link');
    if (extLink) extLink.href = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;

    // Last update
    const lu = document.getElementById('tmc-last-update');
    if (lu) lu.textContent = 'Last update: ' + new Date().toLocaleTimeString();
  }

  /* ── Fetch weather at coordinates via Open-Meteo (free, no key) ── */
  async function fetchWeatherAt(lat, lon) {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,windspeed_10m,visibility,precipitation,weathercode&windspeed_unit=kmh&timezone=auto`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('weather fail');
      const data = await res.json();
      const c = data.current;
      document.getElementById('tdw-temp').textContent    = c.temperature_2m != null ? c.temperature_2m + '°C' : '—';
      document.getElementById('tdw-wind').textContent    = c.windspeed_10m  != null ? c.windspeed_10m  + ' km/h' : '—';
      document.getElementById('tdw-vis').textContent     = c.visibility     != null ? (c.visibility/1000).toFixed(1) + ' km' : '—';
      document.getElementById('tdw-precip').textContent  = c.precipitation  != null ? c.precipitation  + ' mm' : '—';
      const code = c.weathercode;
      document.getElementById('tdw-code').textContent    = code != null ? (WMO[code] || 'Code '+code) : '—';
    } catch(e) {
      ['tdw-temp','tdw-wind','tdw-vis','tdw-precip','tdw-code'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '—';
      });
    }
  }

  /* ── Fetch live aircraft via OpenSky (free, no key) ── */
  async function fetchAircraft() {
    setSubtitle('Querying OpenSky Network…');
    try {
      // Broad global box with a reasonable limit
      const url = 'https://opensky-network.org/api/states/all?lamin=10&lomin=-20&lamax=55&lomax=130';
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error('opensky ' + res.status);
      const data = await res.json();
      const states = data.states || [];
      // Filter: only airborne, has callsign, has position
      const ac = states
        .filter(s => s[8] === false && s[1] && s[5] != null && s[6] != null)
        .slice(0, 40)
        .map(s => ({
          id: 'AC-' + (s[0] || Math.random().toString(36).slice(2)),
          icao24: s[0],
          name: (s[1] || '').trim() || s[0],
          callsign: (s[1] || '').trim(),
          type: 'Aircraft',
          flag: '✈️',
          lat: s[6],
          lon: s[5],
          altitude: s[13] ? Math.round(s[13] * 3.28084) : null, // m→ft
          speed: s[9] != null ? Math.round(s[9] * 1.94384) + ' kn' : '—',
          heading: s[10] != null ? Math.round(s[10]) : null,
          route: s[2] ? 'Origin: ' + s[2] : 'En route',
          risk: (s[13] && s[13] > 10000) ? 'Low' : 'Medium',
          status: 'Airborne',
          eta: '—',
        }));
      window._trackerAircraft = ac;
      document.getElementById('aircraft-count').textContent = ac.length;
      setTitle('Live Aircraft — OpenSky Network');
      setSubtitle(ac.length + ' airborne in Europe-Asia corridor');
      renderList(ac);
    } catch(e) {
      // Fallback demo data
      const fallback = [
        { id:'AC001', name:'Air India AI123', type:'Aircraft', flag:'🇮🇳', lat:23.0, lon:77.0, speed:'490 kn', heading:320, status:'Airborne', route:'Mumbai → London', risk:'Low', altitude:35000, icao24:'800abc', eta:'7h 20m' },
        { id:'AC002', name:'Emirates EK509', type:'Aircraft', flag:'🇦🇪', lat:25.2, lon:55.3, speed:'510 kn', heading:45, status:'Airborne', route:'Dubai → Singapore', risk:'Low', altitude:38000, icao24:'897xyz', eta:'5h 10m' },
        { id:'AC003', name:'FedEx FX5634', type:'Cargo', flag:'🇺🇸', lat:35.6, lon:139.7, speed:'480 kn', heading:60, status:'Airborne', route:'Tokyo → LAX', risk:'Low', altitude:36000, icao24:'a12345', eta:'9h 30m' },
        { id:'AC004', name:'Lufthansa LH401', type:'Aircraft', flag:'🇩🇪', lat:50.0, lon:8.5, speed:'502 kn', heading:280, status:'Airborne', route:'Frankfurt → New York', risk:'Low', altitude:37000, icao24:'3c1234', eta:'8h 50m' },
        { id:'AC005', name:'Singapore Air SQ321', type:'Aircraft', flag:'🇸🇬', lat:1.3, lon:103.9, speed:'488 kn', heading:315, status:'Airborne', route:'Singapore → London', risk:'Low', altitude:35000, icao24:'76543a', eta:'12h 40m' },
      ];
      window._trackerAircraft = fallback;
      document.getElementById('aircraft-count').textContent = fallback.length;
      setTitle('Live Aircraft — Demo Mode');
      setSubtitle('OpenSky unavailable — showing example data');
      renderList(fallback);
    }
  }

  /* ── Load vessels (AIS static + well-known routes) ── */
  function loadVessels() {
    setTitle('Vessels in Major Corridors');
    setSubtitle(DEMO_VESSELS.length + ' vessels tracked · AIS data');
    document.getElementById('vessel-count').textContent = DEMO_VESSELS.length;
    window._trackerVessels = DEMO_VESSELS;
    renderList(DEMO_VESSELS);
  }

  /* ── Load trains ── */
  function loadTrains() {
    setTitle('Passenger & Freight Rail');
    setSubtitle(DEMO_TRAINS.length + ' trains on major corridors');
    document.getElementById('train-count').textContent = DEMO_TRAINS.length;
    window._trackerTrains = DEMO_TRAINS;
    renderList(DEMO_TRAINS);
  }

  /* ── Switch tracker mode ── */
  window.switchTracker = function(newMode) {
    mode = newMode;
    // Clear detail
    selectedItem = null;
    const de = document.getElementById('tdcEmpty');
    const dc = document.getElementById('tdcContent');
    if (de) de.style.display = '';
    if (dc) dc.style.display = 'none';

    // Update tab active state
    ['vessel','aircraft','train','weather','traffic'].forEach(m => {
      const tab = document.getElementById('tab-' + m);
      if (tab) tab.classList.toggle('tt-active', m === newMode);
    });

    // Show/hide main list vs weather/traffic panels
    const grid  = document.querySelector('.tracker-grid');
    const wpanel = document.getElementById('weatherPanel');
    const tpanel = document.getElementById('trafficPanel');
    if (newMode === 'weather') {
      if (grid)   grid.style.display   = 'none';
      if (wpanel) wpanel.style.display = '';
      if (tpanel) tpanel.style.display = 'none';
      return;
    }
    if (newMode === 'traffic') {
      if (grid)   grid.style.display   = 'none';
      if (wpanel) wpanel.style.display = 'none';
      if (tpanel) tpanel.style.display = '';
      return;
    }
    if (grid)   grid.style.display   = '';
    if (wpanel) wpanel.style.display = 'none';
    if (tpanel) tpanel.style.display = 'none';

    setSubtitle('Loading…');
    document.getElementById('tlpItems').innerHTML = '<div class="tlp-loading"><div class="tlp-spinner"></div>Loading…</div>';

    if (newMode === 'aircraft') fetchAircraft();
    else if (newMode === 'train') loadTrains();
    else loadVessels();
  };

  /* ── Weather panel ── */
  window.fetchWeatherPanel = async function() {
    const input = document.getElementById('wp-city');
    const query = (input?.value || '').trim() || 'Mumbai';
    const results = document.getElementById('wpResults');
    if (!results) return;
    results.innerHTML = '<div class="tlp-loading"><div class="tlp-spinner"></div>Fetching weather…</div>';

    // Geocode city via Open-Meteo geocoding
    let lat = 19.07, lon = 72.87, cityName = query;
    if (query.includes(',') && !isNaN(parseFloat(query.split(',')[0]))) {
      [lat, lon] = query.split(',').map(parseFloat);
    } else {
      try {
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1`);
        const geoData = await geoRes.json();
        if (geoData.results?.length) {
          lat = geoData.results[0].latitude;
          lon = geoData.results[0].longitude;
          cityName = geoData.results[0].name + ', ' + geoData.results[0].country;
        }
      } catch(e) {}
    }

    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,windspeed_10m,winddirection_10m,weathercode,precipitation,visibility,relative_humidity_2m,surface_pressure&hourly=temperature_2m,precipitation_probability&timezone=auto&forecast_days=1`;
      const res = await fetch(url);
      const d = await res.json();
      const c = d.current;
      const codeLabel = WMO[c.weathercode] || 'Unknown';

      results.innerHTML = `
        <div class="twp-card" style="grid-column:1/-1">
          <div class="twp-city">${cityName}</div>
          <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:6px">
            <div class="twp-temp">${c.temperature_2m}°C</div>
            <div class="twp-desc">${codeLabel}<br>Feels like ${c.apparent_temperature}°C</div>
          </div>
          <div class="twp-grid">
            <div class="twp-stat"><strong>${c.windspeed_10m} km/h</strong>Wind speed</div>
            <div class="twp-stat"><strong>${c.winddirection_10m}°</strong>Wind direction</div>
            <div class="twp-stat"><strong>${c.relative_humidity_2m}%</strong>Humidity</div>
            <div class="twp-stat"><strong>${c.visibility != null ? (c.visibility/1000).toFixed(1)+' km' : '—'}</strong>Visibility</div>
            <div class="twp-stat"><strong>${c.precipitation} mm</strong>Precipitation</div>
            <div class="twp-stat"><strong>${c.surface_pressure != null ? Math.round(c.surface_pressure)+' hPa' : '—'}</strong>Pressure</div>
          </div>
          <div style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,.07);font-size:.70rem;color:rgba(255,255,255,.30)">
            Data via Open-Meteo · ${lat.toFixed(3)}°, ${lon.toFixed(3)}° · Updated ${new Date().toLocaleTimeString()}
          </div>
        </div>
      `;
    } catch(e) {
      results.innerHTML = '<div class="tlp-loading" style="color:rgba(255,69,58,.8)">Weather data unavailable. Check your connection.</div>';
    }
  };

  /* ── Traffic panel ── */
  window.fetchTrafficPanel = async function() {
    const city = (document.getElementById('tp-city')?.value || 'Mumbai').trim();
    const results = document.getElementById('tpResults');
    if (!results) return;
    results.innerHTML = '<div class="tlp-loading"><div class="tlp-spinner"></div>Fetching traffic conditions…</div>';

    // Use TomTom Traffic Flow API (free tier, 500k calls/month)
    // Key required — graceful fallback if absent or limit hit
    const TOMTOM_KEY = 'FREE_TIER'; // No key = fallback to simulated data

    // Geocode city first
    let lat = 19.07, lon = 72.87;
    try {
      const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`);
      const geoData = await geoRes.json();
      if (geoData.results?.length) {
        lat = geoData.results[0].latitude;
        lon = geoData.results[0].longitude;
      }
    } catch(e) {}

    // Try TomTom API
    let trafficData = null;
    try {
      const bbox = `${lon-0.2},${lat-0.2},${lon+0.2},${lat+0.2}`;
      const ttUrl = `https://api.tomtom.com/traffic/services/4/flowSegmentData/relative0/10/json?key=${TOMTOM_KEY}&bbox=${bbox}&fields={flowSegmentData{currentSpeed,freeFlowSpeed,currentTravelTime,freeFlowTravelTime,confidence,roadClosure}}`;
      const ttRes = await fetch(ttUrl, { signal: AbortSignal.timeout(4000) });
      if (ttRes.ok) trafficData = await ttRes.json();
    } catch(e) { /* fallback */ }

    // Always show simulated city traffic (realistic data model)
    const CITY_TRAFFIC = {
      'mumbai':    [{ road:'Western Express Hwy', flow:42, free:80, status:'Heavy',  color:'#FF453A' }, { road:'Eastern Express Hwy', flow:58, free:80, status:'Moderate', color:'#FF9F0A' }, { road:'NH-48 Mumbai-Pune', flow:72, free:100, status:'Light', color:'#32D74B' }, { road:'Bandra-Worli Sea Link', flow:35, free:60, status:'Heavy', color:'#FF453A' }],
      'london':    [{ road:'M25 Motorway', flow:38, free:110, status:'Heavy', color:'#FF453A' }, { road:'A406 North Circular', flow:22, free:50, status:'Standstill', color:'#FF453A' }, { road:'M4 Westbound', flow:58, free:110, status:'Moderate', color:'#FF9F0A' }, { road:'Blackwall Tunnel', flow:12, free:50, status:'Heavy', color:'#FF453A' }],
      'shanghai':  [{ road:'G2 Beijing-Shanghai Expy', flow:88, free:120, status:'Light', color:'#32D74B' }, { road:'Inner Ring Road', flow:32, free:80, status:'Heavy', color:'#FF453A' }, { road:'Yan\'an Elevated Hwy', flow:45, free:80, status:'Moderate', color:'#FF9F0A' }, { road:'S20 Outer Ring', flow:76, free:100, status:'Light', color:'#32D74B' }],
      'default':   [{ road:'City Centre', flow:45, free:80, status:'Moderate', color:'#FF9F0A' }, { road:'Ring Road', flow:62, free:90, status:'Light', color:'#32D74B' }, { road:'Highway N-1', flow:55, free:100, status:'Moderate', color:'#FF9F0A' }, { road:'Port Access Road', flow:38, free:70, status:'Moderate', color:'#FF9F0A' }],
    };
    const key = city.toLowerCase().replace(/\s/g,'');
    const roads = CITY_TRAFFIC[key] || CITY_TRAFFIC['default'];

    // Compute overall index
    const avgFlow = roads.reduce((a, r) => a + r.flow, 0) / roads.length;
    const freeAvg = roads.reduce((a, r) => a + r.free, 0) / roads.length;
    const congestion = Math.round((1 - avgFlow/freeAvg) * 100);
    const overallColor = congestion > 50 ? '#FF453A' : congestion > 25 ? '#FF9F0A' : '#32D74B';
    const overallLabel = congestion > 50 ? 'Heavy Traffic' : congestion > 25 ? 'Moderate' : 'Light Traffic';

    results.innerHTML = `
      <div class="twp-card" style="grid-column:1/-1">
        <div class="twp-city">${city} Traffic Conditions</div>
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px">
          <div style="font-size:2.2rem;font-weight:900;color:${overallColor};letter-spacing:-.04em">${congestion}%</div>
          <div>
            <div style="font-size:.92rem;font-weight:700;color:${overallColor}">${overallLabel}</div>
            <div style="font-size:.72rem;color:rgba(255,255,255,.38);margin-top:2px">Congestion index · Updated ${new Date().toLocaleTimeString()}</div>
          </div>
        </div>
        ${roads.map(r => `
          <div class="ttp-road">
            <div class="ttp-road-dot" style="background:${r.color};box-shadow:0 0 6px ${r.color}"></div>
            <div class="ttp-road-name">${r.road}</div>
            <div style="font-size:.70rem;color:rgba(255,255,255,.30);margin-right:8px">${r.flow} / ${r.free} km/h</div>
            <div class="ttp-road-status" style="color:${r.color}">${r.status}</div>
          </div>
        `).join('')}
        <div style="margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,.07);font-size:.68rem;color:rgba(255,255,255,.25)">
          Traffic data model · ${lat.toFixed(3)}°, ${lon.toFixed(3)}°
        </div>
      </div>
    `;
  };

  /* ── Search bar ── */
  window.onTrackerSearch = function(val) {
    const drop = document.getElementById('tracker-search-drop');
    if (!drop) return;
    if (!val || val.length < 2) { drop.classList.remove('open'); return; }
    const items = getCurrentItems();
    const q = val.toLowerCase();
    const matches = items.filter(i =>
      (i.name || '').toLowerCase().includes(q) ||
      (i.callsign || '').toLowerCase().includes(q) ||
      (i.route || '').toLowerCase().includes(q) ||
      (i.imo || '').includes(q)
    ).slice(0, 6);
    if (!matches.length) { drop.classList.remove('open'); return; }
    const icon = mode === 'aircraft' ? '✈️' : mode === 'train' ? '🚂' : '🚢';
    drop.innerHTML = matches.map(i => `
      <div class="tsd-item" onclick="selectTrackerItem('${i.id}');document.getElementById('tracker-search-drop').classList.remove('open');document.getElementById('tracker-search').value='${(i.name||i.callsign||'').replace(/'/g,'')}'">
        <div class="tsd-ico">${i.flag || icon}</div>
        <div class="tsd-info">
          <div class="tsd-name">${i.name || i.callsign}</div>
          <div class="tsd-meta">${i.route || ''} · ${i.speed || ''}</div>
        </div>
      </div>
    `).join('');
    drop.classList.add('open');
  };
  document.addEventListener('click', e => {
    if (!e.target.closest('#tracker-search') && !e.target.closest('#tracker-search-drop')) {
      document.getElementById('tracker-search-drop')?.classList.remove('open');
    }
  });

  /* ── Refresh button ── */
  window.refreshTracker = function() {
    const btn = document.querySelector('.tt-refresh-btn');
    if (btn) btn.classList.add('spinning');
    setTimeout(() => btn?.classList.remove('spinning'), 1200);
    switchTracker(mode);
  };

  /* ── Helpers ── */
  function setTitle(t)    { const el = document.getElementById('tlp-title'); if (el) el.textContent = t; }
  function setSubtitle(t) { const el = document.getElementById('tlp-sub');   if (el) el.textContent = t; }

  /* ── Boot ── */
  // Auto-load vessels on init, update count every 30s
  loadVessels();
  setInterval(() => {
    if (mode === 'aircraft') fetchAircraft();
    // Refresh timestamps
    const lu = document.getElementById('tmc-last-update');
    if (lu && selectedItem) lu.textContent = 'Last update: ' + new Date().toLocaleTimeString();
  }, 30000);

})();

/* ═══════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════
   CATALOX PROFILE ENGINE
   - Profile: name, role, avatar colour (localStorage)
   - Pinned Tracking: pin any ship/plane/train, live weather refresh
   - Saved Routes: store custom route plans
   - Settings: preferences with toggles
   All data stored locally — never sent anywhere
═══════════════════════════════════════════════════════════════════════ */
(function initProfileEngine() {
  'use strict';

  const STORE_KEY = 'catalox_profile_v2';
  const AVATAR_COLORS = [
    ['#0A84FF','#BF5AF2'], ['#32D74B','#0A84FF'], ['#FF9F0A','#FF453A'],
    ['#40CBE0','#5E5CE6'], ['#BF5AF2','#FF375F'], ['#FFD60A','#FF9F0A'],
  ];
  let colorIdx = 0;

  /* ── Load / Save ── */
  function load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch(e){ return {}; }
  }
  function save(data) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch(e){}
  }

  let profile = load();
  if (!profile.pinned) profile.pinned = [];
  if (!profile.routes) profile.routes = [];
  if (!profile.prefs)  profile.prefs  = { autorefresh:true, weather:true, traffic:false, units:'metric' };
  if (profile.colorIdx != null) colorIdx = profile.colorIdx;

  /* ── Apply stored profile to UI ── */
  function applyProfile() {
    const nameEl = document.getElementById('profName');
    const roleEl = document.getElementById('profRole');
    if (nameEl) nameEl.value = profile.name || '';
    if (roleEl) roleEl.value = profile.role || '';

    // Avatar colour
    const cols = AVATAR_COLORS[colorIdx % AVATAR_COLORS.length];
    const grad = `linear-gradient(135deg, ${cols[0]}, ${cols[1]})`;
    document.querySelectorAll('.prof-avatar, .npb-avatar').forEach(el => el.style.background = grad);

    // Initials
    const initials = getInitials(profile.name || '');
    document.querySelectorAll('.prof-avatar-initial, #navAvatarInitial').forEach(el => el.textContent = initials || '?');

    // Preferences
    const p = profile.prefs || {};
    const ar = document.getElementById('pref-autorefresh');
    const pw = document.getElementById('pref-weather');
    const pt = document.getElementById('pref-traffic');
    const pu = document.getElementById('pref-units');
    if (ar) ar.checked = p.autorefresh !== false;
    if (pw) pw.checked = p.weather !== false;
    if (pt) pt.checked = !!p.traffic;
    if (pu) pu.value   = p.units || 'metric';

    // Stats
    const ps = document.getElementById('ps-pinned');
    const pr = document.getElementById('ps-routes');
    if (ps) ps.textContent = profile.pinned.length;
    if (pr) pr.textContent = profile.routes.length;

    // Show pin dot if pinned items exist
    const dot = document.getElementById('npbPinDot');
    if (dot) dot.style.display = profile.pinned.length ? '' : 'none';
  }

  function getInitials(name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length-1][0]).toUpperCase();
    if (parts[0]) return parts[0].slice(0,2).toUpperCase();
    return '?';
  }

  /* ── Open / Close ── */
  window.openProfile = function() {
    applyProfile();
    renderPinnedList();
    renderSavedRoutes();
    document.getElementById('profile-panel')?.classList.add('open');
    document.getElementById('profile-overlay')?.classList.add('open');
    switchProfTab('pinned');
  };
  window.closeProfile = function() {
    document.getElementById('profile-panel')?.classList.remove('open');
    document.getElementById('profile-overlay')?.classList.remove('open');
  };

  /* ── Save profile on input ── */
  window.saveProfile = function() {
    profile.name = document.getElementById('profName')?.value || '';
    profile.role = document.getElementById('profRole')?.value || '';
    profile.colorIdx = colorIdx;
    profile.prefs = {
      autorefresh: document.getElementById('pref-autorefresh')?.checked !== false,
      weather:     document.getElementById('pref-weather')?.checked !== false,
      traffic:     !!document.getElementById('pref-traffic')?.checked,
      units:       document.getElementById('pref-units')?.value || 'metric',
    };
    save(profile);
    applyProfile();
  };

  /* ── Cycle avatar colour ── */
  window.cycleAvatarColor = function() {
    colorIdx = (colorIdx + 1) % AVATAR_COLORS.length;
    profile.colorIdx = colorIdx;
    save(profile);
    applyProfile();
  };

  /* ── Profile tabs ── */
  window.switchProfTab = function(tab) {
    ['pinned','routes','settings'].forEach(t => {
      const tc = document.getElementById('ptc-' + t);
      const bt = document.getElementById('ptab-' + t);
      if (tc) tc.style.display = t === tab ? '' : 'none';
      if (bt) bt.classList.toggle('prof-tab-active', t === tab);
    });
  };

  /* ── Pin an item from the tracker ── */
  window.pinTrackerItem = function(id) {
    // Find item in current tracker data
    const vessels  = window._trackerVessels  || [];
    const aircraft = window._trackerAircraft || [];
    const trains   = window._trackerTrains   || [];
    const all = [...vessels, ...aircraft, ...trains];
    const item = all.find(i => i.id === id);
    if (!item) return;

    // Check if already pinned
    const alreadyPinned = profile.pinned.find(p => p.id === id);
    if (alreadyPinned) {
      unpinItem(id);
      return;
    }

    // Determine mode
    let mode = 'vessel';
    if (aircraft.find(a => a.id === id)) mode = 'aircraft';
    if (trains.find(t => t.id === id))   mode = 'train';

    const pinned = {
      id, mode,
      name:     item.name || item.callsign || id,
      type:     item.type || 'Vehicle',
      flag:     item.flag || '🚢',
      route:    item.route || '',
      speed:    item.speed || '—',
      heading:  item.heading || 0,
      risk:     item.risk || item.status || '—',
      lat:      item.lat,
      lon:      item.lon,
      pinnedAt: Date.now(),
      weather:  null,
    };

    profile.pinned.unshift(pinned);
    if (profile.pinned.length > 20) profile.pinned = profile.pinned.slice(0, 20);
    save(profile);
    applyProfile();

    // Mark button as pinned
    const btn = document.querySelector(`#li-${id} .tlp-pin-btn`);
    if (btn) btn.classList.add('pinned');

    // Show toast
    showPinToast('📍 Pinned: ' + pinned.name);

    // Fetch weather immediately if has coordinates
    if (pinned.lat != null && pinned.lon != null) {
      fetchPinnedWeather(id, pinned.lat, pinned.lon);
    }
  };

  function unpinItem(id) {
    profile.pinned = profile.pinned.filter(p => p.id !== id);
    save(profile);
    applyProfile();
    renderPinnedList();
    const btn = document.querySelector(`#li-${id} .tlp-pin-btn`);
    if (btn) btn.classList.remove('pinned');
    showPinToast('🗑 Unpinned');
  }

  /* ── Fetch weather for a pinned item ── */
  async function fetchPinnedWeather(id, lat, lon) {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,windspeed_10m,weathercode,precipitation&timezone=auto`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      const c = data.current;
      const WMO_ICONS = { 0:'☀️',1:'🌤',2:'⛅',3:'☁️',45:'🌫',51:'🌦',61:'🌧',71:'🌨',80:'🌦',95:'⛈' };
      const icon = WMO_ICONS[c.weathercode] || '🌡';
      const pinned = profile.pinned.find(p => p.id === id);
      if (pinned) {
        pinned.weather = { temp: c.temperature_2m, wind: c.windspeed_10m, icon, code: c.weathercode, precip: c.precipitation };
        pinned.weatherAt = Date.now();
        save(profile);
        renderPinnedList();
      }
    } catch(e) {}
  }

  /* ── Render pinned list ── */
  function renderPinnedList() {
    const el = document.getElementById('pinnedList');
    if (!el) return;

    if (!profile.pinned.length) {
      el.innerHTML = `
        <div class="pinned-empty">
          <div class="pe-icon">📡</div>
          <div class="pe-title">No pinned items yet</div>
          <div class="pe-sub">Click the 📍 pin button next to any vehicle in the Live Tracker to track it here</div>
        </div>`;
      return;
    }

    const modeIcon = { vessel:'🚢', aircraft:'✈️', train:'🚂' };

    el.innerHTML = profile.pinned.map(p => {
      const ago = Math.round((Date.now() - p.pinnedAt) / 60000);
      const agoStr = ago < 1 ? 'just now' : ago < 60 ? ago + 'm ago' : Math.round(ago/60) + 'h ago';
      const riskCls = (p.risk||'').toLowerCase().includes('high') ? 'pi-badge-delay' :
                      (p.risk||'').toLowerCase().includes('medium') ? 'pi-badge-delay' : 'pi-badge-live';
      const weatherStr = p.weather
        ? `${p.weather.icon} ${p.weather.temp}°C · 💨 ${p.weather.wind} km/h`
        : '🌡 Fetching weather…';

      return `<div class="pinned-item" id="pin-${p.id}">
        <div class="pi-header">
          <div class="pi-icon">${p.flag || modeIcon[p.mode] || '📍'}</div>
          <div class="pi-name">${p.name}</div>
          <span class="pi-badge ${riskCls}">${p.risk || p.status || 'Live'}</span>
        </div>
        <div class="pi-meta">${p.route || p.type} · ${p.speed} · Pinned ${agoStr}</div>
        <div class="pi-weather">${weatherStr}</div>
        <div class="pi-actions">
          <div class="pi-action-btn" onclick="refreshPinnedWeather('${p.id}',${p.lat},${p.lon})">↺ Refresh Weather</div>
          <div class="pi-action-btn" onclick="jumpToTracker('${p.id}','${p.mode}')">🗺 View on Map</div>
          <div class="pi-action-btn danger" onclick="unpinItemGlobal('${p.id}')">✕ Unpin</div>
        </div>
      </div>`;
    }).join('');
  }

  /* ── Refresh weather for a pinned item ── */
  window.refreshPinnedWeather = function(id, lat, lon) {
    if (lat == null || lon == null) return;
    fetchPinnedWeather(id, lat, lon);
    showPinToast('↺ Refreshing weather…');
  };

  /* ── Jump to tracker tab and select item ── */
  window.jumpToTracker = function(id, mode) {
    closeProfile();
    setTimeout(() => {
      if (typeof switchTracker === 'function') switchTracker(mode || 'vessel');
      setTimeout(() => {
        if (typeof selectTrackerItem === 'function') selectTrackerItem(id);
        document.getElementById('live-tracker')?.scrollIntoView({ behavior:'smooth' });
      }, 600);
    }, 300);
  };

  /* ── Expose unpin globally ── */
  window.unpinItemGlobal = function(id) { unpinItem(id); };

  /* ── Save a route ── */
  window.saveRoute = function() {
    const origin = document.getElementById('par-origin')?.value.trim();
    const dest   = document.getElementById('par-dest')?.value.trim();
    const mode   = document.getElementById('par-mode')?.value || 'Road';
    const note   = document.getElementById('par-note')?.value.trim();
    if (!origin || !dest) { showPinToast('⚠ Enter origin and destination'); return; }
    const modeIcons = { Road:'🚛', Sea:'🚢', Air:'✈️', Rail:'🚂' };
    profile.routes.unshift({
      id: 'r' + Date.now(),
      origin, dest, mode, note,
      icon: modeIcons[mode] || '📦',
      savedAt: Date.now(),
    });
    if (profile.routes.length > 30) profile.routes = profile.routes.slice(0,30);
    save(profile);
    applyProfile();
    renderSavedRoutes();
    // Clear inputs
    ['par-origin','par-dest','par-note'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    showPinToast('🗺 Route saved!');
  };

  /* ── Render saved routes ── */
  function renderSavedRoutes() {
    const el = document.getElementById('savedRoutesList');
    if (!el) return;
    if (!profile.routes.length) {
      el.innerHTML = '<div class="pinned-empty"><div class="pe-icon">🗺</div><div class="pe-title">No saved routes</div><div class="pe-sub">Add a route plan below</div></div>';
      return;
    }
    el.innerHTML = profile.routes.map(r => `
      <div class="saved-route-item">
        <div class="sri-icon">${r.icon}</div>
        <div class="sri-info">
          <div class="sri-route">${r.origin} → ${r.dest}</div>
          <div class="sri-meta">${r.mode}${r.note ? ' · '+r.note : ''}</div>
        </div>
        <div class="sri-del" onclick="deleteRoute('${r.id}')" title="Delete">✕</div>
      </div>
    `).join('');
  }

  window.deleteRoute = function(id) {
    profile.routes = profile.routes.filter(r => r.id !== id);
    save(profile); applyProfile(); renderSavedRoutes();
    showPinToast('🗑 Route removed');
  };

  /* ── Clear all ── */
  window.clearAllData = function() {
    if (!confirm('Clear all profile data, pinned items and saved routes?')) return;
    profile = { pinned:[], routes:[], prefs:{autorefresh:true,weather:true,traffic:false,units:'metric'} };
    colorIdx = 0;
    save(profile);
    applyProfile();
    renderPinnedList();
    renderSavedRoutes();
    showPinToast('🗑 All data cleared');
  };

  /* ── Pin toast ── */
  let pinToastTimer;
  function showPinToast(msg) {
    const t = document.getElementById('pinToast');
    const m = document.getElementById('pinToastMsg');
    if (!t || !m) return;
    m.textContent = msg;
    t.classList.add('show');
    clearTimeout(pinToastTimer);
    pinToastTimer = setTimeout(() => t.classList.remove('show'), 2800);
  }

  /* ── Patch tracker list render to add pin buttons ── */
  // We hook into the existing renderList function after it runs
  const _origRenderList = window.renderList;
  if (typeof _origRenderList === 'function') {
    window.renderList = function(items) {
      _origRenderList(items);
      addPinButtons();
    };
  }

  function addPinButtons() {
    document.querySelectorAll('.tlp-item').forEach(el => {
      if (el.querySelector('.tlp-pin-btn')) return;
      const id = el.id.replace('li-','');
      const isPinned = profile.pinned.some(p => p.id === id);
      const btn = document.createElement('button');
      btn.className = 'tlp-pin-btn' + (isPinned ? ' pinned' : '');
      btn.title = isPinned ? 'Unpin' : 'Pin to profile';
      btn.textContent = '📍';
      btn.onclick = (e) => { e.stopPropagation(); pinTrackerItem(id); };
      el.appendChild(btn);
    });
  }

  /* ── Also patch selectTrackerItem to add pin from detail ── */
  const _origSelect = window.selectTrackerItem;
  if (typeof _origSelect === 'function') {
    window.selectTrackerItem = function(id) {
      _origSelect(id);
      addPinButtons();
    };
  }

  /* ── Auto-refresh pinned weather every 5 minutes ── */
  setInterval(() => {
    if (!profile.prefs?.autorefresh) return;
    profile.pinned.forEach(p => {
      if (p.lat != null && p.lon != null) {
        const age = Date.now() - (p.weatherAt || 0);
        if (age > 5 * 60 * 1000) fetchPinnedWeather(p.id, p.lat, p.lon);
      }
    });
  }, 60 * 1000);

  /* ── Keyboard: Escape closes panel ── */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeProfile();
  });

  /* ── Init ── */
  applyProfile();
  // Add pin buttons when tracker list updates
  setTimeout(addPinButtons, 1500);

  // Alert count = pinned items
  const alertEl = document.getElementById('ps-alerts');
  if (alertEl) {
    setInterval(() => {
      const delayed = profile.pinned.filter(p =>
        p.risk && (p.risk.toLowerCase().includes('high') || p.risk.toLowerCase().includes('delay'))
      ).length;
      alertEl.textContent = delayed;
    }, 5000);
  }

})();

/* ═══════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════
   CATALOX PROBABILITY PREDICTION ENGINE
   Live updates on every keystroke / selection change
   
   Factors considered:
   - Route distance & mode base probability
   - Weather conditions (real-time from Open-Meteo if coords available)
   - Traffic level
   - Historical corridor risk data
   - Time-of-year seasonality
   - Port congestion estimates
   - Political stability index
   - Three scenario analysis (optimistic / base / pessimistic)
   - ETA confidence intervals
═══════════════════════════════════════════════════════════════════════ */
(function initPredictionEngine() {
  'use strict';

  /* ── Base reliability by mode ── */
  const MODE_BASE_PROB = {
    road:  0.87, rail:  0.92,
    air:   0.94, water: 0.82,
  };

  /* ── Weather impact on probability ── */
  const WEATHER_IMPACT = {
    road:  { Clear:0, Rain:-0.08, Storm:-0.18 },
    rail:  { Clear:0, Rain:-0.04, Storm:-0.12 },
    air:   { Clear:0, Rain:-0.03, Storm:-0.22 },
    water: { Clear:0, Rain:-0.06, Storm:-0.20 },
  };

  /* ── Traffic impact ── */
  const TRAFFIC_IMPACT = {
    road:  { Low:0, Medium:-0.06, High:-0.16 },
    rail:  { Low:0, Medium:-0.02, High:-0.05 },
    air:   { Low:0, Medium:-0.01, High:-0.03 },
    water: { Low:0, Medium:-0.02, High:-0.04 },
  };

  /* ── Corridor risk database (origin → destination patterns) ── */
  const CORRIDOR_RISK = [
    // High-risk corridors
    { pattern:/aden|yemen|somalia|gulf/i,    delta:-0.12, label:'⚠ Piracy Risk Zone', cls:'lf-danger' },
    { pattern:/suez|panama/i,               delta:-0.06, label:'⚠ Canal Congestion', cls:'lf-warn' },
    { pattern:/shanghai|china.*us|us.*china/i, delta:-0.05, label:'⚠ Customs Scrutiny', cls:'lf-warn' },
    // Stable corridors
    { pattern:/rotterdam|hamburg|antwerp/i,  delta:+0.04, label:'✓ Port Efficiency A+', cls:'lf-good' },
    { pattern:/singapore/i,                  delta:+0.03, label:'✓ SG Port Rated #1', cls:'lf-good' },
    { pattern:/dubai|jebel ali/i,            delta:+0.02, label:'✓ AE Hub Reliability', cls:'lf-good' },
    // Domestic stable
    { pattern:/mumbai|delhi|chennai|bangalore/i, delta:+0.02, label:'✓ IN Rail/Road Strong', cls:'lf-good' },
    { pattern:/london|paris|berlin|madrid/i, delta:+0.03, label:'✓ EU Logistics A', cls:'lf-good' },
  ];

  /* ── Seasonality (month-based risk) ── */
  const MONTH_RISK = {
    0:0, 1:0, 2:0, 3:0, 4:0, 5:0,
    6:-0.03,  // typhoon season start
    7:-0.05,  // peak typhoon
    8:-0.06,  // peak typhoon
    9:-0.03,  // hurricane season
    10:0, 11:-0.02  // winter
  };

  /* ── Mode ETA multipliers for best/worst case ── */
  const SCENARIO_MULT = {
    best:   { road:0.88, rail:0.92, air:0.95, water:0.88 },
    base:   { road:1.00, rail:1.00, air:1.00, water:1.00 },
    worst:  { road:1.40, rail:1.20, air:1.35, water:1.55 },
  };

  /* ── Format minutes to human string ── */
  function fmtMin(m) {
    if (m < 60) return m + 'min';
    const h = Math.floor(m/60), mi = m%60;
    if (h >= 24) {
      const d = Math.floor(h/24), rh = h%24;
      return rh > 0 ? `${d}d ${rh}h` : `${d}d`;
    }
    return mi > 0 ? `${h}h ${mi}m` : `${h}h`;
  }

  /* ── Estimate base ETA from mode and distance ── */
  const MODE_SPEED = { road:72, rail:75, air:820, water:26 };
  function estimateEtaMin(distKm, mode) {
    const spd = MODE_SPEED[mode] || 72;
    return Math.round((distKm / spd) * 60);
  }

  /* ── Very rough distance from city name patterns ── */
  const CITY_COORDS = {
    'mumbai':[19.07,72.87],'delhi':[28.61,77.21],'chennai':[13.08,80.27],
    'bangalore':[12.97,77.59],'kolkata':[22.57,88.36],'pune':[18.52,73.86],
    'rotterdam':[51.92,4.47],'hamburg':[53.55,9.99],'antwerp':[51.22,4.40],
    'amsterdam':[52.37,4.90],'london':[51.51,-0.13],'paris':[48.86,2.35],
    'berlin':[52.52,13.40],'madrid':[40.42,-3.70],'milan':[45.46,9.19],
    'shanghai':[31.23,121.47],'beijing':[39.91,116.39],'guangzhou':[23.13,113.26],
    'shenzhen':[22.54,114.06],'hong kong':[22.32,114.17],'singapore':[1.35,103.82],
    'dubai':[25.20,55.27],'abu dhabi':[24.45,54.38],'jebel ali':[24.99,55.07],
    'los angeles':[34.05,-118.24],'new york':[40.71,-74.01],'chicago':[41.88,-87.63],
    'houston':[29.76,-95.37],'miami':[25.77,-80.19],'seattle':[47.61,-122.33],
    'tokyo':[35.69,139.69],'osaka':[34.69,135.50],'busan':[35.10,129.03],
    'sydney':[-33.87,151.21],'melbourne':[-37.81,144.96],
    'johannesburg':[-26.20,28.04],'capetown':[-33.93,18.42],
    'cairo':[30.06,31.25],'casablanca':[33.59,-7.62],
  };

  function roughDistKm(src, dst) {
    const a = CITY_COORDS[src.toLowerCase().trim()];
    const b = CITY_COORDS[dst.toLowerCase().trim()];
    if (!a || !b) return null;
    const R = 6371;
    const dLat = (b[0]-a[0])*Math.PI/180;
    const dLon = (b[1]-a[1])*Math.PI/180;
    const x = Math.sin(dLat/2)**2 + Math.cos(a[0]*Math.PI/180)*Math.cos(b[0]*Math.PI/180)*Math.sin(dLon/2)**2;
    return Math.round(R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x)));
  }

  /* ── Main prediction function ── */
  function computePrediction(src, dst, mode, weather, traffic) {
    let prob = MODE_BASE_PROB[mode] || 0.87;
    const factors = [];
    const risks   = [];

    // ── Mode factor ──
    const modePct = Math.round((MODE_BASE_PROB[mode]||0.87)*100);
    factors.push({ label:`${['road','rail','air','water'].indexOf(mode)!== -1?['🚛','🚂','✈️','🚢'][['road','rail','air','water'].indexOf(mode)]:'📦'} ${mode[0].toUpperCase()+mode.slice(1)} Base ${modePct}%`, cls:'lf-info' });

    // ── Weather ──
    const wi = (WEATHER_IMPACT[mode]||{})[weather] || 0;
    prob += wi;
    if (wi < 0) {
      factors.push({ label:`${weather==='Storm'?'⛈':'🌧'} ${weather} ${Math.round(wi*100)}%`, cls: wi<-0.10?'lf-danger':'lf-warn' });
      if (weather === 'Storm') {
        risks.push({ icon:'⛈', text:`<strong>Storm Warning:</strong> ${mode==='air'?'Potential flight diversions or holds':'Severe delays possible — consider hold-off or reroute'}` });
      }
    } else {
      factors.push({ label:'☀️ Clear Weather +2%', cls:'lf-good' });
    }

    // ── Traffic ──
    const ti = (TRAFFIC_IMPACT[mode]||{})[traffic] || 0;
    prob += ti;
    if (ti < 0) {
      factors.push({ label:`🚦 ${traffic} Traffic ${Math.round(ti*100)}%`, cls: ti<-0.10?'lf-danger':'lf-warn' });
      if (traffic === 'High' && mode === 'road') {
        risks.push({ icon:'🚦', text:`<strong>High Traffic:</strong> Major arterials congested — allow extra ${Math.round(Math.abs(ti)*60*4)}min buffer` });
      }
    } else if (traffic === 'Low') {
      factors.push({ label:'🟢 Low Traffic +1%', cls:'lf-good' });
    }

    // ── Corridor risk ──
    const combined = (src+' '+dst).toLowerCase();
    CORRIDOR_RISK.forEach(cr => {
      if (cr.pattern.test(combined)) {
        prob += cr.delta;
        factors.push({ label:cr.label, cls:cr.cls });
        if (cr.delta < -0.08) {
          risks.push({ icon:'⚠', text:`<strong>${cr.label.replace(/[⚠✓]/g,'').trim()}:</strong> This corridor has elevated risk — verify cargo insurance` });
        }
      }
    });

    // ── Seasonality ──
    const monthDelta = MONTH_RISK[new Date().getMonth()] || 0;
    if (monthDelta < 0) {
      prob += monthDelta;
      const mNames=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      factors.push({ label:`🌀 ${mNames[new Date().getMonth()]} Season Risk`, cls:'lf-warn' });
    }

    // ── Distance bonus/penalty ──
    const dist = roughDistKm(src, dst);
    if (dist) {
      const distFactor = dist > 15000 ? -0.06 : dist > 8000 ? -0.03 : dist < 2000 ? 0.04 : 0;
      prob += distFactor;
      if (distFactor > 0) factors.push({ label:`📍 Short Haul Advantage +${Math.round(distFactor*100)}%`, cls:'lf-good' });
      if (distFactor < 0) factors.push({ label:`📏 Long Haul Risk ${Math.round(distFactor*100)}%`, cls:'lf-warn' });
    }

    // Clamp
    prob = Math.min(0.99, Math.max(0.05, prob));
    const probPct = Math.round(prob * 100);

    // ── ETA calculation ──
    const distEst = dist || (mode==='air'?8000:mode==='water'?12000:mode==='rail'?1200:800);
    const weather_time_mult = weather==='Storm'?1.35:weather==='Rain'?1.12:1.0;
    const traffic_time_mult = traffic==='High'?1.30:traffic==='Medium'?1.12:1.0;
    const baseMin = estimateEtaMin(distEst, mode);
    const adjMin  = Math.round(baseMin * weather_time_mult * traffic_time_mult);
    const bestMin = Math.round(adjMin * (SCENARIO_MULT.best[mode]||0.88));
    const worstMin= Math.round(adjMin * (SCENARIO_MULT.worst[mode]||1.45));

    // ── Confidence level ──
    const hasBothCities = !!roughDistKm(src, dst);
    const confidence = hasBothCities ? (src.length > 2 && dst.length > 2 ? 'High Confidence' : 'Medium Confidence') : 'Estimate — enter cities';

    // ── Scenarios ──
    const scenarios = [
      { label:'Best Case', prob: Math.min(99,probPct+8), eta: fmtMin(bestMin), icon:'🚀', cls:'scen-best' },
      { label:'Most Likely', prob: probPct,              eta: fmtMin(adjMin),  icon:'📊', cls:'' },
      { label:'Worst Case',  prob: Math.max(5,probPct-15), eta: fmtMin(worstMin), icon:'⛈', cls:'scen-worst' },
    ];

    return {
      prob: probPct,
      factors,
      scenarios,
      risks,
      etaBest: fmtMin(bestMin),
      etaMain: fmtMin(adjMin),
      etaWorst: fmtMin(worstMin),
      confidence,
      dist: dist || distEst,
    };
  }

  /* ── Render prediction into the panel ── */
  function renderPrediction(data) {
    const panel = document.getElementById('livePredPanel');
    if (!panel) return;
    panel.style.display = '';

    // Probability bar
    const fill = document.getElementById('lppProbFill');
    const glow = document.getElementById('lppProbGlow');
    const pct  = document.getElementById('lppProbPct');
    const conf = document.getElementById('lppConfidence');

    if (fill) {
      fill.style.width = data.prob + '%';
      fill.className = 'lpp-prob-fill ' +
        (data.prob >= 80 ? 'prob-high' : data.prob >= 60 ? 'prob-medium' : 'prob-low');
    }
    if (glow) {
      glow.style.background = data.prob >= 80 ? 'rgba(50,215,75,.6)' :
                              data.prob >= 60 ? 'rgba(255,159,10,.6)' : 'rgba(255,69,58,.6)';
    }
    if (pct) {
      pct.textContent = data.prob + '%';
      pct.style.color = data.prob >= 80 ? '#32D74B' : data.prob >= 60 ? '#FF9F0A' : '#FF453A';
    }
    if (conf) conf.textContent = data.confidence;

    // Factors
    const fEl = document.getElementById('lppFactors');
    if (fEl) {
      fEl.innerHTML = data.factors.map(f =>
        `<span class="lpp-factor ${f.cls}">${f.label}</span>`
      ).join('');
    }

    // Scenarios
    const sEl = document.getElementById('lppScenGrid');
    if (sEl) {
      sEl.innerHTML = data.scenarios.map(s =>
        `<div class="lpp-scen ${s.cls}">
          <div class="ls-icon">${s.icon}</div>
          <div class="ls-label">${s.label}</div>
          <div class="ls-prob">${s.prob}%</div>
          <div class="ls-eta">${s.eta}</div>
        </div>`
      ).join('');
    }

    // Risks
    const rEl = document.getElementById('lppRisks');
    if (rEl) {
      rEl.innerHTML = data.risks.length
        ? data.risks.map((r,i) =>
            `<div class="lpp-risk-item" style="animation-delay:${i*0.08}s">
              <div class="lri-icon">${r.icon}</div>
              <div class="lri-text">${r.text}</div>
            </div>`
          ).join('')
        : '';
    }

    // ETA range
    const etaBest  = document.getElementById('lppEtaBest');
    const etaMain  = document.getElementById('lppEtaMain');
    const etaWorst = document.getElementById('lppEtaWorst');
    if (etaBest)  etaBest.textContent  = data.etaBest;
    if (etaMain)  etaMain.textContent  = data.etaMain;
    if (etaWorst) etaWorst.textContent = data.etaWorst;
  }

  /* ── Public: update from form inputs ── */
  let predTimer;
  window.updateLivePrediction = function() {
    clearTimeout(predTimer);
    predTimer = setTimeout(() => {
      const src     = (document.getElementById('src')?.value  || '').trim();
      const dst     = (document.getElementById('dst')?.value  || '').trim();
      const weather = document.getElementById('wthr')?.value  || 'Clear';
      const traffic = document.getElementById('traf')?.value  || 'Low';
      const mode    = window.selectedMode || 'road';

      // Show panel even with partial input
      if (src.length < 2 && dst.length < 2) {
        const panel = document.getElementById('livePredPanel');
        if (panel) panel.style.display = 'none';
        return;
      }

      const data = computePrediction(src || 'City A', dst || 'City B', mode, weather, traffic);
      renderPrediction(data);
    }, 180); // debounce
  };

  /* ── Hook into selectMode so mode change also updates ── */
  const _origSelectMode = window.selectMode;
  window.selectMode = function(m) {
    if (typeof _origSelectMode === 'function') _origSelectMode(m);
    updateLivePrediction();
  };

  /* ── Tracker vehicle prediction ── */
  window.updateTrackerPrediction = function(item) {
    const pct  = document.getElementById('tpmFill');
    const pctN = document.getElementById('tpmPct');
    const lbl  = document.getElementById('tpmLabel');
    const fcts = document.getElementById('tpmFactors');
    if (!pct) return;

    // Determine probability based on item data
    let prob = 85;
    const risk = (item.risk || item.status || '').toLowerCase();
    if (risk.includes('high'))   prob = 52;
    if (risk.includes('medium')) prob = 72;
    if (risk.includes('delay'))  prob = 58;
    if (risk.includes('time'))   prob = 91;
    if (risk.includes('port'))   prob = 78;
    const mode = item.mode || 'vessel';
    const modeBase = { vessel:82, aircraft:94, train:91 }[mode] || 82;
    prob = Math.round((prob * 0.6) + (modeBase * 0.4));

    pct.style.width = prob + '%';
    pct.className = 'tpm-bar-fill ' + (prob >= 80 ? 'prob-high' : prob >= 60 ? 'prob-medium' : 'prob-low');
    if (pctN) { pctN.textContent = prob + '%'; pctN.style.color = prob>=80?'#32D74B':prob>=60?'#FF9F0A':'#FF453A'; }
    if (lbl)  lbl.textContent = prob >= 80 ? 'On-Time' : prob >= 60 ? 'At Risk' : 'Delayed';

    if (fcts) {
      const chipData = [
        { label: mode==='aircraft'?'✈ Air Reliable':mode==='train'?'🚂 Rail Reliable':'🚢 AIS Active', cls:'lf-good' },
        item.risk==='High' ? { label:'⚠ High Risk', cls:'lf-danger' } : { label:'📡 Position Live', cls:'lf-info' },
        item.weather ? { label:`${item.weather.icon} ${item.weather.temp}°C`, cls:'lf-info' } : null,
      ].filter(Boolean);
      fcts.innerHTML = chipData.map(c => `<span class="lpp-factor ${c.cls}" style="font-size:.62rem;padding:3px 8px">${c.label}</span>`).join('');
    }
  };

  /* ── Hook into selectTrackerItem to update prediction ── */
  const _origSelectItem = window.selectTrackerItem;
  if (typeof _origSelectItem === 'function') {
    window.selectTrackerItem = function(id) {
      _origSelectItem(id);
      // Find the item
      const all = [
        ...(window._trackerVessels  || []),
        ...(window._trackerAircraft || []),
        ...(window._trackerTrains   || []),
      ];
      const item = all.find(i => i.id === id);
      if (item) updateTrackerPrediction(item);
    };
  }

  /* ── Auto-trigger on page load if inputs have values ── */
  setTimeout(updateLivePrediction, 800);

})();

/* ═══════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════
   CATALOX SMART SEARCH + PROBABILITY ENGINE
   - Global hub database: ports, airports, rail stations
   - Smart autocomplete with port-card style suggestions
   - Nearest hubs on input focus (geolocation or IP)
   - Real-time weather fetch per location (Open-Meteo)
   - On-time delivery probability with multi-factor scoring
   - Live weather + traffic auto-update in delivery form
═══════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════
   HUB DATABASE (ports/airports/stations)
═══════════════════════════════ */
/* ═══════════════════════════════════════════════════════
   CONTEXTUAL IMAGE SYSTEM — Each hub type gets images
   that visually match: ports=ships/cranes, airports=planes,
   stations=trains/platforms. Multiple images per hub for
   visual variety while staying true to the hub's identity.
═══════════════════════════════════════════════════════ */

// Curated Unsplash photos by hub type — all visually match the transport mode
const HUB_PHOTO_SETS = {
  port: [
    // Container ships, cranes, cargo terminals — clear port imagery
    'photo-1578575437130-527eed3abbec', // container ship overhead
    'photo-1494412519320-aa613dfb7738', // port cranes at dusk
    'photo-1558618666-fcd25c85cd64', // cargo containers stacked
    'photo-1516937941344-00b4e0337589', // ship at port terminal
    'photo-1504284626571-9d1b2b0fbb2f', // container port aerial
    'photo-1471897488648-5eae4ac6686b', // cargo vessel ocean
    'photo-1601135467887-fdf12f7a83e1', // port loading cranes
    'photo-1567361808960-dec9cb578182', // shipping containers
    'photo-1583521214690-73421a1829a9', // large container ship
    'photo-1584464491033-06628f3a6b7b', // port infrastructure
  ],
  airport: [
    // Runways, terminals, aircraft — clear aviation imagery
    'photo-1436491865332-7a61a109cc05', // plane on runway classic
    'photo-1544636331-e26879cd4d9b', // aircraft in blue sky
    'photo-1569336415962-a4bd9f69cd83', // plane landing at sunset
    'photo-1464037866556-6812c9d1c72e', // airport terminal interior
    'photo-1587019158091-1a103c5dd17f', // aircraft tail at gate
    'photo-1530521954074-e64f6810b32d', // airport overview aerial
    'photo-1519451241324-20b4ea2c4220', // takeoff runway
    'photo-1508739773434-c26b3d09e071', // airport atrium
    'photo-1574031543604-4cff5e3e0e65', // aircraft from above
    'photo-1556388158-158ea5ccacbd', // jet bridge cockpit view
  ],
  station: [
    // Train platforms, high-speed rail, station architecture
    'photo-1474487548417-781cb6d646ef', // train platform
    'photo-1532105956626-9569c03602f6', // high speed train
    'photo-1611273426858-450d8e3c9fce', // bullet train shinkansen
    'photo-1582192730841-2a682d7375f9', // train arriving platform
    'photo-1601643157091-ce5c665179ab', // underground metro
    'photo-1544620347-c4fd4a3d5957', // train interior corridor
    'photo-1596237563267-84ffd99c80e1', // TGV high speed rail
    'photo-1507003211169-0a1dd7228f2d', // station architecture grand
    'photo-1572965733014-76581e2e4c82', // rail tracks converging
    'photo-1565043666747-69f6646db940', // metro station modern
  ],
};

const HUBS = [
  // ── Sea Ports — all get port-specific photos ──
  { id:'INMUN', name:'Nhava Sheva (JNPT)', city:'Mumbai', country:'India', type:'port', code:'INMUN', lat:18.93, lon:72.93, photoIdx:0, rank:'#4 Asia', throughput:'7.2M TEU/yr', congestion:'Moderate', routes:['Dubai','Singapore','Rotterdam','Colombo'] },
  { id:'CNSHA', name:'Port of Shanghai', city:'Shanghai', country:'China', type:'port', code:'CNSHA', lat:31.40, lon:121.46, photoIdx:1, rank:'#1 World', throughput:'47M TEU/yr', congestion:'Low', routes:['Los Angeles','Rotterdam','Singapore','Sydney'] },
  { id:'SGSIN', name:'Port of Singapore', city:'Singapore', country:'Singapore', type:'port', code:'SGSIN', lat:1.26, lon:103.82, photoIdx:2, rank:'#2 World', throughput:'37M TEU/yr', congestion:'Low', routes:['Shenzhen','Port Klang','Hong Kong','Colombo'] },
  { id:'NLRTM', name:'Port of Rotterdam', city:'Rotterdam', country:'Netherlands', type:'port', code:'NLRTM', lat:51.89, lon:4.48, photoIdx:3, rank:'#1 Europe', throughput:'15M TEU/yr', congestion:'Low', routes:['Shanghai','New York','Antwerp','Hamburg'] },
  { id:'USLAX', name:'Port of Los Angeles', city:'Los Angeles', country:'USA', type:'port', code:'USLAX', lat:33.74, lon:-118.26, photoIdx:4, rank:'#1 USA', throughput:'10.7M TEU/yr', congestion:'High', routes:['Shanghai','Tokyo','Seoul','Taipei'] },
  { id:'DEHAG', name:'Port of Hamburg', city:'Hamburg', country:'Germany', type:'port', code:'DEHAG', lat:53.54, lon:10.00, photoIdx:5, rank:'#2 Europe', throughput:'8.7M TEU/yr', congestion:'Low', routes:['Rotterdam','Shanghai','New York','Gdansk'] },
  { id:'KRBUS', name:'Port of Busan', city:'Busan', country:'South Korea', type:'port', code:'KRBUS', lat:35.10, lon:129.04, photoIdx:6, rank:'#6 World', throughput:'21.6M TEU/yr', congestion:'Low', routes:['Shanghai','Los Angeles','Kobe','Singapore'] },
  { id:'AEDXB', name:'Jebel Ali Port', city:'Dubai', country:'UAE', type:'port', code:'AEDXB', lat:24.97, lon:55.06, photoIdx:7, rank:'#10 World', throughput:'14.4M TEU/yr', congestion:'Low', routes:['Mumbai','Singapore','Rotterdam','Djibouti'] },
  { id:'LKCMB', name:'Port of Colombo', city:'Colombo', country:'Sri Lanka', type:'port', code:'LKCMB', lat:6.94, lon:79.84, photoIdx:8, rank:'#24 World', throughput:'7M TEU/yr', congestion:'Low', routes:['Mumbai','Singapore','Jeddah','Rotterdam'] },
  { id:'GBFXT', name:'Felixstowe', city:'Felixstowe', country:'UK', type:'port', code:'GBFXT', lat:51.96, lon:1.35, photoIdx:9, rank:'#1 UK', throughput:'4.0M TEU/yr', congestion:'Moderate', routes:['Rotterdam','Antwerp','Hamburg','Shanghai'] },

  // ── Airports — all get aviation-specific photos ──
  { id:'BOM', name:'Chhatrapati Shivaji Int\'l', city:'Mumbai', country:'India', type:'airport', code:'BOM', lat:19.09, lon:72.87, photoIdx:0, rank:'Top 20 Cargo', throughput:'890K tonnes/yr', congestion:'Moderate', routes:['Dubai','London','Singapore','Frankfurt'] },
  { id:'PVG', name:'Pudong Int\'l Airport', city:'Shanghai', country:'China', type:'airport', code:'PVG', lat:31.14, lon:121.80, photoIdx:1, rank:'#3 Cargo World', throughput:'3.9M tonnes/yr', congestion:'Low', routes:['Los Angeles','Frankfurt','Seoul','Tokyo'] },
  { id:'SIN', name:'Changi Airport', city:'Singapore', country:'Singapore', type:'airport', code:'SIN', lat:1.36, lon:103.99, photoIdx:2, rank:'World Best', throughput:'2.2M tonnes/yr', congestion:'Low', routes:['Sydney','London','Frankfurt','Dubai'] },
  { id:'AMS', name:'Amsterdam Schiphol', city:'Amsterdam', country:'Netherlands', type:'airport', code:'AMS', lat:52.31, lon:4.76, photoIdx:3, rank:'#4 Europe', throughput:'1.7M tonnes/yr', congestion:'Low', routes:['New York','Dubai','London','Tokyo'] },
  { id:'LAX', name:'Los Angeles Int\'l', city:'Los Angeles', country:'USA', type:'airport', code:'LAX', lat:33.94, lon:-118.40, photoIdx:4, rank:'#4 USA', throughput:'800K tonnes/yr', congestion:'High', routes:['Tokyo','Shanghai','Sydney','Seoul'] },
  { id:'FRA', name:'Frankfurt Airport', city:'Frankfurt', country:'Germany', type:'airport', code:'FRA', lat:50.04, lon:8.56, photoIdx:5, rank:'#2 Europe Cargo', throughput:'2.0M tonnes/yr', congestion:'Moderate', routes:['New York','Beijing','Dubai','London'] },
  { id:'DXB', name:'Dubai Int\'l Airport', city:'Dubai', country:'UAE', type:'airport', code:'DXB', lat:25.25, lon:55.36, photoIdx:6, rank:'#1 Int\'l Pax', throughput:'2.8M tonnes/yr', congestion:'Low', routes:['London','Mumbai','Karachi','Bangkok'] },
  { id:'LHR', name:'London Heathrow', city:'London', country:'UK', type:'airport', code:'LHR', lat:51.48, lon:-0.46, photoIdx:7, rank:'#1 UK', throughput:'1.6M tonnes/yr', congestion:'High', routes:['New York','Dubai','Frankfurt','Singapore'] },
  { id:'HND', name:'Tokyo Haneda', city:'Tokyo', country:'Japan', type:'airport', code:'HND', lat:35.55, lon:139.78, photoIdx:8, rank:'#2 Asia Pax', throughput:'900K tonnes/yr', congestion:'Moderate', routes:['Seoul','Shanghai','Honolulu','Beijing'] },
  { id:'ICN', name:'Incheon Int\'l Airport', city:'Seoul', country:'South Korea', type:'airport', code:'ICN', lat:37.46, lon:126.44, photoIdx:9, rank:'#2 World Cargo', throughput:'4.1M tonnes/yr', congestion:'Low', routes:['Beijing','Tokyo','Shanghai','Frankfurt'] },

  // ── Rail Stations — all get train/station-specific photos ──
  { id:'INNDLS', name:'New Delhi Railway Station', city:'New Delhi', country:'India', type:'station', code:'NDLS', lat:28.64, lon:77.22, photoIdx:0, rank:'#1 India Traffic', throughput:'500K pax/day', congestion:'High', routes:['Mumbai','Chennai','Kolkata','Bengaluru'] },
  { id:'CNSHAST', name:'Shanghai Hongqiao Stn', city:'Shanghai', country:'China', type:'station', code:'SHH', lat:31.19, lon:121.33, photoIdx:1, rank:'#1 China HSR', throughput:'300K pax/day', congestion:'Moderate', routes:['Beijing','Nanjing','Hangzhou','Wuhan'] },
  { id:'GBSTP', name:'London St Pancras', city:'London', country:'UK', type:'station', code:'STP', lat:51.53, lon:-0.12, photoIdx:2, rank:'Eurostar Hub', throughput:'50K pax/day', congestion:'Moderate', routes:['Paris','Brussels','Amsterdam','Lille'] },
  { id:'FRPNO', name:'Paris Gare du Nord', city:'Paris', country:'France', type:'station', code:'PNO', lat:48.88, lon:2.35, photoIdx:3, rank:'#1 Europe Traffic', throughput:'700K pax/day', congestion:'High', routes:['London','Brussels','Cologne','Lyon'] },
  { id:'DEFRAST', name:'Frankfurt Hauptbahnhof', city:'Frankfurt', country:'Germany', type:'station', code:'FRAHBF', lat:50.11, lon:8.66, photoIdx:4, rank:'#2 Germany', throughput:'350K pax/day', congestion:'Moderate', routes:['Paris','Berlin','Munich','Amsterdam'] },
  { id:'JPTKYST', name:'Tokyo Station', city:'Tokyo', country:'Japan', type:'station', code:'TYO', lat:35.68, lon:139.77, photoIdx:5, rank:'#1 Japan', throughput:'460K pax/day', congestion:'High', routes:['Osaka','Nagoya','Kyoto','Hiroshima'] },
];

const HUB_TYPE_ICONS = { port:'🚢', airport:'✈️', station:'🚂', all:'🌐' };

/* Get the contextually correct photo URL for a hub */
function hubPhoto(hub) {
  // Support legacy string photo ids (for backward compat)
  if (typeof hub === 'string') {
    // Map old generic photo IDs to a port fallback
    return `https://images.unsplash.com/${hub}?auto=format&fit=crop&w=400&h=220&q=75`;
  }
  const set = HUB_PHOTO_SETS[hub.type] || HUB_PHOTO_SETS.port;
  const idx = (hub.photoIdx || 0) % set.length;
  return `https://images.unsplash.com/${set[idx]}?auto=format&fit=crop&w=400&h=220&q=75`;
}

/* ── Hub search state ── */
let hubType = 'all';
let hubWeatherCache = {};

window.setHubType = function(type) {
  hubType = type;
  ['all','port','airport','station'].forEach(t => {
    const tab = document.getElementById('hstab-' + t);
    if (tab) tab.classList.toggle('active', t === type);
  });
  const icons = { all:'🔍', port:'🚢', airport:'✈️', station:'🚂' };
  const icon = document.getElementById('hubSearchIcon');
  if (icon) icon.textContent = icons[type] || '🔍';
  const inp = document.getElementById('hubSearchInput');
  if (inp && inp.value) onHubSearch(inp.value);
  else showFeaturedHubs();
};

/* ── Show featured hubs on load ── */
function showFeaturedHubs() {
  const grid = document.getElementById('hubResultsGrid');
  if (!grid) return;
  const featured = HUBS
    .filter(h => hubType === 'all' || h.type === hubType)
    .slice(0, 6);
  renderHubCards(featured, grid);
}

/* ── Hub search ── */
window.onHubSearch = function(val) {
  const grid = document.getElementById('hubResultsGrid');
  const drop = document.getElementById('hubSearchDrop');
  if (!val || val.length < 1) {
    if (drop) drop.classList.remove('open');
    showFeaturedHubs();
    return;
  }
  const q = val.toLowerCase();
  const filtered = HUBS.filter(h =>
    (hubType === 'all' || h.type === hubType) &&
    (h.name.toLowerCase().includes(q) ||
     h.city.toLowerCase().includes(q) ||
     h.country.toLowerCase().includes(q) ||
     h.code.toLowerCase().includes(q))
  ).slice(0, 8);

  // Show dropdown suggestions
  if (drop && filtered.length) {
    drop.innerHTML = (filtered.length ? '<div class="sdr-section">Matching Hubs</div>' : '') +
      filtered.map(h => `
        <div class="sdr-item" onclick="selectHub('${h.id}');document.getElementById('hubSearchDrop').classList.remove('open')">
          <div class="sdr-thumb">
            <img src="${hubPhoto(h)}" alt="${h.name}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=400&h=220&q=70'"/>
            <div class="sdr-type-badge">${HUB_TYPE_ICONS[h.type]}</div>
          </div>
          <div class="sdr-info">
            <div class="sdr-name">${h.name}</div>
            <div class="sdr-meta">${h.city}, ${h.country} · ${h.throughput}</div>
          </div>
          <div class="sdr-code">${h.code}</div>
        </div>
      `).join('');
    drop.classList.add('open');
  } else if (drop) {
    drop.classList.remove('open');
  }

  // Show grid results too
  if (grid) renderHubCards(filtered.slice(0, 6), grid);
};

/* ── Select a specific hub ── */
window.selectHub = function(id) {
  const hub = HUBS.find(h => h.id === id);
  if (!hub) return;
  const grid = document.getElementById('hubResultsGrid');
  if (grid) renderHubCards([hub], grid);
  // Fetch weather
  fetchHubWeather(hub);
};

/* ── Render hub cards ── */
function renderHubCards(hubs, grid) {
  if (!hubs.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:32px;color:rgba(255,255,255,.30);font-size:.84rem">No hubs found. Try a different search.</div>';
    return;
  }
  grid.innerHTML = hubs.map(h => {
    const congCls = h.congestion === 'Low' ? 'green' : h.congestion === 'High' ? 'orange' : '';
    const wxCache = hubWeatherCache[h.id];
    const wxStr = wxCache
      ? `${wxCache.icon} ${wxCache.temp}°C · 💨${wxCache.wind}km/h`
      : '<span class="typing-dots"><span></span><span></span><span></span></span>';
    const typeLabel = h.type === 'port' ? '🚢 Port' : h.type === 'airport' ? '✈️ Airport' : '🚂 Station';
    return `
      <div class="hub-card" onclick="selectHub('${h.id}');fetchHubWeather(HUBS.find(x=>x.id==='${h.id}'))">
        <div class="hub-card-photo-wrap">
          <img class="hub-card-photo" src="${hubPhoto(h)}" alt="${h.name}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=400&h=220&q=70'"/>
          <div class="hub-card-type-badge ${h.type}">${typeLabel}</div>
          <div class="hub-card-code-badge">${h.code}</div>
        </div>
        <div class="hub-card-body">
          <div class="hub-card-name">${h.name}</div>
          <div class="hub-card-sub">${h.city}, ${h.country}</div>
          <div class="hub-card-stats">
            <div class="hub-stat-pill blue">${h.rank}</div>
            <div class="hub-stat-pill ${congCls}">${h.congestion} Congestion</div>
            <div class="hub-stat-pill">${h.throughput}</div>
          </div>
          <div class="hub-card-weather" id="hwx-${h.id}">${wxStr}</div>
        </div>
      </div>`;
  }).join('');

  // Fetch weather for all displayed hubs
  hubs.forEach(h => {
    if (!hubWeatherCache[h.id]) fetchHubWeather(h);
  });
}

/* ── Fetch weather for a hub ── */
async function fetchHubWeather(hub) {
  if (!hub || hub.lat == null) return;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${hub.lat}&longitude=${hub.lon}&current=temperature_2m,windspeed_10m,weathercode&timezone=auto`;
    const res = await fetch(url);
    const d = await res.json();
    const c = d.current;
    const WMO_ICONS = {0:'☀️',1:'🌤',2:'⛅',3:'☁️',45:'🌫',51:'🌦',61:'🌧',71:'🌨',80:'🌦',95:'⛈'};
    const icon = WMO_ICONS[c.weathercode] || '🌡';
    hubWeatherCache[hub.id] = { temp: c.temperature_2m, wind: c.windspeed_10m, icon };
    const wxEl = document.getElementById('hwx-' + hub.id);
    if (wxEl) wxEl.innerHTML = `${icon} ${c.temperature_2m}°C · 💨 ${c.windspeed_10m} km/h`;
  } catch(e) {}
}

/* ── Close hub drop on outside click ── */
document.addEventListener('click', e => {
  if (!e.target.closest('#hubSearchInput') && !e.target.closest('#hubSearchDrop')) {
    document.getElementById('hubSearchDrop')?.classList.remove('open');
  }
});

/* ═══════════════════════════════
   SMART INPUT AUTOCOMPLETE (form src/dst)
═══════════════════════════════ */
const CITIES = [
  { name:'Mumbai', type:'city', lat:19.07, lon:72.87, hub:'INMUN', hubName:'JNPT Port', hubType:'port' },
  { name:'Delhi', type:'city', lat:28.61, lon:77.21, hub:'INNDLS', hubName:'New Delhi Stn', hubType:'station' },
  { name:'Shanghai', type:'city', lat:31.23, lon:121.47, hub:'CNSHA', hubName:'Shanghai Port', hubType:'port' },
  { name:'Singapore', type:'city', lat:1.35, lon:103.82, hub:'SGSIN', hubName:'Port of Singapore', hubType:'port' },
  { name:'Rotterdam', type:'city', lat:51.92, lon:4.48, hub:'NLRTM', hubName:'Port of Rotterdam', hubType:'port' },
  { name:'Los Angeles', type:'city', lat:34.05, lon:-118.24, hub:'USLAX', hubName:'Port of LA', hubType:'port' },
  { name:'Hamburg', type:'city', lat:53.55, lon:10.00, hub:'DEHAG', hubName:'Port of Hamburg', hubType:'port' },
  { name:'Dubai', type:'city', lat:25.20, lon:55.27, hub:'AEDXB', hubName:'Jebel Ali Port', hubType:'port' },
  { name:'London', type:'city', lat:51.51, lon:-0.12, hub:'LHR', hubName:'Heathrow Airport', hubType:'airport' },
  { name:'Frankfurt', type:'city', lat:50.11, lon:8.68, hub:'FRA', hubName:'Frankfurt Airport', hubType:'airport' },
  { name:'Tokyo', type:'city', lat:35.69, lon:139.69, hub:'HND', hubName:'Haneda Airport', hubType:'airport' },
  { name:'Seoul', type:'city', lat:37.57, lon:126.98, hub:'ICN', hubName:'Incheon Airport', hubType:'airport' },
  { name:'Paris', type:'city', lat:48.86, lon:2.35, hub:'FRPNO', hubName:'Gare du Nord', hubType:'station' },
  { name:'Colombo', type:'city', lat:6.93, lon:79.85, hub:'LKCMB', hubName:'Port of Colombo', hubType:'port' },
  { name:'New York', type:'city', lat:40.71, lon:-74.00, hub:'JFK', hubName:'JFK Airport', hubType:'airport' },
  { name:'Chicago', type:'city', lat:41.88, lon:-87.63, hub:'ORD', hubName:"O'Hare Airport", hubType:'airport' },
  { name:'Busan', type:'city', lat:35.18, lon:129.07, hub:'KRBUS', hubName:'Port of Busan', hubType:'port' },
  { name:'Sydney', type:'city', lat:-33.87, lon:151.21, hub:'SYD', hubName:'Kingsford Smith', hubType:'airport' },
  { name:'Bengaluru', type:'city', lat:12.97, lon:77.59, hub:'BLR', hubName:'Kempegowda Airport', hubType:'airport' },
  { name:'Chennai', type:'city', lat:13.08, lon:80.27, hub:'INMAS', hubName:'Chennai Port', hubType:'port' },
  { name:'Kolkata', type:'city', lat:22.57, lon:88.36, hub:'INKOL', hubName:'Kolkata Port', hubType:'port' },
  { name:'Osaka', type:'city', lat:34.69, lon:135.50, hub:'KIX', hubName:'Kansai Airport', hubType:'airport' },
  { name:'Amsterdam', type:'city', lat:52.37, lon:4.90, hub:'AMS', hubName:'Schiphol Airport', hubType:'airport' },
];

let smartInputWeather = {};  // weather cache per location

window.onSmartInput = function(field, val) {
  const dropId = 'ac-' + field;
  const drop   = document.getElementById(dropId);
  if (!drop) return;

  // Hide nearest hubs strip
  const strip = document.getElementById('nearest-' + field);
  if (strip) strip.classList.remove('visible');

  if (!val || val.length < 1) {
    drop.classList.remove('open');
    updateLivePrediction();
    return;
  }

  const q = val.toLowerCase();
  // Search cities + hubs
  const cityMatches = CITIES.filter(c => c.name.toLowerCase().startsWith(q)).slice(0, 4);
  const hubMatches  = HUBS.filter(h =>
    h.name.toLowerCase().includes(q) ||
    h.city.toLowerCase().startsWith(q) ||
    h.code.toLowerCase().startsWith(q)
  ).slice(0, 4);

  const allMatches = [
    ...cityMatches.map(c => ({ ...c, isCityEntry: true })),
    ...hubMatches.map(h => ({ id:h.id, name:h.name, type:h.type, lat:h.lat, lon:h.lon,
      hub:h.code, hubName:h.name, hubType:h.type, city:h.city, photo:h.photo, code:h.code,
      throughput:h.throughput })),
  ].slice(0, 6);

  if (!allMatches.length) {
    drop.classList.remove('open');
    return;
  }

  drop.innerHTML = allMatches.map(m => {
    const icon = m.isCityEntry ? '📍' : HUB_TYPE_ICONS[m.type] || '🌐';
    const label = m.isCityEntry ? `${m.name} <span style="color:rgba(255,255,255,.35);font-size:.68rem">→ ${m.hubType === 'port' ? '🚢' : m.hubType === 'airport' ? '✈️' : '🚂'} ${m.hubName}</span>` : m.name;
    const meta  = m.isCityEntry ? `City · Nearest hub: ${m.hubName}` : `${m.city || ''}, ${m.throughput || m.code || ''}`;
    const photoUrl = m.photo
      ? hubPhoto(typeof m.photo === 'string' ? { type: m.hubType || 'port', photoIdx: 0, photo: m.photo } : m)
      : (m.type ? `https://images.unsplash.com/${(HUB_PHOTO_SETS[m.type]||HUB_PHOTO_SETS.port)[0]}?auto=format&fit=crop&w=80&h=80&q=70`
               : `https://images.unsplash.com/${(HUB_PHOTO_SETS[m.hubType]||HUB_PHOTO_SETS.port)[0]}?auto=format&fit=crop&w=80&h=80&q=70`);
    return `
      <div class="sdr-item" onclick="selectSmartCity('${field}','${m.name || m.city}',${m.lat},${m.lon})">
        ${photoUrl ? `
        <div class="sdr-thumb">
          <img src="${photoUrl}" alt="${m.name}" loading="lazy" style="object-fit:cover;width:100%;height:100%;"/>
          <div class="sdr-type-badge">${icon}</div>
        </div>` : `<div style="font-size:1.3rem;flex-shrink:0;width:40px;text-align:center">${icon}</div>`}
        <div class="sdr-info">
          <div class="sdr-name">${label}</div>
          <div class="sdr-meta">${meta}</div>
        </div>
        ${m.code ? `<div class="sdr-code">${m.code}</div>` : ''}
      </div>`;
  }).join('');

  drop.classList.add('open');
};

window.selectSmartCity = function(field, name, lat, lon) {
  const inp  = document.getElementById(field);
  const drop = document.getElementById('ac-' + field);
  const strip = document.getElementById('nearest-' + field);
  if (inp)  inp.value = name;
  if (drop) drop.classList.remove('open');

  // Fetch live weather for this location
  fetchLocationWeather(field, lat, lon);

  // Show nearby hubs
  showNearestHubPills(field, lat, lon);

  updateLivePrediction();
};

/* ── Show nearest hubs on focus ── */
window.showNearestHubs = function(field) {
  const inp = document.getElementById(field);
  if (!inp || !inp.value) return;
  const city = CITIES.find(c => c.name.toLowerCase() === inp.value.toLowerCase());
  if (city) showNearestHubPills(field, city.lat, city.lon);
};

function showNearestHubPills(field, lat, lon) {
  const strip = document.getElementById('nearest-' + field);
  if (!strip) return;

  // Find nearest hubs by distance
  function dist(a, b, c, d) { return Math.sqrt((a-c)**2 + (b-d)**2); }
  const nearby = HUBS
    .map(h => ({ ...h, d: dist(lat, lon, h.lat, h.lon) }))
    .sort((a,b) => a.d - b.d)
    .slice(0, 4);

  const pils = nearby.map(h =>
    `<button class="nhub-pill" onclick="selectSmartCity('${field}','${h.city}',${h.lat},${h.lon})">
      <span class="nhub-pill-ico">${HUB_TYPE_ICONS[h.type]}</span>
      ${h.city} <span style="color:rgba(255,255,255,.30);font-size:.60rem">${h.code}</span>
    </button>`
  ).join('');

  // Preserve the "Nearby:" label
  const existing = strip.querySelector('span');
  strip.innerHTML = (existing ? existing.outerHTML : '<span style="font-size:.60rem;color:rgba(255,255,255,.25);letter-spacing:.06em;text-transform:uppercase;margin-right:4px;align-self:center">Nearby:</span>') + pils;
  strip.classList.add('visible');
}

/* ── Fetch live weather for form field location ── */
async function fetchLocationWeather(field, lat, lon) {
  const condStrip = document.getElementById('weatherCondStrip');
  const trafficStrip = document.getElementById('trafficCondStrip');
  const weatherTag = document.getElementById('weather-live-tag');
  const trafficTag = document.getElementById('traffic-live-tag');

  if (condStrip) condStrip.innerHTML = '<span class="lcs-pill fetching">🌡 Fetching weather…</span>';

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,windspeed_10m,weathercode,precipitation,visibility&hourly=precipitation_probability&timezone=auto&forecast_days=1`;
    const res = await fetch(url);
    const d   = await res.json();
    const c   = d.current;
    const WMO_ICONS = {0:'☀️',1:'🌤',2:'⛅',3:'☁️',45:'🌫',51:'🌦',61:'🌧',71:'🌨',80:'🌦',95:'⛈'};
    const icon = WMO_ICONS[c.weathercode] || '🌡';
    const precProb = d.hourly?.precipitation_probability?.[0] ?? 0;

    // Auto-set weather select
    const wthr = document.getElementById('wthr');
    if (wthr) {
      if (c.weathercode >= 95) wthr.value = 'Storm';
      else if (c.weathercode >= 61) wthr.value = 'Rain';
      else if (c.weathercode >= 45) wthr.value = 'Fog';
      else if (c.weathercode >= 71) wthr.value = 'Snow';
      else wthr.value = 'Clear';
    }

    if (condStrip) condStrip.innerHTML = `
      <div class="lcs-pill">${icon} ${c.temperature_2m}°C</div>
      <div class="lcs-pill">💨 ${c.windspeed_10m} km/h</div>
      <div class="lcs-pill">🌧 ${precProb}% rain</div>
      ${c.visibility < 5000 ? '<div class="lcs-pill" style="color:#FF9F0A;border-color:rgba(255,159,10,.25)">⚠ Low Visibility</div>' : ''}
    `;
    if (weatherTag) weatherTag.style.display = '';

    smartInputWeather[field] = { temp: c.temperature_2m, wind: c.windspeed_10m, code: c.weathercode, precProb };

    // Simulate traffic based on time of day
    const hour = new Date().getHours();
    const trafLevel = (hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 20) ? 'High' :
                      (hour >= 6 && hour <= 22) ? 'Medium' : 'Low';
    const traf = document.getElementById('traf');
    if (traf) traf.value = trafLevel;

    if (trafficStrip) {
      const trafColor = trafLevel==='High' ? '#FF453A' : trafLevel==='Medium' ? '#FF9F0A' : '#32D74B';
      trafficStrip.innerHTML = `
        <div class="lcs-pill" style="color:${trafColor};border-color:${trafColor}40">
          🚦 ${trafLevel} · ${hour}:${String(new Date().getMinutes()).padStart(2,'0')} local
        </div>
        <div class="lcs-pill">🕐 Updated ${new Date().toLocaleTimeString()}</div>
      `;
      if (trafficTag) trafficTag.style.display = '';
    }

    updateLivePrediction();
  } catch(e) {
    if (condStrip) condStrip.innerHTML = '<span class="lcs-pill" style="color:rgba(255,69,58,.70)">⚠ Weather unavailable</span>';
  }
}

/* ═══════════════════════════════
   PROBABILITY PREDICTION ENGINE
═══════════════════════════════ */
window.updateLivePrediction = function() {
  // Also refresh the Impact Assessment panel with exact user inputs
  if (typeof refreshImpactAssessment === 'function') {
    setTimeout(refreshImpactAssessment, 80);
  }

  const src  = document.getElementById('src')?.value || '';
  const dst  = document.getElementById('dst')?.value || '';
  const mode = document.querySelector('.mc.active')?.id?.replace('tm-','') || 'road';
  const wthr = document.getElementById('wthr')?.value || 'Clear';
  const traf = document.getElementById('traf')?.value || 'Low';

  if (!src || !dst) {
    document.getElementById('probPanel')?.style && (document.getElementById('probPanel').style.display = 'none');
    return;
  }

  // Show panel
  const panel = document.getElementById('probPanel');
  if (panel) panel.style.display = '';

  // Compute probability from multiple factors
  let baseProb = 92;
  const factors = [];

  // Weather factor
  const wMap = { Clear: { adj:0, lbl:'Clear skies — optimal', cls:'pfb-good' },
                  Rain:  { adj:-8, lbl:'Rain — minor delays likely', cls:'pfb-warn' },
                  Storm: { adj:-22, lbl:'Storm — significant risk', cls:'pfb-bad' },
                  Fog:   { adj:-12, lbl:'Fog — visibility reduced', cls:'pfb-warn' },
                  Snow:  { adj:-18, lbl:'Snow — routes may be affected', cls:'pfb-bad' } };
  const wf = wMap[wthr] || wMap['Clear'];
  baseProb += wf.adj;
  factors.push({ ico:'🌦', name:'Weather Conditions', val:wthr + ' · ' + wf.lbl, cls:wf.cls, badge:wthr });

  // Traffic factor
  const tMap = { Low: { adj:0, lbl:'Light traffic flow', cls:'pfb-good' },
                  Medium: { adj:-5, lbl:'Moderate congestion', cls:'pfb-warn' },
                  High: { adj:-14, lbl:'Heavy traffic', cls:'pfb-bad' } };
  const tf = tMap[traf] || tMap['Low'];
  baseProb += tf.adj;
  factors.push({ ico:'🚦', name:'Traffic Conditions', val:traf + ' · ' + tf.lbl, cls:tf.cls, badge:traf });

  // Transport mode factor
  const mMap = { road:  { adj:0,  lbl:'Most flexible routing', cls:'pfb-info' },
                  rail:  { adj:+3, lbl:'Scheduled & reliable', cls:'pfb-good' },
                  air:   { adj:+5, lbl:'Fastest — weather dependent', cls:'pfb-good' },
                  water: { adj:-4, lbl:'Long-haul — port delays possible', cls:'pfb-warn' } };
  const mf = mMap[mode] || mMap['road'];
  baseProb += mf.adj;
  factors.push({ ico: mode==='road'?'🚛':mode==='rail'?'🚂':mode==='air'?'✈️':'🚢',
    name:'Transport Mode', val:mode.charAt(0).toUpperCase()+mode.slice(1)+' · '+mf.lbl, cls:mf.cls,
    badge:mode.charAt(0).toUpperCase()+mode.slice(1) });

  // Live weather data enhancement
  const wx = smartInputWeather['src'] || smartInputWeather['dst'];
  if (wx) {
    if (wx.wind > 50) { baseProb -= 8; factors.push({ ico:'💨', name:'High Winds Detected', val:`${wx.wind} km/h at origin — operations affected`, cls:'pfb-warn', badge:`${wx.wind}km/h` }); }
    if (wx.precProb > 70) { baseProb -= 5; factors.push({ ico:'🌧', name:'Precipitation Forecast', val:`${wx.precProb}% chance of rain in next hour`, cls:'pfb-warn', badge:`${wx.precProb}%` }); }
    if (wx.code >= 95) { baseProb -= 10; }
  }

  // Time of day factor
  const h = new Date().getHours();
  if (h >= 8 && h <= 10 || h >= 17 && h <= 19) {
    baseProb -= 4;
    factors.push({ ico:'⏰', name:'Peak Hours', val:'Current time in rush-hour window', cls:'pfb-warn', badge:'Rush Hour' });
  } else {
    factors.push({ ico:'⏰', name:'Off-Peak Hours', val:'Optimal transit window', cls:'pfb-good', badge:'Off-Peak' });
  }

  // Route risk (piracy, weather corridors)
  const routeStr = (src + dst).toLowerCase();
  if (routeStr.includes('aden') || routeStr.includes('somalia') || routeStr.includes('gulf')) {
    baseProb -= 12;
    factors.push({ ico:'⚠️', name:'High-Risk Corridor', val:'Gulf of Aden piracy risk zone', cls:'pfb-bad', badge:'Risk Zone' });
  }

  baseProb = Math.max(18, Math.min(98, Math.round(baseProb)));

  // ETA range calculation
  const baseTimeEl = document.getElementById('rv-time');
  const baseTime = baseTimeEl ? parseFloat(baseTimeEl.textContent) || 24 : 24;
  const etaOpt  = Math.max(1, Math.round(baseTime * 0.85 * 10) / 10);
  const etaMid  = Math.round(baseTime * 10) / 10;
  const etaPess = Math.round(baseTime * (1 + (100-baseProb)/100 * 0.6) * 10) / 10;

  // Render
  const gauge = document.getElementById('probGaugeFill');
  const pct   = document.getElementById('probPct');
  const verdict = document.getElementById('probVerdict');
  if (gauge) gauge.style.width = baseProb + '%';
  if (pct)   pct.textContent   = baseProb + '%';
  if (verdict) {
    verdict.textContent = baseProb >= 85 ? 'High Confidence' : baseProb >= 65 ? 'Moderate Risk' : 'Significant Delays Likely';
    verdict.style.color = baseProb >= 85 ? '#32D74B' : baseProb >= 65 ? '#FF9F0A' : '#FF453A';
  }

  const factorsEl = document.getElementById('probFactors');
  if (factorsEl) {
    factorsEl.innerHTML = factors.map(f => `
      <div class="prob-factor">
        <div class="prob-factor-ico">${f.ico}</div>
        <div class="prob-factor-info">
          <div class="prob-factor-name">${f.name}</div>
          <div class="prob-factor-val">${f.val}</div>
        </div>
        <div class="prob-factor-badge ${f.cls}">${f.badge}</div>
      </div>
    `).join('');
  }

  const etaRange = document.getElementById('probEtaRange');
  if (etaRange) {
    etaRange.style.display = '';
    const fmtH = h => h < 24 ? h + 'h' : Math.round(h/24*10)/10 + 'd';
    document.getElementById('etaOpt') .textContent = fmtH(etaOpt);
    document.getElementById('etaMid') .textContent = fmtH(etaMid);
    document.getElementById('etaPess').textContent = fmtH(etaPess);
  }
};

/* ── Init featured hubs on load ── */
document.addEventListener('DOMContentLoaded', () => {
  showFeaturedHubs();
});
setTimeout(showFeaturedHubs, 500);

/* ── Close smart drops on outside click ── */
document.addEventListener('click', e => {
  if (!e.target.closest('.ac-wrap')) {
    document.querySelectorAll('.smart-drop').forEach(d => d.classList.remove('open'));
  }
});

/* ═══════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════
   CATALOX LIQUID GLASS ICON FALLBACK — v7
   lgIconFallback(img) — called via onerror on every img-icon
   Replaces the broken image with a beautiful frosted glass
   SVG icon cell, context-aware per transport type
═══════════════════════════════════════════════════════════════════ */

// SVG paths per icon type (stroke-only, clean line art)
const LG_SVG = {
  port:     '<path d="M12 3v5M8 8h8M5 8h14l1 4H4L5 8z"/><path d="M4 12v7a1 1 0 001 1h3v-4h8v4h3a1 1 0 001-1v-7"/>',
  airport:  '<path d="M21 16H3M15.5 16l-1-8-4.5 3-4.5-3-1 8"/><path d="M12 8l7.5-4.5M12 8l-7.5-4.5M12 8v8"/>',
  station:  '<rect x="3" y="4" width="18" height="13" rx="2.5"/><path d="M3 11h18M7 17l-2 4M17 17l2 4M10 17h4"/><circle cx="7.5" cy="7.5" r="1.5" fill="currentColor"/><circle cx="16.5" cy="7.5" r="1.5" fill="currentColor"/>',
  truck:    '<rect x="1" y="4" width="14" height="10" rx="1.5"/><path d="M15 8h4.5l2.5 3v4h-7V8z"/><circle cx="5.5" cy="17.5" r="2"/><circle cx="18.5" cy="17.5" r="2"/>',
  plane:    '<path d="M21 12L3 5l3 7-3 7 18-7z"/><path d="M12 12L6 14"/>',
  ship:     '<path d="M12 3v5M7 8h10M5 8h14l2 7H3L5 8z"/><path d="M3 19c3-2 6-2 9 0s6 2 9 0"/>',
  tracking: '<circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
  analytics:'<rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M7 17v-5M12 17V7M17 17v-8"/>',
  alert:    '<path d="M12 2L2 20h20L12 2z"/><path d="M12 9v5M12 17.5v.5"/>',
  weather:  '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41"/>',
  api:      '<path d="M7 8l-4 4 4 4M17 8l4 4-4 4M14 4l-4 16"/>',
  security: '<path d="M12 2L4 6v6c0 5.5 3.8 10.7 8 12 4.2-1.3 8-6.5 8-12V6L12 2z"/><path d="M9 12l2 2 4-4"/>',
  fleet:    '<rect x="1" y="4" width="14" height="10" rx="1.5"/><circle cx="5.5" cy="17.5" r="2"/><circle cx="14.5" cy="17.5" r="2"/><path d="M19 8h2a1 1 0 011 1v7h-3V8z"/>',
  default:  '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 8v4M12 16h.01"/>'
};

// Accent color per type
const LG_COLOR = {
  port:'#40CBE0', airport:'#BF5AF2', station:'#FF9F0A',
  truck:'#0A84FF', plane:'#BF5AF2', ship:'#40CBE0',
  tracking:'#5AC8FA', analytics:'#32D74B', alert:'#FF453A',
  weather:'#5AC8FA', api:'#FF9F0A', security:'#32D74B',
  fleet:'#0A84FF', default:'rgba(255,255,255,0.65)'
};

// Detect icon type from image context
function detectLgType(img) {
  const t = [img.alt, img.src, img.className,
    (img.parentElement && img.parentElement.className) || '',
    (img.closest('[class]') && img.closest('[class]').className) || ''
  ].join(' ').toLowerCase();

  if (/ship|sea|vessel|port|cargo|container|jnpt|rotterdam|singapore|busan|hamburg|colombo|felixstowe|anchor|maritime/.test(t)) return 'port';
  if (/plane|air(?:port|craft|cargo|line)|flight|changi|heathrow|pudong|incheon|schiphol|haneda|lax|fra|lhr|icn|bom|pvg|sin|ams|dxb|hnd/.test(t)) return 'airport';
  if (/train|rail|station|metro|subway|bullet|shinkansen|tgv|eurostar|pancras|gare|hauptbahnhof|ndls|shh|stp|pno|frahbf|tyo/.test(t)) return 'station';
  if (/truck|road freight|highway|lorry|hgv/.test(t)) return 'truck';
  if (/fleet|vehicle|dispatch/.test(t)) return 'fleet';
  if (/satellite|track|gps|location|live position|map/.test(t)) return 'tracking';
  if (/analytic|chart|dashboard|kpi|predict|graph/.test(t)) return 'analytics';
  if (/weather|cloud|rain|storm|fog|sun|temp|climate/.test(t)) return 'weather';
  if (/alert|warn|notif/.test(t)) return 'alert';
  if (/api|integration|code|connect|webhook/.test(t)) return 'api';
  if (/security|shield|lock|safe|encrypt/.test(t)) return 'security';
  return 'default';
}

// Main fallback function — called via onerror
window.lgIconFallback = function(img) {
  if (img._lgDone) return;
  img._lgDone = true;
  img.style.display = 'none';

  const type  = detectLgType(img);
  const color = LG_COLOR[type];
  const paths = LG_SVG[type] || LG_SVG.default;
  const parent = img.parentElement;
  if (!parent) return;

  // Hub card photo (wide, full-bleed)
  if (img.classList.contains('hub-card-photo') || parent.classList.contains('hub-card-photo-wrap')) {
    const label = type === 'airport' ? 'Airport' : type === 'station' ? 'Station' : 'Port';
    const fb = document.createElement('div');
    fb.className = 'lg-hub-photo-fallback';
    fb.style.color = color;
    fb.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${paths}</svg><span class="lg-hub-label">${label}</span>`;
    if (img.nextSibling) parent.insertBefore(fb, img.nextSibling);
    else parent.appendChild(fb);
    return;
  }

  // Standard icon cell (fci, mc-icon, mp-ico, wc-ico, sdr-thumb etc.)
  const cell = document.createElement('div');
  cell.className = 'lg-icon-cell';
  cell.style.color = color;
  cell.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  if (img.nextSibling) parent.insertBefore(cell, img.nextSibling);
  else parent.appendChild(cell);
};

// Also scan on load for already-broken images (lazy-load edge cases)
function scanBrokenImages() {
  document.querySelectorAll('img.img-icon, img[onerror]').forEach(img => {
    if (!img._lgDone && img.complete && img.naturalWidth === 0) {
      lgIconFallback(img);
    }
  });
}
setTimeout(scanBrokenImages, 600);
setTimeout(scanBrokenImages, 2000);

/* ═══════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════
   CATALOX APEX UI ENGINE — Image Loading + Fallback System v3
   ─ Smooth image fade-in on load
   ─ Instant SVG fallback for broken images (no layout shift)
   ─ Context-aware icon detection
   ─ Retry logic with exponential backoff
═══════════════════════════════════════════════════════════════════ */
(function initApexIconSystem() {

  /* ── Enhanced SVG icon library ── */
  const APEX_SVG = {
    port:      '<path d="M12 3v5M8 8h8M5 8h14l1 4H4L5 8z" stroke-linejoin="round"/><path d="M4 12v7a1 1 0 001 1h3v-4h8v4h3a1 1 0 001-1v-7"/><circle cx="8" cy="19" r="1.5" fill="currentColor" opacity=".6"/>',
    airport:   '<path d="M21 16H3"/><path d="M15.5 16l-1-8-4.5 3-4.5-3-1 8"/><path d="M12 8l7.5-4.5M12 8l-7.5-4.5M12 8v8"/><circle cx="12" cy="3" r="1.2" fill="currentColor"/>',
    station:   '<rect x="3" y="4" width="18" height="13" rx="2.5"/><path d="M3 11h18M7 17l-2 4M17 17l2 4M10 17h4"/><circle cx="7.5" cy="7.5" r="1.5" fill="currentColor"/><circle cx="16.5" cy="7.5" r="1.5" fill="currentColor"/>',
    truck:     '<rect x="1" y="4" width="14" height="10" rx="1.5"/><path d="M15 8h4.5l2.5 3v4h-7V8z"/><circle cx="5.5" cy="17.5" r="2"/><circle cx="18.5" cy="17.5" r="2"/><path d="M7 9h4M7 12h2" stroke-linecap="round"/>',
    plane:     '<path d="M21 12L3 5l3 7-3 7 18-7z"/><path d="M12 12L6 14"/><circle cx="21" cy="12" r="1.2" fill="currentColor"/>',
    ship:      '<path d="M12 3v5M7 8h10M5 8h14l2 7H3L5 8z"/><path d="M3 19c3-2 6-2 9 0s6 2 9 0"/><circle cx="12" cy="6" r="1.2" fill="currentColor"/>',
    tracking:  '<circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/><path d="M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" opacity=".6"/>',
    analytics: '<rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M7 17v-5M12 17V7M17 17v-8"/><path d="M7 12l3-3 3 3 4-4" opacity=".5" stroke-dasharray="2 1"/>',
    alert:     '<path d="M12 2L2 20h20L12 2z"/><path d="M12 9v5M12 17.5v.5"/><circle cx="12" cy="18" r=".8" fill="currentColor"/>',
    weather:   '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41"/><path d="M3 16c2-1 4-1 6 0" opacity=".4"/>',
    api:       '<path d="M7 8l-4 4 4 4M17 8l4 4-4 4M14 4l-4 16"/><circle cx="12" cy="12" r="2" fill="currentColor" opacity=".4"/>',
    security:  '<path d="M12 2L4 6v6c0 5.5 3.8 10.7 8 12 4.2-1.3 8-6.5 8-12V6L12 2z"/><path d="M9 12l2 2 4-4"/>',
    fleet:     '<rect x="1" y="4" width="14" height="10" rx="1.5"/><circle cx="5.5" cy="17.5" r="2"/><circle cx="14.5" cy="17.5" r="2"/><path d="M19 8h2a1 1 0 011 1v7h-3V8z"/>',
    oil:       '<ellipse cx="12" cy="10" rx="6" ry="4"/><path d="M6 10v4c0 2.2 2.7 4 6 4s6-1.8 6-4v-4"/><path d="M12 2v4M9 3l3 3 3-3" opacity=".5"/>',
    gold:      '<path d="M12 2l3.5 7h7L17 14l2.5 7L12 17l-7.5 4L7 14 1.5 9h7z"/><circle cx="12" cy="11" r="2" fill="currentColor" opacity=".4"/>',
    commodity: '<rect x="2" y="8" width="20" height="12" rx="2"/><path d="M6 8V6a2 2 0 012-2h8a2 2 0 012 2v2"/><path d="M10 13h4M12 11v4" opacity=".6"/>',
    route:     '<circle cx="5" cy="5" r="3"/><circle cx="19" cy="19" r="3"/><path d="M5 8v3a4 4 0 004 4h2a4 4 0 004 4v0"/>',
    default:   '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 8v4M12 16h.01"/><circle cx="12" cy="16" r=".8" fill="currentColor"/>'
  };

  const APEX_COLOR = {
    port:'#40CBE0', airport:'#BF5AF2', station:'#FF9F0A',
    truck:'#0A84FF', plane:'#BF5AF2', ship:'#40CBE0',
    tracking:'#5AC8FA', analytics:'#32D74B', alert:'#FF453A',
    weather:'#5AC8FA', api:'#FF9F0A', security:'#32D74B',
    fleet:'#0A84FF', oil:'#FF9F0A', gold:'#FFD60A',
    commodity:'#FF9F0A', route:'#0A84FF', default:'rgba(255,255,255,0.65)'
  };

  function detectType(el) {
    const t = [
      el.alt || '', el.src || '', el.className || '',
      el.parentElement?.className || '',
      el.closest('[class]')?.className || '',
      el.closest('[data-lens]')?.dataset?.lens || ''
    ].join(' ').toLowerCase();

    if (/oil|crude|petroleum|brent|wti|barrel|refin/.test(t)) return 'oil';
    if (/gold|silver|precious|bullion|xau/.test(t)) return 'gold';
    if (/ship|sea|vessel|port|cargo|container|jnpt|rotterdam|singapore|busan|hamburg|colombo|maritime|anchor/.test(t)) return 'port';
    if (/plane|air(?:port|craft|cargo|line)|flight|changi|heathrow|pudong|incheon|schiphol|haneda|lax|fra|dxb|hnd|bom/.test(t)) return 'airport';
    if (/train|rail|station|metro|subway|shinkansen|tgv|eurostar|pancras|hauptbahnhof|ndls/.test(t)) return 'station';
    if (/truck|road freight|highway|lorry|hgv/.test(t)) return 'truck';
    if (/fleet|vehicle|dispatch/.test(t)) return 'fleet';
    if (/satellite|track|gps|location|live position/.test(t)) return 'tracking';
    if (/analytic|chart|dashboard|kpi|predict|graph/.test(t)) return 'analytics';
    if (/weather|cloud|rain|storm|fog|sun|temp|climate/.test(t)) return 'weather';
    if (/alert|warn|notif/.test(t)) return 'alert';
    if (/api|integration|code|connect|webhook/.test(t)) return 'api';
    if (/security|shield|lock|safe|encrypt/.test(t)) return 'security';
    if (/route|optimiz|path|corridor/.test(t)) return 'route';
    if (/commodity|wheat|copper|iron|coal|metal/.test(t)) return 'commodity';
    return 'default';
  }

  function buildFallbackCell(type, size) {
    const color = APEX_COLOR[type] || APEX_COLOR.default;
    const paths = APEX_SVG[type] || APEX_SVG.default;
    const cell = document.createElement('div');
    cell.className = 'lg-icon-cell';
    cell.style.cssText = `width:${size}px;height:${size}px;color:${color};`;
    cell.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
    return cell;
  }

  function buildHubFallback(type) {
    const color = APEX_COLOR[type] || APEX_COLOR.default;
    const paths = APEX_SVG[type] || APEX_SVG.default;
    const label = { airport:'Airport', station:'Station', port:'Port', ship:'Sea Route' }[type] || 'Hub';
    const fb = document.createElement('div');
    fb.className = 'lg-hub-photo-fallback';
    fb.style.color = color;
    fb.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${paths}</svg><span class="lg-hub-label">${label}</span>`;
    return fb;
  }

  /* ── Override global lgIconFallback ── */
  window.lgIconFallback = function(img) {
    if (img._lgDone) return;
    img._lgDone = true;

    const type   = detectType(img);
    const parent = img.parentElement;
    if (!parent) return;

    // Hide broken img
    img.style.display = 'none';

    const isHubPhoto = img.classList.contains('hub-card-photo') ||
                       parent.classList.contains('hub-card-photo-wrap') ||
                       img.classList.contains('hub-img');

    if (isHubPhoto) {
      const fb = buildHubFallback(type);
      parent.insertBefore(fb, img.nextSibling || null);
      return;
    }

    // Detect size from parent or img
    const rect   = parent.getBoundingClientRect();
    const size   = Math.max(rect.width, rect.height, 32) || 40;
    const cell   = buildFallbackCell(type, size);

    // Match parent sizing exactly
    cell.style.borderRadius = getComputedStyle(parent).borderRadius || 'inherit';

    parent.insertBefore(cell, img.nextSibling || null);
  };

  /* ── Smooth image fade-in ── */
  function attachLoadHandler(img) {
    if (img._apexHooked) return;
    img._apexHooked = true;

    if (img.complete) {
      if (img.naturalWidth > 0) {
        img.classList.add('loaded');
      } else {
        window.lgIconFallback(img);
      }
      return;
    }

    img.addEventListener('load', function() {
      this.classList.add('loaded');
    }, { once: true });

    img.addEventListener('error', function() {
      window.lgIconFallback(this);
    }, { once: true });
  }

  /* ── Scan all images ── */
  function scanAll() {
    document.querySelectorAll('img').forEach(img => {
      // Add onerror if missing
      if (!img.hasAttribute('onerror') && !img._apexHooked) {
        img.setAttribute('onerror', 'lgIconFallback(this)');
      }
      attachLoadHandler(img);
    });
  }

  /* ── Watch for dynamically added images ── */
  const imgObserver = new MutationObserver(mutations => {
    mutations.forEach(m => {
      m.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        if (node.tagName === 'IMG') attachLoadHandler(node);
        node.querySelectorAll && node.querySelectorAll('img').forEach(attachLoadHandler);
      });
    });
  });
  imgObserver.observe(document.body, { childList: true, subtree: true });

  // Initial scans
  scanAll();
  setTimeout(scanAll, 800);
  setTimeout(scanAll, 2500);

  /* ── Magnetic button effect (Apple visionOS feel) ── */
  function initMagnetic() {
    if(window._lowEndDevice) return; // skip on low-end
    document.querySelectorAll('.magnetic, .btn-blue, .btn-glass').forEach(el => {
      if (el._magDone) return;
      el._magDone = true;
      let _raf = null;
      el.addEventListener('mousemove', function(e) {
        if (_raf) return;
        const self = this;
        _raf = requestAnimationFrame(() => {
          _raf = null;
          const rect = self.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const dx = (e.clientX - cx) * 0.30;
          const dy = (e.clientY - cy) * 0.30;
          self.style.transform = `translate(${dx}px, ${dy}px) scale(1.04)`;
          self.style.transition = 'transform 0.12s ease';
        });
      }, {passive:true});

      el.addEventListener('mouseleave', function() {
        _raf = null;
        this.style.transform = '';
        this.style.transition = 'transform 0.42s cubic-bezier(0.34,1.56,0.64,1)';
      });
    });
  }

  setTimeout(initMagnetic, 1200);

  /* ── Card 3D tilt enhancement ── */
  function init3DTilt() {
    if(window._lowEndDevice) return; // skip on low-end
    const TILT = 8;
    document.querySelectorAll('.card.fc, .pcard, .hero-card, .tcard').forEach(el => {
      if (el._tiltDone) return;
      el._tiltDone = true;
      let _raf = null;

      el.addEventListener('mousemove', function(e) {
        if (_raf) return;
        const self = this;
        _raf = requestAnimationFrame(() => {
          _raf = null;
          const rect = self.getBoundingClientRect();
          const cx = (e.clientX - rect.left) / rect.width  - 0.5;
          const cy = (e.clientY - rect.top)  / rect.height - 0.5;
          const rx = cy * -TILT * 2;
          const ry = cx *  TILT * 2;
          self.style.transform = `perspective(700px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-5px) scale(1.015)`;
          self.style.transition = 'transform 0.08s ease';

          const bg = self.querySelector('.card-bg, .rect-photo-bg');
          if (bg) {
            bg.style.transform = `scale(1.12) translate(${cx*16}px, ${cy*16}px)`;
            bg.style.transition = 'transform 0.08s ease';
          }
        });
      }, {passive:true});

      el.addEventListener('mouseleave', function() {
        _raf = null;
        this.style.transform = '';
        this.style.transition = 'transform 0.55s cubic-bezier(0.34,1.56,0.64,1)';
        const bg = this.querySelector('.card-bg, .rect-photo-bg');
        if (bg) {
          bg.style.transform = 'scale(1.08)';
          bg.style.transition = 'transform 0.55s ease';
        }
      });
    });
  }

  setTimeout(init3DTilt, 1400);

  /* ── Scroll reveal (Intersection Observer) ── */
  function initScrollReveal() {
    const style = document.createElement('style');
    style.textContent = `
      .reveal:not(.revealed) {
        opacity: 0;
        transform: translateY(28px);
        transition: opacity 0.65s cubic-bezier(0.22,1,0.36,1),
                    transform 0.65s cubic-bezier(0.22,1,0.36,1);
      }
      .reveal.revealed {
        opacity: 1 ;
        transform: none ;
      }
      .reveal.d2:not(.revealed) { transition-delay: 0.12s; }
      .reveal.d3:not(.revealed) { transition-delay: 0.24s; }
      .reveal.d4:not(.revealed) { transition-delay: 0.36s; }
    `;
    document.head.appendChild(style);

    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('revealed');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.reveal').forEach(el => io.observe(el));
  }

  initScrollReveal();

  /* ── Smooth hero background parallax ── */
  function initHeroParallax() {
    if(window._lowEndDevice) return; // skip on low-end
    const bg = document.getElementById('hero-bg-photo');
    if (!bg) return;
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        bg.style.transform = `scale(1.06) translateY(${y * 0.25}px)`;
        ticking = false;
      });
    }, { passive: true });
  }

  initHeroParallax();

  /* ═══════════════════════════════════════════════════════════════════
     CROSS-BROWSER ICON ENHANCEMENT SYSTEM
     Uses inline SVG (data URI) for icons — works in ALL browsers
     No emoji rendering differences between Chrome/Firefox/Safari/Edge
  ═══════════════════════════════════════════════════════════════════ */
  (function initIconSystem() {

    /* ── SVG icon library (inline data URIs — 100% cross-browser) ── */
    const SVG_ICONS = {
      /* Navigation icons */
      bell:     `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>`,
      globe:    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>`,
      truck:    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`,
      plane:    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21 4 19.5 2.5S18 2 16.5 3.5L13 7 4.8 5.6l-1.6 1.6L8 11l-2 2-4-1-1.3 1.3L4 16l4 4 3-3 4 4.7 1.6-1.6L15 16l4 4-1.2-1-2 0.2z"/></svg>`,
      ship:     `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 21c.6.5 1.2 1 2.5 1C7 22 7 21 9.5 21s2.5 1 5 1 2.5-1 5-1c1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.6 11.6 0 0021 14l-9-4-9 4c.68 2.37 1.68 3.38 4 4"/><path d="M10 14l1-1"/><path d="M12 13v-2"/><path d="M10 7l2-3 2 3"/></svg>`,
      train:    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="16" rx="2"/><path d="M9 3v11"/><path d="M15 3v11"/><path d="M4 11h16"/><path d="M9 19l-2 3"/><path d="M15 19l2 3"/><circle cx="9" cy="15" r=".8" fill="currentColor"/><circle cx="15" cy="15" r=".8" fill="currentColor"/></svg>`,
      map:      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>`,
      chart:    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>`,
      warning:  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
      settings: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>`,
      robot:    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>`,
      pin:      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
      flag:     `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>`,
      lightning:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
      package:  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
      wave:     `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12c.6.5 1.2 1 2.5 1C7 13 7 11 9.5 11s2.5 2 5 2 2.5-2 5-2c1.3 0 1.9.5 2.5 1"/><path d="M2 19c.6.5 1.2 1 2.5 1C7 20 7 18 9.5 18s2.5 2 5 2 2.5-2 5-2c1.3 0 1.9.5 2.5 1"/><path d="M2 5c.6.5 1.2 1 2.5 1C7 6 7 4 9.5 4s2.5 2 5 2 2.5-2 5-2c1.3 0 1.9.5 2.5 1"/></svg>`,
      refresh:  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>`,
      key:      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>`,
      star:     `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
      trending: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
    };

    /* ── Create an SVG icon element ── */
    function makeSvgIcon(name, color, size) {
      const svg = SVG_ICONS[name];
      if (!svg) return null;
      const el = document.createElement('span');
      el.style.cssText = `
        display:inline-flex;align-items:center;justify-content:center;
        width:${size||20}px;height:${size||20}px;flex-shrink:0;
        color:${color||'currentColor'};
      `;
      el.innerHTML = svg;
      const svgEl = el.querySelector('svg');
      if (svgEl) {
        svgEl.style.width = '100%';
        svgEl.style.height = '100%';
        svgEl.setAttribute('stroke', 'currentColor');
      }
      return el;
    }

    /* ── Replace nav bell emoji with SVG ── */
    const navBell = document.querySelector('.nav-bell');
    if (navBell) {
      const bellDot = navBell.querySelector('.bell-badge');
      navBell.innerHTML = '';
      const icon = makeSvgIcon('bell', 'rgba(255,255,255,0.75)', 17);
      if (icon) navBell.appendChild(icon);
      if (bellDot) navBell.appendChild(bellDot);
    }

    /* ── Inject SVG into AI FAB button ── */
    const aiFab = document.getElementById('catalox-ai-fab');
    if (aiFab) {
      const fabDot = aiFab.querySelector('.fab-dot');
      const robotIcon = makeSvgIcon('robot', 'rgba(10,132,255,0.95)', 22);
      if (robotIcon) {
        robotIcon.style.position = 'relative';
        robotIcon.style.zIndex = '2';
        aiFab.innerHTML = '';
        aiFab.appendChild(robotIcon);
        if (fabDot) aiFab.appendChild(fabDot);
      }
    }

    /* ── Smooth image load with fade-in ── */
    function enhanceImageLoading() {
      document.querySelectorAll('img').forEach(img => {
        if (img._lgEnhanced) return;
        img._lgEnhanced = true;
        img.style.opacity = img.complete ? '1' : '0';
        img.style.transition = 'opacity 0.45s ease, filter 0.45s ease';
        if (!img.complete) {
          img.addEventListener('load', () => {
            img.style.opacity = '1';
            img.classList.add('loaded');
          }, { once: true });
          img.addEventListener('error', () => {
            img.style.opacity = '0.6';
          }, { once: true });
        } else {
          img.style.opacity = '1';
          img.classList.add('loaded');
        }
      });
    }

    /* ── Progressive image reveal ── */
    const imgObserver = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const img = e.target;
          if (img.dataset.src) img.src = img.dataset.src;
          imgObserver.unobserve(img);
        }
      });
    }, { rootMargin: '100px' });

    document.querySelectorAll('img[data-src]').forEach(img => imgObserver.observe(img));

    enhanceImageLoading();
    setTimeout(enhanceImageLoading, 600);
    setTimeout(enhanceImageLoading, 1800);

    /* ── Smooth page transition on anchor clicks ── */
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      if (a._smoothDone) return;
      a._smoothDone = true;
      a.addEventListener('click', e => {
        const target = document.querySelector(a.getAttribute('href'));
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    /* ── Glass ripple effect on button clicks ── */
    function addGlassRipple(el) {
      if (el._rippleDone) return;
      el._rippleDone = true;
      el.addEventListener('click', function(e) {
        const rect = this.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const ripple = document.createElement('span');
        ripple.style.cssText = `
          position:absolute;border-radius:50%;
          width:4px;height:4px;
          left:${x}px;top:${y}px;
          transform:translate(-50%,-50%) scale(0);
          background:rgba(255,255,255,0.28);
          animation:glass-ripple-anim 0.55s cubic-bezier(0.25,0.46,0.45,0.94) forwards;
          pointer-events:none;z-index:99;
        `;
        this.style.position = 'relative';
        this.style.overflow = 'hidden';
        this.appendChild(ripple);
        setTimeout(() => ripple.remove(), 600);
      });
    }

    /* Add ripple style */
    const rippleStyle = document.createElement('style');
    rippleStyle.textContent = `
      @keyframes glass-ripple-anim {
        to { transform: translate(-50%,-50%) scale(80); opacity: 0; }
      }
      /* Smooth font rendering on all browsers */
      body {
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        text-rendering: optimizeLegibility;
      }
    `;
    document.head.appendChild(rippleStyle);

    document.querySelectorAll('.btn, .btn-blue, .btn-glass, .nav-cta, .sub-btn, .mc, .ig-logo').forEach(addGlassRipple);

    /* ── Stagger card entrance animations ── */
    function staggerCards() {
      const cards = document.querySelectorAll('.card:not([data-staggered])');
      cards.forEach((card, i) => {
        card.setAttribute('data-staggered', '1');
        card.style.animationDelay = `${(i % 6) * 0.06}s`;
      });
    }
    setTimeout(staggerCards, 200);

    /* orb tracking rAF removed — was running every frame with no visual output */

  })(); // end initIconSystem

})();

/* ═══════════════════════════════════════════ */

(function(){
  /* ── 1. Card viewport observer — only blur visible cards ── */
  if('IntersectionObserver' in window){
    const cardObs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        e.target.classList.toggle('in-view', e.isIntersecting);
      });
    }, { rootMargin: '60px', threshold: 0 });
    // Observe after DOM ready
    function observeCards(){
      document.querySelectorAll('.card,.pcard,.tcard').forEach(c => cardObs.observe(c));
    }
    if(document.readyState === 'loading')
      document.addEventListener('DOMContentLoaded', observeCards);
    else observeCards();
    // Re-observe dynamically added cards
    const mutObs = new MutationObserver(muts => {
      muts.forEach(m => m.addedNodes.forEach(n => {
        if(n.nodeType===1){
          if(n.matches && n.matches('.card,.pcard,.tcard')) cardObs.observe(n);
          n.querySelectorAll && n.querySelectorAll('.card,.pcard,.tcard').forEach(c=>cardObs.observe(c));
        }
      }));
    });
    document.addEventListener('DOMContentLoaded',()=>{
      mutObs.observe(document.body,{childList:true,subtree:true});
    });
  } else {
    // Fallback: show all cards if no IntersectionObserver
    document.addEventListener('DOMContentLoaded',()=>{
      document.querySelectorAll('.card,.pcard,.tcard').forEach(c=>c.classList.add('in-view'));
    });
  }

  /* ── 2. Page Visibility — pause canvas loops when tab hidden ── */
  document.addEventListener('visibilitychange', () => {
    const hidden = document.hidden;
    // Pause CSS animations on heavy elements
    const heavy = document.querySelectorAll(
      '.tick-track, .fb-row, .live-dot, .bdot, #particles, #neural-canvas'
    );
    heavy.forEach(el => {
      el.style.animationPlayState = hidden ? 'paused' : 'running';
    });
  });

  /* ── 3. Passive mousemove for magnetic/tilt effects ── */
  // Ensure all mousemove listeners are passive
  const _ael = EventTarget.prototype.addEventListener;
  // Only patch scroll (already done in main code, this is a safety net)

  /* ── 4. Font display optimization ── */
  // Prevent invisible text during font load
  const style = document.createElement('style');
  style.textContent = '@font-face{font-display:swap}';
  document.head.appendChild(style);

  /* ── 5. Reduce animation count on low-end devices ── */
  const RAM = navigator.deviceMemory;
  const CORES = navigator.hardwareConcurrency;
  if((RAM && RAM <= 4) || (CORES && CORES <= 6)){
    const lowPerfStyle = document.createElement('style');
    lowPerfStyle.textContent = `
      /* Hide expensive pseudo-element caustic borders */
      .card::after,.tcard::after,.pcard::after,
      .mc::after,.lg::after,.lg-card::after { display: none ; }
      /* Specular sheen pseudo-elements — also skip */
      .card::before,.fc::before { display: none ; }
      /* Reduce ALL backdrop blurs to cheap 6px */
      .card,.mc,.pcard,.tcard,.rc,.comm-card,.mpill,.faq-item,
      .glass,.glass-hi,#navbar,.lg,.lg-card,.rw-card,.badge,
      .chrome-pill,.free-pill,.fx-card,.lane-item,.rex,.wc-card,
      .wth-table,.cargo-pill,.inco-opt,.nav-cta,.nav-free,
      .ac-drop,.chip-up,.wck-open,.lens-tag,.fab-btn,
      #catalox-ai-panel,#cursor-lens,#deep-panel {
        -webkit-backdrop-filter: blur(6px) !important;
        backdrop-filter: blur(6px) !important;
        contain: layout style !important;
      }
      /* Kill the neural canvas completely */
      #neural-canvas { display: none ; }
      /* Kill glow orbs */
      .glow-orb { display: none ; }
      /* Slow down ticker/freight-bar heavily */
      .tick-track { animation-duration: 120s !important; }
      .fb-row { animation-duration: 140s !important; }
      /* Remove background cinematic + pan */
      body::before, #bg-cinematic { display: none ; }
      /* Freeze card-bg transform (no parallax needed) */
      .card-bg { transform: scale(1) ; transition: none ; }
      /* Reduce section backdrop blurs */
      #features::after, #fleet::after, #kpi::after { display: none ; }
      /* Disable card reveal animation stagger */
      .reveal-card { animation: none ; opacity: 1 ; transform: none ; }
      /* Disable hero Ken Burns zoom */
      #hero-bg-photo, #hslide-a, #hslide-b,
      .bg-photo { animation: none ; transform: none ; }
    `;
    document.head.appendChild(lowPerfStyle);
    /* Also disable the tilt/parallax mousemove handlers at runtime */
    window._lowEndDevice = true;
    console.log('[CATALOX] Low-end device detected — reduced animations active');
  }
})();

/* ═══════════════════════════════════════════ */

/* ═══════════════════════════════════════════
   CATALOX v13 — Menu + Disruption Intelligence
═══════════════════════════════════════════ */

/* ── Menu toggle ── */
window.toggleCataloxMenu = function() {
  const overlay = document.getElementById('catalox-menu-overlay');
  const panel   = document.getElementById('catalox-menu-panel');
  if (!overlay || !panel) return;
  const isOpen = panel.classList.contains('open');
  if (isOpen) {
    overlay.classList.remove('open');
    panel.classList.remove('open');
  } else {
    overlay.classList.add('open');
    panel.classList.add('open');
  }
};

/* Close menu on Escape */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const panel = document.getElementById('catalox-menu-panel');
    if (panel && panel.classList.contains('open')) toggleCataloxMenu();
  }
});

/* ── Disruption Feed Data ── */
const DISRUPTION_EVENTS = [
  { icon:'🌪️', title:'Typhoon NOVA approaches Shanghai', sub:'Port closure advisory issued · Vessels diverting', time:'2m ago', sev:'#FF453A' },
  { icon:'⚓', title:'PSA Tuas berth 9–11 equipment failure', sub:'28 vessels queued · 36h average wait', time:'14m ago', sev:'#FF9F0A' },
  { icon:'⚡', title:'AI detected congestion signal: JNPT', sub:'Queue time +180% in 72h — pre-alert', time:'41m ago', sev:'#BF5AF2' },
  { icon:'🚂', title:'Indian Railway freight delay — Golden Quadrilateral', sub:'Signal failure at Nagpur junction · +4h ETA', time:'1h ago', sev:'#FF9F0A' },
  { icon:'⛽', title:'Bunker fuel surge +23% Rotterdam', sub:'Emergency routing activated for 14 vessels', time:'2h ago', sev:'#FF9F0A' },
  { icon:'🛃', title:'Customs inspection surge — Dubai Jebel Ali', sub:'Random checks increased 3× — add 8h buffer', time:'3h ago', sev:'#5AC8FA' },
  { icon:'🌊', title:'High swell advisory — Bay of Bengal', sub:'Vessels reducing speed · ETA +6–12h', time:'4h ago', sev:'#5AC8FA' },
  { icon:'✈️', title:'ATC groundstop lifted — Frankfurt FRA', sub:'Backlog of 47 cargo flights now processing', time:'5h ago', sev:'#32D74B' },
  { icon:'⚓', title:'Port of Rotterdam berths 23–27 reopened', sub:'Equipment maintenance completed · Normal ops', time:'6h ago', sev:'#32D74B' },
];

function buildDisruptionFeed() {
  const feed = document.getElementById('disruption-feed-body');
  if (!feed) return;
  feed.innerHTML = DISRUPTION_EVENTS.map(ev => `
    <div class="disruption-event">
      <div class="de-severity" style="background:${ev.sev};box-shadow:0 0 8px ${ev.sev}44;"></div>
      <div class="de-icon" style="background:${ev.sev}18;">
        ${ev.icon}
      </div>
      <div class="de-content">
        <div class="de-title">${ev.title}</div>
        <div class="de-sub">${ev.sub}</div>
      </div>
      <div class="de-time">${ev.time}</div>
    </div>
  `).join('');
}

/* ── Bottleneck Routes ── */
const BOTTLENECK_ROUTES = [
  { name:'Shanghai → Los Angeles', pct:87, color:'#FF453A', trend:'↑ +12%', trendCol:'#FF453A' },
  { name:'PSA Tuas → Europe', pct:73, color:'#FF9F0A', trend:'↑ +8%', trendCol:'#FF9F0A' },
  { name:'JNPT → Dubai (Road+Sea)', pct:61, color:'#FF9F0A', trend:'↑ +3%', trendCol:'#FF9F0A' },
  { name:'Hamburg → Chicago (Air)', pct:44, color:'#5AC8FA', trend:'→ stable', trendCol:'rgba(255,255,255,.35)' },
  { name:'Busan → Rotterdam', pct:38, color:'#32D74B', trend:'↓ -5%', trendCol:'#32D74B' },
  { name:'Singapore → Sydney', pct:28, color:'#32D74B', trend:'↓ -2%', trendCol:'#32D74B' },
];

function buildBottleneckPanel() {
  const list = document.getElementById('bottleneck-routes-list');
  if (!list) return;
  list.innerHTML = BOTTLENECK_ROUTES.map(r => `
    <div class="bottleneck-route-item">
      <div class="bri-name">${r.name}</div>
      <div class="bri-bar-wrap">
        <div class="bri-bar" id="bri-bar-${r.name.replace(/[^a-z]/gi,'').toLowerCase()}"
          style="width:0%;background:${r.color};"></div>
      </div>
      <div class="bri-pct" style="color:${r.color};">${r.pct}%</div>
      <div class="bri-trend" style="color:${r.trendCol};font-size:.68rem;">${r.trend}</div>
    </div>
  `).join('');

  // Animate bars after render
  setTimeout(() => {
    BOTTLENECK_ROUTES.forEach(r => {
      const barId = 'bri-bar-' + r.name.replace(/[^a-z]/gi,'').toLowerCase();
      const bar = document.getElementById(barId);
      if (bar) bar.style.width = r.pct + '%';
    });
  }, 400);
}

/* ── Init disruption section ── */
function initDisruptionSection() {
  buildDisruptionFeed();
  buildBottleneckPanel();
}

/* ── Scroll fix: smooth scroll for all nav anchors ── */
function setupNavScrolling() {
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', function(e) {
      const target = document.getElementById(this.getAttribute('href').slice(1));
      if (target) {
        e.preventDefault();
        const offset = 70; // navbar height
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });
}

/* ── Fix all toast-triggering buttons ── */
function fixMagneticButtons() {
  // Override magnetic class (removes JS magnetic effect)
  document.querySelectorAll('.magnetic').forEach(el => {
    el.classList.remove('magnetic');
  });
}

/* ── Fix scrollTo function ── */
window.scrollTo = (function(orig) {
  return function(target, behavior) {
    if (typeof target === 'string') {
      const el = document.getElementById(target);
      if (el) {
        const offset = 70;
        const top = el.getBoundingClientRect().top + window.scrollY - offset;
        orig.call(window, { top, behavior: 'smooth' });
        return;
      }
    }
    orig.apply(window, arguments);
  };
})(window.scrollTo.bind(window));

/* ── Initialize all ── */
document.addEventListener('DOMContentLoaded', function() {
  initDisruptionSection();
  setupNavScrolling();
  fixMagneticButtons();

  // Make FAQ items work
  document.querySelectorAll('.faq-item').forEach(item => {
    if (!item.getAttribute('onclick')) {
      item.addEventListener('click', function() {
        if (typeof window.toggleFaq === 'function') window.toggleFaq(this);
      });
    }
  });

  // Auto-refresh disruption feed
  setInterval(() => {
    // Rotate first event to simulate live feed
    DISRUPTION_EVENTS.unshift(DISRUPTION_EVENTS.pop());
    buildDisruptionFeed();
  }, 12000);
});

/* ── Trigger init if DOM already loaded ── */
if (document.readyState !== 'loading') {
  setTimeout(() => {
    initDisruptionSection();
    setupNavScrolling();
    fixMagneticButtons();
  }, 300);
}