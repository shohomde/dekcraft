type DisplayState={value:string;priority:string};

// An author stylesheet's display: ... !important can override content.css.
// Inline !important wins that cascade and can be restored without losing other styles.
export class CardVisibility{
 private originals=new Map<HTMLElement,DisplayState>();
 has(card:HTMLElement){return this.originals.has(card)}
 set(card:HTMLElement,hidden:boolean){
  if(!hidden){this.restore(card);return}
  const style=card.style,value=style.getPropertyValue('display'),priority=style.getPropertyPriority('display');
  if(!this.originals.has(card)||value!=='none'||priority!=='important')this.originals.set(card,{value,priority});
  if(value!=='none'||priority!=='important')style.setProperty('display','none','important');
  if(card.getAttribute('data-feedpilot-hidden')!=='true')card.setAttribute('data-feedpilot-hidden','true');
 }
 restore(card:HTMLElement){
  const previous=this.originals.get(card),style=card.style;
  if(previous){
   // Preserve any newer style the site wrote before we had a chance to recheck.
   if(style.getPropertyValue('display')==='none'&&style.getPropertyPriority('display')==='important'){
    if(previous.value)style.setProperty('display',previous.value,previous.priority);else style.removeProperty('display');
    if(!card.getAttribute('style')?.trim())card.removeAttribute('style');
   }
   this.originals.delete(card);
  }
  if(card.hasAttribute('data-feedpilot-hidden'))card.removeAttribute('data-feedpilot-hidden');
 }
 restoreOutside(active:Set<HTMLElement>){for(const card of this.originals.keys())if(!active.has(card))this.restore(card)}
 restoreAll(){for(const card of this.originals.keys())this.restore(card)}
}
