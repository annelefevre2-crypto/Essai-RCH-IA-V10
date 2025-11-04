// ======================================================
// ⚙️ Application ENSOSP - Mémento IA RCH v4.0 Full
// Détection hybride BarcodeDetector + jsQR
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

  let detector = null;
  let stream = null;
  let state = { qr: null };

  // ==== UTILITAIRES ====
  const showError = (msg) => {
    cameraError.textContent = msg;
    cameraError.classList.remove("hidden");
  };
  const hideError = () => cameraError.classList.add("hidden");

  const showSuccess = () => {
    successMsg.classList.remove("hidden");
    setTimeout(() => successMsg.classList.add("hidden"), 1500);
  };

  const resetApp = () => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
      videoEl.srcObject = null;
    }
    ficheMeta.textContent = "Catégorie – Titre – Version du QR code flashé";
    infosComplementaires.innerHTML = "";
    compiledPrompt.value = "";
    iaButtons.innerHTML = "";
    hideError();
    state.qr = null;
  };

  // ==== CAMERA ====
// --- Nouvelle version basée sur QrScanner ---
async function startCamera() {
  try {
    // Détruire instance précédente si elle existe
    if (window.__scanner) { await window.__scanner.stop(); window.__scanner.destroy(); window.__scanner = null; }

    const QrScanner = window.__QrScanner;
    const scanner = new QrScanner(videoEl, (result) => {
      if (result?.data) {
        handleQRContent(result.data);
        showSuccess();
        stopCamera();
      }
    }, { highlightScanRegion: true, highlightCodeOutline: true });

    // Sélectionne la caméra arrière si disponible
    const cameras = await QrScanner.listCameras(true).catch(() => []);
    if (Array.isArray(cameras) && cameras.length) {
      const back = cameras.find(c => /back|rear|environment/i.test(c.label)) || cameras[0];
      await scanner.start(back.id);
    } else {
      await scanner.start();
    }

    window.__scanner = scanner;
    hideError();
    console.log("📷 Caméra activée et QrScanner démarré");
  } catch (e) {
    showError("Erreur caméra : " + e.message);
    console.error("Erreur QrScanner", e);
  }
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
    console.warn("Erreur à l'arrêt caméra", e);
  }
}

  // ==== DETECTION ====
  async function detectQRCode() {
    if (!videoEl.srcObject) {
      showError("Caméra inactive.");
      return;
    }
    hideError();
    let detected = false;

    // Essayer BarcodeDetector natif
    if ("BarcodeDetector" in window) {
      try {
        detector = new window.BarcodeDetector({ formats: ["qr_code"] });
        for (let i = 0; i < 80; i++) {
          const bitmap = await createImageBitmap(videoEl);
          const codes = await detector.detect(bitmap);
          if (codes && codes.length > 0) {
            handleQRContent(codes[0].rawValue);
            showSuccess();
            detected = true;
            break;
          }
          await new Promise((r) => setTimeout(r, 100));
        }
      } catch (err) {
        console.warn("BarcodeDetector error, fallback to jsQR", err);
      }
    }

    // Fallback jsQR
    if (!detected) {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = videoEl.videoWidth;
      canvas.height = videoEl.videoHeight;
      for (let i = 0; i < 80; i++) {
        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imgData.data, imgData.width, imgData.height);
        if (code) {
          handleQRContent(code.data);
          showSuccess();
          detected = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    if (!detected) showError("Aucun QR code détecté.");
  }

  // ==== IMPORT D'IMAGE ====
  qrFile.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code) {
        handleQRContent(code.data);
        showSuccess();
      } else {
        showError(t("noQrInImage"));
      }
    };
  });

  // ==== TRAITEMENT DU QR JSON ====
  function handleQRContent(raw) {
    let jsonStr = raw.trim();
    try {
      if (raw.startsWith("data:application/json")) {
        jsonStr = atob(raw.split(",")[1]);
      }
      const data = JSON.parse(jsonStr);
      state.qr = data;
      updateInterface();
    } catch (err) {
      showError("QR code invalide ou JSON malformé.");
      console.error(err);
    }
  }

  function updateInterface() {
    if (!state.qr) return;
    ficheMeta.textContent = `${state.qr.categorie || "–"} – ${state.qr.titre_fiche || "–"} – ${state.qr.version || "–"}`;
    infosComplementaires.innerHTML = `
      <strong>Objectif :</strong> ${state.qr.objectif || ""}<br>
      <strong>Références :</strong> ${(state.qr.references_bibliographiques || []).join(", ")}
    `;
    compiledPrompt.value = state.qr.prompt || "";
    renderIABtns();
  }

  // ==== BOUTONS IA ====
  function renderIABtns() {
    iaButtons.innerHTML = "";
    const table = state.qr.ia_cotation || {};
    Object.entries(table).forEach(([name, info]) => {
      const score = typeof info === "number" ? info : info.score;
      if (score <= 1) return;
      const btn = document.createElement("button");
      btn.className = "ia-btn " + (score === 3 ? "green" : "orange");
      btn.textContent = name + (info.paid ? " " + t("paidVersion") : "");
      btn.addEventListener("click", () => openIA(name));
      iaButtons.appendChild(btn);
    });
  }

  function openIA(name) {
    const prompt = compiledPrompt.value;
    const url = `https://chat.openai.com/?q=${encodeURICom
