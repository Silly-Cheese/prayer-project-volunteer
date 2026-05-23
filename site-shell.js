import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { getAccessProfile } from "./access-control.js";

const firebaseConfig={apiKey:"AIzaSyAaaABQB1T_SaZ6TARafIXjJ6Zk-upjLO0",authDomain:"prayer-projec.firebaseapp.com",projectId:"prayer-projec",storageBucket:"prayer-projec.firebasestorage.app",messagingSenderId:"47966669764",appId:"1:47966669764:web:b875d2ea5bf75e3b7b3291"};
const app=getApps().length?getApp():initializeApp(firebaseConfig);
const auth=getAuth(app);

markActiveNav();
createMobileNavToggle();
document.documentElement.classList.add('site-shell-loading');

onAuthStateChanged(auth,async user=>{
  try{
    const profile=user?await getAccessProfile(user):{admin:false,trainer:false};
    applyRoleVisibility(profile);
  }catch(error){
    applyRoleVisibility({admin:false,trainer:false});
  }finally{
    document.documentElement.classList.remove('site-shell-loading');
    document.documentElement.classList.add('site-shell-ready');
  }
});

function markActiveNav(){
  const current=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  document.querySelectorAll('.nav-links a').forEach(link=>{
    const href=(link.getAttribute('href')||'').split('/').pop().split('#')[0].toLowerCase();
    if(href===current)link.classList.add('active');
  });
}

function applyRoleVisibility(profile){
  document.querySelectorAll('[data-admin-only]').forEach(el=>{el.hidden=!profile.admin;});
  document.querySelectorAll('[data-trainer-only]').forEach(el=>{el.hidden=!profile.trainer;});
  document.querySelectorAll('[data-auth-only]').forEach(el=>{el.hidden=!auth.currentUser;});
  document.querySelectorAll('[data-guest-only]').forEach(el=>{el.hidden=!!auth.currentUser;});
}

function createMobileNavToggle(){
  const nav=document.querySelector('.nav-inner');
  const links=document.querySelector('.nav-links');
  if(!nav||!links||document.getElementById('navToggle'))return;
  const button=document.createElement('button');
  button.id='navToggle';
  button.className='nav-toggle';
  button.type='button';
  button.setAttribute('aria-label','Open navigation');
  button.textContent='Menu';
  nav.insertBefore(button,links);
  button.addEventListener('click',()=>{
    links.classList.toggle('open');
    button.textContent=links.classList.contains('open')?'Close':'Menu';
  });
}
