import { translations, type Language } from './translations.ts';
import { localizedDate, localizedNumber } from '../../../lib/locale-format.ts';
import { bookingHistoryNote } from '../../../components/i18n/booking-history-note.ts';
import { interfaceCopy } from '../../../components/i18n/interface-copy.ts';

export type { Language } from './translations.ts';
export type Parameters = Record<string, string | number>;
export const languageNames: Record<Language, string> = { fr: 'Français', en: 'English', km: 'ខ្មែរ' };
const serverErrorSources: Record<string, string> = {
  'APPROVED': 'Approuvée',
  'PENDING': 'En attente',
  'REJECTED': 'Refusée',
  'SMALL': 'Petit circuit',
  'GRAND': 'Grand circuit',
  'REMOTE': 'Éloigné',
  'CASH': 'Espèces',
  'CARD': 'Carte',
  'OTHER': 'Autre',
  'DRIVER': 'Chauffeur',
  'ONLINE': 'En ligne',
  'SUSPENDED': 'Suspendu',
  'Invalid credentials': 'Email ou mot de passe incorrect.',
  'Customer access required': 'Connectez-vous avec un compte client.',
  'Driver access required': 'Connectez-vous avec un compte chauffeur.',
  'Unauthorized': 'Veuillez vous reconnecter.',
  'Forbidden': 'Vous n’avez pas la permission d’effectuer cette action.',
  'Network request failed': 'Réseau indisponible. Vérifiez votre connexion.',
  'Failed to fetch': 'Impossible de joindre le serveur. Vérifiez votre connexion.',
  'Sign out before switching accounts': 'Déconnectez-vous avant de changer de compte.',
  'Sign out before registering another account': 'Déconnectez-vous avant de créer un autre compte.',
  'Authentication service unavailable': 'Le service de connexion est indisponible.',
  'Registration service unavailable': 'Le service d’inscription est indisponible.',
  'A valid name, email and password of 8 to 128 characters are required': 'Renseignez un nom, un email valide et un mot de passe de 8 à 128 caractères.',
  'Only customer registration is allowed': 'Seule l’inscription client est autorisée.',
  'An account already exists for this email': 'Un compte existe déjà pour cet email.',
  'Sign out unavailable; please retry': 'La déconnexion est indisponible. Réessayez.',
  'Unable to update account': 'Impossible de modifier le compte.',
  'Invalid availability request': 'Demande de disponibilité invalide.',
  'Availability changed; refresh and retry': 'La disponibilité a changé. Actualisez et réessayez.',
  'Driver profile not found': 'Profil chauffeur introuvable.',
  'Availability service unavailable': 'Le service de disponibilité est indisponible.',
  'Place history unavailable': 'L’historique des adresses est indisponible.',
  'PRO_APPROVAL_REQUIRED': 'Votre compte doit être approuvé avant de réserver.',
  'PRO_PASSENGER_REQUIRED': 'Le nom du passager est obligatoire pour un compte professionnel.',
  'Invalid trip quote; calculate a new route': 'Recalculez le trajet : devis absent ou expiré.',
  'Trip quote expired; calculate a new route': 'Recalculez le trajet : devis absent ou expiré.',
  'Vehicle category changed; calculate a new quote': 'Recalculez le trajet : devis absent ou expiré.',
  'Vehicle already in use': 'Ce véhicule est déjà utilisé.',
  'Finish the current trip first': 'Terminez d’abord la course actuelle.',
  'Driver or vehicle already reserved for this time': 'Le chauffeur ou le véhicule est déjà réservé à cette heure.',
  'Select an active vehicle': 'Choisissez un véhicule actif.',
  'Select an active vehicle with enough seats': 'Choisissez un véhicule actif avec assez de places.',
  'Invalid vehicle capacity': 'La capacité du véhicule est invalide.',
  'Driver must be available': 'Le chauffeur doit être disponible.',
  'Select an active, available driver': 'Choisissez un chauffeur actif et disponible.',
  'Select an existing active customer': 'Choisissez un compte client actif existant.',
  'Select an active customer': 'Choisissez un compte client actif existant.',
  'Outside-zone trips require an agreed price and reason': 'Le tarif hors zone nécessite un prix convenu et un motif.',
  'Airport transfers cannot exceed USD 30': 'Le tarif aéroport ne peut pas dépasser 30 USD.',
  'A closed booking cannot be modified': 'Une course clôturée ne peut pas être modifiée.',
  'A paid or processing fare cannot be changed': 'Un tarif payé ou en cours de paiement ne peut pas être modifié.',
  'Payment already started; administrator review required': 'Le paiement a commencé. Contactez l’administration.',
  'Pickup must be in the future': 'Choisissez une prise en charge dans le futur.',
  'Booking service unavailable': 'Le service de réservation est indisponible.',
};
let language: Language = 'fr';
const listeners = new Set<() => void>();

export function isLanguage(value: unknown): value is Language {
  return value === 'fr' || value === 'en' || value === 'km';
}
export const getLanguage = () => language;
export const subscribeLanguage = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export function changeLanguage(value: Language) {
  language = value;
  listeners.forEach(listener => listener());
}
export function translate(value: string, selected: Language, parameters: Parameters = {}) {
  const source = Object.hasOwn(serverErrorSources, value) ? serverErrorSources[value] : value;
  const entry = Object.hasOwn(translations, source) ? translations[source as keyof typeof translations] : undefined;
  if (!entry) return value;
  const translated = selected === 'fr' ? source : entry[selected === 'en' ? 0 : 1];
  return translated.replace(/\{(\w+)\}/g, (placeholder, key: string) => {
    if (!Object.hasOwn(parameters, key)) throw new Error(`Missing translation parameter: ${key}`);
    return String(parameters[key]);
  });
}
export function t(value: string, parameters?: Parameters) {
  return translate(value, language, parameters);
}
export function formatMoney(cents: number, currency = 'USD', selected = language) {
  return localizedNumber(selected, { style: 'currency', currency }).format(cents / 100);
}
export function formatDateTime(value: string, selected = language) {
  return localizedDate(selected, {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Phnom_Penh',
  }).format(new Date(value));
}
export function formatHistoryNote(value: string | null, selected = language) {
  return bookingHistoryNote(value, key => interfaceCopy[selected][key], cents => formatMoney(cents, 'USD', selected));
}
