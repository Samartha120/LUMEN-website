import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";

export const LANGUAGES = {
  en: "English",
  hi: "हिन्दी",
  kn: "ಕನ್ನಡ",
  ta: "தமிழ்",
  te: "తెలుగు",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
} as const;

export type Lang = keyof typeof LANGUAGES;

const en = {
  // --- shell & tabs
  "app.name": "LUMEN",
  "tab.home": "Home",
  "tab.tracking": "Live Status",
  "tab.voice": "Voice Report",
  "tab.sos": "Emergency",
  "tab.impact": "Impact",
  "tab.updates": "Updates",
  "tab.profile": "Profile",
  "tab.queue": "Queue",
  "tab.ops": "Ops",
  "tab.ask": "Ask",
  "tab.measure": "Measure",
  "tab.verify": "Verify",

  // --- sign in & auth
  "auth.tagline": "Report civic damage & monitor city repairs in real time",
  "auth.welcome": "Welcome back",
  "auth.welcomeSub": "Sign in to file, discuss, and track civic issues.",
  "auth.create": "Create an account",
  "auth.createSub": "Takes a moment. You only need an email.",
  "auth.name": "Name",
  "auth.namePlaceholder": "Your full name",
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.signIn": "Sign in",
  "auth.newHere": "New here?",
  "auth.already": "Already registered?",
  "auth.needBoth": "Email and password are required.",
  "auth.needName": "Please enter your name.",
  "auth.failed": "Sign-in failed.",
  "auth.unreachable": "Cannot reach the server at {url}.",

  // --- onboarding
  "onboard.skip": "Skip",
  "onboard.next": "Next",
  "onboard.start": "Get started",
  "onboard.1.title": "Photograph the damage",
  "onboard.1.body": "A pothole, a garbage pile, an open manhole. One picture is all a report needs — you do not have to pick a category or department.",
  "onboard.2.title": "AI Computer Vision Detection",
  "onboard.2.body": "The detector outlines the damage and calculates its severity before you file. You see what the city engineer sees in real time.",
  "onboard.3.title": "Track to Verified Closure",
  "onboard.3.body": "Your report is auto-routed to the right department. Follow live dispatch, crew arrival, before/after photos, and earn Civic Karma points.",

  // --- home
  "home.morning": "Good morning",
  "home.afternoon": "Good afternoon",
  "home.evening": "Good evening",
  "home.latest": "Latest report",
  "home.glance": "At a glance",
  "home.all": "All reports",
  "home.stillOpen": "of your {total} reports still being worked on",
  "home.resolvedForYou": "Resolved for you",
  "home.waitingToSend": "Waiting to send — saved offline on phone",
  "home.markedUrgent": "Marked urgent by AI detector",
  "home.search": "Search your reports & tickets",
  "home.filterAll": "All",
  "home.filterOpen": "Open",
  "home.filterResolved": "Resolved",
  "home.emptyTitle": "No reports yet",
  "home.emptyBody": "Photograph a pothole, a garbage pile, or an open manhole and it will appear here.",
  "home.noMatchTitle": "Nothing matches",
  "home.noMatchBody": "Try a different search, or clear the filter.",

  // --- report & multimodal
  "report.title": "Report Civic Problem",
  "report.sub": "The class, severity, and department come directly from your photograph.",
  "report.step": "Step {n} of 3",
  "report.step1": "Photograph",
  "report.step2": "Describe",
  "report.step3": "Submit",
  "report.take": "Take photo",
  "report.add": "Add photo",
  "report.gallery": "From gallery",
  "report.counter": "{n} of {max} · first photo is used for AI classification",
  "report.check": "Inspect AI detection",
  "report.what": "What is the problem?",
  "report.placeholder": "e.g. Deep 15cm pothole near the school crossroad",
  "report.locationOn": "Location attached",
  "report.locationOff": "Add your location",
  "report.locationHint": "Routes it automatically to the right ward",
  "report.useGps": "Use GPS coordinates",
  "report.update": "Update",
  "report.submit": "Submit Report",
  "report.analysing": "Analysing photograph with AI...",
  "report.needPhoto": "A photograph is required — class and severity are extracted from it.",
  "report.needTitle": "Please describe what you are reporting.",
  "report.filed": "Report filed successfully",
  "report.filedBody": "Your report was received as {ref}.",
  "report.savedOffline": "Saved locally — you are currently offline",
  "report.dupTitle": "Reported — already tracked in system",

  // --- ai preview & detail
  "preview.notCivic": "Not a road or civic hazard",
  "preview.nothing": "Nothing detected",
  "preview.nothingBody": "Move closer, or let the damage fill more of the frame. A supervisor will triage manually.",
  "preview.found": "{n} hazard region(s) detected",
  "preview.severity": "Severity {n} / 100",
  "preview.notFiled": "Nothing has been filed yet.",
  "detail.back": "My reports",
  "detail.found": "What the AI model found",
  "detail.nothing": "Nothing detected in photograph. A supervisor will triage manually.",
  "detail.severity": "Severity Score",
  "detail.progress": "Dispatch & Repair Progress",
  "detail.openMaps": "Open in Maps",
  "detail.outlined": "outlined",
  "detail.boxed": "boxed",

  // --- stages
  "stage.filed": "Filed",
  "stage.progress": "In progress",
  "stage.resolved": "Resolved",

  // --- updates & notifications
  "alerts.title": "Updates & Notifications",
  "alerts.unread": "{n} unread alerts",
  "alerts.caughtUp": "All caught up",
  "alerts.markAll": "Mark all as read",
  "alerts.emptyTitle": "No updates yet",
  "alerts.emptyBody": "When an engineer is dispatched or resolves your report, you will be notified here.",

  // --- community & karma
  "tracking.title": "Live Status Tracking",
  "sos.title": "Emergency Hazards",

  // --- impact
  "impact.title": "Your impact",
  "impact.sub": "Worked out on this phone from your own reports.",
  "impact.filed": "filed, {pct}% of them resolved",
  "impact.whatYouReport": "What you report",
  "impact.whereTheyGot": "Where they have got to",
  "impact.perMonth": "Reports per month",
  "impact.severity": "Severity",
  "impact.average": "average, out of 100",
  "impact.urgent": "marked urgent",
  "impact.emptyTitle": "Nothing to chart yet",
  "impact.emptyBody": "File a report and this page will show what you have reported and how it is going.",

  // --- profile
  "profile.yourReports": "Your reports",
  "profile.waiting": "Waiting to send",
  "profile.none": "None",
  "profile.howItWorks": "How reporting works",
  "profile.language": "Language",
  "profile.security": "Security",
  "profile.lock": "Lock the app",
  "profile.lockOn": "Ask for your fingerprint or face when the app opens",
  "profile.lockNone": "No fingerprint or face is set up on this phone",
  "profile.about": "About",
  "profile.connectedTo": "Connected to",
  "profile.detection": "Detection",
  "profile.version": "Version",
  "profile.privacy": "Privacy",
  "profile.canSee": "What this app can see",
  "profile.canSeeBody": "Only the reports you filed. The scope is enforced in the database query on the server, not filtered on this phone, so another resident's complaint never leaves it.",
  "profile.signOut": "Sign out",
  "profile.signOutConfirm": "You will need to sign in again to file a report.",

  // --- outbox
  "outbox.title": "Waiting to send",
  "outbox.allSentTitle": "All sent",
  "outbox.allSentBody": "Anything filed without a signal is kept here until it can be delivered.",
  "outbox.sendNow": "Send now",
  "outbox.tryAnyway": "Try anyway",
  "outbox.discard": "Discard",

  // --- help
  "help.title": "How reporting works",
  "help.sub": "Eight things worth knowing before you file.",

  // --- shared
  "common.cancel": "Cancel",
  "common.keep": "Keep",
  "common.couldNotLoad": "Could not load data",
  "common.retry": "Try again",
  "common.save": "Save",
  "common.delete": "Delete",
};

type Key = keyof typeof en;

const hi: Record<Key, string> = {
  ...en,
  "tab.home": "होम",
  "tab.tracking": "लाइव स्थिति",
  "tab.voice": "आवाज़ रिपोर्ट",
  "tab.sos": "आपातकालीन",
  "tab.updates": "सूचनाएँ",
  "tab.profile": "प्रोफ़ाइल",
  "auth.tagline": "अपने शहर की नागरिक समस्याओं की रिपोर्ट करें और लाइव स्थिति देखें",
  "auth.welcome": "वापसी पर स्वागत है",
  "auth.welcomeSub": "अपनी रिपोर्ट दर्ज करने और देखने के लिए साइन इन करें।",
  "auth.create": "खाता बनाएँ",
  "auth.signIn": "साइन इन करें",
  "onboard.1.title": "क्षति की फ़ोटो लें",
  "onboard.1.body": "गड्ढा, कचरे का ढेर, या खुला मैनहोल। एक तस्वीर ही काफ़ी है।",
  "home.morning": "सुप्रभात",
  "home.afternoon": "नमस्कार",
  "home.evening": "शुभ संध्या",
  "home.latest": "नवीनतम रिपोर्ट",
  "home.glance": "एक नज़र में",
  "home.all": "सभी रिपोर्ट",
  "report.title": "समस्या दर्ज करें",
  "report.take": "फ़ोटो लें",
  "report.submit": "रिपोर्ट भेजें",
  "report.filed": "रिपोर्ट सफलतापूर्वक दर्ज हुई",
  "common.cancel": "रद्द करें",
  "common.retry": "पुनः प्रयास करें",
};

const kn: Record<Key, string> = {
  ...en,
  "tab.home": "ಮುಖಪುಟ",
  "tab.tracking": "ಲೈವ್ ಸ್ಥಿತಿ",
  "tab.voice": "ಧ್ವನಿ ವರದಿ",
  "tab.sos": "ತುರ್ತು ಎಚ್ಚರಿಕೆ",
  "tab.updates": "ಸೂಚನೆಗಳು",
  "tab.profile": "ಪ್ರೊಫೈಲ್",
  "auth.tagline": "ನಿಮ್ಮ ನಗರದ ನಾಗರಿಕ ಹಾನಿಯನ್ನು ವರದಿ ಮಾಡಿ ಮತ್ತು ಲೈವ್ ಗಮನಿಸಿ",
  "auth.welcome": "ಮರಳಿ ಸ್ವಾಗತ",
  "auth.create": "ಖಾತೆ ತೆರೆಯಿರಿ",
  "auth.signIn": "ಸೈನ್ ಇನ್",
  "home.morning": "ಶುಭೋದಯ",
  "home.afternoon": "ಶುಭ ಮಧ್ಯಾಹ್ನ",
  "home.evening": "ಶುಭ ಸಂಜೆ",
  "home.latest": "ಇತ್ತೀಚಿನ ವರದಿ",
  "report.title": "ಸಮಸ್ಯೆ ವರದಿ ಮಾಡಿ",
  "report.take": "ಫೋಟೋ ತೆಗೆಯಿರಿ",
  "report.submit": "ವರದಿ ಸಲ್ಲಿಸಿ",
  "common.cancel": "ರದ್ದುಮಾಡಿ",
  "common.retry": "ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ",
};

const ta: Record<Key, string> = {
  ...en,
  "tab.home": "முகப்பு",
  "tab.tracking": "நேரடி நிலை",
  "tab.voice": "குரல் புகார்",
  "tab.sos": "அவசர உதவி",
  "tab.updates": "அறிவிப்புகள்",
  "tab.profile": "சுயவிவரம்",
  "auth.tagline": "நகர சேதங்களை உடனுக்குடன் புகாரளித்து கண்காணிக்கவும்",
  "auth.welcome": "மீண்டும் வருக",
  "auth.signIn": "உள்நுழைக",
  "home.morning": "காலை வணக்கம்",
  "home.afternoon": "மதிய வணக்கம்",
  "home.evening": "மாலை வணக்கம்",
  "report.title": "பிரச்சினையை புகாரளிக்கவும்",
  "report.take": "புகைப்படம் எடுக்கவும்",
  "report.submit": "புகாரை சமர்ப்பிக்கவும்",
  "common.cancel": "ரத்துசெய்",
  "common.retry": "மீண்டும் முயற்சி செய்",
};

const te: Record<Key, string> = {
  ...en,
  "tab.home": "హోమ్",
  "tab.tracking": "లైవ్ స్థితి",
  "tab.voice": "వాయిస్ రిపోర్ట్",
  "tab.sos": "ఎమర్జెన్సీ",
  "tab.updates": "అప్‌డేట్లు",
  "tab.profile": "ప్రొఫైల్",
  "auth.tagline": "మీ నగర సమస్యలను నివేదించి లైవ్ పర్యవేక్షించండి",
  "auth.welcome": "స్వాగతం",
  "auth.signIn": "సైన్ ఇన్",
  "home.morning": "శుభోదయం",
  "home.afternoon": "శుభ మధ్యాహ్నం",
  "home.evening": "శుభ సాయంత్రం",
  "report.title": "సమస్యను నివేదించండి",
  "report.take": "ఫోటో తీయండి",
  "report.submit": "నివేదిక పంపండి",
  "common.cancel": "రద్దు చేయండి",
  "common.retry": "మళ్ళీ ప్రయత్నించండి",
};

const es: Record<Key, string> = {
  ...en,
  "tab.home": "Inicio",
  "tab.tracking": "En Vivo",
  "tab.voice": "Reporte de Voz",
  "tab.sos": "Emergencia",
  "tab.updates": "Alertas",
  "tab.profile": "Perfil",
  "auth.tagline": "Reporta daños cívicos y monitorea reparaciones en tiempo real",
  "auth.welcome": "Bienvenido de nuevo",
  "auth.signIn": "Iniciar sesión",
  "home.morning": "Buenos días",
  "home.afternoon": "Buenas tardes",
  "home.evening": "Buenas noches",
  "report.title": "Reportar un problema",
  "report.take": "Tomar foto",
  "report.submit": "Enviar reporte",
  "common.cancel": "Cancelar",
  "common.retry": "Reintentar",
};

const fr: Record<Key, string> = {
  ...en,
  "tab.home": "Accueil",
  "tab.tracking": "En Direct",
  "tab.voice": "Rapport Vocal",
  "tab.sos": "Urgence",
  "tab.updates": "Alertes",
  "tab.profile": "Profil",
  "auth.tagline": "Signalez les dégradations urbaines et suivez les réparations",
  "auth.welcome": "Bon retour",
  "auth.signIn": "Se connecter",
  "home.morning": "Bonjour",
  "home.afternoon": "Bon après-midi",
  "home.evening": "Bonsoir",
  "report.title": "Signaler un problème",
  "report.take": "Prendre une photo",
  "report.submit": "Soumettre le rapport",
  "common.cancel": "Annuler",
  "common.retry": "Réessayer",
};

const de: Record<Key, string> = {
  ...en,
  "tab.home": "Startseite",
  "tab.tracking": "Live-Status",
  "tab.voice": "Sprachbericht",
  "tab.sos": "Notfall",
  "tab.updates": "Meldungen",
  "tab.profile": "Profil",
  "auth.tagline": "Stadtschäden melden und Reparaturen in Echtzeit verfolgen",
  "auth.welcome": "Willkommen zurück",
  "auth.signIn": "Anmelden",
  "home.morning": "Guten Morgen",
  "home.afternoon": "Guten Tag",
  "home.evening": "Guten Abend",
  "report.title": "Schaden melden",
  "report.take": "Foto aufnehmen",
  "report.submit": "Bericht einreichen",
  "common.cancel": "Abbrechen",
  "common.retry": "Erneut versuchen",
};

const DICT: Record<Lang, Record<Key, string>> = { en, hi, kn, ta, te, es, fr, de };
const LANG_KEY = "lumen_lang";

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: Key, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<Ctx>({
  lang: "en",
  setLang: () => {},
  t: (k) => en[k],
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    (async () => {
      const saved = (await AsyncStorage.getItem(LANG_KEY)) as Lang | null;
      if (saved && saved in DICT) return setLangState(saved);
      const device = Localization.getLocales()[0]?.languageCode as Lang | undefined;
      if (device && device in DICT) setLangState(device);
    })();
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem(LANG_KEY, l).catch(() => {});
  }, []);

  const t = useCallback(
    (key: Key, vars?: Record<string, string | number>) => {
      let out = DICT[lang]?.[key] ?? en[key] ?? String(key);
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          out = out.replace(`{${k}}`, String(v));
        }
      }
      return out;
    },
    [lang]
  );

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useT() {
  return useContext(I18nContext);
}
