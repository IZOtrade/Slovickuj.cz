import { auth, signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Workspace } from "@/components/workspace";

export default async function Home() {
  const session = await auth();
  if (!session?.user?.id) {
    return <main className="auth-page">
      <section className="auth-card">
        <div className="brand-mark">S<span>.</span></div>
        <p className="eyebrow">OSOBNÍ PROSTOR PRO ANGLIČTINU</p>
        <h1>Slovíčka, která<br /><em>zůstanou v hlavě.</em></h1>
        <p className="auth-copy">Vlastní balíčky, krátká kola opakování a výslovnost vždy po ruce.</p>
        <form action={async () => { "use server"; await signIn("google"); }}>
          <button className="google-button" type="submit"><span className="google-g">G</span> Pokračovat přes Google <span aria-hidden="true">→</span></button>
        </form>
        <div className="auth-foot"><span>Vaše slovíčka zůstávají soukromá.</span><span>Zdarma pro vaše učení</span></div>
      </section>
      <aside className="auth-art" aria-hidden="true">
        <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
        <div className="floating-word word-one">to figure out <span>· rozklíčovat</span></div>
        <div className="floating-word word-two">a little progress <span>každý den</span></div>
        <div className="art-note"><span className="note-star">✳</span><p>Uč se vlastním<br />tempem.</p><small>JEDNO SLOVO PO DRUHÉM</small></div>
        <div className="art-caption">PRACTICE MAKES PROGRESS <span>✳</span></div>
      </aside>
    </main>;
  }

  const [decks, updatedSettings] = await Promise.all([
    prisma.deck.findMany({ where: { ownerId: session.user.id }, include: { words: { orderBy: { createdAt: "asc" } } }, orderBy: { updatedAt: "desc" } }),
    prisma.userSettings.upsert({ where: { userId: session.user.id }, update: {}, create: { userId: session.user.id } }),
  ]);

  return <Workspace user={{ name: session.user.name ?? "", email: session.user.email ?? "", image: session.user.image ?? "" }} initialDecks={decks} settings={updatedSettings} signOut={async () => { "use server"; await signOut(); }} />;
}
