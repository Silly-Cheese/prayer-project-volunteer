import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { getFirestore, doc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { openConfirm, openForm, openNotice } from "./admin-modals.js";

const firebaseConfig={apiKey:"AIzaSyAaaABQB1T_SaZ6TARafIXjJ6Zk-upjLO0",authDomain:"prayer-projec.firebaseapp.com",projectId:"prayer-projec",storageBucket:"prayer-projec.firebasestorage.app",messagingSenderId:"47966669764",appId:"1:47966669764:web:b875d2ea5bf75e3b7b3291"};
const app=getApps().length?getApp():initializeApp(firebaseConfig);
const auth=getAuth(app);
const db=getFirestore(app);

const observer=new MutationObserver(addPasswordButtons);
observer.observe(document.body,{childList:true,subtree:true});
addPasswordButtons();

document.addEventListener('click',async event=>{
  const requireBtn=event.target.closest('[data-force-password-reset]');
  const clearBtn=event.target.closest('[data-clear-password-reset]');
  if(requireBtn) await requireReset(requireBtn.dataset.forcePasswordReset);
  if(clearBtn) await clearReset(clearBtn.dataset.clearPasswordReset);
});

function addPasswordButtons(){
  document.querySelectorAll('.update-volunteer').forEach(button=>{
    const id=button.dataset.id;
    const toolbar=button.closest('.toolbar');
    const card=button.closest('.item,.record-card');
    if(!id||!toolbar||toolbar.querySelector(`[data-force-password-reset="${id}"]`))return;
    const alreadyRequired=card?.textContent?.includes('Password Reset Required');
    const btn=document.createElement('button');
    btn.type='button';
    btn.className=alreadyRequired?'btn clear-reset':'btn force-reset';
    btn.textContent=alreadyRequired?'Clear Password Reset':'Require Password Reset';
    if(alreadyRequired)btn.dataset.clearPasswordReset=id;else btn.dataset.forcePasswordReset=id;
    const deleteBtn=toolbar.querySelector('.delete-volunteer');
    toolbar.insertBefore(btn,deleteBtn||null);
  });
}

async function requireReset(uid){
  const result=await openForm('Require Password Reset','This will force the volunteer to create a new password the next time they open the portal.',[{name:'reason',label:'Reason / Admin Note',type:'textarea',value:'Administrative password reset required.'}],{confirmText:'Require Reset'});
  if(!result)return;
  try{
    await updateDoc(doc(db,'volunteers',uid),{requirePasswordReset:true,passwordResetReason:result.reason||'Administrative password reset required.',passwordResetRequiredAt:serverTimestamp(),passwordResetRequiredBy:auth.currentUser?.email||'Admin',updatedAt:serverTimestamp()});
    await openNotice('Password Reset Required','The volunteer will be prompted to create a new password the next time they open the portal.');
    location.reload();
  }catch(error){
    await openNotice('Could Not Require Reset',error?.code||error?.message||'Firestore blocked the update.');
  }
}

async function clearReset(uid){
  const ok=await openConfirm('Clear Password Reset Requirement','Remove the required password reset flag from this volunteer?',{confirmText:'Clear'});
  if(!ok)return;
  try{
    await updateDoc(doc(db,'volunteers',uid),{requirePasswordReset:false,passwordResetClearedAt:serverTimestamp(),passwordResetClearedBy:auth.currentUser?.email||'Admin',updatedAt:serverTimestamp()});
    location.reload();
  }catch(error){
    await openNotice('Could Not Clear Reset',error?.code||error?.message||'Firestore blocked the update.');
  }
}
