# Guide de Présentation — Dashboard Modbus & CAN
## Par Firas Mrabet & Oumayma Sfaxi

---

## 1. Réseau & Architecture (Onglet 1)

**Ce qui est affiché :** Les 4 couches du modèle TCP/IP empilées verticalement avec leurs protocoles et latences.

| Couche | Protocoles | Latence | Ce que vous dites |
|--------|-----------|---------|-------------------|
| Application | MODBUS TCP | 0.5 ms | "C'est ici que vivent nos requêtes Modbus (lecture/écriture de registres)" |
| Transport | TCP (port 502) | 1.2 ms | "TCP garantit la livraison fiable des données, le port standard Modbus est 502" |
| Internet | IP | 0.8 ms | "IP s'occupe du routage entre machines sur le réseau" |
| Accès réseau | Ethernet | 0.1 ms | "La couche physique, les trames Ethernet circulent sur le câble" |

**Architecture affichée en bas :**
- Application Utilisateur → Couche Communication → Gestion TCP → Pile TCP/IP
- "Cette hiérarchie montre comment une requête Modbus descend les couches avant d'être envoyée sur le réseau"

---

## 2. En-tête MBAP (Onglet 2)

**Ce qui est affiché :** Les 4 champs du MBAP Header (7 octets au total).

| Champ | Taille | Valeur exemple | Ce que vous dites |
|-------|--------|----------------|-------------------|
| Transaction ID | 2 octets | 0x0001 | "Identifiant unique qui lie chaque requête à sa réponse" |
| Protocol ID | 2 octets | 0x0000 | "Toujours 0x0000 pour Modbus, permet de distinguer d'autres protocoles" |
| Length | 2 octets | 0x0006 | "Indique la taille en octets du reste du message (Unit ID + PDU)" |
| Unit ID | 1 octet | 0x01 | "Identifie l'esclave cible, utile quand un gateway gère plusieurs PLC" |

**Point clé :** "Le MBAP Header remplace le CRC de Modbus RTU car TCP assure déjà la détection d'erreurs"

---

## 3. Function Codes (Onglet 3)

**Ce qui est affiché :** Tableau interactif avec tous les codes fonction Modbus.

| Code | Hex | Fonction | Type | Accès |
|------|-----|----------|------|-------|
| 01 | 0x01 | Read Coils | Discrete Output | READ |
| 02 | 0x02 | Read Discrete Inputs | Discrete Input | READ |
| 03 | 0x03 | Read Holding Registers | 16-bit Register | READ |
| 04 | 0x04 | Read Input Registers | 16-bit Register | READ |
| 05 | 0x05 | Write Single Coil | Discrete Output | WRITE |
| 06 | 0x06 | Write Single Register | 16-bit Register | WRITE |
| 15 | 0x0F | Write Multiple Coils | Discrete Output | WRITE |
| 16 | 0x10 | Write Multiple Registers | 16-bit Register | WRITE |

**Ce que vous dites :** "Chaque code fonction a un format de requête et de réponse spécifique. Par exemple, FC 03 envoie l'adresse de départ et la quantité, et reçoit les valeurs des registres"

---

## 4. Paramétrage TCP (Onglet 4)

**Ce qui est affiché :** Les paramètres de configuration TCP pour Modbus.

**Points clés à mentionner :**
- **Port 502** : Port standard réservé à Modbus TCP
- **TCP_NODELAY** : Désactive l'algorithme de Nagle pour envoyer immédiatement (pas de buffering)
- **SO_KEEPALIVE** : Maintient la connexion TCP ouverte pour détecter les déconnexions
- **Timeout** : Délai maximum d'attente d'une réponse avant de déclarer une erreur

---

## 5. Analyse de Trame Avancée (Onglet 5)

**Ce qui est affiché :** Une simulation complète d'échange client/serveur Modbus TCP.

### Simulation en 7 étapes :
1. **SYN/SYN-ACK/ACK** — "Le handshake TCP à 3 voies établit la connexion sur le port 502"
2. **Construction ADU** — "Le client assemble le MBAP Header + PDU avec Transaction ID 0x0001"
3. **Encapsulation TCP/IP** — "L'ADU descend les couches : Application → TCP → IP → Ethernet"
4. **Envoi sur Ethernet** — "Le segment TCP est transmis vers le serveur Modbus"
5. **Traitement Serveur** — "Le serveur vérifie Unit ID, Function Code et adresse registre"
6. **Réponse Modbus** — "Le serveur renvoie les valeurs des registres dans la PDU"
7. **Confirmation Client** — "Le client valide le Transaction ID et livre les données"

### Trames affichées octet par octet :

**Requête (bleu) :**
```
00 01 | 00 00 | 00 06 | 01 | 03 | 00 6B | 00 03
 TID  | PID   | LEN   |UID| FC | Start | Qty
```
→ "Lire 3 registres à partir de l'adresse 0x006B sur l'esclave 0x01"

**Réponse (vert) :**
```
00 01 | 00 00 | 00 09 | 01 | 03 | 06 | 02 2B 00 00 00 64
 TID  | PID   | LEN   |UID| FC | BC |   Registres
```
→ "Le serveur renvoie 6 octets (3 registres × 2 octets) : 555, 0, 100"

**Exception (rouge) :**
```
00 01 | 00 00 | 00 03 | 01 | 83 | 02
 TID  | PID   | LEN   |UID|FC+80| Code
```
→ "FC 0x83 = FC 03 + 0x80 signale une erreur. Code 02 = Adresse invalide"

### Passage dans les couches :
- Chaque couche ajoute son en-tête (encapsulation)
- Latence totale aller-retour : ~4.6 ms

---

## 6. Dashboard Live (Onglet 6)

**Ce qui est affiché :** 4 graphiques en temps réel.

### Graphique 1 : Trafic Modbus (24h)
- Courbe verte = nombre de requêtes par heure (~180-320)
- Courbe rouge = nombre d'erreurs par heure (~2-14)
- "On voit que le trafic est continu avec un faible taux d'erreur, typique d'un réseau industriel stable"

### Graphique 2 : Distribution des Function Codes (Pie Chart)
- Montre la répartition des codes fonction utilisés
- "FC 03 (Read Holding Registers) est le plus fréquent car c'est la lecture de capteurs"

### Graphique 3 : Latence par couche TCP/IP (Bar Chart)
- Affiche le temps de traversée de chaque couche en ms
- "La couche Transport (TCP) est la plus lente car elle gère la fiabilité"

### Graphique 4 : Fréquence des Exceptions
- Les types d'erreurs Modbus les plus fréquents
- "L'exception 02 (Illegal Data Address) est la plus courante"

---

## 7. RTU vs TCP/IP (Onglet 7)

**Ce qui est affiché :** Comparaison entre les deux modes de transport Modbus.

| Critère | Modbus RTU | Modbus TCP/IP |
|---------|-----------|---------------|
| Support physique | RS-485 (série) | Ethernet |
| Vitesse | 9600-115200 baud | 10/100 Mbps |
| Détection erreurs | CRC-16 (0xA001) | TCP Checksum |
| Adressage | 1-247 (8 bits) | IP + Unit ID |
| Topologie | Bus (maître unique) | Étoile (multi-maître) |
| Connexion | Half-duplex | Full-duplex |

---

## 8. Séquences (Onglet 8)

**Ce qui est affiché :** Diagrammes de séquence montrant les échanges Modbus.

- "Ces diagrammes montrent le timing exact des échanges entre client et serveur"
- Requête → Attente → Réponse (ou Exception)

---

## 9. Générateur de Trame (Onglet 9) ⭐

**Ce qui est affiché :** Interface de construction manuelle de trames avec 5 protocoles.

### Mode Modbus RTU — CRC-16
- **Saisie :** Adresse (ex: 01), Fonction (ex: 03), Données (ex: 00 6B 00 03)
- **Calcul :** CRC-16 avec polynôme générateur `0xA001` (x¹⁶+x¹⁵+x²+1)
- **Algorithme :** Registre à décalage initialisé à 0xFFFF, XOR bit par bit
- **Résultat :** 2 octets en Little-Endian (octet bas en premier)
- **Exemple :** Pour `01 03 00 6B 00 03` → CRC = `B5 D4`

### Mode Modbus ASCII — LRC
- **Saisie :** Mêmes champs que RTU
- **Calcul :** LRC = complément à 2 de la somme de tous les octets
- **Algorithme :** On additionne tous les octets, puis on fait (~somme + 1) & 0xFF
- **Résultat :** 1 seul octet
- **Trame :** Commence par `:` et finit par `CR LF`
- **Exemple :** Pour `01 03 00 6B 00 03` → LRC = `8E`

### Mode Modbus TCP/IP — Checksum TCP
- **Saisie :** Unit ID, Fonction, Données
- **Calcul :** Checksum TCP (complément à 1 de la somme des mots 16 bits)
- **Particularité :** Pas de CRC au niveau applicatif ! C'est TCP (couche 4) qui gère
- **Trame :** MBAP Header (7 octets) + PDU, pas de CRC ajouté
- **Résultat :** La valeur affichée est le checksum que TCP calculerait

### Mode CAN 2.0A (Standard) — CRC-15
- **Saisie :** ID (11 bits), RTR, DLC, Données
- **Calcul :** CRC-15 avec polynôme `0x4599`
- **Structure :** SOF | ID | RTR | IDE=0 | DLC | Data | CRC-15 | ACK | EOF

### Mode CAN 2.0B (Extended) — CRC-15
- **Saisie :** ID (29 bits), RTR, DLC, Données
- **Calcul :** Même CRC-15 que 2.0A
- **Différence :** IDE=1, identifiant sur 29 bits au lieu de 11

---

## 10. Résumé pour la prof

> "Ce dashboard est un outil pédagogique qui visualise en temps réel le fonctionnement des protocoles industriels Modbus TCP/IP, Modbus RTU, Modbus ASCII et CAN. Il permet de comprendre l'encapsulation des données dans les couches TCP/IP, la structure des trames MBAP, les codes fonction standardisés, et surtout de construire manuellement des trames avec calcul automatique des checksums (CRC-16, LRC, CRC-15). Chaque composant est animé pour rendre visible ce qui est normalement invisible sur le réseau."

---
*Document préparé pour la soutenance de Firas Mrabet & Oumayma Sfaxi*
