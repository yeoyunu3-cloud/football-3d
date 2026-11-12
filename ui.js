let active=null;const queue=[];
export function notify(title,message,{confirm=false,confirmText='확인'}={}){
  return new Promise(resolve=>{queue.push({title,message,confirm,confirmText,resolve});present();});
}
function present(){
  if(active||!queue.length)return;active=queue.shift();const dialog=document.getElementById('notice-dialog');
  document.getElementById('notice-title').textContent=active.title;document.getElementById('notice-message').textContent=active.message;
  const accept=document.getElementById('notice-ok'),cancel=document.getElementById('notice-cancel');accept.textContent=active.confirmText;cancel.hidden=!active.confirm;
  const finish=value=>{dialog.close();const done=active;active=null;done.resolve(value);present();};accept.onclick=()=>finish(true);cancel.onclick=()=>finish(false);dialog.oncancel=e=>{e.preventDefault();finish(false);};dialog.showModal();
}
export function textNode(tag,text,cls){const node=document.createElement(tag);node.textContent=text;if(cls)node.className=cls;return node;}
