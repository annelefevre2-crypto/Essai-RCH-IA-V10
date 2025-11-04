// ======================================================
// 🌍 Gestion bilingue FR / EN pour l'application ENSOSP
// ======================================================
(function () {
  const dict = {
    fr: {
      activateCamera: "Activer la caméra",
      captureQr: "Scanner QR Code",
      reset: "Réinitialiser",
      importImageLabel: "Ou importer une image de QR :",
      scanHint: "Cadrez le QR code dans la zone puis cliquez sur « Scanner QR Code ».",
      cannotAccessCamera: "Impossible d'accéder à la caméra.",
      noQrInImage: "Aucun QR code détecté dans l'image.",
      promptCopied: "Prompt copié !",
      gpsNotAcquired: "Position non acquise.",
      moreInfo: "Informations complémentaires",
      paidVersion: "(version payante)"
    },
    en: {
      activateCamera: "Enable camera",
      captureQr: "Scan QR Code",
      reset: "Reset",
      importImageLabel: "Or import a QR image:",
      scanHint: "Frame the QR code and click “Scan QR Code”.",
      cannotAccessCamera: "Cannot access the camera.",
      noQrInImage: "No QR code found in the image.",
      promptCopied: "Prompt copied!",
      gpsNotAcquired: "Position not acquired.",
      moreInfo: "Additional information",
      paidVersion: "(paid version)"
    }
  };

  window.I18N = {
    lang: "fr",
    t(key) {
      return dict[this.lang][key] || key;
    },
    apply() {
      document.querySelectorAll("[data-i18n]").forEach(el => {
        const key = el.getAttribute("data-i18n");
        if (dict[this.lang][key]) el.innerText = dict[this.lang][key];
      });
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    const sel = document.getElementById("langSel");
    if (sel) {
      sel.value = I18N.lang;
      sel.addEventListener("change", () => {
        I18N.lang = sel.value;
        I18N.apply();
      });
    }
    I18N.apply();
  });
})();
