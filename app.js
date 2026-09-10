// ============ Shared App Utilities (Supabase-backed) ============
// /js/supa.js must load first (defines window.sb).

const Cache = {
  user: null, isAdmin: false,
  orders: [], investments: [], deposits: [], withdrawals: [],
  allUsers: [], allDeposits: [], allWithdrawals: [], adminRoles: {},
};

async function loadUserData(uid) {
  const [a, b, c, d] = await Promise.all([
    sb.from('orders').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(500),
    sb.from('investments').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
    sb.from('deposits').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(100),
    sb.from('withdrawals').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(100),
  ]);
  Cache.orders = a.data || []; Cache.investments = b.data || [];
  Cache.deposits = c.data || []; Cache.withdrawals = d.data || [];
}

async function loadAdminData() {
  const [u, d, w, r] = await Promise.all([
    sb.from('profiles').select('*').order('created_at', { ascending: false }),
    sb.from('deposits').select('*').order('created_at', { ascending: false }),
    sb.from('withdrawals').select('*').order('created_at', { ascending: false }),
    sb.from('user_roles').select('user_id, role'),
  ]);
  Cache.allUsers = u.data || []; Cache.allDeposits = d.data || []; Cache.allWithdrawals = w.data || [];
  Cache.adminRoles = {};
  (r.data || []).forEach(x => { (Cache.adminRoles[x.user_id] = Cache.adminRoles[x.user_id] || []).push(x.role); });
}

const ready = (async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  const uid = session.user.id;
  const { data: profile } = await sb.from('profiles').select('*').eq('id', uid).maybeSingle();
  if (!profile) return;
  Cache.user = profile;
  const { data: roles } = await sb.from('user_roles').select('role').eq('user_id', uid);
  Cache.isAdmin = !!(roles || []).find(r => r.role === 'admin');
  if (Cache.isAdmin) await loadAdminData();
  await loadUserData(uid);
})();

const Auth = {
  current() { return Cache.user ? { id: Cache.user.id, username: Cache.user.username } : null; },
  getUser() {
    if (!Cache.user) return null;
    return { ...Cache.user, balance: Number(Cache.user.balance) || 0, createdAt: new Date(Cache.user.created_at).getTime() };
  },
  users() {
    return Cache.allUsers.map(u => ({
      ...u, balance: Number(u.balance) || 0,
      createdAt: new Date(u.created_at).getTime(),
      role: (Cache.adminRoles[u.id] || []).includes('admin') ? 'admin' : 'user',
    }));
  },
  async signup(data) {
    const { data: auth, error } = await sb.auth.signUp({
      email: data.email, password: data.password,
      options: {
        emailRedirectTo: window.location.origin + '/dashboard.html',
        data: { full_name: data.full_name, username: data.username, phone: data.phone, country: data.country },
      },
    });
    if (error) throw new Error(error.message);
    if (!auth.session) throw new Error('Check your email to confirm your account.');
    return auth.user;
  },
  async login(idOrEmail, password) {
    let email = idOrEmail;
    if (!idOrEmail.includes('@')) {
      const { data, error } = await sb.rpc('lookup_email_by_username', { p_username: idOrEmail });
      if (error || !data) throw new Error('Invalid credentials');
      email = data;
    }
    const { data: auth, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error('Invalid credentials');
    const uid = auth.user.id;
    const { data: profile } = await sb.from('profiles').select('*').eq('id', uid).maybeSingle();
    if (profile && profile.blocked) {
      await sb.auth.signOut();
      const err = new Error('SUSPENDED'); err.suspended = true; throw err;
    }
    const { data: roles } = await sb.from('user_roles').select('role').eq('user_id', uid);
    const isAdmin = !!(roles || []).find(r => r.role === 'admin');
    return { ...(profile || {}), role: isAdmin ? 'admin' : 'user' };
  },
  async logout() { await sb.auth.signOut(); window.location.href = '/login.html'; },
  async updateUser(patch) {
    if (!Cache.user) return;
    const dbPatch = { ...patch };
    if ('balance' in dbPatch) dbPatch.balance = Number(dbPatch.balance);
    const { data } = await sb.from('profiles').update(dbPatch).eq('id', Cache.user.id).select().maybeSingle();
    if (data) Cache.user = data;
  },
  require() {
    if (!Cache.user) { window.location.href = '/login.html'; return false; }
    if (Cache.user.blocked) { window.location.href = '/suspended.html'; return false; }
    return true;
  },
  isAdmin() { return Cache.isAdmin; },
  requireAdmin() {
    if (!Auth.require()) return false;
    if (!Cache.isAdmin) { window.location.href = '/dashboard.html'; return false; }
    return true;
  },
  async adminSetBalance(userId, balance) {
    const { data } = await sb.from('profiles').update({ balance }).eq('id', userId).select().maybeSingle();
    if (data) { const i = Cache.allUsers.findIndex(u=>u.id===userId); if (i>=0) Cache.allUsers[i] = data; }
  },
  async adminSetBlocked(userId, blocked) {
    const patch = { blocked, blocked_reason: blocked ? 'Suspicious activity' : null };
    const { data } = await sb.from('profiles').update(patch).eq('id', userId).select().maybeSingle();
    if (data) { const i = Cache.allUsers.findIndex(u=>u.id===userId); if (i>=0) Cache.allUsers[i] = data; }
  },
  async adminDeleteUser(userId) {
    await sb.from('profiles').delete().eq('id', userId);
    Cache.allUsers = Cache.allUsers.filter(u => u.id !== userId);
  },
};

const Orders = {
  forUser() {
    return Cache.orders.map(o => ({
      id: o.id, userId: o.user_id, symbol: o.symbol, side: o.side,
      qty: Number(o.qty), price: Number(o.price), total: Number(o.total),
      at: new Date(o.created_at).getTime(),
    }));
  },
  async add(o) {
    const row = {
      user_id: Cache.user.id, symbol: o.symbol, side: o.side,
      qty: o.qty, price: o.price, total: o.total,
    };
    const { data, error } = await sb.from('orders').insert(row).select().maybeSingle();
    if (error) { toast('Order failed: ' + error.message, 'error'); throw error; }
    if (data) Cache.orders.unshift(data);
  },
};

const Portfolio = {
  holdings() {
    const orders = Orders.forUser().filter(o => o.symbol !== 'SPACEX');
    const map = {};
    orders.slice().reverse().forEach(o => {
      const h = map[o.symbol] || { qty: 0, costBasis: 0 };
      if (o.side === 'buy') { h.qty += o.qty; h.costBasis += o.total; }
      else if (h.qty > 0) {
        const sellQty = Math.min(h.qty, o.qty);
        h.costBasis -= (h.costBasis / h.qty) * sellQty;
        h.qty -= sellQty;
      }
      map[o.symbol] = h;
    });
    return Object.entries(map).filter(([, h]) => h.qty > 1e-8)
      .map(([sym, h]) => ({ symbol: sym, qty: h.qty, avgPrice: h.costBasis / h.qty, costBasis: h.costBasis }));
  },
  investments() {
    return Cache.investments.filter(i => i.status === 'active').map(i => ({
      id: i.id, shares: Number(i.shares), entryPrice: Number(i.entry_price),
      duration: i.duration, status: i.status,
      maturesAt: new Date(i.matures_at).getTime(),
      createdAt: new Date(i.created_at).getTime(),
    }));
  },
  qtyOf(_uid, symbol) { const h = Portfolio.holdings().find(x => x.symbol === symbol); return h ? h.qty : 0; },
  summary() {
    let openPL = 0, positions = 0;
    Portfolio.holdings().forEach(h => {
      const inst = (window.Market && Market.ALL[h.symbol]); if (!inst) return;
      openPL += (inst.price - h.avgPrice) * h.qty; positions += 1;
    });
    const invs = Portfolio.investments();
    const spx = window.Market && Market.ALL['SPACEX'];
    invs.forEach(i => {
      positions += 1; if (!spx) return;
      const cost = i.entryPrice * i.shares;
      const marketVal = spx.price * i.shares;
      const DURS = { '1h': 0.05, '1d': 0.12, '7d': 0.28, '30d': 0.65, '90d': 1.20 };
      const MS = { '1h': 3600e3, '1d': 86400e3, '7d': 7*86400e3, '30d': 30*86400e3, '90d': 90*86400e3 };
      const apr = DURS[i.duration] || 0;
      const ms = MS[i.duration] || 0;
      const remaining = Math.max(0, i.maturesAt - Date.now());
      const elapsedFrac = ms > 0 ? Math.min(1, 1 - remaining / ms) : 0;
      const yrs = ms / (365 * 86400e3);
      openPL += (marketVal - cost) + cost * apr * yrs * elapsedFrac;
    });
    return { openPL, positions };
  },
};

const Investments = {
  list() { return Cache.investments.slice(); },
  async create(inv) {
    const row = {
      user_id: Cache.user.id, shares: inv.shares, entry_price: inv.entryPrice,
      duration: inv.duration, matures_at: new Date(inv.maturesAt).toISOString(), status: 'active',
    };
    const { data } = await sb.from('investments').insert(row).select().maybeSingle();
    if (data) Cache.investments.unshift(data);
  },
  async close(id, exitPrice, payout) {
    const patch = { status: 'closed', exit_price: exitPrice, payout, closed_at: new Date().toISOString() };
    const { data } = await sb.from('investments').update(patch).eq('id', id).select().maybeSingle();
    if (data) { const i = Cache.investments.findIndex(x => x.id === id); if (i>=0) Cache.investments[i] = data; }
  },
};

const Deposits = {
  forUser() {
    return Cache.deposits.map(d => ({
      id: d.id, userId: d.user_id, coin: d.method, amount: Number(d.amount),
      txid: d.txid, status: d.status, at: new Date(d.created_at).getTime(),
    }));
  },
  async create({ coin, amount, txid, proofDataUrl }) {
    let proof_url = null;
    if (proofDataUrl) {
      try {
        const blob = await (await fetch(proofDataUrl)).blob();
        const path = `${Cache.user.id}/${Date.now()}.png`;
        const up = await sb.storage.from('deposit-proofs').upload(path, blob, { contentType: blob.type || 'image/png' });
        if (!up.error) proof_url = path;
      } catch {}
    }
    const { data, error } = await sb.from('deposits').insert({
      user_id: Cache.user.id, method: coin, amount, txid: txid || null, proof_url, status: 'pending',
    }).select().maybeSingle();
    if (error) throw new Error(error.message);
    Cache.deposits.unshift(data);
  },
  async adminApprove(id) {
    const d = Cache.allDeposits.find(x => x.id === id); if (!d) return;
    const { data: u } = await sb.from('profiles').select('balance').eq('id', d.user_id).maybeSingle();
    if (u) await sb.from('profiles').update({ balance: Number(u.balance) + Number(d.amount) }).eq('id', d.user_id);
    await sb.from('deposits').update({ status: 'approved' }).eq('id', id);
    await loadAdminData();
  },
  async adminReject(id) {
    await sb.from('deposits').update({ status: 'rejected' }).eq('id', id);
    await loadAdminData();
  },
};

const Withdrawals = {
  forUser() {
    return Cache.withdrawals.map(w => ({
      id: w.id, userId: w.user_id, coin: w.method, amount: Number(w.amount),
      address: w.wallet_address, status: w.status, at: new Date(w.created_at).getTime(),
    }));
  },
  async create({ coin, address, amount }) {
    await Auth.updateUser({ balance: (Number(Cache.user.balance)||0) - amount });
    const { data, error } = await sb.from('withdrawals').insert({
      user_id: Cache.user.id, method: coin, wallet_address: address, amount, status: 'pending',
    }).select().maybeSingle();
    if (error) throw new Error(error.message);
    Cache.withdrawals.unshift(data);
  },
  async adminApprove(id) {
    await sb.from('withdrawals').update({ status: 'approved' }).eq('id', id);
    await loadAdminData();
  },
  async adminReject(id) {
    const w = Cache.allWithdrawals.find(x => x.id === id); if (!w) return;
    const { data: u } = await sb.from('profiles').select('balance').eq('id', w.user_id).maybeSingle();
    if (u) await sb.from('profiles').update({ balance: Number(u.balance) + Number(w.amount) }).eq('id', w.user_id);
    await sb.from('withdrawals').update({ status: 'rejected' }).eq('id', id);
    await loadAdminData();
  },
};

function toast(msg, kind = 'success') {
  let el = document.querySelector('.toast');
  if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
  el.textContent = msg; el.className = 'toast ' + kind; requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 2600);
}

function animatePrice(el, newPrice, prevPrice, formatter = (n) => n) {
  if (!el) return;
  el.textContent = formatter(newPrice);
  if (prevPrice == null || newPrice === prevPrice) return;
  el.classList.remove('flash-up', 'flash-down'); void el.offsetWidth;
  el.classList.add(newPrice > prevPrice ? 'flash-up' : 'flash-down');
}

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-toggle-drawer]')) document.querySelector('.mobile-drawer')?.classList.toggle('open');
  if (e.target.closest('[data-toggle-sidebar]')) {
    document.querySelector('.sidebar')?.classList.toggle('open');
    document.querySelector('.backdrop')?.classList.toggle('show');
  }
  if (e.target.classList?.contains('backdrop')) {
    document.querySelector('.sidebar')?.classList.remove('open');
    e.target.classList.remove('show');
  }
});

window.App = { Auth, Orders, Portfolio, Investments, Deposits, Withdrawals, toast, animatePrice, ready };
