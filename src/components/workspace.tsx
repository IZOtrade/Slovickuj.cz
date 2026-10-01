"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { bulkImport, createDeck, createWord, deleteDeck, deleteWord, updateSettings, updateWord } from "@/app/actions";

type Word = { id: string; en: string; cz: string; category: string | null };
type Deck = { id: string; title: string; description: string | null; words: Word[] };
type Settings = { mode: string; autoPlay: boolean; speechRate: number };
type Props = { user: { name: string; email: string; image: string }; initialDecks: Deck[]; settings: Settings; signOut: () => Promise<void> };
type Mode = "mix" | "en_cz" | "cz_en";
type Tab = "study" | "library" | "settings";

const icons = { grid: "▦", book: "▤", sound: "◖))" };

export function Workspace({ user, initialDecks, settings: savedSettings, signOut }: Props) {
  const [decks, setDecks] = useState(initialDecks);
  const [selectedId, setSelectedId] = useState(initialDecks[0]?.id ?? "");
  const [tab, setTab] = useState<Tab>("study");
  const [mode, setMode] = useState<Mode>((savedSettings.mode as Mode) || "mix");
  const [directions, setDirections] = useState<Record<string, Exclude<Mode, "mix">>>({});
  const [autoPlay, setAutoPlay] = useState(savedSettings.autoPlay);
  const [speechRate, setSpeechRate] = useState(savedSettings.speechRate);
  const [query, setQuery] = useState("");
  const [round, setRound] = useState<string[]>([]);
  const [missed, setMissed] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [roundDone, setRoundDone] = useState(false);
  const [notice, setNotice] = useState("");
  const [pending, startTransition] = useTransition();
  const [deckDialog, setDeckDialog] = useState(false);
  const [wordDialog, setWordDialog] = useState(false);
  const [importDialog, setImportDialog] = useState(false);
  const [wordSearch, setWordSearch] = useState("");

  const deck = decks.find((item) => item.id === selectedId) ?? decks[0];
  const words = deck?.words ?? [];
  const queue = round.length ? round : words.map((word) => word.id);
  const currentWord = words.find((word) => word.id === queue[index]);
  const currentDirection = currentWord ? (mode === "mix" ? directions[currentWord.id] ?? "en_cz" : mode) : "en_cz";
  const filteredWords = useMemo(() => words.filter((word) => `${word.en} ${word.cz} ${word.category ?? ""}`.toLocaleLowerCase("cs").includes(wordSearch.toLocaleLowerCase("cs"))), [words, wordSearch]);
  const allWordsCount = decks.reduce((sum, item) => sum + item.words.length, 0);

  function speak(word: Word) {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const text = word.en.replace(/\(.*?\)/g, "").trim();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = speechRate;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  useEffect(() => {
    if (flipped && autoPlay && currentWord) speak(currentWord);
  }, [flipped, currentWord?.id, autoPlay]);

  function startRound(ids = words.map((word) => word.id), requestedMode: Mode = mode) {
    setRound([...ids].sort(() => Math.random() - 0.5));
    setDirections(Object.fromEntries(ids.map((id) => [id, requestedMode === "mix" ? (Math.random() > 0.5 ? "en_cz" : "cz_en") : requestedMode])));
    setMissed([]); setIndex(0); setFlipped(false); setRoundDone(false);
  }

  function grade(known: boolean) {
    if (!currentWord) return;
    const nextMissed = known ? missed : [...missed, currentWord.id];
    setMissed(nextMissed);
    if (index + 1 >= queue.length) { setRoundDone(true); setRound(queue); }
    else { setIndex(index + 1); setFlipped(false); }
  }

  async function addDeck(title: string, description: string) {
    const created = await createDeck({ title, description });
    setDecks((current) => [created as Deck, ...current]); setSelectedId(created.id); setTab("study"); setDeckDialog(false); setNotice("Balíček je připravený.");
  }
  async function addWord(en: string, cz: string, category: string) {
    if (!deck) return;
    const created = await createWord(deck.id, { en, cz, category });
    setDecks((current) => current.map((item) => item.id === deck.id ? { ...item, words: [...item.words, created as Word] } : item));
    setWordDialog(false); setNotice("Slovíčko přidáno.");
  }
  async function importWords(text: string) {
    if (!deck) return;
    const parsed = parseImport(text);
    if (!parsed.length) { setNotice("V textu jsem nenašel žádné platné řádky."); return; }
    const count = await bulkImport(deck.id, parsed);
    const localRows = parsed.map((row, i) => ({ ...row, id: `import-${Date.now()}-${i}` }));
    setDecks((current) => current.map((item) => item.id === deck.id ? { ...item, words: [...item.words, ...localRows] } : item));
    setImportDialog(false); setNotice(`Přidáno ${count} slovíček.`);
  }

  return <div className="app-shell" onKeyDown={(event) => {
    if (tab !== "study" || !currentWord || (event.target as HTMLElement).matches("input, textarea, button")) return;
    if (event.code === "Space") { event.preventDefault(); setFlipped((value) => !value); }
    if (flipped && event.key === "ArrowLeft") grade(false);
    if (flipped && event.key === "ArrowRight") grade(true);
    if (flipped && event.key === "1") grade(false);
    if (flipped && event.key === "2") grade(true);
  }} tabIndex={-1}>
    <aside className="sidebar">
      <a className="brand" href="#"><span className="brand-mark small">S<span>.</span></span><span>slovickuj<span className="brand-dot">.cz</span></span></a>
      <div className="side-label">TVŮJ PROSTOR</div>
      <nav className="side-nav">
        <button className={tab === "study" ? "active" : ""} onClick={() => setTab("study")}><span className="nav-icon">◉</span> Procvičování</button>
        <button className={tab === "library" ? "active" : ""} onClick={() => setTab("library")}><span className="nav-icon">▤</span> Moje slovíčka</button>
      </nav>
      <div className="side-label deck-label">BALÍČKY <button aria-label="Přidat balíček" onClick={() => setDeckDialog(true)}>+</button></div>
      <div className="deck-nav">
        {decks.map((item, i) => <button key={item.id} className={item.id === deck?.id ? "chosen" : ""} onClick={() => { setSelectedId(item.id); setRound([]); setIndex(0); setRoundDone(false); }}><span className={`deck-dot dot-${i % 4}`} />{item.title}<span className="deck-count">{item.words.length}</span></button>)}
        {decks.length === 0 && <p className="empty-sidebar">Zatím tu nic není.<br />Vytvoř si první balíček.</p>}
        <button className="new-deck" onClick={() => setDeckDialog(true)}><span className="nav-icon">＋</span> Nový balíček</button>
      </div>
      <div className="sidebar-bottom">
        <button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}><span className="nav-icon">⚙</span> Nastavení</button>
        <div className="user-card"><div className="avatar">{user.image ? <img src={user.image} alt="" /> : user.name.slice(0, 1).toUpperCase() || "S"}</div><div className="user-lines"><strong>{user.name || "Učící se"}</strong><span>{user.email}</span></div><form action={signOut}><button className="signout" title="Odhlásit se">↗</button></form></div>
      </div>
    </aside>

    <main className="main-content">
      <header className="topbar"><div className="breadcrumbs"><span>Můj prostor</span><span className="crumb-sep">/</span><strong>{tab === "settings" ? "Nastavení" : tab === "library" ? "Moje slovíčka" : deck?.title ?? "Přehled"}</strong></div><div className="topbar-right"><span className="streak"><span>✳</span> Uč se svým tempem</span><div className="top-avatar">{user.image ? <img src={user.image} alt="" /> : user.name.slice(0, 1).toUpperCase() || "S"}</div></div></header>

      {tab === "study" && <section className="page-content">
        <div className="page-heading"><div><p className="eyebrow">TVŮJ KLIDNÝ KOUTEK PRO ANGLIČTINU</p><h1>Dobrá práce začíná<br /><em>jedním slovíčkem.</em></h1></div><span className="heading-flower">✳</span></div>
        <div className="overview-grid">
          <article className="overview-card card-progress"><div className="card-topline"><span>CELKEM SLOVÍČEK</span><span className="tiny-spark">↗</span></div><div className="big-number">{allWordsCount}<span> slovíček</span></div><div className="mini-rule"><span style={{ width: `${allWordsCount ? 45 : 0}%` }} /></div><div className="card-caption">Každé opakování se počítá.</div></article>
          <article className="overview-card card-decks"><div className="card-topline"><span>TVÉ BALÍČKY</span><span className="tiny-grid">▦</span></div><div className="big-number">{decks.length}<span> balíčků</span></div><div className="card-caption">Každý má svůj příběh.</div></article>
          <article className="quote-card"><span className="quote-star">✳</span><p>Consistency<br />over intensity.</p><small>· MALÝ KROK JE TAKY KROK ·</small></article>
        </div>

        <div className="section-title-row"><div><p className="eyebrow">VYBER SI, CO SI DNES OPAKUJEŠ</p><h2>Tvoje balíčky</h2></div><button className="quiet-button" onClick={() => setDeckDialog(true)}>＋ Nový balíček</button></div>
        {decks.length === 0 ? <div className="empty-state"><div className="empty-illustration">✳</div><h3>Začni jedním malým balíčkem.</h3><p>Přidej pár slovíček, která chceš mít po ruce. Zbytek už půjde samo.</p><button className="primary-button" onClick={() => setDeckDialog(true)}>Vytvořit první balíček <span>→</span></button></div> : <div className="deck-cards">{decks.map((item, i) => <article className={`deck-card deck-card-${i % 4}`} key={item.id} onClick={() => setSelectedId(item.id)}><div className="deck-card-head"><span className={`deck-symbol symbol-${i % 4}`}>{["✳", "◒", "↗", "⌘"][i % 4]}</span><button className="more-button" aria-label={`Možnosti balíčku ${item.title}`} onClick={(e) => { e.stopPropagation(); if (window.confirm(`Smazat balíček „${item.title}“ i se všemi slovíčky?`)) startTransition(async () => { await deleteDeck(item.id); setDecks((current) => current.filter((entry) => entry.id !== item.id)); if (selectedId === item.id) setSelectedId(decks.find((entry) => entry.id !== item.id)?.id ?? ""); }); }}>···</button></div><div className="deck-meta">BALÍČEK · {String(i + 1).padStart(2, "0")}</div><h3>{item.title}</h3><p>{item.description || "Pár slovíček pro další malý pokrok."}</p><div className="deck-card-bottom"><span><strong>{item.words.length}</strong> slovíček</span><button onClick={(e) => { e.stopPropagation(); setSelectedId(item.id); setTab("study"); startRound(item.words.map((word) => word.id)); }}>Procvičit <span>→</span></button></div></article>)}</div>}

        {deck && deck.words.length > 0 && <div className="trainer-wrap"><div className="section-title-row trainer-heading"><div><p className="eyebrow">MALÉ KOLO, VELKÝ POKROK</p><h2>Procvičit {deck.title}</h2></div><div className="mode-pills"><button className={mode === "en_cz" ? "selected" : ""} onClick={() => { setMode("en_cz"); startRound(words.map((word) => word.id), "en_cz"); }}>EN → CZ</button><button className={mode === "mix" ? "selected" : ""} onClick={() => { setMode("mix"); startRound(words.map((word) => word.id), "mix"); }}>Mix</button><button className={mode === "cz_en" ? "selected" : ""} onClick={() => { setMode("cz_en"); startRound(words.map((word) => word.id), "cz_en"); }}>CZ → EN</button></div></div>
          {roundDone ? <div className="result-card"><span className="result-star">✳</span><p className="eyebrow">KOLO DOKONČENO</p><h3>{missed.length === 0 ? "Všechna slovíčka máš." : `Umíš ${words.length - missed.length} z ${words.length} slovíček.`}</h3><p>{missed.length === 0 ? "Skvělá práce. Dej si chvilku a vrať se zase zítra." : `Zbylo ${missed.length} ${missed.length === 1 ? "slovíčko" : "slovíček"} k procvičení. Každým kolem to půjde lépe.`}</p><div className="result-actions">{missed.length > 0 && <button className="primary-button" onClick={() => startRound(missed)}>Procvičit zbývající slovíčka <span>→</span></button>}<button className="quiet-button" onClick={() => startRound()}>Začít celé kolo znovu</button></div></div> : <div className="trainer-card"><div className="trainer-progress"><div className="progress-copy"><span>{deck.title}</span><span>{index + (queue.length ? 1 : 0)} <i>/</i> {queue.length}</span></div><div className="progress-track"><span style={{ width: `${queue.length ? ((index + 1) / queue.length) * 100 : 0}%` }} /></div></div>{currentWord ? <div className={`flash-card ${flipped ? "flipped" : ""}`} onClick={() => setFlipped((value) => !value)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") setFlipped((value) => !value); }}><div className="flash-top"><span className="direction-tag">{currentDirection === "en_cz" ? "EN → CZ" : "CZ → EN"}</span>{currentWord.category && <span className="category-tag">{currentWord.category}</span>}</div><div className="flash-main"><span className="flash-label">{flipped ? "SPRÁVNÁ ODPOVĚĎ" : "JAK TO ŘEKNEŠ?"}</span><h3>{flipped ? (currentDirection === "cz_en" ? currentWord.en : currentWord.cz) : (currentDirection === "cz_en" ? currentWord.cz : currentWord.en)}</h3>{flipped && <div className="answer-actions"><button className="sound-button" aria-label="Přehrát výslovnost" onClick={(e) => { e.stopPropagation(); speak(currentWord); }}>{icons.sound}</button></div>}</div><div className="flash-bottom"><span>{flipped ? "Zkus si slovo říct nahlas." : "Klikni nebo stiskni mezerník pro otočení."}</span><span className="flash-orbit">✳</span></div></div> : <div className="flash-card empty-flash"><div className="flash-main"><span className="flash-label">TADY TO ZAČÍNÁ</span><h3>Přidej první slovíčko.</h3><button className="quiet-button" onClick={() => setWordDialog(true)}>＋ Přidat slovíčko</button></div></div>}{currentWord && <div className={`grade-actions ${flipped ? "ready" : ""}`}><button className="grade-button forgot" disabled={!flipped} onClick={() => grade(false)}><span>×</span><span>Nevím <small>← · 1</small></span></button><button className="grade-button know" disabled={!flipped} onClick={() => grade(true)}><span>✓</span><span>Vím <small>→ · 2</small></span></button></div>}<div className="trainer-help">{icons.book} Počítá se každý pokus. Chyby se vrátí v dalším kole.</div></div>}
        </div>}
      </section>}

      {tab === "library" && <section className="page-content library-page"><div className="section-title-row"><div><p className="eyebrow">TVOJE SLOVNÍ ZÁSOBA NA JEDNOM MÍSTĚ</p><h1>Moje slovíčka</h1></div><div className="library-actions"><button className="quiet-button" onClick={() => setImportDialog(true)}>↑ Hromadný import</button><button className="primary-button" onClick={() => setWordDialog(true)}>＋ Přidat slovíčko</button></div></div><div className="library-toolbar"><select value={deck?.id ?? ""} onChange={(e) => setSelectedId(e.target.value)} aria-label="Vyber balíček">{decks.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><label className="search-box"><span>⌕</span><input value={wordSearch} onChange={(e) => setWordSearch(e.target.value)} placeholder="Hledat anglicky, česky nebo podle štítku…" /></label><button className="export-button" onClick={() => exportDeck(deck, "csv")}>↓ Export CSV</button><button className="export-button" onClick={() => exportDeck(deck, "json")}>↓ JSON</button></div>{!deck ? <div className="empty-state"><h3>Zatím nemáš žádný balíček.</h3><button className="primary-button" onClick={() => setDeckDialog(true)}>Vytvořit balíček →</button></div> : <div className="word-table-wrap"><table className="word-table"><thead><tr><th>ANGLICKY</th><th>ČESKY</th><th>KATEGORIE</th><th /></tr></thead><tbody>{filteredWords.map((word) => <WordRow key={word.id} word={word} onSave={async (value) => { const updated = await updateWord(word.id, value); setDecks((current) => current.map((item) => item.id === deck.id ? { ...item, words: item.words.map((old) => old.id === word.id ? updated as Word : old) } : item)); }} onDelete={async () => { await deleteWord(word.id); setDecks((current) => current.map((item) => item.id === deck.id ? { ...item, words: item.words.filter((old) => old.id !== word.id) } : item)); }} />)}</tbody></table>{filteredWords.length === 0 && <div className="table-empty">{words.length ? "Zkus jiné hledání." : "V tomhle balíčku zatím nic není."}</div>}</div>}</section>}

      {tab === "settings" && <section className="page-content settings-page"><div className="section-title-row"><div><p className="eyebrow">TAK, JAK TI TO VYHOVUJE</p><h1>Nastavení</h1></div></div><div className="settings-card"><div className="settings-intro"><div className="setting-icon">◉</div><div><h3>Jak chceš procvičovat?</h3><p>Vyber směr překladu, který ti sedí nejvíc.</p></div></div><div className="settings-options">{([["mix", "Mix 50/50", "Směr se u každé kartičky náhodně střídá."], ["en_cz", "Angličtina → čeština", "Nejdřív si vybavíš český význam."], ["cz_en", "Čeština → angličtina", "Procvičíš si aktivní vybavování slov."]] as const).map(([value, label, detail]) => <button key={value} className={`setting-choice ${mode === value ? "checked" : ""}`} onClick={() => { setMode(value); startTransition(async () => { await updateSettings({ mode: value, autoPlay, speechRate }); }); }}><span className="radio-mark" /><span><strong>{label}</strong><small>{detail}</small></span></button>)}</div><div className="setting-separator" /><div className="setting-row"><div><strong>Automatická výslovnost</strong><small>Přehrát anglické slovíčko po otočení kartičky.</small></div><button className={`switch ${autoPlay ? "on" : ""}`} role="switch" aria-checked={autoPlay} onClick={() => { const next = !autoPlay; setAutoPlay(next); startTransition(async () => { await updateSettings({ mode, autoPlay: next, speechRate }); }); }}><span /></button></div><div className="setting-row rate-row"><div><strong>Rychlost hlasu</strong><small>{speechRate.toFixed(1)}× · Příjemné tempo na poslech i opakování.</small></div><input type="range" min="0.8" max="1.1" step="0.1" value={speechRate} onChange={(e) => setSpeechRate(Number(e.target.value))} onMouseUp={() => startTransition(async () => { await updateSettings({ mode, autoPlay, speechRate }); })} onTouchEnd={() => startTransition(async () => { await updateSettings({ mode, autoPlay, speechRate }); })} /></div></div><div className="settings-note"><span>✳</span><p>Nastavení se ukládá jen pro tvůj účet.</p></div></section>}
      <footer className="app-footer"><span>Malý krok. Velký pokrok. <span className="footer-star">✳</span></span><span>SLOVICKUJ.CZ · 2026</span></footer>
    </main>
    {notice && <div className="toast" role="status">{notice}<button onClick={() => setNotice("")}>×</button></div>}
    {pending && <div className="saving-indicator">Ukládám…</div>}
    {deckDialog && <Modal title="Nový balíček" onClose={() => setDeckDialog(false)}><DeckForm onSave={addDeck} onCancel={() => setDeckDialog(false)} /></Modal>}
    {wordDialog && <Modal title="Přidat slovíčko" onClose={() => setWordDialog(false)}><WordForm onSave={addWord} onCancel={() => setWordDialog(false)} /></Modal>}
    {importDialog && <Modal title="Hromadný import" onClose={() => setImportDialog(false)}><ImportForm onImport={importWords} onCancel={() => setImportDialog(false)} /></Modal>}
  </div>;
}

function parseImport(text: string) {
  return text.split(/\r?\n/).map((line) => {
    const delim = line.includes("\t") ? "\t" : line.includes(";") ? ";" : ",";
    const parts = line.split(delim).map((item) => item.trim());
    if (parts.length < 2 || !parts[0] || !parts[1]) return null;
    return { en: parts[0], cz: parts[1], category: parts[2]?.replace(/^\[|\]$/g, "") };
  }).filter((row): row is { en: string; cz: string; category: string | undefined } => !!row);
}

function exportDeck(deck: Deck | undefined, format: "json" | "csv") {
  if (!deck) return;
  const body = format === "json" ? JSON.stringify({ title: deck.title, description: deck.description, words: deck.words.map(({ en, cz, category }) => ({ en, cz, category })) }, null, 2) : ["en;cz;category", ...deck.words.map((word) => [word.en, word.cz, word.category ?? ""].map((value) => `"${value.replaceAll('"', '""')}"`).join(";"))].join("\n");
  const blob = new Blob([body], { type: format === "json" ? "application/json" : "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${deck.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.${format}`; anchor.click(); URL.revokeObjectURL(url);
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div className="modal-scrim" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal-card" role="dialog" aria-modal="true" aria-label={title}><div className="modal-head"><div><p className="eyebrow">MALÝ KROK ZAČÍNÁ</p><h2>{title}</h2></div><button className="modal-close" onClick={onClose} aria-label="Zavřít">×</button></div>{children}</section></div>;
}

function DeckForm({ onSave, onCancel }: { onSave: (title: string, description: string) => Promise<void>; onCancel: () => void }) {
  const [title, setTitle] = useState(""); const [description, setDescription] = useState(""); const [busy, setBusy] = useState(false);
  return <form className="form-stack" onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { await onSave(title, description); } finally { setBusy(false); } }}><label>Název balíčku<input required maxLength={100} autoFocus placeholder="např. Cestování" value={title} onChange={(e) => setTitle(e.target.value)} /></label><label>Krátký popis <span className="optional">(nepovinné)</span><textarea rows={3} maxLength={500} placeholder="Co si v něm chceš procvičit?" value={description} onChange={(e) => setDescription(e.target.value)} /></label><div className="form-actions"><button type="button" className="quiet-button" onClick={onCancel}>Zrušit</button><button disabled={busy} className="primary-button">Vytvořit balíček <span>→</span></button></div></form>;
}

function WordForm({ onSave, onCancel }: { onSave: (en: string, cz: string, category: string) => Promise<void>; onCancel: () => void }) {
  const [en, setEn] = useState(""); const [cz, setCz] = useState(""); const [category, setCategory] = useState(""); const [busy, setBusy] = useState(false);
  return <form className="form-stack" onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { await onSave(en, cz, category); } finally { setBusy(false); } }}><label>Anglický výraz<input required autoFocus placeholder="to figure out" value={en} onChange={(e) => setEn(e.target.value)} /></label><label>Český překlad<input required placeholder="rozklíčovat" value={cz} onChange={(e) => setCz(e.target.value)} /></label><label>Kategorie nebo štítek <span className="optional">(nepovinné)</span><input placeholder="např. fráze" value={category} onChange={(e) => setCategory(e.target.value)} /></label><div className="form-actions"><button type="button" className="quiet-button" onClick={onCancel}>Zrušit</button><button disabled={busy} className="primary-button">Přidat slovíčko <span>→</span></button></div></form>;
}

function ImportForm({ onImport, onCancel }: { onImport: (text: string) => Promise<void>; onCancel: () => void }) {
  const [text, setText] = useState(""); const preview = parseImport(text); const [busy, setBusy] = useState(false);
  return <form className="form-stack" onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { await onImport(text); } finally { setBusy(false); } }}><p className="import-hint">Vlož řádky ve formátu <code>anglicky ; česky ; [kategorie]</code>. Fungují také čárky a tabulátory.</p><textarea className="import-area" rows={6} autoFocus placeholder={'to figure out ; rozklíčovat ; fráze\na journey ; cesta ; cestování'} value={text} onChange={(e) => setText(e.target.value)} /><div className="import-preview"><div className="preview-title">NÁHLED · {preview.length} {preview.length === 1 ? "ŘÁDEK" : "ŘÁDKŮ"}</div>{preview.slice(0, 4).map((row, i) => <div className="preview-row" key={i}><span>{row.en}</span><span>{row.cz}</span><span>{row.category}</span></div>)}{preview.length > 4 && <small>A dalších {preview.length - 4}…</small>}</div><div className="form-actions"><button type="button" className="quiet-button" onClick={onCancel}>Zrušit</button><button disabled={busy || !preview.length} className="primary-button">Přidat {preview.length} slovíček <span>→</span></button></div></form>;
}

function WordRow({ word, onSave, onDelete }: { word: Word; onSave: (value: { en: string; cz: string; category: string }) => Promise<void>; onDelete: () => Promise<void> }) {
  const [editing, setEditing] = useState(false); const [en, setEn] = useState(word.en); const [cz, setCz] = useState(word.cz); const [category, setCategory] = useState(word.category ?? "");
  return <tr>{editing ? <><td><input aria-label="Anglické slovíčko" value={en} onChange={(e) => setEn(e.target.value)} /></td><td><input aria-label="Český překlad" value={cz} onChange={(e) => setCz(e.target.value)} /></td><td><input aria-label="Kategorie" value={category} onChange={(e) => setCategory(e.target.value)} /></td><td className="row-actions"><button onClick={async () => { await onSave({ en, cz, category }); setEditing(false); }}>Uložit</button><button onClick={() => setEditing(false)}>×</button></td></> : <><td><strong>{word.en}</strong></td><td>{word.cz}</td><td>{word.category && <span className="table-tag">{word.category}</span>}</td><td className="row-actions"><button aria-label="Upravit" onClick={() => setEditing(true)}>Upravit</button><button aria-label="Smazat" onClick={async () => { if (window.confirm(`Smazat „${word.en}“?`)) await onDelete(); }}>×</button></td></>}</tr>;
}
