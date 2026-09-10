// Reusable market page (list + selected chart + trade panel)
function renderMarketPage({ active, title, category }) {
  const s = renderShell({ active, title });
  if (!s) return;
  const list = Market.INSTRUMENTS[category];
  let selected = list[0].sym;

  document.getElementById('app').innerHTML = s.sidebar + `
    <main class="main">
      ${s.appbar}
      <div class="page">
        <div class="trade-grid">
          <div>
            <div class="panel" style="padding:14px;">
              <div class="panel-head" style="margin-bottom:10px;padding:8px 8px 0;">
                <div>
                  <div style="font-size:12px;color:var(--text-mute);text-transform:uppercase;letter-spacing:.1em;" id="selName"></div>
                  <div style="display:flex;align-items:baseline;gap:12px;margin-top:4px;">
                    <div class="price" id="selPrice" style="font-size:32px;font-weight:800;"></div>
                    <div class="change" id="selChg" style="padding:4px 10px;border-radius:8px;font-size:13px;font-weight:700;"></div>
                  </div>
                </div>
              </div>
              <div class="chart-wrap" style="padding:0 8px;"><canvas id="bigChart"></canvas></div>
            </div>

            <div class="panel">
              <div class="panel-head"><h3>All ${title}</h3><span style="color:var(--text-mute);font-size:12px;">Live</span></div>
              <div class="table-wrap"><table class="tbl">
                <thead><tr><th>Symbol</th><th>Price</th><th>24h Change</th><th>Action</th></tr></thead>
                <tbody id="rows"></tbody>
              </table></div>
            </div>

            <div class="panel">
              <div class="panel-head"><h3>Your open ${title.toLowerCase()} positions</h3><span style="color:var(--text-mute);font-size:12px;">Live P/L</span></div>
              <div id="myPositions"></div>
            </div>
          </div>

          <aside>
            <div class="panel">
              <h3 style="margin:0 0 14px;">Place order</h3>
              <div class="tabs" id="sideTabs">
                <button class="active buy" data-side="buy">Buy</button>
                <button data-side="sell">Sell</button>
              </div>
              <div class="field"><label>Symbol</label><div id="orderSym" style="padding:11px 14px;border-radius:10px;background:rgba(0,0,0,.25);border:1px solid var(--border-strong);font-weight:700;"></div></div>
              <div class="field"><label>Market price</label><div id="orderPx" style="padding:11px 14px;border-radius:10px;background:rgba(0,0,0,.25);border:1px solid var(--border-strong);font-variant-numeric:tabular-nums;"></div></div>
              <div class="field"><label>Quantity</label><input type="number" id="qty" min="0" step="any" value="1" /></div>
              <div class="field"><label>Estimated total</label><div id="total" style="padding:11px 14px;border-radius:10px;background:rgba(0,0,0,.25);border:1px solid var(--border-strong);font-variant-numeric:tabular-nums;"></div></div>
              <button id="placeBtn" class="btn btn-block btn-success">Place buy order</button>
            </div>
          </aside>
        </div>
      </div>
    </main>`;

  let side = 'buy';

  function renderSelected() {
    const i = Market.ALL[selected];
    document.getElementById('selName').textContent = `${i.sym} · ${i.name}`;
    document.getElementById('selPrice').textContent = '$' + Market.fmtPrice(i.price);
    const chg = document.getElementById('selChg');
    chg.textContent = Market.fmtPct(i.changePct);
    chg.className = 'change ' + (i.changePct >= 0 ? 'up' : 'down');
    document.getElementById('orderSym').textContent = i.sym;
    document.getElementById('orderPx').textContent = '$' + Market.fmtPrice(i.price);
    updateTotal();
    Market.drawChart(document.getElementById('bigChart'), i.history, i.changePct >= 0 ? '#4ade80' : '#f87171');
  }

  function updateTotal() {
    const i = Market.ALL[selected];
    const q = parseFloat(document.getElementById('qty').value) || 0;
    document.getElementById('total').textContent = '$' + Market.fmtPrice(q * i.price);
  }

  function buildRows() {
    document.getElementById('rows').innerHTML = list.map(i => `
      <tr data-sym="${i.sym}" style="cursor:pointer;">
        <td><div class="sym-cell"><div class="ico">${i.sym.slice(0,2)}</div><div><div style="font-weight:700;">${i.sym}</div><div style="color:var(--text-mute);font-size:11px;">${i.name}</div></div></div></td>
        <td data-px>$${Market.fmtPrice(i.price)}</td>
        <td><span class="chg ${i.changePct >= 0 ? 'up' : 'down'}" data-chg>${Market.fmtPct(i.changePct)}</span></td>
        <td><button class="btn btn-sm" data-trade>Trade</button></td>
      </tr>`).join('');
  }
  buildRows();

  document.getElementById('rows').addEventListener('click', (e) => {
    const tr = e.target.closest('tr'); if (!tr) return;
    selected = tr.dataset.sym;
    renderSelected();
    if (e.target.closest('[data-trade]')) window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  document.getElementById('sideTabs').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    side = b.dataset.side;
    document.querySelectorAll('#sideTabs button').forEach(x => x.classList.remove('active','buy','sell'));
    b.classList.add('active', side);
    const btn = document.getElementById('placeBtn');
    btn.textContent = side === 'buy' ? 'Place buy order' : 'Place sell order';
    btn.className = 'btn btn-block ' + (side === 'buy' ? 'btn-success' : 'btn-danger');
  });

  document.getElementById('qty').addEventListener('input', updateTotal);

  document.getElementById('placeBtn').addEventListener('click', async () => {
    const i = Market.ALL[selected];
    const q = parseFloat(document.getElementById('qty').value);
    if (!q || q <= 0) return App.toast('Enter a valid quantity', 'error');
    const total = q * i.price;
    const user = App.Auth.getUser();
    if (side === 'buy' && total > user.balance) return App.toast('Insufficient balance', 'error');
    if (side === 'sell') {
      const held = App.Portfolio.qtyOf(user.id, i.sym);
      if (q > held + 1e-8) return App.toast(`You only hold ${held} ${i.sym}`, 'error');
    }
    try {
      await App.Orders.add({ symbol: i.sym, side, qty: q, price: i.price, total });
    } catch { return; }
    const newBal = side === 'buy' ? user.balance - total : user.balance + total;
    await App.Auth.updateUser({ balance: newBal });
    document.getElementById('navBalance').textContent = '$' + newBal.toLocaleString(undefined, { maximumFractionDigits: 2 });
    App.toast(`${side === 'buy' ? 'Bought' : 'Sold'} ${q} ${i.sym} @ $${Market.fmtPrice(i.price)}`);
    renderPositions();
  });

  renderSelected();
  renderPositions();

  function renderPositions() {
    const user = App.Auth.getUser(); if (!user) return;
    const symsInCategory = new Set(list.map(x => x.sym));
    const mine = App.Portfolio.holdings().filter(h => symsInCategory.has(h.symbol));
    const el = document.getElementById('myPositions');
    if (!el) return;
    if (mine.length === 0) {
      el.innerHTML = '<p style="color:var(--text-mute);margin:0;">No open positions in this market. Buy above to open one.</p>';
      return;
    }
    el.innerHTML = `<div class="table-wrap"><table class="tbl">
      <thead><tr><th>Symbol</th><th>Qty</th><th>Avg entry</th><th>Current</th><th>Market value</th><th>P/L</th><th></th></tr></thead>
      <tbody>${mine.map(h => {
        const inst = Market.ALL[h.symbol]; const mv = inst.price * h.qty;
        const pl = mv - h.costBasis; const plPct = (pl / h.costBasis) * 100;
        return `<tr>
          <td><strong>${h.symbol}</strong></td>
          <td>${h.qty.toLocaleString(undefined,{maximumFractionDigits:6})}</td>
          <td>$${Market.fmtPrice(h.avgPrice)}</td>
          <td data-pos="${h.symbol}">$${Market.fmtPrice(inst.price)}</td>
          <td>$${Market.fmtPrice(mv)}</td>
          <td><span class="chg ${pl>=0?'up':'down'}">${pl>=0?'+':''}$${Market.fmtPrice(pl)} (${plPct.toFixed(2)}%)</span></td>
          <td><button class="btn btn-sm btn-danger" data-close-pos="${h.symbol}">Close</button></td>
        </tr>`;
      }).join('')}</tbody></table></div>`;
  }

  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-close-pos]'); if (!b) return;
    const sym = b.dataset.closePos;
    const h = App.Portfolio.holdings().find(x => x.symbol === sym); if (!h) return;
    const inst = Market.ALL[sym]; const total = inst.price * h.qty;
    try { await App.Orders.add({ symbol: sym, side: 'sell', qty: h.qty, price: inst.price, total }); } catch { return; }
    const user = App.Auth.getUser();
    await App.Auth.updateUser({ balance: user.balance + total });
    document.getElementById('navBalance').textContent = '$' + (user.balance + total).toLocaleString(undefined, { maximumFractionDigits: 2 });
    const pl = total - h.costBasis;
    App.toast(`Closed ${sym}: ${pl>=0?'+':''}$${Market.fmtPrice(pl)}`);
    renderPositions();
  });

  document.addEventListener('market:tick', () => {
    renderSelected();
    document.querySelectorAll('#rows tr').forEach(tr => {
      const i = Market.ALL[tr.dataset.sym];
      const px = tr.querySelector('[data-px]');
      App.animatePrice(px, i.price, i.prevPrice, (n) => '$' + Market.fmtPrice(n));
      const ch = tr.querySelector('[data-chg]');
      ch.textContent = Market.fmtPct(i.changePct);
      ch.className = 'chg ' + (i.changePct >= 0 ? 'up' : 'down');
    });
    document.querySelectorAll('#myPositions [data-pos]').forEach(td => {
      const inst = Market.ALL[td.dataset.pos];
      App.animatePrice(td, inst.price, inst.prevPrice, (n) => '$' + Market.fmtPrice(n));
    });
  });
}
window.renderMarketPage = renderMarketPage;
