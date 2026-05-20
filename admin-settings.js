import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { openNotice } from "./admin-modals.js";

const firebaseConfig={apiKey:"AIzaSyAaaABQB1T_SaZ6TARafIXjJ6Zk-upjLO0",authDomain:"prayer-projec.firebaseapp.com",projectId:"prayer-projec",storageBucket:"prayer-projec.firebasestorage.app",messagingSenderId:"47966669764",appId:"1:47966669764:web:b875d2ea5bf75e3b7b3291"};
const app=getApps().length?getApp():initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
const $=id=>document.getElementById(id);

onAuthStateChanged(auth,async user=>{if(user) await loadSettings();});
document.addEventListener('click',async event=>{if(event.target.closest('[data-save-settings]')) await saveSettings();});

async function loadSettings(){
  const defaults={applicationsOpen:true,chapterRequestsOpen:true,suggestionsOpen:true,careProjectsOpen:true,defaultTrainerEmail:'',portalNotice:'',maintenanceMode:false};
  try{
    const snap=await getDoc(doc(db,'volunteer_settings','program'));
    const settings=snap.exists()?Object.assign(defaults,snap.data()):defaults;
    setChecked('applicationsOpen',settings.applicationsOpen);
    setChecked('chapterRequestsOpen',settings.chapterRequestsOpen);
    setChecked('suggestionsOpen',settings.suggestionsOpen);
    setChecked('careProjectsOpen',settings.careProjectsOpen);
    setChecked('maintenanceMode',settings.maintenanceMode);
    setValue('defaultTrainerEmail',settings.defaultTrainerEmail||'');
    setValue('portalNoticeSetting',settings.portalNotice||'');
    updatePreview(settings);
  }catch(error){console.error(error);await openNotice('Settings Could Not Load','Check Firestore rules for volunteer_settings/program.');}
}
async function saveSettings(){
  const settings={applicationsOpen:checked('applicationsOpen'),chapterRequestsOpen:checked('chapterRequestsOpen'),suggestionsOpen:checked('suggestionsOpen'),careProjectsOpen:checked('careProjectsOpen'),maintenanceMode:checked('maintenanceMode'),defaultTrainerEmail:value('defaultTrainerEmail'),portalNotice:value('portalNoticeSetting'),updatedAt:serverTimestamp(),updatedBy:auth.currentUser?.email||'Admin'};
  try{
    await setDoc(doc(db,'volunteer_settings','program'),settings,{merge:true});
    updatePreview(settings);
    await openNotice('Settings Saved','Volunteer program settings were saved successfully.');
  }catch(error){console.error(error);await openNotice('Settings Save Failed',error?.message||'The settings could not be saved.');}
}
function updatePreview(settings){
  const target=$('settingsPreview');
  if(!target)return;
  target.innerHTML='<div class="status-chip '+(settings.applicationsOpen?'ok':'')+'">Applications: '+(settings.applicationsOpen?'Open':'Closed')+'</div><div class="status-chip '+(settings.chapterRequestsOpen?'ok':'')+'">Chapters: '+(settings.chapterRequestsOpen?'Open':'Closed')+'</div><div class="status-chip '+(settings.suggestionsOpen?'ok':'')+'">Suggestions: '+(settings.suggestionsOpen?'Open':'Closed')+'</div><div class="status-chip '+(settings.careProjectsOpen?'ok':'')+'">Care Projects: '+(settings.careProjectsOpen?'Open':'Closed')+'</div><div class="status-chip '+(settings.maintenanceMode?'':'ok')+'">Portal: '+(settings.maintenanceMode?'Maintenance':'Live')+'</div>';
}
function checked(id){return !!$(id)?.checked}
function value(id){return $(id)?.value.trim()||''}
function setChecked(id,val){const el=$(id);if(el)el.checked=!!val}
function setValue(id,val){const el=$(id);if(el)el.value=val}
