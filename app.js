/* Old Milton Coffee Co. — demo app.js
   - Hours badge (open/closed), live status dot
   - Menu filters & collapse toggles
   - Cart, tip, totals, quick add
   - GA4 event stubs via data attributes
   - IntersectionObserver reveal
   - Respect prefers-reduced-motion
*/

const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------- GA4 stub ----------------
function track(event, payload = {}) {
  // Stubbed 'send to GA4' — replace with gtag() in production
  console.log('[GA4]', event, payload);
}

function bindEventTracking() {
  document.querySelectorAll('[data-event]').forEach(el => {
    el.addEventListener('click', () => {
      const payload = {
        section: el.dataset.section,
        label: el.dataset.label,
        product: el.dataset.product,
      };
      track(el.dataset.event, payload);
    });
  });
}
bindEventTracking();

// ---------------- Hours / Open status ----------------
async function computeOpenStatus() {
  try {
    const res = await fetch('./assets/hours.json', {cache: 'no-store'});
    const data = await res.json();
    const now = new Date();
    // Convert now to Atlanta time by assuming local; simple for demo.
    const day = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][now.getDay()];
    const info = data.hours[day];
    const [oH, oM] = info.open.split(':').map(Number);
    const [cH, cM] = info.close.split(':').map(Number);
    const openTime = new Date(now); openTime.setHours(oH,oM,0,0);
    const closeTime = new Date(now); closeTime.setHours(cH,cM,0,0);

    const isOpen = now >= openTime && now <= closeTime;

    const dot = document.getElementById('openDot');
    const text = document.getElementById('openText');
    const badge = document.getElementById('openUntil');

    if (dot) {
      dot.classList.remove('bg-gray-400');
      dot.classList.add(isOpen ? 'bg-moss' : 'bg-brick');
      if (!prefersReduced) dot.classList.add('animate-pulseDot');
      dot.setAttribute('aria-label', isOpen ? 'Open' : 'Closed');
    }
    if (text) text.textContent = isOpen ? 'Open now' : 'Closed for today';

    const fmt = (d) => {
      const hour = d.getHours();
      const mins = String(d.getMinutes()).padStart(2,'0');
      const h12 = ((hour + 11) % 12) + 1;
      const ampm = hour >= 12 ? 'PM' : 'AM';
      return `${h12}:${mins} ${ampm}`.replace(':00','');
    };
    if (badge) badge.textContent = `Today: ${fmt(openTime)}–${fmt(closeTime)}`;
  } catch (e) {
    console.warn('Hours status failed', e);
  }
}
computeOpenStatus();

// ---------------- Intersection Observer reveals ----------------
function setupReveals() {
  if (prefersReduced) return;
  const els = document.querySelectorAll('section, .reveal');
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if (entry.isIntersecting) {
        entry.target.classList.add('opacity-100','translate-y-0');
        io.unobserve(entry.target);
      }
    });
  }, {threshold: 0.1});
  els.forEach(el=>{
    el.classList.add('opacity-0','translate-y-2','transition','duration-300');
    io.observe(el);
  });
}
setupReveals();

// ---------------- Filter pills ----------------
function setupFilters() {
  const pills = document.querySelectorAll('.filter-pill');
  const items = document.querySelectorAll('.menu-item');
  pills.forEach(p=>{
    p.addEventListener('click', ()=>{
      pills.forEach(x=>{
        x.classList.remove('bg-cocoa','text-oat');
        x.classList.add('bg-white');
        x.setAttribute('aria-selected','false');
      });
      p.classList.add('bg-cocoa','text-oat');
      p.classList.remove('bg-white');
      p.setAttribute('aria-selected','true');
      const filter = p.dataset.filter;
      items.forEach(it=>{
        const tags = (it.dataset.tags || '').split(' ');
        it.style.display = (filter === 'all' || tags.includes(filter)) ? '' : 'none';
      });
    });
  });
}
setupFilters();

// ---------------- Collapse toggles ----------------
document.querySelectorAll('.collapse-toggle').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const id = btn.getAttribute('aria-controls');
    const target = document.getElementById(id);
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!expanded));
    target.hidden = expanded;
  });
});

// ---------------- Cart logic ----------------
const cart = {
  items: [],
  tipRate: 0,
  add(name, price) {
    const existing = this.items.find(i=>i.name===name);
    if (existing) existing.qty += 1;
    else this.items.push({name, price: Number(price), qty: 1});
    this.render();
    track('add_to_order', {product: name});
  },
  update(name, qty) {
    const item = this.items.find(i=>i.name===name);
    if (item) {
      item.qty = Math.max(0, qty);
      if (item.qty === 0) this.items = this.items.filter(i=>i !== item);
      this.render();
    }
  },
  subtotal() {
    return this.items.reduce((s,i)=>s + i.price * i.qty, 0);
  },
  tip() { return this.subtotal() * this.tipRate; },
  total() { return this.subtotal() + this.tip(); },
  render() {
    const ul = document.getElementById('cartItems');
    ul.innerHTML = '';
    this.items.forEach(item=>{
      const li = document.createElement('li');
      li.className = 'py-2 flex items-center justify-between';
      li.innerHTML = `
        <span>${item.name} <span class="text-sm text-neutral-500">x${item.qty}</span></span>
        <div class="flex items-center gap-2">
          <button class="px-2 py-1 border rounded" aria-label="Decrease">-</button>
          <button class="px-2 py-1 border rounded" aria-label="Increase">+</button>
          <span>$${(item.price*item.qty).toFixed(2)}</span>
        </div>
      `;
      const [dec, inc] = li.querySelectorAll('button');
      dec.addEventListener('click', ()=>this.update(item.name, item.qty-1));
      inc.addEventListener('click', ()=>this.update(item.name, item.qty+1));
      ul.appendChild(li);
    });
    document.getElementById('subtotal').textContent = `$${this.subtotal().toFixed(2)}`;
    document.getElementById('tipAmount').textContent = `$${this.tip().toFixed(2)}`;
    document.getElementById('total').textContent = `$${this.total().toFixed(2)}`;
    const payBtn = document.getElementById('payBtn');
    payBtn.disabled = this.items.length === 0;
    payBtn.textContent = `Pay $${this.total().toFixed(2)}`;
    // Sync quick-add counters
    syncQuickAdd();
  }
};

// Bind "Add" buttons in menu
document.querySelectorAll('.add-btn').forEach(btn=>{
  btn.addEventListener('click', ()=> cart.add(btn.dataset.name, btn.dataset.price));
});

// Quick Add in sidebar
function buildQuickAdd() {
  const quick = document.getElementById('quickAdd');
  document.querySelectorAll('.add-btn').forEach(btn=>{
    const wrap = document.createElement('div');
    wrap.className = 'flex items-center justify-between border border-neutral-200 rounded-lg p-2';
    wrap.innerHTML = `
      <div>
        <p class="font-medium">${btn.dataset.name}</p>
        <p class="text-sm text-neutral-600">$${Number(btn.dataset.price).toFixed(2)}</p>
      </div>
      <div class="flex items-center gap-2">
        <button class="px-2 py-1 border rounded" aria-label="Decrease">-</button>
        <span class="min-w-[1.5ch] text-center" data-counter="0">0</span>
        <button class="px-2 py-1 border rounded" aria-label="Increase">+</button>
      </div>
    `;
    const [dec, inc] = wrap.querySelectorAll('button');
    const counter = wrap.querySelector('[data-counter]');
    const name = btn.dataset.name;
    const price = btn.dataset.price;
    dec.addEventListener('click', ()=>{
      const item = cart.items.find(i=>i.name===name);
      const qty = (item?.qty || 0) - 1;
      cart.update(name, qty);
    });
    inc.addEventListener('click', ()=> cart.add(name, price));
    quick.appendChild(wrap);
  });
}
function syncQuickAdd() {
  document.querySelectorAll('#quickAdd [data-counter]').forEach(el=>{
    const name = el.closest('div').previousElementSibling?.querySelector('p')?.textContent;
    const item = cart.items.find(i=>i.name===name);
    el.textContent = item ? item.qty : 0;
  });
}
buildQuickAdd();

// Pickup time options (next hour in 15-min increments)
(function buildPickupTimes(){
  const sel = document.getElementById('pickupTime');
  const now = new Date();
  now.setMinutes(now.getMinutes() + 15);
  now.setSeconds(0,0);
  for (let i=0; i<16; i++) {
    const d = new Date(now.getTime() + i*15*60*1000);
    const pad = n => String(n).padStart(2,'0');
    const label = d.toLocaleTimeString([], {hour:'numeric', minute:'2-digit'});
    const opt = new Option(label, `${pad(d.getHours())}:${pad(d.getMinutes())}`);
    sel.add(opt);
  }
})();

// Tip selection
document.querySelectorAll('input[name="tip"]').forEach(r=>{
  r.addEventListener('change', ()=>{ cart.tipRate = Number(r.value); cart.render(); });
});

// Pay CTA
document.getElementById('payBtn').addEventListener('click', ()=>{
  track('order_click', {section: 'order', label: 'Pay'});
  alert('Thanks! This is a demo checkout.');
});

// RSVP + Newsletter forms
document.getElementById('rsvpForm').addEventListener('submit', (e)=>{
  e.preventDefault();
  const email = document.getElementById('rsvpEmail').value;
  track('rsvp_submit', {email});
  alert('RSVP received! See you at Open Mic.');
  e.target.reset();
});

document.getElementById('newsletterForm').addEventListener('submit', (e)=>{
  e.preventDefault();
  const email = document.getElementById('email').value;
  track('email_submit', {email});
  localStorage.setItem('omcc_newsletter', email);
  alert('Welcome! Show this at the register for 50% off your first drink.');
  e.target.reset();
});

// Map pin bounce when map enters view (proxy element)
(function mapBounceOnce(){
  const pin = new Image();
  pin.src = './assets/map-pin.svg';
  pin.alt = '';
  pin.className = 'h-8 w-8 mx-auto mt-2';
  const visit = document.getElementById('visit');
  if (!visit) return;
  visit.querySelector('h2')?.after(pin);
  if (prefersReduced) return;
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if (entry.isIntersecting) {
        pin.classList.add('animate-bounceOnce');
        io.disconnect();
      }
    });
  }, {threshold: 0.4});
  io.observe(pin);
})();
