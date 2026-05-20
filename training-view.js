import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

const firebaseConfig={apiKey:"AIzaSyAaaABQB1T_SaZ6TARafIXjJ6Zk-upjLO0",authDomain:"prayer-projec.firebaseapp.com",projectId:"prayer-projec",storageBucket:"prayer-projec.firebasestorage.app",messagingSenderId:"47966669764",appId:"1:47966669764:web:b875d2ea5bf75e3b7b3291"};
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
const $=id=>document.getElementById(id);

const DEFAULT_SECTIONS=[
  {title:'Mission and Heart of Service',description:'Understand why The Prayer Project serves through prayer, encouragement, privacy, and care.',active:true,completed:false},
  {title:'Privacy and Request Handling',description:'Understand confidentiality and respectful handling of prayer requests.',active:true,completed:false},
  {title:'Crisis Boundaries',description:'Understand that volunteers are not counselors or emergency responders.',active:true,completed:false},
  {title:'Service Logs and Accountability',description:'Understand how to document service honestly and consistently.',active:true,completed:false},
  {title:'Communication with Leadership',description:'Understand how to contact leadership, report concerns, and request help.',active:true,completed:false},
  {title:'Final Trainer Review',description:'A verified trainer confirms readiness for service.',active:true,completed:false}
];

onAuthStateChanged(auth,async user=>{
  if(!user)return;
  await renderTrainingPlan(user.uid);
});

async function renderTrainingPlan(uid){
  const trainer=$('trainingAssignedTrainer'),status=$('trainingPlanStatus'),progress=$('trainingProgress'),list=$('volunteerTrainingSections');
  if(!trainer||!status||!progress||!list)return;
  try{
    const snap=await getDoc(doc(db,'volunteer_training_plans',uid));
    const plan=snap.exists()?snap.data():null;
    const sections=Array.isArray(plan?.sections)?plan.sections:DEFAULT_SECTIONS;
    const required=sections.filter(s=>s.active||s.completed);
    const complete=required.filter(s=>s.completed);
    trainer.textContent=plan?.assignedTrainerName||plan?.assignedTrainerEmail||'Not assigned yet';
    status.textContent=plan?.status||'Awaiting trainer assignment';
    progress.textContent=required.length?`${complete.length} of ${required.length} required sections complete`:'No required sections active yet';
    list.innerHTML=sections.map(sectionCard).join('');
  }catch(error){
    console.error(error);
    trainer.textContent='Could not load';
    status.textContent='Check Firestore rules';
    progress.textContent='Unavailable';
    list.innerHTML='<div>Training plan could not be loaded. Ask a trainer or admin to check your account.</div>';
  }
}
function sectionCard(section){
  const state=section.completed?'Completed':section.active?'Active':'Not Required Yet';
  const cls=section.completed?'ok':'';
  return `<div><strong>${esc(section.title||'Training Section')}</strong><br><span class="pill ${cls}">${esc(state)}</span><p>${esc(section.description||'')}</p></div>`;
}
function esc(value=''){
  return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#039;');
}
