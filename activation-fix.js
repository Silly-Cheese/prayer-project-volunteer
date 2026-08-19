import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { getFirestore, collection, query, where, limit, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

const firebaseConfig={apiKey:"AIzaSyAaaABQB1T_SaZ6TARafIXjJ6Zk-upjLO0",authDomain:"prayer-projec.firebaseapp.com",projectId:"prayer-projec",storageBucket:"prayer-projec.firebasestorage.app",messagingSenderId:"47966669764",appId:"1:47966669764:web:b875d2ea5bf75e3b7b3291"};
const app=getApps().length?getApp():initializeApp(firebaseConfig);
const auth=getAuth(app);
const db=getFirestore(app);
const $=id=>document.getElementById(id);

const inviteForm=$("inviteForm");
if(inviteForm){
  inviteForm.addEventListener("submit",activateInviteFixed,true);
}

async function activateInviteFixed(event){
  event.preventDefault();
  event.stopImmediatePropagation();
  const notice=$("inviteNotice");
  const button=inviteForm.querySelector("button");
  try{
    if(button){button.disabled=true;button.textContent="Activating...";}
    setNotice(notice,"Checking temporary code...","");
    const email=cleanEmail($("inviteEmail")?.value||"");
    const code=normalizeCode($("inviteCode")?.value||"");
    const password=$("newPassword")?.value||"";
    if(!email)throw new Error("Enter the email that was accepted for volunteering.");
    if(!code)throw new Error("Enter the temporary code exactly as it was sent.");
    if(password.length<6)throw new Error("Your permanent password must be at least 6 characters.");

    const inviteRef=doc(db,"volunteer_invites",emailKey(email));
    const inviteSnap=await getDoc(inviteRef);

    if(inviteSnap.exists()){
      await activateFromInvite(inviteRef,inviteSnap.data(),email,code,password,notice);
      return;
    }

    setNotice(notice,"No new invite was found. Checking older accepted applications...","");
    await activateFromOldApplication(email,code,password,notice);
  }catch(error){
    console.error(error);
    setNotice(notice,error?.message||"Temporary code activation failed.","error");
  }finally{
    if(button){button.disabled=false;button.textContent="Create Volunteer Login";}
  }
}

async function activateFromInvite(inviteRef,data,email,code,password,notice){
  if(data.used===true||data.status==="used")throw new Error("This temporary code has already been used. Try the normal login tab with the password you created.");
  if(data.status&&data.status!=="active")throw new Error("This invite is not active. Ask an admin to regenerate the temporary code.");
  if(data.expiresAt?.toMillis&&data.expiresAt.toMillis()<Date.now())throw new Error("This temporary code has expired. Ask an admin to regenerate it.");
  if(normalizeCode(data.code||"")!==code)throw new Error("The temporary code is incorrect. Copy it exactly, including both parts of the code.");
  const user=await createOrSignIn(email,password,notice);
  await createVolunteerProfile(user,email,data,"invite");
  try{
    await updateDoc(inviteRef,{used:true,usedAt:serverTimestamp(),uid:user.uid,status:"used"});
  }catch(error){
    console.warn("Invite was activated but could not be marked used. Publish the updated Firestore rules.",error);
  }
  setNotice(notice,"Volunteer login created. Opening portal...","success");
  setTimeout(()=>window.location.href="dashboard.html",650);
}

async function activateFromOldApplication(email,code,password,notice){
  const user=await createOrSignIn(email,password,notice);
  // The canonical rules allow this legacy fallback only when Firestore can
  // prove the query is restricted to the authenticated user's own accepted
  // application. Keep both email and status constraints in this query.
  const appQuery=query(
    collection(db,"volunteer_applications"),
    where("email","==",email),
    where("emailKey","==",emailKey(email)),
    where("status","==","accepted"),
    limit(5)
  );
  const appSnap=await getDocs(appQuery);
  let matched=null;
  appSnap.forEach(docSnap=>{
    const data=docSnap.data();
    if(!matched&&normalizeCode(data.temporaryCode||"")===code){
      matched={id:docSnap.id,...data};
    }
  });
  if(!matched)throw new Error("No old accepted application matched that email and temporary code. Make sure the code is copied from the accepted application exactly.");
  if(matched.activatedUid&&matched.activatedUid!==user.uid)throw new Error("This old code has already been used by another account.");

  const inviteLikeData={
    name:matched.name||email,
    role:matched.assignedRole||matched.interest||"Volunteer",
    team:matched.assignedTeam||teamFromInterest(matched.interest),
    volunteerStatus:matched.assignedStatus||"Training",
    permissions:Array.isArray(matched.assignedPermissions)?matched.assignedPermissions:["activity:create","service:log","chapter:request","outreach:create","training:complete"],
    chapterId:matched.assignedChapterId||""
  };
  await createVolunteerProfile(user,email,inviteLikeData,"old_application");
  try{
    await updateDoc(doc(db,"volunteer_applications",matched.id),{activatedUid:user.uid,activatedAt:serverTimestamp(),status:"activated",updatedAt:serverTimestamp()});
  }catch(error){
    console.warn("Old application activated but could not be marked activated. Publish the updated Firestore rules.",error);
  }
  setNotice(notice,"Old temporary code accepted. Opening portal...","success");
  setTimeout(()=>window.location.href="dashboard.html",650);
}

async function createOrSignIn(email,password,notice){
  try{
    const credential=await createUserWithEmailAndPassword(auth,email,password);
    return credential.user;
  }catch(error){
    if(error?.code!=="auth/email-already-in-use")throw error;
    setNotice(notice,"That email already has a login. Trying to finish activation with that password...","");
    const credential=await signInWithEmailAndPassword(auth,email,password);
    return credential.user;
  }
}

async function createVolunteerProfile(user,email,data,source){
  const chapterId=data.chapterId||"";
  const profile={
    uid:user.uid,
    email,
    emailKey:emailKey(email),
    volunteerId:data.volunteerId||makeVolunteerId(),
    name:data.name||email,
    role:data.role||"Volunteer",
    team:data.team||"Prayer Support Team",
    status:data.volunteerStatus||"Training",
    permissions:Array.isArray(data.permissions)?data.permissions:["activity:create","service:log","chapter:request","outreach:create","training:complete"],
    chapterId,
    agreementAccepted:false,
    trainingCompleted:false,
    activationSource:source,
    createdAt:serverTimestamp(),
    updatedAt:serverTimestamp()
  };
  await setDoc(doc(db,"volunteers",user.uid),profile,{merge:true});
  if(chapterId){
    await setDoc(doc(db,"chapter_members",`${chapterId}_${user.uid}`),{chapterId,uid:user.uid,email,name:profile.name,role:profile.role,team:profile.team,status:"active",source,joinedAt:serverTimestamp(),updatedAt:serverTimestamp()},{merge:true});
  }
}

function setNotice(el,text,type){
  if(!el)return;
  el.textContent=text;
  el.className="notice"+(type?` ${type}`:"");
}
function normalizeCode(value=""){
  return String(value).trim().replace(/\s+/g,"").toUpperCase();
}
function cleanEmail(email=""){
  return String(email).trim().toLowerCase();
}
function emailKey(email=""){
  return cleanEmail(email).replace(/[.#$/\[\]]/g,"_");
}
function makeVolunteerId(){
  return "TPP-VOL-"+Date.now().toString().slice(-6);
}
function teamFromInterest(interest=""){
  return interest.includes("Chapter")?"Chapter Leadership Team":interest.includes("Local")?"Care and Outreach Team":interest.includes("Admin")?"Administrative Support Team":interest.includes("Encouragement")?"Care and Outreach Team":"Prayer Support Team";
}
