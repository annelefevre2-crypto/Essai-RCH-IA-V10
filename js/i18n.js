(function(){
  const dict = {
    fr: { reset:"Réinitialiser", activateCamera:"Activer la caméra", captureQr:"Capturer QR Code",
          acquirePos:"Acquisition de la position", importImageLabel:"Ou importer une image de QR :",
          moreInfo:"Informations complémentaires", copyPrompt:"Copier le prompt", createZip:"Créer le ZIP",
          gpsNotAcquired:"Position non acquise.", promptCopied:"Prompt copié !",
          geolocFail:"Échec géolocalisation : ", noBarcode:"BarcodeDetector indisponible. Importez une image de QR ou utilisez la caméra.",
          cannotAccessCamera:"Impossible d'accéder à la caméra. Vérifiez les autorisations et utilisez HTTPS (ou localhost).",
          noQrInImage:"Aucun QR détecté dans l'image.", zipReady:"ZIP prêt (prompt + pièces jointes).",
          paidVersion:"(version payante)", scanHint:"Cadrez le QR code dans la zone vidéo, puis appuyez sur « Capturer QR Code »."
    },
    en: { reset:"Reset", activateCamera:"Enable camera", captureQr:"Scan QR Code", acquirePos:"Get position",
          importImageLabel:"Or import a QR image:", moreInfo:"Additional information", copyPrompt:"Copy prompt",
          createZip:"Create ZIP", gpsNotAcquired:"Position not acquired.", promptCopied:"Prompt copied!",
          geolocFail:"Geolocation failed: ", noBarcode:"BarcodeDetector not available. Import a QR image or use the camera.",
          cannotAccessCamera:"Cannot access camera. Check permissions and use HTTPS (or localhost).",
          noQrInImage:"No QR found in the image.", zipReady:"ZIP ready (prompt + attachments).", paidVersion:"(paid version)",
          scanHint:"Frame the QR code in the video area, then press “Scan QR Code”."
    }
  };
  window.I18N = { dict, lang:'fr', t(k){return dict[this.lang][k]||k;},
    apply(){ document.querySelectorAll('[data-i18n]').forEach(el=>{ const k=el.getAttribute('data-i18n'); el.innerHTML=this.t(k); }); }
  };
  document.addEventListener('DOMContentLoaded', ()=>{
    const sel=document.getElementById('langSel'); if(sel){ sel.value=I18N.lang; sel.addEventListener('change', ()=>{ I18N.lang=sel.value; I18N.apply(); }); }
    I18N.apply();
  });
})();