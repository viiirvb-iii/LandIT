import { useState, useEffect } from "react";

/** Known company → domain mappings for reliable logo fetching */
const KNOWN_DOMAINS = {
  "rea group": "rea-group.com",
  "canva": "canva.com",
  "culture amp": "cultureamp.com",
  "myob": "myob.com",
  "anz": "anz.com.au",
  "nab": "nab.com.au",
  "telstra": "telstra.com.au",
  "seek": "seek.com.au",
  "carsales": "carsales.com.au",
  "airwallex": "airwallex.com",
  "xero": "xero.com",
  "buildkite": "buildkite.com",
  "safetyculture": "safetyculture.com",
  "up banking": "up.com.au",
  "envato": "envato.com",
  "zendesk": "zendesk.com",
  "sportsbet": "sportsbet.com.au",
  "cba": "commbank.com.au",
  "westpac": "westpac.com.au",
  "afterpay": "afterpay.com",
  "deputy": "deputy.com",
  "employment hero": "employmenthero.com",
  "linktree": "linktr.ee",
  "eucalyptus": "eucalyptus.vc",
  "go1": "go1.com",
  "redbubble": "redbubble.com",
  "kogan": "kogan.com",
  "thoughtworks": "thoughtworks.com",
  "versent": "versent.com.au",
  "mantel group": "mantelgroup.com.au",
  "datacom": "datacom.com",
  "technologyone": "technologyone.com",
  "wisetech global": "wisetechglobal.com",
  "judo bank": "judo.bank",
  "latitude financial": "latitudefinancial.com.au",
  "deloitte": "deloitte.com",
  "pwc": "pwc.com",
  "accenture": "accenture.com",
  "bhp": "bhp.com",
  "rio tinto": "riotinto.com",
  "tabcorp": "tabcorp.com.au",
  "pendula": "pendula.com",
  "temple & webster": "templeandwebster.com.au",
  "catch": "catch.com.au",
  "atlassian": "atlassian.com",
  "google": "google.com",
  "microsoft": "microsoft.com",
  "apple": "apple.com",
  "meta": "meta.com",
  "amazon": "amazon.com",
  "netflix": "netflix.com",
  "spotify": "spotify.com",
  "stripe": "stripe.com",
  "slack": "slack.com",
  "github": "github.com",
  "gitlab": "gitlab.com",
  "figma": "figma.com",
  "notion": "notion.so",
  "vercel": "vercel.com",
  "supabase": "supabase.com",
};

/** Turn a company name into a domain for logo lookup */
const guessDomain = (name) => {
  if (!name) return null;
  const lower = name.toLowerCase().trim();

  // Check known mappings first
  if (KNOWN_DOMAINS[lower]) return KNOWN_DOMAINS[lower];

  // Try partial match (e.g. "REA Group Pty Ltd" should match "rea group")
  for (const [key, domain] of Object.entries(KNOWN_DOMAINS)) {
    if (lower.includes(key) || key.includes(lower)) return domain;
  }

  // Fallback: strip non-alpha, append .com
  const slug = lower.replace(/[^a-z0-9]/g, "");
  return slug ? `${slug}.com` : null;
};

/**
 * CompanyAvatar – always shows a company logo.
 * Priority: logoUrl prop → Clearbit lookup → colored initial fallback.
 */
export default function CompanyAvatar({
  logoUrl,
  company,
  color,
  size = 44,
  radius = 12,
  fontSize,
}) {
  const [src, setSrc] = useState(logoUrl || null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    if (logoUrl) {
      setSrc(logoUrl);
      return;
    }
    if (!company) return;
    const domain = guessDomain(company);
    if (!domain) return;
    const url = `https://logo.clearbit.com/${domain}`;
    const img = new Image();
    img.onload = () => setSrc(url);
    img.onerror = () => {
      setSrc(null);
      setFailed(true);
    };
    img.src = url;
  }, [logoUrl, company]);

  const showImage = src && !failed;
  const fs = fontSize || Math.round(size * 0.45);

  return (
    <>
      {showImage && (
        <img
          src={src}
          alt={company}
          style={{
            width: size,
            height: size,
            borderRadius: radius,
            objectFit: "contain",
            background: "#fff",
            flexShrink: 0,
          }}
          onError={() => setFailed(true)}
        />
      )}
      {!showImage && (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: radius,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: fs,
            fontWeight: 700,
            color: "#fff",
            background: color || "#3b82f6",
            flexShrink: 0,
          }}
        >
          {company?.charAt(0)?.toUpperCase() || "?"}
        </div>
      )}
    </>
  );
}
