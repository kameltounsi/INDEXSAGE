import Link from "next/link";

export default function RhPage() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f5f7fb" }}>
      <section style={{ maxWidth: 560, background: "white", padding: 40, borderRadius: 16, boxShadow: "0 16px 45px #dfe5ef", textAlign: "center" }}>
        <p style={{ color: "#574fc0", fontWeight: 700, fontSize: 12, letterSpacing: 1 }}>SAGE INDEX</p>
        <h1 style={{ color: "#172b52" }}>Espace Ressources Humaines</h1>
        <p style={{ color: "#718096", lineHeight: 1.7 }}>Le compte de démonstration est reconnu. Cette page est prête à recevoir l’URL ou l’intégration SSO de votre application RH.</p>
        <Link href="/" style={{ display: "inline-block", marginTop: 18, padding: "11px 18px", borderRadius: 8, background: "#514da7", color: "white", fontWeight: 700 }}>← Retour au dashboard</Link>
      </section>
    </main>
  );
}
