// ======================================================
// Mémento opérationnel IA – RCH (ENSOSP) — app.js v4.3
// Caméra & scan basés sur QrScanner, UI propre & reset total
// ======================================================

(() => {
  // ---------- i18n helper ----------
  const t = (k) => (window.I18N ? I18N.t(k) : k);

  // ---------- DOM refs ----------
  const APP_VERSION = "v4.3";
  const videoEl = document.getElementById("camera");
  const cameraBtn = document.getElementById("cameraBtn");
  const scanBtn = document.getElementById("scanBtn");
  const resetBtn = document.getElementById("resetBtn");
  const qrFile = document.getElementById("qrFile");

  const videoBox = document.getElementById("videoBox");
  const scanHint = document.getElementById("scanHint");
  const scanOverlay = document.getElementById("scanOverlay");

  const cameraError = document.getElementById("cameraError");
  const successMsg = document.getElementById("successMsg");

  const ficheMeta = document.getElementById("ficheMeta");
  const infosComplementaires = document.getElementById("infosComplementaires");
  const compiledPrompt = document.getElementById("compiledPrompt");
  const iaButtons = document.getElementById("iaButtons");

  // ---------- State ----------

  let lastImportedObjectURL = null;
  let state = { qr: null };

  // ---------- UI helpers ----------
  const showEl = (el) => el && el.classList.remove("hidden");
  const hideEl = (el) => el && el.classList.add("hidden");

  const showScanUI = () => {
    showEl(videoBox);
    showEl(scanHint);
    showEl(scanOverlay);
  };
  const hideScanUI = () => {
    hideEl(scanHint);
    hideEl(scanOverlay);
    hideEl(videoBox);
  };

  const showError = (msg) => {
    if (!cameraError) return alert(msg);
    cameraError.textContent = msg;
    showEl(cameraError);
  };
  const hideError = () => hideEl(cameraError);

  const showSuccess = () => {
    if (!successMsg) return;
    showEl(successMsg);
    setTimeout(() => hideEl(successMsg), 1500);
  };

  // ---------- QrScanner instance ----------
  async function startScanner(backId) {
    const QrScanner = window.__QrScanner;
    if (!QrScanner) {
      showError("QrScanner non chargé (vérifie le bloc <script type='module'> dans index.html).");
      return;
    }

    if (window.__scanner) {
      await window.__scanner.stop();
      window.__scanner.destroy();
      window.__scanner = null;
    }

    const scanner = new QrScanner(
      videoEl,
      (result) => {
        const data = result?.data || result;
        if (!data) return;
        // Masquer l'UI de scan dès qu'on lit un QR
        hideScanUI();
        stopCamera().finally(() => {
          handleQRContent(data);
          showSuccess();
        });
      },
      { highlightScanRegion: true, highlightCodeOutline: true }
    );

    if (backId) await scanner.start(backId);
    else await scanner.start();

    window.__scanner = scanner;
    console.log("📷 QrScanner démarré");
  }

  // ---------- Camera control (pré-permission) ----------
  function startCamera() {
    hideError();

    // 1) Pré-permission pour forcer la popup (en user gesture)
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then(async (preStream) => {
        // 2) Stop immédiat de ce flux (juste pour permission)
        preStream.getTracks().forEach((t) => t.stop());

        // 3) Lister les caméras puis démarrer QrScanner
        const QrScanner = window.__QrScanner;
        let backId = null;
        try {
          const cams = await QrScanner.listCameras(true);
          if (Array.isArray(cams) && cams.length) {
            const back = cams.find((c) => /back|rear|environment/i.test(c.label)) || cams[0];
            backId = back.id;
          }
        } catch (_) {}

        await startScanner(backId);
        showScanUI(); // Affiche zone bleue + consigne + coins
      })
      .catch((e) => {
        const msg = e && e.message ? e.message : String(e);
        showError("Impossible d'accéder à la caméra : " + msg);
        console.error("getUserMedia (pré-permission) error:", e);
      });
  }

  async function stopCamera() {
    try {
      if (window.__scanner) {
        await window.__scanner.stop();
        window.__scanner.destroy();
        window.__scanner = null;
        console.log("📷 Caméra arrêtée");
      }
    } catch (e) {
      console.warn("Erreur à l'arrêt caméra:", e);
    } finally {
      hideScanUI(); // Sécurité
    }
  }

  // Bouton "Scanner QR Code" : s'assurer que le scanner tourne
  async function detectQRCode() {
    if (!window.__scanner) {
      startCamera();
    } else {
      // déjà actif, attendre la détection
      console.log("🔎 Scan en cours…");
    }
  }

  // ---------- Import d'image (fallback) ----------
  qrFile?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const QrScanner = window.__QrScanner;
      if (!QrScanner) {
        showError("QrScanner non chargé (import image indisponible).");
        return;
      }

      // Optionnel : conserver pour <img>.src si tu prévisualises
      if (lastImportedObjectURL) URL.revokeObjectURL(lastImportedObjectURL);
      lastImportedObjectURL = URL.createObjectURL(file);

      const res = await QrScanner.scanImage(file, { returnDetailedScanResult: true });
      const data = res?.data || res;
      if (!data) return showError(t("noQrInImage"));

      hideScanUI();
      handleQRContent(data);
      showSuccess();
    } catch {
      showError(t("noQrInImage"));
    }
  });

  // ---------- Traitement du QR JSON ----------
  function handleQRContent(raw) {
    let jsonStr = (raw || "").trim();
    try {
      if (jsonStr.startsWith("data:application/json")) {
        jsonStr = atob(jsonStr.split(",")[1]);
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

    // Méta
    ficheMeta.textContent = `${state.qr.categorie || "–"} – ${state.qr.titre_fiche || "–"} – ${state.qr.version || "–"}`;

    // Infos complémentaires
    const refs = Array.isArray(state.qr.references_bibliographiques)
      ? state.qr.references_bibliographiques.join(", ")
      : "";
    const objectif = state.qr.objectif ? `<strong>Objectif :</strong> ${state.qr.objectif}<br>` : "";
    const refsTxt = refs ? `<strong>Références :</strong> ${refs}` : "";
    infosComplementaires.innerHTML = `${objectif}${refsTxt}`.trim();

    // Prompt initial si fourni
    compiledPrompt.value = state.qr.prompt || state.qr.promptTemplate || "";

    // Boutons IA
    renderIABtns();
  }

  // ---------- Boutons IA selon cotation ----------
  function renderIABtns() {
    iaButtons.innerHTML = "";
    const table = state.qr?.ia_cotation || state.qr?.ia || {};
    Object.entries(table).forEach(([name, val]) => {
      const meta = typeof val === "number" ? { score: val, label: name } : val;
      const score = Number(meta.score || 0);
      if (score <= 1) return; // IA non proposée

      const b = document.createElement("button");
      b.className = "ia-btn " + (score === 3 ? "green" : "orange");
      b.textContent = (meta.label || name) + (meta.paid ? " " + (t("paidVersion") || "(version payante)") : "");
      b.addEventListener("click", () => openIA(meta));
      iaButtons.appendChild(b);
    });
  }

  function openIA(meta) {
    const prompt = compiledPrompt.value || "";
    const url =
      (meta.url && meta.url.replace("%q%", encodeURIComponent(prompt))) ||
      `https://chat.openai.com/?q=${encodeURIComponent(prompt)}`;
    window.open(url, "_blank");
  }

  // ---------- Reset total ----------
// ------------------------------------------------------
// 🔄 Réinitialisation complète de l'application
// ------------------------------------------------------
function resetApp() {
  // 1️⃣ Arrêter la caméra et masquer la zone de scan
  stopCamera();
  hideScanUI();
  hideError();

  // 2️⃣ Réinitialiser les variables d'état
  state.qr = null;

  // 3️⃣ Réinitialiser les métadonnées affichées
  if (ficheMeta) ficheMeta.textContent = "Catégorie – Titre – Version du QR code flashé";
  if (infosComplementaires) infosComplementaires.innerHTML = "";

  // 4️⃣ Vider la zone de prompt
  if (compiledPrompt) compiledPrompt.value = "";

  // 5️⃣ Supprimer les boutons IA générés
  if (iaButtons) iaButtons.innerHTML = "";

  // 6️⃣ Effacer le contenu des champs d’entrée du formulaire
  document.querySelectorAll("input, textarea, select").forEach((el) => {
    const id = el.id || "";
    // On ne vide pas le sélecteur de langue
    if (id === "langSel") return;

    // Réinitialisation spécifique selon le type
    if (el.type === "checkbox") el.checked = false;
    else if (el.tagName === "SELECT") el.selectedIndex = 0;
    else el.value = "";
  });

  // 7️⃣ Effacer la sélection de fichier QR (import image)
  const fileInputs = [
    document.getElementById("qrFile"),
    document.getElementById("fileInput")
  ].filter(Boolean);
  fileInputs.forEach(input => input.value = "");

  // 8️⃣ Révoquer un éventuel ObjectURL d’image importée
  if (lastImportedObjectURL) {
    URL.revokeObjectURL(lastImportedObjectURL);
    lastImportedObjectURL = null;
  }

  // 9️⃣ Masquer les messages temporaires
  if (successMsg) hideEl(successMsg);

  console.log("♻️ Application réinitialisée");
}
setTimeout(() => {
  showSuccess();
  successMsg.textContent = "✅ Interface réinitialisée";
}, 150);


  // ---------- Version UI ----------
  document.addEventListener("DOMContentLoaded", () => {
    const span = document.getElementById("appVersion");
    if (span) {
      span.textContent = " — " + APP_VERSION;
      span.style.opacity = 0.85;
    }
  });

  // ---------- Events ----------
  cameraBtn?.addEventListener("click", startCamera);
  scanBtn?.addEventListener("click", detectQRCode);
  resetBtn?.addEventListener("click", resetApp);

  // ---------- Init ----------
  resetApp();
})();
