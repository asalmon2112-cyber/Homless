(function(t,e,a){"use strict";
const patches=[];
const seen=new WeakMap();
const timers=[];

function mark(obj, method){
  let s=seen.get(obj);
  if(!s){s=new Set();seen.set(obj,s);}
  if(s.has(method)) return false;
  s.add(method);
  return true;
}

function safeArgs(args){
  try{return JSON.stringify(args);}catch(_){return String(args);}
}

function patchMethod(obj,label,method,handler){
  if(!obj || typeof obj!=="object" || typeof obj[method]!=="function") return;
  if(!mark(obj,method)) return;
  try{
    const unpatch=a.instead(method,obj,(args,orig)=>{
      console.log(`[BTAudioFixV2] BLOCKED ${label}.${method} args=${safeArgs(args)}`);
      return handler ? handler(args,orig) : undefined;
    });
    patches.push(unpatch);
    console.log(`[BTAudioFixV2] patched ${label}.${method}`);
  }catch(err){
    console.log(`[BTAudioFixV2] failed ${label}.${method}: ${err}`);
  }
}

function patchModule(obj,label){
  if(!obj || typeof obj!=="object") return;

  patchMethod(obj,label,"setCommunicationModeOn");
  patchMethod(obj,label,"setCommunicationDevice",()=>false);
  patchMethod(obj,label,"startBluetoothSco");
  patchMethod(obj,label,"setBluetoothScoOn");
  patchMethod(obj,label,"setPreferredCommunicationDevice",()=>false);
  patchMethod(obj,label,"selectCommunicationDevice",()=>false);

  for(const method of ["setActiveAudioDevice","setAudioDevice","setOutputDevice","selectAudioDevice"]){
    if(!obj || typeof obj[method]!=="function" || !mark(obj,method)) continue;
    try{
      const unpatch=a.instead(method,obj,(args,orig)=>{
        let txt=safeArgs(args).toLowerCase();
        if(txt.includes("sco") || txt.includes("bluetooth") || txt.includes("headset")){
          console.log(`[BTAudioFixV2] BLOCKED ${label}.${method} args=${safeArgs(args)}`);
          return undefined;
        }
        return orig(...args);
      });
      patches.push(unpatch);
      console.log(`[BTAudioFixV2] patched ${label}.${method}`);
    }catch(err){
      console.log(`[BTAudioFixV2] failed ${label}.${method}: ${err}`);
    }
  }
}

function apply(){
  const RN=e.ReactNative;
  const registry=RN && RN.TurboModuleRegistry;
  const native=RN && RN.NativeModules;

  const names=[
    "NativeAudioManagerModule",
    "RTNAudioManager",
    "AudioManager",
    "InCallManager",
    "DCDAudioManager",
    "RTCManager",
    "VoiceEngine",
    "MediaEngine"
  ];

  if(registry && typeof registry.get==="function"){
    for(const name of names){
      try{
        const mod=registry.get(name);
        if(mod) patchModule(mod,`Turbo:${name}`);
      }catch(err){}
    }
  }

  if(native){
    for(const name of names){
      try{
        if(native[name]) patchModule(native[name],`Native:${name}`);
      }catch(err){}
    }

    try{
      for(const name of Object.keys(native)){
        const mod=native[name];
        if(!mod || typeof mod!=="object") continue;
        if(typeof mod.setCommunicationDevice==="function" ||
           typeof mod.startBluetoothSco==="function" ||
           typeof mod.setCommunicationModeOn==="function"){
          patchModule(mod,`Scan:${name}`);
        }
      }
    }catch(err){}
  }

  console.log(`[BTAudioFixV2] active patches=${patches.length}`);
}

apply();
for(let i=1;i<=15;i++){
  timers.push(setTimeout(apply,i*2000));
}

t.onUnload=()=>{
  for(const id of timers){try{clearTimeout(id)}catch(_){}}
  for(const u of patches.splice(0)){try{u()}catch(_){}}
  console.log("[BTAudioFixV2] unloaded");
};
return t;
})({},vendetta.metro.common,vendetta.patcher);
