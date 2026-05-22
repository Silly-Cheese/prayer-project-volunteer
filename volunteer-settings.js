import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

const firebaseConfig={apiKey:"AIzaSyAaaABQB1T_SaZ6TARafIXjJ6Zk-upjLO0",authDomain:"prayer-projec.firebaseapp.com",projectId:"prayer-projec",storageBucket:"prayer-projec.firebasestorage.app",messagingSenderId:"47966669764",appId:"1:47966669764:web:b875d2ea5bf75e3b7b3291"};
const app=getApps().length?getApp():initializeApp(firebaseConfig);
const db=getFirestore(app);

loadVolunteerProgramSettings();

async function loadVolunteerProgramSettings(){
  try{
    const snap=await getDoc(doc(db,'volunteer_settings','program'));
    if(!snap.exists())return;
    const settings=snap.data();
    if(settings.portalNotice) addBanner(settings.portalNotice);
    if(settings.maintenanceMode) addBanner('The volunteer portal is currently in maintenance mode.');
    applyOpenClosedMessage('applicationForm',settings.applicationsOpen,'Volunteer applications are currently closed.');
    applyOpenClosedMessage('chapterForm',settings.chapterRequestsOpen,'Chapter requests are currently closed.');
    applyOpenClosedMessage('suggestionForm',settings.suggestionsOpen,'Volunteer suggestions are currently closed.');
    applyOpenClosedMessage('careProjectForm',settings.careProjectsOpen,'Care project proposals are currently closed.');
  }catch(error){console.warn('Program settings unavailable.',error);}
}

function applyOpenClosedMessage(formId,isOpen,message){
  const form=document.getElementById(formId);
  if(!form||isOpen!==false)return;
  form.insertAdjacentHTML('afterbegin','<div class="closed-note">'+escapeHtml(message)+'</div>');
  form.querySelectorAll('button').forEach(button=>button.disabled=true);
}

function addBanner(message){
  const main=document.querySelector('main');
  if(!main)return;
  main.insertAdjacentHTML('afterbegin','<div class="page-shell"><div class="standard-banner">'+escapeHtml(message)+'</div></div>');
}

function escapeHtml(value=''){
  return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#039;');
}
