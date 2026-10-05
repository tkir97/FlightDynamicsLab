// Native fullscreen where supported; viewport expansion for restricted browsers/embeds.
export function bindFullscreen(view,button,onChange=()=>{}){
 let pending=false;
 const active=()=>document.fullscreenElement===view||view.classList.contains('view-fullscreen');
 function sync(){const open=active();button.textContent=open?'Exit full screen':'Full screen';button.setAttribute('aria-pressed',String(open));button.title=open?'Exit full screen (Esc or F)':'Full screen (F)';document.body.classList.toggle('view-fullscreen-open',view.classList.contains('view-fullscreen'));onChange();}
 async function toggle(){
  if(pending)return;pending=true;
  try{
   if(document.fullscreenElement===view)await document.exitFullscreen();
   else if(view.classList.contains('view-fullscreen'))view.classList.remove('view-fullscreen');
   else{
    try{if(!view.requestFullscreen)throw Error('Fullscreen unavailable');await view.requestFullscreen();}
    catch{view.classList.add('view-fullscreen');}
   }
  }finally{pending=false;sync();button.blur();}
 }
 button.addEventListener('click',toggle);
 document.addEventListener('fullscreenchange',sync);
 window.addEventListener('keydown',event=>{
  if(event.repeat||event.target?.isContentEditable||['INPUT','SELECT','TEXTAREA'].includes(event.target?.tagName))return;
  if(event.key.toLowerCase()==='f'){event.preventDefault();toggle();}
  else if(event.key==='Escape'&&view.classList.contains('view-fullscreen')){view.classList.remove('view-fullscreen');sync();}
 });
 sync();
}
