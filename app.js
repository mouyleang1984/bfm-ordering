// ════════════════════════════════════════════════════════════════════════════
// Basic Food Mart — Wawa-Style Online Ordering App
// Self-contained, no build step, deploys to Netlify via drag & drop
// ════════════════════════════════════════════════════════════════════════════

const { useState, useEffect, useCallback, useRef, useMemo } = React;

// ── CONFIG ────────────────────────────────────────────────────────────────────
const CONFIG = {
  storeName:    'Basic Food Mart',
  storeTagline: 'Fresh food, made your way.',
  accentColor:  '#c8102e',
  logoEmoji:    '🛒',
  taxRate:      0.08,
  // Checkout API — built dynamically from posUrl at call time
  checkoutApi:  null,
};

// Safe POS fetch — detects localtunnel HTML error pages
async function posFetch(url, opts = {}) {
  const headers = { 'bypass-tunnel-reminder': 'true', ...(opts.headers || {}) };
  const r = await fetch(url, { ...opts, headers });
  const text = await r.text();
  if (text.trim().startsWith('<')) {
    // Got HTML — tunnel is up but POS isn't running yet
    throw new Error('POS is not running. Start the POS app and try again.');
  }
  try {
    return JSON.parse(text);
  } catch(e) {
    throw new Error('POS returned invalid response. Make sure the POS is running.');
  }
}

// Parse URL params (Stripe redirects back here)
const PARAMS = new URLSearchParams(window.location.search);

// ── UTILITY ────────────────────────────────────────────────────────────────────
function toast(msg, type = 'info', ms = 3000) {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.getElementById('toast-area').appendChild(el);
  setTimeout(() => el.remove(), ms);
}

function useLocalStorage(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch { return defaultValue; }
  });
  const set = useCallback((v) => {
    const next = typeof v === 'function' ? v(value) : v;
    setValue(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
  }, [key, value]);
  return [value, set];
}

function fmtPrice(n) { return `$${Number(n || 0).toFixed(2)}`; }

// ── FALLBACK MENU (when POS is offline) ────────────────────────────────────────
const DEMO_MENU = {
  store_name: 'Basic Food Mart',
  categories: [
    { id: 'hoagies',  name: 'Hoagies & Subs',   icon: '🥖' },
    { id: 'hotfoods', name: 'Hot Foods',         icon: '🍗' },
    { id: 'drinks',   name: 'Drinks',            icon: '🥤' },
    { id: 'snacks',   name: 'Snacks',            icon: '🍿' },
    { id: 'combos',   name: 'Combos',            icon: '🎁' },
  ],
  items: [
    // Hoagies
    { id: 'ts1', category_id: 'hoagies', name: 'Turkey Sub',  emoji: '🥖', base_price: 6.99, description: 'Fresh sliced turkey, lettuce, tomato, provolone', calories: 520, modifier_groups: [
      { id:'size', name:'Size', type:'single', required:true, modifiers: [
        { id:'reg', name:'Regular (8")', price_delta:0, is_default:true },
        { id:'shrt', name:'Shorty (4")', price_delta:-1.50 },
      ]},
      { id:'bread', name:'Bread', type:'single', required:true, modifiers: [
        { id:'white', name:'White', price_delta:0, is_default:true },
        { id:'wheat', name:'Wheat', price_delta:0 },
        { id:'wrap',  name:'Wrap',  price_delta:0 },
      ]},
      { id:'extras', name:'Add-ons', type:'multi', required:false, max_select:5, modifiers: [
        { id:'bacon', name:'Bacon',       price_delta:1.00 },
        { id:'avo',   name:'Avocado',     price_delta:1.25 },
        { id:'xch',   name:'Extra Cheese',price_delta:0.75 },
        { id:'jal',   name:'Jalapeños',   price_delta:0 },
      ]},
    ]},
    { id: 'it1', category_id: 'hoagies', name: 'Italian Sub',  emoji: '🥪', base_price: 7.49, description: 'Salami, capicola, ham, provolone, oil & vinegar', calories: 680 },
    { id: 'tu1', category_id: 'hoagies', name: 'Tuna Sub',     emoji: '🐟', base_price: 6.49, description: 'Albacore tuna salad, celery, on your choice of bread', calories: 490 },
    { id: 'blt', category_id: 'hoagies', name: 'BLT Sub',      emoji: '🥓', base_price: 5.99, description: 'Crispy bacon, lettuce, tomato, mayo', calories: 560 },
    { id: 'veg', category_id: 'hoagies', name: 'Veggie Sub',   emoji: '🥗', base_price: 5.49, description: 'Fresh veggies, hummus, provolone', calories: 380 },
    // Hot Foods
    { id: 'hd1', category_id: 'hotfoods', name: 'Hot Dog',           emoji: '🌭', base_price: 2.49, description: 'All-beef frank on a toasted bun', calories: 310, modifier_groups: [
      { id:'toppings', name:'Toppings', type:'multi', required:false, max_select:4, modifiers: [
        { id:'must', name:'Mustard',    price_delta:0 },
        { id:'ketch',name:'Ketchup',   price_delta:0 },
        { id:'onion',name:'Onions',    price_delta:0 },
        { id:'rel',  name:'Relish',    price_delta:0 },
        { id:'chili',name:'Chili',     price_delta:0.75 },
        { id:'chs',  name:'Cheese',    price_delta:0.75 },
      ]},
    ]},
    { id: 'ct1', category_id: 'hotfoods', name: 'Chicken Tenders', emoji: '🍗', base_price: 5.99, description: '4-piece hand-breaded tenders, choice of sauce', calories: 620, modifier_groups: [
      { id:'sauce', name:'Dipping Sauce', type:'single', required:true, modifiers: [
        { id:'ranch',   name:'Ranch',        price_delta:0, is_default:true },
        { id:'bbq',     name:'BBQ',          price_delta:0 },
        { id:'honey',   name:'Honey Mustard',price_delta:0 },
        { id:'buffalo', name:'Buffalo',      price_delta:0 },
      ]},
    ]},
    { id: 'bs1', category_id: 'hotfoods', name: 'Breakfast Sandwich', emoji: '🍳', base_price: 4.99, description: 'Egg, cheese, your choice of meat on a roll', calories: 530, modifier_groups: [
      { id:'meat', name:'Meat', type:'single', required:true, modifiers: [
        { id:'bacon2', name:'Bacon',   price_delta:0, is_default:true },
        { id:'saus',   name:'Sausage', price_delta:0 },
        { id:'ham2',   name:'Ham',     price_delta:0 },
        { id:'nomeat', name:'No Meat', price_delta:0 },
      ]},
      { id:'roll', name:'Bread', type:'single', required:true, modifiers: [
        { id:'kaiser', name:'Kaiser Roll',  price_delta:0, is_default:true },
        { id:'bagel',  name:'Bagel',        price_delta:0.25 },
        { id:'eng',    name:'English Muffin',price_delta:0 },
      ]},
    ]},
    { id: 'mac1', category_id: 'hotfoods', name: 'Mac & Cheese', emoji: '🧀', base_price: 3.99, description: 'Creamy cheddar mac, made fresh daily', calories: 420 },
    // Drinks
    { id: 'fd1', category_id: 'drinks', name: 'Fountain Drink', emoji: '🥤', base_price: 1.49, description: 'Pepsi, Diet Pepsi, Sierra Mist, Lemonade & more', modifier_groups: [
      { id:'dsize', name:'Size', type:'single', required:true, modifiers: [
        { id:'sm', name:'Small',  price_delta:0,    is_default:true },
        { id:'md', name:'Medium', price_delta:0.30 },
        { id:'lg', name:'Large',  price_delta:0.50 },
      ]},
    ]},
    { id: 'cf1', category_id: 'drinks', name: 'Coffee',         emoji: '☕', base_price: 1.99, description: 'Fresh-brewed, any size', calories: 5 },
    { id: 'sn1', category_id: 'drinks', name: 'Snapple',        emoji: '🍵', base_price: 2.49, description: 'Assorted flavors', calories: 160 },
    { id: 'gt1', category_id: 'drinks', name: 'Gatorade',       emoji: '⚡', base_price: 2.29, description: 'Assorted flavors', calories: 140 },
    { id: 'wt1', category_id: 'drinks', name: 'Bottled Water',  emoji: '💧', base_price: 1.29, description: 'Ice cold', calories: 0 },
    // Snacks
    { id: 'ch1', category_id: 'snacks', name: 'Chips',          emoji: '🍟', base_price: 1.29, description: 'Assorted varieties' },
    { id: 'do1', category_id: 'snacks', name: 'Doritos',        emoji: '🌽', base_price: 1.49, description: 'Nacho Cheese or Cool Ranch' },
    { id: 'pr1', category_id: 'snacks', name: 'Pretzels',       emoji: '🥨', base_price: 1.19, description: 'Soft pretzel, salted' },
    { id: 'mu1', category_id: 'snacks', name: 'Muffin',         emoji: '🧁', base_price: 2.49, description: 'Blueberry or chocolate chip', calories: 480 },
    // Combos
    { id: 'co1', category_id: 'combos', name: 'Sub + Drink',    emoji: '🎁', base_price: 8.49, description: 'Any sub + any fountain drink', calories: 0 },
    { id: 'co2', category_id: 'combos', name: 'Breakfast Combo',emoji: '🌅', base_price: 5.99, description: 'Breakfast sandwich + any coffee', calories: 0 },
    { id: 'co3', category_id: 'combos', name: 'Tender Combo',   emoji: '🍗', base_price: 7.49, description: '4 tenders + drink + snack', calories: 0 },
  ],
};

// ── ICONS (inline SVG) ────────────────────────────────────────────────────────
const IconX = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const IconCart = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
  </svg>
);
const IconSearch = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);
const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IconPlus  = () => <span style={{fontSize:18,fontWeight:700,lineHeight:1}}>+</span>;
const IconMinus = () => <span style={{fontSize:18,fontWeight:700,lineHeight:1}}>−</span>;
const IconLock  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;

// ════════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ════════════════════════════════════════════════════════════════════════════

// ── SETUP SCREEN ──────────────────────────────────────────────────────────────
function SetupScreen({ onConnect, onSkip }) {
  const [url, setUrl]   = useState('');
  const [autoChecking, setAutoChecking] = useState(true);

  // Auto-discover POS URL:
  // 1. If loaded from trycloudflare.com — use relative paths (same-origin)
  // 2. Otherwise — fetch tunnel.json from Netlify (auto-updated by POS on startup)
  React.useEffect(() => {
    const origin = window.location.origin;
    const isTrycloudflare = origin.includes('trycloudflare.com');
    const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');

    if (isTrycloudflare || isLocalhost) {
      // Served directly from POS tunnel — use same-origin relative paths
      setUrl('');
      posFetch('/store-info', { signal: AbortSignal.timeout(6000) })
        .then(info => { if (info.ok) onConnect('', info); else setAutoChecking(false); })
        .catch(() => setAutoChecking(false));
      return;
    }

    // Auto-connect: read tunnel URL from GitHub (CORS-safe, updated by POS on startup)
    const REGISTRY_URL = 'https://raw.githubusercontent.com/mouyleang1984/bfm-ordering/main/tunnel-url.txt';
    fetch(REGISTRY_URL + '?t=' + Date.now(), {
      cache: 'no-store',
      signal: AbortSignal.timeout(6000)
    })
      .then(async r => {
        if (!r.ok) { setAutoChecking(false); return; }
        const tunnelUrl = (await r.text()).trim();
        if (!tunnelUrl || !tunnelUrl.startsWith('https://')) { setAutoChecking(false); return; }
        setUrl(tunnelUrl);
        try {
          const info = await posFetch(`${tunnelUrl}/store-info`, { signal: AbortSignal.timeout(8000) });
          if (info?.ok) onConnect(tunnelUrl, info);
          else setAutoChecking(false);
        } catch(_) { setAutoChecking(false); }
      })
      .catch(() => setAutoChecking(false));
  }, []);
  const [busy, setBusy] = useState(false);



  const tryConnect = async () => {
    const clean = url.trim().replace(/\/$/, '');
    if (!clean) return;
    setBusy(true);
    try {
      const d = await posFetch(`${clean}/store-info`, { signal: AbortSignal.timeout(6000) });
      if (d.ok) {
        toast(`Connected to ${d.name || 'POS'}!`, 'success');
        onConnect(clean, d);
      } else { toast('POS responded but with unexpected data', 'error'); }
    } catch(e) { toast(e.message || 'Cannot reach POS — is it running?', 'error'); }
    setBusy(false);
  };

  if (autoChecking) {
    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:20,
        background:'linear-gradient(135deg, #c8102e 0%, #8b0000 100%)' }}>
        <div style={{ width:'100%', maxWidth:400, background:'#fff', borderRadius:20, padding:48, boxShadow:'0 20px 60px rgba(0,0,0,.25)', textAlign:'center' }}>
          <div style={{ fontSize:64, marginBottom:12 }}>{CONFIG.logoEmoji}</div>
          <h1 style={{ fontSize:24, fontWeight:900, color:CONFIG.accentColor, marginBottom:8 }}>{CONFIG.storeName}</h1>
          <div style={{ fontSize:36, marginBottom:12, animation:'spin 1.5s linear infinite' }}>🔄</div>
          <p style={{ fontSize:16, fontWeight:700, color:'#333', margin:0 }}>Connecting to POS…</p>
          <p style={{ fontSize:13, color:'#888', marginTop:6 }}>Finding your store automatically</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:20,
      background:'linear-gradient(135deg, #c8102e 0%, #8b0000 100%)' }}>
      <div style={{ width:'100%', maxWidth:480, background:'#fff', borderRadius:20, padding:40, boxShadow:'0 20px 60px rgba(0,0,0,.25)', animation:'slideUp .4s ease' }}>
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <div style={{ fontSize:64, marginBottom:8 }}>{CONFIG.logoEmoji}</div>
          <h1 style={{ fontSize:26, fontWeight:900, color:CONFIG.accentColor }}>{CONFIG.storeName}</h1>
          <p style={{ color:'#666', marginTop:4, fontSize:15 }}>Connect your POS to start taking orders</p>
        </div>

        <label className="field-label" style={{fontSize:14, fontWeight:700}}>🔗 POS Tunnel URL</label>
        <input className="input" value={url} onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && tryConnect()}
          placeholder="https://xxxx.trycloudflare.com"
          style={{ marginBottom:10, fontSize:15 }}/>
        <div style={{ background:'#fff8e1', border:'1px solid #f59e0b', borderRadius:8, padding:'10px 14px', marginBottom:16 }}>
          <p style={{ fontSize:12, fontWeight:700, color:'#b45309', margin:'0 0 4px' }}>📋 How to get your URL:</p>
          <p style={{ fontSize:12, color:'#92400e', margin:0, lineHeight:1.7 }}>
            1. Open the POS app on your PC<br/>
            2. Go to <strong>Settings → Phone Order System</strong><br/>
            3. Wait for <strong style={{color:'#22c55e'}}>🌐 Cloudflare Tunnel: ACTIVE</strong><br/>
            4. Click <strong>📋 Copy</strong> next to the 🛒 Online Ordering URL<br/>
            5. Paste it here and click Connect
          </p>
        </div>

        <button className="btn btn-primary" onClick={tryConnect} disabled={busy || !url.trim()} style={{ width:'100%', padding:14, fontSize:16, marginBottom:12 }}>
          {busy ? '⏳ Connecting…' : '🔌 Connect to POS'}
        </button>

        <button className="btn btn-gray" onClick={onSkip} style={{ width:'100%', padding:12, fontSize:14 }}>
          👁 Preview with Demo Menu
        </button>

        <p style={{ fontSize:11, color:'#aaa', marginTop:16, textAlign:'center' }}>
          Or append <code style={{background:'#f5f5f5',padding:'1px 5px',borderRadius:4}}>?pos=YOUR_URL</code> to skip this screen
        </p>
      </div>
    </div>
  );
}

// ── HEADER ────────────────────────────────────────────────────────────────────
function Header({ storeName, storeHours, cartCount, cartTotal, onCartOpen, search, onSearch, isDemo }) {
  return (
    <header style={{ background: CONFIG.accentColor, color: '#fff', position: 'sticky', top: 0, zIndex: 200, boxShadow: '0 2px 12px rgba(0,0,0,.2)' }}>
      {isDemo && (
        <div style={{ background:'#ff9800', color:'#fff', textAlign:'center', fontSize:12, fontWeight:700, padding:'5px 12px' }}>
          🔶 DEMO MODE — Orders won't reach a real kitchen. Connect your POS to go live.
        </div>
      )}
      <div style={{ maxWidth:1100, margin:'0 auto', padding:'0 20px', height:64, display:'flex', alignItems:'center', gap:16 }}>
        {/* Brand */}
        <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
          <span style={{ fontSize:28 }}>{CONFIG.logoEmoji}</span>
          <div>
            <div style={{ fontWeight:900, fontSize:17, lineHeight:1.1 }}>{storeName}</div>
            {storeHours && <div style={{ fontSize:11, opacity:.8 }}>{storeHours}</div>}
          </div>
        </div>

        {/* Search */}
        <div style={{ flex:1, maxWidth:380, display:'flex', alignItems:'center', background:'rgba(255,255,255,.18)', borderRadius:8, padding:'0 12px', gap:8 }}>
          <IconSearch/>
          <input value={search} onChange={e => onSearch(e.target.value)} placeholder="Search menu…"
            style={{ background:'none', border:'none', color:'#fff', fontSize:14, outline:'none', flex:1, padding:'10px 0', '::placeholder': { color:'rgba(255,255,255,.7)' } }}/>
          {search && <button onClick={() => onSearch('')} style={{ background:'none', border:'none', color:'rgba(255,255,255,.8)', cursor:'pointer', fontSize:18, lineHeight:1 }}>×</button>}
        </div>

        {/* Cart Button */}
        <button onClick={onCartOpen} style={{
          position:'relative', display:'flex', alignItems:'center', gap:8,
          background:'#fff', color:CONFIG.accentColor, border:'none',
          borderRadius:10, padding:'9px 18px', fontWeight:800, fontSize:14,
          cursor:'pointer', transition:'transform .15s', flexShrink:0,
          boxShadow:'0 2px 8px rgba(0,0,0,.15)',
        }} onMouseEnter={e=>e.currentTarget.style.transform='scale(1.04)'}
           onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
          <IconCart/>
          <span>Order</span>
          {cartCount > 0 && (
            <>
              <span style={{ background:CONFIG.accentColor, color:'#fff', borderRadius:12, padding:'1px 8px', fontSize:13 }}>
                {cartCount}
              </span>
              <span style={{ fontSize:13, fontWeight:600, opacity:.9 }}>{fmtPrice(cartTotal)}</span>
            </>
          )}
          {cartCount === 0 && <span style={{ fontSize:13, opacity:.7 }}>Empty</span>}
        </button>
      </div>
    </header>
  );
}

// ── HERO BANNER ───────────────────────────────────────────────────────────────
function HeroBanner({ onStartOrder }) {
  return (
    <div style={{
      background:'linear-gradient(120deg, #a0000e 0%, #c8102e 50%, #e8223e 100%)',
      color:'#fff', padding:'36px 20px', textAlign:'center',
    }}>
      <div style={{ maxWidth:700, margin:'0 auto' }}>
        <h2 style={{ fontSize:'clamp(22px,5vw,38px)', fontWeight:900, marginBottom:8, lineHeight:1.2 }}>
          {CONFIG.storeTagline}
        </h2>
        <p style={{ opacity:.85, fontSize:'clamp(13px,2.5vw,17px)', marginBottom:24 }}>
          Order ahead for pickup or delivery. Skip the line, every time.
        </p>
        <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
          <button className="btn" onClick={onStartOrder} style={{ background:'#fff', color:CONFIG.accentColor, fontSize:16, padding:'13px 28px' }}>
            🏪 Order for Pickup
          </button>
          <button className="btn" onClick={onStartOrder} style={{ background:'rgba(255,255,255,.18)', color:'#fff', border:'2px solid rgba(255,255,255,.5)', fontSize:16, padding:'13px 28px' }}>
            🛵 Order for Delivery
          </button>
        </div>
        <div style={{ display:'flex', gap:24, justifyContent:'center', marginTop:20, flexWrap:'wrap' }}>
          {['🕐 Ready in 10–15 min', '📍 Pickup inside', '🛵 Delivery available', '💳 Pay securely online'].map(f => (
            <span key={f} style={{ fontSize:13, opacity:.9, fontWeight:600 }}>{f}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── CATEGORY TABS ─────────────────────────────────────────────────────────────
function CategoryTabs({ categories, active, onSelect }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current?.querySelector(`[data-cat="${active}"]`);
    if (el) el.scrollIntoView({ behavior:'smooth', block:'nearest', inline:'center' });
  }, [active]);

  return (
    <div ref={ref} style={{
      background:'#fff', borderBottom:'2px solid #eee', position:'sticky', top:64, zIndex:150,
      overflowX:'auto', display:'flex', gap:0, scrollbarWidth:'none', padding:'0 12px',
    }}>
      {categories.map(cat => (
        <button key={cat.id} data-cat={cat.id} onClick={() => onSelect(cat.id)}
          style={{
            flexShrink:0, padding:'14px 18px', border:'none', background:'none', cursor:'pointer',
            fontWeight: active === cat.id ? 800 : 600,
            color:      active === cat.id ? CONFIG.accentColor : '#555',
            fontSize:   14,
            borderBottom: active === cat.id ? `3px solid ${CONFIG.accentColor}` : '3px solid transparent',
            transition: 'all .15s',
            display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap',
          }}>
          <span style={{ fontSize:18 }}>{cat.icon}</span>
          {cat.name}
        </button>
      ))}
    </div>
  );
}

// ── ITEM CARD ─────────────────────────────────────────────────────────────────
function ItemCard({ item, cartQty, onAdd }) {
  const [hov, setHov] = useState(false);
  const soldOut = item.is_sold_out === 1 || item.is_sold_out === true;
  const hasModifiers = (item.modifier_groups || []).length > 0;

  return (
    <div onClick={() => !soldOut && onAdd(item)}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background:'#fff', borderRadius:14, overflow:'hidden', cursor: soldOut ? 'default' : 'pointer',
        border:`2px solid ${hov && !soldOut ? CONFIG.accentColor : cartQty > 0 ? '#ffc0cb' : '#eee'}`,
        boxShadow: hov && !soldOut ? '0 8px 28px rgba(200,16,46,.13)' : '0 2px 8px rgba(0,0,0,.06)',
        transform: hov && !soldOut ? 'translateY(-3px)' : 'none',
        transition:'all .2s', opacity: soldOut ? .55 : 1, display:'flex', flexDirection:'column',
        position:'relative',
        animation:'fadeIn .3s ease',
      }}>

      {/* Cart badge */}
      {cartQty > 0 && (
        <div style={{ position:'absolute', top:8, right:8, background:CONFIG.accentColor, color:'#fff',
          borderRadius:12, width:24, height:24, fontSize:12, fontWeight:800,
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:2, boxShadow:'0 2px 6px rgba(0,0,0,.2)' }}>
          {cartQty}
        </div>
      )}

      {/* Image / emoji */}
      <div style={{ height:130, background:'#f9f9f9', display:'flex', alignItems:'center', justifyContent:'center',
        position:'relative', overflow:'hidden', flexShrink:0 }}>
        {item.photo_url
          ? <img src={item.photo_url} alt={item.name} style={{ width:'100%', height:'100%', objectFit:'cover' }}
              onError={e => { e.target.style.display='none'; }}/>
          : <span style={{ fontSize:52, filter:'drop-shadow(0 2px 4px rgba(0,0,0,.08))' }}>{item.emoji || '🍽️'}</span>}
        {soldOut && (
          <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ background:'#c62828', color:'#fff', borderRadius:6, padding:'3px 12px', fontSize:12, fontWeight:700 }}>SOLD OUT</span>
          </div>
        )}
        {hasModifiers && !soldOut && (
          <div style={{ position:'absolute', bottom:6, left:8, background:'rgba(0,0,0,.55)', color:'#fff',
            borderRadius:10, padding:'2px 8px', fontSize:10, fontWeight:700 }}>
            Customizable
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding:'12px 14px 14px', flex:1, display:'flex', flexDirection:'column' }}>
        <div style={{ fontWeight:800, fontSize:15, lineHeight:1.3, marginBottom:4 }}>{item.name}</div>
        {item.description && (
          <div style={{ fontSize:12, color:'#777', lineHeight:1.5, flex:1, marginBottom:8 }}>{item.description}</div>
        )}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:'auto' }}>
          <span style={{ fontWeight:900, fontSize:17, color: CONFIG.accentColor }}>{fmtPrice(item.base_price)}</span>
          {item.calories > 0 && <span style={{ fontSize:11, color:'#aaa' }}>{item.calories} cal</span>}
        </div>
        {!soldOut && (
          <div style={{ marginTop:8, padding:'8px', background: hov ? CONFIG.accentColor : '#f9f9f9',
            borderRadius:8, textAlign:'center', color: hov ? '#fff' : CONFIG.accentColor,
            fontWeight:700, fontSize:13, transition:'all .2s' }}>
            {cartQty > 0 ? `✓ Add another` : hasModifiers ? `Customize & Add` : `+ Add to Order`}
          </div>
        )}
      </div>
    </div>
  );
}

// ── MODIFIER MODAL ────────────────────────────────────────────────────────────
function ModifierModal({ item, onClose, onAddToCart }) {
  const [qty, setQty]        = useState(1);
  const [choices, setChoices] = useState({});
  const [note, setNote]      = useState('');

  useEffect(() => {
    const init = {};
    (item.modifier_groups || []).forEach(g => {
      init[g.id] = new Set(
        g.modifiers.filter(m => m.is_default).map(m => m.id)
      );
    });
    setChoices(init);
  }, [item.id]);

  const toggle = (group, modId) => {
    setChoices(prev => {
      const next = { ...prev };
      if (group.type === 'single') {
        next[group.id] = new Set([modId]);
      } else {
        const s = new Set(next[group.id] || []);
        if (s.has(modId)) {
          s.delete(modId);
        } else {
          if (group.max_select && s.size >= group.max_select) {
            toast(`Max ${group.max_select} for ${group.name}`, 'info');
            return prev;
          }
          s.add(modId);
        }
        next[group.id] = s;
      }
      return next;
    });
  };

  const isValid = () => (item.modifier_groups || []).every(g => {
    if (!g.required) return true;
    return (choices[g.id]?.size || 0) >= (g.min_select || 1);
  });

  const extraPrice = () => {
    let x = 0;
    (item.modifier_groups || []).forEach(g =>
      (choices[g.id] || new Set()).forEach(mid => {
        const m = g.modifiers.find(m => m.id === mid);
        if (m) x += m.price_delta || 0;
      })
    );
    return x;
  };

  const unitPrice = item.base_price + extraPrice();
  const lineTotal = unitPrice * qty;

  const handleAdd = () => {
    if (!isValid()) return;
    const mods = [];
    (item.modifier_groups || []).forEach(g =>
      (choices[g.id] || new Set()).forEach(mid => {
        const m = g.modifiers.find(m => m.id === mid);
        if (m) mods.push(`${m.name}${m.price_delta > 0 ? ` +${fmtPrice(m.price_delta)}` : ''}`);
      })
    );
    onAddToCart({ ...item, qty, unit_price: unitPrice, mods, note: note.trim() });
    onClose();
  };

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:540 }}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display:'flex', align:'center', gap:10 }}>
            <span style={{ fontSize:28 }}>{item.emoji || '🍽️'}</span>
            <div>
              <h2 style={{ fontSize:18, fontWeight:900 }}>{item.name}</h2>
              <span style={{ fontSize:13, color:'#666' }}>{fmtPrice(item.base_price)}</span>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}><IconX/></button>
        </div>

        <div style={{ padding:'16px 20px 24px' }}>
          {item.description && (
            <p style={{ color:'#666', fontSize:14, lineHeight:1.6, marginBottom:16, background:'#f9f9f9', borderRadius:8, padding:'10px 14px' }}>{item.description}</p>
          )}

          {/* Modifier groups */}
          {(item.modifier_groups || []).map(group => (
            <div key={group.id} style={{ marginBottom:20 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <span style={{ fontWeight:800, fontSize:15 }}>{group.name}</span>
                <span style={{
                  fontSize:11, fontWeight:700, borderRadius:5, padding:'3px 9px',
                  background: group.required ? '#fdecea' : '#e8f5e9',
                  color:      group.required ? '#c62828' : '#2e7d32',
                }}>
                  {group.required ? 'Required' : 'Optional'}
                  {group.type === 'multi' && group.max_select > 1 ? ` · Pick up to ${group.max_select}` : ''}
                </span>
              </div>
              {group.modifiers.map(mod => {
                const selected = choices[group.id]?.has(mod.id);
                return (
                  <button key={mod.id} onClick={() => toggle(group, mod.id)}
                    style={{
                      display:'flex', alignItems:'center', gap:12, width:'100%',
                      padding:'11px 14px', marginBottom:6, border:`1.5px solid ${selected ? CONFIG.accentColor : '#e0e0e0'}`,
                      borderRadius:10, background: selected ? '#fdecea' : '#fff',
                      cursor:'pointer', transition:'all .15s', textAlign:'left',
                    }}>
                    {/* Checkbox/radio indicator */}
                    <div style={{
                      width:20, height:20, borderRadius: group.type === 'single' ? '50%' : 5,
                      border:`2px solid ${selected ? CONFIG.accentColor : '#ccc'}`,
                      background: selected ? CONFIG.accentColor : '#fff',
                      flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center',
                      transition:'all .15s',
                    }}>
                      {selected && <IconCheck/>}
                    </div>
                    <span style={{ flex:1, fontSize:14, fontWeight: selected ? 700 : 400 }}>
                      {mod.emoji && <span style={{ marginRight:5 }}>{mod.emoji}</span>}
                      {mod.name}
                    </span>
                    {mod.price_delta !== 0 && (
                      <span style={{ fontSize:13, fontWeight:700, color: mod.price_delta > 0 ? '#2e7d32' : CONFIG.accentColor }}>
                        {mod.price_delta > 0 ? `+${fmtPrice(mod.price_delta)}` : `-${fmtPrice(Math.abs(mod.price_delta))}`}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}

          {/* Special instructions */}
          <div style={{ marginBottom:20 }}>
            <label className="field-label">Special Instructions</label>
            <textarea className="input" value={note} onChange={e => setNote(e.target.value)}
              placeholder="Allergies, no onions, extra sauce…" rows={2}
              style={{ resize:'none', fontFamily:'inherit' }}/>
          </div>

          {/* Qty + Add */}
          <div style={{ display:'flex', gap:12, alignItems:'center' }}>
            <div style={{ display:'flex', alignItems:'center', border:'1.5px solid #e0e0e0', borderRadius:10, overflow:'hidden' }}>
              <button onClick={() => setQty(q => Math.max(1, q - 1))}
                style={{ width:44, height:48, border:'none', background:'#f5f5f5', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <IconMinus/>
              </button>
              <span style={{ width:36, textAlign:'center', fontWeight:800, fontSize:17 }}>{qty}</span>
              <button onClick={() => setQty(q => Math.min(20, q + 1))}
                style={{ width:44, height:48, border:'none', background:'#f5f5f5', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <IconPlus/>
              </button>
            </div>
            <button className="btn btn-primary" onClick={handleAdd} disabled={!isValid()}
              style={{ flex:1, height:48, fontSize:16 }}>
              Add {qty > 1 ? `${qty} × ` : ''}{fmtPrice(lineTotal)}
            </button>
          </div>
          {!isValid() && (
            <p style={{ color:'#c62828', fontSize:12, textAlign:'center', marginTop:8 }}>
              Please complete all required selections above
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── CART DRAWER ───────────────────────────────────────────────────────────────
function CartDrawer({ cart, open, onClose, onUpdateQty, onRemove, onClear, onCheckout }) {
  const subtotal = cart.reduce((s, i) => s + i.unit_price * i.qty, 0);
  const tax      = subtotal * CONFIG.taxRate;
  const total    = subtotal + tax;
  const count    = cart.reduce((s, i) => s + i.qty, 0);

  if (!open) return null;

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:300, animation:'fadeIn .2s' }}/>
      <div style={{
        position:'fixed', right:0, top:0, bottom:0, width:'min(100%, 420px)',
        background:'#fff', zIndex:301, display:'flex', flexDirection:'column',
        boxShadow:'-4px 0 30px rgba(0,0,0,.15)', animation:'slideIn .25s ease',
      }}>
        {/* Header */}
        <div style={{ padding:'18px 20px', borderBottom:'1px solid #eee', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <h2 style={{ fontWeight:900, fontSize:20 }}>Your Order</h2>
            {count > 0 && <span style={{ fontSize:13, color:'#888' }}>{count} item{count !== 1 ? 's' : ''}</span>}
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            {cart.length > 0 && (
              <button onClick={onClear} style={{ fontSize:12, color:'#999', background:'none', border:'1px solid #ddd', borderRadius:6, padding:'4px 10px', cursor:'pointer' }}>
                Clear All
              </button>
            )}
            <button className="close-btn" onClick={onClose}><IconX/></button>
          </div>
        </div>

        {/* Items */}
        <div style={{ flex:1, overflow:'auto', padding:'12px 20px' }}>
          {cart.length === 0 ? (
            <div style={{ textAlign:'center', padding:'60px 0', color:'#aaa' }}>
              <div style={{ fontSize:52, marginBottom:12 }}>🛒</div>
              <div style={{ fontWeight:700, fontSize:16, marginBottom:4 }}>Your cart is empty</div>
              <div style={{ fontSize:13 }}>Browse the menu and add some items!</div>
            </div>
          ) : (
            cart.map((item, idx) => (
              <div key={idx} style={{ display:'flex', gap:12, padding:'14px 0', borderBottom:'1px solid #f0f0f0', animation:'fadeIn .2s' }}>
                <span style={{ fontSize:30, flexShrink:0 }}>{item.emoji || '🍽️'}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700, fontSize:14, lineHeight:1.3 }}>{item.name}</div>
                  {item.mods?.length > 0 && (
                    <div style={{ fontSize:12, color:'#888', marginTop:2, lineHeight:1.4 }}>{item.mods.join(' · ')}</div>
                  )}
                  {item.note && (
                    <div style={{ fontSize:12, color:'#e65100', fontStyle:'italic', marginTop:2 }}>📝 {item.note}</div>
                  )}
                  <div style={{ fontWeight:800, color: CONFIG.accentColor, fontSize:14, marginTop:4 }}>
                    {fmtPrice(item.unit_price)}
                  </div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                  <div style={{ display:'flex', alignItems:'center', border:'1px solid #e0e0e0', borderRadius:8 }}>
                    <button onClick={() => onUpdateQty(idx, item.qty - 1)}
                      style={{ width:30, height:30, border:'none', background:'none', cursor:'pointer', fontSize:16 }}>−</button>
                    <span style={{ width:22, textAlign:'center', fontWeight:700, fontSize:14 }}>{item.qty}</span>
                    <button onClick={() => onUpdateQty(idx, item.qty + 1)}
                      style={{ width:30, height:30, border:'none', background:'none', cursor:'pointer', fontSize:16 }}>+</button>
                  </div>
                  <button onClick={() => onRemove(idx)} style={{ fontSize:11, color:'#ccc', background:'none', border:'none', cursor:'pointer' }}>Remove</button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {cart.length > 0 && (
          <div style={{ padding:'16px 20px', borderTop:'1px solid #eee', background:'#fff' }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:14, color:'#666', marginBottom:5 }}>
              <span>Subtotal</span><span>{fmtPrice(subtotal)}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:14, color:'#666', marginBottom:14 }}>
              <span>Tax (8%)</span><span>{fmtPrice(tax)}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', fontWeight:900, fontSize:20, marginBottom:16 }}>
              <span>Total</span><span style={{ color: CONFIG.accentColor }}>{fmtPrice(total)}</span>
            </div>
            <button className="btn btn-primary" onClick={onCheckout}
              style={{ width:'100%', height:52, fontSize:17, borderRadius:12 }}>
              💳 Checkout → {fmtPrice(total)}
            </button>
            <p style={{ fontSize:11, color:'#bbb', textAlign:'center', marginTop:10, display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
              <IconLock/> Secure payment powered by Stripe
            </p>
          </div>
        )}
      </div>
    </>
  );
}

// ── CHECKOUT FLOW ─────────────────────────────────────────────────────────────
function CheckoutFlow({ cart, posUrl, isDemo, onClose }) {
  const [step, setStep]    = useState('info');  // info | review | paying
  const [type, setType]    = useState('pickup');
  const [name, setName]    = useState('');
  const [phone, setPhone]  = useState('');
  const [email, setEmail]  = useState('');
  const [addr, setAddr]    = useState('');
  const [note, setNote]    = useState('');
  const [err, setErr]      = useState('');

  const subtotal = cart.reduce((s, i) => s + i.unit_price * i.qty, 0);
  const tax      = subtotal * CONFIG.taxRate;
  const total    = subtotal + tax;

  const canProceed = name.trim().length >= 2 && (type !== 'delivery' || addr.trim().length > 5);

  const startStripeCheckout = async () => {
    setStep('paying'); setErr('');
    if (isDemo) {
      setTimeout(() => {
        setErr('DEMO MODE: No real payment processed. Connect your POS to go live.');
        setStep('review');
      }, 1500);
      return;
    }
    try {
      // Build absolute checkout URL from connected POS tunnel URL
      const checkoutUrl = (posUrl && posUrl.startsWith('http'))
        ? `${posUrl}/api/create-checkout`
        : `${window.location.origin}/api/create-checkout`;
      const res = await fetch(checkoutUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'bypass-tunnel-reminder': 'true' },
        body: JSON.stringify({
          cart: cart.map(i => ({
            name:       i.name,
            qty:        i.qty,
            unit_price: i.unit_price,
            base_price: i.base_price,
            mods:       i.mods || [],
            note:       i.note || '',
          })),
          customer_name:        name.trim(),
          customer_phone:       phone.trim(),
          customer_email:       email.trim(),
          fulfillment_type:     type,
          address:              type === 'delivery' ? addr.trim() : '',
          special_instructions: note.trim(),
          pos_tunnel_url:       posUrl,
        }),
      });
      const data = await res.json();
      if (data.ok && data.url) {
        window.location.href = data.url;
      } else {
        setErr(data.error || 'Unable to create checkout session. Check POS connection.');
        setStep('review');
      }
    } catch (e) {
      setErr(`Network error: ${e.message}`);
      setStep('review');
    }
  };

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && step !== 'paying' && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>
            {step === 'info'   ? '📋 Your Details' :
             step === 'review' ? '✅ Review & Pay' : '⏳ Processing…'}
          </h2>
          {step !== 'paying' && <button className="close-btn" onClick={onClose}><IconX/></button>}
        </div>

        <div style={{ padding:'20px 24px 28px' }}>

          {/* ── Step: paying ── */}
          {step === 'paying' && (
            <div style={{ textAlign:'center', padding:'48px 0' }}>
              <div className="spinner" style={{ margin:'0 auto 20px', width:56, height:56 }}/>
              <div style={{ fontWeight:700, fontSize:16, marginBottom:6 }}>Creating secure checkout…</div>
              <div style={{ color:'#888', fontSize:13 }}>Redirecting you to Stripe to complete payment.</div>
            </div>
          )}

          {/* ── Step: info ── */}
          {step === 'info' && (
            <>
              {/* Pickup / Delivery toggle */}
              <div style={{ display:'flex', gap:10, marginBottom:22 }}>
                {[{ v:'pickup', icon:'🏪', label:'Pickup' }, { v:'delivery', icon:'🛵', label:'Delivery' }].map(o => (
                  <button key={o.v} onClick={() => setType(o.v)}
                    style={{
                      flex:1, padding:'13px', border:`2px solid ${type === o.v ? CONFIG.accentColor : '#e0e0e0'}`,
                      borderRadius:10, background: type === o.v ? '#fdecea' : '#fafafa',
                      color: type === o.v ? CONFIG.accentColor : '#555',
                      fontWeight:700, fontSize:15, cursor:'pointer', transition:'all .15s',
                    }}>
                    <div style={{ fontSize:24, marginBottom:2 }}>{o.icon}</div>
                    {o.label}
                  </button>
                ))}
              </div>

              <div style={{ marginBottom:14 }}>
                <label className="field-label">Your Name *</label>
                <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="John Smith"/>
              </div>
              <div style={{ marginBottom:14 }}>
                <label className="field-label">Phone Number</label>
                <input className="input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" type="tel"/>
              </div>
              <div style={{ marginBottom:14 }}>
                <label className="field-label">Email (receipt)</label>
                <input className="input" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" type="email"/>
              </div>
              {type === 'delivery' && (
                <div style={{ marginBottom:14 }}>
                  <label className="field-label">Delivery Address *</label>
                  <input className="input" value={addr} onChange={e => setAddr(e.target.value)} placeholder="123 Main St, City, State ZIP"/>
                </div>
              )}
              <div style={{ marginBottom:22 }}>
                <label className="field-label">Order Notes</label>
                <textarea className="input" value={note} onChange={e => setNote(e.target.value)}
                  placeholder="Allergies, gate code, preferences…" rows={2} style={{ resize:'none', fontFamily:'inherit' }}/>
              </div>

              <button className="btn btn-primary" onClick={() => setStep('review')} disabled={!canProceed}
                style={{ width:'100%', height:50, fontSize:16 }}>
                Review Order →
              </button>
            </>
          )}

          {/* ── Step: review ── */}
          {step === 'review' && (
            <>
              {/* Order summary */}
              <div style={{ background:'#fafafa', border:'1px solid #eee', borderRadius:10, padding:'14px 16px', marginBottom:14 }}>
                {cart.map((item, idx) => (
                  <div key={idx} style={{ display:'flex', justifyContent:'space-between', marginBottom:6, fontSize:14 }}>
                    <span style={{ flex:1 }}>{item.qty}× {item.name}
                      {item.mods?.length > 0 && <span style={{ color:'#888', fontSize:12 }}> ({item.mods.join(', ')})</span>}
                    </span>
                    <span style={{ fontWeight:700, flexShrink:0 }}>{fmtPrice(item.unit_price * item.qty)}</span>
                  </div>
                ))}
                <div style={{ borderTop:'1px solid #eee', marginTop:10, paddingTop:10 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'#888', marginBottom:4 }}><span>Subtotal</span><span>{fmtPrice(subtotal)}</span></div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'#888', marginBottom:10 }}><span>Tax (8%)</span><span>{fmtPrice(tax)}</span></div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontWeight:900, fontSize:20 }}><span>Total</span><span style={{ color: CONFIG.accentColor }}>{fmtPrice(total)}</span></div>
                </div>
              </div>

              {/* Customer summary */}
              <div style={{ background:'#f9f9f9', border:'1px solid #eee', borderRadius:10, padding:'12px 14px', marginBottom:14, fontSize:13, lineHeight:2 }}>
                <div><strong>Name:</strong> {name}</div>
                {phone && <div><strong>Phone:</strong> {phone}</div>}
                {email && <div><strong>Email:</strong> {email}</div>}
                <div><strong>Type:</strong> {type === 'pickup' ? '🏪 Pickup' : `🛵 Delivery → ${addr}`}</div>
                {note && <div><strong>Notes:</strong> {note}</div>}
              </div>

              {/* Stripe trust badge */}
              <div style={{ background:'#f0faf0', border:'1px solid #c8e6c9', borderRadius:10, padding:'10px 14px', marginBottom:16,
                fontSize:12, color:'#444', display:'flex', gap:8, alignItems:'flex-start' }}>
                <span style={{ fontSize:20, flexShrink:0 }}>🔒</span>
                <span>You'll be securely redirected to <strong>Stripe</strong> to complete payment. <strong>Your order only goes to the kitchen after successful payment.</strong></span>
              </div>

              {err && (
                <div style={{ background:'#fdecea', border:'1px solid #ffcdd2', borderRadius:8, padding:'10px 14px', marginBottom:14, color:'#c62828', fontSize:13 }}>
                  ⚠️ {err}
                </div>
              )}

              <div style={{ display:'flex', gap:10 }}>
                <button className="btn btn-gray" onClick={() => setStep('info')} style={{ flex:1 }}>← Back</button>
                <button className="btn btn-primary" onClick={startStripeCheckout} style={{ flex:2, fontSize:16, height:50 }}>
                  💳 Pay {fmtPrice(total)}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── SUCCESS / CANCELLED BANNERS ───────────────────────────────────────────────
function SuccessBanner({ orderNum, onClose }) {
  return (
    <div style={{ background:'#e8f5e9', border:'2px solid #4caf50', borderRadius:14, padding:'20px 24px',
      margin:'16px 20px', display:'flex', gap:16, alignItems:'center', animation:'fadeIn .4s' }}>
      <span style={{ fontSize:44 }}>✅</span>
      <div style={{ flex:1 }}>
        <div style={{ fontWeight:900, fontSize:19, color:'#2e7d32', marginBottom:4 }}>Payment Successful — Order Placed!</div>
        <div style={{ color:'#555', fontSize:14 }}>Order <strong>#{orderNum}</strong> has been sent to the kitchen. We'll have it ready soon!</div>
        <div style={{ color:'#888', fontSize:13, marginTop:4 }}>You'll receive a confirmation if you provided your email.</div>
      </div>
      <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#888' }}>✕</button>
    </div>
  );
}
function CancelledBanner({ onClose }) {
  return (
    <div style={{ background:'#fff3e0', border:'2px solid #ff9800', borderRadius:14, padding:'16px 24px',
      margin:'16px 20px', display:'flex', gap:12, alignItems:'center', animation:'fadeIn .4s' }}>
      <span style={{ fontSize:32 }}>⚠️</span>
      <div style={{ flex:1 }}>
        <strong>Payment cancelled.</strong> Your cart is still saved — you can try again anytime.
      </div>
      <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#888' }}>✕</button>
    </div>
  );
}

// ── FLOATING CART BUTTON (mobile) ─────────────────────────────────────────────
function FloatingCart({ count, total, onClick }) {
  if (count === 0) return null;
  return (
    <div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', zIndex:190, animation:'slideUp .3s ease' }}>
      <button onClick={onClick} style={{
        background: CONFIG.accentColor, color:'#fff', border:'none',
        borderRadius:30, padding:'14px 28px', fontSize:16, fontWeight:800,
        boxShadow:'0 6px 24px rgba(200,16,46,.4)', cursor:'pointer',
        display:'flex', alignItems:'center', gap:12, whiteSpace:'nowrap',
        animation:'pulse 2s ease infinite',
      }}>
        <IconCart/>
        <span>{count} item{count !== 1 ? 's' : ''}</span>
        <span style={{ background:'rgba(255,255,255,.25)', borderRadius:16, padding:'3px 12px' }}>{fmtPrice(total)}</span>
        <span>→</span>
      </button>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ════════════════════════════════════════════════════════════════════════════
function App() {
  // POS connection
  const posUrlParam = PARAMS.get('pos') || '';
  const [posUrl, setPosUrl]     = useLocalStorage('bfm_pos_url_v2', posUrlParam || null);
  const [storeInfo, setStoreInfo] = useState(null);
  const [isDemo, setIsDemo]     = useState(false);

  // Menu
  const [menu, setMenu]         = useState(null);
  const [loading, setLoading]   = useState(false);
  const [menuError, setMenuErr] = useState('');

  // Navigation
  const [activeCat, setActiveCat] = useState(null);
  const [search, setSearch]       = useState('');

  // Cart
  const [cart, setCart] = useLocalStorage('bfm_cart_v3', []);

  // UI state
  const [cartOpen, setCartOpen]   = useState(false);
  const [modItem, setModItem]     = useState(null);
  const [checkout, setCheckout]   = useState(false);

  // Stripe return banner
  const [banner, setBanner] = useState(() => {
    if (PARAMS.get('order_success'))   return { type:'success',   order: PARAMS.get('order') || '' };
    if (PARAMS.get('order_cancelled')) return { type:'cancelled' };
    return null;
  });

  useEffect(() => {
    if (banner) {
      window.history.replaceState({}, '', window.location.pathname);
      if (banner.type === 'success') {
        setCart([]);
        toast('🎉 Order placed! Kitchen is on it.', 'success', 5000);
      }
    }
  }, []);

  // Load menu from POS
  const loadMenu = useCallback(async () => {
    // posUrl can be '' (same-origin relative) or full URL
    if (posUrl === null || posUrl === undefined) return;
    setLoading(true); setMenuErr('');

    // Helper: try fetching menu+store-info from a given base URL
    const tryFetch = async (base) => {
      const [mr, sr] = await Promise.allSettled([
        posFetch(`${base}/menu`,       { signal: AbortSignal.timeout(8000) }),
        posFetch(`${base}/store-info`, { signal: AbortSignal.timeout(5000) }),
      ]);
      return { mr, sr };
    };

    let base = posUrl || '';
    let { mr, sr } = await tryFetch(base);

    // If failed AND we're on GitHub Pages, silently try the latest tunnel URL from GitHub
    const isGHPages = window.location.origin.includes('github.io');
    if (isGHPages && (mr.status === 'rejected' || !mr.value?.ok)) {
      try {
        const reg = await fetch('https://raw.githubusercontent.com/mouyleang1984/bfm-ordering/main/tunnel-url.txt?t=' + Date.now(), { cache: 'no-store', signal: AbortSignal.timeout(5000) });
        if (reg.ok) {
          const freshUrl = (await reg.text()).trim();
          if (freshUrl && freshUrl.startsWith('https://') && freshUrl !== posUrl) {
            console.log('[App] Stale URL — retrying with fresh tunnel:', freshUrl);
            const retry = await tryFetch(freshUrl);
            if (retry.mr.status === 'fulfilled' && retry.mr.value?.ok) {
              setPosUrl(freshUrl);   // update localStorage
              base = freshUrl;
              mr   = retry.mr;
              sr   = retry.sr;
            }
          }
        }
      } catch(_) {}
    }

    if (mr.status === 'fulfilled' && mr.value.ok) {
      setMenu(mr.value);
      if (mr.value.categories?.length) setActiveCat(mr.value.categories[0].id);
    } else {
      setMenuErr(mr.status === 'rejected' ? (mr.reason?.message || 'POS is not running. Start the POS app and try again.') : mr.value?.error || 'Failed to load menu');
    }
    if (sr.status === 'fulfilled' && sr.value.ok) setStoreInfo(sr.value);
    setLoading(false);
  }, [posUrl]);

  // Auto-connect on first load
  useEffect(() => {
    if (posUrl === null && !isDemo) {
      const origin = window.location.origin;
      const isTrycloudflare = origin.includes('trycloudflare.com');
      const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');
      if (isTrycloudflare || isLocalhost) {
        // Served directly from POS tunnel — use relative paths
        setPosUrl('');
        console.log('[App] Same-origin mode:', origin);
      }
      // Otherwise → SetupScreen handles auto-discovery via tunnel.json
    }
  }, []);

  useEffect(() => { if (posUrl !== null && posUrl !== undefined && !isDemo) loadMenu(); }, [posUrl, loadMenu, isDemo]);

  // Use demo menu
  const useDemo = () => {
    setIsDemo(true); setPosUrl('');
    setMenu(DEMO_MENU);
    setActiveCat(DEMO_MENU.categories[0].id);
  };

  // Filtered items
  const displayItems = useMemo(() => {
    if (!menu) return [];
    const all = menu.items || [];
    if (search.trim()) {
      const q = search.toLowerCase();
      return all.filter(i => i.name.toLowerCase().includes(q) || (i.description || '').toLowerCase().includes(q));
    }
    return activeCat ? all.filter(i => i.category_id === activeCat) : all;
  }, [menu, search, activeCat]);

  // Cart helpers
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const cartTotal = cart.reduce((s, i) => s + i.unit_price * i.qty, 0);

  const cartQtyFor = (itemId) => cart.filter(i => i.id === itemId).reduce((s, i) => s + i.qty, 0);

  const handleAdd = (item) => {
    if ((item.modifier_groups || []).length > 0) {
      setModItem(item);
    } else {
      addToCart({ ...item, qty: 1, unit_price: item.base_price, mods: [], note: '' });
    }
  };

  const addToCart = (item) => {
    setCart(prev => {
      const modsKey = JSON.stringify(item.mods || []);
      const idx = prev.findIndex(c => c.id === item.id && JSON.stringify(c.mods || []) === modsKey && !c.note && !item.note);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + item.qty };
        return next;
      }
      return [...prev, item];
    });
    toast(`${item.name} added!`, 'success', 2000);
  };

  // Show setup screen if no POS URL configured
  if (posUrl === null && !isDemo) {
    return <SetupScreen onConnect={(url, info) => { setPosUrl(url); setStoreInfo(info); }} onSkip={useDemo}/>;
  }

  const storeName = storeInfo?.name || menu?.store_name || CONFIG.storeName;
  const storeHours = storeInfo?.hours || null;

  return (
    <div style={{ minHeight:'100vh', paddingBottom:100 }}>
      <Header
        storeName={storeName} storeHours={storeHours} isDemo={isDemo}
        cartCount={cartCount} cartTotal={cartTotal}
        onCartOpen={() => setCartOpen(true)}
        search={search} onSearch={v => { setSearch(v); if (v) setActiveCat(null); }}
      />

      {/* Hero — only show on category view, not search */}
      {!search && !loading && menu && (
        <HeroBanner onStartOrder={() => { document.querySelector('[data-cat]')?.parentElement?.scrollIntoView({ behavior:'smooth' }); }}/>
      )}

      {/* Banners */}
      {banner?.type === 'success'   && <SuccessBanner   orderNum={banner.order} onClose={() => setBanner(null)}/>}
      {banner?.type === 'cancelled' && <CancelledBanner onClose={() => setBanner(null)}/>}

      {/* Loading */}
      {loading && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'80px 20px', gap:16 }}>
          <div className="spinner"/>
          <p style={{ color:'#888', fontSize:15 }}>Loading menu from POS…</p>
        </div>
      )}

      {/* Error */}
      {!loading && menuError && (
        <div style={{ maxWidth:600, margin:'40px auto', padding:'0 20px', textAlign:'center' }}>
          <div style={{ background:'#fdecea', border:'1px solid #ffcdd2', borderRadius:14, padding:'32px 24px' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>⚠️</div>
            <div style={{ fontWeight:700, fontSize:18, color:'#c62828', marginBottom:8 }}>Couldn't reach POS</div>
            <div style={{ color:'#555', fontSize:14, marginBottom:20 }}>{menuError}</div>
            <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
              <button className="btn btn-primary" onClick={() => { setPosUrl(null); }}>Auto-Reconnect</button>
              <button className="btn btn-outline" onClick={loadMenu}>Retry</button>
              <button className="btn btn-outline" onClick={useDemo}>Use Demo Menu</button>
              <button className="btn btn-gray" onClick={() => { setPosUrl(''); setIsDemo(false); }}>Change POS URL</button>
            </div>
          </div>
        </div>
      )}

      {/* Menu */}
      {!loading && menu && (
        <>
          {!search && (
            <CategoryTabs categories={menu.categories} active={activeCat} onSelect={id => { setActiveCat(id); setSearch(''); }}/>
          )}
          <div style={{ maxWidth:1100, margin:'0 auto', padding:'20px 20px' }}>
            {search && (
              <div style={{ marginBottom:16, color:'#666', fontSize:14 }}>
                {displayItems.length} result{displayItems.length !== 1 ? 's' : ''} for "<strong>{search}</strong>"
                <button onClick={() => setSearch('')} style={{ marginLeft:10, color: CONFIG.accentColor, background:'none', border:'none', cursor:'pointer', fontWeight:700 }}>Clear</button>
              </div>
            )}
            {displayItems.length === 0 ? (
              <div style={{ textAlign:'center', padding:'60px 0', color:'#aaa' }}>
                <div style={{ fontSize:48, marginBottom:10 }}>🍽️</div>
                <div style={{ fontWeight:700, fontSize:17 }}>{search ? 'No items found' : 'Nothing here yet'}</div>
                <div style={{ fontSize:13, marginTop:4 }}>{search ? 'Try searching something else' : 'Check another category'}</div>
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:16 }}>
                {displayItems.map(item => (
                  <ItemCard key={item.id} item={item} cartQty={cartQtyFor(item.id)} onAdd={handleAdd}/>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Modifier modal */}
      {modItem && (
        <ModifierModal item={modItem} onClose={() => setModItem(null)} onAddToCart={item => { addToCart(item); setModItem(null); }}/>
      )}

      {/* Cart Drawer */}
      <CartDrawer
        cart={cart} open={cartOpen} onClose={() => setCartOpen(false)}
        onUpdateQty={(idx, qty) => {
          if (qty <= 0) setCart(p => p.filter((_, i) => i !== idx));
          else setCart(p => p.map((x, i) => i === idx ? { ...x, qty } : x));
        }}
        onRemove={idx => setCart(p => p.filter((_, i) => i !== idx))}
        onClear={() => { setCart([]); setCartOpen(false); toast('Cart cleared', 'info'); }}
        onCheckout={() => { setCartOpen(false); setCheckout(true); }}
      />

      {/* Checkout */}
      {checkout && (
        <CheckoutFlow cart={cart} posUrl={posUrl} isDemo={isDemo} onClose={() => setCheckout(false)}/>
      )}

      {/* Floating cart (mobile) */}
      <FloatingCart count={cartCount} total={cartTotal * (1 + CONFIG.taxRate)} onClick={() => setCartOpen(true)}/>

      {/* Footer */}
      <footer style={{ textAlign:'center', padding:'40px 20px 20px', color:'#bbb', fontSize:12, marginTop:40, borderTop:'1px solid #eee' }}>
        <p>© {new Date().getFullYear()} {CONFIG.storeName} — Online Ordering</p>
        <p style={{ marginTop:4 }}>Powered by Stripe · Secure payments · No account needed</p>
        {!isDemo && posUrl && (
          <button onClick={() => { setPosUrl(''); setMenu(null); setIsDemo(false); }}
            style={{ marginTop:8, background:'none', border:'none', color:'#ccc', fontSize:11, cursor:'pointer' }}>
            ⚙️ Change POS URL
          </button>
        )}
      </footer>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
