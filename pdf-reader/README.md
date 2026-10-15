# 📱 Lettore PDF Libero

Un'applicazione per Android e Web per leggere documenti PDF **100% gratuita, senza pubblicità, senza tracciamento e completamente funzionante offline**.

---

## 🌟 Caratteristiche Principali

- **🚫 Zero Pubblicità & Zero Tracciamento:** Nessun banner, popup, abbonamento o telemetria. Nessun dato lascia il tuo dispositivo.
- **⚡ 100% Offline:** Funziona anche senza connessione internet o in modalità aereo grazie al Service Worker integrato.
- **📚 Memoria Recenti & Segnalibro Automatico:** Salva i tuoi documenti in memoria locale (IndexedDB) e ricorda sempre l'ultima pagina letta.
- **🎨 Modalità di Lettura:**
  - ☀️ **Giorno:** visualizzazione ad alto contrasto nitida.
  - 🌙 **Notte:** inverte delicatamente i colori per non affaticare gli occhi al buio.
  - 📜 **Seppia:** tonalità calda in stile libro cartaceo.
- **👆 Gestures & Mobile Friendly:**
  - **Swipe touch** orizzontale per cambiare pagina.
  - **Tocca al centro** per mostrare o nascondere le barre degli strumenti a schermo intero.
  - **Zoom e Adatta larghezza** per una leggibilità perfetta su qualsiasi schermo Android.
  - **Slider rapido** e salto diretto al numero di pagina.

---

## 🚀 Come provarla subito

1. Apri un terminale nella cartella del progetto:
   ```powershell
   cd C:\Users\mross\.gemini\antigravity\scratch\pdf-reader
   ```
2. Avvia il server locale integrato:
   ```bash
   node server.js
   ```
3. Il server mostrerà due indirizzi:
   - `http://localhost:3000` (per aprirla dal tuo PC)
   - `http://192.168.x.x:3000` (per aprirla dal tuo smartphone Android)

---

## 📲 Come installarla sul tuo telefono Android

1. Assicurati che il tuo telefono Android sia connesso alla **stessa rete Wi-Fi** del tuo computer.
2. Apri **Chrome** (o un altro browser) sul telefono e digita l'indirizzo mostrato dal server (es. `http://192.168.1.xxx:3000`).
3. Tocca i tre puntini del browser in alto a destra (**⋮**) e premi:
   - **"Installa app"** oppure **"Aggiungi a schermata Home"**.
4. L'app verrà installata direttamente nel cassetto delle tue app con l'icona rossa dedicata e si aprirà a schermo intero come una normale app nativa, memorizzando i tuoi PDF anche offline!

---

## 📦 Come creare un file APK nativo (Opzionale)

Se desideri generare un file `.apk` tradizionale da installare via sideloading:
1. **Con PWABuilder (Il modo più veloce, senza installare nulla):**
   - Carica la cartella su GitHub Pages o su un hosting gratuito HTTPS (es. Vercel, Netlify).
   - Inserisci il link su [PWABuilder.com](https://www.pwabuilder.com).
   - Clicca su **Package for Android** per scaricare direttamente il pacchetto APK / AAB.
2. **Con Capacitor:**
   - Inizializza Capacitor: `npm init @capacitor/app`
   - Aggiungi la piattaforma Android: `npx cap add android`
   - Compila con Android Studio per generare l'APK.
