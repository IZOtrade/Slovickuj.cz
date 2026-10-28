import { auth, signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Workspace } from "@/components/workspace";

export default async function Home() {
  const session = await auth();
  if (!session?.user?.id) {
    return <div className="auth-shell">
      <header className="auth-header"><div className="auth-header-inner"><a href="/" className="wordmark"><span className="logo-mark">s.</span><span>SLOVÍČKUJ<span className="brand-domain">.CZ</span></span></a><span className="chip static-chip">TVŮJ PROSTOR PRO ANGLIČTINU</span></div></header>
      <main className="auth-main"><section className="auth-copy">
        <p className="eyebrow">JEDNO SLOVO ZA DRUHÝM</p>
        <h1>Malé kroky.<br/><span>Velká slovní<br/>zásoba.</span></h1>
        <p className="auth-description">Tvoje vlastní slovíčka. Krátká kola opakování. Výslovnost na jedno klepnutí. Všechno pěkně pohromadě — v počítači i v kapse.</p>
        <div className="auth-benefits"><span className="chip static-chip">Vlastní balíčky</span><span className="chip static-chip">Rychlý import</span><span className="chip static-chip">Oba směry překladu</span></div>
        <form action={async () => { "use server"; await signIn("google"); }}>
          <button className="google-button" type="submit"><span className="google-g">G</span> Pokračovat přes Google <span aria-hidden="true">→</span></button>
        </form>
        <p className="auth-small">Zdarma. Bez hesla navíc.<br/>Tvoje slovíčka zůstávají jen tvoje.</p>
      </section>
      <aside className="auth-showcase" aria-label="Ukázka procvičovací kartičky"><div className="showcase-head"><strong>TROCHA ANGLIČTINY NA DNES</strong><span className="chip static-chip">EN → CZ</span></div><div className="showcase-card"><span className="tiny-label">JAK TO ŘEKNEŠ?</span><strong>a little progress</strong><span>malý pokrok</span></div><div className="showcase-grades" aria-hidden="true"><span>× Ještě jednou</span><span>✓ Tohle umím</span></div><div className="showcase-foot"><span>TVÝM TEMPEM.</span><span>KAŽDÝ DEN KOUSEK.</span></div></aside></main>
      <footer className="auth-footer"><span>SLOVÍČKUJ.CZ · MALÁ CHVILKA. VELKÝ ROZDÍL.</span><nav aria-label="Informace o aplikaci"><a href="/soukromi">Soukromí</a><a href="/podminky">Podmínky používání</a></nav></footer>
    </div>;
  }

  const [decks, updatedSettings] = await Promise.all([
    prisma.deck.findMany({ where: { ownerId: session.user.id }, include: { words: { orderBy: { createdAt: "asc" } } }, orderBy: { updatedAt: "desc" } }),
    prisma.userSettings.upsert({ where: { userId: session.user.id }, update: {}, create: { userId: session.user.id } }),
  ]);

  return <Workspace user={{ name: session.user.name ?? "", email: session.user.email ?? "", image: session.user.image ?? "" }} initialDecks={decks} settings={updatedSettings} signOut={async () => { "use server"; await signOut(); }} />;
}
