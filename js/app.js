// ======================================================
// Mémento opérationnel IA – RCH (ENSOSP) — app.js v4.3.1
// - Caméra & scan via QrScanner (pré-permission pour popup)
// - UI de scan visible seulement caméra active
// - Lecture QR JSON -> champs dynamiques + compilation {{placeholders}}
// - Réinitialisation complète (champs / prompt / fichier importé / caméra)
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
  const APP_VERSION = "v4.4";
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

  // ---------- Camera control (pré-permission) ----------
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
      hideScanUI();
    }
  }

  function detectQRCode() {
    if (!window.__scanner) startCamera();
    else console.log("🔎 Scan en cours…");
  }

  // ---------- Import d'image (fallback) ----------
  qrFile?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const QrScanner = window.__QrScanner;
      if (!QrScanner) return showError("QrScanner non chargé (import image indisponible).");

      if (lastImportedObjectURL) URL.revokeObjectURL(lastImportedObjectURL);
      lastImportedObjectURL = URL.createObjectURL(file);

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

  // ---------- Champs dynamiques & prompt ----------
  function extractFields(obj) {
    // champs standards
    let f = obj?.fields
      || obj?.champs_entree
      || obj?.["champs_entree"]
      || obj?.["champs / données d'entrée"]
      || obj?.["champs / donnees d'entree"];

    if (!Array.isArray(f)) f = [];

    const aliasMap = {
      "un": "code_onu",
      "onu": "code_onu",
      "cd": "code_danger_adr",
      "kemler": "code_danger_adr",
      "name": "nom_produit",
      "nom": "nom_produit",
      "cas": "num_cas",
      "n°cas": "num_cas",
      "n_cas": "num_cas",
    };

    return f.map(x => {
      const idRaw = (x.id || "").toString().trim();
      const norm = aliasMap[idRaw.toLowerCase()] || idRaw;
      return {
        id: norm || idRaw,
        label: x.label || x.titre || x.name || norm || idRaw,
        type: (x.type || "text").toLowerCase(),
        required: !!x.required,
        options: x.options || []
      };
    });
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
      if (f.type === "textarea") { input = document.createElement("textarea"); input.rows = 3; }
      else if (f.type === "number") { input = document.createElement("input"); input.type = "number"; }
      else if (f.type === "select") {
        input = document.createElement("select");
        (f.options || []).forEach(opt => {
          const o = document.createElement("option"); o.value = opt; o.textContent = opt; input.appendChild(o);
        });
      } else {
        input = document.createElement("input"); input.type = "text";
      }

      input.id = `fld_${f.id}`;
      input.dataset.fieldId = f.id;
      wrap.appendChild(input);
      formFields.appendChild(wrap);
    });
  }

  function collectFieldValues() {
    const vals = {};
    formFields.querySelectorAll("[data-field-id]").forEach(el => {
      const k = el.dataset.fieldId;
      let v;
      if (el.type === "checkbox") v = el.checked ? "oui" : "non";
      else v = (el.value || "").trim();
      vals[k] = v;
    });
    return vals;
  }

  function generatePromptFromForm() {
    if (!state.qr) return;

    let tpl = (state.qr.prompt || state.qr.promptTemplate || "").trim();
    if (!tpl) { compiledPrompt.value = ""; return; }

    const vals = collectFieldValues();

    tpl = tpl.replace(/{{\s*([^}]+)\s*}}/g, (_, keyRaw) => {
      const key = keyRaw.trim();
      return (vals[key] ?? "");
    });

    compiledPrompt.value = tpl;
  }

  // ---------- QR -> UI ----------
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
    ficheMeta.textContent =
      `${state.qr.categorie || "–"} – ${state.qr.titre_fiche || state.qr.titre || "–"} – ${state.qr.version || "–"}`;

    // Infos complémentaires
    const refs = Array.isArray(state.qr.references_bibliographiques)
      ? state.qr.references_bibliographiques.join(", ")
      : "";
    const objectif = state.qr.objectif ? `<strong>Objectif :</strong> ${state.qr.objectif}<br>` : "";
    const refsTxt = refs ? `<strong>Références :</strong> ${refs}` : "";
    infosComplementaires.innerHTML = `${objectif}${refsTxt}`.trim();

    // Prompt “brut”
    compiledPrompt.value = (state.qr.prompt || state.qr.promptTemplate || "").trim();

    // Champs dynamiques (fields ou placeholders)
    let flds = extractFields(state.qr);
    if (!flds.length) {
      const ph = Array.from((compiledPrompt.value || "").matchAll(/{{\s*([^}]+)\s*}}/g)).map(m => m[1].trim());
      const uniq = [...new Set(ph)];
      if (uniq.length) {
        flds = uniq.map(k => ({ id: k, label: k.toUpperCase().replaceAll("_", " "), type: "text" }));
      }
    }
    renderFields(flds);

    // Boutons IA
    renderIABtns();
  }

  // ---------- Boutons IA ----------
  function renderIABtns() {
    iaButtons.innerHTML = "";
    const table = state.qr?.ia_cotation || state.qr?.ia || {};
    Object.entries(table).forEach(([name, val]) => {
      const meta = typeof val === "number" ? { score: val, label: name } : val;
      const score = Number(meta.score || 0);
      if (score <= 1) return; // non proposé

      const b = document.createElement("button");
      b.className = "ia-btn " + (score === 3 ? "green" : "orange");
      b.textContent = (meta.label || name) + (meta.paid ? " (version payante)" : "");
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

    // Vider tous les champs (sauf la langue)
    document.querySelectorAll("input, textarea, select").forEach((el) => {
      const id = el.id || "";
      if (id === "langSelect" || id === "qrFile") return;
      if (el.type === "checkbox") el.checked = false;
      else if (el.tagName === "SELECT") el.selectedIndex = 0;
      else el.value = "";
    });

    if (qrFile) qrFile.value = "";

    if (lastImportedObjectURL) {
      URL.revokeObjectURL(lastImportedObjectURL);
      lastImportedObjectURL = null;
    }

    hideEl(successMsg);
    console.log("♻️ Application réinitialisée");
  }

  // ---------- Version UI ----------
  document.addEventListener("DOMContentLoaded", () => {
    const span = document.getElementById("appVersion");
    if (span) {
      span.textContent = " — " + APP_VERSION;
      span.style.opacity = 0.9;
    }
  });

  // ---------- Events ----------
  cameraBtn?.addEventListener("click", startCamera);
  scanBtn?.addEventListener("click", detectQRCode);
  resetBtn?.addEventListener("click", resetApp);
  btnGenerate?.addEventListener("click", generatePromptFromForm);
  formFields?.addEventListener("input", () => { generatePromptFromForm(); });

  // ---------- Init ----------
  resetApp();
})();
