import Link from "next/link";

export const metadata = { title: "Podmínky používání | Slovickuj.cz" };

export default function TermsPage() {
  return <main style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px", lineHeight: 1.8 }}>
    <Link href="/" style={{ color: "var(--green)", textDecoration: "underline" }}>← Slovickuj.cz</Link>
    <h1 style={{ fontFamily: "var(--serif)", fontSize: "clamp(30px, 6vw, 44px)", lineHeight: 1.2 }}>Podmínky používání</h1>
    <p>Slovickuj.cz je bezplatná pomůcka pro tvorbu vlastních balíčků anglicko-českých slovíček a jejich procvičování. Aplikaci spravuje Zdeněk Srněnský, kontakt: <a href="mailto:srnenskyzdenek@gmail.com" style={{ textDecoration: "underline" }}>srnenskyzdenek@gmail.com</a>.</p>
    <h2>Účet a obsah</h2>
    <p>Aplikace používá přihlášení přes Google. Uživatel má přístup ke svým vlastním balíčkům, slovíčkům a nastavením. Za obsah, který do aplikace vloží, odpovídá uživatel; vkládej pouze obsah, který smíš používat.</p>
    <p>Používej aplikaci k vlastnímu učení. Nezasahuj do účtů ostatních, neobcházej přihlášení a nenarušuj provoz služby.</p>
    <h2>Práce s daty</h2>
    <p>Slovíčka můžeš upravovat, exportovat a mazat. Pro vlastní kopii obsahu použij export dostupný v aplikaci. Informace o přihlášení, uložených údajích a odstranění účtu najdeš na stránce <Link href="/soukromi" style={{ textDecoration: "underline" }}>Soukromí</Link>.</p>
    <h2>Podpora</h2>
    <p>Chyby, dotazy a žádosti související s účtem posílej na uvedený kontaktní e-mail. Aplikace se dále vyvíjí a její funkce se mohou měnit.</p>
    <p style={{ color: "var(--muted)" }}>Aktualizováno 28. října 2026.</p>
  </main>;
}
