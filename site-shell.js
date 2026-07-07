import { getApps, getApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { getAccessProfile } from "./access-control.js";

const app=getApps().length?getApp():null;
const auth=app?getAuth(app):null;

markActiveNav();
createMobileNavToggle();
closeMoreMenuOnOutsideClick();
loadV2Layers();
document.documentElement.classList.add('site-shell-loading');

if(auth){
  onAuthStateChanged(auth,async user=>{
    try{
      const profile=user?await getAccessProfile(user):{admin:false,trainer:false};
      applyRoleVisibility(profile);
    }catch(error){
      applyRoleVisibility({admin:false,trainer:false});
    }finally{
      cleanEmptyMenus();
      document.documentElement.classList.remove('site-shell-loading');
      document.documentElement.classList.add('site-shell-ready');
    }
  });
}else{
  applyRoleVisibility({admin:false,trainer:false});
  cleanEmptyMenus();
  document.documentElement.classList.remove('site-shell-loading');
  document.documentElement.classList.add('site-shell-ready');
}

function loadV2Layers(){
  if(!document.querySelector('link[href="./v2-volunteer-network.css"]')){
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='./v2-volunteer-network.css';
    document.head.appendChild(link);
  }
  import('./v2-volunteer-network.js').catch(error=>console.warn('V2 volunteer layer unavailable.',error));
  import('./v2-operations.js').catch(error=>console.warn('V2 operations layer unavailable.',error));
}

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
  document.querySelectorAll('[data-auth-only]').forEach(el=>{el.hidden=!(auth&&auth.currentUser);});
  document.querySelectorAll('[data-guest-only]').forEach(el=>{el.hidden=!!(auth&&auth.currentUser);});
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

function closeMoreMenuOnOutsideClick(){
  document.addEventListener('click',event=>{
    document.querySelectorAll('.nav-more[open]').forEach(menu=>{
      if(!menu.contains(event.target))menu.removeAttribute('open');
    });
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape')document.querySelectorAll('.nav-more[open]').forEach(menu=>menu.removeAttribute('open'));
  });
}

function cleanEmptyMenus(){
  document.querySelectorAll('.nav-menu').forEach(menu=>{
    const visibleLinks=[...menu.querySelectorAll('a')].filter(link=>!link.hidden);
    const details=menu.closest('details');
    if(details)details.hidden=visibleLinks.length===0;
  });
}
