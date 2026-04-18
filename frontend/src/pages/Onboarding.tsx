import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'

const INVESTMENT_QUOTES = [
  { text: 'Tid i marknaden slår alltid tajming av marknaden.', author: null },
  { text: 'Diversifiering är den enda gratislunchen inom finans.', author: 'Harry Markowitz' },
  { text: 'Ränta-på-ränta är världens åttonde underverk.', author: 'tillskriven Albert Einstein' },
  { text: 'Marknaden är ett instrument för att flytta pengar från de otåliga till de tålmodiga.', author: 'Warren Buffett' },
  { text: 'En låg avgift är det enda säkra i ditt sparande.', author: null },
  { text: 'Investera brett, behåll länge och håll kostnaderna låga.', author: 'John Bogle' },
  { text: 'De flesta aktiva fonder underpresterar sitt index — netto efter avgifter.', author: null },
  { text: 'Det bästa sättet att förutspå framtiden är att inte försöka.', author: 'John Bogle' },
  { text: 'Risk och tid hänger ihop: ju längre horisont, desto mer risk har du råd att ta.', author: null },
  { text: 'Sluta försöka hitta rätt tillfälle — börja investera nu.', author: null },
  { text: 'Hemlandsbias kostar mer än de flesta investerare inser.', author: null },
  { text: 'Varje avgiftsprocent äter upp tiotusentals kronor sett över 30 år.', author: null },
  { text: 'Aktiemarknaden är designad för att belöna tålamod, inte aktivitet.', author: null },
  { text: 'En billig indexfond är det smartaste valet för de flesta sparare.', author: 'John Bogle' },
  { text: 'Spara regelbundet, diversifiera brett, betala låga avgifter — resten tar sig självt.', author: null },
] as const

function QuoteRotator() {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * INVESTMENT_QUOTES.length))
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIdx((i) => (i + 1) % INVESTMENT_QUOTES.length)
        setVisible(true)
      }, 500)
    }, 30_000)
    return () => clearInterval(timer)
  }, [])

  const quote = INVESTMENT_QUOTES[idx]
  return (
    <div className={`quote-rotator${visible ? ' quote-rotator--visible' : ''}`}>
      <p className="quote-rotator__text">"{quote.text}"</p>
      {quote.author && <p className="quote-rotator__author">— {quote.author}</p>}
    </div>
  )
}
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { HeroImage } from '../components/HeroImage'
import { Shell } from '../components/Shell'
import { StepProgress } from '../components/StepProgress'
import { imageAlt, images } from '../content/images'

const STEP_LABELS = [
  'Bankkoppling',
  'Riskvilja',
  'Scenarion',
  'Din profil',
  'Sparhorisont',
  'Sparmål',
  'Din ekonomi',
  'Buffert',
  'Innehav',
  'Justera plan',
  'Klart',
] as const

const TOTAL_STEPS = STEP_LABELS.length

const RISK_OPTIONS = [
  { level: 1 as const, name: 'Trygg', tagline: 'Bevara kapital' },
  { level: 2 as const, name: 'Försiktig', tagline: 'Stabil tillväxt' },
  { level: 3 as const, name: 'Balanserad', tagline: 'Mix aktier & räntor' },
  { level: 4 as const, name: 'Tillväxt', tagline: 'Aktievikt' },
  { level: 5 as const, name: 'Offensiv', tagline: 'Max aktier' },
]

// Pre-computed SVG polyline points for a 580×265 viewBox.
// Plot area x=[50,540], y=[15,235]. Value range 50–300 (100=start/0%).
// Good scenario = steady compounding. Bad scenario = crash yr 2, slow recovery.
const CHART_DATA = {
  1: {
    goodPoints: '50,191 54,191 58,191 62,194 66,188 70,186 75,194 79,187 83,193 87,191 91,187 95,189 99,188 103,189 107,188 111,187 115,189 119,188 124,186 128,188 132,191 136,185 140,185 144,188 148,187 152,187 156,186 160,189 164,187 168,181 173,182 177,183 181,181 185,188 189,185 193,183 197,184 201,184 205,181 209,185 213,185 217,179 222,180 226,177 230,180 234,184 238,181 242,180 246,180 250,181 254,182 258,180 262,182 266,186 271,179 275,186 279,186 283,181 287,183 291,183 295,183 299,181 303,184 307,184 311,186 315,181 320,183 324,182 328,177 332,179 336,180 340,178 344,178 348,177 352,178 356,180 360,181 364,175 369,171 373,181 377,178 381,177 385,174 389,176 393,175 397,174 401,174 405,173 409,171 413,178 418,172 422,174 426,176 430,173 434,170 438,172 442,172 446,171 450,168 454,172 458,168 462,169 467,172 471,166 475,169 479,168 483,166 487,165 491,165 495,162 499,159 503,158 507,157 511,160 516,151 520,150 524,148 528,150 532,147 536,145 540,143',
    badPoints:  '50,191 54,191 58,191 62,189 66,194 70,192 75,190 79,193 83,191 87,193 91,191 95,191 99,191 103,191 107,191 111,191 115,190 119,195 124,190 128,189 132,190 136,193 140,193 144,194 148,194 152,193 156,194 160,193 164,195 168,194 173,194 177,192 181,193 185,192 189,191 193,190 197,190 201,191 205,190 209,188 213,192 217,190 222,193 226,194 230,191 234,194 238,192 242,192 246,193 250,193 254,192 258,193 262,192 266,189 271,190 275,191 279,191 283,190 287,192 291,191 295,191 299,191 303,193 307,190 311,190 315,189 320,192 324,193 328,191 332,195 336,194 340,194 344,195 348,194 352,195 356,195 360,196 364,196 369,191 373,192 377,194 381,193 385,192 389,191 393,192 397,193 401,193 405,195 409,196 413,195 418,194 422,192 426,195 430,194 434,194 438,197 442,196 446,195 450,196 454,196 458,194 462,194 467,194 471,197 475,192 479,195 483,195 487,194 491,194 495,193 499,195 503,195 507,196 511,198 516,195 520,195 524,195 528,195 532,196 536,197 540,198',
    goodEndY: 143, badEndY: 198,
    goodEnd: '+55%', badEnd: '−8%', maxDip: '−12%',
  },
  2: {
    goodPoints: '50,191 54,192 58,193 62,191 66,191 70,192 75,190 79,183 83,192 87,184 91,189 95,189 99,187 103,185 107,185 111,189 115,182 119,186 124,185 128,192 132,195 136,190 140,189 144,188 148,189 152,188 156,187 160,185 164,187 168,192 173,182 177,187 181,182 185,187 189,183 193,183 197,180 201,181 205,178 209,180 213,180 217,178 222,185 226,182 230,179 234,187 238,184 242,186 246,184 250,181 254,185 258,185 262,174 266,174 271,176 275,182 279,174 283,178 287,176 291,176 295,173 299,173 303,177 307,172 311,178 315,181 320,174 324,174 328,176 332,179 336,173 340,176 344,177 348,177 352,179 356,170 360,170 364,176 369,178 373,173 377,164 381,172 385,170 389,165 393,165 397,165 401,168 405,171 409,160 413,162 418,169 422,162 426,162 430,170 434,169 438,167 442,169 446,168 450,167 454,159 458,165 462,160 467,165 471,166 475,150 479,157 483,152 487,154 491,151 495,150 499,149 503,144 507,143 511,146 516,147 520,144 524,136 528,133 532,134 536,131 540,129',
    badPoints:  '50,191 54,191 58,191 62,193 66,189 70,188 75,187 79,191 83,190 87,190 91,192 95,191 99,190 103,192 107,189 111,192 115,193 119,195 124,190 128,190 132,191 136,196 140,196 144,194 148,195 152,196 156,197 160,196 164,196 168,194 173,198 177,190 181,190 185,194 189,193 193,193 197,192 201,193 205,193 209,194 213,194 217,194 222,193 226,195 230,195 234,201 238,198 242,198 246,200 250,199 254,198 258,201 262,201 266,195 271,194 275,194 279,198 283,196 287,195 291,195 295,194 299,196 303,197 307,197 311,200 315,197 320,195 324,197 328,200 332,199 336,204 340,203 344,204 348,204 352,202 356,200 360,201 364,201 369,198 373,197 377,197 381,202 385,198 389,199 393,198 397,199 401,198 405,201 409,205 413,207 418,206 422,207 426,208 430,206 434,209 438,209 442,210 446,209 450,207 454,210 458,208 462,204 467,204 471,205 475,204 479,203 483,204 487,201 491,202 495,201 499,201 503,203 507,205 511,207 516,200 520,209 524,205 528,207 532,205 536,206 540,207',
    goodEndY: 129, badEndY: 207,
    goodEnd: '+71%', badEnd: '−18%', maxDip: '−26%',
  },
  3: {
    goodPoints: '50,191 54,193 58,195 62,185 66,197 70,182 75,184 79,197 83,191 87,188 91,182 95,183 99,185 103,186 107,191 111,180 115,189 119,183 124,187 128,198 132,183 136,185 140,196 144,194 148,195 152,191 156,191 160,192 164,188 168,192 173,184 177,178 181,188 185,186 189,182 193,180 197,177 201,177 205,175 209,185 213,172 217,177 222,172 226,191 230,177 234,189 238,185 242,185 246,186 250,184 254,187 258,176 262,180 266,174 271,174 275,177 279,176 283,164 287,169 291,168 295,166 299,169 303,171 307,172 311,168 315,166 320,163 324,162 328,177 332,165 336,170 340,171 344,173 348,169 352,167 356,168 360,168 364,157 369,169 373,157 377,157 381,148 385,155 389,149 393,149 397,148 401,148 405,153 409,144 413,153 418,163 422,161 426,155 430,161 434,154 438,161 442,161 446,159 450,152 454,151 458,158 462,142 467,150 471,147 475,138 479,138 483,131 487,133 491,131 495,130 499,125 503,122 507,123 511,124 516,121 520,115 524,119 528,118 532,115 536,110 540,106',
    badPoints:  '50,191 54,192 58,193 62,190 66,192 70,192 75,193 79,189 83,188 87,193 91,188 95,191 99,189 103,190 107,193 111,195 115,188 119,195 124,190 128,192 132,192 136,193 140,194 144,197 148,198 152,197 156,200 160,194 164,198 168,194 173,190 177,195 181,194 185,195 189,194 193,193 197,193 201,194 205,195 209,193 213,194 217,199 222,201 226,205 230,200 234,209 238,206 242,208 246,209 250,208 254,207 258,205 262,204 266,203 271,201 275,198 279,198 283,205 287,201 291,198 295,198 299,199 303,203 307,198 311,206 315,209 320,210 324,213 328,212 332,210 336,211 340,213 344,216 348,216 352,214 356,211 360,213 364,214 369,204 373,212 377,208 381,203 385,208 389,205 393,203 397,204 401,206 405,205 409,212 413,208 418,219 422,212 426,221 430,217 434,217 438,223 442,223 446,221 450,221 454,215 458,221 462,222 467,212 471,210 475,216 479,210 483,210 487,210 491,209 495,209 499,212 503,211 507,214 511,215 516,216 520,214 524,217 528,213 532,216 536,216 540,217',
    goodEndY: 106, badEndY: 217,
    goodEnd: '+97%', badEnd: '−30%', maxDip: '−38%',
  },
  4: {
    goodPoints: '50,191 54,187 58,184 62,195 66,183 70,193 75,199 79,193 83,188 87,176 91,185 95,181 99,182 103,181 107,187 111,184 115,176 119,178 124,187 128,204 132,185 136,192 140,190 144,199 148,198 152,197 156,193 160,200 164,186 168,188 173,187 177,186 181,172 185,183 189,179 193,174 197,172 201,170 205,169 209,173 213,181 217,175 222,176 226,174 230,171 234,187 238,182 242,179 246,182 250,183 254,184 258,177 262,163 266,171 271,168 275,168 279,153 283,160 287,159 291,155 295,156 299,155 303,163 307,153 311,154 315,167 320,173 324,171 328,154 332,163 336,167 340,164 344,168 348,164 352,164 356,165 360,166 364,156 369,156 373,136 377,151 381,135 385,135 389,135 393,129 397,133 401,134 405,128 409,146 413,142 418,129 422,134 426,144 430,147 434,144 438,143 442,147 446,145 450,142 454,138 458,123 462,117 467,127 471,117 475,122 479,110 483,114 487,110 491,103 495,103 499,103 503,92 507,93 511,91 516,82 520,72 524,70 528,78 532,71 536,76 540,70',
    badPoints:  '50,191 54,192 58,195 62,185 66,197 70,185 75,189 79,185 83,186 87,186 91,191 95,186 99,188 103,192 107,192 111,190 115,194 119,195 124,191 128,196 132,196 136,201 140,201 144,203 148,204 152,206 156,206 160,201 164,202 168,195 173,194 177,206 181,203 185,197 189,197 193,195 197,195 201,195 205,198 209,202 213,207 217,206 222,215 226,203 230,206 234,219 238,215 242,216 246,219 250,216 254,217 258,218 262,221 266,214 271,209 275,201 279,209 283,205 287,207 291,206 295,203 299,207 303,210 307,208 311,209 315,208 320,214 324,218 328,224 332,221 336,220 340,225 344,224 348,222 352,225 356,223 360,227 364,215 369,226 373,216 377,221 381,211 385,215 389,210 393,210 397,213 401,216 405,219 409,220 413,217 418,215 422,228 426,220 430,224 434,226 438,228 442,230 446,229 450,224 454,225 458,219 462,229 467,216 471,227 475,216 479,216 483,217 487,217 491,217 495,219 499,218 503,220 507,225 511,223 516,222 520,218 524,232 528,229 532,228 536,227 540,228',
    goodEndY: 70, badEndY: 228,
    goodEnd: '+137%', badEnd: '−42%', maxDip: '−46%',
  },
  5: {
    goodPoints: '50,191 54,186 58,185 62,187 66,191 70,178 75,191 79,188 83,184 87,181 91,173 95,178 99,179 103,181 107,180 111,189 115,186 119,202 124,186 128,180 132,186 136,202 140,196 144,196 148,202 152,196 156,195 160,187 164,182 168,182 173,189 177,166 181,177 185,179 189,175 193,166 197,165 201,169 205,162 209,179 213,167 217,172 222,184 226,182 230,163 234,184 238,179 242,179 246,179 250,175 254,165 258,181 262,167 266,169 271,160 275,153 279,149 283,155 287,144 291,144 295,140 299,143 303,149 307,148 311,160 315,137 320,155 324,151 328,148 332,158 336,161 340,161 344,159 348,157 352,142 356,138 360,135 364,123 369,138 373,138 377,115 381,116 385,107 389,108 393,103 397,104 401,99 405,117 409,122 413,127 418,112 422,129 426,131 430,128 434,131 438,127 442,128 446,126 450,113 454,121 458,103 462,114 467,96 471,108 475,73 479,74 483,79 487,73 491,68 495,61 499,61 503,54 507,56 511,50 516,33 520,49 524,35 528,50 532,33 536,28 540,29',
    badPoints:  '50,191 54,193 58,186 62,193 66,186 70,194 75,182 79,181 83,183 87,191 91,185 95,186 99,187 103,189 107,189 111,195 115,186 119,195 124,193 128,202 132,201 136,211 140,209 144,210 148,210 152,210 156,213 160,212 164,205 168,196 173,201 177,201 181,197 185,200 189,201 193,197 197,198 201,202 205,202 209,200 213,206 217,214 222,209 226,216 230,210 234,226 238,222 242,225 246,226 250,226 254,225 258,217 262,219 266,224 271,217 275,224 279,221 283,216 287,212 291,210 295,209 299,209 303,217 307,220 311,210 315,221 320,214 324,218 328,217 332,230 336,228 340,230 344,230 348,229 352,225 356,220 360,223 364,229 369,232 373,217 377,218 381,220 385,219 389,221 393,217 397,218 401,217 405,220 409,224 413,227 418,224 422,224 426,227 430,227 434,232 438,228 442,231 446,232 450,232 454,231 458,225 462,231 467,232 471,226 475,226 479,232 483,230 487,227 491,224 495,227 499,230 503,227 507,232 511,228 516,221 520,232 524,225 528,229 532,232 536,232 540,232',
    goodEndY: 29, badEndY: 232,
    goodEnd: '+184%', badEnd: '−48%', maxDip: '−48%',
  },
} as const

type ScenarioKey = 'bull' | 'bear' | 'patience' | 'recovery' | 'volatile' | 'bubble'

const SCENARIO_DATA = [
  {
    key: 'bull' as ScenarioKey,
    touchKey: 'scenario_bull',
    title: 'Marknaden går upp',
    desc: 'Det har gått bra på börsen. Dina pengar har växt med 60% på 5 år — om du hade sparat 100 000 kr hade du nu 160 000 kr.',
    points: '50,162 54,165 57,158 61,167 65,162 69,176 72,158 76,170 80,141 83,139 87,145 91,151 95,150 98,148 102,151 106,167 109,169 113,140 117,142 121,146 124,161 128,174 132,165 135,170 139,169 143,167 147,179 150,163 154,175 158,193 161,196 165,176 169,167 173,170 176,178 180,184 184,184 187,179 191,174 195,170 199,156 202,173 206,186 210,179 213,166 217,172 221,154 225,156 228,154 232,153 236,155 239,154 243,162 247,151 251,146 254,122 258,119 262,141 265,122 269,127 273,125 276,128 280,134 284,114 288,143 291,113 295,118 299,134 302,124 306,138 310,141 314,134 317,135 321,136 325,128 328,122 332,126 336,135 340,132 343,110 347,102 351,104 354,107 358,105 362,106 366,111 369,116 373,108 377,104 380,91 384,115 388,103 392,116 395,128 399,124 403,113 406,118 410,112 414,120 418,114 421,116 425,106 429,89 432,84 436,109 440,101 444,93 447,93 451,88 455,94 458,87 462,94 466,92 470,101 473,88 477,85 481,91 484,91 488,100 492,96 496,96 499,89 503,97 507,78 510,72 514,84 518,67 521,102 525,90 529,78 533,77 536,71 540,74',
    endY: 74,
    endLabel: '+60%',
    lineColor: '#2a4d42',
    question: 'Hur känns det här för dig?',
    options: [
      { score: 5, text: 'Riktigt bra — jag är nöjd med att ha tagit risken' },
      { score: 4, text: 'Bra, men jag är lite orolig att det kan vända nedåt' },
      { score: 2, text: 'Obekvämt — uppgången gör mig nervös' },
      { score: 1, text: 'Stressigt — jag vill inte ha sådana svängningar' },
    ],
  },
  {
    key: 'bear' as ScenarioKey,
    touchKey: 'scenario_bear',
    title: 'Marknaden faller',
    desc: 'Börsen har gått ned kraftigt. Dina pengar har minskat med 35% på ett och ett halvt år — om du hade sparat 100 000 kr hade du nu 65 000 kr.',
    points: '50,162 54,163 57,159 61,164 65,164 69,156 72,174 76,164 80,149 83,163 87,155 91,157 95,157 98,163 102,162 106,163 109,160 113,164 117,163 121,180 124,170 128,190 132,184 135,192 139,194 143,196 147,193 150,188 154,184 158,193 161,183 165,185 169,174 173,180 176,179 180,171 184,173 187,176 191,173 195,190 199,178 202,197 206,175 210,180 213,185 217,206 221,202 225,200 228,206 232,204 236,207 239,206 243,190 247,189 251,196 254,201 258,182 262,195 265,194 269,191 273,188 276,192 280,197 284,186 288,192 291,198 295,206 299,200 302,194 306,203 310,204 314,204 317,209 321,210 325,204 328,196 332,218 336,191 340,198 343,192 347,206 351,205 354,195 358,198 362,198 366,198 369,202 373,202 377,211 380,206 384,219 388,216 392,209 395,215 399,212 403,214 406,217 410,218 414,216 418,207 421,207 425,199 429,219 432,219 436,207 440,211 444,201 447,209 451,206 455,207 458,209 462,212 466,214 470,210 473,209 477,199 481,218 484,220 488,209 492,213 496,217 499,218 503,216 507,217 510,218 514,215 518,216 521,211 525,209 529,218 533,214 536,216 540,213',
    endY: 213,
    endLabel: '−35%',
    lineColor: '#d95555',
    question: 'Hur känns det här för dig?',
    options: [
      { score: 5, text: 'Lugnt — sådant händer och det ordnar sig på sikt' },
      { score: 4, text: 'Lite orolig, men jag kan leva med det' },
      { score: 2, text: 'Ganska jobbigt — det är svårt att inte tänka på det' },
      { score: 1, text: 'Väldigt stressigt — jag skulle inte kunna sova' },
    ],
  },
  {
    key: 'patience' as ScenarioKey,
    touchKey: 'scenario_patience',
    title: 'Ingenting händer på länge',
    desc: 'Börsen har knappt rört sig på 7 år. Dina pengar är fortfarande 20% lägre än de var — och det verkar inte hända något.',
    points: '50,162 54,162 57,157 61,156 65,148 69,163 72,149 76,160 80,142 83,157 87,139 91,142 95,140 98,144 102,141 106,147 109,146 113,148 117,154 121,136 124,145 128,145 132,164 135,155 139,159 143,164 147,171 150,163 154,161 158,168 161,173 165,163 169,181 173,196 176,187 180,189 184,194 187,193 191,197 195,181 199,184 202,184 206,179 210,178 213,180 217,191 221,176 225,177 228,176 232,175 236,171 239,183 243,173 247,178 251,198 254,193 258,179 262,176 265,187 269,193 273,191 276,186 280,195 284,189 288,186 291,168 295,191 299,182 302,171 306,171 310,172 314,175 317,173 321,175 325,170 328,178 332,172 336,194 340,183 343,179 347,185 351,187 354,198 358,189 362,194 366,197 369,188 373,195 377,178 380,184 384,188 388,194 392,171 395,176 399,185 403,179 406,182 410,185 414,179 418,188 421,189 425,186 429,200 432,206 436,192 440,185 444,190 447,194 451,198 455,193 458,196 462,186 466,198 470,189 473,206 477,187 481,186 484,198 488,189 492,188 496,188 499,193 503,186 507,180 510,175 514,202 518,173 521,179 525,189 529,182 533,198 536,195 540,191',
    endY: 191,
    endLabel: '−20%',
    lineColor: '#c97b00',
    question: 'Hur känns det här för dig?',
    options: [
      { score: 5, text: 'Okej — jag sparar långsiktigt och behöver inte pengarna nu' },
      { score: 4, text: 'Lite frustrerande men jag håller ut' },
      { score: 2, text: 'Jobbigt — jag undrar om det ens är värt det' },
      { score: 1, text: 'Ångestfyllt — jag ångrar att jag inte satte pengarna på banken' },
    ],
  },
  {
    key: 'recovery' as ScenarioKey,
    touchKey: 'scenario_recovery',
    title: 'Krasch och återhämtning',
    desc: 'Börsen kraschade med nästan 50% under ett par år — men sedan återhämtade sig allt och dina pengar är nu 10% mer värda än när du började.',
    points: '50,162 54,164 58,156 62,161 66,167 70,158 75,150 79,169 83,151 87,169 91,166 95,172 99,169 103,173 107,171 111,192 115,193 119,203 124,206 128,210 132,208 136,218 140,215 144,229 148,232 152,234 156,227 160,226 164,220 168,231 173,228 177,226 181,216 185,220 189,220 193,218 197,217 201,212 205,216 209,210 213,210 217,207 222,232 226,208 230,204 234,192 238,195 242,191 246,191 250,188 254,184 258,184 262,181 266,171 271,178 275,184 279,167 283,181 287,173 291,171 295,169 299,170 303,162 307,168 311,160 315,155 320,171 324,144 328,158 332,166 336,156 340,159 344,157 348,161 352,158 356,155 360,146 364,152 369,161 373,159 377,143 381,166 385,149 389,153 393,151 397,155 401,154 405,149 409,167 413,154 418,152 422,154 426,132 430,140 434,153 438,147 442,147 446,148 450,149 454,138 458,151 462,141 466,147 471,116 475,152 479,136 483,145 487,146 491,147 495,149 499,148 503,151 507,140 511,137 516,141 520,151 524,140 528,154 532,151 536,147 540,147',
    endY: 147,
    endLabel: '+10%',
    lineColor: '#5b7fa6',
    question: 'Hur känns det här för dig?',
    options: [
      { score: 5, text: 'Bra — jag visste att det skulle vända och höll ut' },
      { score: 4, text: 'Lättad — men kraschen var jobbig att uppleva' },
      { score: 2, text: 'Stressigt — jag hade nog sålt under kraschen' },
      { score: 1, text: 'Outhärdligt — jag hade inte klarat av att se pengarna halveras' },
    ],
  },
  {
    key: 'volatile' as ScenarioKey,
    touchKey: 'scenario_volatile',
    title: 'Extremt svängig marknad',
    desc: 'Marknaden har svängt våldsamt upp och ned hela tiden. Trots allt kaos är dina pengar ungefär 5% mer värda efter 10 år.',
    points: '50,162 54,158 58,147 62,146 66,143 70,131 75,160 79,149 83,148 87,132 91,130 95,121 99,121 103,123 107,123 111,129 115,137 119,127 124,143 128,158 132,162 136,157 140,166 144,170 148,179 152,175 156,169 160,158 164,146 168,174 173,128 177,146 181,126 185,131 189,116 193,98 197,96 201,100 205,117 209,104 213,135 217,150 222,170 226,135 230,191 234,190 238,197 242,197 246,213 250,204 254,213 258,185 262,208 266,174 271,176 275,183 279,167 283,154 287,156 291,134 295,132 299,134 303,141 307,133 311,159 315,178 320,147 324,185 328,147 332,182 336,187 340,188 344,194 348,180 352,180 356,165 360,186 364,163 369,149 373,142 377,116 381,131 385,125 389,110 393,106 397,117 401,125 405,129 409,131 413,134 418,132 422,139 426,155 430,161 434,170 438,165 442,173 446,175 450,148 454,166 458,164 462,154 466,158 471,166 475,160 479,139 483,137 487,135 491,132 495,132 499,139 503,157 507,140 511,138 516,127 520,132 524,141 528,158 532,141 536,151 540,154',
    endY: 154,
    endLabel: '+5%',
    lineColor: '#7b5fa6',
    question: 'Hur känns det här för dig?',
    options: [
      { score: 5, text: 'Inga problem — jag tittar på lång sikt och ignorerar svängningarna' },
      { score: 4, text: 'Lite nervöst, men jag förstår att det hör till' },
      { score: 2, text: 'Jobbigt — de stora svängningarna stör mig mycket' },
      { score: 1, text: 'Outhärdligt — jag vill ha stabila investeringar, inte detta' },
    ],
  },
  {
    key: 'bubble' as ScenarioKey,
    touchKey: 'scenario_bubble',
    title: 'Uppgång följt av krasch',
    desc: 'Börsen steg kraftigt med nästan 85% på fyra år — sedan kraschade den tillbaka och dina pengar är nu 10% mindre värda än när du började.',
    points: '50,162 54,162 58,158 62,160 66,156 70,155 75,134 79,151 83,152 87,139 91,141 95,143 99,135 103,132 107,134 111,118 115,115 119,130 124,128 128,121 132,104 136,97 140,104 144,103 148,100 152,97 156,92 160,95 164,91 168,88 173,91 177,77 181,58 185,70 189,65 193,65 197,56 201,54 205,58 209,53 213,65 217,40 222,46 226,37 230,44 234,53 238,41 242,37 246,37 250,44 254,41 258,48 262,46 266,65 271,51 275,68 279,47 283,59 287,68 291,69 295,74 299,78 303,78 307,81 311,74 315,103 320,100 324,92 328,112 332,98 336,110 340,112 344,118 348,121 352,114 356,129 360,145 364,133 369,131 373,140 377,141 381,153 385,146 389,146 393,150 397,154 401,152 405,144 409,150 413,156 418,150 422,151 426,157 430,154 434,153 438,164 442,165 446,166 450,161 454,167 458,167 462,159 466,174 471,165 475,167 479,170 483,172 487,174 491,172 495,176 499,167 503,168 507,183 511,169 516,186 520,184 524,185 528,179 532,169 536,176 540,176',
    endY: 176,
    endLabel: '−10%',
    lineColor: '#a0522d',
    question: 'Hur känns det här för dig?',
    options: [
      { score: 5, text: 'Okej — uppgången och nedgången hör till, jag håller ut' },
      { score: 4, text: 'Blandat — uppgången var skön men slutet var jobbigt' },
      { score: 2, text: 'Stressigt — rusningen lockade mig att investera mer, sen föll allt' },
      { score: 1, text: 'Förödande — jag hade nog köpt på toppen och förlorat stort' },
    ],
  },
] as const

const SAVINGS_PURPOSES = [
  { value: 'pension', label: 'Pension', desc: 'Lång sikt' },
  { value: 'bostad', label: 'Bostad', desc: 'Bostadsköp' },
  { value: 'buffert', label: 'Buffert', desc: 'Trygghetskudde' },
  { value: 'barn', label: 'Barn', desc: 'Barnens framtid' },
  { value: 'annat', label: 'Annat', desc: 'Eget mål' },
]

const HORIZON_OPTIONS = [
  { years: 3, label: '3 år', category: 'Kortfristig', hint: 'Kapitalskydd prioriteras, aktier begränsas' },
  { years: 5, label: '5 år', category: 'Medelfristig', hint: 'Balanserad mix med försiktig aktieexponering' },
  { years: 10, label: '10 år', category: 'Långsiktig', hint: 'God tillväxtpotential med måttlig risk' },
  { years: 15, label: '15 år', category: 'Långsiktig', hint: 'Aktievikt rekommenderas för god avkastning' },
  { years: 25, label: '25 år', category: 'Mycket långsiktig', hint: 'Pensionssparande med hög aktieandel' },
  { years: 40, label: '40 år', category: 'Generationslång', hint: 'Arv eller generationssparande, max tillväxt' },
]

function targetEquity(risk: number, horizon: number): number {
  const base = 0.35 + (risk - 1) * 0.1
  const adj = horizon < 3 ? base - 0.15 : horizon > 15 ? base + 0.1 : base
  return Math.max(0.15, Math.min(0.95, adj))
}

type ProfileData = { name: string; desc: string; equityPct: number }

function computeProfile(risk: number, horizon: number): ProfileData {
  const equityPct = Math.round(targetEquity(risk, horizon) * 100)
  if (risk <= 1.5) return { name: 'Kapitalbevarare', desc: 'Fokus på kapitalskydd med minimal volatilitet.', equityPct }
  if (risk <= 2.5) return { name: 'Defensiv', desc: 'Stabil tillväxt med begränsad kursrisk.', equityPct }
  if (risk <= 3.5)
    return { name: 'Balanserad', desc: 'Klassisk mix av aktier och räntor för måttlig avkastning.', equityPct }
  if (risk <= 4.5) return { name: 'Tillväxt', desc: 'Tydlig aktievikt för god avkastning över tid.', equityPct }
  return { name: 'Offensiv Tillväxt', desc: 'Maximal aktieexponering för högsta förväntade avkastning.', equityPct }
}

// Portfolio chart: −50% to +200%. y(pct) = 235 − (pct + 50) × 0.88
const CHART_GRID = [
  { y: 15,  label: '+200%', isStart: false },
  { y: 103, label: '+100%', isStart: false },
  { y: 147, label:  '+50%', isStart: false },
  { y: 191, label:    '0%', isStart: true  },
  { y: 235, label:  '−50%', isStart: false },
] as const

// Scenario charts: −50% to +100%. y(pct) = 235 − (pct + 50) × (220/150)
const SCENARIO_CHART_GRID = [
  { y: 15,  label: '+100%', isStart: false },
  { y: 88,  label:  '+50%', isStart: false },
  { y: 162, label:    '0%', isStart: true  },
  { y: 235, label:  '−50%', isStart: false },
] as const

// ── Animation helpers ──────────────────────────────────────────────────────
function parsePts(s: string): [number, number][] {
  return s.trim().split(' ').map((p) => p.split(',').map(Number) as [number, number])
}
function ptsToStr(pts: [number, number][]): string {
  return pts.map(([x, y]) => `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`).join(' ')
}
function lerp(a: number, b: number, t: number) { return a + (b - a) * t }
function easeOut(t: number) { return 1 - (1 - t) ** 3 }
const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

function PortfolioChart({ riskLevel }: { riskLevel: number }) {
  const target = CHART_DATA[riskLevel as keyof typeof CHART_DATA]
  const font = 'DM Sans, system-ui, sans-serif'

  const [goodPts, setGoodPts] = useState(() => parsePts(target.goodPoints))
  const [badPts,  setBadPts]  = useState(() => parsePts(target.badPoints))
  const [goodEndY, setGoodEndY] = useState<number>(() => target.goodEndY)
  const [badEndY,  setBadEndY]  = useState<number>(() => target.badEndY)

  const curGood   = useRef(parsePts(target.goodPoints))
  const curBad    = useRef(parsePts(target.badPoints))
  const curGoodEY = useRef<number>(target.goodEndY)
  const curBadEY  = useRef<number>(target.badEndY)
  const rafRef    = useRef<number | null>(null)

  useEffect(() => {
    const toGood   = parsePts(target.goodPoints)
    const toBad    = parsePts(target.badPoints)
    const fromGood = curGood.current
    const fromBad  = curBad.current
    const fromGEY  = curGoodEY.current
    const fromBEY  = curBadEY.current

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)

    if (reducedMotion) {
      setGoodPts(toGood); setBadPts(toBad)
      setGoodEndY(target.goodEndY); setBadEndY(target.badEndY)
      curGood.current = toGood; curBad.current = toBad
      curGoodEY.current = target.goodEndY; curBadEY.current = target.badEndY
      return
    }

    const DURATION = 520
    const t0 = performance.now()

    function tick(now: number) {
      const raw = Math.min((now - t0) / DURATION, 1)
      const t   = easeOut(raw)

      const ng = fromGood.map(([fx, fy], i) => [lerp(fx, toGood[i][0], t), lerp(fy, toGood[i][1], t)] as [number, number])
      const nb = fromBad.map( ([fx, fy], i) => [lerp(fx, toBad[i][0],  t), lerp(fy, toBad[i][1],  t)] as [number, number])
      const nge = lerp(fromGEY, target.goodEndY, t)
      const nbe = lerp(fromBEY, target.badEndY,  t)

      setGoodPts(ng); setBadPts(nb)
      setGoodEndY(nge); setBadEndY(nbe)
      curGood.current = ng; curBad.current = nb
      curGoodEY.current = nge; curBadEY.current = nbe

      if (raw < 1) rafRef.current = requestAnimationFrame(tick)
      else rafRef.current = null
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current) }
  }, [riskLevel]) // eslint-disable-line react-hooks/exhaustive-deps

  const goodStr  = ptsToStr(goodPts)
  const badStr   = ptsToStr(badPts)
  const goodArea = `${goodStr} 540,235 50,235`
  const badArea  = `${badStr} 540,235 50,235`

  return (
    <div className="portfolio-chart">
      <svg viewBox="0 0 580 265" className="portfolio-chart__svg" aria-label="Scenariojämförelse">
        <defs>
          <clipPath id="pcClip">
            <rect x="50" y="15" width="490" height="220" />
          </clipPath>
        </defs>

        <rect x="50" y="15" width="490" height="220" fill="#f8f7f4" rx="3" />

        {CHART_GRID.map(({ y, label, isStart }) => (
          <g key={y}>
            <line
              x1="50" y1={y} x2="540" y2={y}
              stroke={isStart ? '#b0bbc8' : '#e4e0d8'}
              strokeWidth={isStart ? 1.5 : 1}
              strokeDasharray={isStart ? '5 4' : undefined}
            />
            <text x="44" y={y + 4} textAnchor="end" fontSize="10" fill="#8a9aaa" fontFamily={font}>
              {label}
            </text>
          </g>
        ))}

        {([0, 2, 4, 6, 8, 10] as const).map((yr) => (
          <text key={yr} x={50 + (yr / 10) * 490} y="253" textAnchor="middle" fontSize="10" fill="#8a9aaa" fontFamily={font}>
            {yr}
          </text>
        ))}
        <text x="295" y="265" textAnchor="middle" fontSize="9" fill="#aab5c2" fontFamily={font}>År</text>

        <g clipPath="url(#pcClip)">
          <polygon points={goodArea} fill="#2a4d42" fillOpacity="0.07" />
          <polygon points={badArea}  fill="#c0392b" fillOpacity="0.05" />
        </g>

        <polyline points={badStr}  fill="none" stroke="#d95555" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={goodStr} fill="none" stroke="#2a4d42" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        <circle cx="540" cy={goodEndY} r="4.5" fill="#2a4d42" />
        <circle cx="540" cy={badEndY}  r="4.5" fill="#d95555" />

        <text x="548" y={goodEndY + 4} fontSize="10.5" fontWeight="600" fill="#2a4d42" fontFamily={font}>{target.goodEnd}</text>
        <text x="548" y={badEndY  + 4} fontSize="10.5" fontWeight="600" fill="#d95555" fontFamily={font}>{target.badEnd}</text>
      </svg>

      <div className="portfolio-chart__legend">
        <span className="portfolio-chart__legend-item">
          <span className="portfolio-chart__legend-dot portfolio-chart__legend-dot--good" />
          Bra scenario
        </span>
        <span className="portfolio-chart__legend-item">
          <span className="portfolio-chart__legend-dot portfolio-chart__legend-dot--bad" />
          Utmanande scenario
        </span>
      </div>

      <div key={riskLevel} className="portfolio-chart__stats step-animate">
        <div className="portfolio-chart__stat portfolio-chart__stat--good">
          <span className="portfolio-chart__stat-label">Bra scenario (10 år)</span>
          <span className="portfolio-chart__stat-value">{target.goodEnd}</span>
        </div>
        <div className="portfolio-chart__stat portfolio-chart__stat--bad">
          <span className="portfolio-chart__stat-label">Utmanande scenario (10 år)</span>
          <span className="portfolio-chart__stat-value">{target.badEnd}</span>
        </div>
        <div className="portfolio-chart__stat">
          <span className="portfolio-chart__stat-label">Djupaste dipp</span>
          <span className="portfolio-chart__stat-value portfolio-chart__stat-value--dip">{target.maxDip}</span>
        </div>
      </div>
    </div>
  )
}

function ScenarioChart({ points, endY, endLabel, lineColor, chartId }: {
  points: string
  endY: number
  endLabel: string
  lineColor: string
  chartId: string
}) {
  const font = 'DM Sans, system-ui, sans-serif'
  const areaPoints = `${points} 540,235 50,235`
  const clipId = `scClip-${chartId}`

  return (
    <div className="portfolio-chart">
      <svg viewBox="0 0 580 265" className="portfolio-chart__svg" aria-label="Scenariokarta">
        <defs>
          <clipPath id={clipId}>
            <rect x="50" y="15" width="490" height="220" />
          </clipPath>
        </defs>
        <rect x="50" y="15" width="490" height="220" fill="#f8f7f4" rx="3" />
        {SCENARIO_CHART_GRID.map(({ y, label, isStart }) => (
          <g key={y}>
            <line
              x1="50" y1={y} x2="540" y2={y}
              stroke={isStart ? '#b0bbc8' : '#e4e0d8'}
              strokeWidth={isStart ? 1.5 : 1}
              strokeDasharray={isStart ? '5 4' : undefined}
            />
            <text x="44" y={y + 4} textAnchor="end" fontSize="10" fill="#8a9aaa" fontFamily={font}>
              {label}
            </text>
          </g>
        ))}
        {([0, 2, 4, 6, 8, 10] as const).map((yr) => (
          <text key={yr} x={50 + (yr / 10) * 490} y="253" textAnchor="middle" fontSize="10" fill="#8a9aaa" fontFamily={font}>
            {yr}
          </text>
        ))}
        <text x="295" y="265" textAnchor="middle" fontSize="9" fill="#aab5c2" fontFamily={font}>År</text>
        <g clipPath={`url(#${clipId})`}>
          <polygon points={areaPoints} fill={lineColor} fillOpacity="0.09" />
        </g>
        <polyline points={points} fill="none" stroke={lineColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="540" cy={endY} r="4.5" fill={lineColor} />
        <text x="548" y={endY + 4} fontSize="10.5" fontWeight="600" fill={lineColor} fontFamily={font}>{endLabel}</text>
      </svg>
    </div>
  )
}

function ProfileCard({ profile, horizon, purpose, minimal }: { profile: ProfileData; horizon: number; purpose: string; minimal?: boolean }) {
  const purposeLabel = SAVINGS_PURPOSES.find((p) => p.value === purpose)?.label ?? purpose
  return (
    <div className="profile-preview">
      <p className="profile-preview__label">Din investeringsprofil</p>
      <p className="profile-preview__name">{profile.name}</p>
      {!minimal && <p className="profile-preview__desc">{profile.desc}</p>}
      <div className="profile-preview__metrics">
        {!minimal && (
          <>
            <div className="profile-preview__metric">
              <div className="profile-preview__metric-label">Aktieandel</div>
              <div className="profile-preview__metric-value">{profile.equityPct}%</div>
            </div>
            <div className="profile-preview__metric">
              <div className="profile-preview__metric-label">Räntor / Stabila</div>
              <div className="profile-preview__metric-value">{100 - profile.equityPct}%</div>
            </div>
          </>
        )}
        <div className="profile-preview__metric">
          <div className="profile-preview__metric-label">Sparhorisont</div>
          <div className="profile-preview__metric-value">{horizon} år</div>
        </div>
        <div className="profile-preview__metric">
          <div className="profile-preview__metric-label">Mål</div>
          <div className="profile-preview__metric-value">{purposeLabel}</div>
        </div>
      </div>
    </div>
  )
}

type TinkLinkInfo = { mode: 'mock' | 'tink'; url?: string; message?: string; redirect_uri?: string }

type ConnectPayload = {
  buffer: Record<string, unknown>
  holdings: Record<string, unknown>[]
  analysis: Record<string, unknown>
  buffer_accounts?: { id?: string; name: string; liquid_sek: number }[]
}

type SnapshotResponse = ConnectPayload & {
  accounts?: unknown
  tink_debug?: Record<string, unknown>
  tink_oauth_token?: unknown
  tink_transactions?: unknown
  tink_transactions_error?: string
  credentials_id?: string
}

export function Onboarding() {
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const [step, setStep] = useState(0)
  const [riskTolerance, setRiskTolerance] = useState(3)
  const [timeHorizonYears, setTimeHorizonYears] = useState(10)
  const [savingsPurpose, setSavingsPurpose] = useState('pension')
  const [dependentsCount, setDependentsCount] = useState<number | null>(null)
  const [salaryMonthlySek, setSalaryMonthlySek] = useState<number | null>(null)
  const [age, setAge] = useState<number | null>(null)
  const [disposableIncomeMonthlySek, setDisposableIncomeMonthlySek] = useState<number | null>(null)
  const [expensiveLoans, setExpensiveLoans] = useState(false)
  const [adjustedRisk, setAdjustedRisk] = useState<number | null>(null)
  const [monthlyContributionSek, setMonthlyContributionSek] = useState<number | null>(null)
  const [tinkInfo, setTinkInfo] = useState<TinkLinkInfo | null>(null)
  const [connectData, setConnectData] = useState<ConnectPayload | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [touched, setTouched] = useState<Set<string>>(new Set())
  const touch = (name: string) => setTouched((prev) => new Set([...prev, name]))
  const [error, setError] = useState<string | null>(null)
  const [tinkDebug, setTinkDebug] = useState<unknown>(null)
  const [scenarioAnswers, setScenarioAnswers] = useState<Partial<Record<ScenarioKey, number>>>({})
  const [enriching, setEnriching] = useState(false)
  const [scenarioSubStep, setScenarioSubStep] = useState(0)

  type AgentIssue = {
    holding_name?: string
    severity?: string
    category?: string
    problem: string
    detail: string
    citation: string
  }
  type AgentResult = {
    overall_assessment?: string
    issues?: AgentIssue[]
    target_equity_pct?: number
    target_bond_pct?: number
    error?: string
  }
  const [agentResult, setAgentResult] = useState<AgentResult | null>(null)
  const [agentLoading, setAgentLoading] = useState(false)
  const agentPreloadRef = useRef<Promise<AgentResult> | null>(null)

  useEffect(() => { window.scrollTo(0, 0) }, [step])

  useEffect(() => {
    api<{ profile: {
      risk_tolerance: number | null
      time_horizon_years: number | null
      savings_purpose: string | null
      dependents_count: number | null
      salary_monthly_sek: number | null
      age: number | null
      disposable_income_monthly_sek: number | null
      expensive_loans: boolean | null
      adjusted_risk_tolerance: number | null
      monthly_contribution_sek: number | null
    }}>('/api/onboarding/profile')
      .then(({ profile: p }) => {
        if (p.risk_tolerance != null) setRiskTolerance(p.risk_tolerance)
        if (p.time_horizon_years != null) setTimeHorizonYears(p.time_horizon_years)
        if (p.savings_purpose != null) setSavingsPurpose(p.savings_purpose)
        if (p.dependents_count != null) setDependentsCount(p.dependents_count)
        if (p.age != null) setAge(p.age)
        if (p.salary_monthly_sek != null) setSalaryMonthlySek(p.salary_monthly_sek)
        if (p.disposable_income_monthly_sek != null) setDisposableIncomeMonthlySek(p.disposable_income_monthly_sek)
        if (p.expensive_loans != null) setExpensiveLoans(p.expensive_loans)
        setAdjustedRisk(p.adjusted_risk_tolerance)
        if (p.monthly_contribution_sek != null) setMonthlyContributionSek(p.monthly_contribution_sek)
      })
      .catch(() => {})
      .finally(() => setProfileLoading(false))
  }, [])

  useEffect(() => {
    if (search.get('tink') !== 'connected') return
    ;(async () => {
      try {
        const snap = await api<SnapshotResponse>('/api/tink/snapshot')
        setConnectData({
          buffer: snap.buffer as ConnectPayload['buffer'],
          holdings: snap.holdings as ConnectPayload['holdings'],
          analysis: snap.analysis as ConnectPayload['analysis'],
          buffer_accounts: snap.buffer_accounts,
        })
        const hasServerTinkDump =
          (snap.tink_debug != null && typeof snap.tink_debug === 'object') ||
          snap.tink_oauth_token != null ||
          snap.tink_transactions != null ||
          snap.tink_transactions_error != null
        const fromServer = hasServerTinkDump
          ? snap.tink_debug != null && typeof snap.tink_debug === 'object'
            ? {
                ...snap.tink_debug,
                accounts: snap.accounts,
                _source: 'server_snapshot',
              }
            : {
                tink_oauth_token: snap.tink_oauth_token,
                accounts: snap.accounts,
                tink_transactions: snap.tink_transactions,
                ...(snap.tink_transactions_error != null
                  ? { tink_transactions_error: snap.tink_transactions_error }
                  : {}),
                ...(snap.credentials_id != null && snap.credentials_id !== ''
                  ? { credentials_id: snap.credentials_id }
                  : {}),
                _source: 'server_snapshot',
              }
          : null
        setTinkDebug(
          fromServer ?? {
            _note:
              'Ingen sparad Tink-debug i denna snapshot (äldre koppling eller tom Tink-respons). Visar endast sparade konton.',
            accounts: snap.accounts,
          },
        )
        setStep(1)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Kunde inte läsa bankdata.')
      }
    })()
  }, [search])

  useEffect(() => {
    api<TinkLinkInfo>('/api/tink/link')
      .then(setTinkInfo)
      .catch((e) => setError(e instanceof Error ? e.message : 'Kunde inte hämta Tink-länk.'))
  }, [])

  const baseProfile = useMemo(() => computeProfile(riskTolerance, timeHorizonYears), [riskTolerance, timeHorizonYears])
  const adjustedProfile = useMemo(
    () => computeProfile(adjustedRisk ?? riskTolerance, timeHorizonYears),
    [adjustedRisk, riskTolerance, timeHorizonYears],
  )

  const behavioralRisk = useMemo(() => {
    const answers = ([scenarioAnswers.bull, scenarioAnswers.bear, scenarioAnswers.patience, scenarioAnswers.recovery, scenarioAnswers.volatile, scenarioAnswers.bubble] as (number | undefined)[])
      .filter((v): v is number => v !== undefined)
    if (answers.length === 0) return null
    const avg = answers.reduce((a, b) => a + b, 0) / answers.length
    return Math.max(1, Math.min(5, Math.round(avg)))
  }, [scenarioAnswers])

  const profilePayload = useMemo(
    () => ({
      risk_tolerance: riskTolerance,
      time_horizon_years: timeHorizonYears,
      savings_purpose: savingsPurpose,
      dependents_count: dependentsCount,
      salary_monthly_sek: salaryMonthlySek,
      age,
      disposable_income_monthly_sek: disposableIncomeMonthlySek,
      expensive_loans: expensiveLoans,
      adjusted_risk_tolerance: adjustedRisk,
      monthly_contribution_sek: monthlyContributionSek,
      scenario_answers_json: Object.keys(scenarioAnswers).length > 0 ? JSON.stringify(scenarioAnswers) : null,
      current_step: step,
    }),
    [age, dependentsCount, disposableIncomeMonthlySek, expensiveLoans, monthlyContributionSek, adjustedRisk, riskTolerance, salaryMonthlySek, savingsPurpose, scenarioAnswers, step, timeHorizonYears],
  )

  async function persistProfile(extra?: Record<string, unknown>) {
    const body = { ...profilePayload, ...extra }
    console.log('[Onboarding] saving step', step, body)
    const result = await api<{ profile: Record<string, unknown> }>('/api/onboarding/profile', {
      method: 'PUT',
      body,
    })
    console.log('[Onboarding] saved, DB now has:', result.profile)
  }

  function requiredForStep(s: number): string[] {
    if (s === 2) return ['scenario_bull', 'scenario_bear', 'scenario_patience', 'scenario_recovery', 'scenario_volatile', 'scenario_bubble']
    if (s === 5) return ['dependentsCount']
    if (s === 6) return ['age', 'salaryMonthlySek', 'disposableIncomeMonthlySek']
    return []
  }

  function back() {
    setStep((s) => Math.max(0, s - 1))
  }

  function nextScenario() {
    const sc = SCENARIO_DATA[scenarioSubStep]
    if (scenarioAnswers[sc.key] === undefined) {
      touch(sc.touchKey)
      return
    }
    if (scenarioSubStep < SCENARIO_DATA.length - 1) {
      setScenarioSubStep((s) => s + 1)
    } else {
      void next()
    }
  }

  function backScenario() {
    if (scenarioSubStep > 0) {
      setScenarioSubStep((s) => s - 1)
    } else {
      back()
    }
  }

  async function next() {
    const missing = requiredForStep(step).filter((field) => {
      if (field === 'scenario_bull') return scenarioAnswers.bull === undefined
      if (field === 'scenario_bear') return scenarioAnswers.bear === undefined
      if (field === 'scenario_patience') return scenarioAnswers.patience === undefined
      if (field === 'scenario_recovery') return scenarioAnswers.recovery === undefined
      if (field === 'scenario_volatile') return scenarioAnswers.volatile === undefined
      if (field === 'scenario_bubble') return scenarioAnswers.bubble === undefined
      if (field === 'dependentsCount') return dependentsCount === null
      if (field === 'age') return age === null
      if (field === 'salaryMonthlySek') return salaryMonthlySek === null
      if (field === 'disposableIncomeMonthlySek') return disposableIncomeMonthlySek === null
      return false
    })
    if (missing.length > 0) {
      setTouched((prev) => new Set([...prev, ...missing]))
      return
    }
    setError(null)
    try {
      await persistProfile()
      setStep((s) => s + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunde inte spara.')
    }
  }

  async function connectMock() {
    setError(null)
    try {
      const res = await api<ConnectPayload>('/api/tink/connect-mock', { method: 'POST' })
      setConnectData(res)
      setStep(1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Anslutningen misslyckades.')
    }
  }

  useEffect(() => {
    if (step !== 10) return
    setAgentLoading(true)
    setAgentResult(null)
    const run = async () => {
      try {
        const result = agentPreloadRef.current
          ? await agentPreloadRef.current
          : await api<AgentResult>('/api/agent/assess', { method: 'POST' })
        agentPreloadRef.current = null
        setAgentResult(result)
        // Kick off recommendations in background while user reads the analysis
        if (!result.error) {
          api('/api/agent/recommend', { method: 'POST' }).catch(() => {})
        }
      } catch (e) {
        setAgentResult({ error: e instanceof Error ? e.message : 'Analysen misslyckades.' })
      } finally {
        setAgentLoading(false)
      }
    }
    run()
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  async function enrichAndAdvance() {
    setEnriching(true)
    setError(null)
    try {
      const res = await api<{ holdings: ConnectPayload['holdings']; analysis: ConnectPayload['analysis'] }>(
        '/api/tink/enrich-holdings',
        { method: 'POST' },
      )
      setConnectData((prev) => prev ? { ...prev, holdings: res.holdings, analysis: res.analysis } : prev)
      // Kick off agent analysis in the background so it's ready when the user reaches step 10
      agentPreloadRef.current = api<AgentResult>('/api/agent/assess', { method: 'POST' }).catch(
        (e) => ({ error: e instanceof Error ? e.message : 'Analysen misslyckades.' } as AgentResult),
      )
      setStep(8)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Berikning misslyckades.')
    } finally {
      setEnriching(false)
    }
  }

  async function finishOnboarding(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setFinishing(true)
    try {
      await persistProfile({ onboarding_completed: true })
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte slutföra.')
      setFinishing(false)
    }
  }


  if (profileLoading) {
    return (
      <Shell>
        <div className="page narrow">
          <p className="muted">Laddar…</p>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="page page--wide">
        <div className="stack" style={{ marginBottom: '1.5rem' }}>
          <Link to="/dashboard" className="muted small">
            Till översikt
          </Link>
          <StepProgress current={step} total={TOTAL_STEPS} label={STEP_LABELS[step] ?? ''} />
        </div>

        {error && (
          <p className="error step-animate" role="alert">
            {error}
          </p>
        )}

        {/* Step 1 — Risk */}
        {step === 1 && (
          <section key={step} className="surface step-animate stack">
            <div>
              <h2>Hur mycket risk är du bekväm med?</h2>
              <p className="muted">
                Välj en strategi nedan — diagrammet uppdateras direkt och visar hur 100 kr kan växa eller sjunka
                under ett bra respektive ett utmanande marknadsläge över 10 år.
              </p>
            </div>
            <div className="risk-selector">
              {RISK_OPTIONS.map((opt) => (
                <button
                  key={opt.level}
                  type="button"
                  className={`risk-selector-card${riskTolerance === opt.level ? ' risk-selector-card--selected' : ''}`}
                  onClick={() => setRiskTolerance(opt.level)}
                >
                  <span className="risk-selector-card__num">{opt.level}</span>
                  <span className="risk-selector-card__name">{opt.name}</span>
                  <span className="risk-selector-card__tagline">{opt.tagline}</span>
                </button>
              ))}
            </div>
            <PortfolioChart riskLevel={riskTolerance} />
            <button type="button" className="btn-primary" onClick={next}>
              Nästa
            </button>
          </section>
        )}

        {/* Step 2 — Behavioural scenarios (one at a time) */}
        {step === 2 && (() => {
          const sc = SCENARIO_DATA[scenarioSubStep] as (typeof SCENARIO_DATA)[0]
          const answerKey = sc.key
          const isLast = scenarioSubStep === SCENARIO_DATA.length - 1
          return (
            <section key={`step2-${scenarioSubStep}`} className="surface step-animate stack">
              <div>
                <h2>{sc.title}</h2>
                <p className="muted">
                  Scenario {scenarioSubStep + 1} av {SCENARIO_DATA.length} — svara på hur du känner i det här läget.
                </p>
              </div>
              <div className="scenario-card">
                <p className="scenario-card__desc">{sc.desc}</p>
                <ScenarioChart
                  points={sc.points}
                  endY={sc.endY}
                  endLabel={sc.endLabel}
                  lineColor={sc.lineColor}
                  chartId={sc.key}
                />
                <div className="stack stack--tight">
                  <p className="field-label">{sc.question}</p>
                  <div className="scenario-options">
                    {sc.options.map((opt) => (
                      <button
                        key={opt.score}
                        type="button"
                        className={`scenario-option${scenarioAnswers[answerKey] === opt.score ? ' scenario-option--selected' : ''}`}
                        onClick={() => setScenarioAnswers((prev) => ({ ...prev, [answerKey]: opt.score }))}
                      >
                        {opt.text}
                      </button>
                    ))}
                  </div>
                  {touched.has(sc.touchKey) && scenarioAnswers[answerKey] === undefined && (
                    <span className="field-error">Välj ett alternativ</span>
                  )}
                </div>
              </div>
              <div className="step-nav">
                <button type="button" className="btn-ghost" onClick={backScenario}>Tillbaka</button>
                <button type="button" className="btn-primary" onClick={nextScenario}>
                  {isLast ? 'Se resultat' : 'Nästa'}
                </button>
              </div>
            </section>
          )
        })()}

        {/* Step 3 — Behavioural profile result */}
        {step === 3 && (
          <section key={step} className="surface step-animate stack">
            <div>
              <h2>Din beteendeprofil</h2>
              <p className="muted">
                Baserat på dina svar har vi beräknat en beteendebaserad risknivå och jämfört den med ditt eget val.
              </p>
            </div>

            <div className="profile-match">
              <div className="profile-match__row">
                <span className="profile-match__label">Ditt val</span>
                <span className="profile-match__value">
                  {RISK_OPTIONS.find((o) => o.level === riskTolerance)?.name} (nivå {riskTolerance})
                </span>
              </div>
              <div className="profile-match__row">
                <span className="profile-match__label">Beteendebaserad risknivå</span>
                <span className="profile-match__value">
                  {behavioralRisk !== null
                    ? `${RISK_OPTIONS.find((o) => o.level === behavioralRisk)?.name} (nivå ${behavioralRisk})`
                    : '–'}
                </span>
              </div>

              {behavioralRisk !== null && behavioralRisk !== riskTolerance && (
                <div className="profile-match__suggestion">
                  <p>
                    {behavioralRisk < riskTolerance
                      ? `Dina svar tyder på att du kan reagera starkare på nedgångar än din valda risknivå antyder. Vi rekommenderar risk ${behavioralRisk} — en lugnare portfölj som passar ditt faktiska beteende bättre.`
                      : `Dina svar tyder på att du har hög risktolerans i praktiken. Med risk ${behavioralRisk} kan du ta mer del av marknadens uppgångar.`}
                  </p>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ marginTop: '0.75rem', width: '100%' }}
                    onClick={async () => {
                      if (behavioralRisk === null) return
                      setAdjustedRisk(behavioralRisk)
                      setError(null)
                      try {
                        await api<{ profile: Record<string, unknown> }>('/api/onboarding/profile', {
                          method: 'PUT',
                          body: { ...profilePayload, adjusted_risk_tolerance: behavioralRisk },
                        })
                        setStep((s) => s + 1)
                      } catch (e) {
                        setError(e instanceof Error ? e.message : 'Kunde inte spara.')
                      }
                    }}
                  >
                    Justera till risk {behavioralRisk}
                  </button>
                </div>
              )}

              {behavioralRisk !== null && behavioralRisk === riskTolerance && (
                <div className="profile-match__match">
                  Utmärkt — ditt beteende stämmer väl överens med din valda risknivå.
                </div>
              )}
            </div>

            <div className="step-nav">
              <button type="button" className="btn-ghost" onClick={back}>Tillbaka</button>
              <button type="button" className="btn-primary" onClick={next}>
                {behavioralRisk !== null && behavioralRisk !== riskTolerance ? 'Behåll mitt val' : 'Nästa'}
              </button>
            </div>
          </section>
        )}

        {/* Step 4 — Horizon */}
        {step === 4 && (
          <section key={step} className="surface step-animate stack">
            <div>
              <h2>Hur länge vill du spara?</h2>
              <p className="muted">
                Tidshorisonten styr hur mycket risk du kan ta. Längre tid ger mer utrymme för aktier och högre
                förväntad avkastning.
              </p>
            </div>
            <div className="horizon-options">
              {HORIZON_OPTIONS.map((opt) => (
                <button
                  key={opt.years}
                  type="button"
                  className={`horizon-option${timeHorizonYears === opt.years ? ' horizon-option--selected' : ''}`}
                  onClick={() => setTimeHorizonYears(opt.years)}
                >
                  <span className="horizon-option__years">{opt.label}</span>
                  <span className="horizon-option__category">{opt.category}</span>
                  <span className="horizon-option__hint">{opt.hint}</span>
                </button>
              ))}
            </div>
            <div className="step-nav">
              <button type="button" className="btn-ghost" onClick={back}>Tillbaka</button>
              <button type="button" className="btn-primary" onClick={next}>Nästa</button>
            </div>
          </section>
        )}

        {/* Step 5 — Savings purpose */}
        {step === 5 && (
          <section key={step} className="surface step-animate stack">
            <div>
              <h2>Vad sparar du till?</h2>
              <p className="muted">
                Syftet påverkar hur vi tolkar din profil och vilka rekommendationer vi ger.
              </p>
            </div>
            <div className="purpose-cards">
              {SAVINGS_PURPOSES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  className={`purpose-card${savingsPurpose === p.value ? ' purpose-card--selected' : ''}`}
                  onClick={() => setSavingsPurpose(p.value)}
                >
                  <span className="purpose-card__label">{p.label}</span>
                  <span className="purpose-card__desc">{p.desc}</span>
                </button>
              ))}
            </div>
            <label>
              Antal försörjningsberoende
              <input
                type="number"
                min={0}
                value={dependentsCount ?? ''}
                onChange={(e) => setDependentsCount(e.target.value === '' ? null : Number(e.target.value))}
                onBlur={() => touch('dependentsCount')}
              />
              {touched.has('dependentsCount') && dependentsCount === null && (
                <span className="field-error">Ange ett värde</span>
              )}
              <span className="field-hint">Partner, barn eller andra du försörjer ekonomiskt</span>
            </label>
            <div className="step-nav">
              <button type="button" className="btn-ghost" onClick={back}>Tillbaka</button>
              <button type="button" className="btn-primary" onClick={next}>Nästa</button>
            </div>
          </section>
        )}

        {/* Step 6 — Finances */}
        {step === 6 && (
          <section key={step} className="surface step-animate stack">
            <div>
              <h2>Din ekonomi</h2>
              <p className="muted">
                Siffrorna hjälper oss beräkna ett realistiskt buffertmål och hur mycket du kan spara varje månad.
              </p>
            </div>
            <label>
              Ålder
              <input
                type="number"
                min={18}
                max={100}
                value={age ?? ''}
                onChange={(e) => setAge(e.target.value === '' ? null : Number(e.target.value))}
                onBlur={() => touch('age')}
              />
              {touched.has('age') && age === null && (
                <span className="field-error">Ange ett värde</span>
              )}
              <span className="field-hint">Påverkar hur lång aktiv sparhorisont du har kvar till pension</span>
            </label>
            <label>
              Bruttolön per månad (kr)
              <input
                type="number"
                min={0}
                value={salaryMonthlySek ?? ''}
                onChange={(e) => setSalaryMonthlySek(e.target.value === '' ? null : Number(e.target.value))}
                onBlur={() => touch('salaryMonthlySek')}
              />
              {touched.has('salaryMonthlySek') && salaryMonthlySek === null && (
                <span className="field-error">Ange ett värde</span>
              )}
              <span className="field-hint">Används för att bedöma skatteeffekter och totalt sparutrymme</span>
            </label>
            <label>
              Kvar efter vanlig månad (kr)
              <input
                type="number"
                min={0}
                value={disposableIncomeMonthlySek ?? ''}
                onChange={(e) => setDisposableIncomeMonthlySek(e.target.value === '' ? null : Number(e.target.value))}
                onBlur={() => touch('disposableIncomeMonthlySek')}
              />
              {touched.has('disposableIncomeMonthlySek') && disposableIncomeMonthlySek === null && (
                <span className="field-error">Ange ett värde</span>
              )}
              <span className="field-hint">
                Det du har kvar när räkningar och levnadskostnader är betalda — din sparpotential
              </span>
            </label>
            <label className="row" style={{ alignItems: 'flex-start', gap: '0.65rem' }}>
              <input
                type="checkbox"
                checked={expensiveLoans}
                onChange={(e) => setExpensiveLoans(e.target.checked)}
                style={{ marginTop: '0.25rem' }}
              />
              <span>
                Jag har dyra lån (kreditkort eller konsumtionslån med hög ränta)
                <span className="field-hint" style={{ display: 'block', marginTop: '0.2rem' }}>
                  Dessa bör prioriteras och amorteras ned innan nytt sparande ökas
                </span>
              </span>
            </label>
            <div className="step-nav">
              <button type="button" className="btn-ghost" onClick={back}>Tillbaka</button>
              <button type="button" className="btn-primary" onClick={next}>Nästa</button>
            </div>
          </section>
        )}

        {/* Step 0 — Bank connection */}
        {step === 0 && (
          <section key={step} className="surface step-animate stack">
            <div>
              <h2>Anslut din bank</h2>
              <p className="muted">
                Vi läser konton via öppen bankkoppling för att ge dig en personlig portföljanalys. Ingen data lagras
                utan ditt godkännande.
              </p>
            </div>
            {tinkInfo?.mode === 'mock' && (
              <div className="callout stack stack--tight">
                <p className="small">
                  Appen körs i demoläge. Klicka nedan för att hämta demonstrationsdata med svenska fondinnehav.
                </p>
                <button type="button" className="btn-primary" onClick={connectMock}>
                  Använd demonstrationsdata
                </button>
              </div>
            )}
            {tinkInfo?.mode === 'tink' && tinkInfo.url && (
              <div className="callout stack stack--tight">
                <p className="small">
                  Öppna bankkopplingen i ett nytt fönster, logga in med demobanken och kom sedan tillbaka hit.
                </p>
                <a className="btn-link" href={tinkInfo.url}>
                  Öppna Tink
                </a>
                {tinkInfo.redirect_uri && (
                  <p className="muted small">Återhoppsadress: {tinkInfo.redirect_uri}</p>
                )}
              </div>
            )}
          </section>
        )}

        {/* Step 7 — Buffer */}
        {step === 7 && connectData && (
          <section key={step} className="surface step-animate stack">
            <div>
              <h2>Buffert</h2>
              <p className="muted">En likvid buffert minskar risken att behöva sälja placerat kapital i otid.</p>
            </div>
            {tinkDebug != null && (
              <details className="callout stack stack--tight">
                <summary className="small" style={{ cursor: 'pointer' }}>
                  Rådata från Tink (JSON)
                </summary>
                <p className="muted small" style={{ marginBottom: 0 }}>
                  OAuth-svar visar kortade token-värden. Konton och transaktioner är oförändrade svar från Tinks API.
                </p>
                <pre
                  className="small"
                  style={{
                    overflow: 'auto',
                    maxHeight: 'min(70vh, 36rem)',
                    marginTop: '0.75rem',
                    padding: '0.75rem',
                    background: 'var(--color-surface-elevated, #f4f4f5)',
                    borderRadius: '8px',
                  }}
                >
                  {JSON.stringify(tinkDebug, null, 2)}
                </pre>
              </details>
            )}
            <p>
              Mål: cirka{' '}
              {(connectData.buffer as { target_buffer_sek?: number }).target_buffer_sek?.toLocaleString('sv-SE')} kronor
              ·{' '}
              {(connectData.buffer as { meets_target?: boolean }).meets_target ? 'du når målet' : 'under målet'}.
            </p>
            <ul className="plain muted small">
              {connectData.buffer_accounts?.map((b) => (
                <li key={b.name}>
                  {b.name}: {b.liquid_sek.toLocaleString('sv-SE')} kr
                </li>
              ))}
            </ul>
            {enriching ? (
              <div className="enriching-state step-animate">
                <div className="enriching-state__spinner" />
                <div className="enriching-state__dots">
                  <span className="enriching-state__dot" />
                  <span className="enriching-state__dot" />
                  <span className="enriching-state__dot" />
                </div>
                <p className="enriching-state__text">Hämtar fonddata från faktablad…</p>
              </div>
            ) : (
              <div className="step-nav">
                <button type="button" className="btn-ghost" onClick={back}>Tillbaka</button>
                <button type="button" className="btn-primary" onClick={enrichAndAdvance}>Nästa</button>
              </div>
            )}
          </section>
        )}

        {/* Step 8 — Holdings */}
        {step === 8 && connectData && (
          <section key={step} className="surface step-animate stack">
            <div>
              <h2>Dina innehav</h2>
              <p className="muted">Här är en förenklad analys utifrån dina konton.</p>
            </div>
            <div className="holdings">
              {connectData.holdings.map((h) => (
                <article key={String(h.id)} className="holding">
                  <h3>{String(h.name)}</h3>
                  <p className="muted small">{String(h.notes || '')}</p>
                  <p className="small">
                    Värde: {Number(h.value_sek).toLocaleString('sv-SE')} kr · Avgift: {String(h.ongoing_fee_pct)} % ·
                    Domicil: {String(h.domicile)} · Konto: {String(h.vehicle)}
                  </p>
                </article>
              ))}
            </div>
            <h3 className="muted" style={{ fontFamily: 'var(--font-sans)', fontSize: '0.95rem', fontWeight: 600 }}>
              Viktigt att veta
            </h3>
            <ul className="issues">
              {((connectData.analysis as { issues?: { title: string; body: string }[] }).issues || []).map((i) => (
                <li key={i.title}>
                  <strong>{i.title}</strong>
                  <div className="muted small" style={{ marginTop: '0.35rem' }}>
                    {i.body}
                  </div>
                </li>
              ))}
            </ul>
            <div className="step-nav">
              <button type="button" className="btn-ghost" onClick={back}>Tillbaka</button>
              <button type="button" className="btn-primary" onClick={() => setStep(9)}>Nästa</button>
            </div>
          </section>
        )}

        {/* Step 9 — Adjust plan */}
        {step === 9 && connectData && (
          <section key={step} className="surface step-animate stack">
            <div>
              <h2>Justera plan</h2>
              <p className="muted">Din nuvarande profil visas nedan. Justera risknivån om din situation har ändrats.</p>
            </div>

            <div className="stack stack--tight">
              <p className="field-label">Justera risk (valfritt)</p>
              <div className="risk-selector">
                {RISK_OPTIONS.map((opt) => (
                  <button
                    key={opt.level}
                    type="button"
                    className={`risk-selector-card${(adjustedRisk ?? riskTolerance) === opt.level ? ' risk-selector-card--selected' : ''}`}
                    onClick={() => setAdjustedRisk(opt.level === riskTolerance ? null : opt.level)}
                  >
                    <span className="risk-selector-card__num">{opt.level}</span>
                    <span className="risk-selector-card__name">{opt.name}</span>
                    <span className="risk-selector-card__tagline">{opt.tagline}</span>
                  </button>
                ))}
              </div>
              <PortfolioChart riskLevel={adjustedRisk ?? riskTolerance} />
            </div>

            <label>
              Extra månadssparande (kr)
              <input
                type="number"
                min={0}
                value={monthlyContributionSek ?? ''}
                placeholder="Valfritt"
                onChange={(e) => setMonthlyContributionSek(e.target.value ? Number(e.target.value) : null)}
              />
              <span className="field-hint">Läggs till ditt befintliga sparande varje månad</span>
            </label>

            <div>
              <p className="field-label">Föreslagna fonder</p>
              <ul className="plain">
                {(
                  (connectData.analysis as { suggested_funds?: { name: string; rationale: string }[] })
                    .suggested_funds || []
                ).map((s) => (
                  <li key={s.name} style={{ marginBottom: '0.5rem' }}>
                    <strong>{s.name}</strong>
                    <div className="muted small">{s.rationale}</div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="step-nav">
              <button type="button" className="btn-ghost" onClick={back}>Tillbaka</button>
              <button type="button" className="btn-primary" onClick={next}>Nästa</button>
            </div>
          </section>
        )}

        {/* Step 10 — Done + AI assessment */}
        {step === 10 && agentLoading && (
          <section key="step10-loading" className="surface step-animate">
            <div className="agent-loading-page">
              <div className="agent-loading-page__spinner" />
              <p className="agent-loading-page__label">Analyserar din portfölj</p>
              <QuoteRotator />
            </div>
          </section>
        )}

        {step === 10 && !agentLoading && (
          <section key="step10-result" className="surface step-animate stack">
            <HeroImage className="hero-image--compact" src={images.forestLight} alt={imageAlt.forestLight} />
            <div>
              <h2>Din portföljanalys</h2>
              <p className="muted">AI-rådgivaren har analyserat din portfölj och dina svar.</p>
            </div>

            {agentResult && !agentResult.error && (
              <div className="stack">
                {agentResult.target_equity_pct !== undefined && (
                  <div className="reko-allocation reko-allocation--compact">
                    <div className="reko-allocation__label">
                      <span>Ditt mål</span>
                      <span className="reko-allocation__pct">{agentResult.target_equity_pct}% aktier / {agentResult.target_bond_pct}% räntor</span>
                    </div>
                    <div className="reko-allocation__bar-wrap">
                      <div className="reko-allocation__bar reko-allocation__bar--equity" style={{ width: `${agentResult.target_equity_pct}%` }} />
                      <div className="reko-allocation__bar reko-allocation__bar--bond" style={{ width: `${agentResult.target_bond_pct}%` }} />
                    </div>
                  </div>
                )}
                {agentResult.overall_assessment && (
                  <p>{agentResult.overall_assessment}</p>
                )}
                {agentResult.issues && agentResult.issues.length > 0 && (() => {
                  const grouped = agentResult.issues!.reduce((acc, issue) => {
                    const key = issue.holding_name || 'Portföljnivå'
                    return { ...acc, [key]: [...(acc[key] || []), issue] }
                  }, {} as Record<string, AgentIssue[]>)
                  return (
                    <div className="stack stack--tight">
                      <p className="field-label">Identifierade problem</p>
                      {Object.entries(grouped).map(([fundName, fundIssues]) => (
                        <div key={fundName} className="issue-fund-group">
                          <div className="issue-fund-group__name">{fundName}</div>
                          <ul className="issue-fund-group__list">
                            {fundIssues.map((issue, idx) => (
                              <li key={idx} className="issue-fund-group__item" data-severity={issue.severity}>
                                <div className="issue-fund-group__problem">{issue.problem}</div>
                                <div className="muted small issue-fund-group__detail">{issue.detail}</div>
                                <div className="muted small issue-fund-group__citation">{issue.citation}</div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            )}

            {agentResult?.error && (
              <p className="muted small">Kunde inte hämta AI-analys: {agentResult.error}</p>
            )}

            <form onSubmit={finishOnboarding}>
              <button type="submit" className="btn-primary">
                Öppna översikt
              </button>
            </form>
          </section>
        )}
      </div>
    </Shell>
  )
}
