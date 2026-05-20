import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

const firebaseConfig={apiKey:"AIzaSyAaaABQB1T_SaZ6TARafIXjJ6Zk-upjLO0",authDomain:"prayer-projec.firebaseapp.com",projectId:"prayer-projec",storageBucket:"prayer-projec.firebasestorage.app",messagingSenderId:"47966669764",appId:"1:47966669764:web:b875d2ea5bf75e3b7b3291"};
const app=getApps().length?getApp():initializeApp(firebaseConfig);
const db=getFirestore(app);
const OWNER_EMAIL='christophershelley257@gmail.com';

export async function getAccessProfile(user){
  if(!user)return {admin:false,trainer:false,reason:'No signed-in user.'};
  const email=String(user.email||'').toLowerCase();
  if(email===OWNER_EMAIL)return {admin:true,trainer:true,owner:true,reason:'Owner email.'};
  let admin=false,trainer=false,volunteer=null;
  try{const adminSnap=await getDoc(doc(db,'admins',user.uid));admin=adminSnap.exists();}catch(error){admin=false;}
  try{const volunteerSnap=await getDoc(doc(db,'volunteers',user.uid));if(volunteerSnap.exists())volunteer=volunteerSnap.data();}catch(error){volunteer=null;}
  const permissions=Array.isArray(volunteer?.permissions)?volunteer.permissions:[];
  if(permissions.includes('admin:limited'))admin=true;
  if(permissions.includes('training:trainer')||admin)trainer=true;
  return {admin,trainer,owner:false,volunteer,permissions,reason:admin||trainer?'Allowed':'Missing required role.'};
}

export async function userIsAdmin(user){
  const profile=await getAccessProfile(user);
  return profile.admin===true;
}

export async function userIsTrainer(user){
  const profile=await getAccessProfile(user);
  return profile.trainer===true;
}
