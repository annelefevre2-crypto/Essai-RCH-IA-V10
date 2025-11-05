// ======================================================
// Mémento opérationnel IA – RCH (ENSOSP)
// Version : 4.6
// Auteurs : Cne Eddy Fischer / Cdt Anne Tirelle
// ------------------------------------------------------
// - Scan QR via QrScanner
// - Lecture JSON dynamique (champs text / number / gps)
// - Boutons IA selon cotation
// - Bouton GPS intégré
// - Champ "Informations complémentaires" permanent
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
  const APP_VERSION = "v4.6";
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

  // ---------- QRScanner ----------
  async function startScanner(backId) {
    const QrScanner = window.__QrScanner;
    if (!QrScanner) return showError("QrScanner non chargé.");

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
  }

  // ---------- Caméra ----------
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
        showError("Impossible d'accéder à la caméra : " + (e.message || e));
      });
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
    const fields = obj?.champs_entree || [];
    return fields.map(f => ({
      id: f.nom.toLowerCase().replaceAll(" ", "_"),
      label: f.nom,
      type: f.type || "text",
      obligatoire: f.obligatoire === "O"
    }));
  }

  function renderFields(fields) {
    formFields.innerHTML = "";
    if (!fields.length) return;

    fields.forEach(f => {
      const wrap = document.createElement("div");
      wrap.className = "field";
      const lab = document.createElement("label");
      lab.textContent = f.label + (f.obligatoire ? " *" : "");
      lab.htmlFor = `fld_${f.id}`;
      wrap.appendChild(lab);

      // ---- Type GPS ----
      if (f.type === "gps") {
        const gpsWrap = document.createElement("div");
        gpsWrap.style.display = "flex";
        gpsWrap.style.gap = "0.5rem";
        gpsWrap.style.alignItems = "center";

        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "lat, lon ± précision";
        input.id = `fld_${f.id}`;
        input.dataset.fieldId = f.id;
        input.style.flex = "1";

        const gpsBtn = document.createElement("button");
        gpsBtn.className = "gps-btn";
        gpsBtn.textContent = "📍 Acquérir position";

        gpsBtn.onclick = () => {
          if (!navigator.geolocation) return alert("Géolocalisation non supportée.");
          gpsBtn.textContent = "⏳...";
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const { latitude, longitude, accuracy } = pos.coords;
              input.value = `${latitude.toFixed(6)}, ${longitude.toFixed(6)} ±${Math.round(accuracy)}m`;
              gpsBtn.textContent = "📍 Reprendre";
            },
            (err) => {
              alert("Erreur géoloc : " + err.message);
              gpsBtn.textContent = "📍 Réessayer";
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
        };

        gpsWrap.appendChild(input);
        gpsWrap.appendChild(gpsBtn);
        wrap.appendChild(gpsWrap);
        formFields.appendChild(wrap);
        return;
      }

      // ---- Autres champs ----
      const input = document.createElement("input");
      input.type = f.type === "number" ? "number" : "text";
      input.id = `fld_${f.id}`;
      input.dataset.fieldId = f.id;
      input.style.width = "100%";
      input.style.padding = "0.6rem";
      input.style.fontSize = "1rem";
      wrap.appendChild(input);
      formFields.appendChild(wrap);
    });

    // Ajout champ fixe : Informations complémentaires
    const infoWrap = document.createElement("div");
    infoWrap.className = "field";
    const lab = document.createElement("label");
    lab.textContent = "Informations complémentaires";
    infoWrap.appendChild(lab);

    const textarea = document.createElement("textarea");
    textarea.id = "fld_infos_complementaires";
    textarea.rows = 3;
    textarea.placeholder = "Détails, contexte, remarques…";
    textarea.dataset.fieldId = "infos_complementaires";
    textarea.style.width = "100%";
    textarea.style.padding = "0.6rem";
    textarea.style.fontSize = "1rem";

    infoWrap.appendChild(textarea);
    formFields.appendChild(infoWrap);
  }

  function collectFieldValues() {
    const vals = {};
    formFields.querySelectorAll("[data-field-id]").forEach(el => {
      vals[el.dataset.fieldId] = (el.value || "").trim();
    });
    return vals;
  }

  function generatePromptFromForm() {
    if (!state.qr) return;
    const tpl = (state.qr.prompt || "").trim();
    const vals = collectFieldValues();
    let result = tpl.replace(/{{\s*([^}]+)\s*}}/g, (_, k) => vals[k.trim()] || "");
    if (vals.infos_complementaires) {
      result += `\n\n# Informations complémentaires\n${vals.infos_complementaires}`;
    }
    compiledPrompt.value = result;
  }

  // ---------- Lecture QR ----------
  function handleQRContent(raw) {
    try {
      const obj = JSON.parse(raw);
      state.qr = obj;
      updateInterface();
    } catch {
      showError("QR invalide ou JSON mal formé.");
    }
  }

  function updateInterface() {
    if (!state.qr) return;
    ficheMeta.textContent = `${state.qr.categorie || "–"} – ${state.qr.nom_fiche || "–"} – ${state.qr.version || "–"}`;
    infosComplementaires.innerHTML = `<strong>Objectif :</strong> ${state.qr.objectif || ""}<br><strong>Sources :</strong> ${state.qr.sources_biblio || ""}`;
    compiledPrompt.value = (state.qr.prompt || "").trim();
    renderFields(extractFields(state.qr));
    renderIABtns();
  }

  // ---------- Boutons IA ----------
  function renderIABtns() {
    iaButtons.innerHTML = "";
    const cotation = state.qr?.cotation_ia || "";
    if (!cotation) return;
    const items = cotation.split(",");
    items.forEach(it => {
      const [name, valRaw] = it.split(":").map(s => s.trim());
      const val = valRaw?.includes("€") ? 3 : parseInt(valRaw, 10);
      if (isNaN(val) || val < 2) return;
      const btn = document.createElement("button");
      btn.className = "ia-btn " + (val === 3 ? "green" : "orange");
      btn.textContent = name + (valRaw?.includes("€") ? " (€)" : "");
      btn.onclick = () => openIA(name);
      iaButtons.appendChild(btn);
    });
  }

  function openIA(name) {
    const q = encodeURIComponent(compiledPrompt.value);
    const map = {
      Chatgpt: "https://chat.openai.com/?q=" + q,
      Claude: "https://claude.ai/chat?prompt=" + q,
      Gemini: "https://gemini.google.com/app?query=" + q,
      Perplexity: "https://www.perplexity.ai/search?q=" + q,
      Deepseek: "https://chat.deepseek.com/?q=" + q,
      Lechat: "https://chat.mistral.ai/chat?prompt=" + q,
      Grok: "https://x.ai/?q=" + q
    };
    window.open(map[name] || map.Chatgpt, "_blank");
  }

  // ---------- Reset ----------
  function resetApp() {
    stopCamera();
    hideScanUI();
    hideError();
    state.qr = null;
    ficheMeta.textContent = "Aucune fiche sélectionnée";
    infosComplementaires.innerHTML = "";
    compiledPrompt.value = "";
    iaButtons.innerHTML = "";
    formFields.innerHTML = "";
    qrFile.value = "";
    if (lastImportedObjectURL) URL.revokeObjectURL(lastImportedObjectURL);
  }

  // ---------- Init ----------
  document.addEventListener("DOMContentLoaded", () => {
    const v = document.getElementById("appVersion");
    if (v) v.textContent = " — " + APP_VERSION;
  });

  // ---------- Events ----------
  cameraBtn?.addEventListener("click", startCamera);
  scanBtn?.addEventListener("click", startCamera);
  resetBtn?.addEventListener("click", resetApp);
  btnGenerate?.addEventListener("click", generatePromptFromForm);
  formFields?.addEventListener("input", generatePromptFromForm);
})();
