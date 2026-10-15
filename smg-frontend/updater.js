const fs = require('fs');

const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

const scriptStart = html.indexOf('<script>');
const scriptEnd = html.lastIndexOf('</script>');

const newScript = `<script>
const API_URL = "https://bakend-m2oh.onrender.com";

const ISSUE_TYPES = ["Garbage Dump","Overflowing Bin","Open Defecation Spot","Construction Debris","Drainage Blockage","Dead Animal","Other"];
const STATUS_LABEL = {pending:"Pending", assigned:"Assigned", in_progress:"In Progress", resolved:"Resolved"};
const STATUS_ICON = {pending:"⏳", assigned:"📌", in_progress:"🧹", resolved:"✅"};

let state = {
  user: null,          
  view: "landing",
  complaints: [],
  workers: [],
  dashboardStats: null,
  activeComplaintId: null,
  authRole: "citizen",
  authAction: "login", 
};

function getHeaders() {
  const token = localStorage.getItem('smg_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': \`Bearer \${token}\` } : {})
  };
}

async function loadData(){
  if(state.user && state.user.role === 'admin') {
    try {
      const wRes = await fetch(API_URL + '/workers', { headers: getHeaders() });
      if(wRes.ok) state.workers = await wRes.json();
      
      const sRes = await fetch(API_URL + '/stats/dashboard', { headers: getHeaders() });
      if(sRes.ok) state.dashboardStats = await sRes.json();
    } catch(e) {}
  }
  
  if(state.user) {
    try {
      const cRes = await fetch(API_URL + '/complaints', { headers: getHeaders() });
      if(cRes.ok) {
        state.complaints = await cRes.json();
        // remap _id to id for frontend compatibility
        state.complaints = state.complaints.map(c => ({...c, id: c.complaintId || c._id}));
      }
    } catch(e) {}
  }
}

async function initAuth() {
  const token = localStorage.getItem('smg_token');
  if(token) {
    try {
      const res = await fetch(API_URL + '/auth/profile', { headers: getHeaders() });
      if(res.ok) {
        const u = await res.json();
        state.user = { name: u.name, role: u.role, phone: u.phone, id: u.id };
        state.view = state.user.role === 'citizen' ? 'c-dashboard' : (state.user.role === 'admin' ? 'a-dashboard' : 'w-dashboard');
      } else {
        localStorage.removeItem('smg_token');
      }
    } catch(e) {
      localStorage.removeItem('smg_token');
    }
  }
  await loadData();
  render();
}

function showToast(msg){
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"), 2200);
}

function fmtDate(iso){
  if(!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}) + " · " + d.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"});
}
function nav(view){ state.view = view; render(); window.scrollTo({top:0,behavior:"smooth"}); }

function render(){
  const app = document.getElementById("app");
  app.innerHTML = "";
  app.appendChild(Topbar());

  const main = document.createElement("main");
  if(!state.user){
    if(state.view === "landing") main.appendChild(Landing());
    else if(state.view === "auth") main.appendChild(Auth());
  } else if(state.user.role === "citizen"){
    main.appendChild(CitizenShell());
  } else if(state.user.role === "admin"){
    main.appendChild(AdminShell());
  } else if(state.user.role === "worker"){
    main.appendChild(WorkerShell());
  }
  app.appendChild(main);

  if(!state.user){
    const f = document.createElement("footer");
    f.textContent = "SMG (Smart Waste Management) — a community waste-reporting platform";
    app.appendChild(f);
  }
}

function Topbar(){
  const bar = el("div","topbar");
  const brand = el("div","brand");
  brand.innerHTML = \`<span class="mark">SMG</span> Smart Waste Management\`;
  brand.onclick = ()=>{ if(!state.user) nav("landing"); };
  bar.appendChild(brand);

  const right = el("div","topbar-right");
  if(state.user){
    const span = document.createElement("span");
    span.textContent = state.user.name + " · " + state.user.role;
    right.appendChild(span);
    const btn = el("button","pill-btn ghost");
    btn.textContent = "Log out";
    btn.onclick = ()=>{ 
      state.user = null; 
      localStorage.removeItem('smg_token');
      state.view="landing"; 
      state.authAction="login"; 
      render(); 
    };
    right.appendChild(btn);
  } else if(state.view !== "auth"){
    const btn = el("button","pill-btn");
    btn.textContent = "Login / Register";
    btn.onclick = ()=> nav("auth");
    right.appendChild(btn);
  }
  bar.appendChild(right);
  return bar;
}

function Landing(){
  const wrap = el("div");
  const hero = el("div","hero");
  hero.innerHTML = \`
    <div class="eyebrow">🌿 Community-powered cleanliness</div>
    <h1>See waste. <em>Report it.</em><br/>Watch it disappear.</h1>
    <p>SMG connects citizens, municipal admins and cleanup workers on one bridge — so a photo of an overflowing bin turns into a resolved street, with proof.</p>
  \`;
  const cta = el("div","hero-cta");
  const b1 = el("button","btn-primary"); b1.textContent="Report waste now"; b1.onclick=()=>{state.authRole="citizen";state.authAction="signup";nav("auth");};
  const b2 = el("button","btn-secondary"); b2.textContent="Login to dashboard"; b2.onclick=()=>nav("auth");
  cta.appendChild(b1); cta.appendChild(b2);
  hero.appendChild(cta);
  wrap.appendChild(hero);
  return wrap;
}

function Auth(){
  const wrap = el("div","auth-wrap");
  const card = el("div","auth-card");

  const title = el("h2");
  const sub = el("div","sub");
  if(state.authRole === "admin"){
    title.textContent = "Admin login";
    sub.textContent = "Restricted access — admin credentials required.";
  } else {
    title.textContent = state.authAction === "signup" ? "Create your account" : "Welcome back";
    sub.textContent = state.authAction === "signup"
      ? "Sign up once — your account is saved so you can log in anytime after."
      : "Log in with the phone number and password you signed up with.";
  }
  card.appendChild(title); card.appendChild(sub);

  const toggle = el("div","role-toggle");
  ["citizen","admin","worker"].forEach(r=>{
    const b = el("button");
    b.textContent = r[0].toUpperCase()+r.slice(1);
    if(state.authRole===r) b.classList.add("active");
    b.onclick = ()=>{ state.authRole = r; render(); };
    toggle.appendChild(b);
  });
  card.appendChild(toggle);

  if(state.authRole === "admin"){
    AuthAdminForm(card);
  } else {
    const actionToggle = el("div","role-toggle"); actionToggle.style.marginBottom="20px";
    ["login","signup"].forEach(a=>{
      const b = el("button");
      b.textContent = a==="login" ? "Log in" : "Sign up";
      if(state.authAction===a) b.classList.add("active");
      b.onclick = ()=>{ state.authAction = a; render(); };
      actionToggle.appendChild(b);
    });
    card.appendChild(actionToggle);
    AuthForm(card);
  }
  wrap.appendChild(card);
  return wrap;
}

function AuthAdminForm(card){
  const userField = el("div","field");
  userField.innerHTML = \`<label>Phone Number (Admin)</label>\`;
  const userInput = document.createElement("input");
  userInput.placeholder = "0000000000";
  userField.appendChild(userInput);
  card.appendChild(userField);

  const passField = el("div","field");
  passField.innerHTML = \`<label>Password</label>\`;
  const passInput = document.createElement("input");
  passInput.type = "password";
  passInput.placeholder = "Password";
  passField.appendChild(passInput);
  card.appendChild(passField);

  const submit = el("button","btn-block");
  submit.textContent = "Log in as Admin";
  const doAdminLogin = async ()=>{
    try {
      const res = await fetch(API_URL + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: userInput.value.trim(), password: passInput.value })
      });
      const data = await res.json();
      if(res.ok && data.role === 'admin') {
        localStorage.setItem('smg_token', data.token);
        state.user = {name: data.name, role: data.role, phone: data.phone, id: data._id};
        showToast("Welcome Admin");
        await loadData();
        nav("a-dashboard");
      } else {
        showToast(data.message || "Login failed");
      }
    } catch(e) { showToast("Error connecting to server"); }
  };
  submit.onclick = doAdminLogin;
  passInput.onkeydown = (e)=>{ if(e.key==="Enter") doAdminLogin(); };
  card.appendChild(submit);
}

function AuthForm(card){
  const isSignup = state.authAction === "signup";
  let nameInput;
  if(isSignup){
    const nameField = el("div","field");
    nameField.innerHTML = \`<label>Full name</label>\`;
    nameInput = document.createElement("input");
    nameInput.placeholder = "e.g. Prathamesh Deshmukh";
    nameField.appendChild(nameInput);
    card.appendChild(nameField);
  }

  const phoneField = el("div","field");
  phoneField.innerHTML = \`<label>Contact number</label>\`;
  const phoneInput = document.createElement("input");
  phoneInput.placeholder = "10-digit mobile number";
  phoneInput.maxLength = 10;
  phoneField.appendChild(phoneInput);
  card.appendChild(phoneField);

  const passField = el("div","field");
  passField.innerHTML = \`<label>Password</label>\`;
  const passInput = document.createElement("input");
  passInput.type = "password";
  passInput.placeholder = isSignup ? "Create a password" : "Enter your password";
  passField.appendChild(passInput);
  card.appendChild(passField);

  const submit = el("button","btn-block");
  submit.textContent = isSignup ? "Create account" : "Log in";

  const doSignup = async ()=>{
    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();
    const pass = passInput.value;
    if(!name || !phone || !pass) return showToast("Fill all fields");
    try {
      const res = await fetch(API_URL + '/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, password: pass, role: state.authRole })
      });
      const data = await res.json();
      if(res.ok) {
        localStorage.setItem('smg_token', data.token);
        state.user = {name: data.name, role: data.role, phone: data.phone, id: data._id};
        showToast("Account created!");
        await loadData();
        nav(state.authRole==="citizen" ? "c-dashboard" : "w-dashboard");
      } else { showToast(data.message || "Signup failed"); }
    } catch(e) { showToast("Error connecting to server"); }
  };

  const doLogin = async ()=>{
    const phone = phoneInput.value.trim();
    const pass = passInput.value;
    if(!phone || !pass) return showToast("Fill all fields");
    try {
      const res = await fetch(API_URL + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password: pass })
      });
      const data = await res.json();
      if(res.ok && data.role === state.authRole) {
        localStorage.setItem('smg_token', data.token);
        state.user = {name: data.name, role: data.role, phone: data.phone, id: data._id};
        showToast("Welcome back!");
        await loadData();
        nav(state.authRole==="citizen" ? "c-dashboard" : "w-dashboard");
      } else { showToast(data.message || "Login failed / Wrong role"); }
    } catch(e) { showToast("Error connecting to server"); }
  };

  submit.onclick = isSignup ? doSignup : doLogin;
  card.appendChild(submit);

  const switchLine = el("div","switch-line");
  const switchBtn = document.createElement("button");
  switchBtn.textContent = isSignup ? "Already have an account? Log in" : "New here? Create an account";
  switchBtn.onclick = ()=>{ state.authAction = isSignup ? "login" : "signup"; render(); };
  switchLine.appendChild(switchBtn);
  card.appendChild(switchLine);
}

function DashShell(navItems, contentFn){
  const dash = el("div","dash");
  const side = el("div","sidebar");
  const who = el("div","who");
  who.innerHTML = \`<div class="name">\${state.user.name}</div><div class="role">\${state.user.role}</div>\`;
  side.appendChild(who);
  navItems.forEach(([key,label,icon])=>{
    const b = el("button","navitem"+(state.view===key?" active":""));
    b.innerHTML = \`<span>\${icon}</span><span>\${label}</span>\`;
    b.onclick = ()=> {
      if(key==='c-dashboard' || key==='a-dashboard' || key==='w-dashboard' || key.includes('my') || key.includes('all')) {
        loadData().then(()=> nav(key));
      } else {
        nav(key);
      }
    }
    side.appendChild(b);
  });
  dash.appendChild(side);
  const content = el("div","content");
  content.appendChild(contentFn());
  dash.appendChild(content);
  return dash;
}

function statCounts(list){
  return {
    total:list.length,
    pending:list.filter(c=>c.status==="pending").length,
    assigned:list.filter(c=>c.status==="assigned").length,
    in_progress:list.filter(c=>c.status==="in_progress").length,
    resolved:list.filter(c=>c.status==="resolved").length,
  };
}
function StatRow(counts){
  const row = el("div","stat-row");
  const items = [["Total",counts.total,""],["Pending",counts.pending,"pending"],["Assigned",counts.assigned,"assigned"],["In Progress",counts.in_progress,"progress"],["Resolved",counts.resolved,"resolved"]];
  items.forEach(([label,n,cls])=>{
    const s = el("div","stat "+cls);
    s.innerHTML = \`<div class="n">\${n}</div><div class="l">\${label}</div>\`;
    row.appendChild(s);
  });
  return row;
}

function ComplaintCard(c, onClick){
  const card = el("div","ccard");
  card.onclick = onClick;
  const img = document.createElement("img");
  img.className = "thumb";
  img.src = c.beforePhoto || PLACEHOLDER_IMG;
  card.appendChild(img);
  const body = el("div","body");
  const badgeClass = c.status==="in_progress"?"progress":c.status;
  body.innerHTML = \`
    <div class="top">
      <span class="cid mono">\${c.id}</span>
      <span class="badge \${badgeClass}">\${STATUS_ICON[c.status]} \${STATUS_LABEL[c.status]}</span>
    </div>
    <div class="itype">\${c.issueType}</div>
    <div class="meta">📍 \${c.location} · \${fmtDate(c.createdAt || c.dateTime)}</div>
    <div class="desc">\${c.description || ""}</div>
  \`;
  card.appendChild(body);
  return card;
}

const PLACEHOLDER_IMG = "data:image/svg+xml;utf8," + encodeURIComponent(\`<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><rect width='64' height='64' fill='#E3DDC9'/><text x='32' y='38' font-size='26' text-anchor='middle'>🗑️</text></svg>\`);

function el(tag, cls){ const e = document.createElement(tag); if(cls) e.className = cls; return e; }

/* ===================== CITIZEN ===================== */
function CitizenShell(){
  const items = [
    ["c-dashboard","Dashboard","🏠"],
    ["c-report","Report Waste","📷"],
    ["c-mycomplaints","My Complaints","📋"],
    ["c-profile","Profile","👤"],
  ];
  const map = {
    "c-dashboard":CitizenDashboard,"c-report":CitizenReport,"c-mycomplaints":CitizenMyComplaints,
    "c-profile":CitizenProfile,"c-detail":()=>ComplaintDetail("citizen"),
  };
  if(!map[state.view]) state.view = "c-dashboard";
  return DashShell(items, map[state.view]);
}

function CitizenDashboard(){
  const wrap = el("div");
  wrap.innerHTML = \`<h2>Welcome, \${state.user.name.split(" ")[0]}</h2><div class="pagesub">Here's a snapshot of everything you've reported.</div>\`;
  const mine = state.complaints;
  wrap.appendChild(StatRow(statCounts(mine)));
  const recentTitle = el("h3"); recentTitle.style.margin="0 0 12px"; recentTitle.style.fontSize="1.05rem"; recentTitle.textContent="Recent reports";
  wrap.appendChild(recentTitle);
  wrap.appendChild(ComplaintListOrEmpty(mine.slice(0,5), "citizen", "You haven't reported anything yet — spotted some waste nearby?"));
  return wrap;
}

function ComplaintListOrEmpty(list, role, emptyMsg){
  if(list.length===0){
    const e = el("div","empty");
    e.innerHTML = \`<div class="ei">🧺</div>\${emptyMsg}\`;
    return e;
  }
  const wrap = el("div","clist");
  list.forEach(c=>{
    wrap.appendChild(ComplaintCard(c, ()=>{
      state.activeComplaintId = c._id || c.id;
      nav(role==="citizen"?"c-detail": role==="admin"?"a-detail":"w-detail");
    }));
  });
  return wrap;
}

function CitizenReport(){
  const wrap = el("div");
  wrap.innerHTML = \`<h2>Report waste</h2><div class="pagesub">A clear photo and accurate location help the worker find and clear it fast.</div>\`;
  const card = el("div","form-card");

  const photoField = el("div","field");
  photoField.innerHTML = \`<label>Photo of the waste</label>\`;
  const drop = el("div","photo-drop");
  drop.innerHTML = \`<div>📷 Tap to upload a photo</div>\`;
  const fileInput = document.createElement("input");
  fileInput.type="file"; fileInput.accept="image/*"; fileInput.style.display="none";
  let photoData = null;
  drop.onclick = ()=> fileInput.click();
  fileInput.onchange = (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      compressImage(reader.result, 700, (compressed)=>{
        photoData = compressed;
        drop.innerHTML = \`<div>✓ Photo attached — tap to change</div><img src="\${compressed}"/>\`;
      });
    };
    reader.readAsDataURL(file);
  };
  photoField.appendChild(drop); photoField.appendChild(fileInput);
  card.appendChild(photoField);

  const typeField = el("div","field");
  typeField.innerHTML = \`<label>Issue type</label>\`;
  const typeSel = document.createElement("select");
  ISSUE_TYPES.forEach(t=>{ const o=document.createElement("option"); o.value=t; o.textContent=t; typeSel.appendChild(o); });
  typeField.appendChild(typeSel);
  card.appendChild(typeField);

  const locField = el("div","field");
  locField.innerHTML = \`<label>Location</label>\`;
  const locInput = document.createElement("input");
  locInput.placeholder = "e.g. Near FC Road bus stop, Pune";
  locField.appendChild(locInput);
  const locBtnRow = el("div","btn-row"); locBtnRow.style.marginTop="8px";
  const gpsBtn = el("button","btn-ghost-sm"); gpsBtn.textContent="📍 Use current GPS location";
  gpsBtn.onclick = ()=>{
    if(!navigator.geolocation){ showToast("Location not supported on this device."); return; }
    navigator.geolocation.getCurrentPosition(pos=>{
      locInput.value = pos.coords.latitude.toFixed(5)+", "+pos.coords.longitude.toFixed(5);
    }, ()=> showToast("Couldn't fetch location — enter it manually."));
  };
  locBtnRow.appendChild(gpsBtn);
  locField.appendChild(locBtnRow);
  card.appendChild(locField);

  const descField = el("div","field");
  descField.innerHTML = \`<label>Description</label>\`;
  const descArea = document.createElement("textarea");
  descArea.rows = 3;
  descArea.placeholder = "Describe what you saw...";
  descField.appendChild(descArea);
  card.appendChild(descField);

  const submit = el("button","btn-block");
  submit.textContent = "Submit complaint";
  submit.onclick = async ()=>{
    if(!locInput.value.trim() || !photoData){ showToast("Please add location and photo."); return; }
    submit.textContent = "Submitting...";
    try {
      const res = await fetch(API_URL + '/complaints', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          issueType: typeSel.value,
          location: locInput.value.trim(),
          description: descArea.value.trim(),
          beforePhoto: photoData
        })
      });
      if(res.ok) {
        showToast("Complaint submitted successfully!");
        await loadData();
        nav("c-mycomplaints");
      } else { showToast("Failed to submit."); submit.textContent = "Submit complaint"; }
    } catch(e) { showToast("Error connecting to server"); submit.textContent = "Submit complaint"; }
  };
  card.appendChild(submit);
  wrap.appendChild(card);
  return wrap;
}

function compressImage(dataUrl, maxW, cb){
  const img = new Image();
  img.onload = ()=>{
    const scale = Math.min(1, maxW / img.width);
    const canvas = document.createElement("canvas");
    canvas.width = img.width*scale; canvas.height = img.height*scale;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
    cb(canvas.toDataURL("image/jpeg",0.72));
  };
  img.src = dataUrl;
}

function CitizenMyComplaints(){
  const wrap = el("div");
  wrap.innerHTML = \`<h2>My complaints</h2><div class="pagesub">Every report you've submitted, with live status.</div>\`;
  wrap.appendChild(ComplaintListOrEmpty(state.complaints, "citizen", "No complaints yet — go report some waste!"));
  return wrap;
}

function CitizenProfile(){
  const wrap = el("div");
  wrap.innerHTML = \`<h2>Profile</h2><div class="pagesub">Your account details for this session.</div>\`;
  const card = el("div","form-card");
  const mine = state.complaints;
  card.innerHTML = \`
    <div class="detail-grid">
      <div class="dfield"><div class="l">Name</div><div class="v">\${state.user.name}</div></div>
      <div class="dfield"><div class="l">Role</div><div class="v">Citizen</div></div>
      <div class="dfield"><div class="l">Total reports</div><div class="v">\${mine.length}</div></div>
      <div class="dfield"><div class="l">Resolved</div><div class="v">\${mine.filter(c=>c.status==="resolved").length}</div></div>
    </div>
  \`;
  wrap.appendChild(card);
  return wrap;
}

/* ===================== SHARED DETAIL PAGE ===================== */
function ComplaintDetail(role){
  const wrap = el("div");
  const c = state.complaints.find(x=>(x._id || x.id)===state.activeComplaintId);
  if(!c){ wrap.innerHTML = \`<div class="empty">Complaint not found.</div>\`; return wrap; }

  const back = el("button","backlink");
  back.innerHTML = "← Back";
  back.onclick = ()=> { loadData().then(()=> nav(role==="citizen"?"c-mycomplaints": role==="admin"?"a-all":"w-assigned")); };
  wrap.appendChild(back);

  const card = el("div","detail-card");
  const badgeClass = c.status==="in_progress"?"progress":c.status;
  const head = el("div","detail-head");
  head.innerHTML = \`
    <div><div class="cid mono" style="font-size:0.8rem;color:var(--ink-soft);">\${c.id}</div><h2 style="margin:4px 0 0;">\${c.issueType}</h2></div>
    <span class="badge \${badgeClass}">\${STATUS_ICON[c.status]} \${STATUS_LABEL[c.status]}</span>
  \`;
  card.appendChild(head);

  const grid = el("div","detail-grid");
  grid.innerHTML = \`
    <div class="dfield"><div class="l">Reported by</div><div class="v">\${c.citizenName}</div></div>
    <div class="dfield"><div class="l">Date & time</div><div class="v">\${fmtDate(c.createdAt)}</div></div>
    <div class="dfield"><div class="l">Location</div><div class="v">📍 \${c.location}</div></div>
    <div class="dfield"><div class="l">Assigned worker</div><div class="v">\${c.assignedWorker ? c.assignedWorker.name : "— Not yet assigned"}</div></div>
  \`;
  card.appendChild(grid);

  if(c.description){
    const d = el("div","dfield"); d.style.marginBottom="16px";
    d.innerHTML = \`<div class="l">Description</div><div class="v">\${c.description}</div>\`;
    card.appendChild(d);
  }

  const compare = el("div","photo-compare");
  compare.innerHTML = \`
    <div class="pbox"><img src="\${c.beforePhoto || PLACEHOLDER_IMG}"/><div class="cap">Before</div></div>
    <div class="pbox"><img src="\${c.afterPhoto || PLACEHOLDER_IMG}"/><div class="cap">\${c.afterPhoto ? "After" : "Awaiting cleanup"}</div></div>
  \`;
  card.appendChild(compare);

  // ROLE-SPECIFIC ACTIONS
  if(role==="admin"){
    if(c.status==="pending"){
      const assignBox = el("div","field");
      assignBox.innerHTML = \`<label>Assign a worker</label>\`;
      const sel = document.createElement("select");
      state.workers.forEach(w=>{ const o=document.createElement("option"); o.value=w._id; o.textContent=w.name; sel.appendChild(o); });
      assignBox.appendChild(sel);
      const btn = el("button","btn-block"); btn.style.marginTop="10px"; btn.textContent="Assign worker";
      btn.onclick = async ()=>{
        const res = await fetch(API_URL + '/complaints/' + c._id + '/assign', {
          method: 'PATCH',
          headers: getHeaders(),
          body: JSON.stringify({ workerId: sel.value })
        });
        if(res.ok) {
          showToast("Assigned successfully");
          await loadData();
          nav("a-detail");
        }
      };
      card.appendChild(assignBox); card.appendChild(btn);
    }
    if(c.status==="in_progress" && c.afterPhoto){
      const btn = el("button","btn-block"); btn.style.marginTop="14px"; btn.textContent="Verify & mark Resolved";
      btn.onclick = async ()=>{ 
        const res = await fetch(API_URL + '/complaints/' + c._id + '/resolve', {
          method: 'PATCH',
          headers: getHeaders()
        });
        if(res.ok) { showToast("Marked resolved ✅"); await loadData(); nav("a-detail"); }
      };
      card.appendChild(btn);
    }
  }

  if(role==="worker"){
    if(c.status==="assigned"){
      const btn = el("button","btn-block"); btn.style.marginTop="14px"; btn.textContent="Start cleaning (mark In Progress)";
      btn.onclick = async ()=>{ 
        const res = await fetch(API_URL + '/complaints/' + c._id + '/status', {
          method: 'PATCH',
          headers: getHeaders(),
          body: JSON.stringify({ status: 'in_progress' })
        });
        if(res.ok) { showToast("Marked in progress"); await loadData(); nav("w-detail"); }
      };
      card.appendChild(btn);
    }
    if(c.status==="in_progress"){
      const upField = el("div","field"); upField.style.marginTop="14px";
      upField.innerHTML = \`<label>Upload after-cleaning photo</label>\`;
      const drop = el("div","photo-drop");
      drop.innerHTML = c.afterPhoto ? \`<div>✓ Photo attached — tap to change</div><img src="\${c.afterPhoto}"/>\` : \`<div>📷 Tap to upload after photo</div>\`;
      const fi = document.createElement("input"); fi.type="file"; fi.accept="image/*"; fi.style.display="none";
      drop.onclick = ()=> fi.click();
      let newAfterPhoto = c.afterPhoto;
      fi.onchange = (e)=>{
        const file = e.target.files[0]; if(!file) return;
        const reader = new FileReader();
        reader.onload = ()=> compressImage(reader.result,700,(comp)=>{ 
          newAfterPhoto = comp; 
          drop.innerHTML = \`<div>✓ Photo ready to submit</div><img src="\${comp}"/>\`; 
        });
        reader.readAsDataURL(file);
      };
      upField.appendChild(drop); upField.appendChild(fi);
      card.appendChild(upField);

      const btn = el("button","btn-block"); btn.style.marginTop="10px"; btn.textContent="Submit for verification";
      btn.onclick = async ()=>{ 
        if(!newAfterPhoto) return showToast("Please upload a photo first.");
        const res = await fetch(API_URL + '/complaints/' + c._id + '/status', {
          method: 'PATCH',
          headers: getHeaders(),
          body: JSON.stringify({ status: 'in_progress', afterPhoto: newAfterPhoto })
        });
        if(res.ok) { showToast("Sent to admin for verification"); await loadData(); nav("w-assigned"); }
      };
      card.appendChild(btn);
    }
    if(c.status==="resolved"){
      const note = el("div"); note.style.cssText="margin-top:14px;color:var(--resolved);font-weight:700;font-size:0.88rem;";
      note.textContent = "✅ Verified and resolved by admin.";
      card.appendChild(note);
    }
  }

  wrap.appendChild(card);
  return wrap;
}

/* ===================== ADMIN ===================== */
function AdminShell(){
  const items = [
    ["a-dashboard","Dashboard","🏠"],
    ["a-all","All Complaints","📋"],
    ["a-workers","Workers","🧑‍🔧"],
    ["a-reports","Reports","📊"],
  ];
  const map = {
    "a-dashboard":AdminDashboard,"a-all":AdminAllComplaints,"a-workers":AdminWorkers,
    "a-reports":AdminReports,"a-detail":()=>ComplaintDetail("admin"),
  };
  if(!map[state.view]) state.view="a-dashboard";
  return DashShell(items, map[state.view]);
}

function AdminDashboard(){
  const wrap = el("div");
  wrap.innerHTML = \`<h2>Admin dashboard</h2><div class="pagesub">City-wide view of every complaint reported.</div>\`;
  wrap.appendChild(StatRow(statCounts(state.complaints)));
  const t = el("h3"); t.style.cssText="margin:0 0 12px;font-size:1.05rem;"; t.textContent="Needs attention (pending)";
  wrap.appendChild(t);
  const pending = state.complaints.filter(c=>c.status==="pending");
  wrap.appendChild(ComplaintListOrEmpty(pending, "admin", "No pending complaints — all caught up! 🎉"));
  return wrap;
}

function AdminAllComplaints(){
  const wrap = el("div");
  wrap.innerHTML = \`<h2>All complaints</h2><div class="pagesub">Every report across the city, most recent first.</div>\`;
  const filterRow = el("div","btn-row"); filterRow.style.marginBottom="16px"; filterRow.style.flexWrap="wrap";
  let activeFilter = "all";
  function renderList(){
    const list = state.complaints.filter(c=> activeFilter==="all" || c.status===activeFilter);
    const existing = wrap.querySelector(".clist, .empty");
    const rendered = ComplaintListOrEmpty(list, "admin", "No complaints match this filter.");
    if(existing) existing.replaceWith(rendered); else wrap.appendChild(rendered);
  }
  ["all","pending","assigned","in_progress","resolved"].forEach(f=>{
    const b = el("button","btn-ghost-sm");
    b.textContent = f==="all"?"All": STATUS_LABEL[f];
    b.style.marginBottom="6px";
    b.onclick = ()=>{ activeFilter=f; renderList(); };
    filterRow.appendChild(b);
  });
  wrap.appendChild(filterRow);
  wrap.appendChild(ComplaintListOrEmpty(state.complaints, "admin", "No complaints reported yet."));
  return wrap;
}

function AdminWorkers(){
  const wrap = el("div");
  wrap.innerHTML = \`<h2>Worker management</h2><div class="pagesub">Cleanup workers assigned to complaints.</div>\`;
  const listTitle = el("h3"); listTitle.style.cssText="margin:24px 0 12px;font-size:1.05rem;"; listTitle.textContent="Current workers";
  wrap.appendChild(listTitle);
  const list = el("div","clist");
  state.workers.forEach(w=>{
    const row = el("div","ccard"); row.style.cursor="default";
    row.innerHTML = \`<div class="body"><div class="itype">\${w.name}</div><div class="meta mono">\${w.workerId || 'No ID'} · \${w.assignedCount || 0} active assignments</div></div>\`;
    list.appendChild(row);
  });
  if(state.workers.length===0) list.innerHTML = '<div class="empty">No workers found. Create a worker account via registration.</div>';
  wrap.appendChild(list);
  return wrap;
}

function AdminReports(){
  const wrap = el("div");
  wrap.innerHTML = \`<h2>Reports & statistics</h2><div class="pagesub">A quick read on how the city is doing.</div>\`;
  if(!state.dashboardStats) return wrap;
  
  const counts = state.dashboardStats.counts;
  wrap.appendChild(StatRow(counts));

  const byType = state.dashboardStats.issueTypes || {};
  const card = el("div","form-card"); card.style.maxWidth="640px";
  const title = el("h3"); title.style.cssText="margin:0 0 14px;font-size:1rem;color:var(--forest);"; title.textContent="Complaints by issue type";
  card.appendChild(title);
  const maxV = Math.max(1,...Object.values(byType));
  Object.entries(byType).forEach(([type,n])=>{
    const row = el("div"); row.style.marginBottom="10px";
    row.innerHTML = \`<div style="display:flex;justify-content:space-between;font-size:0.82rem;margin-bottom:4px;"><span>\${type}</span><span class="mono">\${n}</span></div>
      <div style="background:var(--cream);border-radius:6px;height:8px;overflow:hidden;"><div style="background:var(--marigold);height:100%;width:\${(n/maxV)*100}%;"></div></div>\`;
    card.appendChild(row);
  });
  if(Object.keys(byType).length===0){ card.innerHTML += \`<div class="empty">No data yet.</div>\`; }
  const resRate = state.dashboardStats.resolutionRate;
  const rr = el("div"); rr.style.cssText="margin-top:18px;font-size:0.88rem;color:var(--ink-soft);";
  rr.innerHTML = \`Resolution rate: <strong class="mono" style="color:var(--forest);">\${resRate}%</strong> (\${counts.resolved} of \${counts.total} resolved)\`;
  card.appendChild(rr);
  wrap.appendChild(card);
  return wrap;
}

/* ===================== WORKER ===================== */
function WorkerShell(){
  const items = [
    ["w-dashboard","Dashboard","🏠"],
    ["w-assigned","Assigned Complaints","📌"],
    ["w-completed","Completed Works","✅"],
  ];
  const map = {
    "w-dashboard":WorkerDashboard,"w-assigned":WorkerAssigned,"w-completed":WorkerCompleted,
    "w-detail":()=>ComplaintDetail("worker"),
  };
  if(!map[state.view]) state.view="w-dashboard";
  return DashShell(items, map[state.view]);
}

function WorkerDashboard(){
  const wrap = el("div");
  wrap.innerHTML = \`<h2>Welcome, \${state.user.name.split(" ")[0]}</h2><div class="pagesub">Your cleanup workload at a glance.</div>\`;
  const mine = state.complaints;
  wrap.appendChild(StatRow(statCounts(mine)));
  const t = el("h3"); t.style.cssText="margin:0 0 12px;font-size:1.05rem;"; t.textContent="Active assignments";
  wrap.appendChild(t);
  const active = mine.filter(c=>c.status==="assigned"||c.status==="in_progress");
  wrap.appendChild(ComplaintListOrEmpty(active, "worker", "Nothing assigned to you right now."));
  return wrap;
}

function WorkerAssigned(){
  const wrap = el("div");
  wrap.innerHTML = \`<h2>Assigned complaints</h2><div class="pagesub">Everything currently on your plate.</div>\`;
  const mine = state.complaints.filter(c=>c.status==="assigned"||c.status==="in_progress");
  wrap.appendChild(ComplaintListOrEmpty(mine, "worker", "No active assignments."));
  return wrap;
}

function WorkerCompleted(){
  const wrap = el("div");
  wrap.innerHTML = \`<h2>Completed works</h2><div class="pagesub">Complaints you've cleaned and admin has verified.</div>\`;
  const mine = state.complaints.filter(c=>c.status==="resolved");
  wrap.appendChild(ComplaintListOrEmpty(mine, "worker", "No completed works yet."));
  return wrap;
}

initAuth();
</script>`;

const finalHtml = html.substring(0, scriptStart) + newScript + html.substring(scriptEnd + 9);
fs.writeFileSync(file, finalHtml);
console.log('Frontend script updated successfully to use API!');
