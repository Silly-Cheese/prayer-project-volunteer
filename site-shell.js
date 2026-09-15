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
  const backdrop=document.createElement('div');
  button.id='navToggle';
  button.className='nav-toggle';
  button.type='button';
  button.setAttribute('aria-label','Open navigation');
  button.setAttribute('aria-controls','primaryNavigation');
  button.setAttribute('aria-expanded','false');
  links.id=links.id||'primaryNavigation';
  button.innerHTML=menuIcon();
  backdrop.className='nav-backdrop';
  backdrop.setAttribute('aria-hidden','true');
  nav.insertBefore(button,links);
  document.body.appendChild(backdrop);
  const setOpen=open=>{
    links.classList.toggle('open',open);
    backdrop.classList.toggle('open',open);
    document.body.classList.toggle('nav-open',open);
    button.setAttribute('aria-expanded',String(open));
    button.setAttribute('aria-label',open?'Close navigation':'Open navigation');
    button.innerHTML=open?closeIcon():menuIcon();
  };
  button.addEventListener('click',()=>setOpen(!links.classList.contains('open')));
  backdrop.addEventListener('click',()=>setOpen(false));
  links.addEventListener('click',event=>{if(event.target.closest('a'))setOpen(false);});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')setOpen(false);});
  window.addEventListener('resize',()=>{if(innerWidth>900)setOpen(false);});
}

function menuIcon(){return '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke-width="2" stroke-linecap="round"/></svg>';}
function closeIcon(){return '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke-width="2" stroke-linecap="round"/></svg>';}

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
