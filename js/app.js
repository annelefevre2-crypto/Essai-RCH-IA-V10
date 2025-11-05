// ======================================================
// Mémento opérationnel IA – RCH (ENSOSP) — app.js v4.6.3
// - Gestion dynamique des fiches JSON (champs / prompt)
// - Champ permanent "Informations complémentaires"
// - Envoi du prompt enrichi vers chaque IA selon son URL
// - Acquisition GPS (avec bouton responsive)
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
  const APP_VERSION = "v4.6.3";
  let state = { qr: null };
  let lastImportedObjectURL = null;

  // ---------- Table des URL IA ----------
  const IA_URLS = {
    Chatgpt: "https://chatgpt.com/",
    Claude: "https://claude.ai/new",
    Gemini: "https://gemini.google.com/",
    Perplexity: "https://www.perplexity.ai/",
    Deepseek: "https://chat.deepseek.com/",
    Lechat: "https://chat.mistral.ai/chat",
    Grok: "https://grok.com/"
  };

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

  // ---------- QR Scanner ----------
  async function startScanner(backId) {
    const QrScanner = window.__QrScanner;
    if (!QrScanner) {
      showError("QrScanner non chargé.");
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
        hideScanUI();
        stopCamera().finally(() => {
          handleQRContent(data);
          showSuccess("✅ QR Code détecté avec succès");
        });
      },
      { highlightScanRegion: true, highlightCodeOutline: true }
    );

    if (backId) await scanner.start(backId);
    else await scanner.start();

    window.__scanner = scanner;
    console.log("📷 QrScanner démarré");
  }

  // ---------- Camera control ----------
  function startCamera() {
    hideError();
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then(async (preStream) => {
        preStream.getTracks().forEach((t) => t.stop());
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
        showScanUI();
      })
      .catch((e) => {
        showError("Impossible d'accéder à la caméra : " + e.message);
      });
  }

  async function stopCamera() {
    try {
      if (window.__scanner) {
        await window.__scanner.stop();
        window.__scanner.destroy();
        window.__scanner = null;
      }
    } catch (e) {
      console.warn("Erreur à l'arrêt caméra:", e);
    } finally {
      hideScanUI();
    }
  }

  function detectQRCode() {
    if (!window.__scanner) startCamera();
    else console.log("🔎 Scan en cours…");
  }

  // ---------- Import image QR ----------
  qrFile?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const QrScanner = window.__QrScanner;
      if (!QrScanner) return showError("QrScanner non chargé.");
      if (lastImportedObjectURL) URL.revokeObjectURL(lastImportedObjectURL);
      lastImportedObjectURL = URL.createObjectURL(file);
      const res = await QrScanner.scanImage(file, { returnDetailedScanResult: true });
      const data = res?.data || res;
      if (!data) return showError("Aucun QR lisible trouvé.");
      hideScanUI();
      handleQRContent(data);
      showSuccess("✅ QR Code détecté avec succès");
    } catch {
      showError("Aucun QR lisible trouvé.");
    }
  });

  // ---------- Champs dynamiques ----------
  function extractFields(obj) {
    let f = obj?.fields || obj?.champs_entree || [];
    if (!Array.isArray(f)) f = [];

    return f.map(x => ({
      id: (x.id || x.name || "").toLowerCase(),
      label: x.label || x.titre || x.name || x.id,
      type: (x.type || "text").toLowerCase(),
      required: !!x.required
    }));
  }

  function renderFields(fields) {
    formFields.innerHTML = "";
    if (!fields.length) return;

    fields.forEach(f => {
      const wrap = document.createElement("div");
      wrap.className = "field";

      const lab = document.createElement("label");
      lab.htmlFor = `fld_${f.id}`;
      lab.textContent = f.label;
      wrap.appendChild(lab);

      let input;
      if (f.type === "number") {
        input = document.createElement("input");
        input.type = "number";
      } else if (f.type === "gps") {
        input = document.createElement("div");
        input.classList.add("gps-field");

        const lat = document.createElement("input");
        lat.placeholder = "Latitude";
        lat.type = "text";
        lat.className = "gps-lat";

        const lon = document.createElement("input");
        lon.placeholder = "Longitude";
        lon.type = "text";
        lon.className = "gps-lon";

        const btn = document.createElement("button");
        btn.textContent = "📍 Obtenir position";
        btn.className = "gps-btn";
        btn.onclick = (ev) => {
          ev.preventDefault();
          if (!navigator.geolocation) return alert("Géolocalisation non supportée.");
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              lat.value = pos.coords.latitude.toFixed(6);
              lon.value = pos.coords.longitude.toFixed(6);
            },
            (err) => alert("Erreur GPS : " + err.message)
          );
        };
        input.append(lat, lon, btn);
      } else {
        input = document.createElement("input");
        input.type = "text";
      }

      input.id = `fld_${f.id}`;
      input.dataset.fieldId = f.id;
      wrap.appendChild(input);
      formFields.appendChild(wrap);
    });

    // Ajout du champ permanent “Informations complémentaires”
    const extraWrap = document.createElement("div");
    extraWrap.className = "field";
    const labExtra = document.createElement("label");
    labExtra.textContent = "Informations complémentaires";
    const area = document.createElement("textarea");
    area.id = "fld_infos_compl";
    area.dataset.fieldId = "infos_compl";
    area.placeholder = "Ajoutez ici toute information utile (contexte, mesures, observations...)";
    extraWrap.append(labExtra, area);
    formFields.appendChild(extraWrap);
  }

  function collectFieldValues() {
    const vals = {};
    formFields.querySelectorAll("[data-field-id]").forEach(el => {
      const id = el.dataset.fieldId;
      if (!id) return;
      if (el.classList.contains("gps-field")) return;
      vals[id] = el.value.trim();
    });

    // Collecter les valeurs GPS
    const lat = formFields.querySelector(".gps-lat");
    const lon = formFields.querySelector(".gps-lon");
    if (lat && lon && (lat.value || lon.value)) {
      vals["latitude"] = lat.value;
      vals["longitude"] = lon.value;
    }
    return vals;
  }

  // ---------- Génération du prompt enrichi ----------
  function generatePromptFromForm() {
    if (!state.qr) return;
    let tpl = (state.qr.prompt || "").trim();
    if (!tpl) { compiledPrompt.value = ""; return; }

    const vals = collectFieldValues();
    tpl = tpl.replace(/{{\s*([^}]+)\s*}}/g, (_, keyRaw) => vals[keyRaw.trim()] ?? "");

    // Ajout du champ "Informations complémentaires"
    const infosCompl = vals["infos_compl"];
    if (infosCompl) tpl += `\n\nInformations complémentaires : ${infosCompl}`;

    compiledPrompt.value = tpl;
  }

  // ---------- QR -> Interface ----------
  function handleQRContent(raw) {
    try {
      const obj = JSON.parse(raw);
      state.qr = obj;
      updateInterface();
    } catch (err) {
      showError("QR invalide ou JSON mal formé.");
    }
  }

  function updateInterface() {
    if (!state.qr) return;
    ficheMeta.textContent = `${state.qr.categorie || "–"} – ${state.qr.nom_fiche || state.qr.titre || "–"} – ${state.qr.version || "–"}`;
    infosComplementaires.innerHTML = `<strong>Objectif :</strong> ${state.qr.objectif || "–"}`;
    compiledPrompt.value = state.qr.prompt || "";

    renderFields(extractFields(state.qr));
    renderIABtns();
  }

  // ---------- Boutons IA ----------
  function renderIABtns() {
    iaButtons.innerHTML = "";
    const table = state.qr?.ia_cotation || state.qr?.ia || {};
    Object.entries(table).forEach(([name, val]) => {
      const score = Number(val);
      if (score <= 1) return;

      const btn = document.createElement("button");
      btn.className = "ia-btn " + (score === 3 ? "green" : "orange");
      btn.textContent = name;
      btn.addEventListener("click", () => openIA({ label: name }));
      iaButtons.appendChild(btn);
    });
  }

  function openIA(meta) {
    try {
      generatePromptFromForm();
    } catch (err) {
      console.warn("Erreur lors de la régénération du prompt :", err);
    }

    const prompt = (compiledPrompt.value || "").trim();
    if (!prompt) {
      alert("Le prompt est vide — veuillez remplir les champs avant d’envoyer.");
      return;
    }

    const iaName = (meta.label || "").trim();
    const baseUrl = IA_URLS[iaName] || "https://chat.openai.com/?q=%q%";
    const encodedPrompt = encodeURIComponent(prompt);
    const url = baseUrl.includes("%q%") ? baseUrl.replace("%q%", encodedPrompt) : `${baseUrl}?q=${encodedPrompt}`;

    window.open(url, "_blank", "noopener,noreferrer");
  }

  // ---------- Reset ----------
  function resetApp() {
    stopCamera();
    hideScanUI();
    hideError();
    state.qr = null;
    ficheMeta.textContent = "Aucune fiche scannée";
    infosComplementaires.innerHTML = "";
    compiledPrompt.value = "";
    iaButtons.innerHTML = "";
    formFields.innerHTML = "";
    if (qrFile) qrFile.value = "";
  }

  // ---------- Init ----------
  document.addEventListener("DOMContentLoaded", () => {
    const span = document.getElementById("appVersion");
    if (span) span.textContent = " — " + APP_VERSION;
  });

  cameraBtn?.addEventListener("click", startCamera);
  scanBtn?.addEventListener("click", detectQRCode);
  resetBtn?.addEventListener("click", resetApp);
  btnGenerate?.addEventListener("click", generatePromptFromForm);
})();
