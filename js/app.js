// ======================================================
// ⚙️ Application ENSOSP - Mémento IA RCH v4.0 Full
// Caméra & scan basés sur QrScanner (robuste, multi-navigateurs)
// - startCamera() / stopCamera() gèrent l'instance QrScanner
// - "Scanner QR Code" s'assure que le scanner est actif
// - Import d'image via QrScanner.scanImage
// - Lecture JSON → champs + prompt IA → boutons IA (fiabilité)
// ======================================================

(() => {
  const t = (key) => (window.I18N ? I18N.t(key) : key);

  // ==== Références DOM ====
  const videoEl = document.getElementById("camera");
  const cameraBtn = document.getElementById("cameraBtn");
  const scanBtn = document.getElementById("scanBtn");
  const resetBtn = document.getElementById("resetBtn");
  const qrFile = document.getElementById("qrFile");
  const cameraError = document.getElementById("cameraError");
  const successMsg = document.getElementById("successMsg");
  const ficheMeta = document.getElementById("ficheMeta");
  const infosComplementaires = document.getElementById("infosComplementaires");
  const compiledPrompt = document.getElementById("compiledPrompt");
  const iaButtons = document.getElementById("iaButtons");

  // État applicatif
  let state = { qr: null };

  // ------------------------------------------------------
  // Utils affichage
  // ------------------------------------------------------
  const showError = (msg) => {
    if (!cameraError) { alert(msg); return; }
    cameraError.textContent = msg;
    cameraError.classList.remove("hidden");
  };
  const hideError = () => {
    if (cameraError) cameraError.classList.add("hidden");
  };
  const showSuccess = () => {
    if (!successMsg) return;
    successMsg.classList.remove("hidden");
    setTimeout(() => successMsg.classList.add("hidden"), 1500);
  };

  // ------------------------------------------------------
  // Caméra via QrScanner
  // ------------------------------------------------------
async function startCamera() {
  hideError();
  try {
    const QrScanner = window.__QrScanner;
    if (!QrScanner) {
      showError("QrScanner non chargé (vérifie le <script type='module'> dans index.html).");
      return;
    }

    // 1) Pré-permission pour déclencher la pop-up (NotAllowedError si refus)
    const preStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false
    });
    // arrêter immédiatement (on ne l'utilise pas directement avec QrScanner)
    preStream.getTracks().forEach(t => t.stop());

    // 2) Nettoyer une éventuelle instance précédente
    if (window.__scanner) {
      await window.__scanner.stop();
      window.__scanner.destroy();
      window.__scanner = null;
    }

    // 3) Créer le scanner (callback de décodage)
    const scanner = new QrScanner(
      videoEl,
      (result) => {
        const data = result?.data || result;
        if (!data) return;
        stopCamera().finally(() => {
          handleQRContent(data);
          showSuccess();
        });
      },
      { highlightScanRegion: true, highlightCodeOutline: true }
    );

    // 4) Lister les caméras après permission (labels disponibles)
    let backId = null;
    try {
      const cams = await QrScanner.listCameras(true);
      if (Array.isArray(cams) && cams.length) {
        const back = cams.find(c => /back|rear|environment/i.test(c.label)) || cams[0];
        backId = back.id;
      }
    } catch (_) { /* on tolère l'échec, on démarrera sans id */ }

    // 5) Démarrer le scanner (avec deviceId si dispo)
    if (backId) { await scanner.start(backId); }
    else        { await scanner.start(); }

    window.__scanner = scanner;
    console.log("📷 Caméra activée (pré-permission OK, QrScanner démarré).");
  } catch (e) {
    // Affiche l’erreur réelle (NotAllowedError, NotFoundError, etc.)
    const msg = e && e.message ? e.message : String(e);
    showError("Impossible d'accéder à la caméra : " + msg);
    console.error("startCamera error:", e);
  }
}

async function stopCamera() {
  try {
    if (window.__scanner) {
      await window.__scanner.stop();
      window.__scanner.destroy();
      window.__scanner = null;
      console.log("📷 Caméra arrêtée.");
    }
  } catch (e) {
    console.warn("Erreur à l'arrêt caméra:", e);
  }
}


  // Bouton "Scanner QR Code" : s'assurer que le scanner tourne
  async function detectQRCode() {
    if (!window.__scanner) {
      await startCamera();
    } else {
      // Si déjà actif, on ne fait rien : le callback décodera dès lecture
      console.log("🔎 Scan en cours...");
    }
  }

  // ------------------------------------------------------
  // Import d'image (fallback salle / fichier)
  // ------------------------------------------------------
  qrFile.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const QrScanner = window.__QrScanner;
      if (!QrScanner) {
        showError("QrScanner non chargé (import image indisponible).");
        return;
      }
      const res = await QrScanner.scanImage(file, { returnDetailedScanResult: true });
      const data = res?.data || res;
      if (!data) return showError(t("noQrInImage"));
      handleQRContent(data);
      showSuccess();
    } catch {
      showError(t("noQrInImage"));
    }
  });

  // ------------------------------------------------------
  // Lecture et interprétation du QR JSON (schéma fiche)
  // ------------------------------------------------------
  function handleQRContent(raw) {
    let jsonStr = (raw || "").trim();
    try {
      if (jsonStr.startsWith("data:application/json")) {
        jsonStr = atob(jsonStr.split(",")[1]); // QR encodé en data:URI base64
      }
      const obj = JSON.parse(jsonStr);
      state.qr = obj;
      updateInterface();
    } catch (err) {
      console.error("QR/JSON invalide:", err);
      showError("QR invalide ou JSON mal formé.");
    }
  }

  function updateInterface() {
    if (!state.qr) return;
    // En-tête méta
    ficheMeta.textContent = `${state.qr.categorie || "–"} – ${state.qr.titre_fiche || "–"} – ${state.qr.version || "–"}`;

    // Bloc infos complémentaires
    const refs = Array.isArray(state.qr.references_bibliographiques)
      ? state.qr.references_bibliographiques.join(", ")
      : "";
    const objectif = state.qr.objectif ? `<strong>Objectif :</strong> ${state.qr.objectif}<br>` : "";
    const refsTxt = refs ? `<strong>Références :</strong> ${refs}` : "";
    infosComplementaires.innerHTML = `${objectif}${refsTxt}`.trim();

    // Prompt (si déjà fourni dans le QR)
    compiledPrompt.value = state.qr.prompt || state.qr.promptTemplate || "";

    // Boutons IA selon cotation
    renderIABtns();
  }

  // ------------------------------------------------------
  // Boutons IA (cotation 2 = orange, 3 = vert)
  // ------------------------------------------------------
  function renderIABtns() {
    iaButtons.innerHTML = "";
    const table = state.qr?.ia_cotation || state.qr?.ia || {};
    Object.entries(table).forEach(([name, val]) => {
      const meta = typeof val === "number" ? { score: val, label: name } : val;
      const score = Number(meta.score || 0);
      if (score <= 1) return; // IA non fiable : aucun bouton
      const b = document.createElement("button");
      b.className = "ia-btn " + (score === 3 ? "green" : "orange");
      b.textContent = (meta.label || name) + (meta.paid ? " " + (t("paidVersion") || "(version payante)") : "");
      b.addEventListener("click", () => openIA(meta));
      iaButtons.appendChild(b);
    });
  }

  function openIA(meta) {
    // On compile le prompt actuel (au besoin tu peux enrichir ici)
    const prompt = compiledPrompt.value || "";
    const url = (meta.url && meta.url.replace("%q%", encodeURIComponent(prompt)))
      || `https://chat.openai.com/?q=${encodeURIComponent(prompt)}`;
    window.open(url, "_blank");
  }

  // ------------------------------------------------------
  // Réinitialisation complète
  // ------------------------------------------------------
  function resetApp() {
    stopCamera();
    state.qr = null;
    ficheMeta.textContent = "Catégorie – Titre – Version du QR code flashé";
    infosComplementaires.innerHTML = "";
    compiledPrompt.value = "";
    iaButtons.innerHTML = "";
    hideError();
  }

  // ------------------------------------------------------
  // Événements UI
  // ------------------------------------------------------
  cameraBtn.addEventListener("click", startCamera);
  scanBtn.addEventListener("click", detectQRCode);
  resetBtn.addEventListener("click", resetApp);

  // Init
  resetApp();

  // Afficher la version de l'application
document.addEventListener("DOMContentLoaded", () => {
  const v = "v4.1";
  const span = document.getElementById("appVersion");
  if (span) {
    span.textContent = " — " + v;
    span.style.opacity = 0.8;
  }
});

})();
