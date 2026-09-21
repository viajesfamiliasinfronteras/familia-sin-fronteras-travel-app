const FSF_KEY='fsf_travel_user_v1';
function readState(){try{return JSON.parse(localStorage.getItem(FSF_KEY))||{}}catch{return{}}}
function writeState(patch){const next={...readState(),...patch,updatedAt:new Date().toISOString()};localStorage.setItem(FSF_KEY,JSON.stringify(next));return next}
async function hashPassword(password,salt){const bytes=new TextEncoder().encode(salt+'::'+password);const digest=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('')}
function splitName(full){const parts=String(full||'').trim().split(/\s+/).filter(Boolean);if(parts.length<=1)return{firstName:parts[0]||'',lastName:''};return{firstName:parts.slice(0,-1).join(' '),lastName:parts[parts.length-1]}}
function requireUser(){const s=readState();if(!s.userCreated){location.href='/crear-cuenta';return null}return s}
window.FSF={readState,writeState,hashPassword,splitName,requireUser};
