// Render dashboard shell (sidebar + appbar). Call before page-specific code.
function renderShell({ active, title }) {
  if (!App.Auth.require()) return null;
  const user = App.Auth.getUser();
  const initials = (user.full_name || user.username).split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();

  const navItems = [
    { id: 'overview', href: '/dashboard.html', label: 'Overview', icon: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>' },
    { id: 'invest',   href: '/invest.html',    label: 'Invest',   icon: '<path d="M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/>' },
    { id: 'crypto',   href: '/crypto.html',    label: 'Crypto',   icon: '<circle cx="12" cy="12" r="9"/><path d="M9 8h5a2 2 0 0 1 0 4H9zm0 4h6a2 2 0 0 1 0 4H9zM11 6v2M11 16v2M13 6v2M13 16v2"/>' },
    { id: 'forex',    href: '/forex.html',     label: 'Forex',    icon: '<path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 5-5"/>' },
    { id: 'stocks',   href: '/stocks.html',    label: 'Stocks',   icon: '<path d="M3 3v18h18"/><rect x="6" y="12" width="3" height="6"/><rect x="11" y="8" width="3" height="10"/><rect x="16" y="4" width="3" height="14"/>' },
    { id: 'deposit',  href: '/deposit.html',   label: 'Deposit',  icon: '<path d="M12 5v14M5 12l7 7 7-7"/>' },
    { id: 'withdraw', href: '/withdraw.html',  label: 'Withdraw', icon: '<path d="M12 19V5M5 12l7-7 7 7"/>' },
    { id: 'history',  href: '/history.html',   label: 'History',  icon: '<path d="M12 8v4l3 2"/><circle cx="12" cy="12" r="9"/>' },
    { id: 'profile',  href: '/profile.html',   label: 'Profile',  icon: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/>' },
  ];

  const sidebar = `
    <aside class="sidebar">
      <a href="/home.html" class="brand">
        <span class="brand-mark"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 3l7 7-7 7v-4H3v-6h11V3z"/></svg></span>
        Orbital
      </a>
      <nav>
        ${navItems.map(n => `
          <a href="${n.href}" class="${n.id === active ? 'active' : ''}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${n.icon}</svg>
            ${n.label}
          </a>`).join('')}
      </nav>
      <div class="sidebar-foot">
        <div class="user-chip">
          <div class="av">${initials}</div>
          <div><div class="name">${user.full_name}</div><div class="uname">@${user.username}</div></div>
        </div>
        <button class="btn btn-block btn-sm" style="margin-top:8px;" onclick="App.Auth.logout()">Sign out</button>
      </div>
    </aside>
    <div class="backdrop"></div>`;

  const appbar = `
    <div class="appbar">
      <div style="display:flex;align-items:center;gap:12px;">
        <button class="menu-btn" data-toggle-sidebar aria-label="Menu">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
        </button>
        <h1>${title}</h1>
      </div>
      <div class="right">
        <div style="text-align:right;" class="hide-sm">
          <div style="font-size:11px;color:var(--text-mute);text-transform:uppercase;letter-spacing:.1em;">Balance</div>
          <div style="font-size:15px;font-weight:700;" id="navBalance">$${user.balance.toLocaleString()}</div>
        </div>
      </div>
    </div>`;

  return { user, sidebar, appbar };
}
window.renderShell = renderShell;
