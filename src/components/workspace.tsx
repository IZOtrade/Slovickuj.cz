"use client";

import { useEffect, useId, useRef, useState, type ReactNode, type SetStateAction } from "react";
import { recordReview, bulkImport, createDeck, createWord, deleteDeck, deleteWord, updateSettings, updateWord } from "@/app/actions";
import { parseImport } from "@/lib/import-words";
import { emptyHistory, historyCounts, recommendedIds, type DeckHistory, type Progress } from "@/lib/practice-history";
import { rateRound, roundCounts, retryIds, swipeRating, type Rating, type Round } from "@/lib/practice";

type Word = { id: string; en: string; cz: string; category: string | null };
type Deck = { id: string; title: string; description: string | null; words: Word[] };
type Mode = "mix" | "en_cz" | "cz_en";
type Tab = "study" | "decks" | "library" | "settings";
type Settings = { mode: string; speechRate: number };
type Props = { user: { name: string; email: string; image: string }; initialDecks: Deck[]; initialHistory: Record<string, DeckHistory>; settings: Settings; signOut: () => Promise<void> };
type IconName = "cards" | "book" | "grid" | "plus" | "arrow" | "sound" | "settings" | "search" | "upload" | "download" | "check" | "close" | "edit" | "trash" | "exit" | "shuffle";
const paths: Record<IconName, ReactNode> = {
  cards: <><rect x="6" y="4" width="13" height="17" rx="3"/><path d="M3 17V5a3 3 0 0 1 3-3h9M10 10h5m-5 4h3"/></>,
  book: <path d="M12 5v15M3 4h5a4 4 0 0 1 4 2 4 4 0 0 1 4-2h5v15h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3z"/>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
  plus: <path d="M12 5v14M5 12h14"/>, arrow: <path d="M4 12h16m-6-6 6 6-6 6"/>,
  sound: <path d="m11 4-6 5H2v6h3l6 5zM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>,
  settings: <><path d="m9 3-1 3-3 1-2 3 2 2-1 3 2 3 3-1 3 2 3-2 3 1 2-3-1-3 2-2-2-3-3-1-1-3z"/><circle cx="12" cy="11" r="3"/></>,
  search: <><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></>,
  upload: <path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>, download: <path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4"/>,
  check: <path d="m5 12 4 4L19 6"/>, close: <path d="m6 6 12 12M6 18 18 6"/>, edit: <path d="m14 5 5 5M4 20l5-1L21 7l-5-5L4 14z"/>,
  trash: <path d="M3 6h18M8 6V3h8v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>, exit: <path d="M10 4H4v16h6m3-13 5 5-5 5m-5-5h13"/>,
  shuffle: <path d="M3 6h3l12 12h3m-4-4 4 4-4 4M3 18h3l4-4m4-4 4-4h3m-4-4 4 4-4 4"/>,
};
function Icon({ name }: { name: IconName }) { return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>; }
const nav: { tab: Tab; label: string; icon: IconName }[] = [{ tab: "study", label: "Procvičovat", icon: "cards" }, { tab: "decks", label: "Balíčky", icon: "grid" }, { tab: "library", label: "Slovíčka", icon: "book" }];
const modes: { value: Mode; label: string }[] = [{ value: "en_cz", label: "EN → CZ" }, { value: "mix", label: "Mix" }, { value: "cz_en", label: "CZ → EN" }];
const wordCount = (n: number) => `${n} ${n === 1 ? "slovíčko" : n >= 2 && n <= 4 ? "slovíčka" : "slovíček"}`;
const deckCount = (n: number) => `${n} ${n === 1 ? "balíček" : n >= 2 && n <= 4 ? "balíčky" : "balíčků"}`;

export function Workspace({ user, initialDecks, initialHistory, settings: saved, signOut }: Props) {
  const [decks, setDecks] = useState(initialDecks);
  const [selectedId, setSelectedId] = useState(initialDecks[0]?.id ?? "");
  const [tab, setTab] = useState<Tab>("study");
  const [mode, setMode] = useState<Mode>(modes.some(m => m.value === saved.mode) ? saved.mode as Mode : "mix");
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [speechRate, setSpeechRate] = useState(saved.speechRate);
  const [rounds, setRounds] = useState<Record<string, Round | null>>({});
  const [histories, setHistories] = useState(initialHistory);
  const [reviewSaving, setReviewSaving] = useState(false);
  const reviewInFlight = useRef(false);
  const pendingReview = useRef<{wordId:string;sessionId:string;eventId:string}|null>(null);
  const [historyNow, setHistoryNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setHistoryNow(Date.now()), 60_000); return () => clearInterval(timer); }, []);
  const [dialog, setDialog] = useState<"deck" | "word" | "import" | null>(null);
  const [deletion, setDeletion] = useState<{ kind: "deck"; deck: Deck } | { kind: "word"; deckId: string; word: Word } | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [deckQuery, setDeckQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const deck = decks.find(item => item.id === selectedId) ?? decks[0];
  const round = deck ? rounds[deck.id] ?? null : null;
  const history = deck ? histories[deck.id] ?? emptyHistory() : emptyHistory();
  function setRound(next: SetStateAction<Round | null>) {
    const id = deck?.id; if (!id) return;
    setRounds(previous => ({...previous,[id]:typeof next === "function" ? next(previous[id] ?? null) : next}));
  }
  const words = deck?.words ?? [];
  const recommended = recommendedIds(words.map(word => word.id), history, historyNow);
  const total = decks.reduce((sum, item) => sum + item.words.length, 0);
  const current = round ? words.find(word => word.id === round.ids[round.index]) : undefined;
  const categories = [...new Set(words.map(word => word.category).filter((value): value is string => !!value))];
  const filtered = words.filter(word => (!category || word.category === category) && `${word.en} ${word.cz} ${word.category ?? ""}`.toLocaleLowerCase("cs").includes(query.toLocaleLowerCase("cs")));
  const direction = current && round ? round.directions[current.id] : "en_cz";
  const counts = roundCounts(round);
  const retry = round ? retryIds(round) : [];

  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [tab]);

  function selectDeck(id: string) { setSelectedId(id); if (rounds[id]) setMode(rounds[id]!.mode); setCategory(""); setQuery(""); }
  function begin(ids = words.map(word => word.id), requestedMode = mode) {
    if (!ids.length) return;
    const shuffled = [...ids];
    for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
    setRound({ sessionId: crypto.randomUUID(), mode: requestedMode, ids: shuffled, directions: Object.fromEntries(shuffled.map(id => [id, requestedMode === "mix" ? Math.random() < .5 ? "en_cz" : "cz_en" : requestedMode])), index: 0, answers: {}, flipped: false, done: false });
  }
  function stopSpeech() {
    speechRef.current = null;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  }
  async function grade(rating: Rating) {
    if (!round?.flipped || round.done || !current || !deck || reviewInFlight.current) return;
    stopSpeech();
    reviewInFlight.current = true; setReviewSaving(true);
    const targetSession = round.sessionId;
    const targetDeck = deck.id;
    if (pendingReview.current?.sessionId !== targetSession || pendingReview.current?.wordId !== current.id) {
      pendingReview.current = {sessionId:targetSession,wordId:current.id,eventId:crypto.randomUUID()};
    }
    try {
      const result = await recordReview({eventId:pendingReview.current.eventId,sessionId:targetSession,wordId:current.id,deckId:targetDeck,totalWords:round.ids.length,mode:round.mode,direction,rating});
      setHistories(previous => ({...previous,[targetDeck]:result.history}));
      setHistoryNow(Date.now());
      setRound(previous => previous?.sessionId === targetSession ? rateRound(previous,result.rating) : previous);
      pendingReview.current = null;
    } catch {
      setNotice("Hodnocení se neuložilo. Zkontroluj připojení a zkus stejnou volbu znovu.");
    } finally { reviewInFlight.current = false; setReviewSaving(false); }
  }
  function speak(word: Pick<Word, "en">) {
    if (!("speechSynthesis" in window)) { setNotice("Tento prohlížeč nepodporuje výslovnost."); return; }
    stopSpeech();
    const utterance = new SpeechSynthesisUtterance(word.en.replace(/\(.*?\)/g, "").trim() || word.en);
    utterance.lang = "en-US"; utterance.rate = speechRate;
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(item => item.lang === "en-US") ?? voices.find(item => item.lang.startsWith("en"));
    if (voice) utterance.voice = voice;
    speechRef.current = utterance;
    utterance.onstart = () => { if (speechRef.current === utterance) setSpeaking(true); };
    utterance.onend = () => { if (speechRef.current === utterance) { speechRef.current = null; setSpeaking(false); } };
    utterance.onerror = event => {
      if (speechRef.current !== utterance) return;
      speechRef.current = null; setSpeaking(false);
      if (event.error !== "interrupted" && event.error !== "canceled") setNotice("Výslovnost se nepodařilo přehrát. Zkus tlačítko Výslovnost znovu.");
    };
    window.speechSynthesis.speak(utterance);
  }
  function reveal() {
    if (!current || !round || round.done) return;
    // Speak directly inside the tap/key handler so mobile browsers retain user activation.
    speak(current);
    setRound(previous => previous && !previous.done ? { ...previous, flipped: true } : previous);
  }
  useEffect(() => {
    setSpeaking(false);
    return () => {
      speechRef.current = null;
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, [tab, deck?.id, round?.ids]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (reviewInFlight.current || dialog || deletion || tab !== "study" || !round || round.done || (event.target as HTMLElement).closest("input, textarea, select, a")) return;
      if (event.code === "Space" && !(event.target as HTMLElement).closest("button")) { event.preventDefault(); reveal(); }
      if (event.key === "1" || event.key === "ArrowLeft") { event.preventDefault(); grade("unknown"); }
      if (event.key === "2" || event.key === "ArrowUp") { event.preventDefault(); grade("unsure"); }
      if (event.key === "3" || event.key === "ArrowRight") { event.preventDefault(); grade("known"); }
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [dialog, deletion, tab, round, speechRate]);
  useEffect(() => { if (!notice) return; const timeout = setTimeout(() => setNotice(""), 5000); return () => clearTimeout(timeout); }, [notice]);
  async function run(action: () => Promise<void>) { setBusy(true); try { await action(); } catch (error) { setNotice(error instanceof Error ? error.message : "Uložení se nezdařilo. Zkus to znovu."); } finally { setBusy(false); } }
  async function saveSettings(next: { mode: Mode; speechRate: number }) {
    const previous = { mode, speechRate };
    stopSpeech(); setMode(next.mode); setSpeechRate(next.speechRate); setRound(null);
    await run(async () => { try { await updateSettings(next); setNotice("Nastavení uloženo."); } catch (error) { setMode(previous.mode); setSpeechRate(previous.speechRate); throw error; } });
  }
  const modeChips = <div className="chips" aria-label="Směr procvičování">{modes.map(item => <button key={item.value} disabled={reviewSaving} className={`chip ${mode === item.value ? "is-active" : ""}`} aria-pressed={mode === item.value} onClick={() => { setMode(item.value); setRound(null); }}>{item.value === "mix" && <Icon name="shuffle"/>}{item.label}</button>)}</div>;

  return <div className="workspace">
    <a className="skip-link" href="#main">Přeskočit na obsah</a>
    <header className="app-header"><div className="header-inner">
      <button className="wordmark" aria-label="Slovickuj.cz – procvičování" onClick={() => setTab("study")}><span className="logo-mark">s.</span><span>SLOVÍČKUJ<span className="brand-domain">.CZ</span></span></button>
      <nav className="desktop-nav" aria-label="Hlavní navigace">{nav.map(item => <button key={item.tab} aria-current={tab === item.tab ? "page" : undefined} className={tab === item.tab ? "active" : ""} onClick={() => setTab(item.tab)}><Icon name={item.icon}/>{item.label}</button>)}</nav>
      <div className="header-account"><span className="header-name">{user.name.split(" ")[0]}</span><button className={`header-settings ${tab === "settings" ? "active" : ""}`} aria-label="Nastavení" onClick={() => setTab("settings")}><Icon name="settings"/></button><button className="avatar" aria-label="Můj účet" onClick={() => setTab("settings")}>{user.name.slice(0, 1).toUpperCase() || "S"}</button></div>
    </div></header>
    <div className={`app-body ${tab === "settings" ? "settings-layout" : ""}`}>
      {tab !== "settings" && <aside className="deck-sidebar" aria-label="Moje balíčky"><div className="sidebar-title"><span>MOJE BALÍČKY</span><button className="icon-button" aria-label="Nový balíček" onClick={() => setDialog("deck")}><Icon name="plus"/></button></div><div className="sidebar-decks">{decks.map(item => <button className={`sidebar-deck ${deck?.id === item.id ? "selected" : ""}`} key={item.id} onClick={() => selectDeck(item.id)} aria-pressed={deck?.id === item.id}><span className="deck-mini"><Icon name="cards"/></span><span>{item.title}</span><span className="count">{item.words.length}</span></button>)}</div>{!decks.length && <p className="muted sidebar-empty">První balíček je začátek.<br/>Co se chceš naučit?</p>}<button className="chip add-deck" onClick={() => setDialog("deck")}><Icon name="plus"/>Vytvořit balíček</button><div className="sidebar-note"><span className="tiny-label">JEDNO SLOVO ZA DRUHÝM</span><p>Malé kroky.<br/><strong>Velká slovní zásoba.</strong></p><span className="note-symbol" aria-hidden="true">↗</span></div><div className="sidebar-summary"><span>{wordCount(total)}</span><span>{deckCount(decks.length)}</span></div></aside>}
      <main id="main" className="workspace-main" tabIndex={-1}>
        <div className="page-title"><div><p className="eyebrow">{tab === "study" ? "PÁR MINUT PRO TVOU ANGLIČTINU" : tab === "decks" ? "VŠECHNO MÁ SVÉ MÍSTO" : tab === "library" ? "TVOJE VLASTNÍ SLOVNÍ ZÁSOBA" : "PODLE TVÉHO TEMPA"}</p><h1>{tab === "study" ? "Jdeme na slovíčka." : tab === "decks" ? "Moje balíčky." : tab === "library" ? "Moje slovíčka." : "Nastavení."}</h1></div><div className="title-actions">{tab === "decks" ? <button className="button primary" onClick={() => setDialog("deck")}><Icon name="plus"/>Nový balíček</button> : tab !== "settings" && deck && <button className="button primary" onClick={() => setDialog("word")}><Icon name="plus"/>Přidat slovíčko</button>}</div></div>
        {tab !== "settings" && tab !== "decks" && decks.length > 0 && <div className="mobile-decks chips" aria-label="Vyber balíček">{decks.map(item => <button key={item.id} className={`chip ${deck?.id === item.id ? "is-active" : ""}`} aria-pressed={deck?.id === item.id} onClick={() => selectDeck(item.id)}>{item.title}<span className="count">{item.words.length}</span></button>)}</div>}
        {tab === "study" && <>
          <p className="stats-caption">Aktuální kolo{reviewSaving ? " · ukládám hodnocení…" : " · výsledky se průběžně ukládají"}</p><div className="quick-stats rating-stats" aria-label="Hodnocení v tomto kole"><div><Icon name="check"/><strong>{counts.known}</strong><span>vím</span></div><div><Icon name="shuffle"/><strong>{counts.unsure}</strong><span>tuším</span></div><div><Icon name="close"/><strong>{counts.unknown}</strong><span>nevím</span></div></div>
          {!deck ? <Empty title="Každé slovo se počítá." text="Vytvoř první balíček. Třeba Cestování, Práce nebo slova, která ti nejdou."><button className="button primary" onClick={() => setDialog("deck")}><Icon name="plus"/>Vytvořit balíček</button></Empty> : <>
            <div className="section-heading"><div><span className="tiny-label">PRÁVĚ PROCVIČUJEŠ</span><h2>{deck.title}</h2></div>{modeChips}</div>
            <HistoryPanel deck={deck} history={history} now={historyNow}/>
            {!words.length ? <Empty title="Tady to začíná." text="Přidej první slovíčko nebo rovnou nahraj celý seznam."><button className="button primary" onClick={() => setDialog("word")}><Icon name="plus"/>Přidat slovíčko</button><button className="button secondary" onClick={() => setDialog("import")}><Icon name="upload"/>Hromadný import</button></Empty> : !round ? <div className="study-start panel"><span className="study-art" aria-hidden="true"><span className="mini-flash back">hello.</span><span className="mini-flash front">ahoj.<span>↗</span></span></span><span className="tiny-label">MALÁ CHVILKA. VELKÝ ROZDÍL.</span><h2>Připraveno?<br/>Tak pojď na to.</h2><p>{wordCount(words.length)} · {mode === "mix" ? "oba směry na přeskáčku" : mode === "en_cz" ? "z angličtiny do češtiny" : "z češtiny do angličtiny"}</p><div className="start-options"><button className="button primary start-button" onClick={() => begin()}>Celý balíček <span>{words.length}</span><Icon name="arrow"/></button><button className="button secondary" disabled={!recommended.length} onClick={() => begin(recommended)}>K zopakování <span>{recommended.length}</span><Icon name="shuffle"/></button></div><p className="all-words-note">Celý balíček vždy obsahuje i slova, která už umíš.</p><span className="muted start-foot">Klepni pro překlad a poslech. Pak zvol Nevím, Tuším nebo Vím.</span></div> : round.done ? <div className="round-result panel"><span className="result-icon"><Icon name={retry.length ? "shuffle" : "check"}/></span><span className="tiny-label">KOLO HOTOVO</span><h2>{retry.length ? "Ještě kousek." : "Tohle máš v hlavě!"}</h2><p>V tomto kole umíš <strong>{counts.known} z {round.ids.length}</strong>.</p><div className="result-rating-summary"><span>Nevím <strong>{counts.unknown}</strong></span><span>Tuším <strong>{counts.unsure}</strong></span><span>Vím <strong>{counts.known}</strong></span></div><div className="result-actions">{retry.length > 0 && <button className="button primary" onClick={() => begin(retry)}>Zopakovat {wordCount(retry.length)}<Icon name="arrow"/></button>}<button className={`button ${retry.length ? "secondary" : "primary"}`} onClick={() => begin()}>Celý balíček znovu<Icon name="shuffle"/></button></div></div> : current && <PracticeCard key={current.id} word={current} direction={direction} flipped={round.flipped} index={round.index} total={round.ids.length} speaking={speaking} saving={reviewSaving} onReveal={reveal} onSpeak={() => speak(current)} onGrade={grade} onRestart={() => {stopSpeech();begin();}}/>}

            <div className="study-tools"><button className="chip" onClick={() => setTab("library")}><Icon name="book"/>Zobrazit slovíčka</button><button className="chip" onClick={() => setDialog("import")}><Icon name="upload"/>Hromadný import</button></div>
          </>}
        </>}
        {tab === "decks" && <><div className="list-summary"><span><strong>{deckCount(decks.length)}</strong> · <strong>{wordCount(total)}</strong></span><Search value={deckQuery} onChange={setDeckQuery} placeholder="Najít balíček"/></div><div className="deck-grid">{decks.filter(item => `${item.title} ${item.description ?? ""}`.toLocaleLowerCase("cs").includes(deckQuery.toLocaleLowerCase("cs"))).map((item,i) => <article key={item.id} className={`deck-card panel ${item.id === deck?.id ? "is-selected" : ""}`}><div className="deck-card-top"><span className={`deck-art tone-${i % 3}`}><Icon name="cards"/></span><span className="tiny-label">{String(i+1).padStart(2,"0")} / BALÍČEK</span><button className="chip delete-deck" aria-label={`Smazat balíček ${item.title}`} disabled={busy} onClick={() => setDeletion({kind:"deck",deck:item})}><Icon name="trash"/><span>Smazat</span></button></div><h2>{item.title}</h2><p>{item.description || "Tvůj další kousek angličtiny."}</p><span className="chip static-chip">{wordCount(item.words.length)}</span><div className="deck-card-actions"><button className="button primary" onClick={() => {selectDeck(item.id);setTab("study");}}>Procvičovat<Icon name="arrow"/></button><button className="button secondary open-deck" aria-label={`Otevřít slovíčka: ${item.title}`} onClick={() => {selectDeck(item.id);setTab("library");}}><Icon name="book"/><span>Slovíčka</span></button></div></article>)}<button className="new-deck-card" onClick={() => setDialog("deck")}><span><Icon name="plus"/></span><strong>Další balíček</strong><small>Nové téma, nové možnosti.</small></button></div></>}
        {tab === "library" && (!deck ? <Empty title="Nejdřív vlastní balíček." text="Slovíčka tak budeš mít pěkně pohromadě."><button className="button primary" onClick={() => setDialog("deck")}><Icon name="plus"/>Vytvořit balíček</button></Empty> : <><div className="library-head"><div><h2>{deck.title}</h2><span className="muted">{wordCount(words.length)}</span></div><div className="chips"><button className="chip" onClick={() => setDialog("import")}><Icon name="upload"/>Import</button><button className="chip" disabled={!words.length} onClick={() => exportDeck(deck,"csv")}><Icon name="download"/>CSV</button><button className="chip" disabled={!words.length} onClick={() => exportDeck(deck,"json")}><Icon name="download"/>JSON</button></div></div><Search value={query} onChange={setQuery} placeholder="Hledat anglicky, česky nebo podle štítku…"/><div className="category-filters chips" aria-label="Filtrovat podle kategorie"><button className={`chip ${!category ? "is-active" : ""}`} aria-pressed={!category} onClick={() => setCategory("")}>Všechna<span className="count">{words.length}</span></button>{categories.map(value => <button className={`chip ${category === value ? "is-active" : ""}`} aria-pressed={category === value} key={value} onClick={() => setCategory(value)}>{value}</button>)}</div><div className="word-list panel"><div className="word-list-labels"><span>ANGLICKY</span><span>ČESKY</span><span>AKCE</span></div>{filtered.map(word => <WordItem key={word.id} word={word} progress={history.progress[word.id]} disabled={busy} onSpeak={() => speak(word)} onSave={async value => {const updated=await updateWord(word.id,value);setDecks(previous => previous.map(item => item.id === deck.id ? {...item,words:item.words.map(old => old.id===word.id ? updated : old)} : item));setRound(null);setNotice("Slovíčko upraveno.");}} onDelete={() => setDeletion({kind:"word",deckId:deck.id,word})}/>)}{!filtered.length && <div className="table-empty"><Icon name={words.length ? "search" : "book"}/><h3>{words.length ? "Nic jsme nenašli." : "První slovo čeká na tebe."}</h3><p>{words.length ? "Zkus jiné hledání nebo jiný štítek." : "Přidej ho ručně nebo naimportuj celý seznam."}</p>{!words.length && <button className="chip is-active" onClick={() => setDialog("word")}><Icon name="plus"/>Přidat slovíčko</button>}</div>}</div><p className="list-foot">Zobrazeno {filtered.length} z {words.length} · Změny se automaticky ukládají.</p></>)}
        {tab === "settings" && <div className="settings-stack"><section className="panel settings-panel"><div className="section-heading"><div><span className="tiny-label">PROCVIČOVÁNÍ</span><h2>Jak ti to vyhovuje?</h2></div><Icon name="cards"/></div><div className="setting-row"><div><strong>Výchozí směr</strong><p>Jak začnou tvoje další kola.</p></div><div className="chips">{modes.map(item => <button disabled={busy} className={`chip ${mode===item.value ? "is-active" : ""}`} aria-pressed={mode===item.value} key={item.value} onClick={() => void saveSettings({mode:item.value,speechRate})}>{item.label}</button>)}</div></div><div className="setting-row"><div><strong>Výslovnost po odkrytí</strong><p>Po klepnutí na kartičku se automaticky přečte anglický výraz.</p></div><span className="chip static-chip">Automaticky</span></div><div className="setting-row speech-setting"><div><strong>Rychlost výslovnosti</strong><p>Aktuálně {speechRate.toLocaleString("cs")}× · uloženo pro tvůj účet.</p></div><div className="speech-controls"><div className="chips speech-rates">{[.5,.65,.8,1,1.25,1.5].map(value => <button className={`chip ${speechRate===value ? "is-active" : ""}`} aria-pressed={speechRate===value} disabled={busy} key={value} onClick={() => void saveSettings({mode,speechRate:value})}>{value.toLocaleString("cs")}×</button>)}</div><button className="chip" onClick={() => speak({en:"Could you help me, please?"})}><Icon name="sound"/>Poslechnout ukázku</button></div></div></section><section className="panel settings-panel"><span className="tiny-label">TVŮJ ÚČET</span><div className="account-row"><span className="account-avatar">{user.name.slice(0,1)||"S"}</span><div><h2>{user.name || "Můj účet"}</h2><p className="muted">{user.email}</p></div><form action={signOut}><button className="chip" type="submit"><Icon name="exit"/>Odhlásit se</button></form></div><p className="account-note">Tvoje balíčky, slovíčka a nastavení patří jen tvému účtu.</p></section></div>}
        <footer className="app-footer"><span>SLOVÍČKUJ.CZ <span className="footer-dot">●</span> JEDNO SLOVO ZA DRUHÝM</span><nav aria-label="Informace o aplikaci"><a href="/soukromi">Soukromí</a><a href="/podminky">Podmínky</a></nav></footer>
      </main>
    </div>
    <nav className="mobile-nav" aria-label="Mobilní navigace">{[...nav, {tab:"settings" as const,label:"Nastavení",icon:"settings" as const}].map(item => <button key={item.tab} aria-current={tab===item.tab ? "page" : undefined} className={tab===item.tab ? "active" : ""} onClick={() => setTab(item.tab)}><Icon name={item.icon}/><span>{item.label}</span></button>)}</nav>
    {deletion && <DeleteConfirmation title={deletion.kind === "deck" ? "Smazat balíček?" : "Smazat slovíčko?"} onClose={() => setDeletion(null)} onConfirm={async () => {
      if (deletion.kind === "deck") {
        const id = deletion.deck.id;
        await deleteDeck(id);
        setDecks(previous => previous.filter(item => item.id !== id));
        if (deck?.id === id) { setSelectedId(""); setCategory(""); setQuery(""); }
        setNotice("Balíček i jeho slovíčka byly odstraněny.");
      } else {
        const {deckId, word} = deletion;
        await deleteWord(word.id);
        setDecks(previous => previous.map(item => item.id === deckId ? {...item,words:item.words.filter(old => old.id !== word.id)} : item));
        setNotice("Slovíčko odstraněno.");
      }
      setRound(null); setDeletion(null);
    }}><p>{deletion.kind === "deck" ? <>Balíček <strong>„{deletion.deck.title}“</strong> a všechna jeho slovíčka ({deletion.deck.words.length}) budou trvale smazány.</> : <>Slovíčko <strong>„{deletion.word.en} – {deletion.word.cz}“</strong> bude trvale smazáno.</>}</p><p>Tuto změnu nelze vrátit.</p></DeleteConfirmation>}
    {notice && <div className="toast" role="status"><span>{notice}</span><button aria-label="Zavřít oznámení" onClick={() => setNotice("")}><Icon name="close"/></button></div>}
    {(busy || reviewSaving) && <div className="saving" role="status">{reviewSaving?"Ukládám hodnocení…":"Ukládám…"}</div>}
    {dialog && <Modal title={dialog === "deck" ? "Nový balíček" : dialog === "word" ? "Přidat slovíčko" : "Hromadný import"} onClose={() => setDialog(null)}>{dialog === "deck" ? <DeckForm onCancel={() => setDialog(null)} onSave={async (title,description) => {const created=await createDeck({title,description});setDecks(previous => [created,...previous]);selectDeck(created.id);setTab("library");setDialog(null);setNotice("Balíček vytvořen. Přidej první slovíčko.");}}/> : dialog === "word" ? <WordForm onCancel={() => setDialog(null)} onSave={async (en,cz,wordCategory) => {if(!deck)return;const created=await createWord(deck.id,{en,cz,category:wordCategory});setDecks(previous => previous.map(item => item.id===deck.id ? {...item,words:[...item.words,created]} : item));setRound(null);setDialog(null);setNotice("Slovíčko uloženo.");}}/> : <ImportForm onCancel={() => setDialog(null)} onSave={async text => {if(!deck)return;const created=await bulkImport(deck.id,parseImport(text));setDecks(previous => previous.map(item => item.id===deck.id ? {...item,words:[...item.words,...created]} : item));setRound(null);setDialog(null);setNotice(`Uloženo ${wordCount(created.length)}.`);}}/>}</Modal>}
  </div>;
}

const ratingLabel = (rating: Rating) => rating === "known" ? "Vím" : rating === "unsure" ? "Tuším" : "Nevím";
function historyDate(value: string) { return new Intl.DateTimeFormat("cs", {day:"numeric",month:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit",timeZone:"Europe/Prague"}).format(new Date(value)); }

function HistoryPanel({deck,history,now}:{deck:Deck;history:DeckHistory;now:number}) {
  const counts=historyCounts(deck.words.map(word=>word.id),history,now);
  return <details className="history-panel panel" key={deck.id}>
    <summary aria-label={`Historie balíčku ${deck.title}`}>
      <span className="history-heading"><span><strong>Historie balíčku</strong><small>{history.totalReviews.toLocaleString("cs")} hodnocení celkem{history.sessions[0]?` · naposledy ${historyDate(history.sessions[0].lastReviewedAt)}`:""}</small></span><span className="history-expand">Podrobnosti <Icon name="arrow"/></span></span>
      <span className="history-statuses" aria-label="Poslední hodnocení slovíček"><span className="known">Vím <b>{counts.known}</b></span><span className="unsure">Tuším <b>{counts.unsure}</b></span><span className="unknown">Nevím <b>{counts.unknown}</b></span><span>Nová <b>{counts.fresh}</b></span></span>
    </summary>
    <div className="history-content">
      <p>Poslední hodnocení každého slovíčka. K zopakování teď: <strong>{counts.due}</strong>. Známá slova se postupně doporučí znovu; celý balíček můžeš procvičovat kdykoliv.</p>
      {history.totalReviews===0?<p className="history-empty">Zatím bez uložených výsledků. První hodnocení tu hned uvidíš.</p>:<><div className="history-section-title"><strong>Poslední procvičování</strong><span>{history.totalSessions} kol celkem</span></div><ol className="history-sessions">{history.sessions.map(session=><li key={session.id}><div><time dateTime={session.lastReviewedAt}>{historyDate(session.lastReviewedAt)}</time><span>{session.finishedAt?"Dokončeno":"Rozpracováno"} · {session.reviewedCount} / {session.totalWords}</span></div><div className="session-ratings"><span>Vím <b>{session.knownCount}</b></span><span>Tuším <b>{session.unsureCount}</b></span><span>Nevím <b>{session.unknownCount}</b></span></div></li>)}</ol><p className="history-note">Zobrazeno posledních {history.sessions.length} kol. Celková statistika zahrnuje celou historii, i nedokončená kola.</p></>}
    </div>
  </details>;
}

function PracticeCard({word,direction,flipped,index,total,speaking,saving,onReveal,onSpeak,onGrade,onRestart}:{
  word:Word;direction:"en_cz"|"cz_en";flipped:boolean;index:number;total:number;speaking:boolean;saving:boolean;
  onReveal:()=>void;onSpeak:()=>void;onGrade:(rating:Rating)=>void;onRestart:()=>void;
}) {
  const [drag,setDrag]=useState<{x:number;y:number}|null>(null);
  const pointer=useRef<{id:number;x:number;y:number}|null>(null);
  const suppressClick=useRef(false);
  const source=direction==="en_cz"?word.en:word.cz;
  const translation=direction==="en_cz"?word.cz:word.en;
  const rating=drag?swipeRating(drag.x,drag.y):null;
  const labels={unknown:"Nevím",unsure:"Tuším",known:"Vím"};
  return <div className="practice-panel panel">
    <div className="practice-top"><span className="chip static-chip">{direction==="en_cz"?"EN → CZ":"CZ → EN"}</span><span className="round-count"><strong>{index+1}</strong> / {total}</span><button className="icon-button" aria-label="Spustit kolo znovu" disabled={saving} onClick={onRestart}><Icon name="shuffle"/></button></div>
    <div className="progress-track" role="progressbar" aria-label="Průběh kola" aria-valuemin={0} aria-valuemax={total} aria-valuenow={index}><span style={{width:`${index/total*100}%`}}/></div>
    <div className="swipe-legend" aria-hidden="true"><span>← Nevím</span><span>↑ Tuším</span><span>Vím →</span></div>
    <button className={`flashcard miner-card ${flipped?"revealed":""} ${drag?"is-dragging":""} ${rating?`swipe-${rating}`:""}`}
      disabled={saving} aria-expanded={flipped} aria-label={flipped?`${source}. ${translation}. Přehrát anglickou výslovnost znovu.`:`${source}. Zobrazit překlad a přehrát anglickou výslovnost.`}
      style={drag?{transform:`translate(${Math.max(-100,Math.min(100,drag.x))}px, ${Math.max(-80,Math.min(80,drag.y))}px) rotate(${Math.max(-5,Math.min(5,drag.x/25))}deg)`}:undefined}
      onClick={()=>{if(suppressClick.current){suppressClick.current=false;return;}onReveal();}}
      onPointerDown={event=>{
        suppressClick.current=false;
        if(saving||!flipped||!event.isPrimary||event.button!==0)return;
        pointer.current={id:event.pointerId,x:event.clientX,y:event.clientY};
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event=>{const start=pointer.current;if(start?.id===event.pointerId)setDrag({x:event.clientX-start.x,y:event.clientY-start.y});}}
      onPointerUp={event=>{
        const start=pointer.current;if(start?.id!==event.pointerId)return;
        pointer.current=null;setDrag(null);
        const dx=event.clientX-start.x,dy=event.clientY-start.y;
        if(Math.hypot(dx,dy)>12)suppressClick.current=true;
        const answer=swipeRating(dx,dy);if(answer)onGrade(answer);
      }}
      onPointerCancel={()=>{pointer.current=null;setDrag(null);}}
      onLostPointerCapture={()=>{pointer.current=null;setDrag(null);}}>
      {rating&&<span className={`swipe-feedback ${rating}`}>{labels[rating]}</span>}
      <span className="tiny-label">{direction==="en_cz"?"ANGLICKY":"ČESKY"}</span>
      <span className="flash-word" lang={direction==="en_cz"?"en":"cs"}>{source}</span>
      {flipped&&<span className="flash-translation" lang={direction==="en_cz"?"cs":"en"}><span className="tiny-label">{direction==="en_cz"?"ČESKY":"ANGLICKY"}</span><span>{translation}</span></span>}
      {word.category&&<span className="chip static-chip word-tag">{word.category}</span>}
      <span className="flip-hint">{flipped?"Klepni pro poslech znovu":"Klepni pro překlad a poslech"}<Icon name={flipped?"sound":"cards"}/></span>
    </button>
    <div className="practice-bottom"><button className="chip" aria-label="Přehrát výslovnost" onClick={onSpeak}><Icon name="sound"/>{speaking?"Přehrávám…":"Výslovnost"}</button><span className="keyboard-tip">Překlad <kbd>mezerník</kbd></span><span className="sr-only" role="status">{speaking?"Přehrávám anglickou výslovnost.":""}</span></div>
    <div className="grade-actions three-grades">
      <button className="button grade-again" disabled={!flipped||saving} onClick={()=>onGrade("unknown")}><Icon name="close"/><span>Nevím</span><kbd>1</kbd></button>
      <button className="button grade-unsure" disabled={!flipped||saving} onClick={()=>onGrade("unsure")}><span aria-hidden="true">?</span><span>Tuším</span><kbd>2</kbd></button>
      <button className="button grade-know" disabled={!flipped||saving} onClick={()=>onGrade("known")}><Icon name="check"/><span>Vím</span><kbd>3</kbd></button>
    </div>
    <p className="swipe-instructions">{flipped?"Táhni kartičku: ← nevím · ↑ tuším · vím →":"Nejdřív odkryj překlad. Potom zvol tlačítko nebo táhni kartičku."}</p>
  </div>;
}

function Search({value,onChange,placeholder}:{value:string;onChange:(value:string)=>void;placeholder:string}) {return <label className="search-field"><Icon name="search"/><input aria-label={placeholder} placeholder={placeholder} value={value} onChange={event=>onChange(event.target.value)}/>{value && <button type="button" aria-label="Vymazat hledání" onClick={()=>onChange("")}><Icon name="close"/></button>}</label>;}
function Empty({title,text,children}:{title:string;text:string;children:ReactNode}) {return <section className="empty-state panel"><span className="empty-icon"><Icon name="cards"/></span><h2>{title}</h2><p>{text}</p><div className="empty-actions">{children}</div></section>;}
function Modal({title,children,onClose,closeDisabled=false}:{title:string;children:ReactNode;onClose:()=>void;closeDisabled?:boolean}) {
  const ref=useRef<HTMLDialogElement>(null); const titleId=useId();
  useEffect(()=>{const dialog=ref.current; const previous=document.activeElement as HTMLElement;dialog?.showModal();dialog?.querySelector<HTMLElement>("[data-autofocus], input, textarea")?.focus();return()=>{dialog?.close();previous?.focus();};},[]);
  return <dialog ref={ref} className="modal" aria-labelledby={titleId} onCancel={event=>{event.preventDefault();onClose();}} onClick={event=>{if(event.target===event.currentTarget){const bounds=event.currentTarget.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)onClose();}}}><div className="modal-head"><div><span className="tiny-label">JEŠTĚ KOUSEK ANGLIČTINY</span><h2 id={titleId}>{title}</h2></div><button className="icon-button" aria-label="Zavřít dialog" onClick={onClose} disabled={closeDisabled}><Icon name="close"/></button></div>{children}</dialog>;
}

function DeleteConfirmation({title,children,onClose,onConfirm}:{title:string;children:ReactNode;onClose:()=>void;onConfirm:()=>Promise<void>}) {
  const [pending,setPending]=useState(false);
  const [error,setError]=useState("");
  return <Modal title={title} onClose={()=>{if(!pending)onClose();}} closeDisabled={pending}>
    <form className="delete-confirmation" onSubmit={async event=>{event.preventDefault();if(pending)return;setPending(true);setError("");try{await onConfirm();}catch(error){setError(error instanceof Error?error.message:"Smazání se nezdařilo. Zkus to znovu.");}finally{setPending(false);}}}>
      <div className="delete-explanation">{children}</div>
      {error&&<p className="form-error" role="alert">{error}</p>}
      <div className="form-actions"><button type="button" data-autofocus className="button secondary" disabled={pending} onClick={onClose}>Zrušit</button><button type="submit" className="button primary" disabled={pending}><Icon name="trash"/>{pending?"Mažu…":"Trvale smazat"}</button></div>
    </form>
  </Modal>;
}

function DeckForm({onSave,onCancel}:{onSave:(title:string,description:string)=>Promise<void>;onCancel:()=>void}) {return <AsyncForm onCancel={onCancel} submit="Vytvořit balíček" onSubmit={async data=>onSave(String(data.get("title")),String(data.get("description")))}><label>Název balíčku<input autoFocus name="title" required maxLength={100} placeholder="Třeba Cestování"/></label><label>Krátký popis <span className="optional">nepovinné</span><textarea name="description" rows={2} maxLength={500} placeholder="Co si v něm chceš procvičit?"/></label></AsyncForm>;}
function WordForm({onSave,onCancel}:{onSave:(en:string,cz:string,category:string)=>Promise<void>;onCancel:()=>void}) {return <AsyncForm onCancel={onCancel} submit="Uložit slovíčko" onSubmit={async data=>onSave(String(data.get("en")),String(data.get("cz")),String(data.get("category")))}><div className="form-pair"><label>Anglicky<input autoFocus name="en" required maxLength={240} placeholder="a journey"/></label><label>Česky<input name="cz" required maxLength={240} placeholder="cesta"/></label></div><label>Štítek <span className="optional">nepovinné</span><input name="category" maxLength={100} placeholder="Třeba cestování"/></label></AsyncForm>;}
function ImportForm({onSave,onCancel}:{onSave:(text:string)=>Promise<void>;onCancel:()=>void}) {
  const [text,setText]=useState(""); const rows=parseImport(text);
  return <AsyncForm onCancel={onCancel} submit={`Importovat ${wordCount(rows.length)}`} disabled={!rows.length||rows.length>1000} onSubmit={async()=>onSave(text)}><p className="import-help">Jeden řádek = jedno slovíčko. Odděl angličtinu, češtinu a volitelný štítek středníkem, tabulátorem nebo čárkou.</p><label className="sr-only" htmlFor="import-text">Seznam slovíček</label><textarea autoFocus id="import-text" className="import-input" value={text} onChange={event=>setText(event.target.value)} rows={6} placeholder={'a journey; cesta; cestování\nto learn; učit se; slovesa'}/><div className="import-preview"><div className="preview-heading"><span className="tiny-label">NÁHLED IMPORTU</span><span className="chip static-chip">{rows.length} / 1000</span></div>{rows.slice(0,4).map((row,i)=><div className="preview-row" key={i}><strong>{row.en}</strong><span>{row.cz}</span>{row.category&&<span className="word-tag">{row.category}</span>}</div>)}{!rows.length&&<p className="muted">Tady se objeví náhled platných řádků.</p>}{rows.length>4&&<p className="muted">A dalších {rows.length-4}…</p>}{rows.length>1000&&<p className="form-error">Najednou lze importovat nejvýše 1000 slovíček.</p>}</div></AsyncForm>;
}
function AsyncForm({children,onSubmit,onCancel,submit,disabled=false}:{children:ReactNode;onSubmit:(data:FormData)=>Promise<void>;onCancel:()=>void;submit:string;disabled?:boolean}) {
  const [busy,setBusy]=useState(false); const [error,setError]=useState("");
  return <form className="form-stack" onSubmit={async event=>{event.preventDefault();const data=new FormData(event.currentTarget);setBusy(true);setError("");try{await onSubmit(data);}catch(error){setError(error instanceof Error?error.message:"Uložení se nezdařilo. Zkus to znovu.");}finally{setBusy(false);}}}>{children}{error&&<p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button type="button" className="button secondary" onClick={onCancel} disabled={busy}>Zrušit</button><button type="submit" className="button primary" disabled={busy||disabled}>{busy?"Ukládám…":submit}{!busy&&<Icon name="arrow"/>}</button></div></form>;
}
function WordItem({word,progress,onSave,onDelete,onSpeak,disabled}:{word:Word;progress?:Progress;onSave:(value:{en:string;cz:string;category:string})=>Promise<void>;onDelete:()=>void;onSpeak:()=>void;disabled:boolean}) {
  const [editing,setEditing]=useState(false);
  return <article className="word-row"><div className="word-en"><strong>{word.en}</strong>{word.category&&<span className="word-tag">{word.category}</span>}</div><div className="word-cz">{word.cz}<span className="word-history">{progress?`${ratingLabel(progress.lastRating)} · ${progress.reviewCount}× procvičeno` : "Ještě neprocvičeno"}</span></div><div className="word-actions"><button className="icon-button" aria-label={`Výslovnost: ${word.en}`} onClick={onSpeak}><Icon name="sound"/><span className="mobile-action-label">Poslech</span></button><button className="icon-button" aria-label={`Upravit: ${word.en}`} onClick={()=>setEditing(true)}><Icon name="edit"/><span className="mobile-action-label">Upravit</span></button><button className="icon-button subtle-danger" disabled={disabled} aria-label={`Smazat: ${word.en}`} onClick={onDelete}><Icon name="trash"/><span className="mobile-action-label">Smazat</span></button></div>{editing&&<Modal title="Upravit slovíčko" onClose={()=>setEditing(false)}><AsyncForm submit="Uložit změny" onCancel={()=>setEditing(false)} onSubmit={async data=>{await onSave({en:String(data.get("en")),cz:String(data.get("cz")),category:String(data.get("category"))});setEditing(false);}}><div className="form-pair"><label>Anglicky<input name="en" required maxLength={240} autoFocus defaultValue={word.en}/></label><label>Česky<input name="cz" required maxLength={240} defaultValue={word.cz}/></label></div><label>Štítek<input name="category" maxLength={100} defaultValue={word.category??""}/></label></AsyncForm></Modal>}</article>;
}
function exportDeck(deck:Deck,format:"csv"|"json") {
  const body=format==="json"?JSON.stringify({title:deck.title,description:deck.description,words:deck.words.map(({en,cz,category})=>({en,cz,category}))},null,2):["en;cz;category",...deck.words.map(word=>[word.en,word.cz,word.category??""].map(value=>`"${value.replaceAll('"','""')}"`).join(";"))].join("\n");
  const url=URL.createObjectURL(new Blob([body],{type:format==="json"?"application/json":"text/csv;charset=utf-8"}));const anchor=document.createElement("a");anchor.href=url;anchor.download=`${deck.title.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-")}.${format}`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
