// ============================================================
//  NovaBeats — Frontend App (Final Fix)
//  KEY FIX: enterApp() is ONLY called after:
//    1. verifyOTP() succeeds (register flow)
//    2. loginUser() succeeds AND backend confirms isVerified=true
//  The auth-box is EMPTY in index.html — renderAuthBox() builds it
// ============================================================

const API_BASE              = "https://novabeats-backend.vercel.app/api";
const IMAGEKIT_PUBLIC_KEY   = "public_yjk4r/uBhZDs80qyPem5dWEsZ1s=";
const IMAGEKIT_URL_ENDPOINT = "https://ik.imagekit.io/slrdselkt";

// ── State ─────────────────────────────────────────────────────
let currentUser       = null;
let allMusics         = [];
let playlist          = [];
let currentIndex      = -1;
let isPlaying         = false;
let isShuffle         = false;
let isRepeat          = false;
let selectedRole      = "user";
let likedSongs        = {};
let currentShareTrack = null;
let activeFilter      = "all";
let searchFilter      = "all";

// OTP flow state — stored only in memory, never persisted
let _pendingUserId = null;
let _pendingEmail  = null;
let _resetToken    = null;

// ── Particles ─────────────────────────────────────────────────
(function () {
  const canvas = document.getElementById("particles-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let W, H, pts = [];
  const resize = () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; };
  resize(); addEventListener("resize", resize);
  const COLS = ["124,106,245","240,101,200","64,224,208","168,255,62","255,107,107"];
  for (let i = 0; i < 80; i++) pts.push({
    x: Math.random()*W, y: Math.random()*H,
    r: Math.random()*1.8+0.4,
    dx: (Math.random()-.5)*.4, dy: (Math.random()-.5)*.4,
    c: COLS[Math.floor(Math.random()*COLS.length)],
    a: Math.random()*.45+.1, p: Math.random()*Math.PI*2
  });
  (function draw() {
    ctx.clearRect(0,0,W,H);
    pts.forEach(p => {
      p.p+=.018;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle=`rgba(${p.c},${p.a*(.7+.3*Math.sin(p.p))})`; ctx.fill();
      p.x+=p.dx; p.y+=p.dy;
      if(p.x<0||p.x>W)p.dx*=-1; if(p.y<0||p.y>H)p.dy*=-1;
    });
    for(let i=0;i<pts.length;i++) for(let j=i+1;j<pts.length;j++) {
      const dx=pts[i].x-pts[j].x, dy=pts[i].y-pts[j].y, d=Math.sqrt(dx*dx+dy*dy);
      if(d<110){ ctx.beginPath(); ctx.moveTo(pts[i].x,pts[i].y); ctx.lineTo(pts[j].x,pts[j].y);
        ctx.strokeStyle=`rgba(124,106,245,${0.07*(1-d/110)})`; ctx.lineWidth=0.5; ctx.stroke(); }
    }
    requestAnimationFrame(draw);
  })();
})();

// ── API helper ────────────────────────────────────────────────
async function api(method, endpoint, body=null, isForm=false) {
  try {
    const opts = { method, credentials:"include", headers: isForm?{}:{"Content-Type":"application/json"} };
    if (body) opts.body = isForm ? body : JSON.stringify(body);
    const res  = await fetch(API_BASE + endpoint, opts);
    const ct   = res.headers.get("content-type");
    const data = ct?.includes("application/json") ? await res.json() : { message: await res.text() };
    return { ok: res.ok, status: res.status, data };
  } catch(e) {
    return { ok:false, status:0, data:{ message:"Cannot reach the server. Please try again." } };
  }
}

// ── Toast ─────────────────────────────────────────────────────
let _toastTimer;
function showToast(msg, type="success") {
  const t = document.getElementById("toast");
  const m = document.getElementById("toast-msg");
  if (!t||!m) return;
  m.textContent = msg;
  t.className = `toast show ${type}`;
  t.querySelector(".toast-icon").className =
    type==="liked"  ? "toast-icon fa-solid fa-heart" :
    type==="error"  ? "toast-icon fa-solid fa-circle-xmark" :
                      "toast-icon fa-solid fa-circle-check";
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(()=>t.classList.remove("show"), 2800);
}

// ── Greeting ──────────────────────────────────────────────────
function setGreeting() {
  const h = new Date().getHours();
  const el = document.getElementById("greeting-text");
  if(el) el.textContent = h<12?"Good morning":h<17?"Good afternoon":"Good evening";
}

// ═══════════════════════════════════════════════════════════════
//  AUTH BOX — ALL screens rendered here
//  index.html has an EMPTY <div id="auth-box"></div>
//  This function builds every auth screen dynamically
// ═══════════════════════════════════════════════════════════════
function renderAuthBox(screen) {
  const box = document.getElementById("auth-box");
  if (!box) return;

  // ── MAIN SCREEN (login + register tabs) ──────────────────
  if (screen === "main") {
    box.innerHTML = `
      <div class="auth-logo">
        <div class="logo-mark"><span class="logo-n">N</span></div>
        <div class="logo-text"><span class="logo-nova">Nova</span><span class="logo-beats">Beats</span></div>
      </div>
      <p class="auth-tagline">Music without limits</p>
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
        <button type="submit" class="btn-primary"><span>Sign In</span><i class="fa-solid fa-arrow-right"></i></button>
        <button type="button" class="forgot-link" id="forgot-link">Forgot password?</button>
      </form>

      <!-- REGISTER -->
      <form id="register-form" class="auth-form">
        <div class="form-group">
          <label>Full Name</label>
          <div class="input-wrap">
            <i class="fa-solid fa-id-card input-icon"></i>
            <input type="text" id="reg-name" placeholder="your full name" autocomplete="name"/>
          </div>
        </div>
        <div class="form-group">
          <label>Username <span class="label-hint">unique · no spaces</span></label>
          <div class="input-wrap">
            <i class="fa-solid fa-at input-icon"></i>
            <input type="text" id="reg-username" placeholder="e.g. john_beats" autocomplete="off"/>
            <span class="username-status" id="username-status"></span>
          </div>
          <span class="field-hint" id="username-hint">3–20 chars · letters, numbers, underscores</span>
        </div>
        <div class="form-group">
          <label>Email</label>
          <div class="input-wrap">
            <i class="fa-solid fa-envelope input-icon"></i>
            <input type="email" id="reg-email" placeholder="you@example.com" autocomplete="email"/>
          </div>
        </div>
        <div class="form-group">
          <label>Password</label>
          <div class="input-wrap">
            <i class="fa-solid fa-lock input-icon"></i>
            <input type="password" id="reg-pw" placeholder="min 6 characters" autocomplete="new-password"/>
          </div>
          <div class="password-strength" id="pw-strength"></div>
        </div>
        <div class="form-group">
          <label>I am a...</label>
          <div class="role-toggle">
            <button type="button" class="role-btn active" data-role="user"><i class="fa-solid fa-headphones"></i> Listener</button>
            <button type="button" class="role-btn" data-role="artist"><i class="fa-solid fa-microphone"></i> Artist</button>
          </div>
        </div>
        <div id="reg-err" class="auth-error"></div>
        <button type="submit" class="btn-primary"><span>Create Account</span><i class="fa-solid fa-arrow-right"></i></button>
      </form>
    `;

    // Tabs
    box.querySelectorAll(".auth-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        box.querySelectorAll(".auth-tab").forEach(t=>t.classList.remove("active"));
        box.querySelectorAll(".auth-form").forEach(f=>f.classList.remove("active"));
        tab.classList.add("active");
        box.querySelector(`#${tab.dataset.tab}-form`).classList.add("active");
      });
    });

    // Role toggle
    box.querySelectorAll(".role-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        box.querySelectorAll(".role-btn").forEach(b=>b.classList.remove("active"));
        btn.classList.add("active"); selectedRole = btn.dataset.role;
      });
    });

    // Username live validation
    box.querySelector("#reg-username")?.addEventListener("input", e => {
      const val = e.target.value.trim();
      const st  = box.querySelector("#username-status");
      const ht  = box.querySelector("#username-hint");
      if (!val) { st.textContent=""; st.className="username-status"; ht.textContent="3–20 chars · letters, numbers, underscores"; return; }
      if (/^[a-zA-Z0-9_]{3,20}$/.test(val)) { st.textContent="✓"; st.className="username-status ok"; ht.textContent="Username looks good!"; }
      else { st.textContent="✗"; st.className="username-status error"; ht.textContent="Only letters, numbers, underscores (3–20 chars)"; }
    });

    // Password strength
    box.querySelector("#reg-pw")?.addEventListener("input", e => {
      const val=e.target.value; let sc=0;
      if(val.length>=6)sc++; if(val.length>=10)sc++;
      if(/[A-Z]/.test(val))sc++; if(/[0-9]/.test(val))sc++; if(/[^a-zA-Z0-9]/.test(val))sc++;
      const lv=[{w:"0%",c:"transparent"},{w:"25%",c:"#ff6b6b"},{w:"50%",c:"#ffa94d"},{w:"75%",c:"#ffd43b"},{w:"100%",c:"#40e0d0"}][Math.min(sc,4)];
      const bar=box.querySelector("#pw-strength");
      if(bar){bar.style.setProperty("--strength-w",lv.w);bar.style.setProperty("--strength-color",lv.c);}
    });

    // Forgot password link
    box.querySelector("#forgot-link")?.addEventListener("click", ()=>renderAuthBox("forgot"));

    // ── LOGIN SUBMIT ──
    box.querySelector("#login-form")?.addEventListener("submit", async e => {
      e.preventDefault();
      const errEl = box.querySelector("#login-err");
      errEl.textContent = "";
      const id = box.querySelector("#login-id").value.trim();
      const pw = box.querySelector("#login-pw").value;
      if (!id || !pw) { errEl.textContent="Please enter your credentials"; return; }
      const isEmail = id.includes("@");
      const btn = e.submitter;
      btn.disabled=true; btn.querySelector("span").textContent="Signing in...";
      const { ok, data } = await api("POST","/auth/login", isEmail?{email:id,password:pw}:{username:id,password:pw});
      btn.disabled=false; btn.querySelector("span").textContent="Sign In";
      if (!ok) {
        // ✅ Backend blocked — account not verified
        if (data.needsVerification) {
          _pendingUserId = data.userId;
          _pendingEmail  = data.email;
          renderAuthBox("otp-register");
          return;
        }
        errEl.textContent = data.message || "Invalid credentials";
        return;
      }
      // ✅ Backend confirmed isVerified=true — safe to enter app
      currentUser = data.user;
      loadLikesFromServer();
      enterApp();
    });

    // ── REGISTER SUBMIT ──
    box.querySelector("#register-form")?.addEventListener("submit", async e => {
      e.preventDefault();
      const errEl = box.querySelector("#reg-err");
      errEl.textContent = "";
      const name     = box.querySelector("#reg-name").value.trim();
      const username = box.querySelector("#reg-username").value.trim();
      const email    = box.querySelector("#reg-email").value.trim();
      const pw       = box.querySelector("#reg-pw").value;

      if (!name)     { errEl.textContent="Please enter your full name"; return; }
      if (!username) { errEl.textContent="Please choose a username"; return; }
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) { errEl.textContent="Username: 3-20 chars, letters/numbers/underscores only"; return; }
      if (!email)    { errEl.textContent="Please enter your email"; return; }
      if (pw.length < 6) { errEl.textContent="Password must be at least 6 characters"; return; }

      const btn = e.submitter;
      btn.disabled=true; btn.querySelector("span").textContent="Sending OTP...";
      const { ok, data } = await api("POST","/auth/register",{name,username,email,password:pw,role:selectedRole});
      btn.disabled=false; btn.querySelector("span").textContent="Create Account";

      if (!ok) { errEl.textContent = data.message||"Registration failed"; return; }

      // ✅ Store pending — show OTP screen — DO NOT call enterApp()
      _pendingUserId = data.userId;
      _pendingEmail  = data.email;
      renderAuthBox("otp-register");
    });

    return;
  }

  // ── OTP SCREEN ────────────────────────────────────────────
  if (screen === "otp-register" || screen === "otp-reset") {
    const isReset = screen === "otp-reset";
    let secs = 600;

    box.innerHTML = `
      <div class="auth-logo">
        <div class="logo-mark"><span class="logo-n">N</span></div>
        <div class="logo-text"><span class="logo-nova">Nova</span><span class="logo-beats">Beats</span></div>
      </div>
      <button class="back-to-login" id="otp-back"><i class="fa-solid fa-arrow-left"></i> Back</button>
      <h2 style="font-size:1.3rem;font-weight:700;margin-bottom:6px">Check your inbox</h2>
      <p style="color:var(--text-muted);font-size:0.88rem;margin-bottom:20px">
        We sent a 6-digit OTP to<br/>
        <strong style="color:var(--accent2)">${_pendingEmail||""}</strong>
      </p>
      <div class="otp-inputs" id="otp-inputs">
        ${[0,1,2,3,4,5].map(()=>`<input class="otp-box" maxlength="1" type="text" inputmode="numeric" pattern="[0-9]"/>`).join("")}
      </div>
      <div class="otp-timer">Expires in <span id="otp-cd">10:00</span></div>
      <div id="otp-err" class="auth-error" style="text-align:center;margin:10px 0"></div>
      <button class="btn-primary" id="verify-btn" style="margin-top:8px">
        <span>Verify OTP</span><i class="fa-solid fa-check"></i>
      </button>
      <button id="resend-btn" style="background:none;border:none;color:var(--text-muted);font-family:var(--font);font-size:0.84rem;cursor:pointer;width:100%;text-align:center;margin-top:14px">
        Didn't receive it? <span style="color:var(--accent2);text-decoration:underline">Resend OTP</span>
      </button>
    `;

    // OTP boxes
    const boxes = [...box.querySelectorAll(".otp-box")];
    boxes.forEach((b, i) => {
      b.addEventListener("input", () => {
        b.value = b.value.replace(/\D/g,"");
        b.classList.toggle("filled", !!b.value);
        if (b.value && i<5) boxes[i+1].focus();
      });
      b.addEventListener("keydown", e => {
        if (e.key==="Backspace"&&!b.value&&i>0) { boxes[i-1].value=""; boxes[i-1].classList.remove("filled"); boxes[i-1].focus(); }
      });
      b.addEventListener("paste", e => {
        e.preventDefault();
        const p = e.clipboardData.getData("text").replace(/\D/g,"").slice(0,6);
        p.split("").forEach((c,j)=>{ if(boxes[j]){boxes[j].value=c;boxes[j].classList.add("filled");} });
        boxes[Math.min(p.length,5)].focus();
      });
    });
    boxes[0].focus();

    // Countdown timer
    const cdEl = box.querySelector("#otp-cd");
    const timer = setInterval(() => {
      secs--;
      if (secs<=0) { clearInterval(timer); if(cdEl)cdEl.textContent="Expired"; return; }
      if (cdEl) cdEl.textContent=`${String(Math.floor(secs/60)).padStart(2,"0")}:${String(secs%60).padStart(2,"0")}`;
    }, 1000);

    // Back button
    box.querySelector("#otp-back").addEventListener("click", ()=>{
      clearInterval(timer); renderAuthBox("main");
    });

    // Verify button
    box.querySelector("#verify-btn").addEventListener("click", async () => {
      const otp   = boxes.map(b=>b.value).join("");
      const errEl = box.querySelector("#otp-err");
      if (otp.length<6) { errEl.textContent="Please enter all 6 digits"; return; }
      const btn = box.querySelector("#verify-btn");
      btn.disabled=true; btn.querySelector("span").textContent="Verifying...";

      if (!isReset) {
        // ── Register OTP ──
        const { ok, data } = await api("POST","/auth/verify-otp",{userId:_pendingUserId,otp});
        btn.disabled=false; btn.querySelector("span").textContent="Verify OTP";
        if (!ok) { errEl.textContent=data.message; return; }
        clearInterval(timer);
        // ✅ Only now enter the app — OTP confirmed by backend
        currentUser = data.user;
        loadLikesFromServer();
        enterApp();
        showToast("Email verified! Welcome to NovaBeats 🎵");
      } else {
        // ── Reset OTP ──
        const { ok, data } = await api("POST","/auth/verify-reset-otp",{userId:_pendingUserId,otp});
        btn.disabled=false; btn.querySelector("span").textContent="Verify OTP";
        if (!ok) { errEl.textContent=data.message; return; }
        clearInterval(timer);
        _resetToken = data.resetToken;
        renderAuthBox("new-password");
      }
    });

    // Resend
    box.querySelector("#resend-btn").addEventListener("click", async () => {
      const { ok } = await api("POST","/auth/resend-otp",{userId:_pendingUserId});
      if (ok) {
        secs=600; boxes.forEach(b=>{b.value="";b.classList.remove("filled");}); boxes[0].focus();
        box.querySelector("#otp-err").textContent="";
        showToast("New OTP sent ✉️");
      } else {
        showToast("Failed to resend OTP","error");
      }
    });

    return;
  }

  // ── FORGOT PASSWORD ───────────────────────────────────────
  if (screen === "forgot") {
    box.innerHTML = `
      <div class="auth-logo">
        <div class="logo-mark"><span class="logo-n">N</span></div>
        <div class="logo-text"><span class="logo-nova">Nova</span><span class="logo-beats">Beats</span></div>
      </div>
      <button class="back-to-login" id="forgot-back"><i class="fa-solid fa-arrow-left"></i> Back to Sign In</button>
      <h2 style="font-size:1.3rem;font-weight:700;margin-bottom:6px">Forgot Password?</h2>
      <p style="color:var(--text-muted);font-size:0.88rem;margin-bottom:24px">
        Enter your email and we'll send an OTP to reset your password.
      </p>
      <div class="form-group">
        <label>Email Address</label>
        <div class="input-wrap">
          <i class="fa-solid fa-envelope input-icon"></i>
          <input type="email" id="forgot-email" placeholder="you@example.com" autocomplete="email"/>
        </div>
      </div>
      <div id="forgot-err" class="auth-error" style="margin:8px 0"></div>
      <button class="btn-primary" id="send-otp-btn" style="margin-top:12px">
        <span>Send OTP</span><i class="fa-solid fa-paper-plane"></i>
      </button>
    `;
    box.querySelector("#forgot-back").addEventListener("click", ()=>renderAuthBox("main"));
    box.querySelector("#forgot-email").addEventListener("keydown", e=>{if(e.key==="Enter")box.querySelector("#send-otp-btn").click();});
    box.querySelector("#send-otp-btn").addEventListener("click", async () => {
      const email = box.querySelector("#forgot-email").value.trim();
      const errEl = box.querySelector("#forgot-err");
      if (!email) { errEl.textContent="Please enter your email"; return; }
      const btn = box.querySelector("#send-otp-btn");
      btn.disabled=true; btn.querySelector("span").textContent="Sending...";
      const { ok, data } = await api("POST","/auth/forgot-password",{email});
      btn.disabled=false; btn.querySelector("span").textContent="Send OTP";
      if (!ok) {
        if (data.needsVerification) { _pendingUserId=data.userId; _pendingEmail=email; renderAuthBox("otp-register"); return; }
        errEl.textContent = data.message; return;
      }
      _pendingUserId = data.userId;
      _pendingEmail  = email;
      renderAuthBox("otp-reset");
      showToast("OTP sent to your email ✉️");
    });
    return;
  }

  // ── NEW PASSWORD ──────────────────────────────────────────
  if (screen === "new-password") {
    box.innerHTML = `
      <div class="auth-logo">
        <div class="logo-mark"><span class="logo-n">N</span></div>
        <div class="logo-text"><span class="logo-nova">Nova</span><span class="logo-beats">Beats</span></div>
      </div>
      <h2 style="font-size:1.3rem;font-weight:700;margin-bottom:6px">Set New Password</h2>
      <p style="color:var(--text-muted);font-size:0.88rem;margin-bottom:24px">Choose a strong new password.</p>
      <div class="form-group">
        <label>New Password</label>
        <div class="input-wrap" style="position:relative">
          <i class="fa-solid fa-lock input-icon"></i>
          <input type="password" id="new-pw" placeholder="min 6 characters" autocomplete="new-password"/>
          <button type="button" id="toggle-pw" class="toggle-pw-btn"><i class="fa-solid fa-eye"></i></button>
        </div>
        <div class="password-strength" id="new-pw-strength"></div>
      </div>
      <div class="form-group">
        <label>Confirm Password</label>
        <div class="input-wrap">
          <i class="fa-solid fa-lock input-icon"></i>
          <input type="password" id="confirm-pw" placeholder="repeat password" autocomplete="new-password"/>
        </div>
      </div>
      <div id="reset-err" class="auth-error" style="margin:8px 0"></div>
      <button class="btn-primary" id="reset-btn" style="margin-top:12px">
        <span>Reset Password</span><i class="fa-solid fa-key"></i>
      </button>
    `;
    box.querySelector("#toggle-pw").addEventListener("click", ()=>{
      const inp=box.querySelector("#new-pw"), ic=box.querySelector("#toggle-pw i");
      inp.type=inp.type==="password"?"text":"password";
      ic.className=inp.type==="password"?"fa-solid fa-eye":"fa-solid fa-eye-slash";
    });
    box.querySelector("#new-pw").addEventListener("input", e=>{
      const val=e.target.value; let sc=0;
      if(val.length>=6)sc++; if(val.length>=10)sc++; if(/[A-Z]/.test(val))sc++; if(/[0-9]/.test(val))sc++; if(/[^a-zA-Z0-9]/.test(val))sc++;
      const lv=[{w:"0%",c:"transparent"},{w:"25%",c:"#ff6b6b"},{w:"50%",c:"#ffa94d"},{w:"75%",c:"#ffd43b"},{w:"100%",c:"#40e0d0"}][Math.min(sc,4)];
      const bar=box.querySelector("#new-pw-strength"); if(bar){bar.style.setProperty("--strength-w",lv.w);bar.style.setProperty("--strength-color",lv.c);}
    });
    box.querySelector("#reset-btn").addEventListener("click", async ()=>{
      const np=box.querySelector("#new-pw").value, cp=box.querySelector("#confirm-pw").value;
      const errEl=box.querySelector("#reset-err");
      if(np.length<6){errEl.textContent="Password must be at least 6 characters";return;}
      if(np!==cp){errEl.textContent="Passwords do not match";return;}
      const btn=box.querySelector("#reset-btn"); btn.disabled=true; btn.querySelector("span").textContent="Resetting...";
      const{ok,data}=await api("POST","/auth/reset-password",{resetToken:_resetToken,newPassword:np});
      btn.disabled=false; btn.querySelector("span").textContent="Reset Password";
      if(!ok){errEl.textContent=data.message;return;}
      renderAuthBox("success");
    });
    return;
  }

  // ── SUCCESS ───────────────────────────────────────────────
  if (screen === "success") {
    box.innerHTML = `
      <div class="success-screen">
        <div class="success-icon"><i class="fa-solid fa-check"></i></div>
        <h2 style="font-size:1.3rem;font-weight:700;margin-bottom:8px">Password Reset!</h2>
        <p style="color:var(--text-muted);font-size:0.9rem;margin-bottom:28px">
          Your password has been reset successfully.<br/>You can now sign in.
        </p>
        <button class="btn-primary" id="go-login"><span>Sign In Now</span><i class="fa-solid fa-arrow-right"></i></button>
      </div>
    `;
    showToast("Password reset successfully! 🎉");
    box.querySelector("#go-login").addEventListener("click", ()=>renderAuthBox("main"));
    return;
  }
}

// ── Logout ────────────────────────────────────────────────────
document.getElementById("logout-btn")?.addEventListener("click", async ()=>{
  await api("POST","/auth/logout");
  currentUser=null; allMusics=[]; playlist=[]; currentIndex=-1; likedSongs={};
  stopPlayer();
  document.getElementById("app").classList.add("hidden");
  document.getElementById("player-bar").classList.add("hidden");
  document.getElementById("auth-overlay").classList.add("active");
  // Clear pending state
  _pendingUserId=null; _pendingEmail=null; _resetToken=null;
  renderAuthBox("main");
});

// ── Enter App ─────────────────────────────────────────────────
// ✅ This is the ONLY gateway into the app
function enterApp() {
  document.getElementById("auth-overlay").classList.remove("active");
  document.getElementById("app").classList.remove("hidden");
  setGreeting();
  document.getElementById("sidebar-username").textContent   = currentUser.username;
  document.getElementById("sidebar-role").textContent       = currentUser.role;
  document.getElementById("user-avatar-letter").textContent = currentUser.username[0].toUpperCase();
  document.querySelectorAll(".artist-only").forEach(el=>el.classList.toggle("hidden",currentUser.role!=="artist"));
  loadMusics();
  showView("home");
}

// ═══════════════════════════════════════════════════════════════
//  VIEWS
// ═══════════════════════════════════════════════════════════════
function showView(viewId) {
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n=>n.classList.remove("active"));
  const view = document.getElementById(`view-${viewId}`); if(view)view.classList.add("active");
  const nav  = document.querySelector(`.nav-item[data-view="${viewId}"]`); if(nav)nav.classList.add("active");
  if(viewId==="albums")       loadAlbums();
  if(viewId==="liked")        renderLikedSongs();
  if(viewId==="feed")         loadFeed();
  if(viewId==="create-album") loadTrackChecklist();
  if(viewId==="search")       document.getElementById("search-input")?.focus();
}

document.querySelectorAll(".nav-item").forEach(i=>i.addEventListener("click",e=>{e.preventDefault();showView(i.dataset.view);}));
document.getElementById("back-to-albums")?.addEventListener("click",()=>showView("albums"));
document.querySelectorAll(".chip").forEach(c=>c.addEventListener("click",()=>{
  document.querySelectorAll(".chip").forEach(x=>x.classList.remove("active"));
  c.classList.add("active"); activeFilter=c.dataset.filter; renderMusicGrid();
}));

// ── Music ─────────────────────────────────────────────────────
async function loadMusics() {
  const grid=document.getElementById("music-grid"); if(!grid)return;
  grid.innerHTML=`<div class="skeleton-loader"></div>`.repeat(5);
  const{ok,data}=await api("GET","/music"); grid.innerHTML="";
  if(!ok){grid.innerHTML=`<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>${data.message}</p></div>`;return;}
  allMusics=data.musics||[]; playlist=[...allMusics];
  if(allMusics.length){
    const ft=document.getElementById("featured-title"); if(ft)ft.textContent=allMusics[0].title;
    const fa=document.getElementById("featured-artist"); if(fa)fa.textContent=allMusics[0].artist?.username||"";
    const fp=document.getElementById("featured-play-btn"); if(fp)fp.onclick=()=>playTrack(0,allMusics);
  }
  renderMusicGrid();
}

function renderMusicGrid() {
  const grid=document.getElementById("music-grid"); if(!grid)return;
  grid.innerHTML="";
  const toShow=activeFilter==="recent"?[...allMusics].slice(-8).reverse():[...allMusics];
  if(!toShow.length){grid.innerHTML=`<div class="empty-state"><i class="fa-solid fa-music"></i><p>No tracks yet</p></div>`;return;}
  toShow.forEach((m,i)=>{const c=mkCard(m,i);c.style.animationDelay=`${i*.045}s`;grid.appendChild(c);});
}

function mkCard(music, index) {
  const card=document.createElement("div"); card.className="music-card"; card.dataset.id=music._id;
  const E=["🎵","🎶","🎸","🎹","🥁","🎷","🎺","🎻","🎼","🎤","🎧","💿"];
  const emoji=E[Math.abs(hashStr(music._id))%E.length];
  const isLiked=!!likedSongs[music._id];
  card.innerHTML=`
    <button class="card-share-btn"><i class="fa-solid fa-share-nodes"></i></button>
    <button class="card-like-btn ${isLiked?"liked":""}"><i class="fa-${isLiked?"solid":"regular"} fa-heart"></i></button>
    <div class="music-thumb"><div class="music-thumb-bg"></div>
      <span style="font-size:2.5rem;position:relative;z-index:1">${emoji}</span>
      <div class="play-overlay"><div class="play-overlay-btn"><i class="fa-solid fa-play"></i></div></div>
    </div>
    <div class="music-card-title">${escHtml(music.title)}</div>
    <div class="music-card-artist">${escHtml(music.artist?.username||"Unknown")}</div>
    <div class="music-card-likes"><i class="fa-solid fa-heart" style="font-size:.7rem;color:var(--pink)"></i> <span class="lc-${music._id}">${music.likes?.length||0}</span></div>`;
  card.querySelector(".play-overlay-btn").addEventListener("click",e=>{e.stopPropagation();playlist=[...allMusics];playTrack(index,playlist);});
  card.addEventListener("click",()=>{playlist=[...allMusics];playTrack(index,playlist);});
  card.querySelector(".card-like-btn").addEventListener("click",e=>{e.stopPropagation();toggleLike(music,card.querySelector(".card-like-btn"));});
  card.querySelector(".card-share-btn").addEventListener("click",e=>{e.stopPropagation();openShare(music);});
  return card;
}

// ── Albums ────────────────────────────────────────────────────
async function loadAlbums() {
  const grid=document.getElementById("albums-grid"); if(!grid)return;
  grid.innerHTML=`<div class="skeleton-loader"></div>`.repeat(3);
  const{ok,data}=await api("GET","/music/albums"); grid.innerHTML="";
  if(!ok){grid.innerHTML=`<div class="empty-state"><i class="fa-solid fa-record-vinyl"></i><p>${data.message}</p></div>`;return;}
  const albums=data.albums||[];
  if(!albums.length){grid.innerHTML=`<div class="empty-state"><i class="fa-solid fa-record-vinyl"></i><p>No albums yet</p></div>`;return;}
  albums.forEach((a,i)=>{const c=mkAlbumCard(a);c.style.animationDelay=`${i*.06}s`;grid.appendChild(c);});
}

function mkAlbumCard(album) {
  const card=document.createElement("div"); card.className="album-card";
  const E=["🎵","🎶","🎸","🎹","🥁","🎷","🎺","🎻"];
  card.innerHTML=`<div class="album-art">${E[Math.abs(hashStr(album._id))%E.length]}</div>
    <div class="album-card-title">${escHtml(album.title)}</div>
    <div class="album-card-artist">${escHtml(album.artist?.username||"Unknown")}</div>`;
  card.addEventListener("click",()=>openAlbum(album._id));
  return card;
}

async function openAlbum(albumId) {
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  document.getElementById("view-album-detail").classList.add("active");
  const content=document.getElementById("album-detail-content");
  content.innerHTML=`<div class="skeleton-loader" style="height:190px"></div>`;
  const{ok,data}=await api("GET",`/music/albums/${albumId}`);
  if(!ok){content.innerHTML=`<p class="muted">Failed to load album.</p>`;return;}
  const album=data.album; const tracks=album.musics||[];
  const E=["🎵","🎶","🎸","🎹","🥁","🎷","🎺","🎻"];
  const emoji=E[Math.abs(hashStr(album._id))%E.length];
  content.innerHTML=`
    <div class="album-detail-hero">
      <div class="album-detail-art">${emoji}</div>
      <div class="album-detail-info">
        <p style="font-size:.72rem;font-weight:700;text-transform:uppercase;color:var(--text-muted)">Album</p>
        <h2>${escHtml(album.title)}</h2>
        <p>${escHtml(album.artist?.username||"Unknown")} • ${tracks.length} track${tracks.length!==1?"s":""}</p>
      </div>
    </div>
    <div style="margin-bottom:16px">
      <button class="btn-primary" style="width:auto;padding:10px 24px;margin:0" id="play-all">
        <i class="fa-solid fa-play"></i> Play All
      </button>
    </div>
    <div class="track-list" id="album-tracks"></div>`;
  const ap=tracks.map(t=>({...t,artist:album.artist}));
  document.getElementById("play-all").onclick=()=>{if(ap.length){playlist=ap;playTrack(0,ap);}};
  const tl=document.getElementById("album-tracks");
  if(!tracks.length){tl.innerHTML=`<p class="muted">No tracks.</p>`;return;}
  tracks.forEach((t,i)=>{
    const it=document.createElement("div"); it.className="track-item";
    it.innerHTML=`<span class="track-num">${i+1}</span><span class="track-item-title">${escHtml(t.title)}</span><i class="fa-solid fa-play track-play-icon"></i>`;
    it.addEventListener("click",()=>{playlist=ap;playTrack(i,ap);});
    tl.appendChild(it);
  });
}

// ── Feed ──────────────────────────────────────────────────────
async function loadFeed() {
  const grid=document.getElementById("feed-grid"); if(!grid)return;
  grid.innerHTML=`<div class="skeleton-loader"></div>`.repeat(3);
  const{ok,data}=await api("GET","/social/feed"); grid.innerHTML="";
  if(!ok||!data.feed?.length){
    grid.innerHTML=`<div class="empty-state"><i class="fa-solid fa-rss"></i><p>Follow artists to see their tracks here</p></div>`;return;
  }
  data.feed.forEach((m,i)=>{const c=mkCard(m,i);grid.appendChild(c);});
}

// ── Search ────────────────────────────────────────────────────
const si=document.getElementById("search-input");
const sc=document.getElementById("search-clear");
let sd=null;
si?.addEventListener("input",()=>{const q=si.value.trim();sc?.classList.toggle("hidden",!q);clearTimeout(sd);sd=setTimeout(()=>runSearch(q),280);});
sc?.addEventListener("click",()=>{si.value="";sc.classList.add("hidden");const r=document.getElementById("search-results");if(r)r.innerHTML=`<div class="search-empty"><div class="search-empty-icon">🎵</div><p>Start typing to search</p></div>`;});
document.querySelectorAll(".s-tab").forEach(t=>t.addEventListener("click",()=>{document.querySelectorAll(".s-tab").forEach(x=>x.classList.remove("active"));t.classList.add("active");searchFilter=t.dataset.type;runSearch(si?.value.trim()||"");}));

async function runSearch(q) {
  const r=document.getElementById("search-results"); if(!r)return;
  if(!q){r.innerHTML=`<div class="search-empty"><div class="search-empty-icon">🎵</div><p>Start typing to search</p></div>`;return;}
  r.innerHTML=`<div class="skeleton-loader" style="height:60px;margin-bottom:8px"></div>`.repeat(3);
  const[mR,aR]=await Promise.all([api("GET","/music"),api("GET","/music/albums")]);
  const musics=mR.ok?(mR.data.musics||[]):[], albums=aR.ok?(aR.data.albums||[]):[], ql=q.toLowerCase();
  const mt=musics.filter(m=>m.title.toLowerCase().includes(ql)||(m.artist?.username||"").toLowerCase().includes(ql));
  const ma=albums.filter(a=>a.title.toLowerCase().includes(ql)||(a.artist?.username||"").toLowerCase().includes(ql));
  const names=[...new Set(musics.map(m=>m.artist?.username).filter(Boolean))].filter(a=>a.toLowerCase().includes(ql));
  r.innerHTML="";
  if(!mt.length&&!ma.length&&!names.length){r.innerHTML=`<div class="search-empty"><div class="search-empty-icon">🔍</div><p>No results for "${escHtml(q)}"</p></div>`;return;}
  const mkLbl=t=>{const d=document.createElement("div");d.className="search-section-title";d.textContent=t;return d;};
  if((searchFilter==="all"||searchFilter==="tracks")&&mt.length){
    r.appendChild(mkLbl("Tracks"));
    mt.forEach(track=>{
      const idx=allMusics.findIndex(m=>m._id===track._id);
      const E=["🎵","🎶","🎸","🎹","🥁","🎷","🎺","🎻","🎼","🎤"];
      const isL=!!likedSongs[track._id];
      const row=document.createElement("div"); row.className="search-track-row";
      row.innerHTML=`<div class="str-thumb">${E[Math.abs(hashStr(track._id))%E.length]}</div>
        <div class="str-info"><div class="str-title">${escHtml(track.title)}</div><div class="str-sub">${escHtml(track.artist?.username||"")}</div></div>
        <span class="str-badge">Track</span>
        <button class="card-like-btn ${isL?"liked":""}" style="opacity:1;position:static;width:32px;height:32px"><i class="fa-${isL?"solid":"regular"} fa-heart"></i></button>`;
      row.addEventListener("click",e=>{if(e.target.closest(".card-like-btn"))return;playlist=[...allMusics];playTrack(idx>=0?idx:0,playlist);});
      row.querySelector(".card-like-btn").addEventListener("click",e=>{e.stopPropagation();toggleLike(track,row.querySelector(".card-like-btn"));});
      r.appendChild(row);
    });
  }
  if((searchFilter==="all"||searchFilter==="albums")&&ma.length){
    r.appendChild(mkLbl("Albums"));
    ma.forEach(album=>{
      const E=["🎵","🎶","🎸","🎹","🥁","🎷"];
      const row=document.createElement("div"); row.className="search-track-row";
      row.innerHTML=`<div class="str-thumb">${E[Math.abs(hashStr(album._id))%E.length]}</div>
        <div class="str-info"><div class="str-title">${escHtml(album.title)}</div><div class="str-sub">${escHtml(album.artist?.username||"")}</div></div>
        <span class="str-badge">Album</span>`;
      row.addEventListener("click",()=>openAlbum(album._id));
      r.appendChild(row);
    });
  }
  if((searchFilter==="all"||searchFilter==="artists")&&names.length){
    r.appendChild(mkLbl("Artists"));
    names.forEach(name=>{
      const at=musics.filter(m=>m.artist?.username===name);
      const row=document.createElement("div"); row.className="search-track-row";
      row.innerHTML=`<div class="str-thumb" style="background:linear-gradient(135deg,var(--accent3),var(--pink));color:white;font-size:1.3rem">${name[0].toUpperCase()}</div>
        <div class="str-info"><div class="str-title">${escHtml(name)}</div><div class="str-sub">${at.length} track${at.length!==1?"s":""}</div></div>
        <span class="str-badge">Artist</span>`;
      row.addEventListener("click",()=>{if(at.length){playlist=at;playTrack(0,at);}});
      r.appendChild(row);
    });
  }
}

// ── Likes ─────────────────────────────────────────────────────
async function loadLikesFromServer() {
  const{ok,data}=await api("GET","/social/liked"); if(!ok)return;
  likedSongs={}; (data.likedSongs||[]).forEach(m=>{likedSongs[m._id]=m;}); updateLikedCount();
}

function updateLikedCount() {
  const n=Object.keys(likedSongs).length;
  const b=document.getElementById("liked-count"); if(b)b.textContent=n;
  const t=document.getElementById("liked-count-text"); if(t)t.textContent=`${n} song${n!==1?"s":""}`;
}

async function toggleLike(music, btn) {
  const{ok,data}=await api("POST",`/social/like/${music._id}`);
  if(!ok){showToast(data.message||"Failed","error");return;}
  const isLiked=data.liked;
  if(isLiked){likedSongs[music._id]=music;showToast("Added to Liked Songs ❤️","liked");}
  else{delete likedSongs[music._id];showToast("Removed from Liked Songs");}
  updateLikedCount();
  document.querySelectorAll(`.music-card[data-id="${music._id}"] .card-like-btn`).forEach(b=>{b.classList.toggle("liked",isLiked);b.innerHTML=`<i class="fa-${isLiked?"solid":"regular"} fa-heart"></i>`;});
  if(btn){btn.classList.toggle("liked",isLiked);btn.innerHTML=`<i class="fa-${isLiked?"solid":"regular"} fa-heart"></i>`;}
  const ce=document.querySelector(`.lc-${music._id}`); if(ce)ce.textContent=data.likes;
  const pb=document.getElementById("player-like-btn");
  if(pb&&playlist[currentIndex]?._id===music._id){pb.classList.toggle("liked",isLiked);pb.innerHTML=`<i class="fa-${isLiked?"solid":"regular"} fa-heart"></i>`;}
  const lv=document.getElementById("view-liked"); if(lv?.classList.contains("active"))renderLikedSongs();
}

function renderLikedSongs() {
  const list=document.getElementById("liked-list"); const songs=Object.values(likedSongs); updateLikedCount();
  if(!songs.length){list.innerHTML=`<div class="empty-state"><i class="fa-regular fa-heart"></i><p>Songs you like will appear here</p></div>`;return;}
  list.innerHTML="";
  songs.forEach((m,i)=>{
    const row=document.createElement("div"); row.className="liked-track-row";
    const E=["🎵","🎶","🎸","🎹","🥁","🎷","🎺","🎻"];
    row.innerHTML=`<span class="ltr-num">${i+1}</span>
      <div class="ltr-thumb">${E[Math.abs(hashStr(m._id))%E.length]}</div>
      <div class="ltr-info"><div class="ltr-title">${escHtml(m.title)}</div><div class="ltr-artist">${escHtml(m.artist?.username||"Unknown")}</div></div>
      <button class="ltr-unlike"><i class="fa-solid fa-heart"></i></button>`;
    row.addEventListener("click",e=>{if(e.target.closest(".ltr-unlike"))return;playlist=songs;playTrack(i,songs);});
    row.querySelector(".ltr-unlike").addEventListener("click",()=>toggleLike(m,null));
    list.appendChild(row);
  });
}

document.getElementById("player-like-btn")?.addEventListener("click",()=>{
  if(currentIndex<0||!playlist[currentIndex])return;
  toggleLike(playlist[currentIndex],document.getElementById("player-like-btn"));
});

// ── Share ─────────────────────────────────────────────────────
function openShare(music) {
  currentShareTrack=music;
  document.getElementById("share-title").textContent=music.title||"Unknown";
  document.getElementById("share-artist").textContent=music.artist?.username||"Unknown";
  document.getElementById("share-link-input").value=music.uri||location.href;
  document.getElementById("share-modal").classList.remove("hidden");
}
document.getElementById("share-modal-close")?.addEventListener("click",()=>document.getElementById("share-modal").classList.add("hidden"));
document.getElementById("share-modal")?.addEventListener("click",e=>{if(e.target===document.getElementById("share-modal"))document.getElementById("share-modal").classList.add("hidden");});
document.getElementById("copy-link-btn")?.addEventListener("click",()=>{const i=document.getElementById("share-link-input");navigator.clipboard.writeText(i.value).then(()=>showToast("Link copied!")).catch(()=>{i.select();document.execCommand("copy");showToast("Link copied!");});});
document.getElementById("share-whatsapp")?.addEventListener("click",()=>{if(!currentShareTrack)return;window.open(`https://wa.me/?text=${encodeURIComponent(`🎵 Listen to "${currentShareTrack.title}" on NovaBeats!\n${currentShareTrack.uri||location.href}`)}`,"_blank");});
document.getElementById("share-twitter")?.addEventListener("click",()=>{if(!currentShareTrack)return;window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`🎵 Listening to "${currentShareTrack.title}" on NovaBeats!`)}&url=${encodeURIComponent(currentShareTrack.uri||location.href)}`,"_blank");});
document.getElementById("share-player-btn")?.addEventListener("click",()=>{if(currentIndex>=0&&playlist[currentIndex])openShare(playlist[currentIndex]);});

// ── Upload ────────────────────────────────────────────────────
const fdz=document.getElementById("file-drop-zone"),fi=document.getElementById("upload-file"),fl=document.getElementById("file-label");
fdz?.addEventListener("click",()=>fi.click());
fi?.addEventListener("change",()=>{if(fi.files[0])fl.textContent=fi.files[0].name;});
fdz?.addEventListener("dragover",e=>{e.preventDefault();fdz.classList.add("drag-over");});
fdz?.addEventListener("dragleave",()=>fdz.classList.remove("drag-over"));
fdz?.addEventListener("drop",e=>{e.preventDefault();fdz.classList.remove("drag-over");const f=e.dataTransfer.files[0];if(f){fi.files=e.dataTransfer.files;fl.textContent=f.name;}});

async function uploadToIK(file) {
  const{ok,data}=await api("GET","/music/imagekit-auth"); if(!ok)throw new Error("Auth failed");
  const fd=new FormData(); fd.append("file",file); fd.append("fileName","music_"+Date.now());
  fd.append("publicKey",IMAGEKIT_PUBLIC_KEY); fd.append("signature",data.signature);
  fd.append("expire",data.expire); fd.append("token",data.token); fd.append("folder","novabeats/music");
  const res=await fetch("https://upload.imagekit.io/api/v1/files/upload",{method:"POST",body:fd});
  if(!res.ok){const e=await res.json();throw new Error(e.message||"Upload failed");}
  return(await res.json()).url;
}

document.getElementById("upload-form")?.addEventListener("submit",async e=>{
  e.preventDefault();
  const ue=document.getElementById("upload-error"),us=document.getElementById("upload-success");
  if(ue)ue.textContent=""; if(us)us.textContent="";
  const title=document.getElementById("upload-title").value.trim(), file=fi?.files[0];
  if(!file){if(ue)ue.textContent="Please select an audio file.";return;}
  if(!title){if(ue)ue.textContent="Please enter a track title.";return;}
  const btn=document.getElementById("upload-btn"); btn.disabled=true; btn.querySelector("span").textContent="Uploading...";
  try{
    const url=await uploadToIK(file); btn.querySelector("span").textContent="Saving...";
    const{ok,data}=await api("POST","/music/save-track",{title,uri:url});
    if(!ok){if(ue)ue.textContent=data.message||"Failed";return;}
    if(us)us.textContent="Track uploaded! 🎉"; showToast("Track uploaded! 🎉");
    document.getElementById("upload-form").reset(); if(fl)fl.textContent="Drop your audio file here or click to browse"; loadMusics();
  }catch(err){if(ue)ue.textContent=err.message||"Upload failed";}
  finally{btn.disabled=false;btn.querySelector("span").textContent="Upload Track";}
});

// ── Create Album ──────────────────────────────────────────────
async function loadTrackChecklist() {
  const list=document.getElementById("track-checklist"); list.innerHTML=`<p class="muted">Loading...</p>`;
  const{ok,data}=await api("GET","/music"); if(ok)allMusics=data.musics||[];
  list.innerHTML="";
  if(!allMusics.length){list.innerHTML=`<p class="muted">Upload some tracks first.</p>`;return;}
  allMusics.forEach(t=>{const it=document.createElement("label");it.className="track-check-item";it.innerHTML=`<input type="checkbox" value="${t._id}"/><span>${escHtml(t.title)}</span>`;list.appendChild(it);});
}

document.getElementById("album-form")?.addEventListener("submit",async e=>{
  e.preventDefault();
  const ae=document.getElementById("album-error"),as=document.getElementById("album-success");
  if(ae)ae.textContent=""; if(as)as.textContent="";
  const title=document.getElementById("album-title").value.trim();
  const checked=[...document.querySelectorAll("#track-checklist input:checked")].map(i=>i.value);
  if(!title){if(ae)ae.textContent="Album title required";return;}
  if(!checked.length){if(ae)ae.textContent="Select at least one track";return;}
  const btn=e.submitter; btn.disabled=true; btn.querySelector("span").textContent="Creating...";
  const{ok,data}=await api("POST","/music/album",{title,musics:checked});
  btn.disabled=false; btn.querySelector("span").textContent="Create Album";
  if(!ok){if(ae)ae.textContent=data.message||"Failed";return;}
  if(as)as.textContent="Album created! 🎉"; showToast("Album created! 🎉");
  document.getElementById("album-form").reset();
  document.querySelectorAll("#track-checklist input").forEach(i=>i.checked=false);
});

// ── Player ────────────────────────────────────────────────────
const audioEl=document.getElementById("audio-player");

function playTrack(index, tracks) {
  if(!tracks?.length)return;
  currentIndex=index; playlist=tracks;
  const t=tracks[index]; if(!t?.uri)return;
  audioEl.src=t.uri; audioEl.volume=parseFloat(document.getElementById("volume-slider")?.value||"0.8");
  audioEl.play().catch(e=>console.warn(e)); isPlaying=true;
  document.getElementById("player-title").textContent=t.title||"Unknown";
  document.getElementById("player-artist").textContent=t.artist?.username||"Unknown";
  document.getElementById("play-pause-btn").innerHTML=`<i class="fa-solid fa-pause"></i>`;
  document.getElementById("player-bar").classList.remove("hidden");
  document.querySelectorAll(".music-card").forEach(c=>c.classList.toggle("playing",c.dataset.id===t._id&&playlist===allMusics));
  document.querySelectorAll(".track-item").forEach((it,i)=>it.classList.toggle("playing",i===currentIndex));
  const mini=document.getElementById("now-playing-mini"); if(mini)mini.classList.remove("hidden");
  const nt=document.getElementById("npm-title"); if(nt)nt.textContent=t.title;
  const pb=document.getElementById("player-like-btn");
  if(pb){const il=!!likedSongs[t._id];pb.classList.toggle("liked",il);pb.innerHTML=`<i class="fa-${il?"solid":"regular"} fa-heart"></i>`;}
}

function stopPlayer() {
  audioEl.pause(); audioEl.src=""; isPlaying=false;
  document.getElementById("play-pause-btn").innerHTML=`<i class="fa-solid fa-play"></i>`;
  const m=document.getElementById("now-playing-mini"); if(m)m.classList.add("hidden");
}

document.getElementById("play-pause-btn")?.addEventListener("click",()=>{
  if(!audioEl.src)return;
  if(isPlaying){audioEl.pause();isPlaying=false;document.getElementById("play-pause-btn").innerHTML=`<i class="fa-solid fa-play"></i>`;}
  else{audioEl.play().catch(()=>{});isPlaying=true;document.getElementById("play-pause-btn").innerHTML=`<i class="fa-solid fa-pause"></i>`;}
});
document.getElementById("prev-btn")?.addEventListener("click",()=>{if(!playlist.length)return;playTrack(isShuffle?Math.floor(Math.random()*playlist.length):(currentIndex-1+playlist.length)%playlist.length,playlist);});
document.getElementById("next-btn")?.addEventListener("click",()=>{if(!playlist.length)return;playTrack(isShuffle?Math.floor(Math.random()*playlist.length):(currentIndex+1)%playlist.length,playlist);});
audioEl.addEventListener("ended",()=>{if(isRepeat){audioEl.currentTime=0;audioEl.play();return;}playTrack(isShuffle?Math.floor(Math.random()*playlist.length):(currentIndex+1)%playlist.length,playlist);});
document.getElementById("shuffle-btn")?.addEventListener("click",()=>{isShuffle=!isShuffle;document.getElementById("shuffle-btn").classList.toggle("active",isShuffle);showToast(isShuffle?"Shuffle on 🔀":"Shuffle off");});
document.getElementById("repeat-btn")?.addEventListener("click",()=>{isRepeat=!isRepeat;document.getElementById("repeat-btn").classList.toggle("active",isRepeat);showToast(isRepeat?"Repeat on 🔁":"Repeat off");});
audioEl.addEventListener("timeupdate",()=>{
  if(!audioEl.duration)return;
  const p=(audioEl.currentTime/audioEl.duration)*100;
  const pb=document.getElementById("progress-bar"); if(pb)pb.value=p;
  document.getElementById("time-current").textContent=fmtTime(audioEl.currentTime);
  document.getElementById("time-total").textContent=fmtTime(audioEl.duration);
  const pf=document.getElementById("progress-fill"); if(pf)pf.style.width=p+"%";
});
document.getElementById("progress-bar")?.addEventListener("input",e=>{if(audioEl.duration)audioEl.currentTime=(e.target.value/100)*audioEl.duration;});
document.getElementById("volume-slider")?.addEventListener("input",e=>{audioEl.volume=e.target.value;});

// ── Utils ─────────────────────────────────────────────────────
function fmtTime(s){if(isNaN(s))return"0:00";return`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,"0")}`;}
function escHtml(s){return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function hashStr(s){let h=0;for(let i=0;i<s.length;i++)h=(Math.imul(31,h)+s.charCodeAt(i))|0;return h;}

// ── INIT — runs on page load ──────────────────────────────────
setGreeting();
renderAuthBox("main"); // ← Builds the auth UI fresh every page load