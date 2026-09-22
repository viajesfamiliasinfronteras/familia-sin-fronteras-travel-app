const FSF_SUPABASE_URL='https://xqmuopqeohwqvyyrnflv.supabase.co';
const FSF_SUPABASE_ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxbXVvcHFlb2h3cXZ5eXJuZmx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwMzY3NjYsImV4cCI6MjEwNTYxMjc2Nn0.zVDWqA19nlxyllwLfuUaZeTFUSnBtqffEqH9PHuytTw';
const fsfSupabase=window.supabase.createClient(FSF_SUPABASE_URL,FSF_SUPABASE_ANON,{
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
});

function normalizePhone(value){
  const digits=String(value||'').replace(/\D/g,'');
  return digits ? '+'+digits : '+';
}
async function registerTraveler(name,whatsapp,password){
  const phone=normalizePhone(whatsapp);
  const {data,error}=await fsfSupabase.functions.invoke('register-traveler',{
    body:{name,whatsapp:phone,password},
    headers:{Authorization:'Bearer '+FSF_SUPABASE_ANON,apikey:FSF_SUPABASE_ANON}
  });
  if(error){
    let message=error.message||'No pudimos crear la cuenta.';
    try{const ctx=await error.context?.json?.();if(ctx?.error)message=ctx.error}catch(e){}
    throw new Error(message);
  }
  if(data?.error)throw new Error(data.error);
  return data;
}
function loginEmailFromPhone(whatsapp){
  const digits=String(whatsapp||'').replace(/\D/g,'');
  return 'p'+digits+'@fsf.local';
}
async function signInTraveler(whatsapp,password){
  const email=loginEmailFromPhone(whatsapp);
  const {data,error}=await fsfSupabase.auth.signInWithPassword({email,password});
  if(error)throw error;
  return data;
}
async function getCloudUser(){
  const {data:{user}}=await fsfSupabase.auth.getUser();
  return user||null;
}
async function syncCloudState(){
  const user=await getCloudUser();
  if(!user)return null;
  const [p,m,t]=await Promise.all([
    fsfSupabase.from('profiles').select('*').eq('user_id',user.id).maybeSingle(),
    fsfSupabase.from('trip_memberships').select('trip_id,role,status,joined_at').eq('user_id',user.id).eq('status','active').order('joined_at',{ascending:false}).limit(1).maybeSingle(),
    fsfSupabase.from('passenger_travel').select('*').eq('user_id',user.id).order('updated_at',{ascending:false}).limit(1).maybeSingle()
  ]);
  if(p.error)throw p.error;
  if(m.error)throw m.error;
  if(t.error)throw t.error;
  const profile=p.data||{};
  const membership=m.data||{};
  const travel=t.data||{};
  const patch={
    cloudUserId:user.id,
    userCreated:true,
    loggedIn:true,
    whatsapp:user.phone||'',
    firstName:profile.first_name||user.user_metadata?.first_name||'',
    lastName:profile.last_name||user.user_metadata?.last_name||'',
    nationality:profile.nationality||'',
    age:profile.age_range||'',
    travelWith:profile.travel_with||'',
    interests:profile.interests||[],
    personality:profile.personality||[],
    about:profile.about||'',
    avatarPath:profile.avatar_path||'',
    profileComplete:!!profile.profile_complete,
    tripId:profile.active_trip_id||membership.trip_id||'',
    travelDataComplete:travel.data_status==='submitted'||travel.data_status==='reviewed'
  };
  return window.FSF ? FSF.writeState(patch) : patch;
}
async function saveTripMembership(tripId){
  const user=await getCloudUser(); if(!user)throw new Error('Tu sesión venció. Entra nuevamente.');
  const {error:e1}=await fsfSupabase.from('trip_memberships').upsert({
    user_id:user.id,trip_id:tripId,role:'traveler',status:'active'
  },{onConflict:'user_id,trip_id'});
  if(e1)throw e1;
  const {error:e2}=await fsfSupabase.from('profiles').update({active_trip_id:tripId,updated_at:new Date().toISOString()}).eq('user_id',user.id);
  if(e2)throw e2;
}
function cleanFileName(name){
  return String(name||'file').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]+/g,'-').slice(-90);
}
async function uploadProfileImage(file){
  const user=await getCloudUser(); if(!user)throw new Error('Tu sesión venció.');
  if(!file)return null;
  if(file.size>5*1024*1024)throw new Error('La foto debe pesar menos de 5 MB.');
  const ext=(file.name.split('.').pop()||'jpg').toLowerCase();
  const path=`${user.id}/avatar-${Date.now()}.${ext}`;
  const {error}=await fsfSupabase.storage.from('profile-images').upload(path,file,{upsert:false,contentType:file.type});
  if(error)throw error;
  return path;
}
async function saveProfileCloud(data,file){
  const user=await getCloudUser(); if(!user)throw new Error('Tu sesión venció. Entra nuevamente.');
  let avatarPath=data.avatarPath||'';
  if(file)avatarPath=await uploadProfileImage(file);
  const row={
    first_name:data.firstName,last_name:data.lastName,nationality:data.nationality,
    age_range:data.age,travel_with:data.travelWith,interests:data.interests,
    personality:data.personality,about:data.about,profile_complete:true,
    active_trip_id:data.tripId,avatar_path:avatarPath,updated_at:new Date().toISOString()
  };
  const {error}=await fsfSupabase.from('profiles').update(row).eq('user_id',user.id);
  if(error)throw error;
  return avatarPath;
}
async function uploadTravelDocument(file,tripId,type){
  const user=await getCloudUser(); if(!user)throw new Error('Tu sesión venció.');
  if(!file)return null;
  if(file.size>10*1024*1024)throw new Error('Cada archivo debe pesar menos de 10 MB.');
  const name=cleanFileName(file.name);
  const path=`${user.id}/${tripId}/${type}-${Date.now()}-${name}`;
  const {error:upErr}=await fsfSupabase.storage.from('travel-documents').upload(path,file,{upsert:false,contentType:file.type});
  if(upErr)throw upErr;
  const {data,error}=await fsfSupabase.from('travel_documents').insert({
    user_id:user.id,trip_id:tripId,document_type:type,storage_path:path,
    original_name:file.name,mime_type:file.type||'',processing_status:'pending'
  }).select('id').single();
  if(error)throw error;
  return data.id;
}
async function saveTravelCloud(data,files){
  const user=await getCloudUser(); if(!user)throw new Error('Tu sesión venció. Entra nuevamente.');
  const tripId=data.tripId;
  const docs={};
  for(const [type,file] of Object.entries(files||{})){
    if(file)docs[type]=await uploadTravelDocument(file,tripId,type);
  }
  const travelRow={
    user_id:user.id,trip_id:tripId,
    extra_arrival_before:data.early==='Sí',
    extra_arrival_date:data.earlyDate||null,
    extra_departure_after:data.late==='Sí',
    extra_departure_date:data.lateDate||null,
    arrival_transfer:data.transferMap||'unknown',
    comments:data.comments||'',
    data_status:'submitted',
    updated_at:new Date().toISOString()
  };
  const {error:tErr}=await fsfSupabase.from('passenger_travel').upsert(travelRow,{onConflict:'user_id,trip_id'});
  if(tErr)throw tErr;

  const rows=[
    {direction:'outbound',airline:data.outboundAirline||'',flight_number:data.outboundFlight||'',departure_airport:data.outboundFrom||'',arrival_airport:data.outboundTo||'',departure_date:data.outboundDate||null,departure_time:data.outboundTime||null,source_document_id:docs.outbound_ticket||null},
    {direction:'return',airline:data.returnAirline||'',flight_number:data.returnFlight||'',departure_airport:data.returnFrom||'',arrival_airport:data.returnTo||'',departure_date:data.returnDate||null,departure_time:data.returnTime||null,source_document_id:docs.return_ticket||null}
  ].map((r,i)=>({...r,user_id:user.id,trip_id:tripId,segment_order:1,updated_at:new Date().toISOString()}));
  for(const row of rows){
    const {error}=await fsfSupabase.from('flight_segments').upsert(row,{onConflict:'user_id,trip_id,direction,segment_order'});
    if(error)throw error;
  }
  return docs;
}
function readLegacyState(){
  let a={},b={};
  try{a=JSON.parse(localStorage.getItem('fsf_travel_user_v1')||'{}')||{}}catch(e){}
  try{b=JSON.parse(localStorage.getItem('fsf_user')||'{}')||{}}catch(e){}
  return {...b,...a};
}
async function migrateLegacyState(legacy){
  const user=await getCloudUser(); if(!user||!legacy)return null;
  const patch={};
  if(legacy.tripId){
    await saveTripMembership(legacy.tripId);
    patch.tripId=legacy.tripId;
  }
  const profileUpdate={
    first_name:legacy.firstName||'',
    last_name:legacy.lastName||'',
    nationality:legacy.nationality||'',
    age_range:legacy.age||'',
    travel_with:legacy.travelWith||'',
    interests:Array.isArray(legacy.interests)?legacy.interests:[],
    personality:Array.isArray(legacy.personality)?legacy.personality:[],
    about:legacy.about||'',
    profile_complete:!!legacy.profileComplete,
    active_trip_id:legacy.tripId||null,
    updated_at:new Date().toISOString()
  };
  const {error:pErr}=await fsfSupabase.from('profiles').update(profileUpdate).eq('user_id',user.id);
  if(pErr)throw pErr;
  if(legacy.travelData && legacy.tripId){
    const d=legacy.travelData;
    await saveTravelCloud({
      tripId:legacy.tripId,
      outboundAirline:d.outboundAirline||'',outboundFlight:d.outboundFlight||'',outboundDate:d.outboundDate||'',outboundTime:d.outboundTime||'',outboundFrom:d.outboundFrom||'',outboundTo:d.outboundTo||'',
      returnAirline:d.returnAirline||'',returnFlight:d.returnFlight||'',returnDate:d.returnDate||'',returnTime:d.returnTime||'',returnFrom:d.returnFrom||'',returnTo:d.returnTo||'',
      early:d.early||'',earlyDate:d.earlyDate||'',late:d.late||'',lateDate:d.lateDate||'',
      transferMap:({'Grupo':'group','Privado':'private','Por mi cuenta':'self','Aún no sé':'unknown'})[d.transfer]||'unknown',
      comments:d.comments||''
    },{});
  }
  return syncCloudState();
}
async function loadTravelCloud(tripId){
  const user=await getCloudUser(); if(!user)return null;
  const [t,f,d]=await Promise.all([
    fsfSupabase.from('passenger_travel').select('*').eq('user_id',user.id).eq('trip_id',tripId).maybeSingle(),
    fsfSupabase.from('flight_segments').select('*').eq('user_id',user.id).eq('trip_id',tripId).order('direction').order('segment_order'),
    fsfSupabase.from('travel_documents').select('document_type,original_name,storage_path,processing_status,created_at').eq('user_id',user.id).eq('trip_id',tripId).order('created_at',{ascending:false})
  ]);
  if(t.error)throw t.error;if(f.error)throw f.error;if(d.error)throw d.error;
  return {travel:t.data||null,flights:f.data||[],documents:d.data||[]};
}
window.FSFCLOUD={client:fsfSupabase,normalizePhone,loginEmailFromPhone,registerTraveler,signInTraveler,getCloudUser,syncCloudState,saveTripMembership,saveProfileCloud,saveTravelCloud,loadTravelCloud,readLegacyState,migrateLegacyState};
