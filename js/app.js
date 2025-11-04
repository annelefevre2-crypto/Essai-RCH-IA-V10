(()=>{
  const t = (k)=> window.I18N?.t(k) || k;
  const cameraBtn=document.getElementById('cameraBtn'), scanBtn=document.getElementById('scanBtn'),
        geoBtn=document.getElementById('geoBtn'), resetBtn=document.getElementById('resetBtn'),
        videoEl=document.getElementById('camera'), qrFile=document.getElementById('qrFile'),
        dynFields=document.getElementById('dynamicFields'), compiledPrompt=document.getElementById('compiledPrompt'),
        infosEl=document.getElementById('infosComplementaires'), ficheMeta=document.getElementById('ficheMeta'),
        iaButtons=document.getElementById('iaButtons'), zipBtn=document.getElementById('zipBtn');
  let detector=null, state={ qr:null, stream:null, capturedPhotos:{}, gps:null };
  const toast=(m)=>alert(m);

  function resetAll(){
    if(state.stream){ state.stream.getTracks().forEach(t=>t.stop()); state.stream=null; }
    videoEl.classList.remove('hidden'); dynFields.innerHTML=''; compiledPrompt.value=''; infosEl.textContent='';
    ficheMeta.textContent='Catégorie – Titre – Version du QR code flashé'; iaButtons.innerHTML='';
    state={ qr:null, stream:null, capturedPhotos:{}, gps:null };
  }

  function parseJSONSafe(s){ try{return JSON.parse(s);}catch(e){ toast('JSON invalide.'); return null; } }

  function updateFicheMeta(){
    const q=state.qr; if(!q) return;
    ficheMeta.textContent = `${q.categorie||'–'} – ${q.titre_fiche||'–'} – ${q.version||'–'}`;
  }

  function updateInfosComplementaires(){
    const q=state.qr; if(!q) return;
    const refs = Array.isArray(q.references_bibliographiques)? q.references_bibliographiques.join(', ')
                : (Array.isArray(q.refs)? q.refs.join(', ') : '');
    const suivi = q.infos_complementaires || q.commentaires || '';
    const objectif = q.objectif ? `Objectif: ${q.objectif}\n` : '';
    const refsTxt = refs ? `Références: ${refs}\n` : '';
    infosEl.textContent = `${objectif}${refsTxt}${suivi}`.trim();
  }

  // Camera robust activation
  async function ensureCamera(){
    const isSecure = window.isSecureContext || location.hostname === 'localhost';
    if(!isSecure){ toast(t('cannotAccessCamera')); return; }
    if(!navigator.mediaDevices?.getUserMedia){ toast(t('cannotAccessCamera')); return; }
    if(state.stream) return;
    videoEl.setAttribute('playsinline',''); videoEl.muted = true;
    try{
      state.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal:'environment' } }, audio:false });
      videoEl.srcObject = state.stream;
      try{ await videoEl.play(); }catch(_){}
    }catch(e){ toast(t('cannotAccessCamera') + '\n' + (e.message||'')); }
  }
  cameraBtn.addEventListener('click', ensureCamera);

  // QR detect loop
  async function detectLoop(){
    if (!('BarcodeDetector' in window)) { toast(t('noBarcode')); return; }
    if (!detector) detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    for (let i=0;i<300;i++){
      if (!videoEl.srcObject) break;
      const bmp = await createImageBitmap(videoEl);
      try{
        const codes = await detector.detect(bmp);
        if (codes && codes.length) { handleQrRaw(codes[0].rawValue); break; }
      }catch(e){}
      await new Promise(r=>setTimeout(r,30));
    }
  }
  scanBtn.addEventListener('click', async()=>{ await ensureCamera(); await new Promise(r=>setTimeout(r,180)); detectLoop(); });

  // File import (image QR only)
  document.getElementById('qrFile').addEventListener('change', async e=>{
    const file=e.target.files?.[0]; if(!file) return;
    if (!('BarcodeDetector' in window)) return toast(t('noBarcode'));
    const bmp = await createImageBitmap(file);
    if (!detector) detector = new window.BarcodeDetector({ formats:['qr_code'] });
    const codes = await detector.detect(bmp);
    if (codes && codes.length) handleQrRaw(codes[0].rawValue); else toast(t('noQrInImage'));
  });

  function createField(f){
    const wrap=document.createElement('div'); wrap.className='field';
    const lab=document.createElement('label'); lab.htmlFor=f.id; lab.textContent=f.label+(f.obligatoire?' *':''); wrap.appendChild(lab);
    let input;
    switch(f.type){
      case 'text': case 'number': case 'date': case 'time': case 'datetime':
        input=document.createElement('input'); input.type=(f.type==='datetime')?'datetime-local':f.type; input.id=f.id; wrap.appendChild(input); break;
      case 'textarea':
        input=document.createElement('textarea'); input.id=f.id; input.rows=f.rows||3; wrap.appendChild(input); break;
      case 'radio':
        input=document.createElement('div'); (f.options||[]).forEach((opt,i)=>{ const id=`${f.id}_${i}`;
          const r=document.createElement('input'); r.type='radio'; r.name=f.id; r.id=id; r.value=opt.value;
          const l=document.createElement('label'); l.htmlFor=id; l.textContent=opt.label; l.style.marginRight='10px';
          input.appendChild(r); input.appendChild(l); }); wrap.appendChild(input); break;
      case 'multiselect':
        input=document.createElement('select'); input.id=f.id; input.multiple=true;
        (f.options||[]).forEach(opt=>{ const o=document.createElement('option'); o.value=opt.value; o.textContent=opt.label; input.appendChild(o); });
        wrap.appendChild(input); break;
      case 'select':
        input=document.createElement('select'); input.id=f.id;
        (f.options||[]).forEach(opt=>{ const o=document.createElement('option'); o.value=opt.value; o.textContent=opt.label; input.appendChild(o); });
        wrap.appendChild(input); break;
      case 'gps':
        input=document.createElement('div'); input.id=f.id; input.textContent=t('gpsNotAcquired'); wrap.appendChild(input); break;
      case 'photo':
        input=document.createElement('input'); input.type='file'; input.accept='image/*'; input.capture='environment'; input.id=f.id;
        input.addEventListener('change', e=>{ const file=e.target.files?.[0]; if(file) state.capturedPhotos[f.id]=file; }); wrap.appendChild(input); break;
      default:
        input=document.createElement('input'); input.type='text'; input.id=f.id; wrap.appendChild(input);
    } dynFields.appendChild(wrap);
  }
  function renderFields(){ dynFields.innerHTML=''; (state.qr.champs_entree||state.qr.fields||[]).forEach(createField); }

  function getFieldValue(f){
    if(f.type==='gps') return state.gps? `${state.gps.lat}, ${state.gps.lon} (±${Math.round(state.gps.accuracy)} m)` : '';
    if(f.type==='radio'){ const sel=dynFields.querySelector(`input[name="${f.id}"]:checked`); return sel? sel.value : ''; }
    if(f.type==='multiselect'){ const el=document.getElementById(f.id); return Array.from(el.selectedOptions).map(o=>o.value).join(', '); }
    const el=document.getElementById(f.id); return el && el.value ? el.value : '';
  }

  function compilePrompt(){
    if(!state.qr) return '';
    const fields = (state.qr.champs_entree || state.qr.fields || []);
    const values={}; fields.forEach(f=> values[f.id]=getFieldValue(f));
    let template=state.qr.prompt || state.qr.p || '';
    Object.entries(values).forEach(([k,v])=>{ const re=new RegExp(`{{\\s*${k}\\s*}}`,'gi'); template=template.replace(re, v||''); });
    const bloc=Object.entries(values).filter(([,v])=>v && v.toString().trim()!=='').map(([k,v])=>`- ${k}: ${v}`).join('\n');
    const refs = Array.isArray(state.qr.references_bibliographiques)? state.qr.references_bibliographiques.join(', ')
                : (Array.isArray(state.qr.refs)? state.qr.refs.join(', ') : '');
    const header=[`# Fiche: ${state.qr.titre_fiche||''} (${state.qr.version||''}) – Catégorie: ${state.qr.categorie||''}`, refs?`# Références: ${refs}`:''].filter(Boolean).join('\n');
    const full=[header, template, '', '# Données saisies', bloc].join('\n').trim();
    compiledPrompt.value=full; return full;
  }
  dynFields.addEventListener('input', compilePrompt);

  function openIA(key, meta){
    const prompt=compilePrompt();
    const url=(meta.url && meta.url.replace('%q%', encodeURIComponent(prompt))) || `https://chat.openai.com/?q=${encodeURIComponent(prompt)}`;
    createBundle(true); window.open(url, '_blank');
    if(meta.client_uri){ setTimeout(()=> window.location.href=meta.client_uri.replace('%q%', encodeURIComponent(prompt)), 300); }
  }
  function renderIABtns(){
    iaButtons.innerHTML=''; const q=state.qr; if(!q) return;
    const table = q.ia_cotation || q.ia || {};
    Object.entries(table).forEach(([key, metaOrScore])=>{
      const meta = (typeof metaOrScore === 'number') ? {score:metaOrScore, label:key} : metaOrScore;
      const score = Number(meta.score||0);
      if (score<=1) return;
      const b=document.createElement('button'); b.className='ia-btn '+(score===3?'green':'orange');
      b.textContent=(meta.label||key)+(meta.paid?(' '+t('paidVersion')):'');
      b.addEventListener('click', ()=> openIA(key, meta)); iaButtons.appendChild(b);
    });
  }

  // Geolocation
  geoBtn.addEventListener('click', ()=>{
    if(!('geolocation' in navigator)) return toast('Géolocalisation non disponible.');
    navigator.geolocation.getCurrentPosition(pos=>{
      const {latitude, longitude, accuracy}=pos.coords; state.gps={lat:latitude, lon:longitude, accuracy};
      (state.qr?.champs_entree||state.qr.fields||[]).forEach(f=>{ if(f.type==='gps'){ const el=document.getElementById(f.id); if(el) el.textContent=`${latitude}, ${longitude} (±${Math.round(accuracy)} m)`; }});
      compilePrompt();
    }, err=> toast(t('geolocFail')+err.message), {enableHighAccuracy:true, timeout:10000});
  });

  function handleQrRaw(raw){
    let jsonStr=raw;
    try{ if(raw.startsWith('data:application/json')){ const b64=raw.split(',')[1]; jsonStr=atob(b64); } }catch(_){}
    const obj=parseJSONSafe(jsonStr); if(!obj) return;
    state.qr=obj; updateFicheMeta(); updateInfosComplementaires(); renderFields(); compilePrompt(); renderIABtns();
  }

  // Wire scan loop
  async function detectLoop(){
    if (!('BarcodeDetector' in window)) { toast(t('noBarcode')); return; }
    if (!detector) detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    for (let i=0;i<300;i++){
      if (!videoEl.srcObject) break;
      const bmp = await createImageBitmap(videoEl);
      try{
        const codes = await detector.detect(bmp);
        if (codes && codes.length) { handleQrRaw(codes[0].rawValue); break; }
      }catch(e){}
      await new Promise(r=>setTimeout(r,30));
    }
  }
  document.getElementById('scanBtn').addEventListener('click', async()=>{ await ensureCamera(); await new Promise(r=>setTimeout(r,180)); detectLoop(); });
  cameraBtn.addEventListener('click', ensureCamera);

  // Image import detection
  document.getElementById('qrFile').addEventListener('change', async e=>{
    const file=e.target.files?.[0]; if(!file) return;
    if (!('BarcodeDetector' in window)) return toast(t('noBarcode'));
    const bmp = await createImageBitmap(file);
    if (!detector) detector = new window.BarcodeDetector({ formats:['qr_code'] });
    const codes = await detector.detect(bmp);
    if (codes && codes.length) handleQrRaw(codes[0].rawValue); else toast(t('noQrInImage'));
  });

  // Clipboard + bundle
  document.getElementById('copyPromptBtn').addEventListener('click', ()=>{
    compilePrompt(); navigator.clipboard.writeText(compiledPrompt.value).then(()=>toast(t('promptCopied')));
  });
  function createBundle(silent=false){
    const parts=['--- prompt.txt ---\n', compiledPrompt.value+'\n\n'];
    Object.entries(state.capturedPhotos).forEach(([id,file],i)=>{ parts.push(`--- ${file.name or 'photo_'+(i+1)+'.jpg'} : joignez ce fichier manuellement ---\n`); });
    const blob=new Blob(parts,{type:'text/plain'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='bundle_prompt_pieces_jointes.txt'; a.click(); if(!silent) toast(t('zipReady')); }
  zipBtn.addEventListener('click', ()=> createBundle(false));

  // Init
  resetBtn.addEventListener('click', resetAll);
  resetAll();
})();