import Link from "next/link";

export const metadata = { title: "Soukromí | Slovickuj.cz" };

export default function PrivacyPage() {
  return <main style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px", lineHeight: 1.8 }}>
    <Link href="/" style={{ color: "var(--green)", textDecoration: "underline" }}>← Slovickuj.cz</Link>
    <h1 style={{ fontFamily: "var(--serif)", fontSize: "clamp(30px, 6vw, 44px)", lineHeight: 1.2 }}>Soukromí na Slovickuj.cz</h1>
    <p>Slovickuj.cz je osobní prostor pro vlastní slovíčka a jejich procvičování. Aplikaci spravuje Zdeněk Srněnský. Kontakt pro dotazy a žádosti o osobní údaje: <a href="mailto:srnenskyzdenek@gmail.com" style={{ textDecoration: "underline" }}>srnenskyzdenek@gmail.com</a>.</p>
    <h2>Jaké údaje aplikace používá</h2>
    <p>Při přihlášení přes Google získá aplikace základní profil: jméno, e-mailovou adresu, profilový obrázek a identifikátor účtu. Neukládá heslo ke Google účtu a nežádá přístup k Gmailu, Disku ani Kalendáři.</p>
    <p>Pro fungování účtu ukládá také technické údaje přihlášení a relace, tvoje balíčky, slovíčka a nastavení procvičování. Tyto údaje slouží k přihlášení, přiřazení obsahu ke správnému účtu a ukládání pokroku v práci s aplikací.</p>
    <h2>Kde jsou údaje uložené</h2>
    <p>Web běží na Vercelu a aplikační data jsou uložená v databázi Neon PostgreSQL ve Frankfurtu. Google zajišťuje ověření identity. Tito poskytovatelé zpracovávají údaje potřebné k provozu svých služeb; provozní záznamy mohou obsahovat například čas požadavku, IP adresu a informace o chybě.</p>
    <p>Balíčky a slovíčka nejsou veřejné. Aplikace kontroluje, ke kterému účtu patří. Údaje z Google se nepoužívají k reklamě ani se neprodávají.</p>
    <h2>Cookies a výslovnost</h2>
    <p>Pro přihlášení a jeho zabezpečení používá aplikace nezbytné cookies. Výslovnost používá hlasové funkce tvého prohlížeče nebo zařízení; jejich zpracování se řídí nastavením a pravidly příslušného poskytovatele.</p>
    <h2>Správa a odstranění údajů</h2>
    <p>Vlastní slovíčka a balíčky můžeš upravovat, exportovat a mazat v aplikaci. O odstranění účtu a souvisejících údajů nebo o další informace napiš na kontaktní e-mail z adresy svého účtu. Přístup aplikace můžeš odvolat také v nastavení svého Google účtu; tím se automaticky neodstraní obsah uložený v aplikaci.</p>
    <p>Údaje účtu a obsah jsou uchovávané pro poskytování služby, dokud je neodstraníš nebo nepožádáš o odstranění účtu. Technické záznamy a zálohy podléhají provozním pravidlům poskytovatelů hostingu a databáze.</p>
    <p style={{ color: "var(--muted)" }}>Aktualizováno 28. října 2026.</p>
  </main>;
}
