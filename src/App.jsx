import './App.css'

const NAV_LINKS = [
  { label: 'About VTE', href: '#about' },
  { label: 'Risk Factors', href: '#risks' },
  { label: 'Symptoms', href: '#symptoms' },
  { label: 'Prevention', href: '#prevention' },
]

const STATS = [
  { value: '900K+', label: 'Americans affected yearly' },
  { value: '100K', label: 'Deaths per year in the US' },
  { value: '1 in 4', label: 'Cases are fatal if untreated' },
  { value: '50%', label: 'Occur during/after hospitalization' },
]

const RISK_FACTORS = [
  {
    icon: '🏥',
    title: 'Surgery & Hospitalization',
    desc: 'Major surgery, especially orthopedic, and prolonged hospital stays significantly increase clot risk.',
  },
  {
    icon: '🧬',
    title: 'Genetic Factors',
    desc: 'Inherited clotting disorders like Factor V Leiden increase your likelihood of developing blood clots.',
  },
  {
    icon: '🪑',
    title: 'Prolonged Immobility',
    desc: 'Long flights, bed rest, or sedentary lifestyles slow blood flow and raise clotting risk.',
  },
  {
    icon: '💊',
    title: 'Medications & Hormones',
    desc: 'Hormone replacement therapy, oral contraceptives, and certain cancer treatments can increase risk.',
  },
  {
    icon: '🤰',
    title: 'Pregnancy',
    desc: 'Blood clots more easily during pregnancy and up to 6 weeks postpartum to prevent bleeding.',
  },
  {
    icon: '⚖️',
    title: 'Obesity & Lifestyle',
    desc: 'Excess weight puts additional pressure on veins, and smoking damages blood vessel walls.',
  },
]

const DVT_SYMPTOMS = [
  'Swelling in one leg (or arm)',
  'Pain or tenderness, often starting in the calf',
  'Red or discolored skin on the leg',
  'A feeling of warmth in the affected leg',
  'Leg fatigue or heaviness',
]

const PE_SYMPTOMS = [
  'Sudden shortness of breath',
  'Sharp chest pain (worse with deep breathing)',
  'Rapid or irregular heartbeat',
  'Coughing up blood',
  'Feeling dizzy or faint',
]

const PREVENTION_TIPS = [
  {
    icon: '🚶',
    title: 'Stay Active',
    desc: 'Move regularly, especially during long trips. Take breaks to walk and stretch every 1-2 hours.',
  },
  {
    icon: '💧',
    title: 'Stay Hydrated',
    desc: 'Drink plenty of water. Dehydration thickens the blood and increases clot formation risk.',
  },
  {
    icon: '🧦',
    title: 'Compression Stockings',
    desc: 'Graduated compression stockings help promote blood flow and reduce swelling in your legs.',
  },
  {
    icon: '🩺',
    title: 'Know Your Risk',
    desc: 'Talk to your doctor about your personal risk factors, especially before surgery or travel.',
  },
  {
    icon: '💉',
    title: 'Follow Medical Advice',
    desc: 'Take prescribed blood thinners as directed. Don\'t skip doses or stop without consulting your doctor.',
  },
  {
    icon: '🏃',
    title: 'Maintain Healthy Weight',
    desc: 'Regular exercise and a balanced diet reduce pressure on your veins and improve circulation.',
  },
]

function App() {
  return (
    <div className="app">
      {/* Navigation */}
      <nav className="navbar">
        <div className="container nav-content">
          <a href="#" className="logo">
            <span className="logo-icon">♥</span>
            <span>VTE<span className="logo-accent">Aware</span></span>
          </a>
          <div className="nav-links">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href}>{link.label}</a>
            ))}
          </div>
          <a href="#cta" className="btn btn-primary btn-sm">Get Help Now</a>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="hero">
        <div className="container hero-content">
          <div className="hero-badge">Venous Thromboembolism Awareness</div>
          <h1>
            Blood Clots Are<br />
            <span className="gradient-text">Preventable & Treatable</span>
          </h1>
          <p className="hero-subtitle">
            Venous Thromboembolism (VTE) — including deep vein thrombosis (DVT) and pulmonary
            embolism (PE) — affects hundreds of thousands every year. Early recognition saves lives.
          </p>
          <div className="hero-actions">
            <a href="#symptoms" className="btn btn-primary btn-lg">Learn the Signs</a>
            <a href="#risks" className="btn btn-outline btn-lg">Check Your Risk</a>
          </div>
        </div>
        <div className="hero-bg" />
      </header>

      {/* Stats Section */}
      <section className="stats">
        <div className="container">
          <div className="stats-grid">
            {STATS.map((stat) => (
              <div key={stat.label} className="stat-card">
                <div className="stat-value">{stat.value}</div>
                <div className="stat-label">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="section">
        <div className="container">
          <div className="section-header">
            <span className="section-tag">Understanding VTE</span>
            <h2>What is Venous Thromboembolism?</h2>
            <p className="section-desc">
              VTE is a condition where blood clots form in veins, most commonly in the deep veins
              of the legs. It encompasses two related conditions:
            </p>
          </div>
          <div className="about-grid">
            <div className="about-card dvt-card">
              <div className="about-card-icon">🦵</div>
              <h3>Deep Vein Thrombosis (DVT)</h3>
              <p>
                A blood clot forms in a deep vein, usually in the leg. DVT can cause pain and
                swelling but can also occur without symptoms. If left untreated, the clot can break
                free and travel to the lungs.
              </p>
            </div>
            <div className="about-card pe-card">
              <div className="about-card-icon">🫁</div>
              <h3>Pulmonary Embolism (PE)</h3>
              <p>
                A life-threatening condition where a blood clot travels to the lungs and blocks
                blood flow. PE requires immediate medical attention and can be fatal if not treated
                quickly.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Risk Factors */}
      <section id="risks" className="section section-alt">
        <div className="container">
          <div className="section-header">
            <span className="section-tag">Risk Assessment</span>
            <h2>Who Is at Risk?</h2>
            <p className="section-desc">
              While VTE can affect anyone, certain factors significantly increase your risk.
              Understanding these factors is the first step in prevention.
            </p>
          </div>
          <div className="risk-grid">
            {RISK_FACTORS.map((risk) => (
              <div key={risk.title} className="risk-card">
                <span className="risk-icon">{risk.icon}</span>
                <h3>{risk.title}</h3>
                <p>{risk.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Symptoms Section */}
      <section id="symptoms" className="section">
        <div className="container">
          <div className="section-header">
            <span className="section-tag section-tag-red">Warning Signs</span>
            <h2>Recognize the Symptoms</h2>
            <p className="section-desc">
              Knowing the warning signs can save your life. DVT and PE have distinct symptoms —
              if you experience any PE symptoms, call emergency services immediately.
            </p>
          </div>
          <div className="symptoms-grid">
            <div className="symptom-card symptom-dvt">
              <div className="symptom-header">
                <h3>DVT Symptoms</h3>
                <span className="symptom-badge warning">Seek Medical Care</span>
              </div>
              <ul className="symptom-list">
                {DVT_SYMPTOMS.map((s) => (
                  <li key={s}>
                    <span className="check warning-check">!</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
            <div className="symptom-card symptom-pe">
              <div className="symptom-header">
                <h3>PE Symptoms</h3>
                <span className="symptom-badge emergency">Call 911</span>
              </div>
              <ul className="symptom-list">
                {PE_SYMPTOMS.map((s) => (
                  <li key={s}>
                    <span className="check emergency-check">⚠</span>
                    {s}
                  </li>
                ))}
              </ul>
              <div className="emergency-note">
                <strong>A pulmonary embolism is a medical emergency.</strong> If you suspect PE,
                call 911 or go to the nearest emergency room immediately.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Prevention Section */}
      <section id="prevention" className="section section-alt">
        <div className="container">
          <div className="section-header">
            <span className="section-tag section-tag-green">Take Action</span>
            <h2>Prevention & Protection</h2>
            <p className="section-desc">
              Up to 60% of VTE cases can be prevented. Simple lifestyle changes and medical
              precautions can dramatically reduce your risk.
            </p>
          </div>
          <div className="prevention-grid">
            {PREVENTION_TIPS.map((tip) => (
              <div key={tip.title} className="prevention-card">
                <span className="prevention-icon">{tip.icon}</span>
                <div>
                  <h3>{tip.title}</h3>
                  <p>{tip.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="cta" className="cta-section">
        <div className="container">
          <div className="cta-content">
            <h2>Don't Wait — Take Action Today</h2>
            <p>
              If you think you may be at risk for VTE, or if you're experiencing symptoms, talk to
              your healthcare provider. Early detection and treatment save lives.
            </p>
            <div className="cta-actions">
              <a href="tel:911" className="btn btn-white btn-lg">
                Emergency: Call 911
              </a>
              <a href="#risks" className="btn btn-outline-white btn-lg">
                Assess Your Risk
              </a>
            </div>
            <p className="cta-disclaimer">
              This website is for educational purposes only and does not constitute medical advice.
              Always consult a qualified healthcare professional.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container footer-content">
          <div className="footer-brand">
            <a href="#" className="logo">
              <span className="logo-icon">♥</span>
              <span>VTE<span className="logo-accent">Aware</span></span>
            </a>
            <p>Raising awareness about venous thromboembolism to save lives through education and early detection.</p>
          </div>
          <div className="footer-links">
            <div>
              <h4>Learn</h4>
              <a href="#about">About VTE</a>
              <a href="#risks">Risk Factors</a>
              <a href="#symptoms">Symptoms</a>
              <a href="#prevention">Prevention</a>
            </div>
            <div>
              <h4>Resources</h4>
              <a href="#cta">Get Help</a>
              <a href="#about">DVT vs PE</a>
              <a href="#risks">Risk Assessment</a>
            </div>
          </div>
        </div>
        <div className="container footer-bottom">
          <p>&copy; 2026 VTEAware. Educational resource — not medical advice.</p>
        </div>
      </footer>
    </div>
  )
}

export default App
