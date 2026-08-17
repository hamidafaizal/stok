import { useEffect, useMemo, useRef, useState } from 'react'

const CATEGORY_KEY = 'laci_categories'
const STOCK_KEY = 'laci_stocks'

const readStorage = (key) => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

function Icon({ name, size = 22, stroke = 1.9 }) {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }
  const icons = {
    box: <><path d="m21 8-9 5-9-5 9-5 9 5Z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" /></>,
    database: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7" /></>,
    scan: <><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" /><path d="M7 9v6M10 9v6M14 9v6M17 9v6" /></>,
    search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>,
    arrowLeft: <path d="m15 18-6-6 6-6" />,
    arrowRight: <path d="m9 18 6-6-6-6" />,
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    minus: <path d="M5 12h14" />,
    trash: <><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></>,
    tag: <><path d="M20 13 12 21 3 12V4h8l9 9Z" /><path d="M7.5 8.5h.01" /></>,
    check: <path d="m5 12 4.2 4L19 6.5" />,
    camera: <><path d="M4 7h3l1.5-2h7L17 7h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" /><circle cx="12" cy="13" r="3.5" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
    close: <><path d="M6 6l12 12M18 6 6 18" /></>,
  }
  return <svg {...props}>{icons[name] || icons.box}</svg>
}

function App() {
  const [categories, setCategories] = useState(() => readStorage(CATEGORY_KEY))
  const [stocks, setStocks] = useState(() => readStorage(STOCK_KEY))
  const [page, setPage] = useState('home')
  const [categoryDraft, setCategoryDraft] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('')
  const [barcode, setBarcode] = useState('')
  const [activeBarcode, setActiveBarcode] = useState('')
  const [newItem, setNewItem] = useState({ name: '', category: '', qty: 1 })
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scannerNotice, setScannerNotice] = useState('')
  const [toast, setToast] = useState('')
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const animationRef = useRef(null)
  const toastTimer = useRef(null)

  const notify = (message) => {
    setToast(message)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 2600)
  }

  useEffect(() => () => window.clearTimeout(toastTimer.current), [])
  useEffect(() => { localStorage.setItem(CATEGORY_KEY, JSON.stringify(categories)) }, [categories])
  useEffect(() => { localStorage.setItem(STOCK_KEY, JSON.stringify(stocks)) }, [stocks])

  useEffect(() => {
    if (filter && !categories.includes(filter)) setFilter('')
  }, [categories, filter])

  useEffect(() => {
    if (!activeBarcode) return
    setNewItem({ name: '', category: categories[0] || '', qty: 1 })
  }, [activeBarcode])

  useEffect(() => {
    if (!scannerOpen) return undefined
    let isActive = true

    const closeStream = () => {
      window.cancelAnimationFrame(animationRef.current)
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    const start = async () => {
      setScannerNotice('')
      if (!('BarcodeDetector' in window)) {
        setScannerNotice('Browser ini belum mendukung pemindaian otomatis. Gunakan input barcode manual di bawah.')
        return
      }
      try {
        const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e'] })
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } })
        if (!isActive) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        const detect = async () => {
          if (!isActive || !videoRef.current) return
          try {
            const result = await detector.detect(videoRef.current)
            if (result.length) {
              const detected = result[0].rawValue
              setBarcode(detected)
              setActiveBarcode(detected)
              setScannerOpen(false)
              notify('Barcode berhasil ditemukan')
              return
            }
          } catch {
            // Frame video belum siap; lanjutkan pembacaan di frame berikutnya.
          }
          animationRef.current = window.requestAnimationFrame(detect)
        }
        detect()
      } catch {
        setScannerNotice('Kamera tidak dapat digunakan. Periksa izin kamera atau gunakan input barcode manual.')
      }
    }

    start()
    return () => {
      isActive = false
      closeStream()
      if (videoRef.current) videoRef.current.srcObject = null
    }
  }, [scannerOpen])

  const filteredStocks = useMemo(() => {
    const value = query.trim().toLowerCase()
    return stocks.filter((item) => {
      const matchesSearch = !value || item.name.toLowerCase().includes(value) || item.barcode.toLowerCase().includes(value)
      return matchesSearch && (!filter || item.category === filter)
    })
  }, [stocks, query, filter])

  const summary = useMemo(() => ({
    types: stocks.length,
    total: stocks.reduce((total, item) => total + item.qty, 0),
    low: stocks.filter((item) => item.qty <= 2).length,
  }), [stocks])

  const activeItem = stocks.find((item) => item.barcode === activeBarcode)

  const navigate = (nextPage) => {
    setScannerOpen(false)
    setPage(nextPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const addCategory = (event) => {
    event.preventDefault()
    const value = categoryDraft.trim()
    if (!value) return notify('Nama kategori wajib diisi')
    if (categories.some((item) => item.toLowerCase() === value.toLowerCase())) return notify('Kategori sudah ada')
    setCategories((current) => [...current, value])
    setCategoryDraft('')
    notify('Kategori berhasil ditambahkan')
  }

  const removeCategory = (category) => {
    if (stocks.some((item) => item.category === category)) return notify('Kategori masih dipakai oleh barang')
    if (window.confirm(`Hapus kategori “${category}”?`)) {
      setCategories((current) => current.filter((item) => item !== category))
      notify('Kategori berhasil dihapus')
    }
  }

  const processBarcode = () => {
    const value = barcode.trim()
    if (!value) return notify('Masukkan barcode terlebih dahulu')
    setActiveBarcode(value)
  }

  const incrementStock = (id) => {
    setStocks((current) => current.map((item) => item.id === id ? { ...item, qty: item.qty + 1 } : item))
    notify('Stok berhasil ditambahkan')
  }

  const createStock = (event) => {
    event.preventDefault()
    if (!categories.length) return notify('Buat kategori terlebih dahulu')
    if (!newItem.name.trim()) return notify('Nama barang wajib diisi')
    const item = {
      id: Date.now(),
      name: newItem.name.trim(),
      category: newItem.category,
      barcode: activeBarcode,
      qty: Math.max(1, Number(newItem.qty) || 1),
    }
    setStocks((current) => [...current, item])
    notify('Barang berhasil dimasukkan ke laci')
  }

  const decrementStock = (id) => {
    const item = stocks.find((stock) => stock.id === id)
    if (!item || item.qty === 0) return notify('Stok barang sudah habis')
    setStocks((current) => current.map((stock) => stock.id === id ? { ...stock, qty: stock.qty - 1 } : stock))
    notify('1 stok berhasil dikeluarkan')
  }

  const clearStock = (id) => {
    const item = stocks.find((stock) => stock.id === id)
    if (!item || !window.confirm(`Kosongkan seluruh stok “${item.name}”?`)) return
    setStocks((current) => current.map((stock) => stock.id === id ? { ...stock, qty: 0 } : stock))
    notify('Seluruh stok telah dikosongkan')
  }

  return (
    <div className="app-shell">
      {page === 'home' && <Home onNavigate={navigate} />}
      {page === 'master' && <MasterPage categories={categories} draft={categoryDraft} setDraft={setCategoryDraft} onAdd={addCategory} onDelete={removeCategory} onNavigate={navigate} />}
      {page === 'count' && <CountPage barcode={barcode} setBarcode={setBarcode} activeBarcode={activeBarcode} activeItem={activeItem} newItem={newItem} setNewItem={setNewItem} categories={categories} scannerOpen={scannerOpen} setScannerOpen={setScannerOpen} scannerNotice={scannerNotice} videoRef={videoRef} onProcess={processBarcode} onIncrement={incrementStock} onCreate={createStock} onNavigate={navigate} />}
      {page === 'stock' && <StockPage summary={summary} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} categories={categories} stocks={stocks} filteredStocks={filteredStocks} onOut={decrementStock} onClear={clearStock} onNavigate={navigate} />}
      <BottomNavigation page={page} onNavigate={navigate} />
      <div className={`toast ${toast ? 'show' : ''}`} role="status" aria-live="polite"><Icon name="check" size={19} /><span>{toast}</span></div>
    </div>
  )
}

function Home({ onNavigate }) {
  const menu = [
    { id: 'master', icon: 'database', title: 'Master Data', description: 'Kelola kategori barang.' },
    { id: 'count', icon: 'scan', title: 'Hitung Stok', description: 'Scan dan masukkan barang ke laci.' },
    { id: 'stock', icon: 'box', title: 'Lihat Stok', description: 'Lihat dan keluarkan stok dari laci.' },
  ]
  return <section className="page home-page">
    <header className="home-header"><Brand /></header>
    <main className="home-content">
      <div className="greeting"><span className="eyebrow"><i /> Inventory sederhana</span><h1>Semua stok, selalu<br />terorganisir.</h1><p>Pilih menu untuk mengelola kategori, memasukkan barang, atau melihat stok laci.</p></div>
      <div className="dashboard-tip"><span className="tip-icon"><Icon name="scan" /></span><span><b>Hitung stok lebih cepat</b><small>Scan barcode dan lanjutkan ke barang berikutnya tanpa berpindah halaman.</small></span></div>
      <SectionHeading title="Menu utama" caption="Pilih aktivitas" />
      <div className="menu-grid">{menu.map((item) => <button className="menu-card" key={item.id} onClick={() => onNavigate(item.id)}><span className="menu-icon"><Icon name={item.icon} size={27} /></span><span className="menu-text"><b>{item.title}</b><small>{item.description}</small></span><span className="arrow"><Icon name="arrowRight" size={19} /></span></button>)}</div>
    </main>
  </section>
}

function MasterPage({ categories, draft, setDraft, onAdd, onDelete, onNavigate }) {
  return <section className="page">
    <PageHeader />
    <main className="page-content">
      <SectionHeading title="Master kategori" caption="Untuk mengelompokkan barang" />
      <form className="card add-category" onSubmit={onAdd}><h2>Tambah kategori</h2><p>Buat kategori agar pencatatan stok lebih rapi.</p><div className="form-row"><label className="form-field"><span>Nama kategori</span><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Contoh: Tempered Glass" /></label><button className="button primary" type="submit"><Icon name="plus" size={18} />Tambah</button></div></form>
      <div className="card"><SectionHeading title="Daftar kategori" caption={categories.length ? `${categories.length} kategori` : ''} />
        <div className="category-list">{categories.length ? categories.map((category) => <div className="category-item" key={category}><span className="list-icon"><Icon name="tag" size={19} /></span><b>{category}</b><button className="button secondary icon-button" aria-label={`Hapus ${category}`} onClick={() => onDelete(category)}><Icon name="trash" size={18} /></button></div>) : <EmptyState icon="tag" title="Belum ada kategori" description="Tambahkan kategori pertama untuk mulai mengelola stok." />}</div>
      </div>
    </main>
  </section>
}

function CountPage({ barcode, setBarcode, activeBarcode, activeItem, newItem, setNewItem, categories, scannerOpen, setScannerOpen, scannerNotice, videoRef, onProcess, onIncrement, onCreate, onNavigate }) {
  const onManualSubmit = (event) => { event.preventDefault(); onProcess() }
  return <section className="page">
    <PageHeader />
    <main className="page-content">
      <div className="card scan-card"><h2>Scan barcode</h2><p>Arahkan kamera ke barcode, atau masukkan kode secara manual.</p>
        {scannerOpen && <div className="scanner-stage"><video ref={videoRef} autoPlay muted playsInline /><span className="scanner-frame" /><span className="scanner-line" /><span className="scanner-label">POSISIKAN BARCODE DI DALAM FRAME</span></div>}
        <button className="button primary scan-button" onClick={() => setScannerOpen((open) => !open)}>{scannerOpen ? <><Icon name="close" size={18} />TUTUP SCANNER</> : <><Icon name="camera" size={18} />SCAN BARCODE</>}</button>
        <form className="scan-options" onSubmit={onManualSubmit}><label className="field-with-icon"><Icon name="scan" size={19} /><input value={barcode} onChange={(event) => setBarcode(event.target.value)} inputMode="numeric" placeholder="Masukkan barcode manual" /></label><button className="button secondary" type="submit">Proses</button></form>
        {scannerNotice && <div className="notice"><Icon name="info" size={17} />{scannerNotice}</div>}
      </div>
      <div className="last-label"><Icon name="scan" size={17} />HASIL SCAN TERAKHIR</div>
      <div className="card result-card">{!activeBarcode ? <EmptyState icon="scan" title="Siap untuk menghitung" description="Scan barcode atau masukkan kode manual untuk mulai menambah stok." /> : activeItem ? <KnownItem item={activeItem} onIncrement={onIncrement} /> : <NewItemForm barcode={activeBarcode} categories={categories} item={newItem} setItem={setNewItem} onSubmit={onCreate} />}</div>
    </main>
  </section>
}

function KnownItem({ item, onIncrement }) {
  return <><div className="result-item"><div><h2>{item.name}</h2><p>Kategori: {item.category}</p><code>Barcode: {item.barcode}</code></div><div className="result-quantity"><b>{item.qty}</b><small>stok saat ini</small></div></div><div className="stock-after">Stok setelah masuk: <b>{item.qty + 1}</b></div><button className="button primary full" onClick={() => onIncrement(item.id)}><Icon name="plus" size={18} />MASUKKAN 1 STOK</button></>
}

function NewItemForm({ barcode, categories, item, setItem, onSubmit }) {
  return <form onSubmit={onSubmit}><h2>Barang baru</h2><p className="result-caption">Barcode: <code>{barcode}</code></p><div className="new-item-form"><label className="form-field wide"><span>Nama barang</span><input value={item.name} onChange={(event) => setItem({ ...item, name: event.target.value })} placeholder="Masukkan nama barang" /></label><label className="form-field"><span>Kategori</span><select value={item.category} onChange={(event) => setItem({ ...item, category: event.target.value })} disabled={!categories.length}>{categories.length ? categories.map((category) => <option key={category}>{category}</option>) : <option>Belum ada kategori</option>}</select></label><label className="form-field"><span>Jumlah awal</span><input type="number" min="1" inputMode="numeric" value={item.qty} onChange={(event) => setItem({ ...item, qty: event.target.value })} /></label></div>{!categories.length && <div className="notice"><Icon name="info" size={17} />Buat kategori terlebih dahulu di menu Master Data.</div>}<button className="button primary full" disabled={!categories.length} type="submit"><Icon name="plus" size={18} />MASUKKAN KE LACI</button></form>
}

function StockPage({ summary, query, setQuery, filter, setFilter, categories, stocks, filteredStocks, onOut, onClear, onNavigate }) {
  return <section className="page">
    <PageHeader />
    <main className="page-content">
      <div className="stats"><Stat value={summary.types} label="Jenis barang" /><Stat value={summary.total} label="Total stok" /><Stat value={summary.low} label="Stok menipis" low /></div>
      <div className="card stocks-card"><label className="field-with-icon search-field"><Icon name="search" size={20} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama barang atau barcode..." /></label><p className="filter-label">Filter kategori</p><div className="filter-chips"><button className={`chip ${!filter ? 'active' : ''}`} onClick={() => setFilter('')}>Semua</button>{categories.map((category) => <button className={`chip ${filter === category ? 'active' : ''}`} key={category} onClick={() => setFilter(category)}>{category}</button>)}</div>
        <div className="stock-list">{filteredStocks.length ? filteredStocks.map((item) => <StockCard item={item} key={item.id} onOut={onOut} onClear={onClear} />) : <EmptyState icon="box" title={stocks.length ? 'Stok tidak ditemukan' : 'Belum ada stok'} description={stocks.length ? 'Coba ubah kata kunci atau filter kategori.' : 'Mulai masukkan barang melalui menu Hitung Stok.'} action={!stocks.length ? <button className="button primary" onClick={() => onNavigate('count')}><Icon name="scan" size={18} />Mulai Hitung Stok</button> : null} />}</div>
      </div>
    </main>
  </section>
}

function StockCard({ item, onOut, onClear }) {
  const status = item.qty === 0 ? 'Stok habis' : item.qty <= 2 ? 'Stok menipis' : 'Stok tersedia'
  const statusClass = item.qty <= 2 ? 'alert' : ''
  return <article className="stock-item"><div className="stock-head"><div><h2>{item.name}</h2><p>{item.category}</p><code>Barcode: {item.barcode}</code><span className={`status ${statusClass}`}><i />{status}</span></div><div className="stock-quantity"><b>{item.qty}</b><small>stok tersedia</small></div></div><div className="stock-actions"><button className="button danger" onClick={() => onOut(item.id)}><Icon name="minus" size={18} />Keluarkan 1</button><button className="button secondary" onClick={() => onClear(item.id)}>Kosongkan</button></div></article>
}

function Brand() { return <div className="brand"><span className="brand-logo"><img src="/logo.png" alt="Logo STOK Kartika Ponorogo" /></span><span><b>STOK Kartika Ponorogo</b><small>by Hamida</small></span></div> }
function PageHeader() { return <header className="page-header"><Brand /></header> }
function SectionHeading({ title, caption }) { return <div className="section-heading"><h2>{title}</h2>{caption && <span>{caption}</span>}</div> }
function Stat({ value, label, low = false }) { return <div className={`stat ${low ? 'low' : ''}`}><b>{value}</b><span>{label}</span></div> }
function EmptyState({ icon, title, description, action }) { return <div className="empty-state"><span className="empty-icon"><Icon name={icon} size={26} /></span><b>{title}</b><p>{description}</p>{action}</div> }

function BottomNavigation({ page, onNavigate }) {
  const links = [['home', 'box', 'Home'], ['count', 'scan', 'Hitung'], ['stock', 'box', 'Stok'], ['master', 'database', 'Master']]
  return <nav className="bottom-navigation" aria-label="Navigasi utama">{links.map(([id, icon, label]) => <button className={page === id ? 'active' : ''} onClick={() => onNavigate(id)} key={id}><Icon name={icon} size={21} /><span>{label}</span></button>)}</nav>
}

export default App
