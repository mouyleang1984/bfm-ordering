// ════════════════════════════════════════════════════════════════════════════
// Rice Plus Grill — Online Ordering (Wawa-style layout)
// ════════════════════════════════════════════════════════════════════════════
const { useState, useEffect, useCallback, useRef, useMemo } = React;

// ── CONFIG ────────────────────────────────────────────────────────────────────
const CONFIG = {
  storeName:    'Rice Plus Grill',
  storeTagline: 'Fresh food, made your way.',
  accentColor:  '#c8102e',
  logoEmoji:    '🍚',
  logoUrl:      'https://raw.githubusercontent.com/mouyleang1984/bfm-ordering/main/logo.png',
  taxRate:      0.08,
  checkoutApi:  null,
};

async function posFetch(url, opts = {}) {
  const headers = { 'bypass-tunnel-reminder': 'true', ...(opts.headers || {}) };
  const r = await fetch(url, { ...opts, headers });
  const text = await r.text();
  if (text.trim().startsWith('<')) throw new Error('POS is not running. Start the POS app and try again.');
  try { return JSON.parse(text); }
  catch(e) { throw new Error('POS returned invalid response.'); }
}

const PARAMS = new URLSearchParams(window.location.search);

// ── UTILITIES ─────────────────────────────────────────────────────────────────
function toast(msg, type = 'info', ms = 3000) {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.getElementById('toast-area').appendChild(el);
  setTimeout(() => el.remove(), ms);
}
function useLocalStorage(key, def) {
  const [v, setV] = useState(() => { try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : def; } catch { return def; } });
  const set = useCallback(n => { const x = typeof n === 'function' ? n(v) : n; setV(x); try { localStorage.setItem(key, JSON.stringify(x)); } catch {} }, [key, v]);
  return [v, set];
}
function fmtPrice(n) { return `$${Number(n || 0).toFixed(2)}`; }

// ── DEMO MENU ─────────────────────────────────────────────────────────────────
const DEMO_MENU = {
  store_name: 'Rice Plus Grill',
  categories: [
    { id:'rice',    name:'Rice Plates',    icon:'🍚' },
    { id:'noodles', name:'Noodles',        icon:'🍜' },
    { id:'grills',  name:'Grilled Items',  icon:'🥩' },
    { id:'drinks',  name:'Drinks',         icon:'🥤' },
    { id:'combos',  name:'Combos',         icon:'🎁' },
  ],
  items: [
    { id:'r1', category_id:'rice',    name:'Grilled Chicken Rice',      emoji:'🍗', base_price:9.99,  description:'Jasmine rice topped with grilled chicken, fried egg, and cucumber salad', calories:620 },
    { id:'r2', category_id:'rice',    name:'BBQ Pork Rice',             emoji:'🥓', base_price:10.49, description:'Slow-cooked BBQ pork over steamed jasmine rice with pickled veggies', calories:700 },
    { id:'r3', category_id:'rice',    name:'Lemongrass Beef Rice',      emoji:'🥩', base_price:11.99, description:'Fragrant lemongrass beef, jasmine rice, fresh herbs', calories:750 },
    { id:'r4', category_id:'rice',    name:'Tofu Veggie Rice',          emoji:'🥦', base_price:8.99,  description:'Pan-fried tofu, seasonal vegetables, garlic rice', calories:480 },
    { id:'n1', category_id:'noodles', name:'Pho Noodle Soup',           emoji:'🍜', base_price:10.99, description:'Rich bone broth, rice noodles, tender beef, fresh herbs & bean sprouts', calories:580 },
    { id:'n2', category_id:'noodles', name:'Stir-Fried Noodles',        emoji:'🥡', base_price:9.99,  description:'Wok-tossed egg noodles with chicken, vegetables, soy-oyster sauce', calories:640 },
    { id:'n3', category_id:'noodles', name:'Spicy Tom Yum Noodles',     emoji:'🌶', base_price:11.49, description:'Spicy lemongrass broth, shrimp, mushrooms, rice noodles', calories:520, modifier_groups:[
      { id:'spice', name:'Spice Level', type:'single', required:true, modifiers:[
        { id:'mild',   name:'Mild',   price_delta:0, is_default:true },
        { id:'medium', name:'Medium', price_delta:0 },
        { id:'hot',    name:'Hot 🔥', price_delta:0 },
      ]},
    ]},
    { id:'g1', category_id:'grills',  name:'Grilled Pork Skewers',      emoji:'🍢', base_price:7.99,  description:'3 skewers of marinated pork, served with dipping sauce', calories:390 },
    { id:'g2', category_id:'grills',  name:'Grilled Chicken Thighs',    emoji:'🍗', base_price:11.99, description:'2 juicy grilled thighs, lemongrass marinade, served with jasmine rice', calories:680 },
    { id:'g3', category_id:'grills',  name:'Beef Satay',                emoji:'🥩', base_price:12.99, description:'4 tender beef skewers, peanut sauce, pickled cucumber', calories:520 },
    { id:'d1', category_id:'drinks',  name:'Thai Iced Tea',             emoji:'🧡', base_price:3.99,  description:'Classic sweetened black tea with condensed milk', calories:220 },
    { id:'d2', category_id:'drinks',  name:'Coconut Water',             emoji:'🥥', base_price:3.49,  description:'Fresh young coconut water, lightly chilled', calories:90  },
    { id:'d3', category_id:'drinks',  name:'Fresh Limeade',             emoji:'🍋', base_price:2.99,  description:'Freshly squeezed lime, sugar, sparkling water', calories:110 },
    { id:'d4', category_id:'drinks',  name:'Bottled Water',             emoji:'💧', base_price:1.49,  description:'Still water, chilled', calories:0  },
    { id:'c1', category_id:'combos',  name:'Rice Plate + Drink',        emoji:'🎁', base_price:12.99, description:'Any rice plate + any drink', calories:0 },
    { id:'c2', category_id:'combos',  name:'Noodles + Drink',           emoji:'🎁', base_price:13.49, description:'Any noodle dish + any drink', calories:0 },
    { id:'c3', category_id:'combos',  name:'Family Pack (4 Rice Plates)',emoji:'👨‍👩‍👧‍👦', base_price:36.99, description:'4 rice plates of your choice + 4 drinks', calories:0 },
  ],
};

// ── ICONS ─────────────────────────────────────────────────────────────────────
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
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);
const IconCheck  = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>);
const IconLock   = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>);

// ════════════════════════════════════════════════════════════════════════════
// SETUP SCREEN
// ════════════════════════════════════════════════════════════════════════════
function SetupScreen({ onConnect, onSkip }) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [autoChecking, setAutoChecking] = useState(true);

  useEffect(() => {
    // Cloud mode: load real menu from cloud backend
    const MENU_URL = 'https://jeti-f4fa11f5.base44.app/functions/onlineOrderPage?action=menu';
    fetch(MENU_URL, { signal: AbortSignal.timeout(8000) })
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          window._cloudMenu = data;
          onConnect('__cloud__', { ok:true, name:'Rice Plus Grill', ...data });
        } else {
          onSkip();
        }
      })
      .catch(() => onSkip());
  }, []);

  const tryConnect = async () => {
    const clean = url.trim().replace(/\/$/, '');
    if (!clean) return;
    setBusy(true);
    try {
      const d = await posFetch(`${clean}/store-info`, { signal: AbortSignal.timeout(6000) });
      if (d.ok) { toast(`Connected to ${d.name || 'POS'}!`, 'success'); onConnect(clean, d); }
      else toast('POS responded but with unexpected data', 'error');
    } catch(e) { toast(e.message || 'Cannot reach POS — is it running?', 'error'); }
    setBusy(false);
  };

  if (autoChecking) {
    return (
      <div className="setup-bg">
        <div className="setup-card" style={{ textAlign:'center' }}>
          <div style={{ fontSize:60, marginBottom:10 }}>{CONFIG.logoEmoji}</div>
          <h1 style={{ fontSize:24, fontWeight:900, color:CONFIG.accentColor, marginBottom:6 }}>{CONFIG.storeName}</h1>
          <div style={{ fontSize:32, animation:'spin 1.5s linear infinite', margin:'12px 0' }}>🔄</div>
          <p style={{ fontWeight:700, fontSize:15, color:'#333' }}>Connecting to POS…</p>
          <p style={{ fontSize:13, color:'#888', marginTop:4 }}>Finding your store automatically</p>
        </div>
      </div>
    );
  }

  return (
    <div className="setup-bg">
      <div className="setup-card">
        <div style={{ textAlign:'center', marginBottom:24 }}>
          <div style={{ fontSize:60, marginBottom:8 }}>{CONFIG.logoEmoji}</div>
          <h1 style={{ fontSize:24, fontWeight:900, color:CONFIG.accentColor }}>{CONFIG.storeName}</h1>
          <p style={{ color:'#666', marginTop:4, fontSize:14 }}>Connect your POS to start taking orders</p>
        </div>
        <label className="field-label">🔗 POS Tunnel URL</label>
        <input className="input" value={url} onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && tryConnect()}
          placeholder="https://xxxx.trycloudflare.com" style={{ marginBottom:10 }}/>
        <div style={{ background:'#fffbea', border:'1px solid #f59e0b', borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:12, color:'#92400e', lineHeight:1.7 }}>
          <strong>How to get your URL:</strong><br/>
          1. Open POS → Settings → Phone Order System<br/>
          2. Wait for 🌐 Cloudflare Tunnel: ACTIVE<br/>
          3. Copy the 🛒 Online Ordering URL and paste here
        </div>
        <button className="btn btn-red" onClick={tryConnect} disabled={busy || !url.trim()} style={{ width:'100%', padding:14, fontSize:15, marginBottom:10 }}>
          {busy ? '⏳ Connecting…' : '🔌 Connect to POS'}
        </button>
        <button className="btn btn-gray" onClick={onSkip} style={{ width:'100%', padding:12, fontSize:14 }}>
          👁 Preview Demo Menu
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// HEADER
// ════════════════════════════════════════════════════════════════════════════
function Header({ storeName, isDemo, cartCount, cartTotal, onCartOpen, search, onSearch }) {
  return (
    <header className="app-header">
      {isDemo && <div className="demo-bar">🔶 DEMO MODE — Connect your POS to go live</div>}
      <div className="header-inner">
        <div className="header-brand">
          <img src={CONFIG.logoUrl} alt="Rice Plus Grill" style={{ height:90, width:90, objectFit:'contain', borderRadius:12, background:'transparent', padding:0, boxShadow:'none' }} />
          <div>
            <div className="header-brand-name">{storeName}</div>
            <div className="header-brand-sub">Online Ordering</div>
          </div>
        </div>

        <div className="header-search">
          <IconSearch/>
          <input
            value={search} onChange={e => onSearch(e.target.value)}
            placeholder="Search menu…"
          />
          {search && (
            <button className="header-search-x" onClick={() => onSearch('')}>×</button>
          )}
        </div>

        <button className="header-cart" onClick={onCartOpen}>
          <IconCart/>
          <span className="cart-label">Order</span>
          {cartCount > 0
            ? <><span className="header-cart-badge">{cartCount}</span><span className="cart-total">{fmtPrice(cartTotal)}</span></>
            : <span className="cart-label" style={{opacity:.6, fontSize:12}}>Empty</span>
          }
        </button>
      </div>
    </header>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// HERO BANNER
// ════════════════════════════════════════════════════════════════════════════
function HeroBanner() {
  return (
    <div className="hero">
      <h1>{CONFIG.storeTagline}</h1>
      <p>Order ahead for pickup or delivery. Ready in 10–15 min.</p>
      <div className="hero-chips">
        {['🕐 10–15 min', '📍 Pickup', '🛵 Delivery', '💳 Secure pay'].map(c => (
          <span key={c} className="hero-chip">{c}</span>
        ))}
      </div>
    </div>
  );
}


// ════════════════════════════════════════════════════════════════════════════
// PROMO BANNER — Mix & Match promotions with countdown timer
// ════════════════════════════════════════════════════════════════════════════
const PROMOS = [
  {
    id: 'grand-opening',
    emoji: '🎉',
    label: 'GRAND OPENING SPECIAL',
    headline: 'Free Thai Iced Tea with every plate order!',
    sub: 'Add any plate to your cart — drink is on us. Limited time only.',
    bg: 'linear-gradient(135deg,#b91c1c,#dc2626)',
    badge: 'Free Drink',
    badgeColor: '#fff',
    badgeBg: '#991b1b',
  },
  {
    id: 'happy-hour',
    emoji: '⚡',
    label: 'HAPPY HOUR',
    headline: '15% OFF all Grilled Items',
    sub: 'Every weekday 3 PM – 6 PM. No code needed — discount applied at checkout.',
    bg: 'linear-gradient(135deg,#c2410c,#ea580c)',
    badge: '15% OFF',
    badgeColor: '#fff',
    badgeBg: '#9a3412',
    happyHour: { start: 15, end: 18 }, // 3pm–6pm
  },
  {
    id: 'family-pack',
    emoji: '👨‍👩‍👧‍👦',
    label: 'FAMILY PACK DEAL',
    headline: '4 Rice Plates + 4 Drinks — Only $36.99',
    sub: 'Save $8 vs ordering individually. Perfect for dinner or lunch for the whole family.',
    bg: 'linear-gradient(135deg,#7c3aed,#a855f7)',
    badge: 'Save $8',
    badgeColor: '#fff',
    badgeBg: '#6d28d9',
  },
];

function useCountdown(targetHour) {
  const [timeLeft, setTimeLeft] = React.useState('');
  React.useEffect(() => {
    const calc = () => {
      const now = new Date();
      const target = new Date();
      target.setHours(targetHour, 0, 0, 0);
      if (now >= target) target.setDate(target.getDate() + 1);
      const diff = target - now;
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${h}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`);
    };
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, [targetHour]);
  return timeLeft;
}

function PromoBanner() {
  const [idx, setIdx]         = React.useState(0);
  const [dismissed, setDismissed] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem('bfm_dismissed_promos') || '[]'); } catch { return []; }
  });
  const [visible, setVisible] = React.useState(true);

  const now = new Date();
  const hour = now.getHours();
  const isWeekday = now.getDay() >= 1 && now.getDay() <= 5;

  // Filter out dismissed promos
  const active = PROMOS.filter(p => !dismissed.includes(p.id));
  if (!active.length || !visible) return null;

  // Auto-rotate every 6 seconds
  React.useEffect(() => {
    if (active.length <= 1) return;
    const t = setInterval(() => setIdx(i => (i + 1) % active.length), 6000);
    return () => clearInterval(t);
  }, [active.length]);

  const promo = active[idx % active.length];
  const isHappyHourActive = promo.happyHour && isWeekday && hour >= promo.happyHour.start && hour < promo.happyHour.end;
  const countdownTarget  = promo.happyHour ? (isHappyHourActive ? promo.happyHour.end : promo.happyHour.start) : null;
  const countdownLabel   = isHappyHourActive ? 'Ends in' : 'Starts in';
  const countdown        = useCountdown(countdownTarget || 15);

  const dismiss = () => {
    const next = [...dismissed, promo.id];
    localStorage.setItem('bfm_dismissed_promos', JSON.stringify(next));
    setDismissed(next);
  };

  return (
    <div style={{
      background: promo.bg,
      color: '#fff',
      padding: '14px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      position: 'relative',
      boxShadow: '0 2px 8px rgba(0,0,0,.2)',
      flexWrap: 'wrap',
    }}>
      {/* Badge */}
      <span style={{
        background: promo.badgeBg,
        color: promo.badgeColor,
        fontWeight: 800,
        fontSize: 11,
        padding: '4px 10px',
        borderRadius: 20,
        whiteSpace: 'nowrap',
        letterSpacing: '.5px',
        flexShrink: 0,
      }}>{promo.badge}</span>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ fontSize: 10, fontWeight: 700, opacity: .8, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>
          {promo.emoji} {promo.label}
        </div>
        <div style={{ fontWeight: 800, fontSize: 15, lineHeight: 1.3 }}>{promo.headline}</div>
        <div style={{ fontSize: 12, opacity: .85, marginTop: 2 }}>{promo.sub}</div>
      </div>

      {/* Countdown for happy hour */}
      {promo.happyHour && isWeekday && (
        <div style={{
          background: 'rgba(0,0,0,.25)',
          borderRadius: 10,
          padding: '6px 12px',
          textAlign: 'center',
          flexShrink: 0,
        }}>
          <div style={{ fontSize: 10, opacity: .8, fontWeight: 600 }}>{countdownLabel}</div>
          <div style={{ fontSize: 16, fontWeight: 900, fontVariantNumeric: 'tabular-nums', letterSpacing: 1 }}>{countdown}</div>
        </div>
      )}

      {/* Dot indicators */}
      {active.length > 1 && (
        <div style={{ display:'flex', gap:5, alignItems:'center', flexShrink:0 }}>
          {active.map((p,i) => (
            <button key={p.id} onClick={() => setIdx(i)} style={{
              width: i === idx % active.length ? 18 : 7,
              height: 7,
              borderRadius: 4,
              background: i === idx % active.length ? '#fff' : 'rgba(255,255,255,.4)',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              transition: 'all .3s',
            }}/>
          ))}
        </div>
      )}

      {/* Dismiss ✕ */}
      <button onClick={dismiss} style={{
        position: 'absolute',
        top: 8, right: 10,
        background: 'rgba(0,0,0,.2)',
        border: 'none',
        color: '#fff',
        borderRadius: '50%',
        width: 22, height: 22,
        cursor: 'pointer',
        fontSize: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>✕</button>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// CATEGORY TABS (mobile horizontal scroll bar)
// ════════════════════════════════════════════════════════════════════════════
function CategoryScrollBar({ categories, active, onSelect }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current?.querySelector(`[data-cat="${active}"]`);
    if (el) el.scrollIntoView({ behavior:'smooth', block:'nearest', inline:'center' });
  }, [active]);

  return (
    <div ref={ref} className="cat-scroll-bar">
      {(categories || []).map(c => (
        <button
          key={c.id}
          data-cat={c.id}
          className={`cat-scroll-btn${active === c.id ? ' active' : ''}`}
          onClick={() => onSelect(c.id)}
        >
          <span>{c.icon}</span>
          <span>{c.name}</span>
        </button>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// WAWA-STYLE MENU LAYOUT
// Left sidebar (desktop) + scrollable item list (Wawa/DoorDash style)
// ════════════════════════════════════════════════════════════════════════════
function MenuLayout({ menu, search, activeCat, onCatSelect, cartQtyFor, onAdd }) {
  const categories = menu?.categories || [];
  const items      = menu?.items || [];

  // When searching: flat list. When browsing: show ONE section at a time
  const visibleItems = useMemo(() => {
    if (!items.length) return [];
    if (search.trim()) {
      const q = search.toLowerCase();
      return items.filter(i => i.name.toLowerCase().includes(q) || (i.description||'').toLowerCase().includes(q));
    }
    return activeCat ? items.filter(i => i.category_id === activeCat) : items;
  }, [items, search, activeCat]);

  const activeCatObj = categories.find(c => c.id === activeCat);

  return (
    <div className="menu-layout">
      {/* ── LEFT SIDEBAR (desktop/tablet only via CSS) ── */}
      <nav className="cat-sidebar">
        <div className="cat-sidebar-title">Menu</div>
        {categories.map(c => (
          <button
            key={c.id}
            className={`cat-sidebar-btn${activeCat === c.id && !search ? ' active' : ''}`}
            onClick={() => onCatSelect(c.id)}
          >
            <span className="cat-sidebar-icon">{c.icon}</span>
            <span>{c.name}</span>
          </button>
        ))}
      </nav>

      {/* ── RIGHT CONTENT ── */}
      <div className="menu-content">
        {/* Search results header */}
        {search && (
          <div style={{ marginBottom:16, fontSize:14, color:'#555' }}>
            <strong>{visibleItems.length}</strong> result{visibleItems.length !== 1 ? 's' : ''} for "{search}"
          </div>
        )}

        {/* Category title */}
        {!search && activeCatObj && (
          <div className="cat-section-title">
            <span>{activeCatObj.icon}</span>
            <span>{activeCatObj.name}</span>
          </div>
        )}

        {/* Items */}
        {visibleItems.length === 0 ? (
          <div style={{ textAlign:'center', padding:'60px 0', color:'#aaa' }}>
            <div style={{ fontSize:44, marginBottom:10 }}>🍽️</div>
            <div style={{ fontWeight:700, fontSize:16 }}>{search ? 'No items found' : 'Nothing here yet'}</div>
            <div style={{ fontSize:13, marginTop:4 }}>{search ? 'Try a different search' : 'Check another category'}</div>
          </div>
        ) : (
          visibleItems.map(item => (
            <ItemCard key={item.id} item={item} cartQty={cartQtyFor(item.id)} onAdd={onAdd}/>
          ))
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ITEM CARD — horizontal Wawa/DoorDash style
// [text info on left] [image/emoji on right] [+ button]
// ════════════════════════════════════════════════════════════════════════════
function ItemCard({ item, cartQty, onAdd }) {
  const soldOut     = item.is_sold_out === 1 || item.is_sold_out === true;
  const hasModifiers = (item.modifier_groups || []).length > 0;

  const cls = ['item-card'];
  if (soldOut)    cls.push('sold-out');
  if (cartQty > 0) cls.push('in-cart');

  return (
    <div className={cls.join(' ')} onClick={() => !soldOut && onAdd(item)}>
      {/* Left: info */}
      <div className="item-card-info">
        <div>
          <div className="item-card-name">{item.name}</div>
          {item.description && (
            <div className="item-card-desc">{item.description}</div>
          )}
        </div>
        <div className="item-card-meta">
          <span className="item-card-price">{fmtPrice(item.base_price)}</span>
          {item.calories > 0 && <span className="item-card-cal">{item.calories} cal</span>}
          {hasModifiers && !soldOut && (
            <span style={{ fontSize:11, color:'#888', fontStyle:'italic' }}>Customizable</span>
          )}
          {!soldOut && (
            <button
              className="item-card-add"
              onClick={e => { e.stopPropagation(); onAdd(item); }}
              aria-label={`Add ${item.name}`}
            >
              {cartQty > 0 ? cartQty : '+'}
            </button>
          )}
        </div>
      </div>

      {/* Right: image */}
      <div className="item-card-img">
        {item.photo_url
          ? <img src={item.photo_url} alt={item.name} onError={e => { e.target.style.display='none'; }}/>
          : <span className="item-card-img-emoji">{item.emoji || '🍽️'}</span>
        }
        {soldOut && (
          <div className="item-sold-overlay"><span className="item-sold-tag">SOLD OUT</span></div>
        )}
        {hasModifiers && !soldOut && (
          <span className="item-custom-tag">Customize</span>
        )}
        {cartQty > 0 && (
          <span className="item-cart-qty">{cartQty} in cart</span>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MODIFIER MODAL
// ════════════════════════════════════════════════════════════════════════════
function ModifierModal({ item, onClose, onAddToCart }) {
  const [qty, setQty]        = useState(1);
  const [choices, setChoices] = useState({});
  const [note, setNote]       = useState('');

  const isValid = () => {
    for (const g of (item.modifier_groups || [])) {
      if (!g.required) continue;
      if (!(choices[g.id]?.size >= (g.min_select || 1))) return false;
    }
    return true;
  };

  const calcPrice = () => {
    let p = item.base_price;
    for (const g of (item.modifier_groups || [])) {
      const sel = choices[g.id] || new Set();
      const mods = g.modifiers || [];
      for (const m of mods) {
        if (sel.has(m.id)) p += (m.price_delta || 0);
      }
    }
    return p;
  };

  const toggle = (gId, mId, type) => {
    setChoices(prev => {
      const s = new Set(prev[gId] || []);
      if (type === 'single') return { ...prev, [gId]: new Set([mId]) };
      if (s.has(mId)) s.delete(mId); else s.add(mId);
      return { ...prev, [gId]: s };
    });
  };

  const handleAdd = () => {
    if (!isValid()) return;
    const mods = [];
    for (const g of (item.modifier_groups || [])) {
      const sel = choices[g.id] || new Set();
      for (const m of (g.modifiers || [])) {
        if (sel.has(m.id)) mods.push(m.price_delta ? `${m.name} (+${fmtPrice(m.price_delta)})` : m.name);
      }
    }
    const unitPrice = calcPrice();
    onAddToCart({ ...item, qty, unit_price: unitPrice, mods, note });
  };

  useEffect(() => {
    // Pre-select defaults
    const init = {};
    for (const g of (item.modifier_groups || [])) {
      const def = (g.modifiers || []).find(m => m.is_default);
      if (def) init[g.id] = new Set([def.id]);
    }
    setChoices(init);
  }, [item]);

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-hdr">
          <h2>{item.emoji} {item.name}</h2>
          <button className="close-btn" onClick={onClose}><IconX/></button>
        </div>
        <div className="modal-body">
          {item.description && (
            <p style={{ color:'#666', fontSize:14, marginBottom:16, lineHeight:1.5 }}>{item.description}</p>
          )}
          {(item.modifier_groups || []).map(g => (
            <div key={g.id} style={{ marginBottom:18 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <div style={{ fontWeight:700, fontSize:15 }}>{g.name}</div>
                <span style={{ fontSize:11, color:'#888', background:'#f5f5f5', borderRadius:4, padding:'2px 8px' }}>
                  {g.required ? 'Required' : 'Optional'}
                </span>
              </div>
              {(g.modifiers || []).map(m => {
                const selected = (choices[g.id] || new Set()).has(m.id);
                return (
                  <div key={m.id} onClick={() => toggle(g.id, m.id, g.type)}
                    style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 12px', borderRadius:8, cursor:'pointer', marginBottom:4,
                      background: selected ? '#fdecea' : '#f9f9f9', border:`1.5px solid ${selected ? CONFIG.accentColor : '#eee'}` }}>
                    <div style={{ width:20, height:20, borderRadius: g.type === 'single' ? '50%' : 4, border:`2px solid ${selected ? CONFIG.accentColor : '#ccc'}`,
                      background: selected ? CONFIG.accentColor : '#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      {selected && <IconCheck/>}
                    </div>
                    <span style={{ flex:1, fontSize:14, fontWeight: selected ? 700 : 400 }}>{m.name}</span>
                    {m.price_delta > 0 && <span style={{ fontSize:13, color:'#555' }}>+{fmtPrice(m.price_delta)}</span>}
                    {m.price_delta < 0 && <span style={{ fontSize:13, color:'#2e7d32' }}>{fmtPrice(m.price_delta)}</span>}
                  </div>
                );
              })}
            </div>
          ))}

          {/* Special note */}
          <div style={{ marginBottom:18 }}>
            <label className="field-label">Special Instructions (optional)</label>
            <textarea className="input" value={note} onChange={e => setNote(e.target.value)}
              placeholder="E.g. no onions, extra spicy…" rows={2}
              style={{ resize:'vertical', minHeight:60 }}/>
          </div>

          {/* Qty + Add */}
          <div style={{ display:'flex', gap:12, alignItems:'center' }}>
            <div style={{ display:'flex', alignItems:'center', border:'1.5px solid #ddd', borderRadius:10, overflow:'hidden' }}>
              <button onClick={() => setQty(q => Math.max(1, q-1))}
                style={{ width:44, height:48, border:'none', background:'#f5f5f5', cursor:'pointer', fontSize:20, fontWeight:700 }}>−</button>
              <span style={{ width:40, textAlign:'center', fontWeight:700, fontSize:16 }}>{qty}</span>
              <button onClick={() => setQty(q => q+1)}
                style={{ width:44, height:48, border:'none', background:'#f5f5f5', cursor:'pointer', fontSize:20, fontWeight:700 }}>+</button>
            </div>
            <button className="btn btn-red" onClick={handleAdd} disabled={!isValid()}
              style={{ flex:1, height:48, fontSize:16 }}>
              Add {qty} — {fmtPrice(calcPrice() * qty)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// CART DRAWER
// ════════════════════════════════════════════════════════════════════════════
function CartDrawer({ cart, open, onClose, onUpdateQty, onRemove, onClear, onCheckout }) {
  const count    = cart.reduce((s,i) => s + i.qty, 0);
  const subtotal = cart.reduce((s,i) => s + i.unit_price * i.qty, 0);
  const tax      = subtotal * CONFIG.taxRate;
  const total    = subtotal + tax;

  if (!open) return null;
  return (
    <>
      <div className="cart-overlay" onClick={onClose}/>
      <div className="cart-drawer">
        <div className="cart-hdr">
          <div>
            <h2>Your Order</h2>
            {count > 0 && <div style={{ fontSize:13, color:'#888', marginTop:2 }}>{count} item{count !== 1 ? 's' : ''}</div>}
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            {cart.length > 0 && (
              <button onClick={onClear} style={{ fontSize:12, color:'#999', background:'none', border:'1px solid #ddd', borderRadius:6, padding:'4px 10px', cursor:'pointer' }}>
                Clear all
              </button>
            )}
            <button className="close-btn" onClick={onClose}><IconX/></button>
          </div>
        </div>

        <div className="cart-body">
          {cart.length === 0 ? (
            <div style={{ textAlign:'center', padding:'60px 0', color:'#aaa' }}>
              <div style={{ fontSize:50, marginBottom:12 }}>🛒</div>
              <div style={{ fontWeight:700, fontSize:16 }}>Your cart is empty</div>
              <div style={{ fontSize:13, marginTop:4 }}>Browse the menu and add items</div>
            </div>
          ) : (
            cart.map((item, idx) => (
              <div key={idx} className="cart-row">
                <span className="cart-row-emoji">{item.emoji || '🍽️'}</span>
                <div className="cart-row-info">
                  <div className="cart-row-name">{item.name}</div>
                  {item.mods?.length > 0 && (
                    <div className="cart-row-mods">{item.mods.join(' · ')}</div>
                  )}
                  {item.note && (
                    <div style={{ fontSize:12, color:'#e65100', fontStyle:'italic', marginTop:2 }}>📝 {item.note}</div>
                  )}
                  <div className="cart-row-price">{fmtPrice(item.unit_price)}</div>
                </div>
                <div className="cart-qty-ctrl">
                  <div className="cart-qty-row">
                    <button className="cart-qty-btn" onClick={() => onUpdateQty(idx, item.qty-1)}>−</button>
                    <span className="cart-qty-num">{item.qty}</span>
                    <button className="cart-qty-btn" onClick={() => onUpdateQty(idx, item.qty+1)}>+</button>
                  </div>
                  <button className="cart-remove" onClick={() => onRemove(idx)}>Remove</button>
                </div>
              </div>
            ))
          )}
        </div>

        {cart.length > 0 && (
          <div className="cart-ftr">
            <div className="cart-totals">
              <div className="cart-total-row"><span>Subtotal</span><span>{fmtPrice(subtotal)}</span></div>
              <div className="cart-total-row"><span>Tax ({(CONFIG.taxRate*100).toFixed(0)}%)</span><span>{fmtPrice(tax)}</span></div>
            </div>
            <div className="cart-grand"><span>Total</span><span style={{ color:CONFIG.accentColor }}>{fmtPrice(total)}</span></div>
            <button className="btn btn-red" onClick={onCheckout} style={{ width:'100%', height:52, fontSize:16, borderRadius:12 }}>
              💳 Checkout → {fmtPrice(total)}
            </button>
            <p style={{ fontSize:11, color:'#bbb', textAlign:'center', marginTop:10, display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
              <IconLock/> Secure payment via Stripe
            </p>
          </div>
        )}
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// CHECKOUT FLOW
// ════════════════════════════════════════════════════════════════════════════
function CheckoutFlow({ cart, posUrl, isDemo, onClose }) {
  const [step, setStep] = useState('info');
  const [orderNum, setOrderNum] = useState('');
  const [type, setType] = useState('pickup');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [addr, setAddr] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');

  const subtotal = cart.reduce((s,i) => s + i.unit_price * i.qty, 0);
  const tax      = subtotal * CONFIG.taxRate;
  const total    = subtotal + tax;

  const validate = () => {
    if (!name.trim())  { setErr('Please enter your name'); return false; }
    if (!phone.trim()) { setErr('Please enter your phone number'); return false; }
    if (type === 'delivery' && !addr.trim()) { setErr('Please enter your delivery address'); return false; }
    setErr(''); return true;
  };

  const submitOrder = async () => {
    if (!validate()) return;
    if (step === 'info') { setStep('review'); return; }
    setStep('paying');

    // isDemo check removed — cloud backend always available

    try {
      // Always use permanent cloud backend — no local tunnel needed
      const CLOUD_URL = 'https://jeti-f4fa11f5.base44.app/functions/onlineOrderPage?action=submit';
      const res = await fetch(CLOUD_URL, {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({
          name: name.trim(), phone: phone.trim(),
          email: email.trim(), type: type,
          address: addr.trim(), note: note.trim(),
          items: cart.map(i => ({ name:i.name, qty:i.qty, price:i.unit_price||i.base_price||0 })),
        }),
        signal: AbortSignal.timeout(20000),
      });
      const data = await res.json();
      if (data.ok) {
        setOrderNum(data.order_number || '');
        setStep('done');
      } else { setErr(data.error || 'Order failed. Please try again.'); setStep('review'); }
    } catch(e) { setErr(e.message || 'Network error — check your connection.'); setStep('review'); }
  };

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && step !== 'paying' && onClose()}>
      <div className="modal">
        <div className="modal-hdr">
          <h2>{ step==='info' ? '📋 Your Details' : step==='review' ? '✅ Review & Pay' : '⏳ Processing…' }</h2>
          {step !== 'paying' && <button className="close-btn" onClick={onClose}><IconX/></button>}
        </div>
        <div className="modal-body">

          {step === 'done' && (
            <div style={{ textAlign:'center', padding:'48px 24px' }}>
              <div style={{ fontSize:64, marginBottom:16 }}>✅</div>
              <h2 style={{ color:'#2d7a3a', marginBottom:8 }}>Order Placed!</h2>
              <p style={{ fontSize:15, color:'#555', marginBottom:6 }}>Order # {orderNum}</p>
              <p style={{ fontSize:13, color:'#777', marginBottom:24 }}>Ready for pickup in ~15–20 min. Call (856) 856-2202 with changes.</p>
              <button className="btn-primary" onClick={onClose} style={{ width:'100%', padding:'14px', fontSize:16 }}>Done</button>
            </div>
          )}
          {step === 'paying' && (
            <div style={{ textAlign:'center', padding:'48px 0' }}>
              <div className="spinner" style={{ margin:'0 auto 20px', width:52, height:52 }}/>
              <div style={{ fontWeight:700, fontSize:16, marginBottom:6 }}>Creating secure checkout…</div>
              <div style={{ color:'#888', fontSize:13 }}>Redirecting to Stripe…</div>
            </div>
          )}

          {step === 'info' && (
            <>
              <div style={{ display:'flex', gap:10, marginBottom:18 }}>
                {['pickup','delivery'].map(t => (
                  <button key={t} onClick={() => setType(t)} className="btn"
                    style={{ flex:1, background: type===t ? CONFIG.accentColor : '#f0f0f0', color: type===t ? '#fff' : '#333', fontSize:14 }}>
                    {t === 'pickup' ? '🏪 Pickup' : '🛵 Delivery'}
                  </button>
                ))}
              </div>

              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div><label className="field-label">Full Name *</label>
                  <input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="John Smith"/></div>
                <div><label className="field-label">Phone Number *</label>
                  <input className="input" type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="(555) 123-4567"/></div>
                <div><label className="field-label">Email (for receipt)</label>
                  <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></div>
                {type === 'delivery' && (
                  <div><label className="field-label">Delivery Address *</label>
                    <input className="input" value={addr} onChange={e=>setAddr(e.target.value)} placeholder="123 Main St, City, State"/></div>
                )}
                <div><label className="field-label">Order Notes</label>
                  <textarea className="input" value={note} onChange={e=>setNote(e.target.value)}
                    placeholder="Any special requests?" rows={2} style={{ resize:'vertical' }}/></div>
              </div>

              {err && <div style={{ color:'#c62828', fontSize:13, marginTop:10, padding:'8px 12px', background:'#fdecea', borderRadius:6 }}>{err}</div>}

              <button className="btn btn-red" onClick={submitOrder} style={{ width:'100%', height:50, fontSize:16, marginTop:18 }}>
                Review Order →
              </button>
            </>
          )}

          {step === 'review' && (
            <>
              <div style={{ background:'#f9f9f9', borderRadius:10, padding:'14px 16px', marginBottom:16 }}>
                <div style={{ fontWeight:700, fontSize:14, marginBottom:10, color:'#555' }}>Order Summary</div>
                {cart.map((item, i) => (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:14, marginBottom:6 }}>
                    <span>{item.qty}× {item.name}{item.mods?.length ? ` (${item.mods.join(', ')})` : ''}</span>
                    <span style={{ fontWeight:600 }}>{fmtPrice(item.unit_price * item.qty)}</span>
                  </div>
                ))}
                <div style={{ borderTop:'1px solid #e0e0e0', paddingTop:8, marginTop:8 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'#666', marginBottom:4 }}>
                    <span>Subtotal</span><span>{fmtPrice(subtotal)}</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'#666', marginBottom:8 }}>
                    <span>Tax ({(CONFIG.taxRate*100).toFixed(0)}%)</span><span>{fmtPrice(tax)}</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontWeight:900, fontSize:18 }}>
                    <span>Total</span><span style={{ color:CONFIG.accentColor }}>{fmtPrice(total)}</span>
                  </div>
                </div>
              </div>

              <div style={{ background:'#f9f9f9', borderRadius:10, padding:'12px 16px', marginBottom:16, fontSize:13, lineHeight:1.7 }}>
                <strong>{type === 'pickup' ? '🏪 Pickup' : '🛵 Delivery'}</strong><br/>
                {name} · {phone}{email ? ` · ${email}` : ''}
                {type === 'delivery' && addr ? <><br/>{addr}</> : null}
                {note ? <><br/>📝 {note}</> : null}
              </div>

              {err && <div style={{ color:'#c62828', fontSize:13, marginBottom:12, padding:'8px 12px', background:'#fdecea', borderRadius:6 }}>{err}</div>}

              <div style={{ display:'flex', gap:10 }}>
                <button className="btn btn-gray" onClick={() => { setStep('info'); setErr(''); }} style={{ padding:'12px 20px' }}>← Back</button>
                <button className="btn btn-red" onClick={submitOrder} style={{ flex:1, height:50, fontSize:16 }}>
                  💳 Pay {fmtPrice(total)} →
                </button>
              </div>
              <p style={{ fontSize:11, color:'#bbb', textAlign:'center', marginTop:10, display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
                <IconLock/> Secure payment via Stripe
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SUCCESS / CANCELLED BANNERS
// ════════════════════════════════════════════════════════════════════════════
function SuccessBanner({ orderNum, onClose }) {
  return (
    <div style={{ background:'#e8f5e9', border:'2px solid #4caf50', borderRadius:14, padding:'20px 24px', margin:'16px 20px', display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, animation:'slideUp .3s ease' }}>
      <div>
        <div style={{ fontWeight:800, fontSize:17, color:'#2e7d32', marginBottom:4 }}>🎉 Order Placed!</div>
        <div style={{ fontSize:14, color:'#388e3c' }}>Your order is confirmed. Kitchen is on it!{orderNum ? ` Order #${orderNum}.` : ''}</div>
      </div>
      <button onClick={onClose} className="close-btn" style={{ background:'#c8e6c9' }}><IconX/></button>
    </div>
  );
}
function CancelledBanner({ onClose }) {
  return (
    <div style={{ background:'#fff3e0', border:'2px solid #ff9800', borderRadius:14, padding:'20px 24px', margin:'16px 20px', display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
      <div>
        <div style={{ fontWeight:800, fontSize:17, color:'#e65100', marginBottom:4 }}>Order Cancelled</div>
        <div style={{ fontSize:14, color:'#ef6c00' }}>Payment was cancelled. Your cart is still saved — try again anytime.</div>
      </div>
      <button onClick={onClose} className="close-btn" style={{ background:'#ffe0b2' }}><IconX/></button>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// FLOATING CART BUTTON (mobile only — shown via CSS)
// ════════════════════════════════════════════════════════════════════════════
function FloatingCart({ count, total, onClick }) {
  if (count === 0) return null;
  return (
    <div className="float-cart">
      <button className="float-cart-btn" onClick={onClick}>
        <span style={{ display:'flex', alignItems:'center', gap:10 }}>
          <IconCart/>
          <span>View Order</span>
        </span>
        <span className="float-cart-count">{count} item{count!==1?'s':''} · {fmtPrice(total)}</span>
      </button>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ════════════════════════════════════════════════════════════════════════════
function App() {
  const posUrlParam = PARAMS.get('pos') || '';
  // ?skip=1 jumps straight to demo menu (for testing layout)
  const skipToDemo = PARAMS.get('skip') === '1';
  const [posUrl, setPosUrl]       = useLocalStorage('bfm_pos_url_v2', PARAMS.get('demo') === '1' ? '' : (posUrlParam || null));
  const [storeInfo, setStoreInfo] = useState(null);
  const [isDemo, setIsDemo]       = useState(PARAMS.get('demo') === '1');
  const [menu, setMenu]           = useState(PARAMS.get('demo') === '1' ? DEMO_MENU : null);
  const [loading, setLoading]     = useState(false);
  const [menuError, setMenuErr]   = useState('');
  const [activeCat, setActiveCat] = useState(PARAMS.get('demo') === '1' ? DEMO_MENU.categories[0].id : null);
  const [search, setSearch]       = useState('');
  const [cart, setCart]           = useLocalStorage('bfm_cart_v3', []);
  const [cartOpen, setCartOpen]   = useState(false);
  const [modItem, setModItem]     = useState(null);
  const [checkout, setCheckout]   = useState(false);

  const [banner, setBanner] = useState(() => {
    if (PARAMS.get('order_success'))   return { type:'success',   order: PARAMS.get('order') || '' };
    if (PARAMS.get('order_cancelled')) return { type:'cancelled' };
    return null;
  });

  useEffect(() => {
    if (banner) {
      window.history.replaceState({}, '', window.location.pathname);
      if (banner.type === 'success') { setCart([]); toast('🎉 Order placed! Kitchen is on it.', 'success', 5000); }
    }
  }, []);

  const loadMenu = useCallback(async () => {
    if (posUrl === null || posUrl === undefined || posUrl === '') return;
    // Cloud mode: menu already loaded via SetupScreen — no need to re-fetch
    if (posUrl === '__cloud__') return;
    setLoading(true); setMenuErr('');
    const tryFetch = async (base) => {
      const [mr, sr] = await Promise.allSettled([
        posFetch(`${base}/menu`,       { signal: AbortSignal.timeout(8000) }),
        posFetch(`${base}/store-info`, { signal: AbortSignal.timeout(5000) }),
      ]);
      return { mr, sr };
    };
    let base = posUrl || '';
    let { mr, sr } = await tryFetch(base);
    // Cloud mode: no tunnel fallback needed
    if (mr.status === 'fulfilled' && mr.value.ok) {
      setMenu(mr.value);
      if (mr.value.categories?.length) setActiveCat(mr.value.categories[0].id);
    } else {
      setMenuErr(mr.status === 'rejected' ? (mr.reason?.message || 'Failed to load menu.') : mr.value?.error || 'Failed to load menu');
    }
    if (sr.status === 'fulfilled' && sr.value.ok) setStoreInfo(sr.value);
    setLoading(false);
  }, [posUrl]);

  useEffect(() => {
    if (posUrl === null && !isDemo) {
      const origin = window.location.origin;
      if (origin.includes('trycloudflare.com') || origin.includes('localhost') || origin.includes('127.0.0.1')) {
        setPosUrl('');
      }
    }
  }, []);

  useEffect(() => { if (posUrl !== null && posUrl !== undefined && !isDemo) loadMenu(); }, [posUrl, loadMenu, isDemo]);

  const useDemo = () => {
    const cloud = window._cloudMenu;
    if (cloud && cloud.categories && cloud.categories.length > 0) {
      setIsDemo(false); setPosUrl('__cloud__');
      setMenu({ store_name: cloud.store_name || 'Rice Plus Grill', categories: cloud.categories, items: cloud.items || [] });
      setActiveCat(cloud.categories[0].id);
    } else {
      setIsDemo(true); setPosUrl('');
      setMenu(DEMO_MENU);
      setActiveCat(DEMO_MENU.categories[0].id);
    }
  };

  const cartCount = cart.reduce((s,i) => s + i.qty, 0);
  const cartTotal = cart.reduce((s,i) => s + i.unit_price * i.qty, 0);
  const cartQtyFor = (id) => cart.filter(i => i.id === id).reduce((s,i) => s + i.qty, 0);

  const handleAdd = (item) => {
    if ((item.modifier_groups || []).length > 0) { setModItem(item); }
    else { addToCart({ ...item, qty:1, unit_price:item.base_price, mods:[], note:'' }); }
  };
  const addToCart = (item) => {
    setCart(prev => {
      const modsKey = JSON.stringify(item.mods || []);
      const idx = prev.findIndex(c => c.id === item.id && JSON.stringify(c.mods||[]) === modsKey && !c.note && !item.note);
      if (idx >= 0) { const n=[...prev]; n[idx]={...n[idx],qty:n[idx].qty+item.qty}; return n; }
      return [...prev, item];
    });
    toast(`${item.name} added!`, 'success', 1800);
  };

  if (skipToDemo && !isDemo) {
    setTimeout(() => { setIsDemo(true); setPosUrl(''); setMenu(DEMO_MENU); setActiveCat(DEMO_MENU.categories[0].id); }, 0);
  }

  const handleConnect = (url, info) => {
    setPosUrl(url);
    setStoreInfo(info);
    if (url === '__cloud__' && info && info.categories) {
      setMenu({ store_name: info.store_name || 'Rice Plus Grill', categories: info.categories, items: info.items || [] });
      if (info.categories[0]) setActiveCat(info.categories[0].id);
    }
  };
  if (posUrl === null && !isDemo && !skipToDemo) {
    return <SetupScreen onConnect={handleConnect} onSkip={useDemo}/>;
  }

  const storeName = storeInfo?.name || menu?.store_name || CONFIG.storeName;

  return (
    <div style={{ minHeight:'100vh' }}>
      <Header
        storeName={storeName} isDemo={isDemo}
        cartCount={cartCount} cartTotal={cartTotal}
        onCartOpen={() => setCartOpen(true)}
        search={search} onSearch={v => { setSearch(v); if (v) setActiveCat(null); }}
      />

      {!search && !loading && menu && <HeroBanner/>}
      {!search && !loading && menu && <PromoBanner/>}

      {banner?.type === 'success'   && <SuccessBanner   orderNum={banner.order} onClose={() => setBanner(null)}/>}
      {banner?.type === 'cancelled' && <CancelledBanner onClose={() => setBanner(null)}/>}

      {loading && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'80px 20px', gap:14 }}>
          <div className="spinner"/>
          <p style={{ color:'#888', fontSize:14 }}>Loading menu…</p>
        </div>
      )}

      {!loading && menuError && (
        <div style={{ maxWidth:600, margin:'40px auto', padding:'0 20px' }}>
          <div style={{ background:'#fdecea', border:'1px solid #ffcdd2', borderRadius:12, padding:'28px 20px', textAlign:'center' }}>
            <div style={{ fontSize:44, marginBottom:10 }}>⚠️</div>
            <div style={{ fontWeight:700, fontSize:17, color:'#c62828', marginBottom:6 }}>Couldn't reach POS</div>
            <div style={{ color:'#555', fontSize:14, marginBottom:18 }}>{menuError}</div>
            <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
              <button className="btn btn-red" onClick={() => setPosUrl(null)}>Auto-Reconnect</button>
              <button className="btn btn-outline" onClick={loadMenu}>Retry</button>
              <button className="btn btn-gray" onClick={useDemo}>Demo Menu</button>
            </div>
          </div>
        </div>
      )}

      {!loading && menu && (
        <>
          {/* Mobile horizontal category tabs */}
          {!search && (
            <CategoryScrollBar categories={menu.categories} active={activeCat} onSelect={id => { setActiveCat(id); setSearch(''); }}/>
          )}

          {/* Wawa-style layout: sidebar + item list */}
          <MenuLayout
            menu={menu} search={search}
            activeCat={activeCat} onCatSelect={id => { setActiveCat(id); setSearch(''); }}
            cartQtyFor={cartQtyFor} onAdd={handleAdd}
          />
        </>
      )}

      {modItem && (
        <ModifierModal item={modItem} onClose={() => setModItem(null)} onAddToCart={item => { addToCart(item); setModItem(null); }}/>
      )}

      <CartDrawer
        cart={cart} open={cartOpen} onClose={() => setCartOpen(false)}
        onUpdateQty={(idx, qty) => {
          if (qty <= 0) setCart(p => p.filter((_,i) => i !== idx));
          else setCart(p => p.map((x,i) => i === idx ? {...x, qty} : x));
        }}
        onRemove={idx => setCart(p => p.filter((_,i) => i !== idx))}
        onClear={() => { setCart([]); setCartOpen(false); toast('Cart cleared', 'info'); }}
        onCheckout={() => { setCartOpen(false); setCheckout(true); }}
      />

      {checkout && (
        <CheckoutFlow cart={cart} posUrl={posUrl} isDemo={isDemo} onClose={() => setCheckout(false)}/>
      )}

      {/* Floating cart button — CSS shows this on mobile only */}
      <FloatingCart count={cartCount} total={cartTotal * (1 + CONFIG.taxRate)} onClick={() => setCartOpen(true)}/>

      <footer style={{ textAlign:'center', padding:'40px 20px 120px', color:'#ccc', fontSize:12, borderTop:'1px solid #eee', marginTop:20 }}>
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
