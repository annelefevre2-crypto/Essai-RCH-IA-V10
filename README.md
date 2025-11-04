# Mémento opérationnel IA – RCH (V3.7) — Correctif caméra
## Nouveautés
- **Activation caméra renforcée** :
  - Vérification HTTPS / localhost.
  - **Arrêt propre** des pistes avant réouverture.
  - **Trois tentatives** de contraintes : `environment` → générique → `user` (front).
  - `video.play()` explicite après `srcObject` (utile Safari/iOS).
  - **Messages d’erreur visibles** sous la vidéo (boîte rouge).
- UI et flux gardés de la V3.6 : cadre de visée (4 coins ENSOSP), message de guidage, import image QR, responsive, footer.

## Astuces
- Si la page est ouverte en `file://`, la caméra ne peut pas démarrer. Utilisez **GitHub Pages (HTTPS)** ou un serveur local (`python3 -m http.server`).

© ENSOSP — Cne Eddy Fischer – Cdt Anne Tirelle
