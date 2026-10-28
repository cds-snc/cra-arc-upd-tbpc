/**
 * WCAG 2.2 Level A/AA success criteria that axe-core has no rule for, so they can
 * only be verified by a person. Derived by subtracting the criteria our rule set
 * tags (22 of 55) from the Recommendation's A/AA criteria, not hand-curated.
 *
 * Titles are quoted from W3C: the English Recommendation (w3.org/TR/WCAG22/) and the
 * authorized French translation published 2025-03-17 (w3.org/Translations/WCAG22-fr/).
 * They are normative wording — do not reword them to match house style.
 */
export type ManualCriterion = {
  num: string;
  level: 'A' | 'AA';
  slug: string;
  en: string;
  fr: string;
};

export const WCAG_AA_CRITERIA_COUNT = 55;

export const AUTOMATED_CRITERIA_COUNT = 22;

export const MANUAL_CRITERIA: readonly ManualCriterion[] = [
  {
    num: '1.2.1',
    level: 'A',
    slug: 'audio-only-and-video-only-prerecorded',
    en: 'Audio-only and Video-only (Prerecorded)',
    fr: 'Contenus seulement audio et seulement vidéo (pré-enregistrés)',
  },
  {
    num: '1.2.3',
    level: 'A',
    slug: 'audio-description-or-media-alternative-prerecorded',
    en: 'Audio Description or Media Alternative (Prerecorded)',
    fr: 'Audio-description ou version de remplacement pour un média temporel (pré-enregistré)',
  },
  {
    num: '1.2.4',
    level: 'AA',
    slug: 'captions-live',
    en: 'Captions (Live)',
    fr: 'Sous-titres (en direct)',
  },
  {
    num: '1.2.5',
    level: 'AA',
    slug: 'audio-description-prerecorded',
    en: 'Audio Description (Prerecorded)',
    fr: 'Audio-description (pré-enregistrée)',
  },
  {
    num: '1.3.2',
    level: 'A',
    slug: 'meaningful-sequence',
    en: 'Meaningful Sequence',
    fr: 'Ordre séquentiel logique',
  },
  {
    num: '1.3.3',
    level: 'A',
    slug: 'sensory-characteristics',
    en: 'Sensory Characteristics',
    fr: 'Caractéristiques sensorielles',
  },
  {
    num: '1.4.5',
    level: 'AA',
    slug: 'images-of-text',
    en: 'Images of Text',
    fr: 'Texte sous forme d’image',
  },
  {
    num: '1.4.10',
    level: 'AA',
    slug: 'reflow',
    en: 'Reflow',
    fr: 'Redistribution',
  },
  {
    num: '1.4.11',
    level: 'AA',
    slug: 'non-text-contrast',
    en: 'Non-text Contrast',
    fr: 'Contraste du contenu non textuel',
  },
  {
    num: '1.4.13',
    level: 'AA',
    slug: 'content-on-hover-or-focus',
    en: 'Content on Hover or Focus',
    fr: 'Contenu au survol ou au focus',
  },
  {
    num: '2.1.2',
    level: 'A',
    slug: 'no-keyboard-trap',
    en: 'No Keyboard Trap',
    fr: 'Pas de piège au clavier',
  },
  {
    num: '2.1.4',
    level: 'A',
    slug: 'character-key-shortcuts',
    en: 'Character Key Shortcuts',
    fr: 'Raccourcis clavier utilisant des caractères',
  },
  {
    num: '2.3.1',
    level: 'A',
    slug: 'three-flashes-or-below-threshold',
    en: 'Three Flashes or Below Threshold',
    fr: 'Pas plus de trois flashs ou sous le seuil critique',
  },
  {
    num: '2.4.3',
    level: 'A',
    slug: 'focus-order',
    en: 'Focus Order',
    fr: 'Parcours du focus',
  },
  {
    num: '2.4.5',
    level: 'AA',
    slug: 'multiple-ways',
    en: 'Multiple Ways',
    fr: 'Accès multiples',
  },
  {
    num: '2.4.6',
    level: 'AA',
    slug: 'headings-and-labels',
    en: 'Headings and Labels',
    fr: 'En-têtes et étiquettes',
  },
  {
    num: '2.4.7',
    level: 'AA',
    slug: 'focus-visible',
    en: 'Focus Visible',
    fr: 'Visibilité du focus',
  },
  {
    num: '2.4.11',
    level: 'AA',
    slug: 'focus-not-obscured-minimum',
    en: 'Focus Not Obscured (Minimum)',
    fr: 'Focus non masqué (minimum)',
  },
  {
    num: '2.5.1',
    level: 'A',
    slug: 'pointer-gestures',
    en: 'Pointer Gestures',
    fr: 'Gestes pour le contrôle du pointeur',
  },
  {
    num: '2.5.2',
    level: 'A',
    slug: 'pointer-cancellation',
    en: 'Pointer Cancellation',
    fr: 'Annulation de l’action du pointeur',
  },
  {
    num: '2.5.4',
    level: 'A',
    slug: 'motion-actuation',
    en: 'Motion Actuation',
    fr: 'Activation par le mouvement',
  },
  {
    num: '2.5.7',
    level: 'AA',
    slug: 'dragging-movements',
    en: 'Dragging Movements',
    fr: 'Mouvements de glissement',
  },
  {
    num: '3.2.1',
    level: 'A',
    slug: 'on-focus',
    en: 'On Focus',
    fr: 'Au focus',
  },
  {
    num: '3.2.2',
    level: 'A',
    slug: 'on-input',
    en: 'On Input',
    fr: 'À la saisie',
  },
  {
    num: '3.2.3',
    level: 'AA',
    slug: 'consistent-navigation',
    en: 'Consistent Navigation',
    fr: 'Navigation cohérente',
  },
  {
    num: '3.2.4',
    level: 'AA',
    slug: 'consistent-identification',
    en: 'Consistent Identification',
    fr: 'Identification cohérente',
  },
  {
    num: '3.2.6',
    level: 'A',
    slug: 'consistent-help',
    en: 'Consistent Help',
    fr: 'Aide cohérente',
  },
  {
    num: '3.3.1',
    level: 'A',
    slug: 'error-identification',
    en: 'Error Identification',
    fr: 'Identification des erreurs',
  },
  {
    num: '3.3.3',
    level: 'AA',
    slug: 'error-suggestion',
    en: 'Error Suggestion',
    fr: 'Suggestion après une erreur',
  },
  {
    num: '3.3.4',
    level: 'AA',
    slug: 'error-prevention-legal-financial-data',
    en: 'Error Prevention (Legal, Financial, Data)',
    fr: 'Prévention des erreurs (juridiques, financières, de données)',
  },
  {
    num: '3.3.7',
    level: 'A',
    slug: 'redundant-entry',
    en: 'Redundant Entry',
    fr: 'Saisie redondante',
  },
  {
    num: '3.3.8',
    level: 'AA',
    slug: 'accessible-authentication-minimum',
    en: 'Accessible Authentication (Minimum)',
    fr: 'Authentification accessible (minimum)',
  },
  {
    num: '4.1.3',
    level: 'AA',
    slug: 'status-messages',
    en: 'Status Messages',
    fr: 'Messages d’état',
  },
];
