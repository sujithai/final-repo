(function(){
  'use strict';
  const $=(i)=>document.getElementById(i);
  const esc=(s)=>String(s==null?'':s).replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const post=async(body)=>{const r=await fetch('/api/admin',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Requested-With':'sw-admin'},body:JSON.stringify(body)});let j={};try{j=await r.json()}catch(e){}return Object.assign({status:r.status},j)};
  let certs=[],inqs=[],storeOn=false;
  const fmt=(t)=>new Date(t).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
  const csvCell=(v)=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';
  function download(name,text){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'text/csv'}));a.download=name;document.body.appendChild(a);a.click();a.remove()}
  function show(on){$('appView').hidden=!on;$('loginView').hidden=on}
  function tab(n){document.querySelectorAll('.admin-tabs button').forEach((b)=>b.classList.toggle('on',b.dataset.tab===n));['dash','inq','certs'].forEach((p)=>{$('pane-'+p).hidden=p!==n})}

  /* ---------- dashboard ---------- */
  function renderDash(){
    const now=Date.now(),day=864e5;
    const nNew=inqs.filter((i)=>i.status==='new').length,w=inqs.filter((i)=>now-i.t<7*day).length;
    const valid=certs.filter((c)=>c.status!=='revoked').length;
    const cards=[['Inquiries',inqs.length],['New / unanswered',nNew],['Last 7 days',w],['Certificates valid',valid],['Certificates revoked',certs.length-valid]];
    $('stats').innerHTML=cards.map((c)=>'<div class="stat"><b>'+c[1]+'</b><span>'+esc(c[0])+'</span></div>').join('');
    const days=[];for(let i=6;i>=0;i--){const d=new Date(now-i*day);d.setHours(0,0,0,0);days.push({d:d.getTime(),l:d.toLocaleDateString('en-IN',{weekday:'short'}),n:0})}
    inqs.forEach((q)=>{const d=new Date(q.t);d.setHours(0,0,0,0);const x=days.find((y)=>y.d===d.getTime());if(x)x.n++});
    const max=Math.max(1,...days.map((d)=>d.n));
    $('weekBars').innerHTML=days.map((d)=>'<div class="bar"><i data-h="'+Math.round(d.n/max*100)+'"></i><em>'+d.n+'</em><span>'+esc(d.l)+'</span></div>').join('');
    const by={};inqs.forEach((q)=>{const k=String(q.form||'Website inquiry').replace(/^New (SCIENWAVE )?/i,'');by[k]=(by[k]||0)+1});
    const ents=Object.entries(by).sort((a,b)=>b[1]-a[1]);const mx=Math.max(1,...ents.map((e)=>e[1]));
    $('typeBars').innerHTML=ents.length?ents.map((e)=>'<div class="hbar"><span>'+esc(e[0])+'</span><div><i data-w="'+Math.round(e[1]/mx*100)+'"></i></div><b>'+e[1]+'</b></div>').join(''):'<p class="admin-muted">No inquiries yet.</p>';
    document.querySelectorAll('[data-h]').forEach((e)=>{e.style.height=e.dataset.h+'%'});
    document.querySelectorAll('[data-w]').forEach((e)=>{e.style.width=e.dataset.w+'%'});
    const nb=$('newBadge');nb.hidden=!nNew;nb.textContent=nNew;
  }

  /* ---------- inquiries ---------- */
  function renderInq(){
    const f=$('inqFilter').value,q=($('inqSearch').value||'').toLowerCase();
    const list=inqs.filter((i)=>(f==='all'||i.status===f)&&(!q||[i.name,i.phone,i.email,i.message,i.form].join(' ').toLowerCase().includes(q)));
    $('inqCount').textContent='('+list.length+' of '+inqs.length+')';
    $('inqList').innerHTML=list.map((i)=>{
      const extra=Object.entries(i.fields||{}).filter((e)=>!['Full Name','Name','Phone Number','Phone','Email','Message'].includes(e[0])).map((e)=>'<div><b>'+esc(e[0])+':</b> '+esc(e[1])+'</div>').join('');
      return '<article class="inq" data-id="'+esc(i.id)+'"><div class="inq-head"><div><strong>'+esc(i.name||'(no name)')+'</strong><span class="inq-meta">'+esc(fmt(i.t))+' · '+esc(String(i.form||'').replace(/^New /,''))+'</span></div><select class="inq-status st-'+esc(i.status)+'" aria-label="Status"><option value="new"'+(i.status==='new'?' selected':'')+'>New</option><option value="contacted"'+(i.status==='contacted'?' selected':'')+'>Contacted</option><option value="closed"'+(i.status==='closed'?' selected':'')+'>Closed</option></select></div>'+
      '<div class="inq-contact">'+(i.phone?'<a href="tel:'+esc(i.phone.replace(/[^+\d]/g,''))+'">'+esc(i.phone)+'</a>':'')+(i.email?'<a href="mailto:'+esc(i.email)+'">'+esc(i.email)+'</a>':'')+'</div>'+
      (i.message?'<p class="inq-msg">'+esc(i.message)+'</p>':'')+(extra?'<div class="inq-extra">'+extra+'</div>':'')+
      '<div class="inq-foot"><span class="inq-note">'+(i.note?'Note: '+esc(i.note):'')+'</span><span><button type="button" data-act="note">Add note</button><button type="button" data-act="del">Delete</button></span></div></article>';
    }).join('')||'<p class="admin-muted">No inquiries to show.</p>';
  }

  /* ---------- certificates ---------- */
  function renderCerts(){
    const q=($('filter').value||'').toLowerCase();
    const list=certs.filter((r)=>!q||[r.ref,r.name,r.program].join(' ').toLowerCase().includes(q));
    $('count').textContent='('+list.length+' of '+certs.length+')';
    $('rows').innerHTML=list.map((r)=>'<tr><td>'+esc(r.ref)+'</td><td>'+esc(r.name)+'</td><td>'+esc(r.program)+'</td><td>'+esc(r.issued)+'</td><td><span class="pill '+(r.status==='revoked'?'bad':'ok')+'">'+esc(r.status)+'</span></td><td class="admin-row-actions">'+
      (r.source==='admin'?'<button type="button" data-a="edit" data-k="'+esc(r.key)+'">Edit</button>':'')+
      (r.status==='revoked'?'<button type="button" data-a="restore" data-k="'+esc(r.key)+'">Restore</button>':'<button type="button" data-a="revoke" data-k="'+esc(r.key)+'">Revoke</button>')+
      (r.source==='admin'?'<button type="button" data-a="delete" data-k="'+esc(r.key)+'">Delete</button>':'')+'</td></tr>').join('')||'<tr><td colspan="6">No records yet. Add one, or bulk upload a list.</td></tr>';
  }

  async function load(){
    const [a,b]=await Promise.all([post({action:'list'}),post({action:'inq_list'})]);
    if(a.status===401||b.status===401){show(false);return}
    if(!a.ok){$('loginMsg').textContent=a.error||'Error';show(false);return}
    certs=a.rows||[];inqs=(b&&b.rows)||[];storeOn=!!a.storeOn;show(true);
    const n=$('storeNote');n.hidden=storeOn;n.textContent=storeOn?'':'Read-only: connect Upstash Redis (UPSTASH_REDIS_REST_URL and _TOKEN) to save inquiries and edit records.';
    renderDash();renderInq();renderCerts();
  }

  /* ---------- csv ---------- */
  function parseCSV(t){const rows=[];let row=[],f='',q=false;for(let i=0;i<t.length;i++){const c=t[i];if(q){if(c==='"'){if(t[i+1]==='"'){f+='"';i++}else q=false}else f+=c}else if(c==='"')q=true;else if(c===','||c==='\t'){row.push(f);f='' }else if(c==='\n'||c==='\r'){if(c==='\r'&&t[i+1]==='\n')i++;row.push(f);rows.push(row);row=[];f=''}else f+=c}if(f.length||row.length){row.push(f);rows.push(row)}return rows.filter((r)=>r.some((x)=>x.trim()))}
  const COLS=['ref','name','program','role','period','issued'];

  /* ---------- events ---------- */
  $('loginForm').addEventListener('submit',async(e)=>{e.preventDefault();$('loginMsg').textContent='Signing in…';const r=await post({action:'login',password:$('pw').value});$('pw').value='';if(r.ok){$('loginMsg').textContent='';load()}else $('loginMsg').textContent=r.error||'Could not sign in.'});
  $('logoutBtn').addEventListener('click',async()=>{await post({action:'logout'});certs=[];inqs=[];show(false)});
  $('refreshBtn').addEventListener('click',load);
  document.querySelector('.admin-tabs').addEventListener('click',(e)=>{const b=e.target.closest('button[data-tab]');if(b)tab(b.dataset.tab)});
  $('inqFilter').addEventListener('change',renderInq);$('inqSearch').addEventListener('input',renderInq);$('filter').addEventListener('input',renderCerts);
  $('inqList').addEventListener('change',async(e)=>{const s=e.target.closest('.inq-status');if(!s)return;const id=s.closest('.inq').dataset.id;const r=await post({action:'inq_set',id,status:s.value});if(!r.ok)alert(r.error||'Failed');load()});
  $('inqList').addEventListener('click',async(e)=>{const b=e.target.closest('button[data-act]');if(!b)return;const id=b.closest('.inq').dataset.id;const rec=inqs.find((x)=>x.id===id);
    if(b.dataset.act==='note'){const n=prompt('Note for this inquiry (what was discussed / next step):',rec&&rec.note||'');if(n===null)return;const r=await post({action:'inq_set',id,note:n});if(!r.ok)alert(r.error||'Failed');load()}
    if(b.dataset.act==='del'){if(!confirm('Delete this inquiry permanently?'))return;const r=await post({action:'inq_delete',id});if(!r.ok)alert(r.error||'Failed');load()}});
  $('inqExport').addEventListener('click',()=>{const h=['Date','Form','Name','Phone','Email','Message','Status','Note'];download('scienwave-inquiries.csv',[h.map(csvCell).join(',')].concat(inqs.map((i)=>[fmt(i.t),i.form,i.name,i.phone,i.email,i.message,i.status,i.note].map(csvCell).join(','))).join('\n'))});
  $('certExport').addEventListener('click',()=>{download('scienwave-certificates.csv',[COLS.concat('status').map(csvCell).join(',')].concat(certs.map((c)=>COLS.concat('status').map((k)=>csvCell(c[k])).join(','))).join('\n'))});
  $('tplBtn').addEventListener('click',()=>download('certificates-template.csv',COLS.join(',')+'\nSWT-AI-011,Anita Kumar,AI Internship,Participant,03 June 2026 to 02 July 2026,03 July 2026\n'));
  $('bulkFile').addEventListener('change',(e)=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{$('bulkText').value=String(r.result)};r.readAsText(f)});
  $('bulkBtn').addEventListener('click',async()=>{
    let rows=parseCSV($('bulkText').value||'');if(!rows.length){$('bulkMsg').textContent='Paste some rows first.';return}
    if(rows[0].some((c)=>/^ref/i.test(c.trim())))rows=rows.slice(1);
    const data=rows.map((r)=>{const o={};COLS.forEach((k,i)=>{o[k]=(r[i]||'').trim()});return o});
    $('bulkMsg').textContent='Uploading '+data.length+' rows…';
    const r=await post({action:'bulk',rows:data});
    if(!r.ok){$('bulkMsg').textContent=r.error||'Upload failed';return}
    $('bulkMsg').textContent='Added '+r.added+'. Skipped '+r.skipped.length+(r.skipped.length?' ('+r.skipped.slice(0,5).map((s)=>'row '+s.row+': '+s.reason).join('; ')+(r.skipped.length>5?'…':'')+')':'')+'.';
    if(r.added){$('bulkText').value='';$('bulkFile').value='';load()}});
  function resetForm(){const f=$('addForm');f.reset();f.role.value='Participant';$('editKey').value='';$('formTitle').textContent='Add certificate record';$('saveBtn').textContent='Add record';$('cancelEdit').hidden=true}
  $('cancelEdit').addEventListener('click',()=>{resetForm();$('addMsg').textContent=''});
  $('rows').addEventListener('click',async(e)=>{const b=e.target.closest('button[data-a]');if(!b)return;const a=b.dataset.a,k=b.dataset.k;
    if(a==='edit'){const r=certs.find((x)=>x.key===k);if(!r)return;const f=$('addForm');f.ref.value=r.ref||'';f.name.value=r.name||'';f.program.value=r.program||'';f.role.value=r.role||'Participant';f.period.value=r.period||'';f.issued.value=r.issued||'';$('editKey').value=k;$('formTitle').textContent='Edit certificate record';$('saveBtn').textContent='Save changes';$('cancelEdit').hidden=false;$('addMsg').textContent='';f.scrollIntoView({behavior:'smooth',block:'center'});return}
    if(a==='delete'&&!confirm('Delete this record permanently?'))return;if(a==='revoke'&&!confirm('Revoke this certificate? Verification will show it as revoked.'))return;
    const r=await post({action:a,key:k});if(!r.ok)alert(r.error||'Failed');load()});
  $('addForm').addEventListener('submit',async(e)=>{e.preventDefault();const f=e.target;const d=Object.fromEntries(new FormData(f));const editing=!!d.key;d.action=editing?'edit':'add';const r=await post(d);$('addMsg').textContent=r.ok?(editing?'Changes saved.':'Record added.'):(r.error||'Failed');if(r.ok){resetForm();load()}});
  load();
})();
