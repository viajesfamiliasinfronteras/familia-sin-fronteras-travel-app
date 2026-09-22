const FSF_KEY='fsf_travel_user_v1';
function readState(){try{return JSON.parse(localStorage.getItem(FSF_KEY))||{}}catch{return{}}}
function writeState(patch){const next={...readState(),...patch,updatedAt:new Date().toISOString()};localStorage.setItem(FSF_KEY,JSON.stringify(next));return next}
function splitName(full){const parts=String(full||'').trim().split(/\s+/).filter(Boolean);if(parts.length<=1)return{firstName:parts[0]||'',lastName:''};return{firstName:parts.slice(0,-1).join(' '),lastName:parts[parts.length-1]}}
function normalizePhone(value){const digits=String(value||'').replace(/\D/g,'');return digits?'+'+digits:'+'}
function makeSalt(){if(crypto.randomUUID)return crypto.randomUUID();const a=new Uint32Array(4);crypto.getRandomValues(a);return Array.from(a).join('-')}
async function hashPassword(password,salt){const bytes=new TextEncoder().encode(salt+'::'+password);const digest=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('')}
async function saveLocalAccount(name,whatsapp,password){
  const phone=normalizePhone(whatsapp),names=splitName(name),salt=makeSalt(),passwordHash=await hashPassword(password,salt);
  const account={name,firstName:names.firstName,lastName:names.lastName,whatsapp:phone,passwordSalt:salt,passwordHash,userCreated:true,loggedIn:true,rememberMe:true};
  localStorage.setItem('fsf_user',JSON.stringify(account));
  return writeState({...account,localMode:true});
}
async function loginLocal(whatsapp,password){
  let legacy=null;try{legacy=JSON.parse(localStorage.getItem('fsf_user')||'null')}catch(e){}
  if(!legacy)return null;
  const phone=normalizePhone(whatsapp);
  if(normalizePhone(legacy.whatsapp)!==phone)return null;
  if(legacy.passwordHash&&legacy.passwordSalt){
    const test=await hashPassword(password,legacy.passwordSalt);
    if(test!==legacy.passwordHash)return null;
  }else{
    const salt=makeSalt();legacy.passwordSalt=salt;legacy.passwordHash=await hashPassword(password,salt);
  }
  legacy.loggedIn=true;legacy.rememberMe=true;legacy.userCreated=true;
  localStorage.setItem('fsf_user',JSON.stringify(legacy));
  const current=readState(),names=splitName(legacy.name||'');
  return writeState({...current,...legacy,firstName:current.firstName||legacy.firstName||names.firstName,lastName:current.lastName||legacy.lastName||names.lastName,whatsapp:phone,localMode:true});
}
function requireUser(){const s=readState();if(!s.userCreated||!s.loggedIn){location.href='/login';return null}return s}
function nextRoute(){const s=readState();if(!s.tripId)return'/elegir-viaje.html';if(!s.profileComplete)return'/mi-perfil.html';return'/mi-viaje.html'}
const TRIPS={'japon-oct-2026':'Japón · Octubre 2026','japon-ene-2027':'Japón · Enero 2027','islandia-feb-2027':'Islandia · Febrero 2027','china-abr-2027':'China · Abril 2027'};
const TRIP_ART={'japon-oct-2026':'/assets/viajes/japon-oct-2026.webp','japon-ene-2027':'/assets/viajes/japon-ene-2027.webp','islandia-feb-2027':'/assets/trip-islandia-feb-2027.svg','china-abr-2027':'/assets/viajes/china-abr-2027.webp'};
function tripLabel(id){return TRIPS[id]||id||''}
function tripArt(id){return TRIP_ART[id]||''}
function dbOpen(){return new Promise((resolve,reject)=>{const r=indexedDB.open('fsf_travel_files',1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('files'))r.result.createObjectStore('files')};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function saveLocalFile(key,file){if(!file)return;const db=await dbOpen();await new Promise((resolve,reject)=>{const tx=db.transaction('files','readwrite');tx.objectStore('files').put({name:file.name,type:file.type,blob:file,updatedAt:new Date().toISOString()},key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}
async function getLocalFile(key){const db=await dbOpen();return await new Promise((resolve,reject)=>{const tx=db.transaction('files','readonly');const q=tx.objectStore('files').get(key);q.onsuccess=()=>resolve(q.result||null);q.onerror=()=>reject(q.error)})}
window.FSF={readState,writeState,splitName,normalizePhone,hashPassword,saveLocalAccount,loginLocal,requireUser,nextRoute,tripLabel,tripArt,saveLocalFile,getLocalFile};
