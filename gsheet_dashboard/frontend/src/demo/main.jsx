import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {
  Activity, ArrowDownToLine, CalendarDays, ChartColumn, ChevronLeft, ChevronRight,
  CircleAlert, CircleCheck, ClipboardList, Clock3, FlaskConical, Search, X,
} from 'lucide-react';
import {csvDownload} from '../workspaceUtils';
import {days, sampleOrders, statuses} from './sampleOrders';
import './demo.css';

const pageSize = 6;
const metrics = [
  ['all', 'Orders received', ClipboardList, 'blue'],
  ['delivered', 'Delivered', CircleCheck, 'mint'],
  ['active', 'In progress', Clock3, 'violet'],
  ['review', 'Needs review', CircleAlert, 'amber'],
];

function Status({status}) {
  const {label, color} = statuses[status];
  return <span className={`status ${color}`}><i />{label}</span>;
}

function OrderDialog({order, onClose}) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    const opener = document.activeElement;
    element.showModal();
    return () => {
      element.close();
      opener?.focus();
    };
  }, []);

  return (
    <dialog ref={dialog} aria-labelledby="order-title" onCancel={event => {
      event.preventDefault();
      onClose();
    }}>
      <div className="dialog-head">
        <span className="sample"><FlaskConical size={14} /> Sample order</span>
        <button className="icon" aria-label="Close order details" onClick={onClose}><X size={20} /></button>
      </div>
      <h2 id="order-title">{order.id}</h2>
      <Status status={order.status} />
      <dl>
        <dt>Product</dt><dd>{order.product}</dd>
        <dt>County</dt><dd>{order.county}</dd>
        <dt>Received</dt><dd>{order.date}, 2026</dd>
      </dl>
    </dialog>
  );
}

function VolumeChart({bars, selectedDay, onSelect}) {
  const max = Math.ceil(Math.max(...bars.map(({total}) => total)) / 4) * 4;
  return (
    <section className="panel chart-panel" aria-labelledby="volume-title">
      <div className="panel-head">
        <div><h2 id="volume-title">Production volume</h2><p>Select a day to inspect its orders.</p></div>
        <div className="legend"><span><i className="swatch violet" />Received</span><span><i className="swatch mint" />Delivered</span></div>
      </div>
      <div className="chart">
        <div className="grid-lines" aria-hidden="true">{[max, max * .75, max * .5, max * .25, 0].map(tick =>
          <div key={tick}><span>{tick}</span></div>,
        )}</div>
        <div className="bars" data-period={bars.length} style={{'--days': bars.length}}>
          {bars.map(({index, total, delivered}) =>
            <button type="button" key={index} className="bar-group"
              aria-label={`${days[index]}: ${total} received, ${delivered} delivered`}
              title={`${days[index]} · ${total} received · ${delivered} delivered`}
              aria-pressed={selectedDay === index} onClick={() => onSelect(index)}>
              <span className="bar-pair" aria-hidden="true">
                <i className="bar violet" style={{height: `${100 * total / max}%`}} />
                <i className="bar mint" style={{height: `${100 * delivered / max}%`}} />
              </span>
              <span className="day-label">{days[index]}</span>
            </button>,
          )}
        </div>
      </div>
    </section>
  );
}

function Demo() {
  const [period, setPeriod] = useState(7);
  const [status, setStatus] = useState('all');
  const [day, setDay] = useState(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [order, setOrder] = useState(null);

  const start = days.length - period;
  const periodOrders = sampleOrders.filter(row => row.day >= start);
  const counts = Object.fromEntries(metrics.map(([value]) => [
    value, periodOrders.filter(row => value === 'all' || row.status === value).length,
  ]));
  const bars = days.slice(start).map((_, index) => {
    const dayIndex = index + start;
    const rows = periodOrders.filter(row => row.day === dayIndex);
    return {index: dayIndex, total: rows.length, delivered: rows.filter(row => row.status === 'delivered').length};
  });
  const matches = periodOrders.filter(row =>
    (status === 'all' || row.status === status) &&
    (day === null || row.day === day) &&
    `${row.id} ${row.product} ${row.county}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(matches.length / pageSize));
  const shown = matches.slice(page * pageSize, (page + 1) * pageSize);
  const hasFilters = status !== 'all' || day !== null || query !== '';
  const rate = Math.round(100 * counts.delivered / counts.all);

  function clearFilters() {
    setDay(null);
    setStatus('all');
    setQuery('');
    setPage(0);
  }

  function exportOrders() {
    const rows = matches.map(row => ({
      'Order ID': row.id, Product: row.product, County: row.county,
      Received: `${row.date}, 2026`, Status: statuses[row.status].label,
    }));
    csvDownload(rows, ['Order ID', 'Product', 'County', 'Received', 'Status'], 'tv-tracker-sample-orders.csv');
  }

  return (
    <>
      <a className="skip" href="#demo-content">Skip to dashboard</a>
      <header className="masthead">
        <div className="mast-inner">
          <div className="brand"><span className="brand-icon"><Activity size={23} /></span><strong>Tv Tracker</strong><span className="divider" /><span className="brand-caption">Production workspace</span></div>
          <div className="head-actions"><span className="sample"><FlaskConical size={15} /> Sample data</span><a className="workspace-link" href="./">Open workspace</a></div>
        </div>
      </header>
      <main id="demo-content" className="dashboard">
        <section className="hero" aria-labelledby="page-title">
          <div><h1 id="page-title">Production overview</h1><p>Track title orders from receipt through delivery.</p></div>
          <fieldset className="period"><legend>Reporting window</legend><div>
            {[7, 14].map(value => <button key={value} aria-pressed={period === value} onClick={() => {
              setPeriod(value);
              setDay(null);
              setPage(0);
            }}>{value} days</button>)}
          </div></fieldset>
        </section>
        <p className="date-range"><CalendarDays size={16} />{days[start]} – {days.at(-1)}, 2026</p>
        <div className="metrics" aria-label="Filter by order status">
          {metrics.map(([value, label, Icon, color]) =>
            <button key={value} className={`metric ${color}`} aria-pressed={status === value} onClick={() => {
              setStatus(status === value ? 'all' : value);
              setPage(0);
            }}>
              <span className="metric-top"><span>{label}</span><span className="metric-icon"><Icon size={19} /></span></span>
              <strong>{counts[value]}</strong>
            </button>,
          )}
        </div>
        <div className="report-grid">
          <VolumeChart bars={bars} selectedDay={day} onSelect={value => {setDay(day === value ? null : value); setPage(0);}} />
          <section className="panel mix-panel" aria-labelledby="mix-title">
            <div className="panel-head"><div><h2 id="mix-title">Delivery mix</h2><p>Order status for this period</p></div><ChartColumn size={20} /></div>
            <div className="delivery-rate"><strong>{rate}%</strong><span>delivered</span></div>
            <div className="mix-track" aria-hidden="true">{Object.entries(statuses).map(([value, {color}]) =>
              <span className={color} key={value} style={{flex: counts[value]}} />,
            )}</div>
            <div className="mix-list">{Object.keys(statuses).map(value =>
              <button key={value} aria-pressed={status === value} onClick={() => {
                setStatus(status === value ? 'all' : value);
                setPage(0);
              }}><Status status={value} /><strong>{counts[value]}</strong></button>,
            )}</div>
          </section>
        </div>
        <section className="panel queue" aria-labelledby="queue-title">
          <div className="panel-head queue-head">
            <div>
              <h2 id="queue-title">Order queue</h2>
              <p role="status">{matches.length} {matches.length === 1 ? 'order' : 'orders'}
                {day !== null ? ` · ${days[day]}` : ''}
                {status !== 'all' ? ` · ${statuses[status].label}` : ''}
              </p>
            </div>
            <div className="queue-actions">
              <label className="search"><Search size={17} /><input aria-label="Search orders" placeholder="Search orders…" type="search" value={query} onChange={event => {setQuery(event.target.value); setPage(0);}} /></label>
              <button className="secondary" onClick={exportOrders} disabled={!matches.length}><ArrowDownToLine size={16} /> Export CSV</button>
            </div>
          </div>
          {hasFilters && <button className="clear" onClick={clearFilters}><X size={14} /> Clear filters</button>}
          {shown.length ? (
            <div className="table-scroll" tabIndex="0" role="region" aria-label="Sample orders table">
              <table>
                <thead><tr><th scope="col">Order</th><th scope="col">Product</th><th scope="col">County</th><th scope="col">Received</th><th scope="col">Status</th></tr></thead>
                <tbody>{shown.map(row => (
                  <tr key={row.id}><th scope="row"><button className="order-link" onClick={() => setOrder(row)}>{row.id}</button></th><td>{row.product}</td><td>{row.county}</td><td>{row.date}</td><td><Status status={row.status} /></td></tr>
                ))}</tbody>
              </table>
            </div>
          ) : <p className="empty">No orders match your filters.</p>}
          {pages > 1 && <div className="pagination">
            <span>Page {page + 1} of {pages}</span>
            <button className="icon" aria-label="Previous page" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft size={19} /></button>
            <button className="icon" aria-label="Next page" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}><ChevronRight size={19} /></button>
          </div>}
        </section>
        <footer>Tv Tracker <span>Interactive demo · Synthetic orders</span></footer>
      </main>
      {order && <OrderDialog order={order} onClose={() => setOrder(null)} />}
    </>
  );
}

createRoot(document.getElementById('root')).render(<Demo />);
