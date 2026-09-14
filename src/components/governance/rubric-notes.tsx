import { InfoTip } from '@/components/info-tip'

/**
 * Notes des rubriques du dossier d'un cas d'usage.
 *
 * Regroupees ici pour une raison : ce sont des textes de gouvernance, relus
 * comme tels, et non des chaines eparpillees dans des composants d'affichage.
 * Chacune repond aux deux memes questions — a quoi sert cette rubrique, et
 * qu'est-ce qu'on s'y trompe le plus souvent.
 */

function Note({ label, title, children }: { label: string; title: string; children: React.ReactNode }) {
  return (
    <InfoTip label={label} title={title}>
      <div className="flex flex-col gap-3 text-sm leading-relaxed text-ink-600">{children}</div>
    </InfoTip>
  )
}

export function TriageNote() {
  return (
    <Note label="À quoi sert le triage" title="Trier avant d’instruire">
      <p>
        Le triage fixe la <strong className="font-medium text-ink-800">criticité retenue</strong> :
        l’effort d’instruction que ce cas d’usage mérite. Tous ne valent pas une évaluation
        d’impact complète, et consacrer le même temps à un correcteur orthographique qu’à un
        scoring de candidatures dilue l’attention là où elle compte.
      </p>
      <p>
        Elle fixe aussi la <strong className="font-medium text-ink-800">date de prochaine revue</strong>.
        Sans elle, rien ne fait remonter le dossier : il dort jusqu’à l’incident.
      </p>
    </Note>
  )
}

export function ClassificationNote() {
  return (
    <Note
      label="À quoi sert la pré-classification"
      title="Une pré-classification, pas un avis juridique"
    >
      <p>
        Elle situe le cas d’usage au regard du règlement : quel{' '}
        <strong className="font-medium text-ink-800">rôle</strong> l’organisation y tient —
        fournisseur, déployeur, importateur — et quelles{' '}
        <strong className="font-medium text-ink-800">obligations</strong> sont à examiner. Elle
        oriente le niveau de revue nécessaire ; elle ne conclut pas à la conformité.
      </p>
      <p>
        <strong className="font-medium text-ink-800">« Haut risque » n’est pas un niveau de
        risque.</strong> C’est une catégorie de système au sens du règlement, qui déclenche des
        obligations — documentation technique, contrôle humain, journalisation. La cotation d’un
        risque, elle, se fait dans la rubrique Risques, par vraisemblance et gravité. Les deux se
        ressemblent et ne disent pas la même chose.
      </p>
      <p>
        La version du référentiel est conservée avec la qualification : les échéances évoluent, et
        une qualification datée reste lisible après un report.
      </p>
    </Note>
  )
}

export function RiskNote() {
  return (
    <Note label="À quoi sert le registre des risques" title="Coter, traiter, ou assumer">
      <p>
        Un risque se cote par{' '}
        <strong className="font-medium text-ink-800">vraisemblance × gravité</strong> — le niveau
        n’est pas saisi, pour qu’il ne puisse pas diverger de sa cotation. Le niveau{' '}
        <em>brut</em> est celui d’avant traitement ; le <em>résiduel</em> n’apparaît qu’une fois le
        risque recoté.
      </p>
      <p>
        Deux réponses, et deux seulement : <strong className="font-medium text-ink-800">traiter</strong>,
        en désignant le contrôle qui exécute la mesure, ou{' '}
        <strong className="font-medium text-ink-800">accepter</strong>, ce qui engage nominativement
        et exige une justification et une date de revue. Un risque ni traité ni accepté bloque le
        passage en production s’il est élevé ou critique — et passe inaperçu s’il ne l’est pas.
      </p>
    </Note>
  )
}

export function ImpactNote() {
  return (
    <Note label="À quoi sert l’évaluation d’impact" title="Ce que le système fait aux personnes">
      <p>
        L’évaluation d’impact (ISO/IEC 42005) regarde les effets sur les personnes, les groupes et
        la société — pas la sécurité du système. Un système parfaitement fiable peut avoir un
        impact inacceptable, et c’est précisément ce que cette rubrique cherche.
      </p>
      <p>
        Elle s’articule avec l’analyse d’impact RGPD sans s’y substituer : quand des données
        personnelles sont en jeu, l’AIPD reste due et sa référence se consigne ici.
      </p>
    </Note>
  )
}

export function OversightNote() {
  return (
    <Note label="À quoi sert la supervision humaine" title="Qui peut arrêter le système">
      <p>
        Le règlement exige un contrôle humain effectif (article 14). « Effectif » veut dire qu’une
        personne identifiée peut <strong className="font-medium text-ink-800">interrompre</strong>{' '}
        le système, sait à quels signaux intervenir, et dispose d’un mode de repli documenté.
      </p>
      <p>
        Une supervision qui se contente d’un humain « dans la boucle » sans déclencheur ni
        procédure d’arrêt ne se démontre pas devant un auditeur.
      </p>
    </Note>
  )
}

export function DecisionNote() {
  return (
    <Note label="À quoi sert le registre de décisions" title="Qui a décidé quoi, et sous quelles conditions">
      <p>
        C’est la pièce qu’un auditeur ouvre en premier : autorisation d’usage, mise en production,
        acceptation de risque, exception, suspension, retrait. Chaque décision porte un approbateur
        humain, une justification, une date d’effet et — pour les plus engageantes — une date de
        revue.
      </p>
      <p>
        <strong className="font-medium text-ink-800">Aucune approbation automatique</strong>, et
        l’auteur d’une décision de mise en production ou d’acceptation de risque ne peut pas
        l’approuver lui-même. La base le refuse, pas l’écran.
      </p>
    </Note>
  )
}

export function ChangeNote() {
  return (
    <Note label="À quoi servent les changements" title="Ce qui rouvre l’évaluation">
      <p>
        Un modèle change, l’autonomie augmente, la finalité évolue : le moteur qualifie le
        changement et rouvre ce qui doit l’être. Une gouvernance qui ne réévalue pas devient une
        photographie datée.
      </p>
      <p>
        Le verdict du moteur est une proposition ; le verdict final reste humain, et l’écart entre
        les deux se lit ici.
      </p>
    </Note>
  )
}

export function GateNote() {
  return (
    <Note label="À quoi sert le gate" title="Huit préconditions, évaluées en continu">
      <p>
        Le gate n’est pas un bouton : il est évalué en permanence et ne déclenche aucune
        transition. Il dit, à tout moment, ce qui manquerait si l’on demandait le passage en
        production.
      </p>
      <p>
        Le refus est prononcé <strong className="font-medium text-ink-800">côté serveur</strong>,
        motivé précondition par précondition, et journalisé au même titre qu’une autorisation. Un
        refus est un fait de gouvernance, pas une erreur de saisie.
      </p>
    </Note>
  )
}

export function ControlNote() {
  return (
    <Note label="À quoi sert l’applicabilité" title="Applicable, exclu, mais jamais vide">
      <p>
        Statuer l’applicabilité d’un contrôle à ce cas d’usage est un acte de gouvernance :{' '}
        <strong className="font-medium text-ink-800">applicable</strong>,{' '}
        <strong className="font-medium text-ink-800">non applicable</strong> — et alors motivé — ou{' '}
        <strong className="font-medium text-ink-800">à déterminer</strong>. Un « non applicable »
        silencieux est ce qu’un auditeur relève en premier.
      </p>
      <p>
        Le gate PRODUCTION exige que tout contrôle obligatoire applicable soit affecté et opérant.
        Laisser un contrôle obligatoire « à déterminer » bloque donc la mise en service.
      </p>
    </Note>
  )
}

export function ActionNote() {
  return (
    <Note label="À quoi servent les actions" title="Ce qui reste à faire, et par qui">
      <p>
        Une action porte un responsable et une échéance. Celles marquées{' '}
        <strong className="font-medium text-ink-800">bloquantes</strong> empêchent le passage en
        production tant qu’elles sont ouvertes — c’est l’une des huit préconditions du gate.
      </p>
      <p>
        Les actions échues remontent au pilotage : une action sans échéance ne remonte jamais.
      </p>
    </Note>
  )
}

export function AuditNote() {
  return (
    <Note label="À quoi sert le journal" title="Une trace qui ne se réécrit pas">
      <p>
        Le journal consigne les opérations sensibles : transitions, refus de gate, acceptations de
        risque, validations de preuve, décisions. Il est{' '}
        <strong className="font-medium text-ink-800">append-only</strong> — un déclencheur en base
        rejette toute modification ou suppression, y compris par l’administration.
      </p>
      <p>
        C’est ce qui permet de reconstituer un dossier après coup, y compris les refus : un refus
        motivé y figure au même titre qu’une autorisation.
      </p>
    </Note>
  )
}
