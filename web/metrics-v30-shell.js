/** Persistent Metrics shell: do not destroy the sidebar on page changes. */
export function renderPersistentShell30(mount, html, page){
 if(!mount)throw Error('Root da interface não encontrado.');
 const doc=mount.ownerDocument;
 const template=doc.createElement('template');template.innerHTML=html;
 const fresh=template.content.querySelector('.shell'),existing=mount.querySelector('.shell');
 if(!fresh)throw Error('Estrutura do Metrics não reconhecida.');
 if(!existing){mount.replaceChildren(fresh);return;}
 const prevNav=existing.querySelector('.sidebar .nav'),nextNav=fresh.querySelector('.sidebar .nav');
 if(!prevNav||!nextNav){mount.replaceChildren(fresh);return;}
 const oldIds=[...prevNav.querySelectorAll('[data-nav]')].map(b=>b.dataset.nav).join('|');
 const nextIds=[...nextNav.querySelectorAll('[data-nav]')].map(b=>b.dataset.nav).join('|');
 if(oldIds!==nextIds){const y=prevNav.scrollTop,x=prevNav.scrollLeft;prevNav.replaceWith(nextNav);nextNav.scrollTop=y;nextNav.scrollLeft=x;}
 const nav=existing.querySelector('.sidebar .nav');
 for(const b of nav.querySelectorAll('[data-nav]')){
  const active=b.dataset.nav===page;b.classList.toggle('active',active);
  if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
 }
 const oldMain=existing.querySelector('main.main'),freshMain=fresh.querySelector('main.main');
 if(!oldMain||!freshMain){mount.replaceChildren(fresh);return;}
 // Preserve main layout too, only swap its header/content where actually changed.
 for(const selector of ['.topbar','#content']){
  const oldNode=oldMain.querySelector(selector),newNode=freshMain.querySelector(selector);
  if(!oldNode||!newNode)continue;
  if(oldNode.outerHTML!==newNode.outerHTML)oldNode.replaceWith(newNode);
 }
}
