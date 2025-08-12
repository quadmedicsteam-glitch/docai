/* script.js — robust offline logic for Quadmedics
   - Improved styling hooks
   - Rule-based assistant with typo autocorrect and fuzzy matching
   - Modular functions and clean, documented code
*/
/* ----------------- Utilities ----------------- */
function esc(s){ return String(s||''); }
function q(sel, root=document){ return root.querySelector(sel); }
function qa(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }
function canonicalKey(s){ return String(s||'').toLowerCase().replace(/[^a-z0-9 ]/g,'').trim(); }

/* ----------------- Knowledge base ----------------- */
const KB = {
  // Core short answers keyed by canonical form
  "headache": "Rest in a quiet dark room, hydrate. Use OTC pain relief if appropriate. Seek urgent care for sudden severe headache, neck stiffness, fever, or neurological signs.",
  "migraine": "Migraine: rest, reduce light/noise, antiemetic for nausea, specific migraine meds if prescribed.",
  "dizziness": "Sit or lie down; hydrate. If recurrent or with fainting, seek medical review.",
  "chest pain": "Chest pain can be serious. If severe, crushing, or with breathlessness/collapse, call emergency services immediately.",
  "seizure": "Protect from injury, do not restrain. Place on side if breathing. Call emergency if first seizure or >5 minutes.",
  "fever": "Rest, fluids, antipyretics for comfort; seek urgent care for very high fever, confusion, or infants.",
  "rash": "Remove irritant, wash area, apply emollients. Seek a dermatologist if spreading, painful, or with systemic symptoms.",
  "allergy": "Antihistamines for mild allergy. For facial/throat swelling or breathing difficulty use epinephrine if available and call emergency.",
  "pharmacy": "Open the Pharmacies page to search nearby pharmacies, see 24/7 options and delivery.",
  "delivery": "Some pharmacies offer delivery. Use the Pharmacies page and call the number shown to confirm.",
  "247": "Certain pharmacies operate 24/7. Use the Pharmacies page to view demo 24/7 listings.",
  "emergency": "Emergency numbers are on the Hotlines page. Call emergency services for life-threatening events."
};

/* Expand KB with synonyms and more entries programmatically */
Object.assign(KB, {
  "nausea": "Sip clear fluids, try ginger or antiemetic if available. Seek help if prolonged or with dehydration.",
  "stomach ache": "Rest, hydrate, avoid solid food for a few hours. Seek care for severe pain, vomiting, fever or blood in stool.",
  "joint pain":"Rest, ice, compression and elevation for acute injury. See orthopedist for persistent or mechanical pain.",
  "fracture":"Immobilize, avoid movement and seek emergency care or orthopedics.",
  "red eye":"Avoid rubbing, use lubricating drops; urgent eye care if vision changes or severe pain.",
  "blurry vision":"Rest eyes and seek prompt eye assessment if sudden or persistent."
});

/* ----------------- Typo autocorrect & fuzzy matching ----------------- */
/* Levenshtein distance (optimized iterative) */
function levenshtein(a,b){
  if(a===b) return 0;
  a = a||''; b = b||'';
  const al = a.length, bl = b.length;
  if(al===0) return bl; if(bl===0) return al;
  let v0 = new Array(bl+1), v1 = new Array(bl+1);
  for(let j=0;j<=bl;j++) v0[j]=j;
  for(let i=0;i<al;i++){
    v1[0]=i+1;
    for(let j=0;j<bl;j++){
      const cost = a[i]===b[j] ? 0 : 1;
      v1[j+1] = Math.min(v1[j]+1, v0[j+1]+1, v0[j]+cost);
    }
    [v0,v1]=[v1,v0];
  }
  return v0[bl];
}

/* Find best match among KB keys, returns {key,score,normalizedInput} */
function findBestKBMatch(input){
  const norm = canonicalKey(input);
  if(!norm) return null;
  // exact
  if(KB[norm]) return {key:norm,score:0, norm};
  // distance scoring
  const keys = Object.keys(KB);
  let best = {key:null,score:Infinity};
  for(const k of keys){
    const d = levenshtein(norm,k);
    if(d < best.score){ best = {key:k, score:d}; }
  }
  // also check substrings
  for(const k of keys){
    if(norm.includes(k) || k.includes(norm)){ best = {key:k, score: Math.min(best.score,0)}; break; }
  }
  return best.key ? {...best, norm} : null;
}

/* ----------------- Navigation intent detection ----------------- */
function detectNavigationIntent(s){
  s=(s||'').toLowerCase();
  if(!s) return null;
  if(/\bpharm(acy|acies|)\b/.test(s) || s.includes('nearest') && s.includes('pharm')) return 'pharmacy';
  if(/\bhot(lines|line)?\b/.test(s) || s.includes('ambulance') || s.includes('emergency')) return 'hotlines';
  if(/\b(body|head|chest|abdomen|limb|skin)\b/.test(s)) return 'body';
  if(/\b(specialist|cardio|neuro|ortho|derma|pediatric|psychiatrist|ophthalmologist|gastro|ent)\b/.test(s)) return 'specialists';
  if(s.includes('delivery')) return 'pharmacy-delivery';
  if(s.includes('24/7')||s.includes('247')||s.includes('open 24')) return 'pharmacy-24';
  return null;
}

/* ----------------- Assistant engine ----------------- */
const Assistant = {
  history: [], // {role:'user'|'assistant', text, timestamp}
  push(role,text){ this.history.push({role,text,timestamp:Date.now()}); this.renderOne(role,text); },
  renderOne(role,text){
    // if chat area exists render
    const chat = q('#chat') || q('#companion-response') || q('#companion-response-page');
    if(!chat) return;
    const el = document.createElement('div');
    el.className = 'msg ' + (role==='user' ? 'user' : 'bot');
    el.innerText = text;
    chat.appendChild(el);
    chat.scrollTop = chat.scrollHeight;
  },
  answer(rawInput){
    if(!rawInput) return {text:"Please ask about a symptom, 'pharmacy', 'hotlines' or 'which specialist to see.'", anchors:[]};
    const nav = detectNavigationIntent(rawInput);
    if(nav){
      switch(nav){
        case 'pharmacy': return {text:KB['pharmacy']||'Open Pharmacies page.', anchors:['pharmacies.html']};
        case 'hotlines': return {text:KB['emergency']||'See Hotlines page.', anchors:['hotlines.html']};
        case 'body': return {text:'Open Body Sections to select an area for quick guidance.', anchors:['body-sections.html']};
        case 'specialists': return {text:'Open Specialists to browse doctors and common problems.', anchors:['specialists.html']};
        case 'pharmacy-delivery': return {text:KB['delivery']||'Delivery info on Pharmacies page.', anchors:['pharmacies.html']};
        case 'pharmacy-24': return {text:KB['247']||'24/7 options available in Pharmacies.', anchors:['pharmacies.html']};
      }
    }
    // find best KB match
    const match = findBestKBMatch(rawInput);
    if(match && KB[match.key]){
      // compute confidence by edit distance relative to input length
      const conf = Math.max(0, 1 - (match.score / Math.max(match.norm.length,1)));
      const suggestion = conf < 0.65 ? `Did you mean "${match.key}"?` : null;
      const text = (suggestion ? suggestion + ' ' : '') + KB[match.key];
      const anchors = ['body-sections.html','specialists.html']; // general anchors for health topics
      // if match points to pages like pharmacy/hotlines add specific anchor
      if(['pharmacy','delivery','247'].includes(match.key)) anchors.unshift('pharmacies.html');
      if(['emergency','poison','mental health','blood bank','child helpline','women helpline'].includes(match.key)) anchors.unshift('hotlines.html');
      return {text, anchors, confidence:conf};
    }

    // heuristic specialist mapper
    const l = rawInput.toLowerCase();
    const mapping = [
      {keywords:['headache','dizzy','migraine','seizure'], spec:'Neurologist','page':'specialists.html'},
      {keywords:['chest','palpit','heart','shortness of breath','sob'], spec:'Cardiologist','page':'specialists.html'},
      {keywords:['stomach','abdomen','nausea','vomit'], spec:'Gastroenterologist','page':'specialists.html'},
      {keywords:['joint','sprain','fracture','back'], spec:'Orthopedist','page':'specialists.html'},
      {keywords:['skin','rash','acne','eczema','burn'], spec:'Dermatologist','page':'specialists.html'},
      {keywords:['eye','vision','red eye','blurry'], spec:'Ophthalmologist','page':'specialists.html'},
      {keywords:['throat','ear','nose','sinus'], spec:'ENT','page':'specialists.html'},
      {keywords:['child','baby','pediatric'], spec:'Pediatrician','page':'specialists.html'}
    ];
    for(const m of mapping){
      for(const kw of m.keywords){
        if(l.includes(kw)){
          return {text:`Suggested specialist: ${m.spec}. See Specialists page.`, anchors:[m.page]};
        }
      }
    }

    // fallback
    return {text:"I couldn't find an exact match. Try 'pharmacy', 'hotlines', a symptom (e.g., 'headache'), or ask which specialist to see.", anchors:[]};
  },
  clear(){ this.history.length=0; const chat=q('#chat'); if(chat) chat.innerHTML=''; }
};

/* ----------------- Page-specific UI wiring ----------------- */
document.addEventListener('DOMContentLoaded', ()=>{
  // render specialists on pages that have #specialist-list
  if(q('#specialist-list')) renderSpecialists();

  // wire up companion page controls (if present)
  const compSend = q('#comp-send');
  if(compSend){
    compSend.addEventListener('click', ()=>{
      const input = q('#comp-input').value.trim();
      if(!input) return Assistant.push('assistant',"Try asking: 'headache', 'nearest pharmacy'.");
      Assistant.push('user', input);
      const res = Assistant.answer(input);
      Assistant.push('assistant', res.text + (res.anchors && res.anchors.length ? ' · See: ' + res.anchors.join(', ') : ''));
      // suggest opening pages by adding small links in the chat
      if(res.anchors && res.anchors.length){
        // add clickable anchors
        const chat = q('#chat');
        const wrap = document.createElement('div');
        wrap.style.margin='6px 0 12px 0';
        res.anchors.forEach(a => {
          const link = document.createElement('a');
          link.href = a;
          link.innerText = a.replace('.html','').replace('-',' ');
          link.style.display='inline-block';
          link.style.marginRight='8px';
          link.style.color='var(--brand1)';
          wrap.appendChild(link);
        });
        chat.appendChild(wrap);
        chat.scrollTop = chat.scrollHeight;
      }
      q('#comp-input').value='';
    });
    // export history
    q('#comp-export').addEventListener('click', ()=>{
      const content = Assistant.history.map(h=>`${new Date(h.timestamp).toLocaleString()} [${h.role}]: ${h.text}`).join('\n\n');
      const blob = new Blob([content], {type:'text/plain'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'QuadMedics_companion_history.txt'; a.click();
      URL.revokeObjectURL(url);
    });
    qa('.chip').forEach(el=> el.addEventListener('click', ()=>{
      const s = el.dataset.suggest;
      q('#comp-input').value = s;
      compSend.click();
    }));
    q('#btn-clear-history') && q('#btn-clear-history').addEventListener('click', ()=> Assistant.clear());
    q('#btn-open-pharm') && q('#btn-open-pharm').addEventListener('click', ()=> location.href='pharmacies.html');
  }

  // floating companion for every page (small widget)
  setupFloatingCompanion();

  // wire quick search on homepage
  if(q('.search-quick')){
    window.quickSearch = function(e){
      if(e && e.preventDefault) e.preventDefault();
      const v = q('#quick').value.trim();
      if(!v) return;
      const res = Assistant.answer(v);
      // push to floating companion (if present)
      if(window.floatingCompanion && typeof window.floatingCompanion.showResponse === 'function'){
        window.floatingCompanion.push('user', v);
        window.floatingCompanion.push('assistant', res.text);
      } else {
        alert(res.text + (res.anchors && res.anchors.length ? "\n\nSee: "+res.anchors.join(', ') : ''));
      }
      q('#quick').value='';
    };
  }
});

/* ----------------- Specialists rendering (shared) ----------------- */
const SPECIALISTS = [
  {name:"Neurologist (Brain & Nerves)", key:"neurologist", problems:[{n:"Seizure",s:"Ensure safety; call emergency if prolonged."},{n:"Stroke symptoms",s:"Call emergency immediately; note time of onset."}]},
  {name:"Cardiologist (Heart)", key:"cardiologist", problems:[{n:"Chest pain",s:"Severe chest pain needs emergency assessment."},{n:"Palpitations",s:"Rest and arrange cardiology review if recurrent."}]},
  {name:"Gastroenterologist (Digestive)", key:"gastroenterologist", problems:[{n:"Abdominal pain",s:"See gastroenterology if recurrent or severe."}]},
  {name:"Orthopedist (Bones & Joints)", key:"orthopedist", problems:[{n:"Fracture",s:"Immobilize and seek urgent care."}]},
  {name:"Dermatologist (Skin)", key:"dermatologist", problems:[{n:"Rash",s:"Topical care; see dermatologist if spreading."}]},
  {name:"Pediatrician (Children)", key:"pediatrician", problems:[{n:"High fever in child",s:"Seek urgent review for infants or very high fever."}]},
  {name:"Psychiatrist (Mental Health)", key:"psychiatrist", problems:[{n:"Depression",s:"Seek mental health support; urgent if suicidal."}]},
  {name:"Ophthalmologist (Eyes)", key:"ophthalmologist", problems:[{n:"Eye injury",s:"Cover and seek immediate ophthalmology care."}]},
  {name:"ENT (Ear Nose Throat)", key:"ent", problems:[{n:"Severe sore throat",s:"Assess for airway compromise; see ENT/GP."}]}
];
function renderSpecialists(){
  const list = q('#specialist-list');
  if(!list) return;
  list.innerHTML='';
  SPECIALISTS.forEach(spec=>{
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.innerText = spec.name;
    btn.addEventListener('click', ()=> showSpecialistProblems(spec.key));
    li.appendChild(btn);
    list.appendChild(li);
  });
}
function showSpecialistProblems(key){
  const spec = SPECIALISTS.find(s=>s.key===key);
  const sol = q('#specialist-solution');
  if(!spec || !sol) return;
  let html = `<strong>${spec.name} — Common reasons:</strong><ul class="specialist-problems-list">`;
  spec.problems.forEach((p,i)=> html += `<li><button onclick="showSpecialistSolution('${key}',${i})">${p.n}</button></li>`);
  html += `</ul><div id="specialist-problem-solution"></div>`;
  sol.innerHTML = html;
  sol.style.display='block';
}
function showSpecialistSolution(key, idx){
  const spec = SPECIALISTS.find(s=>s.key===key);
  const div = q('#specialist-problem-solution');
  if(!spec || !div) return;
  const prob = spec.problems[idx];
  div.innerHTML = `<div class="specialist-problem-solution"><b>${prob.n}:</b> ${prob.s}</div>`;
}

/* ----------------- Pharmacy demo functions (shared) ----------------- */
function findPharmacies(e){
  if(e && e.preventDefault) e.preventDefault();
  const list = q('#pharmacy-list');
  if(!list) return;
  list.innerHTML = `<div>Searching (demo)...</div>`;
  setTimeout(()=>{
    list.innerHTML = `
      <ul>
        <li><strong>HealthPlus Pharmacy</strong> — 0.5 km — Services: 24/7, Delivery, Cold-chain handling
          <div class="pharmacy-actions"><button onclick="window.open('tel:01234567890')">Call</button><button onclick="window.open('https://maps.google.com/?q=HealthPlus+Pharmacy')">Directions</button></div>
        </li>
        <li><strong>CityCare Pharmacy</strong> — 1.2 km — Services: 24/7, Home delivery
          <div class="pharmacy-actions"><button onclick="window.open('tel:01122334455')">Call</button></div>
        </li>
      </ul>
      <small class="muted">Demo results — replace with real API for live data.</small>
    `;
  },600);
}
function useCurrentLocation(){ const list=q('#pharmacy-list'); if(!list) return; list.innerHTML='Detecting location...'; if(!navigator.geolocation){ list.innerHTML='Geolocation not supported — showing demo.'; setTimeout(findPharmacies,500); return; } navigator.geolocation.getCurrentPosition(pos=>{ const lat=pos.coords.latitude.toFixed(4), lon=pos.coords.longitude.toFixed(4); list.innerHTML=`<div>Location: ${lat}, ${lon} (demo)</div>`; setTimeout(findPharmacies,300); }, ()=>{ list.innerHTML='Unable to get location — showing demo'; setTimeout(findPharmacies,300); }, {timeout:7000}); }
function showPharmacy24(){ const list=q('#pharmacy-list'); if(!list) return; list.innerHTML=`<ul><li><strong>CityCare Pharmacy</strong> — 24/7</li><li><strong>Al-Ahram Pharmacy</strong> — 24/7</li></ul>`; }
function showPharmacyDelivery(){ const list=q('#pharmacy-list'); if(!list) return; list.innerHTML=`<ul><li><strong>HealthPlus Pharmacy</strong> — Delivery (call ahead)</li></ul>`; }

/* ----------------- Floating companion UI (small widget) ----------------- */
function setupFloatingCompanion(){
  // Only create once
  if(window.floatingCompanion) return;
  const fab = document.createElement('button');
  fab.className='companion-fab';
  fab.setAttribute('aria-label','Open Quadmedics Companion');
  fab.style.position='fixed'; fab.style.right='18px'; fab.style.bottom='18px'; fab.style.zIndex=9999;
  fab.style.width='56px'; fab.style.height='56px'; fab.style.borderRadius='50%'; fab.style.background='linear-gradient(90deg,var(--brand2),var(--accent))';
  fab.style.border='none'; fab.style.fontSize='22px'; fab.style.cursor='pointer';
  fab.innerText='🤖';
  document.body.appendChild(fab);

  const box = document.createElement('div');
  box.className='companion'; box.style.position='fixed'; box.style.right='18px'; box.style.bottom='86px'; box.style.width='380px'; box.style.maxWidth='92vw';
  box.style.background='linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))'; box.style.padding='12px'; box.style.borderRadius='12px'; box.style.boxShadow='0 10px 30px rgba(0,0,0,0.4)'; box.style.display='none'; box.style.zIndex=9999;
  box.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;">
      <div style="font-weight:700">Quadmedics Companion</div>
      <div><button id="comp-close" style="background:transparent;border:none;color:var(--muted);cursor:pointer">✕</button></div>
    </div>
    <div id="comp-chat" class="comp-chat" style="min-height:120px;max-height:280px;overflow:auto;padding:8px;border-radius:8px;background:rgba(0,0,0,0.04)"></div>
    <div style="display:flex;gap:8px;margin-top:8px;">
      <input id="comp-input-mini" placeholder="e.g. headache, nearest pharmacy" style="flex:1;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.04)">
      <button id="comp-send-mini" style="padding:8px 10px;border-radius:8px;background:var(--brand1);border:none;cursor:pointer">Ask</button>
    </div>
  `;
  document.body.appendChild(box);

  // attach behavior
  const compChat = box.querySelector('#comp-chat');
  document.getElementById && document.getElementById('comp-send-mini') && document.getElementById('comp-send-mini'); // no-op to satisfy linter-like checks
  fab.addEventListener('click', ()=>{ box.style.display = box.style.display==='none' ? 'block' : 'none'; if(box.style.display==='block'){ q('#comp-input-mini').focus(); } });
  box.querySelector('#comp-close').addEventListener('click', ()=> box.style.display='none');

  box.querySelector('#comp-send-mini').addEventListener('click', ()=>{
    const v = q('#comp-input-mini').value.trim();
    if(!v) return;
    // render user
    const uel = document.createElement('div'); uel.className='msg user'; uel.innerText=v; compChat.appendChild(uel);
    compChat.scrollTop = compChat.scrollHeight;
    // assistant answer
    const res = Assistant.answer(v);
    const ael = document.createElement('div'); ael.className='msg bot'; ael.innerText = res.text;
    compChat.appendChild(ael);
    compChat.scrollTop = compChat.scrollHeight;
    // anchors quick view
    if(res.anchors && res.anchors.length){
      const wrap = document.createElement('div'); wrap.style.marginTop='6px';
      res.anchors.forEach(a=>{
        const link = document.createElement('a'); link.href=a; link.innerText = a.replace('.html','').replace('-',' '); link.style.marginRight='8px'; link.style.color='var(--brand1)';
        wrap.appendChild(link);
      });
      compChat.appendChild(wrap);
    }
    q('#comp-input-mini').value='';
  });

  window.floatingCompanion = {
    push(role, text){ const el = document.createElement('div'); el.className = 'msg ' + (role==='user'?'user':'bot'); el.innerText = text; compChat.appendChild(el); compChat.scrollTop = compChat.scrollHeight; },
    showResponse(res){ /*not used*/ }
  };
}

/* ----------------- Accessibility helpers ----------------- */
// Allow Enter key on document-wide for small inputs
document.addEventListener('keydown', (e)=>{
  if(e.key==='/' && document.activeElement.tagName!=='INPUT' && document.activeElement.tagName!=='TEXTAREA'){ e.preventDefault(); const el=q('#quick'); if(el){ el.focus(); } }
});

/* End of script.js */

