import Link from "next/link";

export default function PlanningsPage() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <section style={{ width: "min(620px, 100%)", padding: 36, borderRadius: 14, background: "white", border: "1px solid #e6ebf2" }}>
        <p className="eyebrow">APPLICATION</p>
        <h1 style={{ margin: "0 0 12px" }}>Gestion des plannings</h1>
        <p style={{ color: "#718096", lineHeight: 1.7 }}>Accédez aux projets, modifications ECR, jalons et actions planifiées depuis le portail SAGE INDEX.</p>
        <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
          <a className="secondary-button" href="http://localhost:3000/">Ouvrir l’application →</a>
          <Link className="secondary-button" href="/">Retour au tableau de bord</Link>
        </div>
      </section>
    </main>
  );
}
