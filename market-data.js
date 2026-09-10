// ============ Market Data Engine ============
// Seeded realistic prices + random-walk animation

const INSTRUMENTS = {
  crypto: [
    { sym: 'BTC',   name: 'Bitcoin',     price: 77267.30, vol: 0.0015 },
    { sym: 'ETH',   name: 'Ethereum',    price: 2465.75,  vol: 0.0018 },
    { sym: 'SOL',   name: 'Solana',      price: 99.95,   vol: 0.0030 },
    { sym: 'DOGE',  name: 'Dogecoin',    price: 2.3065,   vol: 0.0045 },
    { sym: 'XRP',   name:'Ripple',      price: 2.965,     vol: 0.0028 },
    { sym: 'ADA',   name: 'Cardano',     price: 10.04,     vol: 0.0032 },
    { sym: 'BNB',   name: 'BNB',         price: 79.960,   vol: 0.0020 },
    { sym: 'LINK',  name: 'Chainlink',   price: 7.94,    vol: 0.0028 },
  ],
  stocks: [
    { sym: 'TSLA',  name: 'Tesla Inc.',           price: 363.18, vol: 0.0020 },
    { sym: 'SPACEX',name: 'SpaceX (Private)',     price: 154.95, vol: 0.0012 },
    { sym: 'RKLB',  name: 'Rocket Lab',           price: 107.42,  vol: 0.0020 },
    { sym: 'ASTS',  name: 'AST SpaceMobile',      price: 80.10,  vol: 0.0025 },
    { sym: 'LMT',   name: 'Lockheed Martin',      price: 510.75, vol: 0.0008 },
    { sym: 'BA',    name: 'Boeing',               price: 222.92, vol: 0.0012 },
    { sym: 'NVDA',  name: 'NVIDIA',               price: 210.50, vol: 0.0014 },
    { sym: 'MAXR',  name: 'Maxar Technologies',   price: 55.20,  vol: 0.0018 },
    { sym: 'IRDM',  name:'Iridium Communications',price: 44.80, vol: 0.0015 },
  ],
  forex: [
    { sym: 'EUR/USD', name: 'Euro / Dollar',          price: 1.1609, vol: 0.0004 },
    { sym: 'GBP/USD', name: 'Pound / Dollar',         price: 1.3508, vol: 0.0005 },
    { sym: 'USD/JPY', name: 'Dollar / Yen',           price: 154.41, vol: 0.0005 },
    { sym: 'USD/CHF', name: 'Dollar / Franc',         price: 0.8132, vol: 0.0004 },
    { sym: 'AUD/USD', name: 'Aussie / Dollar',        price: 0.6512, vol: 0.0006 },
    { sym: 'USD/CAD', name: 'Dollar / Loonie',        price: 1.3834, vol: 0.0004 },
    { sym: 'NZD/USD', name: 'Kiwi / Dollar',          price: 0.5795, vol: 0.0006 },
    { sym: 'EUR/GBP', name: 'Euro / Pound',           price: 0.8494, vol: 0.0004 },
  ],
};

// flat lookup
const ALL = {};
Object.values(INSTRUMENTS).flat().forEach(i => {
  i.basePrice = i.price;
  i.changePct = (Math.random() - 0.5) * 4; // initial day change -2% to +2%
  i.history = Array.from({ length: 60 }, () => i.price * (1 + (Math.random() - 0.5) * 0.01));
  ALL[i.sym] = i;
});

function tick() {
  Object.values(ALL).forEach(i => {
    const drift = (Math.random() - 0.5) * 2 * i.vol;
    const newPrice = i.price * (1 + drift);
    i.prevPrice = i.price;
    i.price = +newPrice.toFixed(i.price < 10 ? 4 : 2);
    i.changePct = ((i.price - i.basePrice) / i.basePrice) * 100;
    i.history.push(i.price);
    if (i.history.length > 60) i.history.shift();
  });
  document.dispatchEvent(new CustomEvent('market:tick'));
}

setInterval(tick, 1500);

// Formatters
function fmtPrice(p) {
  if (p < 1) return p.toFixed(4);
  if (p < 100) return p.toFixed(2);
  return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtPct(p) { return (p >= 0 ? '+' : '') + p.toFixed(2) + '%'; }

// Tiny sparkline renderer
function drawSpark(canvas, history, color) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.offsetWidth * devicePixelRatio;
  const h = canvas.height = canvas.offsetHeight * devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);
  const W = canvas.offsetWidth, H = canvas.offsetHeight;
  ctx.clearRect(0, 0, w, h);
  const min = Math.min(...history), max = Math.max(...history);
  const range = max - min || 1;
  ctx.beginPath();
  history.forEach((v, idx) => {
    const x = (idx / (history.length - 1)) * W;
    const y = H - ((v - min) / range) * H * 0.85 - H * 0.075;
    if (idx === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // fill
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, color + '40'); grad.addColorStop(1, color + '00');
  ctx.fillStyle = grad; ctx.fill();
}

// Full chart
function drawChart(canvas, history, color) {
  const ctx = canvas.getContext('2d');
  const dpr = devicePixelRatio;
  canvas.width = canvas.offsetWidth * dpr;
  canvas.height = canvas.offsetHeight * dpr;
  ctx.scale(dpr, dpr);
  const W = canvas.offsetWidth, H = canvas.offsetHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // grid
  ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i++) {
    const y = (H / 5) * i;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  const min = Math.min(...history), max = Math.max(...history);
  const range = max - min || 1;
  // labels
  ctx.fillStyle = 'rgba(154,163,199,.7)'; ctx.font = '11px -apple-system, sans-serif';
  for (let i = 0; i <= 4; i++) {
    const v = max - (range / 4) * i;
    ctx.fillText(fmtPrice(v), W - 60, (H / 4) * i + 12);
  }
  // line
  ctx.beginPath();
  history.forEach((v, idx) => {
    const x = (idx / (history.length - 1)) * (W - 60);
    const y = H - ((v - min) / range) * H * 0.85 - H * 0.075;
    if (idx === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
  // fill
  ctx.lineTo(W - 60, H); ctx.lineTo(0, H); ctx.closePath();
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, color + '55'); grad.addColorStop(1, color + '00');
  ctx.fillStyle = grad; ctx.fill();
}

window.Market = { INSTRUMENTS, ALL, fmtPrice, fmtPct, drawSpark, drawChart };
