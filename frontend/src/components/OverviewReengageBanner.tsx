import { Link } from 'react-router-dom'

/** Påminnelse längst ner på översikten: uppdatera profil via introduktionen om livssituationen ändrats. */
export function OverviewReengageBanner() {
  return (
    <div className="overview-reengage" role="region" aria-label="Uppdatera din sparprofil">
      <p className="overview-reengage__text">
        Har något ändrats i din ekonomi? Gå igenom vår introduktion igen så att vår rådgivning fortfarande passar dig.
      </p>
      <Link to="/onboarding" className="btn-ghost overview-reengage__link">
        Till introduktionen
      </Link>
    </div>
  )
}
