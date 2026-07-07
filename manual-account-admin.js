import { getApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { getAccessProfile } from "./access-control.js";

const app = getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const $ = id => document.getElementById(id);

const DEFAULT_PERMISSIONS = ["activity:create", "service:log", "chapter:request", "outreach:create", "training:complete"];

onAuthStateChanged(auth, async user => {
  if (!user) return;
  try {
    const access = await getAccessProfile(user);
    if (!access.admin) return;
    installManualAccountCenter();
    await renderManualInvites();
  } catch (error) {
    console.warn("Manual account center could not load.", error);
  }
});

document.addEventListener("submit", async event => {
  if (event.target?.id === "manualAccountForm") {
    event.preventDefault();
    await createManualInvite();
  }
  if (event.target?.id === "manualCodeOverrideForm") {
    event.preventDefault();
    await overrideManualCode();
  }
});

document.addEventListener("click", async event => {
  const button = event.target.closest("[data-manual-copy]");
  if (!button) return;
  await navigator.clipboard?.writeText(button.dataset.manualCopy || "");
  setManualNotice("Manual account details copied.", "success");
});

function installManualAccountCenter() {
  if ($("manualAccountCenter")) return;
  const host = document.getElementById("section-volunteers")?.querySelector(".panel") || document.querySelector(".admin-content .panel");
  if (!host) return;
  host.insertAdjacentHTML("afterbegin", `
    <section class="v2-panel" id="manualAccountCenter">
      <p class="eyebrow">Manual Account Creation</p>
      <h2>Manually create a volunteer activation account.</h2>
      <p class="v2-note">This creates a manual activation invite, not a Firebase Auth login. The volunteer still activates it from the login page by entering their email, temporary code, and permanent password. Custom temporary codes are only available here for manually created accounts.</p>
      <form id="manualAccountForm" class="v2-form-grid">
        <label>Full Name<input id="manualName" required></label>
        <label>Email<input id="manualEmail" type="email" required></label>
        <label>Custom Temporary Code<input id="manualCode" required placeholder="Example: WELCOME-257"></label>
        <label>Role<input id="manualRole" value="Volunteer"></label>
        <label>Team<select id="manualTeam"><option>Prayer Support Team</option><option>Care and Outreach Team</option><option>Chapter Leadership Team</option><option>Administrative Support Team</option></select></label>
        <label>Status<select id="manualStatus"><option>Training</option><option>Orientation</option><option>Active</option><option>Limited</option></select></label>
        <label>Chapter ID Optional<input id="manualChapterId"></label>
        <label>Permission Preset<select id="manualPreset"><option value="standard">Standard Volunteer</option><option value="basic">Basic Volunteer</option><option value="chapter">Chapter Lead</option><option value="trainer">Trainer</option></select></label>
        <button class="btn primary full" style="grid-column:1/-1">Create Manual Activation</button>
      </form>
      <form id="manualCodeOverrideForm" class="v2-form-grid">
        <label>Manual Account Email<input id="overrideEmail" type="email" required></label>
        <label>New Custom Temporary Code<input id="overrideCode" required></label>
        <button class="btn full" style="grid-column:1/-1">Override Manual Temp Code</button>
      </form>
      <p class="notice" id="manualAccountNotice"></p>
      <div class="v2-list" id="manualInviteList"></div>
    </section>
  `);
}

async function createManualInvite() {
  const email = cleanEmail($("manualEmail")?.value || "");
  const code = normalizeCode($("manualCode")?.value || "");
  if (!email) throwNotice("Enter an email.");
  if (!code || code.length < 4) throwNotice("Enter a custom temporary code with at least 4 characters.");
  const ref = doc(db, "volunteer_invites", emailKey(email));
  const existing = await getDoc(ref);
  if (existing.exists() && existing.data()?.used === true) throwNotice("This email already used an activation invite. Use a different email or normal account recovery.");
  const data = {
    email,
    emailKey: emailKey(email),
    code,
    customCode: true,
    manualCreated: true,
    manualCodeOnly: true,
    status: "active",
    used: false,
    name: field("manualName"),
    role: field("manualRole") || "Volunteer",
    team: $("manualTeam")?.value || "Prayer Support Team",
    volunteerStatus: $("manualStatus")?.value || "Training",
    permissions: presetPermissions($("manualPreset")?.value || "standard"),
    chapterId: field("manualChapterId"),
    createdBy: auth.currentUser?.email || "admin",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  await setDoc(ref, data, { merge: true });
  await audit("manual_account_invite_created", { email, manualCreated: true });
  setManualNotice(`Manual activation created for ${email}. Temporary code: ${code}`, "success");
  $("manualAccountForm")?.reset();
  await renderManualInvites();
}

async function overrideManualCode() {
  const email = cleanEmail($("overrideEmail")?.value || "");
  const code = normalizeCode($("overrideCode")?.value || "");
  if (!email) throwNotice("Enter the manual account email.");
  if (!code || code.length < 4) throwNotice("Enter a new custom temporary code with at least 4 characters.");
  const ref = doc(db, "volunteer_invites", emailKey(email));
  const snap = await getDoc(ref);
  if (!snap.exists()) throwNotice("No invite exists for that email.");
  const data = snap.data();
  if (data.manualCreated !== true) throwNotice("Custom code overrides are only allowed for manually created accounts.");
  if (data.used === true) throwNotice("This invite has already been used and cannot be overridden.");
  await setDoc(ref, { code, customCode: true, manualCreated: true, manualCodeOnly: true, status: "active", used: false, overrideBy: auth.currentUser?.email || "admin", overrideAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
  await audit("manual_account_code_overridden", { email, manualCreated: true });
  setManualNotice(`Manual temporary code overridden for ${email}. New code: ${code}`, "success");
  $("manualCodeOverrideForm")?.reset();
  await renderManualInvites();
}

async function renderManualInvites() {
  const target = $("manualInviteList");
  if (!target) return;
  const rows = [];
  try {
    const snap = await getDocs(collection(db, "volunteer_invites"));
    snap.forEach(d => { const data = d.data(); if (data.manualCreated === true) rows.push({ id: d.id, ...data }); });
  } catch (error) {
    target.innerHTML = '<p class="v2-quiet">Manual invites could not be loaded.</p>';
    return;
  }
  target.innerHTML = rows.length ? rows.map(inviteCard).join("") : '<p class="v2-quiet">No manual activation accounts have been created yet.</p>';
}

function inviteCard(x) {
  const details = `Email: ${x.email}\nTemporary Code: ${x.code}\nLogin Page: login.html`;
  return `<article class="v2-record"><h4>${esc(x.name || x.email)}</h4><div class="v2-meta"><span>${esc(x.email)}</span><span>${esc(x.role || 'Volunteer')}</span><span>${esc(x.team || '')}</span><span>${x.used ? 'Used' : 'Unused'}</span></div><div class="v2-copy-box">Temporary Code: ${esc(x.code || '')}</div><div class="v2-toolbar"><button class="btn" data-manual-copy="${esc(details)}">Copy Activation Details</button></div></article>`;
}

function presetPermissions(name) {
  const presets = {
    basic: ["activity:create", "service:log", "training:complete"],
    standard: DEFAULT_PERMISSIONS,
    chapter: ["activity:create", "service:log", "chapter:request", "chapter:lead", "outreach:create", "training:complete"],
    trainer: ["activity:create", "service:log", "chapter:request", "outreach:create", "training:complete", "training:trainer", "service:approve"]
  };
  return presets[name] || DEFAULT_PERMISSIONS;
}

function setManualNotice(text, type = "") { const notice = $("manualAccountNotice"); if (!notice) return; notice.textContent = text; notice.className = "notice" + (type ? " " + type : ""); }
function throwNotice(message) { setManualNotice(message, "error"); throw new Error(message); }
async function audit(action, details) { try { await addDoc(collection(db, "audit_logs"), { action, details, actor: auth.currentUser?.email || "admin", createdAt: serverTimestamp() }); } catch (error) {} }
function field(id) { return $(id)?.value.trim() || ""; }
function cleanEmail(email = "") { return String(email).trim().toLowerCase(); }
function emailKey(email = "") { return cleanEmail(email).replace(/[.#$/\[\]]/g, "_"); }
function normalizeCode(value = "") { return String(value).trim().replace(/\s+/g, "").toUpperCase(); }
function esc(value = "") { return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;"); }
