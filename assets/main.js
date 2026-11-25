
const hamb=document.querySelector('.hamb');const mob=document.querySelector('.mobile');if(hamb&&mob){const line=document.createElement('span');line.setAttribute('aria-hidden','true');hamb.appendChild(line);hamb.setAttribute('aria-expanded','false');hamb.addEventListener('click',()=>{const isOpen=mob.classList.toggle('open');hamb.setAttribute('aria-expanded',String(isOpen));document.body.classList.toggle('menu-open',isOpen)});document.addEventListener('click',(event)=>{if(!event.target.closest('.nav')&&mob.classList.contains('open')){mob.classList.remove('open');hamb.setAttribute('aria-expanded','false');document.body.classList.remove('menu-open')}});document.addEventListener('keydown',(event)=>{if(event.key==='Escape'&&mob.classList.contains('open')){mob.classList.remove('open');hamb.setAttribute('aria-expanded','false');document.body.classList.remove('menu-open');hamb.focus()}});mob.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{mob.classList.remove('open');hamb.setAttribute('aria-expanded','false');document.body.classList.remove('menu-open')}));}
const obs=new IntersectionObserver((entries)=>{entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');obs.unobserve(e.target)}})},{threshold:.12});
document.querySelectorAll('.reveal').forEach(el=>obs.observe(el));


// V15 scroll polish
(function(){
  const line=document.createElement('div');
  line.className='scroll-line';
  document.body.appendChild(line);
  const nav=document.querySelector('.nav');
  function onScroll(){
    const h=document.documentElement.scrollHeight-window.innerHeight;
    const p=h>0?(window.scrollY/h)*100:0;
    line.style.width=p+'%';
    if(nav) nav.classList.toggle('scrolled', window.scrollY>20);
  }
  window.addEventListener('scroll',onScroll,{passive:true});
  onScroll();
})();

window.addEventListener('scroll',()=>{const n=document.querySelector('.nav'); if(n) n.classList.toggle('scrolled', window.scrollY>8);});

// Direct inquiry form submission to SCIENWAVE email without opening user's mail app.
(function(){
  const forms = document.querySelectorAll('.inquiry-form');
  if(!forms.length) return;

  forms.forEach(function(form){
    const status = form.querySelector('.form-status');
    const button = form.querySelector('button[type="submit"]');
    const originalText = button ? button.textContent : 'Submit Inquiry';

    form.addEventListener('submit', async function(event){
      event.preventDefault();
      if(status) status.textContent = 'Submitting securely... Please wait for confirmation.';
      if(button){ button.disabled = true; button.textContent = 'Sending...'; }

      try{
        const formData = new FormData(form);
        try{
          if(!formData.get('_honey')){
            const copy = {};
            formData.forEach(function(v,k){ if(typeof v === 'string' && k.charAt(0) !== '_' && k !== 'Recipient Email') copy[k] = v; });
            copy._form = String(formData.get('_subject') || '');
            copy._page = location.pathname;
            fetch('/api/inquiry',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(copy),keepalive:true}).catch(function(){});
          }
        }catch(e){}
        const response = await fetch(form.action, {
          method: 'POST',
          body: formData,
          headers: { 'Accept': 'application/json' }
        });

        if(!response.ok) throw new Error('Submission failed');

        form.reset();
        if(status) status.textContent = 'Submission received. Thank you for taking a thoughtful step with Scienwave.';
        const pop=document.createElement('div');
        pop.className='success-pop';
        pop.innerHTML='<strong>Submission received with care.</strong><p>Thank you for taking a meaningful step with SCIENWAVE. Your details will be reviewed thoughtfully. Shortlisted applicants or relevant inquiries will be contacted through official channels.</p>';
        document.body.appendChild(pop);
        requestAnimationFrame(()=>pop.classList.add('show'));
        setTimeout(()=>{pop.classList.remove('show'); setTimeout(()=>pop.remove(),300)},4200);
        if(button) button.textContent = 'Submitted';
        setTimeout(()=>{
          if(button){ button.disabled = false; button.textContent = originalText; }
        }, 1800);
      }catch(error){
        if(status) status.textContent = 'Could not send right now. Please try again or contact SCIENWAVE directly.';
        if(button){ button.disabled = false; button.textContent = originalText; }
      }
    });
  });
})();


// Premium career-card navigation feedback
(function(){
  document.querySelectorAll('a[href^="#"]').forEach(function(anchor){
    anchor.addEventListener('click',function(){
      const id=this.getAttribute('href');
      if(!id || id.length<2) return;
      const target=document.querySelector(id);
      if(!target) return;
      setTimeout(function(){
        target.classList.add('target-flash');
        setTimeout(function(){target.classList.remove('target-flash');},1300);
      },450);
    });
  });
})();

// Premium careers navigation feedback
(function(){
  const cards = document.querySelectorAll('.premium-role-grid .career-role-card');
  cards.forEach(card => {
    card.addEventListener('click', function(){
      cards.forEach(c => c.classList.remove('is-selected'));
      this.classList.add('is-selected');
      const label = this.getAttribute('data-track') || 'Selected track';
      this.setAttribute('aria-label', label + ' selected. Opening details.');
    });
  });
})();


// Animated counters for trust and impact sections
(function(){
  const counters = document.querySelectorAll('.count-up');
  if(!counters.length) return;
  const run = (el) => {
    const target = Number(el.dataset.count || 0);
    const suffix = el.dataset.suffix || '';
    const duration = 1100;
    const start = performance.now();
    function tick(now){
      const progress = Math.min((now - start) / duration, 1);
      const value = Math.round(target * (1 - Math.pow(1 - progress, 3)));
      el.textContent = value + suffix;
      if(progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  };
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        run(entry.target);
        io.unobserve(entry.target);
      }
    });
  }, {threshold:.45});
  counters.forEach(el=>io.observe(el));
})();

// Careers accordion: keep detail sections clean by opening only one item per group.
(function(){
  document.querySelectorAll('.career10-accordion, .career10-faqgrid').forEach(function(group){
    group.addEventListener('toggle', function(event){
      const item = event.target;
      if(item.tagName !== 'DETAILS' || !item.open) return;
      group.querySelectorAll('details[open]').forEach(function(other){
        if(other !== item) other.removeAttribute('open');
      });
    }, true);
  });
})();


// Certificate Verification (server-side: Reference ID + name, no public PDF folder)
(function(){
  const form=document.getElementById('certificateForm');
  const result=document.getElementById('certificateResult');
  if(!form||!result) return;
  const esc=(s)=>String(s==null?'':s).replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const box=(cls,inner)=>{result.innerHTML='<div class="'+cls+'">'+inner+'</div>';};
  const wa='https://wa.me/919344513642?text=Hello%20Scienwave%20Technologies,%20I%20need%20help%20with%20certificate%20verification.';
  form.addEventListener('submit',async function(e){
    e.preventDefault();
    const ref=(document.getElementById('certificateRef').value||'').trim();
    const name=(document.getElementById('certificateName').value||'').trim();
    const btn=form.querySelector('button[type="submit"]');
    box('certificate-empty','<strong>Checking certificate...</strong><span>Please wait.</span>');
    btn.disabled=true;
    try{
      const r=await fetch('/api/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ref:ref,name:name})});
      const d=await r.json().catch(()=>({}));
      if(r.ok&&d.ok&&d.status==='valid'){
        const rows=[['Holder',d.name],['Reference ID',d.ref],['Program',d.program],['Role',d.role],['Period',d.period],['Issued on',d.issued]].filter(x=>x[1]);
        result.innerHTML='<div class="verified-badge">&#10003; Verified Certificate</div><div class="certificate-detail-grid">'+rows.map(x=>'<div class="certificate-detail"><span>'+esc(x[0])+'</span><strong>'+esc(x[1])+'</strong></div>').join('')+'</div>'+(d.hasPdf&&d.token?'<div class="certificate-actions"><a class="certificate-download" href="/api/certificate?t='+encodeURIComponent(d.token)+'" target="_blank" rel="noopener noreferrer">View certificate copy</a></div><p class="certificate-note">The download link is private to you and expires in 10 minutes.</p>':'<p class="certificate-note">This record is verified. A PDF copy is not stored online for this certificate.</p>');
      }else if(r.ok&&d.status==='revoked'){
        box('certificate-error','<strong>Certificate Revoked</strong><span>'+esc(d.message)+'</span><div class="certificate-actions"><a class="certificate-download secondary" href="'+wa+'" target="_blank" rel="noopener noreferrer">Contact SCIENWAVE</a></div>');
      }else{
        box('certificate-error certificate-public-error','<strong>Could not verify</strong><span>'+esc(d.error||'Please try again.')+'</span><div class="certificate-actions"><a class="certificate-download secondary" href="'+wa+'" target="_blank" rel="noopener noreferrer">Contact SCIENWAVE</a></div>');
      }
    }catch(err){
      box('certificate-error','<strong>Connection problem</strong><span>Please check your internet and try again.</span>');
    }finally{btn.disabled=false;}
  });
})();



// Floating WhatsApp contact (pan-India audience)
(function(){
  if(document.querySelector('.wa-float')) return;
  const a=document.createElement('a');
  a.className='wa-float';a.href='https://wa.me/919344513642?text=Hello%20Scienwave%20Technologies';
  a.target='_blank';a.rel='noopener noreferrer';a.setAttribute('aria-label','Chat with SCIENWAVE on WhatsApp');
  a.innerHTML='<svg aria-hidden="true" viewBox="0 0 32 32"><path fill="currentColor" d="M16.02 3.2A12.74 12.74 0 0 0 5.08 22.46L3.5 28.8l6.5-1.52A12.76 12.76 0 1 0 16.02 3.2Zm0 22.2c-2.02 0-3.9-.6-5.48-1.62l-.38-.24-3.86.9.92-3.76-.25-.39a9.45 9.45 0 1 1 9.05 5.11Zm5.22-7.02c-.29-.15-1.7-.84-1.96-.94-.26-.1-.45-.15-.64.15-.19.28-.74.93-.9 1.12-.17.19-.33.21-.62.07-.29-.15-1.22-.45-2.33-1.44-.86-.77-1.44-1.72-1.61-2-.17-.29-.02-.44.13-.59.13-.13.29-.33.43-.5.14-.17.19-.29.29-.48.1-.19.05-.36-.02-.5-.07-.15-.64-1.55-.88-2.12-.23-.56-.47-.48-.64-.49h-.55c-.19 0-.5.07-.76.36-.26.29-1 1-1 2.43s1.03 2.81 1.18 3c.14.19 2.03 3.1 4.92 4.35.69.3 1.22.48 1.64.61.69.22 1.32.19 1.82.12.55-.08 1.7-.69 1.94-1.36.24-.67.24-1.24.17-1.36-.07-.12-.26-.19-.55-.34Z"/></svg><span>Chat on WhatsApp</span>';
  document.body.appendChild(a);
})();
