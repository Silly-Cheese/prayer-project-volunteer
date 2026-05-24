import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getAuth, onAuthStateChanged, updatePassword, signOut } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

const firebaseConfig={apiKey:"AIzaSyAaaABQB1T_SaZ6TARafIXjJ6Zk-upjLO0",authDomain:"prayer-projec.firebaseapp.com",projectId:"prayer-projec",storageBucket:"prayer-projec.firebasestorage.app",messagingSenderId:"47966669764",appId:"1:47966669764:web:b875d2ea5bf75e3b7b3291"};
const app=getApps().length?getApp():initializeApp(firebaseConfig);
const auth=getAuth(app);
const db=getFirestore(app);

onAuthStateChanged(auth,async user=>{
  if(!user)return;
  try{
    const snap=await getDoc(doc(db,'volunteers',user.uid));
    if(!snap.exists())return;
    const data=snap.data();
    if(data.requirePasswordReset===true) showResetModal(user,data);
  }catch(error){
    console.warn('Password reset requirement could not be checked.',error);
  }
});

function showResetModal(user,data){
  if(document.getElementById('forcedPasswordResetModal'))return;
  document.body.insertAdjacentHTML('beforeend',`<div class="admin-action-modal show" id="forcedPasswordResetModal"><div class="admin-action-backdrop"></div><section class="admin-action-card"><p class="eyebrow">Security Requirement</p><h2>Password reset required.</h2><p class="muted">An administrator has required a password reset before you continue using the volunteer portal.</p>${data.passwordResetReason?`<div class="module-note">${escapeHtml(data.passwordResetReason)}</div>`:''}<form id="forcedPasswordResetForm"><label>New Password<input id="forcedNewPassword" type="password" minlength="6" autocomplete="new-password" required></label><label>Confirm New Password<input id="forcedConfirmPassword" type="password" minlength="6" autocomplete="new-password" required></label><button class="btn primary full" type="submit">Reset Password</button><button class="btn full" id="forcedResetSignOut" type="button">Sign Out Instead</button><p class="notice" id="forcedResetNotice"></p></form></section></div>`);
  document.getElementById('forcedPasswordResetForm').addEventListener('submit',async event=>{
    event.preventDefault();
    const notice=document.getElementById('forcedResetNotice');
    const password=document.getElementById('forcedNewPassword').value;
    const confirm=document.getElementById('forcedConfirmPassword').value;
    if(password!==confirm){notice.textContent='Passwords do not match.';notice.className='notice error';return;}
    try{
      await updatePassword(user,password);
      await updateDoc(doc(db,'volunteers',user.uid),{requirePasswordReset:false,passwordResetCompletedAt:serverTimestamp(),updatedAt:serverTimestamp()});
      notice.textContent='Password reset complete.';
      notice.className='notice success';
      setTimeout(()=>document.getElementById('forcedPasswordResetModal')?.remove(),650);
    }catch(error){
      notice.textContent=error?.code==='auth/requires-recent-login'?'Please sign out and sign back in, then reset your password immediately.':(error?.message||'Password could not be reset.');
      notice.className='notice error';
    }
  });
  document.getElementById('forcedResetSignOut').addEventListener('click',()=>signOut(auth));
}
function escapeHtml(value=''){
  return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#039;');
}
