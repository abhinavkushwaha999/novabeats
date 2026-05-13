// ═══════════════════════════════════════════════════════════════
//  NovaBeats — Frontend App.js  (Complete Rewrite)
//  API base, ImageKit config, all state, all features
// ═══════════════════════════════════════════════════════════════

const API_BASE              = "https://novabeats-backend.vercel.app/api";
const IMAGEKIT_PUBLIC_KEY   = "public_yjk4r/uBhZDs80qyPem5dWEsZ1s=";
const IMAGEKIT_URL_ENDPOINT = "https://ik.imagekit.io/slrdselkt";

// ── State ─────────────────────────────────────────────────────
let currentUser    = null;
let allMusics      = [];
let playlist       = [];
let currentIndex   = -1;
let isPlaying      = false;
let isShuffle      = false;
let isRepeat       = false;
let selectedRole   = "user";
let likedSongs     = {};
let activeFilter   = "all";
let searchFilter   = "all";
let currentShareTrack  = null;
let currentCommentMusicId = null;

// OTP / Reset flow (memory only — never persisted)
let _pendingUserId = null;
let _pendingEmail  = null;
let _resetToken    = null;

// ════════════════════════════════════════════════════════════════
//  3D WEBGL PARTICLE BACKGROUND
// ════════════════════════════════════════════════════════════════
(function initGL() {
  const canvas = document.getElementById("gl-canvas");
  if (!canvas) return;
  const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
  if (!gl) { initCanvas2D(canvas); return; }

  // Resize
  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  resize(); window.addEventListener("resize", resize);

  // Shaders
  const vs = `
    attribute vec2 a_pos;
    attribute float a_size;
    attribute vec3 a_color;
    attribute float a_alpha;
    varying vec3 v_color;
    varying float v_alpha;
    uniform vec2 u_res;
    void main(){
      vec2 clip = (a_pos / u_res) * 2.0 - 1.0;
      gl_Position = vec4(clip * vec2(1,-1), 0, 1);
      gl_PointSize = a_size;
      v_color = a_color; v_alpha = a_alpha;
    }
  `;
  const fs = `
    precision mediump float;
    varying vec3 v_color; varying float v_alpha;
    void main(){
      vec2 c = gl_PointCoord - 0.5;
      float d = dot(c, c);
      if(d > 0.25) discard;
      float alpha = (1.0 - smoothstep(0.15, 0.25, d)) * v_alpha;
      gl_FragColor = vec4(v_color, alpha);
    }
  `;
  function mkShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s); return s;
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, mkShader(gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, mkShader(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog); gl.useProgram(prog);

  const N = 120;
  const COLORS = [[0.49,0.44,0.99],[0.96,0.44,0.71],[0.13,0.83,0.93],[0.56,0.50,1.0],[0.7,0.5,1.0]];
  const pts = Array.from({length:N}, () => {
    const c = COLORS[Math.floor(Math.random()*COLORS.length)];
    return {
      x: Math.random()*window.innerWidth, y: Math.random()*window.innerHeight,
      dx: (Math.random()-0.5)*0.5, dy: (Math.random()-0.5)*0.5,
      size: Math.random()*2.5+0.8,
      r:c[0], g:c[1], b:c[2],
      a: Math.random()*0.4+0.1, p: Math.random()*Math.PI*2
    };
  });

  const aPos   = gl.getAttribLocation(prog,"a_pos");
  const aSize  = gl.getAttribLocation(prog,"a_size");
  const aColor = gl.getAttribLocation(prog,"a_color");
  const aAlpha = gl.getAttribLocation(prog,"a_alpha");
  const uRes   = gl.getUniformLocation(prog,"u_res");

  const posBuf   = gl.createBuffer();
  const sizeBuf  = gl.createBuffer();
  const colorBuf = gl.createBuffer();
  const alphaBuf = gl.createBuffer();

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  function draw() {
    const W = canvas.width, H = canvas.height;
    gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(uRes, W, H);

    pts.forEach(p => {
      p.p += 0.015;
      p.x += p.dx; p.y += p.dy;
      if(p.x<0||p.x>W) p.dx*=-1;
      if(p.y<0||p.y>H) p.dy*=-1;
    });

    const pos   = new Float32Array(pts.flatMap(p=>[p.x,p.y]));
    const sizes = new Float32Array(pts.map(p=>p.size*(0.7+0.3*Math.sin(p.p))));
    const cols  = new Float32Array(pts.flatMap(p=>[p.r,p.g,p.b]));
    const alps  = new Float32Array(pts.map(p=>p.a*(0.6+0.4*Math.sin(p.p))));

    gl.bindBuffer(gl.ARRAY_BUFFER,posBuf); gl.bufferData(gl.ARRAY_BUFFER,pos,gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(aPos,2,gl.FLOAT,false,0,0); gl.enableVertexAttribArray(aPos);

    gl.bindBuffer(gl.ARRAY_BUFFER,sizeBuf); gl.bufferData(gl.ARRAY_BUFFER,sizes,gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(aSize,1,gl.FLOAT,false,0,0); gl.enableVertexAttribArray(aSize);

    gl.bindBuffer(gl.ARRAY_BUFFER,colorBuf); gl.bufferData(gl.ARRAY_BUFFER,cols,gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(aColor,3,gl.FLOAT,false,0,0); gl.enableVertexAttribArray(aColor);

    gl.bindBuffer(gl.ARRAY_BUFFER,alphaBuf); gl.bufferData(gl.ARRAY_BUFFER,alps,gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(aAlpha,1,gl.FLOAT,false,0,0); gl.enableVertexAttribArray(aAlpha);

    gl.drawArrays(gl.POINTS, 0, N);
    requestAnimationFrame(draw);
  }
  draw();
})();

// Canvas 2D fallback
function initCanvas2D(canvas) {
  const ctx = canvas.getContext("2d");
  function resize() { canvas.width=innerWidth; canvas.height=innerHeight; }
  resize(); addEventListener("resize", resize);
  const COLS=["124,111,253","244,114,182","34,211,238","142,128,255","192,132,252"];
  const pts = Array.from({length:80},()=>({
    x:Math.random()*innerWidth, y:Math.random()*innerHeight,
    dx:(Math.random()-.5)*.4, dy:(Math.random()-.5)*.4,
    r:Math.random()*1.5+0.5,
    c:COLS[Math.floor(Math.random()*COLS.length)],
    a:Math.random()*.35+.1, p:Math.random()*Math.PI*2
  }));
  (function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    pts.forEach(p=>{
      p.p+=.018; p.x+=p.dx; p.y+=p.dy;
      if(p.x<0||p.x>canvas.width)p.dx*=-1;
      if(p.y<0||p.y>canvas.height)p.dy*=-1;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle=`rgba(${p.c},${p.a*(0.7+0.3*Math.sin(p.p))})`; ctx.fill();
    });
    requestAnimationFrame(draw);
  })();
}

// ════════════════════════════════════════════════════════════════
//  API HELPER
// ════════════════════════════════════════════════════════════════
async function api(method, endpoint, body=null, isForm=false) {
  try {
    const opts = {
      method, credentials: "include",
      headers: isForm ? {} : { "Content-Type": "application/json" }
    };
    if (body) opts.body = isForm ? body : JSON.stringify(body);
    const res  = await fetch(API_BASE + endpoint, opts);
    const ct   = res.headers.get("content-type") || "";
    const data = ct.includes("application/json") ? await res.json() : { message: await res.text() };
    return { ok: res.ok, status: res.status, data };
  } catch(e) {
    return { ok: false, status: 0, data: { message: "Cannot reach the server. Please check your connection." } };
  }
}

// ════════════════════════════════════════════════════════════════
//  TOAST
// ════════════════════════════════════════════════════════════════
let _toastTimer;
function showToast(msg, type = "success") {
  const t = document.getElementById("toast");
  const m = document.getElementById("toast-msg");
  if (!t || !m) return;
  m.textContent = msg;
  t.className = `toast show ${type}`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove("show"), 3000);
}

// ════════════════════════════════════════════════════════════════
//  GREETING
// ════════════════════════════════════════════════════════════════
function setGreeting() {
  const h = new Date().getHours();
  const el = document.getElementById("greeting-time");
  if (el) el.textContent = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

// ════════════════════════════════════════════════════════════════
//  AUTH BOX RENDERER
// ════════════════════════════════════════════════════════════════
function renderAuth(screen) {
  const card = document.getElementById("auth-card");
  if (!card) return;

  // ── MAIN (Login + Register tabs) ─────────────────────────
  if (screen === "main") {
    card.innerHTML = `
      <div class="auth-tabs">
        <button class="auth-tab active" data-tab="login">Sign In</button>
        <button class="auth-tab" data-tab="register">Register</button>
      </div>

      <!-- LOGIN -->
      <form id="login-form" class="auth-form active">
        <div class="form-group">
          <label>Username or Email</label>
          <div class="input-wrap">
            <i class="fa-solid fa-user input-icon"></i>
            <input type="text" id="login-id" placeholder="username or email" autocomplete="username"/>
          </div>
        </div>
        <div class="form-group">
          <label>Password</label>
          <div class="input-wrap">
            <i class="fa-solid fa-lock input-icon"></i>
            <input type="password" id="login-pw" placeholder="••••••••" autocomplete="current-password"/>
          </div>
        </div>
        <div id="login-err" class="auth-error"></div>
        <button type="submit" class="btn-cta"><i class="fa-solid fa-arrow-right"></i><span>Sign In</span></button>
        <button type="button" class="link-btn" id="forgot-link">Forgot password?</button>
      </form>

      <!-- REGISTER -->
      <form id="register-form" class="auth-form">
        <div class="form-group">
          <label>Full Name</label>
          <div class="input-wrap">
            <i class="fa-solid fa-id-card input-icon"></i>
            <input type="text" id="reg-name" placeholder="Your full name" autocomplete="name"/>
          </div>
        </div>
        <div class="form-group">
          <label>Username <span class="lhint">unique · no spaces</span></label>
          <div class="input-wrap">
            <i class="fa-solid fa-at input-icon"></i>
            <input type="text" id="reg-username" placeholder="e.g. john_beats" autocomplete="off"/>
            <span class="un-status" id="un-status"></span>
          </div>
          <span class="fhint" id="un-hint">3–20 chars · letters, numbers, underscores</span>
        </div>
        <div class="form-group">
          <label>Email</label>
          <div class="input-wrap">
            <i class="fa-solid fa-envelope input-icon"></i>
            <input type="email" id="reg-email" placeholder="you@example.com" autocomplete="email"/>
          </div>
        </div>
        <div class="form-group">
          <label>Password <span class="lhint">min 6 · 1 uppercase · 1 number</span></label>
          <div class="input-wrap">
            <i class="fa-solid fa-lock input-icon"></i>
            <input type="password" id="reg-pw" placeholder="Min 6 chars" autocomplete="new-password"/>
          </div>
          <div class="pw-bar" id="pw-bar"></div>
          <span class="pw-hint" id="pw-hint">Must contain uppercase letter and number</span>
        </div>
        <div class="form-group">
          <label>I am a…</label>
          <div class="role-toggle">
            <button type="button" class="role-btn active" data-role="user"><i class="fa-solid fa-headphones"></i> Listener</button>
            <button type="button" class="role-btn" data-role="artist"><i class="fa-solid fa-microphone"></i> Artist</button>
          </div>
        </div>
        <div id="reg-err" class="auth-error"></div>
        <button type="submit" class="btn-cta"><i class="fa-solid fa-arrow-right"></i><span>Create Account</span></button>
      </form>
    `;

    // Tab switching
    card.querySelectorAll(".auth-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        card.querySelectorAll(".auth-tab").forEach(t => t.classList.remove("active"));
        card.querySelectorAll(".auth-form").forEach(f => f.classList.remove("active"));
        tab.classList.add("active");
        card.querySelector(`#${tab.dataset.tab}-form`).classList.add("active");
      });
    });

    // Role toggle
    card.querySelectorAll(".role-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        card.querySelectorAll(".role-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active"); selectedRole = btn.dataset.role;
      });
    });

    // Username live check
    card.querySelector("#reg-username")?.addEventListener("input", e => {
      const val = e.target.value.trim();
      const st  = card.querySelector("#un-status");
      const ht  = card.querySelector("#un-hint");
      if (!val) { st.textContent=""; st.className="un-status"; ht.textContent="3–20 chars · letters, numbers, underscores"; return; }
      const ok  = /^[a-zA-Z0-9_]{3,20}$/.test(val);
      st.textContent = ok ? "✓" : "✗";
      st.className   = `un-status ${ok?"ok":"error"}`;
      ht.textContent = ok ? "Username looks good!" : "Only letters, numbers, underscores (3–20 chars)";
      ht.style.color = ok ? "var(--aqua)" : "var(--pulse)";
    });

    // Password strength
    card.querySelector("#reg-pw")?.addEventListener("input", e => {
      updatePwStrength(e.target.value, card.querySelector("#pw-bar"), card.querySelector("#pw-hint"));
    });

    // Forgot link
    card.querySelector("#forgot-link")?.addEventListener("click", () => renderAuth("forgot"));

    // LOGIN submit
    card.querySelector("#login-form")?.addEventListener("submit", async e => {
      e.preventDefault();
      const errEl = card.querySelector("#login-err"); errEl.textContent = "";
      const id = card.querySelector("#login-id").value.trim();
      const pw = card.querySelector("#login-pw").value;
      if (!id || !pw) { errEl.textContent = "Please fill in all fields"; return; }
      const isEmail = id.includes("@");
      const btn = e.submitter; btn.disabled=true; btn.querySelector("span").textContent="Signing in…";
      const { ok, data } = await api("POST", "/auth/login", isEmail ? { email:id, password:pw } : { username:id, password:pw });
      btn.disabled=false; btn.querySelector("span").textContent="Sign In";
      if (!ok) {
        if (data.needsVerification) { _pendingUserId=data.userId; _pendingEmail=data.email; renderAuth("otp-register"); return; }
        errEl.textContent = data.message || "Invalid credentials"; return;
      }
      currentUser = data.user; loadLikedFromServer(); enterApp();
    });

    // REGISTER submit
    card.querySelector("#register-form")?.addEventListener("submit", async e => {
      e.preventDefault();
      const errEl = card.querySelector("#reg-err"); errEl.textContent = "";
      const name     = card.querySelector("#reg-name").value.trim();
      const username = card.querySelector("#reg-username").value.trim();
      const email    = card.querySelector("#reg-email").value.trim();
      const pw       = card.querySelector("#reg-pw").value;
      if (!name)     { errEl.textContent="Please enter your full name"; return; }
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) { errEl.textContent="Invalid username format"; return; }
      if (!email)    { errEl.textContent="Please enter your email"; return; }
      const pwErr = validatePassword(pw);
      if (pwErr)     { errEl.textContent=pwErr; return; }
      const btn = e.submitter; btn.disabled=true; btn.querySelector("span").textContent="Sending OTP…";
      const { ok, data } = await api("POST", "/auth/register", { name, username, email, password:pw, role:selectedRole });
      btn.disabled=false; btn.querySelector("span").textContent="Create Account";
      if (!ok) { errEl.textContent=data.message||"Registration failed"; return; }
      _pendingUserId=data.userId; _pendingEmail=data.email; renderAuth("otp-register");
    });
    return;
  }

  // ── OTP SCREEN ────────────────────────────────────────────
  if (screen === "otp-register" || screen === "otp-reset") {
    const isReset = screen === "otp-reset";
    let secs = 600;
    card.innerHTML = `
      <button class="back-link" id="otp-back"><i class="fa-solid fa-arrow-left"></i> Back</button>
      <h2 style="font-family:var(--font-display);font-size:1.25rem;font-weight:700;margin-bottom:6px">Check your inbox</h2>
      <p style="color:var(--t2);font-size:0.85rem;margin-bottom:4px">We sent a 6-digit code to</p>
      <p style="color:var(--neon2);font-weight:600;font-size:0.9rem;margin-bottom:20px">${esc(_pendingEmail||"")}</p>
      <div class="otp-row" id="otp-row">
        ${[0,1,2,3,4,5].map(()=>`<input class="otp-box" maxlength="1" type="text" inputmode="numeric" pattern="[0-9]"/>`).join("")}
      </div>
      <div class="otp-timer">Expires in <span id="otp-cd">10:00</span></div>
      <div id="otp-err" class="auth-error" style="text-align:center;margin:10px 0"></div>
      <button class="btn-cta" id="verify-btn" style="margin-top:8px">
        <i class="fa-solid fa-check"></i><span>Verify Code</span>
      </button>
      <div style="text-align:center;margin-top:14px">
        <button id="resend-btn" style="background:none;border:none;color:var(--t2);font-family:var(--font-body);font-size:0.82rem;cursor:pointer">
          Didn't get it? <span style="color:var(--neon2);text-decoration:underline">Resend</span>
        </button>
      </div>
    `;

    const boxes = [...card.querySelectorAll(".otp-box")];
    boxes.forEach((b, i) => {
      b.addEventListener("input", () => {
        b.value = b.value.replace(/\D/g, "");
        b.classList.toggle("filled", !!b.value);
        if (b.value && i < 5) boxes[i+1].focus();
      });
      b.addEventListener("keydown", e => {
        if (e.key==="Backspace" && !b.value && i>0) { boxes[i-1].value=""; boxes[i-1].classList.remove("filled"); boxes[i-1].focus(); }
      });
      b.addEventListener("paste", e => {
        e.preventDefault();
        const p = e.clipboardData.getData("text").replace(/\D/g,"").slice(0,6);
        p.split("").forEach((c,j) => { if(boxes[j]){boxes[j].value=c;boxes[j].classList.add("filled");} });
        boxes[Math.min(p.length,5)].focus();
      });
    });
    boxes[0].focus();

    // Timer
    const cdEl = card.querySelector("#otp-cd");
    const timer = setInterval(() => {
      secs--;
      if (secs <= 0) { clearInterval(timer); if(cdEl) cdEl.textContent="Expired"; return; }
      if (cdEl) cdEl.textContent = `${String(Math.floor(secs/60)).padStart(2,"0")}:${String(secs%60).padStart(2,"0")}`;
    }, 1000);

    card.querySelector("#otp-back").addEventListener("click", () => { clearInterval(timer); renderAuth("main"); });

    card.querySelector("#verify-btn").addEventListener("click", async () => {
      const otp = boxes.map(b=>b.value).join("");
      const errEl = card.querySelector("#otp-err");
      if (otp.length < 6) { errEl.textContent="Enter all 6 digits"; return; }
      const btn = card.querySelector("#verify-btn");
      btn.disabled=true; btn.querySelector("span").textContent="Verifying…";
      if (!isReset) {
        const { ok, data } = await api("POST", "/auth/verify-otp", { userId:_pendingUserId, otp });
        btn.disabled=false; btn.querySelector("span").textContent="Verify Code";
        if (!ok) { errEl.textContent=data.message; return; }
        clearInterval(timer); currentUser=data.user; loadLikedFromServer(); enterApp();
        showToast("Email verified! Welcome 🎵");
      } else {
        const { ok, data } = await api("POST", "/auth/verify-reset-otp", { userId:_pendingUserId, otp });
        btn.disabled=false; btn.querySelector("span").textContent="Verify Code";
        if (!ok) { errEl.textContent=data.message; return; }
        clearInterval(timer); _resetToken=data.resetToken; renderAuth("new-password");
      }
    });

    card.querySelector("#resend-btn").addEventListener("click", async () => {
      const { ok } = await api("POST", "/auth/resend-otp", { userId:_pendingUserId });
      if (ok) { secs=600; boxes.forEach(b=>{b.value="";b.classList.remove("filled");}); boxes[0].focus(); showToast("New code sent ✉️"); }
      else showToast("Failed to resend", "error");
    });
    return;
  }

  // ── FORGOT PASSWORD ───────────────────────────────────────
  if (screen === "forgot") {
    card.innerHTML = `
      <button class="back-link" id="fp-back"><i class="fa-solid fa-arrow-left"></i> Back to Sign In</button>
      <h2 style="font-family:var(--font-display);font-size:1.25rem;font-weight:700;margin-bottom:8px">Reset Password</h2>
      <p style="color:var(--t2);font-size:0.85rem;margin-bottom:22px">Enter your email — we'll send a reset code.</p>
      <div class="form-group">
        <label>Email Address</label>
        <div class="input-wrap">
          <i class="fa-solid fa-envelope input-icon"></i>
          <input type="email" id="fp-email" placeholder="you@example.com" autocomplete="email"/>
        </div>
      </div>
      <div id="fp-err" class="auth-error" style="margin:8px 0"></div>
      <button class="btn-cta" id="fp-send" style="margin-top:12px">
        <i class="fa-solid fa-paper-plane"></i><span>Send Code</span>
      </button>
    `;
    card.querySelector("#fp-back").addEventListener("click", () => renderAuth("main"));
    card.querySelector("#fp-email").addEventListener("keydown", e => { if(e.key==="Enter") card.querySelector("#fp-send").click(); });
    card.querySelector("#fp-send").addEventListener("click", async () => {
      const email = card.querySelector("#fp-email").value.trim();
      const errEl = card.querySelector("#fp-err");
      if (!email) { errEl.textContent="Please enter your email"; return; }
      const btn = card.querySelector("#fp-send"); btn.disabled=true; btn.querySelector("span").textContent="Sending…";
      const { ok, data } = await api("POST", "/auth/forgot-password", { email });
      btn.disabled=false; btn.querySelector("span").textContent="Send Code";
      if (!ok) {
        if (data.needsVerification) { _pendingUserId=data.userId; _pendingEmail=email; renderAuth("otp-register"); return; }
        errEl.textContent=data.message; return;
      }
      _pendingUserId=data.userId; _pendingEmail=email; renderAuth("otp-reset");
      showToast("Reset code sent ✉️");
    });
    return;
  }

  // ── NEW PASSWORD ──────────────────────────────────────────
  if (screen === "new-password") {
    card.innerHTML = `
      <h2 style="font-family:var(--font-display);font-size:1.25rem;font-weight:700;margin-bottom:8px">New Password</h2>
      <p style="color:var(--t2);font-size:0.85rem;margin-bottom:22px">Choose a strong new password.</p>
      <div class="form-group">
        <label>New Password</label>
        <div class="input-wrap" style="position:relative">
          <i class="fa-solid fa-lock input-icon"></i>
          <input type="password" id="np-pw" placeholder="Min 6 chars, uppercase, number" autocomplete="new-password"/>
          <button type="button" class="pw-toggle" id="np-toggle"><i class="fa-solid fa-eye"></i></button>
        </div>
        <div class="pw-bar" id="np-bar"></div>
        <span class="pw-hint" id="np-hint">Must contain uppercase letter and number</span>
      </div>
      <div class="form-group">
        <label>Confirm Password</label>
        <div class="input-wrap">
          <i class="fa-solid fa-lock input-icon"></i>
          <input type="password" id="np-confirm" placeholder="Repeat password" autocomplete="new-password"/>
        </div>
      </div>
      <div id="np-err" class="auth-error" style="margin:8px 0"></div>
      <button class="btn-cta" id="np-submit" style="margin-top:12px">
        <i class="fa-solid fa-key"></i><span>Reset Password</span>
      </button>
    `;
    card.querySelector("#np-toggle").addEventListener("click", () => {
      const inp=card.querySelector("#np-pw"); const ic=card.querySelector("#np-toggle i");
      inp.type=inp.type==="password"?"text":"password";
      ic.className=inp.type==="password"?"fa-solid fa-eye":"fa-solid fa-eye-slash";
    });
    card.querySelector("#np-pw").addEventListener("input", e => {
      updatePwStrength(e.target.value, card.querySelector("#np-bar"), card.querySelector("#np-hint"));
    });
    card.querySelector("#np-submit").addEventListener("click", async () => {
      const np = card.querySelector("#np-pw").value;
      const cp = card.querySelector("#np-confirm").value;
      const errEl = card.querySelector("#np-err");
      const pwErr = validatePassword(np); if (pwErr) { errEl.textContent=pwErr; return; }
      if (np !== cp) { errEl.textContent="Passwords do not match"; return; }
      const btn = card.querySelector("#np-submit"); btn.disabled=true; btn.querySelector("span").textContent="Resetting…";
      const { ok, data } = await api("POST", "/auth/reset-password", { resetToken:_resetToken, newPassword:np });
      btn.disabled=false; btn.querySelector("span").textContent="Reset Password";
      if (!ok) { errEl.textContent=data.message; return; }
      renderAuth("success");
    });
    return;
  }

  // ── SUCCESS ───────────────────────────────────────────────
  if (screen === "success") {
    card.innerHTML = `
      <div class="success-screen">
        <div class="success-ring"><i class="fa-solid fa-check"></i></div>
        <h2 style="font-family:var(--font-display);font-size:1.3rem;font-weight:700;margin-bottom:8px">Password Reset!</h2>
        <p style="color:var(--t2);font-size:0.88rem;margin-bottom:28px">You can now sign in with your new password.</p>
        <button class="btn-cta" id="go-login"><i class="fa-solid fa-arrow-right"></i><span>Sign In</span></button>
      </div>
    `;
    showToast("Password reset! 🎉");
    card.querySelector("#go-login").addEventListener("click", () => renderAuth("main"));
    return;
  }

  // ── PROFILE EDIT ──────────────────────────────────────────
  if (screen === "profile") {
    const overlay = document.getElementById("auth-screen");
    overlay.classList.add("active");
    card.innerHTML = `
      <div class="profile-overlay-header">
        <button class="back-link" id="profile-back" style="margin-bottom:0"><i class="fa-solid fa-arrow-left"></i></button>
        <h2>Edit Profile</h2>
      </div>
      <div class="form-group">
        <label>Display Name</label>
        <div class="input-wrap">
          <i class="fa-solid fa-id-card input-icon"></i>
          <input type="text" id="prof-name" placeholder="Your display name" value="${esc(currentUser?.name||"")}"/>
        </div>
      </div>
      <div class="form-group">
        <label>Bio <span class="lhint">max 300 chars</span></label>
        <div class="input-wrap">
          <i class="fa-solid fa-pen input-icon"></i>
          <input type="text" id="prof-bio" placeholder="Tell the world about yourself…" value="${esc(currentUser?.bio||"")}"/>
        </div>
      </div>
      <div class="form-group">
        <label>Avatar URL <span class="lhint">paste an image link</span></label>
        <div class="input-wrap">
          <i class="fa-solid fa-image input-icon"></i>
          <input type="url" id="prof-avatar" placeholder="https://…" value="${esc(currentUser?.avatar||"")}"/>
        </div>
      </div>
      <div id="prof-err" class="auth-error" style="margin:6px 0"></div>
      <div id="prof-ok" class="auth-success" style="margin:6px 0"></div>
      <button class="btn-cta" id="prof-save" style="margin-top:10px">
        <i class="fa-solid fa-floppy-disk"></i><span>Save Changes</span>
      </button>
    `;
    card.querySelector("#profile-back").addEventListener("click", () => {
      overlay.classList.remove("active");
    });
    card.querySelector("#prof-save").addEventListener("click", async () => {
      const name   = card.querySelector("#prof-name").value.trim();
      const bio    = card.querySelector("#prof-bio").value.trim();
      const avatar = card.querySelector("#prof-avatar").value.trim();
      const errEl  = card.querySelector("#prof-err");
      const okEl   = card.querySelector("#prof-ok");
      errEl.textContent=""; okEl.textContent="";
      const btn=card.querySelector("#prof-save"); btn.disabled=true; btn.querySelector("span").textContent="Saving…";
      const { ok, data } = await api("PATCH", "/auth/profile", { name, bio, avatar });
      btn.disabled=false; btn.querySelector("span").textContent="Save Changes";
      if (!ok) { errEl.textContent=data.message||"Update failed"; return; }
      currentUser = { ...currentUser, ...data.user };
      updateSidebarUser();
      okEl.textContent="Profile updated ✓";
      showToast("Profile updated!");
    });
    return;
  }
}

// ── Password validator (matches backend rules) ─────────────────
function validatePassword(pw) {
  if (!pw || pw.length < 6) return "Password must be at least 6 characters";
  if (!/[A-Z]/.test(pw))    return "Password must contain at least one uppercase letter";
  if (!/[0-9]/.test(pw))    return "Password must contain at least one number";
  return null;
}

// ── Live strength bar + hint ───────────────────────────────────
function updatePwStrength(val, bar, hint) {
  let sc = 0;
  if (val.length>=6) sc++; if (val.length>=10) sc++;
  if (/[A-Z]/.test(val)) sc++; if (/[0-9]/.test(val)) sc++; if (/[^a-zA-Z0-9]/.test(val)) sc++;
  const map=[["0%","transparent"],["25%","#ff7eb3"],["50%","#fdcb6e"],["75%","#ffeaa7"],["100%","var(--aqua)"]];
  const [w,c] = map[Math.min(sc,4)];
  if (bar) { bar.style.setProperty("--pw-w",w); bar.style.setProperty("--pw-c",c); }
  if (hint) {
    if (!val)            { hint.textContent="Must contain uppercase letter and number"; hint.style.color=""; return; }
    if (val.length<6)    { hint.textContent="Too short (min 6 characters)"; hint.style.color="var(--pulse)"; return; }
    if (!/[A-Z]/.test(val)) { hint.textContent="Add at least one uppercase letter"; hint.style.color="var(--amber)"; return; }
    if (!/[0-9]/.test(val)) { hint.textContent="Add at least one number"; hint.style.color="var(--amber)"; return; }
    hint.textContent="Strong password ✓"; hint.style.color="var(--aqua)";
  }
}

// ════════════════════════════════════════════════════════════════
//  LOGOUT
// ════════════════════════════════════════════════════════════════
document.getElementById("logout-btn")?.addEventListener("click", async () => {
  await api("POST", "/auth/logout");
  currentUser=null; allMusics=[]; playlist=[]; currentIndex=-1; likedSongs={};
  stopPlayer();
  document.getElementById("app").classList.add("hidden");
  document.getElementById("player-bar").classList.add("hidden");
  document.getElementById("auth-screen").classList.add("active");
  _pendingUserId=null; _pendingEmail=null; _resetToken=null;
  renderAuth("main");
});

// Profile buttons (desktop header + mobile topbar)
document.getElementById("profile-btn")?.addEventListener("click", () => renderAuth("profile"));
document.getElementById("profile-btn-desk")?.addEventListener("click", () => renderAuth("profile"));
document.getElementById("user-card")?.addEventListener("click", e => {
  if (e.target.closest("#logout-btn")) return;
  renderAuth("profile");
});

// ════════════════════════════════════════════════════════════════
//  ENTER APP
// ════════════════════════════════════════════════════════════════
function enterApp() {
  document.getElementById("auth-screen").classList.remove("active");
  document.getElementById("app").classList.remove("hidden");
  setGreeting();
  updateSidebarUser();
  document.querySelectorAll(".artist-only").forEach(el =>
    el.classList.toggle("hidden", currentUser.role !== "artist")
  );
  loadMusics();
  showView("home");
}

function updateSidebarUser() {
  if (!currentUser) return;
  const un = document.getElementById("uc-name");
  const ur = document.getElementById("uc-role");
  const ua = document.getElementById("uc-avatar"); // sidebar avatar (id="uc-av" in HTML mapped via uc-avatar class)
  const uav= document.getElementById("uc-av");     // new HTML ID
  const gn = document.getElementById("greeting-name");

  if (un) un.textContent = currentUser.username;
  if (ur) ur.textContent = currentUser.role;

  // Support both old and new avatar element IDs
  const avatarEl = ua || uav;
  if (avatarEl) {
    if (currentUser.avatar) {
      avatarEl.style.backgroundImage = `url(${currentUser.avatar})`;
      avatarEl.style.backgroundSize  = "cover";
      avatarEl.style.backgroundPosition = "center";
      avatarEl.textContent = "";
    } else {
      avatarEl.style.backgroundImage = "";
      avatarEl.textContent = currentUser.username[0].toUpperCase();
    }
  }
  if (gn) gn.textContent = currentUser.name || currentUser.username;
}

// ════════════════════════════════════════════════════════════════
//  VIEWS
// ════════════════════════════════════════════════════════════════
function showView(viewId) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.querySelectorAll(".nav-link, .mn-item").forEach(n => n.classList.remove("active"));
  const view = document.getElementById(`view-${viewId}`);
  if (view) view.classList.add("active");
  document.querySelectorAll(`[data-view="${viewId}"]`).forEach(n => n.classList.add("active"));

  if (viewId==="albums")       loadAlbums();
  if (viewId==="liked")        renderLikedSongs();
  if (viewId==="feed")         loadFeed();
  if (viewId==="create-album") loadTrackChecklist();
  if (viewId==="search")       setTimeout(() => document.getElementById("search-input")?.focus(), 100);
}

// Desktop nav
document.querySelectorAll(".nav-link").forEach(i =>
  i.addEventListener("click", e => { e.preventDefault(); showView(i.dataset.view); })
);
// Mobile nav
document.querySelectorAll(".mn-item").forEach(i =>
  i.addEventListener("click", e => { e.preventDefault(); showView(i.dataset.view); })
);

// Filter chips
document.querySelectorAll(".chip").forEach(c =>
  c.addEventListener("click", () => {
    document.querySelectorAll(".chip").forEach(x => x.classList.remove("active"));
    c.classList.add("active"); activeFilter = c.dataset.filter; renderMusicGrid();
  })
);

// Back to albums
document.getElementById("back-to-albums")?.addEventListener("click", () => showView("albums"));

// ════════════════════════════════════════════════════════════════
//  LOAD MUSIC
// ════════════════════════════════════════════════════════════════
async function loadMusics() {
  const grid = document.getElementById("music-grid");
  if (!grid) return;
  grid.innerHTML = `<div class="skel"></div>`.repeat(6);
  const { ok, data } = await api("GET", "/music?limit=50");
  grid.innerHTML = "";
  if (!ok) { grid.innerHTML=`<div class="empty-msg" style="grid-column:1/-1"><i class="fa-solid fa-triangle-exclamation"></i><p>${esc(data.message)}</p></div>`; return; }
  allMusics = data.musics || [];
  playlist  = [...allMusics];
  if (allMusics.length) {
    const ft = document.getElementById("hero-title");    if(ft) ft.textContent=allMusics[0].title;
    const fa = document.getElementById("hero-artist");   if(fa) fa.textContent=allMusics[0].artist?.username||"";
    const fp = document.getElementById("hero-play-btn"); if(fp) fp.onclick=()=>playTrack(0,allMusics);
  }
  renderMusicGrid();
}

function renderMusicGrid() {
  const grid = document.getElementById("music-grid"); if(!grid) return;
  grid.innerHTML = "";
  const toShow = activeFilter==="recent" ? [...allMusics].slice(-8).reverse() : [...allMusics];
  if (!toShow.length) { grid.innerHTML=`<div class="empty-msg" style="grid-column:1/-1"><i class="fa-solid fa-music"></i><p>No tracks yet</p></div>`; return; }
  toShow.forEach((m, i) => { const c=mkTrackCard(m,i); c.style.animationDelay=`${i*0.04}s`; grid.appendChild(c); });
}

// ── Track Card Factory ─────────────────────────────────────────
function mkTrackCard(music, index) {
  const card = document.createElement("div");
  card.className = "track-card"; card.dataset.id = music._id;
  const em = EMOJIS[Math.abs(hashStr(music._id)) % EMOJIS.length];
  const liked = !!likedSongs[music._id];
  card.innerHTML = `
    <button class="tc-share-btn"><i class="fa-solid fa-share-nodes"></i></button>
    <button class="tc-like-btn ${liked?"liked":""}"><i class="fa-${liked?"solid":"regular"} fa-heart"></i></button>
    <div class="tc-thumb">
      <div class="tc-thumb-glow"></div>
      <span style="position:relative;z-index:1;font-size:2.4rem">${em}</span>
      <div class="tc-play">
        <div class="tc-play-btn"><i class="fa-solid fa-play" style="margin-left:2px"></i></div>
      </div>
    </div>
    <div class="tc-title">${esc(music.title)}</div>
    <div class="tc-artist artist-link" data-artist-id="${music.artist?._id||""}">${esc(music.artist?.username||"Unknown")}</div>
    <div class="tc-likes"><i class="fa-solid fa-heart"></i><span class="lk-${music._id}">${music.likes?.length||0}</span></div>
  `;
  card.querySelector(".tc-play-btn").addEventListener("click", e => { e.stopPropagation(); playlist=[...allMusics]; playTrack(allMusics.findIndex(m=>m._id===music._id), playlist); });
  card.addEventListener("click", e => { if(e.target.closest(".tc-like-btn")||e.target.closest(".tc-share-btn")||e.target.closest(".tc-artist")) return; playlist=[...allMusics]; playTrack(allMusics.findIndex(m=>m._id===music._id), playlist); });
  card.querySelector(".tc-like-btn").addEventListener("click", e => { e.stopPropagation(); toggleLike(music, card.querySelector(".tc-like-btn")); });
  card.querySelector(".tc-share-btn").addEventListener("click", e => { e.stopPropagation(); openShare(music); });
  card.querySelector(".tc-artist").addEventListener("click", e => { e.stopPropagation(); if(music.artist?._id) openArtistProfile(music.artist._id); });
  return card;
}

const EMOJIS = ["🎵","🎶","🎸","🎹","🥁","🎷","🎺","🎻","🎼","🎤","🎧","💿","🎙️","🔊","🎚️","🎛️"];

// ════════════════════════════════════════════════════════════════
//  ALBUMS
// ════════════════════════════════════════════════════════════════
async function loadAlbums() {
  const grid = document.getElementById("albums-grid"); if(!grid) return;
  grid.innerHTML = `<div class="skel"></div>`.repeat(4);
  const { ok, data } = await api("GET", "/music/albums");
  grid.innerHTML = "";
  if (!ok || !data.albums?.length) { grid.innerHTML=`<div class="empty-msg" style="grid-column:1/-1"><i class="fa-solid fa-record-vinyl"></i><p>No albums yet</p></div>`; return; }
  data.albums.forEach((a,i) => { const c=mkAlbumCard(a); c.style.animationDelay=`${i*0.06}s`; grid.appendChild(c); });
}

function mkAlbumCard(album) {
  const card = document.createElement("div"); card.className="album-card";
  const em = EMOJIS[Math.abs(hashStr(album._id)) % EMOJIS.length];
  card.innerHTML=`
    <div class="album-art">${em}</div>
    <div class="album-card-title">${esc(album.title)}</div>
    <div class="album-card-artist">${esc(album.artist?.username||"Unknown")}</div>
  `;
  card.addEventListener("click", () => openAlbum(album._id));
  return card;
}

async function openAlbum(albumId) {
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  document.getElementById("view-album-detail").classList.add("active");
  const cont = document.getElementById("album-detail-content");
  cont.innerHTML = `<div class="skel" style="height:190px"></div>`;
  const { ok, data } = await api("GET", `/music/albums/${albumId}`);
  if (!ok) { cont.innerHTML=`<p style="color:var(--t3)">Failed to load album.</p>`; return; }
  const album=data.album; const tracks=album.musics||[];
  const em=EMOJIS[Math.abs(hashStr(album._id))%EMOJIS.length];
  cont.innerHTML=`
    <div class="album-hero">
      <div class="album-hero-art">${em}</div>
      <div class="album-hero-info">
        <p class="head-eyebrow">Album</p>
        <h2>${esc(album.title)}</h2>
        <p>${esc(album.artist?.username||"Unknown")} · ${tracks.length} track${tracks.length!==1?"s":""}</p>
        <button class="btn-cta" id="play-all-btn" style="display:inline-flex;margin-top:16px;width:auto;padding:10px 22px">
          <i class="fa-solid fa-play"></i><span>Play All</span>
        </button>
      </div>
    </div>
    <div class="track-list" id="album-tracks"></div>
  `;
  const ap = tracks.map(t=>({...t, artist:album.artist}));
  document.getElementById("play-all-btn").onclick = () => { if(ap.length){playlist=ap;playTrack(0,ap);} };
  const tl = document.getElementById("album-tracks");
  if (!tracks.length) { tl.innerHTML=`<p style="color:var(--t3);padding:10px">No tracks in this album.</p>`; return; }
  tracks.forEach((t,i) => {
    const it=document.createElement("div"); it.className="track-item";
    it.innerHTML=`<span class="track-num">${i+1}</span><span class="track-item-title">${esc(t.title)}</span><i class="fa-solid fa-play track-pi"></i>`;
    it.addEventListener("click", () => { playlist=ap; playTrack(i,ap); });
    tl.appendChild(it);
  });
}

// ════════════════════════════════════════════════════════════════
//  FEED
// ════════════════════════════════════════════════════════════════
async function loadFeed() {
  const grid = document.getElementById("feed-grid"); if(!grid) return;
  grid.innerHTML = `<div class="skel"></div>`.repeat(3);
  const { ok, data } = await api("GET", "/social/feed");
  grid.innerHTML = "";
  if (!ok||!data.feed?.length) { grid.innerHTML=`<div class="empty-msg" style="grid-column:1/-1"><i class="fa-solid fa-bolt"></i><p>Follow artists to see their tracks here</p></div>`; return; }
  data.feed.forEach((m,i) => { const c=mkTrackCard(m,i); grid.appendChild(c); });
}

// ════════════════════════════════════════════════════════════════
//  ARTIST PROFILE
// ════════════════════════════════════════════════════════════════
async function openArtistProfile(artistId) {
  showView("artist");
  const section = document.getElementById("view-artist");
  section.innerHTML = `<div class="skel" style="height:180px;margin-bottom:20px"></div><div class="skel" style="height:50px;margin-bottom:10px"></div>`;
  const { ok, data } = await api("GET", `/social/artist/${artistId}`);
  if (!ok) { section.innerHTML=`<p style="color:var(--t3)">Failed to load profile.</p>`; return; }
  const { artist, tracks } = data;
  section.innerHTML = `
    <button class="back-pill" id="back-from-artist"><i class="fa-solid fa-arrow-left"></i> Back</button>
    <div class="artist-profile-hero">
      <div class="ap-avatar">${artist.username[0].toUpperCase()}</div>
      <div class="ap-info">
        <h2 style="font-family:var(--font-display);font-size:2rem;font-weight:800">
          ${esc(artist.username)}
          ${artist.role==="artist"?`<span class="ap-role-badge">Artist</span>`:""}
        </h2>
        ${artist.bio?`<p style="color:var(--t2);margin-top:8px;font-size:0.9rem">${esc(artist.bio)}</p>`:""}
        <div class="ap-stats">
          <div class="ap-stat"><span class="ap-stat-num">${artist.followers}</span><span class="ap-stat-label">Followers</span></div>
          <div class="ap-stat"><span class="ap-stat-num">${tracks.length}</span><span class="ap-stat-label">Tracks</span></div>
        </div>
        <button class="follow-btn ${artist.isFollowing?"following":""}" id="follow-btn" data-id="${artist.id}">
          <i class="fa-solid ${artist.isFollowing?"fa-user-check":"fa-user-plus"}"></i>
          ${artist.isFollowing?"Following":"Follow"}
        </button>
      </div>
    </div>
    <div class="row-header"><h3 class="row-title">Tracks</h3></div>
    <div class="track-grid" id="artist-tracks"></div>
  `;
  document.getElementById("back-from-artist").addEventListener("click", () => history.back() || showView("home"));
  const followBtn = document.getElementById("follow-btn");
  followBtn.addEventListener("click", async () => {
    const { ok:fok, data:fd } = await api("POST", `/social/follow/${artist.id}`);
    if (!fok) { showToast(fd.message||"Failed","error"); return; }
    followBtn.className = `follow-btn ${fd.following?"following":""}`;
    followBtn.innerHTML = `<i class="fa-solid ${fd.following?"fa-user-check":"fa-user-plus"}"></i> ${fd.following?"Following":"Follow"}`;
    showToast(fd.following ? `Following ${artist.username}!` : "Unfollowed");
  });
  const atGrid = document.getElementById("artist-tracks");
  if (!tracks.length) { atGrid.innerHTML=`<div class="empty-msg" style="grid-column:1/-1"><p>No tracks uploaded yet</p></div>`; return; }
  tracks.forEach((m,i) => { const c=mkTrackCard(m,i); atGrid.appendChild(c); });
}

// ════════════════════════════════════════════════════════════════
//  SEARCH
// ════════════════════════════════════════════════════════════════
const searchInput = document.getElementById("search-input");
const searchClear = document.getElementById("search-clear");
let searchDebounce = null;

searchInput?.addEventListener("input", () => {
  const q = searchInput.value.trim();
  searchClear?.classList.toggle("hidden", !q);
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => runSearch(q), 350);
});
searchClear?.addEventListener("click", () => {
  searchInput.value=""; searchClear.classList.add("hidden");
  const r=document.getElementById("search-results");
  if(r) r.innerHTML=`<div class="search-splash"><div class="splash-icon">🎵</div><p>Start typing to explore music</p></div>`;
});
document.querySelectorAll(".stab").forEach(t =>
  t.addEventListener("click", () => {
    document.querySelectorAll(".stab").forEach(x=>x.classList.remove("active"));
    t.classList.add("active"); searchFilter=t.dataset.type;
    runSearch(searchInput?.value.trim()||"");
  })
);

async function runSearch(q) {
  const r=document.getElementById("search-results"); if(!r) return;
  if (!q) { r.innerHTML=`<div class="search-splash"><div class="splash-icon">🎵</div><p>Start typing to explore music</p></div>`; return; }
  r.innerHTML = `<div class="skel" style="height:54px;margin-bottom:8px"></div>`.repeat(4);

  const [sR, aR] = await Promise.all([
    api("GET", `/music/search?q=${encodeURIComponent(q)}&limit=30`),
    api("GET", "/music/albums"),
  ]);

  const musics = sR.ok ? (sR.data.musics||[]) : [];
  const albums = aR.ok ? (aR.data.albums||[]) : [];
  const ql = q.toLowerCase();
  const filteredAlbums = albums.filter(a =>
    a.title.toLowerCase().includes(ql)||(a.artist?.username||"").toLowerCase().includes(ql)
  );
  const artistNames = [...new Set(musics.map(m=>m.artist?.username).filter(Boolean))];

  r.innerHTML = "";
  if (!musics.length && !filteredAlbums.length && !artistNames.length) {
    r.innerHTML=`<div class="search-splash"><div class="splash-icon">🔍</div><p>No results for "<strong>${esc(q)}</strong>"</p></div>`; return;
  }

  const mkLbl = txt => { const d=document.createElement("div"); d.className="s-section-lbl"; d.textContent=txt; return d; };

  if ((searchFilter==="all"||searchFilter==="tracks") && musics.length) {
    r.appendChild(mkLbl("Tracks"));
    musics.forEach(m => {
      const idx = allMusics.findIndex(x=>x._id===m._id);
      const em  = EMOJIS[Math.abs(hashStr(m._id))%EMOJIS.length];
      const liked = !!likedSongs[m._id];
      const row = document.createElement("div"); row.className="s-row";
      row.innerHTML=`
        <div class="s-thumb">${em}</div>
        <div class="s-info"><div class="s-name">${esc(m.title)}</div><div class="s-sub">${esc(m.artist?.username||"")}</div></div>
        <span class="s-tag">Track</span>
        <button class="tc-like-btn ${liked?"liked":""}" style="opacity:1;position:static;width:30px;height:30px;flex-shrink:0">
          <i class="fa-${liked?"solid":"regular"} fa-heart"></i>
        </button>
      `;
      row.addEventListener("click", e => {
        if(e.target.closest(".tc-like-btn")) return;
        if (idx>=0) { playlist=[...allMusics]; playTrack(idx,playlist); }
        else { playlist=[m]; playTrack(0,playlist); }
      });
      row.querySelector(".tc-like-btn").addEventListener("click", e => { e.stopPropagation(); toggleLike(m,row.querySelector(".tc-like-btn")); });
      r.appendChild(row);
    });
  }

  if ((searchFilter==="all"||searchFilter==="albums") && filteredAlbums.length) {
    r.appendChild(mkLbl("Albums"));
    filteredAlbums.forEach(alb => {
      const em=EMOJIS[Math.abs(hashStr(alb._id))%EMOJIS.length];
      const row=document.createElement("div"); row.className="s-row";
      row.innerHTML=`
        <div class="s-thumb">${em}</div>
        <div class="s-info"><div class="s-name">${esc(alb.title)}</div><div class="s-sub">${esc(alb.artist?.username||"")}</div></div>
        <span class="s-tag">Album</span>
      `;
      row.addEventListener("click", () => openAlbum(alb._id));
      r.appendChild(row);
    });
  }

  if ((searchFilter==="all"||searchFilter==="artists") && artistNames.length) {
    r.appendChild(mkLbl("Artists"));
    artistNames.forEach(name => {
      const at=musics.filter(m=>m.artist?.username===name);
      const id=at[0]?.artist?._id;
      const row=document.createElement("div"); row.className="s-row";
      row.innerHTML=`
        <div class="s-thumb" style="background:linear-gradient(135deg,var(--neon3),var(--pulse));color:white;font-family:var(--font-display);font-size:1.3rem;font-weight:700">
          ${name[0].toUpperCase()}
        </div>
        <div class="s-info"><div class="s-name">${esc(name)}</div><div class="s-sub">${at.length} track${at.length!==1?"s":""}</div></div>
        <span class="s-tag">Artist</span>
      `;
      row.addEventListener("click", () => { if(id) openArtistProfile(id); else if(at.length){playlist=at;playTrack(0,at);} });
      r.appendChild(row);
    });
  }
}

// ════════════════════════════════════════════════════════════════
//  LIKES
// ════════════════════════════════════════════════════════════════
async function loadLikedFromServer() {
  const { ok, data } = await api("GET", "/social/liked"); if(!ok) return;
  likedSongs = {};
  (data.likedSongs||[]).forEach(m => { likedSongs[m._id]=m; });
  updateLikedCount();
}

function updateLikedCount() {
  const n = Object.keys(likedSongs).length;
  const b = document.getElementById("liked-count"); if(b) b.textContent=n;
  const t = document.getElementById("liked-count-text"); if(t) t.textContent=`${n} song${n!==1?"s":""}`;
}

async function toggleLike(music, btn) {
  const { ok, data } = await api("POST", `/social/like/${music._id}`);
  if (!ok) { showToast(data.message||"Failed","error"); return; }
  const isLiked = data.liked;
  if (isLiked) { likedSongs[music._id]=music; showToast("Added to Liked Songs ❤️","liked"); }
  else { delete likedSongs[music._id]; showToast("Removed from Liked Songs"); }
  updateLikedCount();

  // Update all like buttons for this track
  document.querySelectorAll(`.track-card[data-id="${music._id}"] .tc-like-btn`).forEach(b => {
    b.className=`tc-like-btn ${isLiked?"liked":""}`;
    b.innerHTML=`<i class="fa-${isLiked?"solid":"regular"} fa-heart"></i>`;
  });
  if (btn) { btn.className=btn.className.replace(/tc-like-btn.*/,"tc-like-btn "+(isLiked?"liked":"")); btn.innerHTML=`<i class="fa-${isLiked?"solid":"regular"} fa-heart"></i>`; }

  const lkEl = document.querySelector(`.lk-${music._id}`); if(lkEl) lkEl.textContent=data.likes;

  // Update player like button
  const pb=document.getElementById("player-like-btn");
  if (pb && playlist[currentIndex]?._id===music._id) {
    pb.classList.toggle("liked",isLiked);
    pb.innerHTML=`<i class="fa-${isLiked?"solid":"regular"} fa-heart"></i>`;
  }
  const lv=document.getElementById("view-liked"); if(lv?.classList.contains("active")) renderLikedSongs();
}

function renderLikedSongs() {
  const list=document.getElementById("liked-list");
  const songs=Object.values(likedSongs); updateLikedCount();
  if (!songs.length) { list.innerHTML=`<div class="empty-msg"><i class="fa-regular fa-heart"></i><p>Songs you like will appear here</p></div>`; return; }
  list.innerHTML="";
  songs.forEach((m,i) => {
    const row=document.createElement("div"); row.className="liked-row";
    const em=EMOJIS[Math.abs(hashStr(m._id))%EMOJIS.length];
    row.innerHTML=`
      <span class="lr-num">${i+1}</span>
      <div class="lr-thumb">${em}</div>
      <div class="lr-info"><div class="lr-title">${esc(m.title)}</div><div class="lr-artist">${esc(m.artist?.username||"Unknown")}</div></div>
      <button class="lr-unlike"><i class="fa-solid fa-heart"></i></button>
    `;
    row.addEventListener("click", e => { if(e.target.closest(".lr-unlike"))return; playlist=songs; playTrack(i,songs); });
    row.querySelector(".lr-unlike").addEventListener("click", () => toggleLike(m,null));
    list.appendChild(row);
  });
}

document.getElementById("player-like-btn")?.addEventListener("click", () => {
  if (currentIndex<0||!playlist[currentIndex]) return;
  toggleLike(playlist[currentIndex], document.getElementById("player-like-btn"));
});

// ════════════════════════════════════════════════════════════════
//  COMMENTS
// ════════════════════════════════════════════════════════════════
document.getElementById("open-comments-btn")?.addEventListener("click", () => {
  if (currentIndex<0||!playlist[currentIndex]) return;
  openComments(playlist[currentIndex]);
});
document.getElementById("close-comments")?.addEventListener("click", closeComments);
document.getElementById("cp-backdrop")?.addEventListener("click", closeComments);

function openComments(music) {
  currentCommentMusicId = music._id;
  const panel=document.getElementById("comments-panel");
  const bd=document.getElementById("cp-backdrop");
  const tn=document.getElementById("cp-track-name");
  if(tn) tn.textContent=music.title;
  panel.classList.add("open"); bd.classList.remove("hidden");
  loadComments(music._id);
}
function closeComments() {
  document.getElementById("comments-panel").classList.remove("open");
  document.getElementById("cp-backdrop").classList.add("hidden");
}

async function loadComments(musicId) {
  const list=document.getElementById("comments-list");
  list.innerHTML=`<div style="color:var(--t3);text-align:center;padding:20px;font-size:0.85rem">Loading…</div>`;
  const { ok, data } = await api("GET", `/social/comment/${musicId}`);
  list.innerHTML="";
  if (!ok||!data.comments?.length) {
    list.innerHTML=`<div style="color:var(--t3);text-align:center;padding:40px 20px;font-size:0.85rem">No comments yet. Be the first!</div>`; return;
  }
  data.comments.forEach(c => list.appendChild(mkCommentEl(c)));
}

function mkCommentEl(c) {
  const el=document.createElement("div"); el.className="comment-item"; el.dataset.id=c._id;
  const isOwn = currentUser && c.user?._id===currentUser.id;
  el.innerHTML=`
    <div class="cmt-avatar">${(c.user?.username||"?")[0].toUpperCase()}</div>
    <div class="cmt-body">
      <div class="cmt-user">
        <span>${esc(c.user?.username||"Unknown")}</span>
        ${c.user?.role==="artist"?`<span style="font-size:0.65rem;background:rgba(108,92,231,0.2);color:var(--neon2);border:1px solid var(--b1);border-radius:6px;padding:1px 6px;text-transform:uppercase;letter-spacing:0.05em">Artist</span>`:""}
      </div>
      <div class="cmt-text">${esc(c.text)}</div>
      <div class="cmt-time">${timeAgo(c.createdAt)}</div>
    </div>
    ${isOwn?`<button class="cmt-del"><i class="fa-solid fa-trash"></i></button>`:""}
  `;
  if (isOwn) {
    el.querySelector(".cmt-del").addEventListener("click", async () => {
      const { ok } = await api("DELETE", `/social/comment/${c._id}`);
      if (ok) { el.remove(); showToast("Comment deleted"); }
      else showToast("Failed to delete","error");
    });
  }
  return el;
}

document.getElementById("post-comment-btn")?.addEventListener("click", postComment);
document.getElementById("comment-input")?.addEventListener("keydown", e => { if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();postComment();} });

async function postComment() {
  if (!currentCommentMusicId) return;
  const inp=document.getElementById("comment-input"); const text=inp.value.trim();
  if (!text) return;
  const { ok, data } = await api("POST", `/social/comment/${currentCommentMusicId}`, { text });
  if (!ok) { showToast(data.message||"Failed","error"); return; }
  inp.value="";
  const list=document.getElementById("comments-list");
  const empty=list.querySelector("div[style]"); if(empty) empty.remove();
  list.insertBefore(mkCommentEl(data.comment), list.firstChild);
}

// ════════════════════════════════════════════════════════════════
//  SHARE
// ════════════════════════════════════════════════════════════════
function openShare(music) {
  currentShareTrack=music;
  document.getElementById("share-title").textContent=music.title||"Unknown";
  document.getElementById("share-artist").textContent=music.artist?.username||"Unknown";
  document.getElementById("share-link-input").value=music.uri||location.href;
  document.getElementById("share-modal").classList.remove("hidden");
}
document.getElementById("share-modal-close")?.addEventListener("click", () => document.getElementById("share-modal").classList.add("hidden"));
document.getElementById("share-modal")?.addEventListener("click", e => { if(e.target===document.getElementById("share-modal")) document.getElementById("share-modal").classList.add("hidden"); });
document.getElementById("copy-link-btn")?.addEventListener("click", () => {
  const inp=document.getElementById("share-link-input");
  navigator.clipboard.writeText(inp.value)
    .then(() => showToast("Link copied!"))
    .catch(() => { inp.select(); document.execCommand("copy"); showToast("Link copied!"); });
});
document.getElementById("share-whatsapp")?.addEventListener("click", () => {
  if(!currentShareTrack)return;
  window.open(`https://wa.me/?text=${encodeURIComponent(`🎵 Listen to "${currentShareTrack.title}" on NovaBeats!\n${currentShareTrack.uri||location.href}`)}`,"_blank");
});
document.getElementById("share-twitter")?.addEventListener("click", () => {
  if(!currentShareTrack)return;
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`🎵 Listening to "${currentShareTrack.title}" on NovaBeats!`)}&url=${encodeURIComponent(currentShareTrack.uri||location.href)}`,"_blank");
});
document.getElementById("share-player-btn")?.addEventListener("click", () => {
  if(currentIndex>=0&&playlist[currentIndex]) openShare(playlist[currentIndex]);
});

// ════════════════════════════════════════════════════════════════
//  UPLOAD
// ════════════════════════════════════════════════════════════════
const dropZone=document.getElementById("file-drop-zone");
const fileInput=document.getElementById("upload-file");
const fileLabel=document.getElementById("file-label");

dropZone?.addEventListener("click", () => fileInput.click());
fileInput?.addEventListener("change", () => { if(fileInput.files[0]) fileLabel.textContent=fileInput.files[0].name; });
dropZone?.addEventListener("dragover", e => { e.preventDefault(); dropZone.classList.add("drag-over"); });
dropZone?.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
dropZone?.addEventListener("drop", e => {
  e.preventDefault(); dropZone.classList.remove("drag-over");
  const f=e.dataTransfer.files[0]; if(f){fileInput.files=e.dataTransfer.files;fileLabel.textContent=f.name;}
});

async function uploadToImageKit(file) {
  const { ok, data } = await api("GET", "/music/imagekit-auth"); if(!ok) throw new Error("Auth failed");
  const fd=new FormData();
  fd.append("file",file); fd.append("fileName","music_"+Date.now());
  fd.append("publicKey",IMAGEKIT_PUBLIC_KEY); fd.append("signature",data.signature);
  fd.append("expire",data.expire); fd.append("token",data.token); fd.append("folder","novabeats/music");
  const res=await fetch("https://upload.imagekit.io/api/v1/files/upload",{method:"POST",body:fd});
  if(!res.ok){const err=await res.json();throw new Error(err.message||"Upload failed");}
  return (await res.json()).url;
}

document.getElementById("upload-form")?.addEventListener("submit", async e => {
  e.preventDefault();
  const ue=document.getElementById("upload-error"); const us=document.getElementById("upload-success");
  if(ue) ue.textContent=""; if(us) us.textContent="";
  const title=document.getElementById("upload-title").value.trim();
  const file=fileInput?.files[0];
  if(!file){if(ue)ue.textContent="Please select an audio file";return;}
  if(!title){if(ue)ue.textContent="Please enter a track title";return;}
  const btn=document.getElementById("upload-btn");
  btn.disabled=true; btn.querySelector("span").textContent="Uploading…";
  try {
    const url=await uploadToImageKit(file);
    btn.querySelector("span").textContent="Saving…";
    const { ok, data }=await api("POST","/music/save-track",{title,uri:url});
    if(!ok){if(ue)ue.textContent=data.message||"Failed";return;}
    if(us)us.textContent="Track uploaded successfully! 🎉";
    showToast("Track uploaded! 🎉");
    document.getElementById("upload-form").reset();
    if(fileLabel) fileLabel.textContent="Drop audio here or click to browse";
    loadMusics();
  } catch(err) {
    if(ue) ue.textContent=err.message||"Upload failed";
  } finally {
    btn.disabled=false; btn.querySelector("span").textContent="Upload Track";
  }
});

// ════════════════════════════════════════════════════════════════
//  CREATE ALBUM
// ════════════════════════════════════════════════════════════════
async function loadTrackChecklist() {
  const list=document.getElementById("track-checklist");
  list.innerHTML=`<p class="muted-txt">Loading…</p>`;
  const { ok, data }=await api("GET","/music?limit=50"); if(ok) allMusics=data.musics||[];
  list.innerHTML="";
  if(!allMusics.length){list.innerHTML=`<p class="muted-txt">Upload some tracks first.</p>`;return;}
  allMusics.forEach(t=>{
    const item=document.createElement("label"); item.className="track-check-item";
    item.innerHTML=`<input type="checkbox" value="${t._id}"/><span>${esc(t.title)}</span>`;
    list.appendChild(item);
  });
}
document.getElementById("album-form")?.addEventListener("submit", async e=>{
  e.preventDefault();
  const ae=document.getElementById("album-error"); const as=document.getElementById("album-success");
  if(ae)ae.textContent=""; if(as)as.textContent="";
  const title=document.getElementById("album-title").value.trim();
  const checked=[...document.querySelectorAll("#track-checklist input:checked")].map(i=>i.value);
  if(!title){if(ae)ae.textContent="Album title required";return;}
  if(!checked.length){if(ae)ae.textContent="Select at least one track";return;}
  const btn=e.submitter; btn.disabled=true; btn.querySelector("span").textContent="Creating…";
  const{ok,data}=await api("POST","/music/album",{title,musics:checked});
  btn.disabled=false; btn.querySelector("span").textContent="Create Album";
  if(!ok){if(ae)ae.textContent=data.message||"Failed";return;}
  if(as)as.textContent="Album created! 🎉"; showToast("Album created! 🎉");
  document.getElementById("album-form").reset();
  document.querySelectorAll("#track-checklist input").forEach(i=>i.checked=false);
});

// ════════════════════════════════════════════════════════════════
//  PLAYER
// ════════════════════════════════════════════════════════════════
const audioEl = document.getElementById("audio-player");

function playTrack(index, tracks) {
  if(!tracks?.length) return;
  const safeIdx = ((index % tracks.length) + tracks.length) % tracks.length;
  currentIndex=safeIdx; playlist=tracks;
  const t=tracks[safeIdx]; if(!t?.uri) return;
  audioEl.src=t.uri;
  audioEl.volume=parseFloat(document.getElementById("volume-slider")?.value||"0.8");
  audioEl.play().catch(console.warn);
  isPlaying=true;
  document.getElementById("player-title").textContent=t.title||"Unknown";
  document.getElementById("player-artist").textContent=t.artist?.username||"Unknown";
  document.getElementById("play-pause-btn").innerHTML=`<i class="fa-solid fa-pause"></i>`;
  document.getElementById("player-bar").classList.remove("hidden");

  // Highlight playing card
  document.querySelectorAll(".track-card").forEach(c => c.classList.toggle("playing", c.dataset.id===t._id&&tracks===allMusics));
  document.querySelectorAll(".track-item").forEach((it,i)=>it.classList.toggle("playing",i===safeIdx));

  // Sidebar mini
  const mini=document.getElementById("now-mini"); if(mini)mini.classList.remove("hidden");
  const nmTl=document.getElementById("nm-title"); if(nmTl) nmTl.textContent=t.title;

  // Like button state
  const pb=document.getElementById("player-like-btn");
  if(pb){const il=!!likedSongs[t._id];pb.classList.toggle("liked",il);pb.innerHTML=`<i class="fa-${il?"solid":"regular"} fa-heart"></i>`;}
}

function stopPlayer() {
  audioEl.pause(); audioEl.src=""; isPlaying=false;
  document.getElementById("play-pause-btn").innerHTML=`<i class="fa-solid fa-play"></i>`;
  const mini=document.getElementById("now-mini"); if(mini) mini.classList.add("hidden");
}

document.getElementById("play-pause-btn")?.addEventListener("click", () => {
  if(!audioEl.src) return;
  if(isPlaying){audioEl.pause();isPlaying=false;document.getElementById("play-pause-btn").innerHTML=`<i class="fa-solid fa-play"></i>`;}
  else{audioEl.play().catch(()=>{});isPlaying=true;document.getElementById("play-pause-btn").innerHTML=`<i class="fa-solid fa-pause"></i>`;}
});

document.getElementById("prev-btn")?.addEventListener("click",()=>{
  if(!playlist.length)return;
  playTrack(isShuffle?Math.floor(Math.random()*playlist.length):(currentIndex-1+playlist.length)%playlist.length,playlist);
});
document.getElementById("next-btn")?.addEventListener("click",()=>{
  if(!playlist.length)return;
  playTrack(isShuffle?Math.floor(Math.random()*playlist.length):(currentIndex+1)%playlist.length,playlist);
});
audioEl.addEventListener("ended",()=>{
  if(isRepeat){audioEl.currentTime=0;audioEl.play();return;}
  playTrack(isShuffle?Math.floor(Math.random()*playlist.length):(currentIndex+1)%playlist.length,playlist);
});
document.getElementById("shuffle-btn")?.addEventListener("click",()=>{
  isShuffle=!isShuffle;
  document.getElementById("shuffle-btn").classList.toggle("active",isShuffle);
  showToast(isShuffle?"Shuffle on 🔀":"Shuffle off");
});
document.getElementById("repeat-btn")?.addEventListener("click",()=>{
  isRepeat=!isRepeat;
  document.getElementById("repeat-btn").classList.toggle("active",isRepeat);
  showToast(isRepeat?"Repeat on 🔁":"Repeat off");
});

// Progress
audioEl.addEventListener("timeupdate",()=>{
  if(!audioEl.duration)return;
  const p=(audioEl.currentTime/audioEl.duration)*100;
  const pb=document.getElementById("progress-bar"); if(pb)pb.value=p;
  document.getElementById("time-current").textContent=fmtTime(audioEl.currentTime);
  document.getElementById("time-total").textContent=fmtTime(audioEl.duration);
  const pf=document.getElementById("progress-fill"); if(pf)pf.style.width=p+"%";
});
document.getElementById("progress-bar")?.addEventListener("input",e=>{
  if(audioEl.duration) audioEl.currentTime=(e.target.value/100)*audioEl.duration;
});
document.getElementById("volume-slider")?.addEventListener("input",e=>{ audioEl.volume=e.target.value; });

// Keyboard shortcuts
document.addEventListener("keydown", e => {
  if (e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA") return;
  if (e.code==="Space") { e.preventDefault(); document.getElementById("play-pause-btn")?.click(); }
  if (e.code==="ArrowRight"&&e.altKey) document.getElementById("next-btn")?.click();
  if (e.code==="ArrowLeft"&&e.altKey)  document.getElementById("prev-btn")?.click();
});

// ════════════════════════════════════════════════════════════════
//  UTILITIES
// ════════════════════════════════════════════════════════════════
function fmtTime(s) {
  if (isNaN(s)) return "0:00";
  return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,"0")}`;
}
function esc(s) {
  return String(s||"")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function hashStr(s) {
  let h=0; for(let i=0;i<s.length;i++) h=(Math.imul(31,h)+s.charCodeAt(i))|0; return h;
}
function timeAgo(dateStr) {
  const d=new Date(dateStr); const now=new Date();
  const s=Math.floor((now-d)/1000);
  if(s<60) return "just now";
  if(s<3600) return `${Math.floor(s/60)}m ago`;
  if(s<86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

// ════════════════════════════════════════════════════════════════
//  MOBILE MENU BUTTON (shows/hides sidebar on mobile)
// ════════════════════════════════════════════════════════════════
document.getElementById("mobile-menu-btn")?.addEventListener("click", () => {
  const sidebar = document.getElementById("sidebar");
  sidebar.classList.toggle("mob-open");
});
document.addEventListener("click", e => {
  const sidebar = document.getElementById("sidebar");
  const btn = document.getElementById("mobile-menu-btn");
  if (sidebar?.classList.contains("mob-open") &&
      !sidebar.contains(e.target) &&
      e.target !== btn && !btn?.contains(e.target)) {
    sidebar.classList.remove("mob-open");
  }
});

// ════════════════════════════════════════════════════════════════
//  INIT
// ════════════════════════════════════════════════════════════════
setGreeting();
renderAuth("main");