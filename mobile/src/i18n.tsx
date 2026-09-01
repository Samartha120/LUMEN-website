import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";

/**
 * Three languages, no library.
 *
 * A civic app for an Indian city that only speaks English excludes most of the
 * people who trip over the manhole. The three here cover the demonstration
 * city; adding a fourth is one more object in DICT, and the type system will
 * name every string that is missing from it.
 *
 * i18next and its react bindings would be about 60 kB of dependency to look a
 * string up in an object. What they buy — plurals, interpolation, namespaces,
 * lazy loading — is worth having in an app with thousands of strings. This one
 * has a hundred and forty.
 */

export const LANGUAGES = {
  en: "English",
  hi: "हिन्दी",
  kn: "ಕನ್ನಡ",
} as const;

export type Lang = keyof typeof LANGUAGES;

const en = {
  // --- shell
  "app.name": "LUMEN",
  "tab.home": "Home",
  "tab.impact": "Impact",
  "tab.updates": "Updates",
  "tab.profile": "Profile",
  "tab.queue": "Queue",
  "tab.ops": "Ops",
  "tab.ask": "Ask",

  // --- sign in
  "auth.tagline": "Report civic damage in your city",
  "auth.welcome": "Welcome back",
  "auth.welcomeSub": "Sign in to file and follow your reports.",
  "auth.create": "Create an account",
  "auth.createSub": "Takes a moment. You only need an email.",
  "auth.name": "Name",
  "auth.namePlaceholder": "Your name",
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
  "onboard.1.body": "A pothole, a garbage pile, an open manhole. One picture is all a report needs — you do not have to pick a category or a department.",
  "onboard.2.title": "See what the model sees",
  "onboard.2.body": "The detector outlines the damage and scores how serious it is, before you file. If the photo is not good enough, you will know while you are still standing there.",
  "onboard.3.title": "Follow it to Resolved",
  "onboard.3.body": "Your report is routed to the right department automatically. You will see it move from Filed to In progress to Resolved, and hear about it each time.",

  // --- home
  "home.morning": "Good morning",
  "home.afternoon": "Good afternoon",
  "home.evening": "Good evening",
  "home.latest": "Latest report",
  "home.glance": "At a glance",
  "home.all": "All reports",
  "home.stillOpen": "of your {total} reports still being worked on",
  "home.resolvedForYou": "Resolved for you",
  "home.waitingToSend": "Waiting to send — saved on this phone",
  "home.markedUrgent": "Marked urgent by the detector",
  "home.search": "Search your reports",
  "home.filterAll": "All",
  "home.filterOpen": "Open",
  "home.filterResolved": "Resolved",
  "home.emptyTitle": "No reports yet",
  "home.emptyBody": "Photograph a pothole, a garbage pile or an open manhole and it will appear here.",
  "home.noMatchTitle": "Nothing matches",
  "home.noMatchBody": "Try a different search, or clear the filter.",

  // --- report
  "report.title": "Report a problem",
  "report.sub": "The class, severity and department come from your photograph.",
  "report.step": "Step {n} of 3",
  "report.step1": "Photograph",
  "report.step2": "Describe",
  "report.step3": "Submit",
  "report.take": "Take photo",
  "report.add": "Add photo",
  "report.gallery": "From gallery",
  "report.counter": "{n} of {max} · the first is used for classification",
  "report.check": "Check what the AI sees",
  "report.what": "What is the problem?",
  "report.placeholder": "e.g. Deep pothole outside the school gate",
  "report.locationOn": "Location attached",
  "report.locationOff": "Add your location",
  "report.locationHint": "Routes it to the right ward",
  "report.useGps": "Use GPS",
  "report.update": "Update",
  "report.submit": "Submit report",
  "report.analysing": "Analysing the photograph…",
  "report.needPhoto": "A photograph is required — the class and severity come from it.",
  "report.needTitle": "Please describe what you are reporting.",
  "report.filed": "Report filed",
  "report.filedBody": "Your report was received as {ref}.",
  "report.savedOffline": "Saved — you are offline",
  "report.dupTitle": "Reported — already known",

  // --- ai preview
  "preview.notCivic": "Not a road or civic area",
  "preview.nothing": "Nothing detected",
  "preview.nothingBody": "Move closer, or let the damage fill more of the frame. You can still file it — a supervisor will triage it by hand.",
  "preview.found": "{n} region(s) found",
  "preview.severity": "Severity {n} / 100",
  "preview.notFiled": "Nothing has been filed yet.",

  // --- detail
  "detail.back": "My reports",
  "detail.found": "What the model found",
  "detail.nothing": "Nothing was detected in this photograph. A supervisor will triage it by hand.",
  "detail.severity": "Severity",
  "detail.progress": "Progress",
  "detail.openMaps": "Open in Maps",
  "detail.outlined": "outlined",
  "detail.boxed": "boxed",

  // --- stages
  "stage.filed": "Filed",
  "stage.progress": "In progress",
  "stage.resolved": "Resolved",

  // --- updates
  "alerts.title": "Updates",
  "alerts.unread": "{n} unread",
  "alerts.caughtUp": "All caught up",
  "alerts.markAll": "Mark all read",
  "alerts.emptyTitle": "No updates yet",
  "alerts.emptyBody": "When a department picks up or resolves one of your reports, it appears here.",

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
  "impact.foot": "These are your reports only. City-wide figures belong to the supervisor console, not to a resident's phone.",
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
  "outbox.count": "{n} report(s) saved on this phone",
  "outbox.offline": "you are offline",
  "outbox.nothing": "Nothing is waiting",
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
  "common.couldNotLoad": "Could not load",
  "common.retry": "Try again",
};

type Key = keyof typeof en;

// Hindi and Kannada. Written out rather than machine-translated at runtime:
// a civic instruction that is subtly wrong is worse than one in English.
const hi: Record<Key, string> = {
  ...en,
  "auth.tagline": "अपने शहर की नागरिक क्षति की रिपोर्ट करें",
  "auth.welcome": "वापसी पर स्वागत है",
  "auth.welcomeSub": "अपनी रिपोर्ट दर्ज करने और देखने के लिए साइन इन करें।",
  "auth.create": "खाता बनाएँ",
  "auth.createSub": "बस एक मिनट। केवल ईमेल चाहिए।",
  "auth.name": "नाम",
  "auth.namePlaceholder": "आपका नाम",
  "auth.email": "ईमेल",
  "auth.password": "पासवर्ड",
  "auth.signIn": "साइन इन करें",
  "auth.newHere": "नए हैं?",
  "auth.already": "पहले से पंजीकृत हैं?",
  "auth.needBoth": "ईमेल और पासवर्ड आवश्यक हैं।",
  "auth.needName": "कृपया अपना नाम भरें।",
  "auth.failed": "साइन इन विफल रहा।",

  "tab.home": "होम",
  "tab.impact": "प्रभाव",
  "tab.updates": "सूचनाएँ",
  "tab.profile": "प्रोफ़ाइल",

  "onboard.skip": "छोड़ें",
  "onboard.next": "आगे",
  "onboard.start": "शुरू करें",
  "onboard.1.title": "क्षति की फ़ोटो लें",
  "onboard.1.body": "गड्ढा, कचरे का ढेर, या खुला मैनहोल। एक तस्वीर ही काफ़ी है — श्रेणी या विभाग चुनने की ज़रूरत नहीं।",
  "onboard.2.title": "देखें मॉडल क्या देखता है",
  "onboard.2.body": "रिपोर्ट दर्ज करने से पहले ही डिटेक्टर क्षति की रूपरेखा बनाता है और गंभीरता आँकता है।",
  "onboard.3.title": "समाधान तक नज़र रखें",
  "onboard.3.body": "आपकी रिपोर्ट स्वतः सही विभाग को भेजी जाती है, और हर बदलाव की सूचना आपको मिलती है।",

  "home.morning": "सुप्रभात",
  "home.afternoon": "नमस्कार",
  "home.evening": "शुभ संध्या",
  "home.latest": "नवीनतम रिपोर्ट",
  "home.glance": "एक नज़र में",
  "home.all": "सभी रिपोर्ट",
  "home.stillOpen": "आपकी {total} रिपोर्ट में से अभी काम चल रहा है",
  "home.resolvedForYou": "आपके लिए हल हुईं",
  "home.waitingToSend": "भेजने के लिए शेष — इसी फ़ोन में सुरक्षित",
  "home.markedUrgent": "डिटेक्टर ने अत्यावश्यक बताया",
  "home.search": "अपनी रिपोर्ट खोजें",
  "home.filterAll": "सभी",
  "home.filterOpen": "खुली",
  "home.filterResolved": "हल",
  "home.emptyTitle": "अभी कोई रिपोर्ट नहीं",
  "home.emptyBody": "गड्ढे, कचरे या खुले मैनहोल की फ़ोटो लें — वह यहाँ दिखेगी।",

  "report.title": "समस्या दर्ज करें",
  "report.sub": "श्रेणी, गंभीरता और विभाग आपकी तस्वीर से तय होते हैं।",
  "report.take": "फ़ोटो लें",
  "report.add": "और फ़ोटो",
  "report.gallery": "गैलरी से",
  "report.check": "देखें AI क्या देखता है",
  "report.what": "समस्या क्या है?",
  "report.placeholder": "जैसे: स्कूल गेट के बाहर गहरा गड्ढा",
  "report.locationOn": "स्थान जुड़ा",
  "report.locationOff": "स्थान जोड़ें",
  "report.locationHint": "सही वार्ड तक पहुँचाने में मदद करता है",
  "report.useGps": "GPS लें",
  "report.update": "बदलें",
  "report.submit": "रिपोर्ट भेजें",
  "report.analysing": "तस्वीर की जाँच हो रही है…",
  "report.needPhoto": "फ़ोटो आवश्यक है — श्रेणी और गंभीरता उसी से आती है।",
  "report.needTitle": "कृपया बताएँ कि आप क्या दर्ज कर रहे हैं।",
  "report.filed": "रिपोर्ट दर्ज हुई",
  "report.step1": "फ़ोटो",
  "report.step2": "विवरण",
  "report.step3": "भेजें",

  "stage.filed": "दर्ज",
  "stage.progress": "काम जारी",
  "stage.resolved": "हल",

  "detail.back": "मेरी रिपोर्ट",
  "detail.found": "मॉडल को क्या मिला",
  "detail.severity": "गंभीरता",
  "detail.progress": "प्रगति",
  "detail.openMaps": "मैप में खोलें",

  "alerts.title": "सूचनाएँ",
  "alerts.markAll": "सभी पढ़ी हुई",
  "alerts.caughtUp": "सब देख लिया",
  "alerts.emptyTitle": "अभी कोई सूचना नहीं",

  "impact.title": "आपका प्रभाव",
  "impact.whatYouReport": "आप क्या दर्ज करते हैं",
  "impact.whereTheyGot": "वे कहाँ तक पहुँचीं",
  "impact.perMonth": "हर महीने रिपोर्ट",
  "impact.severity": "गंभीरता",

  "profile.language": "भाषा",
  "profile.security": "सुरक्षा",
  "profile.lock": "ऐप लॉक करें",
  "profile.about": "जानकारी",
  "profile.privacy": "निजता",
  "profile.signOut": "साइन आउट",
  "profile.howItWorks": "रिपोर्टिंग कैसे काम करती है",
  "profile.yourReports": "आपकी रिपोर्ट",
  "profile.waiting": "भेजने के लिए शेष",
  "profile.none": "कोई नहीं",

  "outbox.title": "भेजने के लिए शेष",
  "outbox.sendNow": "अभी भेजें",
  "outbox.discard": "हटाएँ",

  "help.title": "रिपोर्टिंग कैसे काम करती है",
  "common.cancel": "रद्द करें",
  "common.couldNotLoad": "लोड नहीं हो सका",
};

const kn: Record<Key, string> = {
  ...en,
  "auth.tagline": "ನಿಮ್ಮ ನಗರದ ನಾಗರಿಕ ಹಾನಿಯನ್ನು ವರದಿ ಮಾಡಿ",
  "auth.welcome": "ಮರಳಿ ಸ್ವಾಗತ",
  "auth.welcomeSub": "ವರದಿ ಸಲ್ಲಿಸಲು ಮತ್ತು ನೋಡಲು ಸೈನ್ ಇನ್ ಮಾಡಿ.",
  "auth.create": "ಖಾತೆ ತೆರೆಯಿರಿ",
  "auth.createSub": "ಒಂದು ಕ್ಷಣ ಸಾಕು. ಇಮೇಲ್ ಮಾತ್ರ ಬೇಕು.",
  "auth.name": "ಹೆಸರು",
  "auth.namePlaceholder": "ನಿಮ್ಮ ಹೆಸರು",
  "auth.email": "ಇಮೇಲ್",
  "auth.password": "ಪಾಸ್‌ವರ್ಡ್",
  "auth.signIn": "ಸೈನ್ ಇನ್",
  "auth.newHere": "ಹೊಸಬರೇ?",
  "auth.already": "ಈಗಾಗಲೇ ನೋಂದಾಯಿತರೇ?",
  "auth.needBoth": "ಇಮೇಲ್ ಮತ್ತು ಪಾಸ್‌ವರ್ಡ್ ಬೇಕು.",
  "auth.needName": "ದಯವಿಟ್ಟು ನಿಮ್ಮ ಹೆಸರು ಬರೆಯಿರಿ.",
  "auth.failed": "ಸೈನ್ ಇನ್ ವಿಫಲವಾಯಿತು.",

  "tab.home": "ಮುಖಪುಟ",
  "tab.impact": "ಪರಿಣಾಮ",
  "tab.updates": "ಸೂಚನೆಗಳು",
  "tab.profile": "ಪ್ರೊಫೈಲ್",

  "onboard.skip": "ಬಿಟ್ಟುಬಿಡಿ",
  "onboard.next": "ಮುಂದೆ",
  "onboard.start": "ಪ್ರಾರಂಭಿಸಿ",
  "onboard.1.title": "ಹಾನಿಯ ಫೋಟೋ ತೆಗೆಯಿರಿ",
  "onboard.1.body": "ಗುಂಡಿ, ಕಸದ ರಾಶಿ ಅಥವಾ ತೆರೆದ ಮ್ಯಾನ್‌ಹೋಲ್. ಒಂದು ಚಿತ್ರ ಸಾಕು — ವರ್ಗ ಅಥವಾ ಇಲಾಖೆ ಆಯ್ಕೆ ಮಾಡಬೇಕಿಲ್ಲ.",
  "onboard.2.title": "ಮಾದರಿ ಏನು ಕಾಣುತ್ತದೆ ನೋಡಿ",
  "onboard.2.body": "ಸಲ್ಲಿಸುವ ಮೊದಲೇ ಡಿಟೆಕ್ಟರ್ ಹಾನಿಯ ಗಡಿ ಎಳೆದು ಗಂಭೀರತೆ ಅಳೆಯುತ್ತದೆ.",
  "onboard.3.title": "ಪರಿಹಾರದವರೆಗೆ ಗಮನಿಸಿ",
  "onboard.3.body": "ನಿಮ್ಮ ವರದಿ ತಾನಾಗಿಯೇ ಸರಿಯಾದ ಇಲಾಖೆಗೆ ಹೋಗುತ್ತದೆ, ಪ್ರತಿ ಬದಲಾವಣೆಯೂ ನಿಮಗೆ ತಿಳಿಯುತ್ತದೆ.",

  "home.morning": "ಶುಭೋದಯ",
  "home.afternoon": "ಶುಭ ಮಧ್ಯಾಹ್ನ",
  "home.evening": "ಶುಭ ಸಂಜೆ",
  "home.latest": "ಇತ್ತೀಚಿನ ವರದಿ",
  "home.glance": "ಒಂದು ನೋಟದಲ್ಲಿ",
  "home.all": "ಎಲ್ಲಾ ವರದಿಗಳು",
  "home.stillOpen": "ನಿಮ್ಮ {total} ವರದಿಗಳಲ್ಲಿ ಇನ್ನೂ ಕೆಲಸ ನಡೆಯುತ್ತಿದೆ",
  "home.resolvedForYou": "ನಿಮಗಾಗಿ ಪರಿಹರಿಸಲಾಗಿದೆ",
  "home.waitingToSend": "ಕಳುಹಿಸಲು ಬಾಕಿ — ಈ ಫೋನಿನಲ್ಲಿ ಉಳಿಸಲಾಗಿದೆ",
  "home.markedUrgent": "ಡಿಟೆಕ್ಟರ್ ತುರ್ತು ಎಂದಿದೆ",
  "home.search": "ನಿಮ್ಮ ವರದಿಗಳನ್ನು ಹುಡುಕಿ",
  "home.filterAll": "ಎಲ್ಲಾ",
  "home.filterOpen": "ತೆರೆದಿದೆ",
  "home.filterResolved": "ಪರಿಹೃತ",
  "home.emptyTitle": "ಇನ್ನೂ ವರದಿಗಳಿಲ್ಲ",
  "home.emptyBody": "ಗುಂಡಿ, ಕಸ ಅಥವಾ ತೆರೆದ ಮ್ಯಾನ್‌ಹೋಲ್ ಫೋಟೋ ತೆಗೆಯಿರಿ — ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತದೆ.",

  "report.title": "ಸಮಸ್ಯೆ ವರದಿ ಮಾಡಿ",
  "report.sub": "ವರ್ಗ, ಗಂಭೀರತೆ ಮತ್ತು ಇಲಾಖೆ ನಿಮ್ಮ ಫೋಟೋದಿಂದ ನಿರ್ಧಾರವಾಗುತ್ತದೆ.",
  "report.take": "ಫೋಟೋ ತೆಗೆಯಿರಿ",
  "report.add": "ಇನ್ನೊಂದು ಫೋಟೋ",
  "report.gallery": "ಗ್ಯಾಲರಿಯಿಂದ",
  "report.check": "AI ಏನು ಕಾಣುತ್ತದೆ ನೋಡಿ",
  "report.what": "ಸಮಸ್ಯೆ ಏನು?",
  "report.placeholder": "ಉದಾ: ಶಾಲೆಯ ಗೇಟ್ ಬಳಿ ಆಳವಾದ ಗುಂಡಿ",
  "report.locationOn": "ಸ್ಥಳ ಸೇರಿಸಲಾಗಿದೆ",
  "report.locationOff": "ಸ್ಥಳ ಸೇರಿಸಿ",
  "report.locationHint": "ಸರಿಯಾದ ವಾರ್ಡ್‌ಗೆ ತಲುಪಿಸಲು ಸಹಾಯ",
  "report.useGps": "GPS ಬಳಸಿ",
  "report.update": "ಬದಲಿಸಿ",
  "report.submit": "ವರದಿ ಕಳುಹಿಸಿ",
  "report.analysing": "ಫೋಟೋ ಪರಿಶೀಲನೆ…",
  "report.needPhoto": "ಫೋಟೋ ಅಗತ್ಯ — ವರ್ಗ ಮತ್ತು ಗಂಭೀರತೆ ಅದರಿಂದಲೇ.",
  "report.needTitle": "ದಯವಿಟ್ಟು ಏನು ವರದಿ ಮಾಡುತ್ತಿದ್ದೀರಿ ಎಂದು ಬರೆಯಿರಿ.",
  "report.filed": "ವರದಿ ಸಲ್ಲಿಕೆಯಾಗಿದೆ",
  "report.step1": "ಫೋಟೋ",
  "report.step2": "ವಿವರ",
  "report.step3": "ಸಲ್ಲಿಸಿ",

  "stage.filed": "ಸಲ್ಲಿಕೆ",
  "stage.progress": "ಕೆಲಸ ನಡೆಯುತ್ತಿದೆ",
  "stage.resolved": "ಪರಿಹೃತ",

  "detail.back": "ನನ್ನ ವರದಿಗಳು",
  "detail.found": "ಮಾದರಿ ಏನು ಕಂಡಿತು",
  "detail.severity": "ಗಂಭೀರತೆ",
  "detail.progress": "ಪ್ರಗತಿ",
  "detail.openMaps": "ನಕ್ಷೆಯಲ್ಲಿ ತೆರೆಯಿರಿ",

  "alerts.title": "ಸೂಚನೆಗಳು",
  "alerts.markAll": "ಎಲ್ಲಾ ಓದಲಾಗಿದೆ",
  "alerts.caughtUp": "ಎಲ್ಲಾ ನೋಡಲಾಗಿದೆ",
  "alerts.emptyTitle": "ಇನ್ನೂ ಸೂಚನೆಗಳಿಲ್ಲ",

  "impact.title": "ನಿಮ್ಮ ಪರಿಣಾಮ",
  "impact.whatYouReport": "ನೀವು ಏನು ವರದಿ ಮಾಡುತ್ತೀರಿ",
  "impact.whereTheyGot": "ಅವು ಎಲ್ಲಿಗೆ ತಲುಪಿವೆ",
  "impact.perMonth": "ತಿಂಗಳಿಗೆ ವರದಿಗಳು",
  "impact.severity": "ಗಂಭೀರತೆ",

  "profile.language": "ಭಾಷೆ",
  "profile.security": "ಭದ್ರತೆ",
  "profile.lock": "ಆ್ಯಪ್ ಲಾಕ್ ಮಾಡಿ",
  "profile.about": "ಮಾಹಿತಿ",
  "profile.privacy": "ಖಾಸಗಿತನ",
  "profile.signOut": "ಸೈನ್ ಔಟ್",
  "profile.howItWorks": "ವರದಿ ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ",
  "profile.yourReports": "ನಿಮ್ಮ ವರದಿಗಳು",
  "profile.waiting": "ಕಳುಹಿಸಲು ಬಾಕಿ",
  "profile.none": "ಯಾವುದೂ ಇಲ್ಲ",

  "outbox.title": "ಕಳುಹಿಸಲು ಬಾಕಿ",
  "outbox.sendNow": "ಈಗ ಕಳುಹಿಸಿ",
  "outbox.discard": "ತೆಗೆದುಹಾಕಿ",

  "help.title": "ವರದಿ ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ",
  "common.cancel": "ರದ್ದುಮಾಡಿ",
  "common.couldNotLoad": "ಲೋಡ್ ಆಗಲಿಲ್ಲ",
};

const DICT: Record<Lang, Record<Key, string>> = { en, hi, kn };
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
      // Fall back to the phone's own language, so a Kannada handset opens in
      // Kannada without anyone being asked to find a setting first.
      const device = Localization.getLocales()[0]?.languageCode as Lang | undefined;
      if (device && device in DICT) setLangState(device);
    })();
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem(LANG_KEY, l).catch(() => {});
  }, []);

  const t = useCallback((key: Key, vars?: Record<string, string | number>) => {
    // Falls through to English for any string not yet translated, which is why
    // hi and kn spread en: a half-finished translation shows English, never a
    // raw key.
    let out = DICT[lang][key] ?? en[key] ?? String(key);
    if (vars) for (const [k, v] of Object.entries(vars)) out = out.replace(`{${k}}`, String(v));
    return out;
  }, [lang]);

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useT() {
  return useContext(I18nContext);
}
