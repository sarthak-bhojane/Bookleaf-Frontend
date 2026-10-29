import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const categories = ['Royalty & Payments', 'ISBN & Metadata Issues', 'Printing & Quality', 'Distribution & Availability', 'Book Status & Production Updates', 'General Inquiry'];
const priorities = ['Critical', 'High', 'Medium', 'Low'];
const statuses = ['Open', 'In Progress', 'Resolved', 'Closed'];
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://bookleaf-backend-ovsmqq2zq-sarthak-bhojanes-projects.vercel.app';
const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
const date = value => value ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : '—';
const initials = name => name.split(' ').map(word => word[0]).slice(0, 2).join('').toUpperCase();

async function request(path, token, options = {}) {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const response = await fetch(`${API_BASE_URL}/api${path}`, {
    ...options,
    headers: {
      ...(options.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error?.message || 'Unable to complete this request.');
    error.status = response.status;
    throw error;
  }
  return data;
}

async function downloadAttachment(ticketId, attachment, token) {
  const response = await fetch(`${API_BASE_URL}/api/tickets/${ticketId}/attachments/${attachment.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error?.message || 'Unable to download this attachment.');
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = attachment.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Brand({ compact = false }) {
  return <div className={`brand ${compact ? 'brand-compact' : ''}`}><span className="brand-mark">b</span><span>bookleaf</span></div>;
}

function Login({ onLogin }) {
  const [role, setRole] = useState('author');
  const [email, setEmail] = useState('priya.sharma@email.com');
  const [password, setPassword] = useState('bookleaf123');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const selectRole = value => {
    setRole(value);
    setEmail(value === 'admin' ? 'admin@bookleaf.com' : 'priya.sharma@email.com');
    setPassword(value === 'admin' ? 'admin123' : 'bookleaf123');
    setError('');
  };

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try { await onLogin(email, password); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  return <main className="login-page">
    <div className="login-brand"><Brand /><span className="login-tag">AUTHOR CARE, REIMAGINED</span></div>
    <section className="login-card">
      <div className="eyebrow">WELCOME TO BOOKLEAF</div>
      <h1>Your publishing journey,<br />all in one place.</h1>
      <p className="login-subtitle">Sign in to get updates, manage your books and connect with our team.</p>
      <div className="role-switch" role="tablist" aria-label="Choose portal">
        <button className={role === 'author' ? 'selected' : ''} onClick={() => selectRole('author')}>Author portal</button>
        <button className={role === 'admin' ? 'selected' : ''} onClick={() => selectRole('admin')}>Team portal</button>
      </div>
      <form onSubmit={submit}>
        <label>Email address</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" required />
        <label>Password</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="button button-primary login-submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'} <span>→</span></button>
      </form>
      <div className="demo-hint"><span className="hint-dot" /> Demo access is ready — choose a portal above.</div>
    </section>
    <div className="login-footer"><span>Thoughtfully made for the people behind every story.</span><span>© BookLeaf Publishing</span></div>
  </main>;
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('bookleaf-token') || '');
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('overview');
  const [books, setBooks] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const selectedTicketRef = useRef(null);
  const [refreshCount, setRefreshCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const isAdmin = user?.role === 'admin';

  const notify = message => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3200);
  };

  const load = useCallback(async (authToken, quiet = false) => {
    if (!authToken) { setLoading(false); return; }
    try {
      const [me, bookData, ticketData] = await Promise.all([
        request('/auth/me', authToken),
        request('/books', authToken),
        request('/tickets', authToken),
      ]);
      setUser(me.user);
      setBooks(bookData.books);
      setTickets(ticketData.tickets);
      if (selectedTicketRef.current) {
        const updated = ticketData.tickets.find(ticket => ticket.id === selectedTicketRef.current.id);
        if (updated) setSelectedTicket(updated);
      }
    } catch (error) {
      if (error.status === 401) {
        localStorage.removeItem('bookleaf-token');
        setToken('');
        setUser(null);
      } else if (!quiet) {
        notify(error.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { selectedTicketRef.current = selectedTicket; }, [selectedTicket]);

  useEffect(() => {
    load(token);
  }, [token, refreshCount, load]);

  useEffect(() => {
    if (!token) return undefined;
    const timer = window.setInterval(() => setRefreshCount(value => value + 1), 7000);
    return () => window.clearInterval(timer);
  }, [token]);

  async function login(email, password) {
    const result = await request('/auth/login', '', { method: 'POST', body: JSON.stringify({ email, password }) });
    localStorage.setItem('bookleaf-token', result.token);
    setUser(result.user);
    setToken(result.token);
    setSelectedTicket(null);
    setPage(result.user.role === 'admin' ? 'queue' : 'overview');
  }

  function logout() {
    localStorage.removeItem('bookleaf-token');
    setToken('');
    setUser(null);
    setBooks([]);
    setTickets([]);
    setSelectedTicket(null);
    setPage('overview');
  }

  const go = destination => {
    setSelectedTicket(null);
    setPage(destination);
  };

  if (!token || (!user && !loading)) return <Login onLogin={login} />;
  if (loading && !user) return <div className="loading-screen"><Brand /><span>Preparing your workspace…</span></div>;
  if (!user) return <Login onLogin={login} />;

  const navigation = isAdmin
    ? [{ id: 'queue', label: 'Ticket queue', icon: '▤' }, { id: 'books', label: 'Books & authors', icon: '▧' }]
    : [{ id: 'overview', label: 'Overview', icon: '⌂' }, { id: 'books', label: 'My books', icon: '▧' }, { id: 'tickets', label: 'My tickets', icon: '▤', count: tickets.length }];

  return <div className="app-shell">
    <aside className="sidebar">
      <Brand />
      <div className="workspace-label">{isAdmin ? 'OPERATIONS WORKSPACE' : 'AUTHOR WORKSPACE'}</div>
      <nav aria-label="Main navigation">
        {navigation.map(item => <button key={item.id} className={`nav-item ${page === item.id ? 'active' : ''}`} onClick={() => go(item.id)}>
          <span className="nav-icon">{item.icon}</span><span>{item.label}</span>{item.count > 0 && <span className="nav-count">{item.count}</span>}
        </button>)}
      </nav>
      {!isAdmin && <div className="sidebar-help"><div className="help-orb">✦</div><strong>Need a hand?</strong><p>Our author care team is here for you.</p><button onClick={() => go('new-ticket')}>Contact support <span>→</span></button></div>}
      <div className="sidebar-bottom">
        <div className="support-status"><span className="online-dot" /> Support team online</div>
        <button className="profile-button" onClick={logout}>
          <span className="avatar">{initials(user.name)}</span><span className="profile-copy"><strong>{user.name}</strong><small>{isAdmin ? 'Operations team' : 'Author account'}</small></span><span className="logout-icon" title="Sign out">↗</span>
        </button>
      </div>
    </aside>

    <main className="main-area">
      <header className="topbar">
        <div className="breadcrumb">Workspace <span>/</span> <strong>{pageTitle(page, isAdmin, selectedTicket)}</strong></div>
        <div className="topbar-actions">
          <span className="secure-label"><span>✦</span> {isAdmin ? 'Operations' : 'Author portal'}</span>
          <span className="top-avatar">{initials(user.name)}</span>
        </div>
      </header>
      <div className="content-wrap">
        {isAdmin
          ? <AdminContent {...{ page, books, tickets, selectedTicket, setSelectedTicket, go, token, notify, setRefreshCount }} />
          : <AuthorContent {...{ page, user, books, tickets, selectedTicket, setSelectedTicket, go, token, notify, setRefreshCount }} />}
      </div>
    </main>
    {toast && <div className="toast" role="status"><span>✓</span>{toast}</div>}
  </div>;
}

function pageTitle(page, isAdmin, selectedTicket) {
  if (selectedTicket) return 'Ticket details';
  if (page === 'overview') return 'Overview';
  if (page === 'books') return isAdmin ? 'Books & authors' : 'My books';
  if (page === 'tickets') return 'My tickets';
  if (page === 'new-ticket') return 'Contact support';
  return 'Ticket queue';
}

function AuthorContent({ page, user, books, tickets, selectedTicket, setSelectedTicket, go, token, notify, setRefreshCount }) {
  if (selectedTicket) return <TicketConversation ticket={selectedTicket} token={token} notify={notify} authorView onBack={() => setSelectedTicket(null)} />;
  if (page === 'new-ticket') return <NewTicket {...{ books, token, notify, go, setRefreshCount }} />;
  if (page === 'tickets') return <AuthorTickets {...{ tickets, setSelectedTicket, go }} />;
  if (page === 'books') return <BooksPage books={books} />;
  return <AuthorOverview {...{ user, books, tickets, setSelectedTicket, go }} />;
}

function AuthorOverview({ user, books, tickets, setSelectedTicket, go }) {
  const published = books.filter(book => book.status === 'Published & Live');
  const pending = books.reduce((sum, book) => sum + book.pending, 0);
  const earned = books.reduce((sum, book) => sum + book.earned, 0);
  const recent = tickets.slice(0, 3);
  return <div className="page-content">
    <div className="welcome-banner">
      <div className="welcome-text"><div className="eyebrow pale">YOUR AUTHOR SPACE</div><h1>Good morning, {user.name.split(' ')[0]} <span>✦</span></h1><p>Your words are out in the world. Here’s how your publishing journey is going.</p></div>
      <div className="welcome-art" aria-hidden="true"><div className="sun-disc" /><div className="book-shape book-one" /><div className="book-shape book-two" /><div className="book-shape book-three" /><div className="sparkle s1">✦</div><div className="sparkle s2">✧</div></div>
    </div>
    <div className="section-heading"><div><div className="eyebrow">YOUR PUBLISHING SNAPSHOT</div><h2>A little progress goes a long way.</h2></div><span className="muted">Updated just now</span></div>
    <div className="stat-grid">
      <StatCard label="Published books" value={published.length} suffix={`of ${books.length} titles`} icon="▧" tint="lavender" />
      <StatCard label="Copies sold" value={published.reduce((sum, book) => sum + book.copiesSold, 0).toLocaleString('en-IN')} suffix="across all titles" icon="↗" tint="mint" />
      <StatCard label="Royalties earned" value={money(earned)} suffix="lifetime earnings" icon="₹" tint="peach" />
      <StatCard label="Royalty pending" value={money(pending)} suffix="to be paid" icon="◷" tint="blue" />
    </div>
    <div className="overview-grid">
      <section className="panel book-preview">
        <div className="panel-header"><div><div className="eyebrow">ON YOUR BOOKSHELF</div><h3>Recently published</h3></div><button className="text-link" onClick={() => go('books')}>View all <span>→</span></button></div>
        {published.slice(0, 3).map(book => <div className="mini-book" key={book.id}><BookCover book={book} /><div className="mini-book-copy"><strong>{book.title}</strong><span>{book.genre}</span></div><div className="mini-book-sales"><strong>{book.copiesSold.toLocaleString('en-IN')}</strong><span>copies sold</span></div></div>)}
        {published.length === 0 && <EmptyState title="Your bookshelf is waiting" text="Your published books will appear here." />}
      </section>
      <section className="panel recent-tickets">
        <div className="panel-header"><div><div className="eyebrow">HERE FOR YOU</div><h3>Recent conversations</h3></div><button className="text-link" onClick={() => go('tickets')}>All tickets <span>→</span></button></div>
        {recent.length ? recent.map(ticket => <button className="recent-ticket" key={ticket.id} onClick={() => setSelectedTicket(ticket)}><span className={`ticket-dot status-${slug(ticket.status)}`} /><span className="recent-ticket-copy"><strong>{ticket.subject}</strong><small>{date(ticket.updatedAt)}</small></span><StatusBadge status={ticket.status} /></button>) : <EmptyState title="A clear inbox" text="When you reach out, your conversations appear here." />}
        <button className="button button-soft support-cta" onClick={() => go('new-ticket')}>Start a conversation <span>→</span></button>
      </section>
    </div>
    <div className="note-strip"><span>✦</span><p><strong>A note about royalties</strong> Payouts are calculated quarterly and processed within 45 days of each quarter end. Pending balances below ₹1,000 roll into the next quarter.</p></div>
  </div>;
}

function StatCard({ label, value, suffix, icon, tint }) {
  return <div className="stat-card"><div className={`stat-icon ${tint}`}>{icon}</div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-suffix">{suffix}</div></div>;
}

function BookCover({ book, small = false }) {
  const variants = ['cover-plum', 'cover-rose', 'cover-teal', 'cover-ochre'];
  const variant = variants[(Number(book.id.replace(/\D/g, '')) || 0) % variants.length];
  return <div className={`book-cover ${variant} ${small ? 'book-cover-small' : ''}`} aria-hidden="true"><span className="cover-sun" /><span className="cover-lines" /><span className="cover-leaf">✦</span></div>;
}

function BooksPage({ books }) {
  return <div className="page-content">
    <div className="page-heading"><div><div className="eyebrow">THE STORIES YOU’VE SHARED</div><h1>My books</h1><p>Every title, from first draft to readers’ hands.</p></div><span className="heading-count">{books.length} titles</span></div>
    <div className="books-list">{books.map(book => <article className="book-row panel" key={book.id}>
      <BookCover book={book} />
      <div className="book-info"><div className="book-title-line"><h3>{book.title}</h3><StatusBadge status={book.status} /></div><span>{book.genre} <span className="separator">·</span> ISBN {book.isbn}</span><small>{book.publicationDate ? `Published ${date(book.publicationDate)}` : book.status}</small></div>
      <div className="book-metrics"><div><span>MRP</span><strong>{book.mrp == null ? '—' : money(book.mrp)}</strong></div><div><span>Copies sold</span><strong>{book.copiesSold.toLocaleString('en-IN')}</strong></div><div><span>Earned</span><strong>{money(book.earned)}</strong></div><div><span>Paid</span><strong>{money(book.paid)}</strong></div><div><span>Pending</span><strong className={book.pending ? 'text-amber' : ''}>{money(book.pending)}</strong></div></div>
    </article>)}</div>
  </div>;
}

function AuthorTickets({ tickets, setSelectedTicket, go }) {
  return <div className="page-content">
    <div className="page-heading"><div><div className="eyebrow">YOUR AUTHOR CARE INBOX</div><h1>My tickets</h1><p>Every question deserves a thoughtful answer.</p></div><button className="button button-primary" onClick={() => go('new-ticket')}>＋ New ticket</button></div>
    <section className="panel ticket-list-panel"><div className="ticket-list-header"><span>CONVERSATION</span><span>PRIORITY</span><span>STATUS</span><span>LAST UPDATED</span></div>
      {tickets.length ? tickets.map(ticket => <button className="ticket-list-row" key={ticket.id} onClick={() => setSelectedTicket(ticket)}>
        <span className="ticket-title-cell"><span className={`ticket-dot status-${slug(ticket.status)}`} /><span><strong>{ticket.subject}</strong><small>{ticket.category} · {ticket.bookId || 'General / Account Level'}</small></span></span>
        <PriorityBadge priority={ticket.priority} /><StatusBadge status={ticket.status} /><span className="ticket-date">{date(ticket.updatedAt)} <span>→</span></span>
      </button>) : <EmptyState title="No conversations yet" text="Whenever you need support, we’re just a message away." action="Start a conversation" onAction={() => go('new-ticket')} />}
    </section>
    <p className="polling-note"><span className="online-dot" /> Your inbox checks for updates automatically.</p>
  </div>;
}

function NewTicket({ books, token, notify, go, setRefreshCount }) {
  const [bookId, setBookId] = useState('general');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = new FormData();
      body.append('bookId', bookId);
      body.append('subject', subject);
      body.append('description', description);
      if (attachment) body.append('attachment', attachment);
      await request('/tickets', token, { method: 'POST', body });
      setRefreshCount(value => value + 1);
      notify('Your support request is on its way.');
      go('tickets');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  return <div className="page-content">
    <div className="page-heading"><div><div className="eyebrow">WE’RE LISTENING</div><h1>How can we help?</h1><p>Tell us a little about what’s on your mind. We’ll take it from there.</p></div><span className="response-pill"><span className="online-dot" /> Usually replies within 1 business day</span></div>
    <div className="form-layout">
      <form className="panel query-form" onSubmit={submit}>
        <div className="form-section-title"><span className="step-number">01</span><div><strong>Your question</strong><small>Share the details and we’ll find the right person to help.</small></div></div>
        <label htmlFor="book">What is this about?</label>
        <select id="book" value={bookId} onChange={e => setBookId(e.target.value)}><option value="general">General / Account Level</option>{books.map(book => <option key={book.id} value={book.id}>{book.title}</option>)}</select>
        <label htmlFor="subject">Subject</label>
        <input id="subject" maxLength={140} value={subject} onChange={e => setSubject(e.target.value)} placeholder="A short summary of your question" required />
        <label htmlFor="description">Tell us more</label>
        <textarea id="description" maxLength={5000} rows={7} value={description} onChange={e => setDescription(e.target.value)} placeholder="The more you share, the better we can help…" required />
        <div className="field-foot"><span>Your message is only shared with our support team.</span><span>{description.length}/5000</span></div>
        <div className="attachment-control"><label className="attachment-box" htmlFor="attachment"><span className="attachment-icon">＋</span><span><strong>{attachment?.name || 'Add an attachment'}</strong><small>PDF, PNG, JPG or WEBP · up to 5 MB</small></span><input id="attachment" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp" onChange={event => {
          const file = event.target.files?.[0];
          const allowedTypes = new Map([['.pdf', 'application/pdf'], ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'], ['.webp', 'image/webp']]);
          const extension = file?.name.slice(file.name.lastIndexOf('.')).toLowerCase();
          if (file && file.size > 5 * 1024 * 1024) {
            setAttachment(null);
            setError('Attachments must be 5 MB or smaller.');
            event.target.value = '';
            return;
          }
          if (file && allowedTypes.get(extension) !== file.type) {
            setAttachment(null);
            setError('Choose a PDF, PNG, JPG, or WEBP file.');
            event.target.value = '';
            return;
          }
          setError('');
          setAttachment(file || null);
        }} /></label>{attachment && <button type="button" className="remove-attachment" onClick={() => setAttachment(null)}>Remove</button>}</div>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="form-actions"><button type="button" className="button button-ghost" onClick={() => go('tickets')}>Cancel</button><button className="button button-primary" disabled={busy || !subject.trim() || !description.trim()}>{busy ? 'Sending…' : 'Send to author care'} <span>→</span></button></div>
      </form>
      <aside className="form-aside"><div className="aside-illustration"><span>✦</span><div className="message-shape">“</div><i /></div><h3>Behind every question is a story.</h3><p>Our team is here to help you spend less time worrying about the details and more time writing.</p><div className="aside-detail"><span>✧</span><span><strong>Made for your journey</strong><small>Your message stays linked to your account.</small></span></div><div className="aside-detail"><span>◷</span><span><strong>A real person, thoughtfully assisted</strong><small>Our team reviews every reply before it reaches you.</small></span></div></aside>
    </div>
  </div>;
}

function AdminContent({ page, books, tickets, selectedTicket, setSelectedTicket, go, token, notify, setRefreshCount }) {
  if (selectedTicket) return <AdminTicket ticket={selectedTicket} token={token} onBack={() => setSelectedTicket(null)} notify={notify} setRefreshCount={setRefreshCount} />;
  if (page === 'books') return <AdminBooks books={books} />;
  return <AdminQueue {...{ tickets, setSelectedTicket, go }} />;
}

function AdminQueue({ tickets, setSelectedTicket }) {
  const [status, setStatus] = useState('All statuses');
  const [priority, setPriority] = useState('All priorities');
  const [category, setCategory] = useState('All categories');
  const [dateRange, setDateRange] = useState('Any time');
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => tickets.filter(ticket =>
    (status === 'All statuses' || ticket.status === status)
    && (priority === 'All priorities' || ticket.priority === priority)
    && (category === 'All categories' || ticket.category === category)
    && (dateRange === 'Any time' || Date.now() - new Date(ticket.createdAt).getTime() <= Number(dateRange) * 24 * 60 * 60 * 1000)
    && (!search || `${ticket.subject} ${ticket.description} ${ticket.authorName}`.toLowerCase().includes(search.toLowerCase())),
  ), [tickets, status, priority, category, dateRange, search]);
  const urgentCount = tickets.filter(ticket => ['Critical', 'High'].includes(ticket.priority) && !['Resolved', 'Closed'].includes(ticket.status)).length;
  return <div className="page-content">
    <div className="page-heading admin-heading"><div><div className="eyebrow">AUTHOR CARE OPERATIONS</div><h1>Ticket queue</h1><p>Every conversation, ready for a thoughtful response.</p></div><div className="queue-live"><span className="online-dot" /> Live queue <span className="live-count">{tickets.length}</span></div></div>
    <div className="admin-stat-row"><div className="admin-metric"><span>Open conversations</span><strong>{tickets.filter(ticket => !['Resolved', 'Closed'].includes(ticket.status)).length}</strong><small>Awaiting a next step</small></div><div className="admin-metric"><span>Needs attention</span><strong className={urgentCount ? 'text-red' : ''}>{urgentCount}</strong><small>High or critical priority</small></div><div className="admin-metric"><span>Resolved</span><strong>{tickets.filter(ticket => ticket.status === 'Resolved').length}</strong><small>Ready to close the loop</small></div><div className="admin-metric"><span>Total authors</span><strong>{new Set(tickets.map(ticket => ticket.authorId)).size}</strong><small>With a conversation</small></div></div>
    <section className="panel queue-panel">
      <div className="queue-toolbar"><div className="queue-heading"><div><div className="eyebrow">INCOMING REQUESTS</div><h3>All conversations <span>{filtered.length}</span></h3></div></div><div className="filters">
        <label className="search-box"><span>⌕</span><input aria-label="Search tickets" placeholder="Search tickets…" value={search} onChange={e => setSearch(e.target.value)} /></label>
        <select aria-label="Filter by status" value={status} onChange={e => setStatus(e.target.value)}><option>All statuses</option>{statuses.map(item => <option key={item}>{item}</option>)}</select>
        <select aria-label="Filter by priority" value={priority} onChange={e => setPriority(e.target.value)}><option>All priorities</option>{priorities.map(item => <option key={item}>{item}</option>)}</select>
        <select aria-label="Filter by category" value={category} onChange={e => setCategory(e.target.value)}><option>All categories</option>{categories.map(item => <option key={item}>{item}</option>)}</select>
        <select aria-label="Filter by date" value={dateRange} onChange={e => setDateRange(e.target.value)}><option value="Any time">Any time</option><option value="1">Last 24 hours</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select>
      </div></div>
      <div className="queue-table"><div className="queue-table-header"><span>AUTHOR / REQUEST</span><span>CATEGORY</span><span>PRIORITY</span><span>STATUS</span><span>RECEIVED</span></div>
        {filtered.length ? filtered.map(ticket => <button className="queue-row" key={ticket.id} onClick={() => setSelectedTicket(ticket)}>
          <span className="queue-request"><span className="avatar avatar-small">{initials(ticket.authorName)}</span><span><strong>{ticket.subject}</strong><small>{ticket.authorName} · {ticket.bookId || 'General / Account Level'}</small></span></span>
          <span className="queue-category">{ticket.category}</span><PriorityBadge priority={ticket.priority} /><StatusBadge status={ticket.status} /><span className="queue-date">{date(ticket.createdAt)}</span>
        </button>) : <EmptyState title="Nothing in this view" text="Try changing your filters to find the conversation you need." />}
      </div>
      <div className="queue-footer"><span>Sorted by urgency, then oldest first</span><span>Updates automatically <span className="online-dot" /></span></div>
    </section>
  </div>;
}

function AdminBooks({ books }) {
  const authors = new Set(books.map(book => book.authorId));
  return <div className="page-content"><div className="page-heading"><div><div className="eyebrow">CATALOG SNAPSHOT</div><h1>Books & authors</h1><p>Published titles and books still finding their way to the page.</p></div><span className="heading-count">{authors.size} authors · {books.length} titles</span></div>
    <div className="books-list">{books.map(book => <article className="book-row panel" key={book.id}><BookCover book={book} /><div className="book-info"><div className="book-title-line"><h3>{book.title}</h3><StatusBadge status={book.status} /></div><span>{book.authorName} <span className="separator">·</span> {book.genre}</span><small>ISBN {book.isbn}</small></div><div className="book-metrics"><div><span>Copies sold</span><strong>{book.copiesSold.toLocaleString('en-IN')}</strong></div><div><span>Royalty earned</span><strong>{money(book.earned)}</strong></div><div><span>Royalty pending</span><strong>{money(book.pending)}</strong></div></div></article>)}</div>
  </div>;
}

function AdminTicket({ ticket, token, onBack, notify, setRefreshCount }) {
  const [fullTicket, setFullTicket] = useState(ticket);
  const [reply, setReply] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftSource, setDraftSource] = useState('');
  const notifyRef = useRef(notify);

  useEffect(() => { setFullTicket(ticket); }, [ticket]);
  useEffect(() => { notifyRef.current = notify; }, [notify]);

  useEffect(() => {
    let cancelled = false;
    setDraftBusy(true);
    request(`/tickets/${ticket.id}/draft`, token, { method: 'POST', body: '{}' })
      .then(result => {
        if (cancelled) return;
        setReply(current => current.trim() ? current : result.draft);
        setDraftSource(result.source);
      })
      .catch(error => {
        if (!cancelled) notifyRef.current(`Could not prepare a reply draft: ${error.message}`);
      })
      .finally(() => {
        if (!cancelled) setDraftBusy(false);
      });
    return () => { cancelled = true; };
  }, [ticket.id, token]);

  async function change(values) {
    try {
      const result = await request(`/tickets/${ticket.id}`, token, { method: 'PATCH', body: JSON.stringify(values) });
      setFullTicket(result.ticket);
      setRefreshCount(value => value + 1);
      notify('Ticket updated.');
    } catch (error) { notify(error.message); }
  }

  async function generateDraft() {
    setDraftBusy(true);
    try {
      const result = await request(`/tickets/${ticket.id}/draft`, token, { method: 'POST', body: '{}' });
      setReply(result.draft);
      setDraftSource(result.source);
      notify(result.source === 'ai' ? 'AI draft is ready for your review.' : 'Suggested reply is ready for your review.');
    } catch (error) { notify(error.message); } finally { setDraftBusy(false); }
  }

  async function sendReply(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await request(`/tickets/${ticket.id}/messages`, token, { method: 'POST', body: JSON.stringify({ text: reply }) });
      setFullTicket(result.ticket);
      setReply('');
      setRefreshCount(value => value + 1);
      notify('Your response has been sent to the author.');
    } catch (error) { notify(error.message); } finally { setBusy(false); }
  }

  async function addNote(event) {
    event.preventDefault();
    try {
      await request(`/tickets/${ticket.id}/notes`, token, { method: 'POST', body: JSON.stringify({ text: note }) });
      const result = await request(`/tickets/${ticket.id}`, token);
      setFullTicket(result.ticket);
      setNote('');
      notify('Internal note added.');
    } catch (error) { notify(error.message); }
  }

  return <div className="page-content ticket-detail-page">
    <button className="back-link" onClick={onBack}>← <span>Back to queue</span></button>
    <div className="detail-title"><div><div className="eyebrow">{fullTicket.id} <span>·</span> RECEIVED {date(fullTicket.createdAt).toUpperCase()}</div><h1>{fullTicket.subject}</h1><p>From {fullTicket.authorName} <span>·</span> {fullTicket.bookId || 'General / Account Level'}</p></div><StatusBadge status={fullTicket.status} /></div>
    <div className="detail-layout">
      <div className="detail-main">
        <section className="panel conversation-panel"><div className="conversation-heading"><span className="avatar">{initials(fullTicket.authorName)}</span><span><strong>{fullTicket.authorName}</strong><small>Author · {date(fullTicket.createdAt)}</small></span><span className="conversation-label">ORIGINAL MESSAGE</span></div><p className="original-message">{fullTicket.description}</p><Attachments ticket={fullTicket} token={token} notify={notify} /></section>
        {fullTicket.messages?.map(message => <section className="panel conversation-panel response-message" key={message.id}><div className="conversation-heading"><span className="avatar staff-avatar">{initials(message.authorName)}</span><span><strong>{message.authorName}</strong><small>BookLeaf Author Support · {date(message.createdAt)}</small></span></div><p className="original-message">{message.text}</p></section>)}
        <form className="panel reply-panel" onSubmit={sendReply}><div className="panel-header"><div><div className="eyebrow">YOUR RESPONSE</div><h3>Reply to the author</h3></div><button type="button" className="button button-ai" onClick={generateDraft} disabled={draftBusy}>✦ {draftBusy ? 'Thinking…' : 'Draft with AI'}</button></div><textarea rows={7} value={reply} onChange={e => setReply(e.target.value)} placeholder="Write a thoughtful reply… or start with an AI draft." /><div className="reply-foot"><span>{draftSource ? `Suggested with ${draftSource === 'ai' ? 'AI' : 'BookLeaf policy guidance'} · please review before sending` : 'Your reply will be shared with the author.'}</span><button className="button button-primary" disabled={busy || !reply.trim()}>{busy ? 'Sending…' : 'Send reply'} <span>→</span></button></div></form>
        <form className="panel note-panel" onSubmit={addNote}><div className="panel-header"><div><div className="eyebrow">PRIVATE TO THE TEAM</div><h3>Internal notes</h3></div><span className="private-tag">🔒 Not visible to author</span></div>{fullTicket.notes?.map(item => <div className="internal-note" key={item.id}><strong>{item.authorName}</strong><small>{date(item.createdAt)}</small><p>{item.text}</p></div>)}<div className="note-input-row"><input value={note} onChange={e => setNote(e.target.value)} placeholder="Add context for your teammates…" /><button className="button button-soft" disabled={!note.trim()}>Add note</button></div></form>
      </div>
      <aside className="detail-aside">
        <section className="panel ticket-properties"><div className="eyebrow">TICKET DETAILS</div>
          <label>Status</label><select value={fullTicket.status} onChange={e => change({ status: e.target.value })}>{statuses.map(item => <option key={item}>{item}</option>)}</select>
          <label>Category <span className="ai-mini">✦ {fullTicket.categorySource === 'ai' ? 'AI suggested' : 'Rules suggested'}</span></label><select value={fullTicket.category} onChange={e => change({ category: e.target.value })}>{categories.map(item => <option key={item}>{item}</option>)}</select>
          <label>Priority <span className="ai-mini">✦ {fullTicket.prioritySource === 'ai' ? 'AI scored' : 'Rules scored'}</span></label><select value={fullTicket.priority} onChange={e => change({ priority: e.target.value })}>{priorities.map(item => <option key={item}>{item}</option>)}</select>
          <div className="assign-row"><span><small>ASSIGNEE</small><strong>{fullTicket.assignee || 'Unassigned'}</strong></span><button onClick={() => change({ assignToMe: !fullTicket.assignee })}>{fullTicket.assignee ? 'Unassign' : 'Assign to me'}</button></div>
        </section>
        <div className="ai-assist-note"><span>✦</span><p><strong>AI is your co-pilot.</strong> Drafts are suggestions, not sent automatically. Give every response a human review before sharing.</p></div>
      </aside>
    </div>
  </div>;
}

function TicketConversation({ ticket, token, notify, authorView, onBack }) {
  return <div className="page-content ticket-detail-page"><button className="back-link" onClick={onBack}>← <span>Back to my tickets</span></button><div className="detail-title"><div><div className="eyebrow">{ticket.id} <span>·</span> OPENED {date(ticket.createdAt).toUpperCase()}</div><h1>{ticket.subject}</h1><p>{ticket.bookId || 'General / Account Level'} <span>·</span> {ticket.category}</p></div><StatusBadge status={ticket.status} /></div>
    <div className="author-conversation">
      <section className="panel conversation-panel"><div className="conversation-heading"><span className="avatar">{initials(ticket.authorName)}</span><span><strong>Your message</strong><small>{date(ticket.createdAt)}</small></span></div><p className="original-message">{ticket.description}</p><Attachments ticket={ticket} token={token} notify={notify} /></section>
      {ticket.messages?.length ? ticket.messages.map(message => <section className="panel conversation-panel response-message" key={message.id}><div className="conversation-heading"><span className="avatar staff-avatar">{initials(message.authorName)}</span><span><strong>{message.authorName}</strong><small>BookLeaf Author Support · {date(message.createdAt)}</small></span></div><p className="original-message">{message.text}</p></section>) : <div className="waiting-card"><span>✦</span><div><strong>Your message is with our team.</strong><p>We’ll reply here as soon as we have a thoughtful update. This page refreshes automatically.</p></div></div>}
    </div>
    {authorView && <p className="polling-note"><span className="online-dot" /> This conversation checks for replies automatically.</p>}
  </div>;
}

function Attachments({ ticket, token, notify }) {
  if (!ticket.attachments?.length) return null;
  return <div className="ticket-attachments"><span>ATTACHMENTS</span>{ticket.attachments.map(attachment => <button className="attachment-download" key={attachment.id} onClick={async () => {
    try { await downloadAttachment(ticket.id, attachment, token); } catch (error) { notify(error.message); }
  }}><span>↓</span><strong>{attachment.name}</strong><small>{attachment.size < 1024 ? `${attachment.size} B` : `${(attachment.size / 1024).toFixed(0)} KB`}</small></button>)}</div>;
}

function StatusBadge({ status }) {
  return <span className={`badge status-badge status-${slug(status)}`}>{status}</span>;
}
function PriorityBadge({ priority }) {
  return <span className={`priority-badge priority-${slug(priority)}`}><span />{priority}</span>;
}
function EmptyState({ title, text, action, onAction }) {
  return <div className="empty-state"><span className="empty-icon">✧</span><strong>{title}</strong><p>{text}</p>{action && <button className="text-link" onClick={onAction}>{action} →</button>}</div>;
}
function slug(value = '') { return value.toLowerCase().replace(/[^a-z]+/g, '-').replace(/(^-|-$)/g, ''); }

export default App;
