# 📘 Mémento opérationnel IA – RCH (V4.0 Full)

## 🚀 Utilisation
1. Ouvrez la page via **HTTPS** (GitHub Pages ou serveur sécurisé).  
   ⚠️ La caméra ne fonctionnera pas en mode `file://`.
2. Cliquez sur **Activer la caméra**, puis sur **Scanner QR Code**.  
3. Cadrez le QR code dans la zone centrale.  
   - Si un code est détecté, un message vert ✅ « QR Code détecté avec succès » s'affiche.  
4. Les **informations** issues du QR s’affichent automatiquement dans la zone de droite.  
5. Vous pouvez **importer une image** contenant un QR code en alternative.  
6. Les boutons IA s’affichent selon la **cotation de fiabilité** (vert/orange).  
7. Cliquez sur un bouton pour ouvrir la suggestion IA dans la fenêtre correspondante.

---

## 🧠 Fonctionnement
Chaque fiche du mémento papier contient un **QR code JSON** intégrant :
- Titre, catégorie, version  
- Objectif de la fiche  
- Champs d’entrée (texte, GPS, photo, etc.)  
- Prompt IA complet  
- Cotation des IA disponibles (1 à 3, avec option payante)

L’application lit ce JSON, génère les champs, compile le prompt et permet d’ouvrir la fiche IA directement dans ChatGPT ou un autre outil validé.

---

## ⚙️ Préconisations techniques
- Navigateur recommandé : **Chrome**, **Edge** ou **Safari**.  
- Connexion HTTPS obligatoire.  
- Compatible **ordinateur, tablette et mobile**.  
- Détection hybride :
  - `BarcodeDetector` natif (rapide)
  - Fallback `jsQR` local (compatible Firefox / Android)

---

## 🏷️ Crédits
© ENSOSP — Cne Eddy Fischer – Cdt Anne Tirelle
