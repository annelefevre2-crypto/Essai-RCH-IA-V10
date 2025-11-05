// ======================================================
// Mémento opérationnel IA – RCH (ENSOSP) — app.js v4.5
// - Lecture QR JSON -> champs dynamiques, GPS, cotation IA
// - Champs d'entrée définis UNIQUEMENT dans le QR JSON
// - Réinitialisation complète (QR / champs / caméra / prompt)
// ======================================================

(() => {
  // ---------- DOM refs ----------
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
  const formFields = document.getElementById("formFields");
  const btnGenerate = document.getElementById("btnGenerate");

  // ---------- State ----------
  const APP_VERSION = "v4.5";
  let state = { qr: null };
  let lastImportedObjectURL = null;

  // ---------- UI helpers ----------
  const showEl = (el) => el && el.classList.remove("hidden");
  const hideEl = (el) => el && el.classList.add("hidden");

  const showScanUI = () => { showEl(videoBox); showEl(scanHint); showEl(scanOverlay); };
  const hideScanUI = () => { hideEl(scanHint); hideEl(scanOverlay); hideEl(videoBox); };

  const showError = (msg) => {
    if (!cameraError) return alert(msg);
    cameraError.textContent = msg;
    showEl(cameraError);
  };
  const hideError = () => hideEl(cameraError);

  const showSuccess = (text) => {
    if (!successMsg) return;
    if (text) successMsg.textContent = text;
    showEl(successMsg);
    setTimeout(() => hideEl(successMsg), 1500);
  };

  // ---------- Camera ----------
  async function startCamera() {
    hideError();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      stream.getTracks().forEach((t) => t.stop());
      await startScanner();
      showScanUI();
    } catch (e) {
      showError("Impossible d'accéder à la caméra : " + e.message);
      console.error("Erreur getUserMedia:", e);
    }
  }

  async function startScanner() {
    const QrScanner = window.__QrScanner;
    if (!QrScanner) return showError("QrScanner non chargé.");

    if (window.__scanner) {
      await window.__scanner.stop();
      window.__scanner.destroy();
    }

    const scanner = new QrScanner(
      videoEl,
      (result) => {
        const data = result?.data || result;
        if (!data) return;
        hideScanUI();
        stopCamera().finally(() => {
          handleQRContent(data);
          showSuccess("✅ QR Code détecté avec succès");
        });
      },
      { highlightScanRegion: true, highlightCodeOutline: true }
    );

    const cams = await QrScanner.listCameras(true).catch(() => []);
    if (Array.isArray(cams) && cams.length) {
      const back = cams.find((c) => /back|rear|environment/i.test(c.label)) || cams[0];
      await scanner.start(back.id);
    } else await scanner.start();

    window.__scanner = scanner;
    console.log("📷 QrScanner démarré");
  }

  async function stopCamera() {
    try {
      if (window.__scanner) {
        await window.__scanner.stop();
        window.__scanner.destroy();
        window.__scanner = null;
      }
    } catch (_) {}
    hideScanUI();
  }

  // ---------- Import image ----------
  qrFile?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const QrScanner = window.__QrScanner;
      const res = await QrScanner.scanImage(file, { returnDetailedScanResult: true });
      const data = res?.data || res;
      if (!data) return showError("Aucun QR lisible trouvé dans l'image.");
      hideScanUI();
      handleQRContent(data);
      showSuccess("✅ QR Code détecté avec succès");
    } catch {
      showError("Aucun QR lisible trouvé dans l'image.");
    }
  });

  // ---------- Analyse QR ----------
  function handleQRContent(raw) {
    let jsonStr = (raw || "").trim();
    try {
      if (jsonStr.startsWith("data:application/json")) jsonStr = atob(jsonStr.split(",")[1]);
      const obj = JSON.parse(jsonStr);
      state.qr = obj;
      updateInterface();
    } catch (err) {
      console.error("QR/JSON invalide:", err);
      showError("QR invalide ou JSON mal formé.");
    }
  }

  // ---------- Interface ----------
  function updateInterface() {
    if (!state.qr) return;

    ficheMeta.textContent = `${state.qr.categorie || "–"} – ${state.qr.nom_fiche || state.qr.titre || "–"} – ${state.qr.version || "–"}`;

    const objectif = state.qr.objectif ? `<strong>Objectif :</strong> ${state.qr.objectif}<br>` : "";
    const refs = state.qr.sources_biblio ? `<strong>Sources :</strong> ${state.qr.sources_biblio}` : "";
    infosComplementaires.innerHTML = `${objectif}${refs}`.trim();

    renderFields(state.qr.champs_entree || []);
    renderIABtns();
    compiledPrompt.value = state.qr.prompt || "";
    btnGenerate.disabled = false;
  }

  // ---------- Champs dynamiques ----------
  function renderFields(fields) {
    formFields.innerHTML = "";
    fields.forEach((f) => {
      const wrap = document.createElement("div");
      wrap.className = "field";

      const label = document.createElement("label");
      label.textContent = f.nom || f.label || f.id || "Champ";
      wrap.appendChild(label);

      let input;
      if (f.type === "gps") {
        input = document.createElement("input");
        input.type = "text";
        input.placeholder = "latitude, longitude ±précision";
        input.classList.add("gps-field");

        const btn = document.createElement("button");
        btn.textContent = "📍";
        btn.type = "button";
        btn.className = "gps-btn";
        btn.addEventListener("click", () => getGPS(input));
        wrap.appendChild(btn);
      } else {
        input = document.createElement("input");
        input.type = f.type === "number" ? "number" : "text";
      }

      input.dataset.fieldId = f.nom?.toLowerCase().replace(/\s+/g, "_");
      if (f.obligatoire === "O") input.required = true;
      wrap.appendChild(input);
      formFields.appendChild(wrap);
    });
  }

  // ---------- GPS acquisition ----------
  function getGPS(inputEl) {
    if (!navigator.geolocation) return alert("Géolocalisation non supportée.");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        inputEl.value = `${latitude.toFixed(6)}, ${longitude.toFixed(6)} ±${Math.round(accuracy)}m`;
      },
      (err) => alert("Erreur GPS : " + err.message),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  // ---------- Prompt ----------
  function collectValues() {
    const vals = {};
    formFields.querySelectorAll("[data-field-id]").forEach((el) => {
      vals[el.dataset.fieldId] = el.value.trim();
    });
    return vals;
  }

  function generatePromptFromForm() {
    if (!state.qr) return;
    let tpl = (state.qr.prompt || "").trim();
    const vals = collectValues();
    tpl = tpl.replace(/{{\s*([^}]+)\s*}}/g, (_, key) => vals[key.trim()] || "");
    compiledPrompt.value = tpl;
  }

  // ---------- Boutons IA ----------
  function renderIABtns() {
    iaButtons.innerHTML = "";
    const raw = state.qr.cotation_ia || "";
    const items = raw.split(/\n|,/).map((x) => x.trim()).filter(Boolean);

    items.forEach((entry) => {
      const [name, val] = entry.split(":").map((s) => s.trim());
      if (!name || !val) return;

      const paid = val.includes("€");
      const score = parseInt(val.replace("€", "").trim(), 10);
      if (score <= 1) return;

      const b = document.createElement("button");
      b.className = "ia-btn " + (score === 3 ? "green" : "orange");
      b.textContent = name + (paid ? " (€)" : "");
      b.addEventListener("click", () => openIA(name));
      iaButtons.appendChild(b);
    });
  }

  function openIA(name) {
    const prompt = compiledPrompt.value;
    let url = "";
    switch (name.toLowerCase()) {
      case "chatgpt": url = `https://chat.openai.com/?q=${encodeURIComponent(prompt)}`; break;
      case "claude": url = `https://claude.ai/new?q=${encodeURIComponent(prompt)}`; break;
      case "gemini": url = `https://gemini.google.com/app?q=${encodeURIComponent(prompt)}`; break;
      case "perplexity": url = `https://www.perplexity.ai/search?q=${encodeURIComponent(prompt)}`; break;
      case "deepseek": url = `https://chat.deepseek.com/?q=${encodeURIComponent(prompt)}`; break;
      case "lechat": url = `https://chat.mistral.ai/chat?q=${encodeURIComponent(prompt)}`; break;
      case "grok": url = `https://x.com/i/grok?q=${encodeURIComponent(prompt)}`; break;
      default: url = `https://chat.openai.com/?q=${encodeURIComponent(prompt)}`;
    }
    window.open(url, "_blank");
  }

  // ---------- Reset ----------
  function resetApp() {
    stopCamera();
    hideScanUI();
    hideError();

    state.qr = null;
    ficheMeta.textContent = "Pas de fiche scannée";
    infosComplementaires.innerHTML = "";
    compiledPrompt.value = "";
    iaButtons.innerHTML = "";
    formFields.innerHTML = "";
    if (qrFile) qrFile.value = "";

    hideEl(successMsg);
    btnGenerate.disabled = true;

    console.log("♻️ Application réinitialisée");
  }

  // ---------- Events ----------
  cameraBtn?.addEventListener("click", startCamera);
  scanBtn?.addEventListener("click", startCamera);
  resetBtn?.addEventListener("click", resetApp);
  btnGenerate?.addEventListener("click", generatePromptFromForm);
  formFields?.addEventListener("input", generatePromptFromForm);

  document.addEventListener("DOMContentLoaded", () => {
    const span = document.getElementById("appVersion");
    if (span) span.textContent = "v4.5";
  });

  // Init
  resetApp();
})();
