import type { UserLocale } from "@/lib/user-locale";

export type Messages = {
  nav: {
    home: string;
    discover: string;
    publish: string;
    sellVideo: string;
    messages: string;
    cart: string;
    profile: string;
    wallet: string;
    notifications: string;
  };
  auth: {
    login: string;
    register: string;
    loginTitle: string;
    loginHint: string;
    email: string;
    emailOptional: string;
    emailInvalid: string;
    identifier: string;
    phone: string;
    phoneInvalid: string;
    phoneTaken: string;
    password: string;
    name: string;
    nameInvalid: string;
    submit: string;
    submitting: string;
    noAccount: string;
    createAccount: string;
    welcome: string;
    failed: string;
    registerTitle: string;
    registerHint: string;
    registerSubmit: string;
    registerSubmitting: string;
    hasAccount: string;
    registerWelcome: string;
    registerFailed: string;
    accountDisabled: string;
    forgotLink: string;
    forgotTitle: string;
    forgotHint: string;
    forgotOtpHint: string;
    sendOtp: string;
    sendingOtp: string;
    otpSent: string;
    otpCode: string;
    otpInvalid: string;
    otpExpired: string;
    newPassword: string;
    confirmPassword: string;
    passwordMismatch: string;
    resetPassword: string;
    resetting: string;
    resendOtp: string;
    resetDone: string;
    resetRequestFailed: string;
    resetConfirmFailed: string;
    phoneTakenHelp: string;
    goForgotPassword: string;
  };
  media: {
    nsfwRejected: string;
    moderationUnavailable: string;
  };
  settings: {
    appearance: string;
    appearanceHint: string;
    languageAndTheme: string;
    language: string;
    languageHint: string;
    theme: string;
    themeHint: string;
    themeLight: string;
    themeDark: string;
    languageUpdated: string;
    themeUpdated: string;
    logout: string;
  };
  hours: {
    title: string;
    hint: string;
    always: string;
    scheduled: string;
    start: string;
    end: string;
    days: string;
    closeAt: string;
    openDays: string;
    saved: string;
    saveFailed: string;
    shop: string;
    d0: string;
    d1: string;
    d2: string;
    d3: string;
    d4: string;
    d5: string;
    d6: string;
  };
  common: {
    back: string;
    close: string;
    loading: string;
    cancel: string;
    save: string;
    next: string;
    see: string;
    copyImpossible: string;
    kinshasa: string;
  };
  feed: {
    tabFollowing: string;
    tabForYou: string;
    tabWanted: string;
    loginToFollowTitle: string;
    loginToFollowHint: string;
    emptyFollowingTitle: string;
    emptyFollowingHint: string;
    exploreForYou: string;
    emptyForYouTitle: string;
    emptyForYouHint: string;
    moneyProtected: string;
    like: string;
    msg: string;
    comments: string;
    commentsTitle: string;
    commentPlaceholder: string;
    commentEmpty: string;
    commentFailed: string;
    commentSend: string;
    share: string;
    messageSeller: string;
    likeFailed: string;
    likeSent: string;
    likeRemoved: string;
    conversationFailed: string;
    newListing: string;
  };
  discover: {
    searchPlaceholder: string;
    categoriesHeading: string;
    trendsHeading: string;
    featuredHeading: string;
    videoHeading: string;
    budgetHeading: string;
    resultsHeading: string;
    emptyResults: string;
    nearMe: string;
    challengeHeading: string;
    challengeMission: string;
    challengePulse: string;
    storiesHeading: string;
    challengeJoin: string;
    challengeJoinPlus: string;
    challengeJoined: string;
    participants: string;
    participantsOther: string;
    seeAll: string;
    videoOfMoment: string;
    views: string;
  };
  shop: {
    notFound: string;
    backToFeed: string;
    ref: string;
    productOne: string;
    productOther: string;
    contactUnpublished: string;
    seeAddress: string;
    copyLink: string;
    share: string;
    message: string;
    logo: string;
    logoHint: string;
    logoSaved: string;
    changeLogo: string;
    currency: string;
    currencyHint: string;
    linkCopied: string;
    coordinates: string;
    openInMaps: string;
    searchPlaceholder: string;
    filterAll: string;
    emptyTitle: string;
    emptyFilter: string;
    emptyNone: string;
    interestedIn: string;
    messageFailed: string;
    discoverShop: string;
  };
  product: {
    payFromWallet: string;
    likes: string;
    comments: string;
    commentAria: string;
    color: string;
    size: string;
    sold: string;
    unavailable: string;
    addToCart: string;
    adding: string;
    payNow: string;
    processing: string;
    contactSeller: string;
    likeAria: string;
    messageAria: string;
    insufficientTitle: string;
    topUpCta: string;
    onShipShop: string;
    manageOwn: string;
    edit: string;
    archive: string;
    republish: string;
    delete: string;
    editTitle: string;
    save: string;
    cancel: string;
    archived: string;
    republished: string;
    deleted: string;
    updated: string;
    deleteConfirm: string;
    deleteBlocked: string;
  };
  buy: {
    cta: string;
    payPhone: string;
    loginTitle: string;
    loginHint: string;
    phoneRequired: string;
    gpsRequired: string;
    payFailed: string;
    buyOk: string;
    realVideo: string;
    needMore: string;
    topUpHint: string;
    heldLine: string;
    confirmUssd: string;
    topUpFailed: string;
    topUpOk: string;
    held: string;
    onTheWay: string;
    readyPickup: string;
    sellerPaid: string;
    firstSaleHint: string;
    zoomHint: string;
    zoomOpen: string;
    zoomClose: string;
    stock: string;
    addCart: string;
    addedCart: string;
    keepScrolling: string;
    shopQr: string;
    qrUntilLast: string;
    pickItem: string;
    goCart: string;
    payUseCart: string;
    alreadyInCart: string;
  };
  cart: {
    title: string;
    guestHint: string;
    itemOne: string;
    itemOther: string;
    empty: string;
    discover: string;
    unavailable: string;
    confirmPurchase: string;
    cancelCart: string;
    removeAria: string;
    payOneClick: string;
    perShopQr: string;
    insufficient: string;
  };
  share: {
    aria: string;
    copyLink: string;
    moreApps: string;
    copied: string;
    copyFailed: string;
  };
  follow: {
    follow: string;
    following: string;
    subscribe: string;
    subscribed: string;
    failed: string;
  };
  categories: {
    Tech: string;
    Mode: string;
    Maison: string;
    Gaming: string;
    Beauté: string;
    Auto: string;
    Livres: string;
    Sport: string;
  };
  messages: {
    title: string;
    empty: string;
    emptyHint: string;
    urgent: string;
    writePlaceholder: string;
    ackPlaceholder: string;
    guestHint: string;
  };
  notifications: {
    title: string;
    empty: string;
    refresh: string;
    seeAll: string;
    hint: string;
    noPreview: string;
    tabMessages: string;
    tabComments: string;
    commentsEmpty: string;
    commentsHint: string;
  };
  wallet: {
    title: string;
    guestHint: string;
    topUpSimulated: string;
    history: string;
    emptyHistory: string;
    currency: string;
    amount: string;
    tabMe: string;
    tabSomeone: string;
    payHint: string;
    searchRecipient: string;
    youRecharge: string;
    myNumbers: string;
    saveNumbers: string;
    sendPay: string;
    confirmPay: string;
    ussdHint: string;
    forYou: string;
    vodacom: string;
    orange: string;
    airtel: string;
    emoneyPhone: string;
    fromBalance: string;
    sendFromBalance: string;
    balanceHint: string;
    transferOk: string;
    verifyState: string;
    connectionLost: string;
    expiredPay: string;
    txnRefund: string;
    txnPurchase: string;
    txnReceived: string;
    txnSent: string;
    txnAdjustment: string;
    heldChip: string;
  };
  shopExtra: {
    followerOne: string;
    followerOther: string;
  };
  wanted: {
    tab: string;
    title: string;
    empty: string;
    budget: string;
    newShop: string;
    used: string;
    publishWanted: string;
    publishSell: string;
    publishChooser: string;
    iHaveIt: string;
    accept: string;
    accepted: string;
    contact: string;
    myRequests: string;
    alreadyInShop: string;
    guestHint: string;
    overBudget: string;
    addProduct: string;
    removeProduct: string;
    productN: string;
    publishMany: string;
  };
  montage: {
    title: string;
    hint: string;
    music: string;
    none: string;
    analyze: string;
    analyzing: string;
    blur: string;
    stampLogo: string;
    stampPrice: string;
    eraser: string;
    apply: string;
    skip: string;
    needLogo: string;
    noSuggestions: string;
    importDevice: string;
    importing: string;
    maxOneMinute: string;
    clipWindow: string;
    clipPlay: string;
    clipPause: string;
    clipHint: string;
    importOk: string;
    undo: string;
    pickColor: string;
    brush: string;
    reset: string;
    select: string;
    autoFill: string;
    searchOnline: string;
    searchPlaceholder: string;
    searching: string;
    searchEmpty: string;
    searchHint: string;
    tempOnly: string;
    fetchOnline: string;
    slidesTitle: string;
    slidesHint: string;
    changeMotion: string;
    motionZoomIn: string;
    motionZoomOut: string;
    motionPanLeft: string;
    motionPanRight: string;
    motionPanUp: string;
  };
  publish: {
    titleProduct: string;
    titlePlaceholder: string;
    shop: string;
    media: string;
  };
  orderStatus: {
    PAID: string;
    ASSIGNED: string;
    FULFILLING: string;
    OUT_FOR_DELIVERY: string;
    READY_FOR_PICKUP: string;
    AWAITING_CONFIRM: string;
    PICKED_UP: string;
    DELIVERED: string;
    FAILED: string;
    REFUNDED: string;
    CANCELLED: string;
  };
};

const fr: Messages = {
  nav: {
    home: "Accueil",
    discover: "Découvrir",
    publish: "Publier",
    sellVideo: "Vendre",
    messages: "Messages",
    cart: "Panier",
    profile: "Profil",
    wallet: "Portefeuille",
    notifications: "Notifications",
  },
  auth: {
    login: "Connexion",
    register: "S'inscrire",
    loginTitle: "Connexion",
    loginHint: "Accédez à votre portefeuille et vos boutiques",
    email: "E-mail",
    emailOptional: "E-mail (optionnel)",
    emailInvalid: "E-mail invalide",
    identifier: "E-mail ou téléphone",
    phone: "Téléphone",
    phoneInvalid: "Numéro invalide pour ce pays",
    phoneTaken: "Ce numéro est déjà utilisé",
    password: "Mot de passe",
    name: "Nom",
    nameInvalid: "Indique ton nom (2 caractères min.)",
    submit: "Se connecter",
    submitting: "Connexion…",
    noAccount: "Pas encore de compte ?",
    createAccount: "Créer un compte",
    welcome: "Bienvenue sur ShipShop",
    failed: "Connexion impossible",
    registerTitle: "Créer un compte",
    registerHint: "Pour acheter, liker et suivre — vendre vient après",
    registerSubmit: "S'inscrire",
    registerSubmitting: "Création…",
    hasAccount: "Déjà un compte ?",
    registerWelcome: "Compte créé — portefeuille prêt",
    registerFailed: "Inscription impossible",
    accountDisabled: "Compte désactivé — contenu interdit",
    forgotLink: "Mot de passe oublié ?",
    forgotTitle: "Réinitialiser le mot de passe",
    forgotHint: "Entre ton e-mail ou ton téléphone pour recevoir un code OTP",
    forgotOtpHint: "Valide le code OTP puis choisis un nouveau mot de passe",
    sendOtp: "Envoyer le code OTP",
    sendingOtp: "Envoi du code…",
    otpSent: "Code OTP envoyé (valable 10 minutes)",
    otpCode: "Code OTP",
    otpInvalid: "Code OTP invalide",
    otpExpired: "Code OTP expiré — redemande un nouveau code",
    newPassword: "Nouveau mot de passe",
    confirmPassword: "Confirmer le mot de passe",
    passwordMismatch: "Les mots de passe ne correspondent pas",
    resetPassword: "Mettre à jour le mot de passe",
    resetting: "Mise à jour…",
    resendOtp: "Renvoyer un code",
    resetDone: "Mot de passe mis à jour — reconnecte-toi",
    resetRequestFailed: "Envoi OTP impossible",
    resetConfirmFailed: "Réinitialisation impossible",
    phoneTakenHelp:
      "Ce numéro existe déjà. Tu peux récupérer le compte avec un OTP.",
    goForgotPassword: "Changer mon mot de passe",
  },
  media: {
    nsfwRejected: "Média refusé — contenu sexuel explicite interdit",
    moderationUnavailable: "Modération indisponible — réessayez plus tard",
  },
  settings: {
    appearance: "Apparence",
    appearanceHint: "Thème et langue de l'application",
    languageAndTheme: "Langue et thème",
    language: "Langue",
    languageHint: "Français, English ou Português",
    theme: "Thème",
    themeHint: "Clair ou sombre",
    themeLight: "Clair",
    themeDark: "Sombre",
    languageUpdated: "Langue : français",
    themeUpdated: "Thème enregistré",
    logout: "Se déconnecter",
  },
  hours: {
    title: "Horaires boutique",
    hint: "Optionnel. Indiquez vos jours, l’ouverture et la fermeture, ou restez toujours disponible. Le client les voit sur ses commandes.",
    always: "Toujours disponible",
    scheduled: "Jours et heures",
    start: "Ouverture",
    end: "Fermeture",
    days: "Jours d’ouverture",
    closeAt: "Fermeture",
    openDays: "Jours",
    saved: "Horaires enregistrés",
    saveFailed: "Enregistrement impossible",
    shop: "Boutique",
    d0: "Dim",
    d1: "Lun",
    d2: "Mar",
    d3: "Mer",
    d4: "Jeu",
    d5: "Ven",
    d6: "Sam",
  },
  common: {
    back: "Retour",
    close: "Fermer",
    loading: "Chargement",
    cancel: "Annuler",
    save: "Enregistrer",
    next: "Suivant",
    see: "Voir",
    copyImpossible: "Copie impossible",
    kinshasa: "Kinshasa",
  },
  feed: {
    tabFollowing: "Abonnements",
    tabForYou: "Pour toi",
    tabWanted: "Je cherche",
    loginToFollowTitle: "Connectez-vous pour voir vos abonnements",
    loginToFollowHint:
      "Suivez des boutiques, aimez, achetez ou partagez : tout ça apparaîtra ici.",
    emptyFollowingTitle: "Rien dans Abonnements",
    emptyFollowingHint:
      "Ici : nouveautés des boutiques suivies, plus tes likes, achats, commandes reçues et partages.",
    exploreForYou: "Explorer Pour toi",
    emptyForYouTitle: "Aucune annonce encore",
    emptyForYouHint: "Soyez le premier à publier sur ShipShop",
    moneyProtected: "Tu paies. On bloque. Reçu = vendeur payé.",
    like: "Like",
    msg: "Msg",
    comments: "Commentaires",
    commentsTitle: "Commentaires",
    commentPlaceholder: "Écrire un commentaire…",
    commentEmpty: "Soyez le premier à commenter",
    commentFailed: "Impossible de commenter",
    commentSend: "Envoyer",
    share: "Partager",
    messageSeller: "Message au vendeur",
    likeFailed: "Impossible d'aimer",
    likeSent: "Like envoyé au vendeur",
    likeRemoved: "Like retiré — message vendeur annulé",
    conversationFailed: "Impossible d'ouvrir la conversation",
    newListing: "Nouveau",
  },
  discover: {
    searchPlaceholder: "Rechercher un produit, vendeur…",
    categoriesHeading: "Catégories",
    trendsHeading: "Tendances à Kinshasa",
    featuredHeading: "À la une",
    videoHeading: "Vidéos et sons",
    budgetHeading: "Petits prix",
    resultsHeading: "Tous les produits",
    emptyResults: "Aucun résultat",
    nearMe: "Près de moi",
    challengeHeading: "Challenge du jour",
    challengeMission: "Mission",
    challengePulse: "En ce moment",
    storiesHeading: "Stories partenaires",
    challengeJoin: "Je relève",
    challengeJoinPlus: "+1 Je relève",
    challengeJoined: "Relevé",
    participants: "participant",
    participantsOther: "participants",
    seeAll: "Voir tout",
    videoOfMoment: "Vidéo du moment",
    views: "vues",
  },
  shop: {
    notFound: "Boutique introuvable",
    backToFeed: "Retour au feed",
    ref: "réf.",
    productOne: "produit",
    productOther: "produits",
    contactUnpublished: "Contact non publié",
    seeAddress: "Voir l'adresse",
    copyLink: "Copier le lien",
    share: "Partager",
    message: "Message",
    logo: "Logo boutique",
    logoHint: "Image carrée — visible partout avec le nom de la boutique",
    logoSaved: "Logo enregistré",
    changeLogo: "Changer le logo",
    currency: "Monnaie",
    currencyHint: "Monnaie affichée pour cette boutique",
    linkCopied: "Lien boutique copié",
    coordinates: "Coordonnées",
    openInMaps: "Ouvrir dans Maps →",
    searchPlaceholder: "Rechercher un produit…",
    filterAll: "Tout",
    emptyTitle: "Aucun produit",
    emptyFilter: "Aucun résultat pour ce filtre",
    emptyNone: "Cette boutique n'a pas encore d'annonces actives",
    interestedIn: "Bonjour, je suis intéressé par",
    messageFailed: "Message impossible",
    discoverShop: "Découvrez",
  },
  product: {
    payFromWallet: "Payer au téléphone — argent bloqué jusqu’à la réception",
    likes: "j'aime",
    comments: "commentaires",
    commentAria: "Commentaires",
    color: "Couleur",
    size: "Taille",
    sold: "Déjà vendu",
    unavailable: "Indisponible",
    addToCart: "Ajouter au panier",
    adding: "Ajout…",
    payNow: "Payer maintenant",
    processing: "Traitement…",
    contactSeller: "Contacter le vendeur",
    likeAria: "Aimer",
    messageAria: "Message vendeur",
    insufficientTitle: "Solde insuffisant",
    topUpCta: "Recharger mon compte",
    onShipShop: "sur ShipShop",
    manageOwn: "Votre produit",
    edit: "Modifier",
    archive: "Archiver",
    republish: "Republier",
    delete: "Supprimer",
    editTitle: "Modifier le produit",
    save: "Enregistrer",
    cancel: "Annuler",
    archived: "Produit archivé",
    republished: "Produit republié",
    deleted: "Produit supprimé",
    updated: "Produit mis à jour",
    deleteConfirm: "Supprimer définitivement ce produit ?",
    deleteBlocked: "Lié à un paiement — archivez-le plutôt",
  },
  buy: {
    cta: "Acheter",
    payPhone: "Payer au téléphone",
    loginTitle: "Connecte-toi pour acheter",
    loginHint: "Même écran — tu reviens tout de suite à cette vidéo.",
    phoneRequired: "Indique un numéro avec l’indicatif pays",
    gpsRequired: "Partage ta position GPS pour livrer ici",
    payFailed: "Achat impossible",
    buyOk: "Payé et bloqué — le vendeur est payé quand tu reçois",
    realVideo: "Vidéo du vrai article",
    needMore: "Il te faut",
    topUpHint: "Recharge ici, sans quitter l’achat.",
    heldLine: "Tu paies. On bloque. Le vendeur est payé quand tu reçois.",
    confirmUssd: "J’ai validé sur le téléphone",
    topUpFailed: "Recharge impossible",
    topUpOk: "Compte rechargé",
    held: "Payé et bloqué",
    onTheWay: "En route",
    readyPickup: "Prêt au retrait",
    sellerPaid: "Reçu, vendeur payé",
    firstSaleHint: "Première vente : scanne le QR et remets le colis.",
    zoomHint: "Pince ou double-tape pour zoomer",
    zoomOpen: "Agrandir la photo",
    zoomClose: "Fermer le zoom",
    stock: "Stock",
    addCart: "Ajouter au panier",
    addedCart: "Dans le panier — tu paies en 1 clic",
    keepScrolling: "Continuer à scroller",
    shopQr: "QR de cette boutique",
    qrUntilLast:
      "Chaque article a son QR. Quand cette boutique l’a remis, son QR se termine et ce produit seul est payé après confirmation.",
    pickItem: "Quel article tu remets ?",
    goCart: "Aller au panier",
    payUseCart: "Déjà un article au panier — paie tout en 1 clic au panier",
    alreadyInCart: "Déjà dans le panier",
  },
  cart: {
    title: "Panier",
    guestHint: "Connectez-vous pour voir votre panier",
    itemOne: "article",
    itemOther: "articles",
    empty: "Votre panier est vide",
    discover: "Découvrir",
    unavailable: "Plus disponible",
    confirmPurchase: "Confirmer l'achat",
    cancelCart: "Annuler le panier",
    removeAria: "Retirer du panier",
    payOneClick: "Payer en 1 clic",
    perShopQr: "Chaque boutique reçoit seulement ses articles — 1 QR à scanner.",
    insufficient: "Solde insuffisant — rechargez votre portefeuille",
  },
  share: {
    aria: "Partager",
    copyLink: "Copier le lien",
    moreApps: "Plus d'apps",
    copied: "Lien ShipShop copié",
    copyFailed: "Copie impossible",
  },
  follow: {
    follow: "Suivre",
    following: "Suivi",
    subscribe: "S'abonner",
    subscribed: "Abonné",
    failed: "Impossible de suivre",
  },
  categories: {
    Tech: "Tech",
    Mode: "Mode",
    Maison: "Maison",
    Gaming: "Gaming",
    Beauté: "Beauté",
    Auto: "Auto",
    Livres: "Livres",
    Sport: "Sport",
  },
  messages: {
    title: "Messages",
    empty: "Aucune conversation. Ouvrez une boutique et touchez l'icône Messages.",
    emptyHint: "Pour écrire à un nouveau vendeur, ouvrez sa boutique.",
    urgent: "Urgent",
    writePlaceholder: "Écrire un message…",
    ackPlaceholder: "Répondre pour acquitter l'urgence…",
    guestHint: "Connectez-vous pour voir vos messages",
  },
  notifications: {
    title: "Notifications",
    empty: "Aucun message pour le moment",
    refresh: "Actualiser",
    seeAll: "Voir tous les messages",
    hint: "Nouveaux messages — actualisation auto toutes les 25 s",
    noPreview: "Nouvelle conversation",
    tabMessages: "Messages",
    tabComments: "Commentaires",
    commentsEmpty: "Aucun commentaire sur vos produits",
    commentsHint: "Messages et commentaires non lus",
  },
  wallet: {
    title: "Mon portefeuille",
    guestHint: "Connectez-vous pour gérer votre solde",
    topUpSimulated: "Recharger",
    history: "Historique",
    emptyHistory: "Aucune transaction",
    currency: "Monnaie",
    amount: "Montant",
    tabMe: "Moi",
    tabSomeone: "Quelqu'un",
    payHint:
      "Vous payez ShipShop avec votre réseau. Le bénéficiaire reçoit du e-money ShipShop — un seul solde, quel que soit Airtel, Orange ou Vodacom.",
    searchRecipient: "Nom, boutique ou numéro",
    youRecharge: "Vous rechargez",
    myNumbers: "Mes numéros e-money",
    saveNumbers: "Enregistrer les numéros",
    sendPay: "Demander le paiement",
    confirmPay: "Confirmer le dépôt",
    ussdHint: "Envoyez le montant au numéro caisse ShipShop, puis confirmez.",
    forYou: "pour toi",
    vodacom: "Vodacom M-Pesa",
    orange: "Orange Money",
    airtel: "Airtel Money",
    emoneyPhone: "Votre numéro sur ce réseau",
    fromBalance: "Solde ShipShop",
    sendFromBalance: "Envoyer depuis mon solde",
    balanceHint:
      "Sans réseau : ShipShop débite votre solde et crédite le bénéficiaire.",
    transferOk: "Transfert effectué",
    verifyState: "Vérifier l’état",
    connectionLost: "Connexion interrompue — on vérifie le paiement, sans renvoyer.",
    expiredPay: "Délai dépassé — relancez une nouvelle demande.",
    txnRefund: "Remboursement",
    txnPurchase: "Achat",
    txnReceived: "Reçu",
    txnSent: "Envoyé",
    txnAdjustment: "Ajustement",
    heldChip: "Solde bloqué",
  },
  shopExtra: {
    followerOne: "abonné",
    followerOther: "abonnés",
  },
  wanted: {
    tab: "Je cherche",
    title: "Je cherche",
    empty: "Aucune demande ouverte. Publiez ce que vous cherchez.",
    budget: "Budget max",
    newShop: "Neuf / magasin",
    used: "Occasion",
    publishWanted: "Je cherche",
    publishSell: "Vendre",
    publishChooser: "Que voulez-vous faire ?",
    iHaveIt: "J’ai ça",
    accept: "Accepter et mettre au panier",
    accepted: "Offre acceptée — ouvrez le panier pour payer",
    contact: "Écrire",
    myRequests: "Mes demandes",
    alreadyInShop: "Déjà en magasin",
    guestHint: "Connectez-vous pour publier une demande",
    overBudget: "Au-dessus du budget",
    addProduct: "Ajouter un autre produit",
    removeProduct: "Retirer",
    productN: "Produit",
    publishMany: "Publier les demandes",
  },
  montage: {
    title: "Montage",
    hint: "Le fichier reste dans le navigateur jusqu’à la publication. On n’enregistre que l’extrait d’1 minute du produit — l’original n’est pas gardé. Si la vidéo a déjà un son, elle devient muette.",
    music: "Musique / son",
    none: "Sans musique",
    analyze: "Détecter les objets",
    analyzing: "Analyse…",
    blur: "Masquer l’objet",
    stampLogo: "Tampon logo",
    stampPrice: "Tampon prix",
    eraser: "Gomme",
    apply: "Appliquer",
    skip: "Passer",
    needLogo: "Ajoutez d'abord le logo de votre boutique",
    noSuggestions: "Rien de détecté — pipettez le fond puis gommez",
    importDevice: "Importer musique ou vidéo",
    importing: "Import…",
    maxOneMinute: "1 minute sur le produit",
    clipWindow: "Extrait (1 min)",
    clipPlay: "Écouter l’extrait",
    clipPause: "Pause",
    clipHint: "Faites glisser pour choisir la minute jouée. Écoutez avant de publier.",
    importOk: "Son importé — choisissez 1 minute",
    undo: "Annuler",
    pickColor: "Pipette (couleur de fond)",
    brush: "Taille de gomme",
    reset: "Image d’origine",
    select: "Sélection",
    autoFill: "Fond auto (pixels autour)",
    searchOnline: "Chercher en ligne",
    searchPlaceholder: "Nom ou titre (ex. rumba, actualités)",
    searching: "Recherche…",
    searchEmpty: "Aucun son libre trouvé — essayez un autre titre",
    searchHint:
      "Pas de fichier sur l’appareil ? Cherchez un titre : extraits du domaine public (Internet Archive), pas de téléchargement pirate.",
    tempOnly: "Temporaire — supprimé après publication",
    fetchOnline: "Utiliser ce son",
    slidesTitle: "Images sur 1 minute",
    slidesHint:
      "Jusqu’à 12 images : elles défilent pendant la minute de son. Peu d’images = plus lent. Choisissez le mouvement de chaque vue.",
    changeMotion: "Animation",
    motionZoomIn: "Zoom avant",
    motionZoomOut: "Zoom arrière",
    motionPanLeft: "Travelling gauche",
    motionPanRight: "Travelling droit",
    motionPanUp: "Travelling haut",
  },
  publish: {
    titleProduct: "Titre (produit)",
    titlePlaceholder: "iPhone 15 Pro Max 256Go",
    shop: "Boutique",
    media: "Images / vidéos",
  },
  orderStatus: {
    PAID: "Payé et bloqué",
    ASSIGNED: "Livreur assigné",
    FULFILLING: "Préparation",
    OUT_FOR_DELIVERY: "En route",
    READY_FOR_PICKUP: "Prêt au retrait",
    AWAITING_CONFIRM: "Confirme la réception",
    PICKED_UP: "Retiré",
    DELIVERED: "Livré",
    FAILED: "Échoué",
    REFUNDED: "Remboursé",
    CANCELLED: "Annulé",
  },
};

const en: Messages = {
  nav: {
    home: "Home",
    discover: "Discover",
    publish: "Sell",
    sellVideo: "Sell",
    messages: "Messages",
    cart: "Cart",
    profile: "Profile",
    wallet: "Wallet",
    notifications: "Notifications",
  },
  auth: {
    login: "Sign in",
    register: "Sign up",
    loginTitle: "Sign in",
    loginHint: "Access your wallet and shops",
    email: "Email",
    emailOptional: "Email (optional)",
    emailInvalid: "Invalid email",
    identifier: "Email or phone",
    phone: "Phone",
    phoneInvalid: "Invalid number for this country",
    phoneTaken: "This number is already in use",
    password: "Password",
    name: "Name",
    nameInvalid: "Enter your name (2 characters min.)",
    submit: "Sign in",
    submitting: "Signing in…",
    noAccount: "No account yet?",
    createAccount: "Create an account",
    welcome: "Welcome to ShipShop",
    failed: "Sign-in failed",
    registerTitle: "Create an account",
    registerHint: "Required to buy and sell on ShipShop",
    registerSubmit: "Sign up",
    registerSubmitting: "Creating…",
    hasAccount: "Already have an account?",
    registerWelcome: "Account created — wallet ready",
    registerFailed: "Sign-up failed",
    accountDisabled: "Account disabled — prohibited content",
    forgotLink: "Forgot password?",
    forgotTitle: "Reset password",
    forgotHint: "Enter your email or phone to receive an OTP code",
    forgotOtpHint: "Verify the OTP code, then set a new password",
    sendOtp: "Send OTP code",
    sendingOtp: "Sending code…",
    otpSent: "OTP code sent (valid for 10 minutes)",
    otpCode: "OTP code",
    otpInvalid: "Invalid OTP code",
    otpExpired: "OTP expired — request a new code",
    newPassword: "New password",
    confirmPassword: "Confirm password",
    passwordMismatch: "Passwords do not match",
    resetPassword: "Update password",
    resetting: "Updating…",
    resendOtp: "Send again",
    resetDone: "Password updated — sign in again",
    resetRequestFailed: "Could not send OTP",
    resetConfirmFailed: "Could not reset password",
    phoneTakenHelp: "This number already has an account. Recover it with OTP.",
    goForgotPassword: "Reset my password",
  },
  media: {
    nsfwRejected: "Media rejected — explicit sexual content is not allowed",
    moderationUnavailable: "Moderation unavailable — try again later",
  },
  settings: {
    appearance: "Appearance",
    appearanceHint: "App theme and language",
    languageAndTheme: "Language and theme",
    language: "Language",
    languageHint: "French, English or Portuguese",
    theme: "Theme",
    themeHint: "Light or dark",
    themeLight: "Light",
    themeDark: "Dark",
    languageUpdated: "Language: English",
    themeUpdated: "Theme saved",
    logout: "Sign out",
  },
  hours: {
    title: "Shop hours",
    hint: "Optional. Set working days and open/close times, or stay always available. Buyers see this on their orders.",
    always: "Always available",
    scheduled: "Days and hours",
    start: "Opens",
    end: "Closes",
    days: "Open days",
    closeAt: "Closes",
    openDays: "Days",
    saved: "Hours saved",
    saveFailed: "Could not save",
    shop: "Shop",
    d0: "Sun",
    d1: "Mon",
    d2: "Tue",
    d3: "Wed",
    d4: "Thu",
    d5: "Fri",
    d6: "Sat",
  },
  common: {
    back: "Back",
    close: "Close",
    loading: "Loading",
    cancel: "Cancel",
    save: "Save",
    next: "Next",
    see: "View",
    copyImpossible: "Could not copy",
    kinshasa: "Kinshasa",
  },
  feed: {
    tabFollowing: "Following",
    tabForYou: "For you",
    tabWanted: "Wanted",
    loginToFollowTitle: "Sign in to see who you follow",
    loginToFollowHint:
      "Follow shops, like, buy or share — it all shows up here.",
    emptyFollowingTitle: "Nothing in Following yet",
    emptyFollowingHint:
      "Here: updates from shops you follow, plus your likes, purchases, deliveries and shares.",
    exploreForYou: "Explore For you",
    emptyForYouTitle: "No listings yet",
    emptyForYouHint: "Be the first to post on ShipShop",
    moneyProtected: "Money protected",
    like: "Like",
    msg: "Msg",
    comments: "Comments",
    commentsTitle: "Comments",
    commentPlaceholder: "Write a comment…",
    commentEmpty: "Be the first to comment",
    commentFailed: "Could not comment",
    commentSend: "Send",
    share: "Share",
    messageSeller: "Message seller",
    likeFailed: "Could not like",
    likeSent: "Like sent to seller",
    likeRemoved: "Like removed — seller message cancelled",
    conversationFailed: "Could not open conversation",
    newListing: "New",
  },
  discover: {
    searchPlaceholder: "Search a product, seller…",
    categoriesHeading: "Categories",
    trendsHeading: "Trending in Kinshasa",
    featuredHeading: "Featured",
    videoHeading: "Videos and sound",
    budgetHeading: "Budget picks",
    resultsHeading: "All products",
    emptyResults: "No results",
    nearMe: "Near me",
    challengeHeading: "Challenge of the day",
    challengeMission: "Mission",
    challengePulse: "Right now",
    storiesHeading: "Partner stories",
    challengeJoin: "I take it on",
    challengeJoinPlus: "+1 I take it on",
    challengeJoined: "Joined",
    participants: "participant",
    participantsOther: "participants",
    seeAll: "See all",
    videoOfMoment: "Video of the moment",
    views: "views",
  },
  shop: {
    notFound: "Shop not found",
    backToFeed: "Back to feed",
    ref: "ref.",
    productOne: "product",
    productOther: "products",
    contactUnpublished: "Contact not published",
    seeAddress: "See address",
    copyLink: "Copy link",
    share: "Share",
    message: "Message",
    logo: "Shop logo",
    logoHint: "Square image — shown wherever the shop name appears",
    logoSaved: "Logo saved",
    changeLogo: "Change logo",
    currency: "Currency",
    currencyHint: "Display currency for this shop",
    linkCopied: "Shop link copied",
    coordinates: "Coordinates",
    openInMaps: "Open in Maps →",
    searchPlaceholder: "Search a product…",
    filterAll: "All",
    emptyTitle: "No products",
    emptyFilter: "No results for this filter",
    emptyNone: "This shop has no active listings yet",
    interestedIn: "Hi, I'm interested in",
    messageFailed: "Could not send message",
    discoverShop: "Discover",
  },
  product: {
    payFromWallet: "Pay from prepaid balance",
    likes: "likes",
    comments: "comments",
    commentAria: "Comments",
    color: "Color",
    size: "Size",
    sold: "Sold out",
    unavailable: "Unavailable",
    addToCart: "Add to cart",
    adding: "Adding…",
    payNow: "Pay now",
    processing: "Processing…",
    contactSeller: "Contact seller",
    likeAria: "Like",
    messageAria: "Message seller",
    insufficientTitle: "Insufficient balance",
    topUpCta: "Top up my wallet",
    onShipShop: "on ShipShop",
    manageOwn: "Your product",
    edit: "Edit",
    archive: "Archive",
    republish: "Republish",
    delete: "Delete",
    editTitle: "Edit product",
    save: "Save",
    cancel: "Cancel",
    archived: "Product archived",
    republished: "Product republished",
    deleted: "Product deleted",
    updated: "Product updated",
    deleteConfirm: "Permanently delete this product?",
    deleteBlocked: "Linked to a payment — archive it instead",
  },
  buy: {
    cta: "Buy",
    payPhone: "Pay with phone",
    loginTitle: "Sign in to buy",
    loginHint: "Stay on this video — you’ll come right back.",
    phoneRequired: "Add a phone number with country code",
    gpsRequired: "Share GPS to deliver here",
    payFailed: "Purchase failed",
    buyOk: "Paid and held — seller is paid when you receive",
    realVideo: "Video of the real item",
    needMore: "You need",
    topUpHint: "Top up here, without leaving checkout.",
    heldLine: "You pay. We hold. Seller is paid when you receive.",
    confirmUssd: "I confirmed on my phone",
    topUpFailed: "Top-up failed",
    topUpOk: "Wallet topped up",
    held: "Paid and held",
    onTheWay: "On the way",
    readyPickup: "Ready for pickup",
    sellerPaid: "Received, seller paid",
    firstSaleHint: "First sale: scan the QR and hand over the parcel.",
    zoomHint: "Pinch or double-tap to zoom",
    zoomOpen: "Enlarge photo",
    zoomClose: "Close zoom",
    stock: "Stock",
    addCart: "Add to cart",
    addedCart: "In your cart — pay in 1 tap",
    keepScrolling: "Keep scrolling",
    shopQr: "This shop’s QR",
    qrUntilLast:
      "Each item has its own QR. When this shop hands it over, that QR ends and only that product is paid after confirmation.",
    pickItem: "Which item are you handing over?",
    goCart: "Go to cart",
    payUseCart: "Cart already has an item — pay everything in 1 tap from the cart",
    alreadyInCart: "Already in your cart",
  },
  cart: {
    title: "Cart",
    guestHint: "Sign in to see your cart",
    itemOne: "item",
    itemOther: "items",
    empty: "Your cart is empty",
    discover: "Discover",
    unavailable: "No longer available",
    confirmPurchase: "Confirm purchase",
    cancelCart: "Clear cart",
    removeAria: "Remove from cart",
    payOneClick: "Pay in 1 tap",
    perShopQr: "Each shop only gets its items — one QR to scan.",
    insufficient: "Insufficient balance — top up your wallet",
  },
  share: {
    aria: "Share",
    copyLink: "Copy link",
    moreApps: "More apps",
    copied: "ShipShop link copied",
    copyFailed: "Could not copy",
  },
  follow: {
    follow: "Follow",
    following: "Following",
    subscribe: "Subscribe",
    subscribed: "Subscribed",
    failed: "Could not follow",
  },
  categories: {
    Tech: "Tech",
    Mode: "Fashion",
    Maison: "Home",
    Gaming: "Gaming",
    Beauté: "Beauty",
    Auto: "Auto",
    Livres: "Books",
    Sport: "Sports",
  },
  messages: {
    title: "Messages",
    empty: "No conversations yet. Open a shop and tap the Messages icon.",
    emptyHint: "To write to a new seller, open their shop.",
    urgent: "Urgent",
    writePlaceholder: "Write a message…",
    ackPlaceholder: "Reply to acknowledge the urgent alert…",
    guestHint: "Sign in to see your messages",
  },
  notifications: {
    title: "Notifications",
    empty: "No messages yet",
    refresh: "Refresh",
    seeAll: "See all messages",
    hint: "New messages — auto-refresh every 25s",
    noPreview: "New conversation",
    tabMessages: "Messages",
    tabComments: "Comments",
    commentsEmpty: "No comments on your products",
    commentsHint: "Unread messages and comments",
  },
  wallet: {
    title: "My wallet",
    guestHint: "Sign in to manage your balance",
    topUpSimulated: "Top up",
    history: "History",
    emptyHistory: "No transactions",
    currency: "Currency",
    amount: "Amount",
    tabMe: "Me",
    tabSomeone: "Someone",
    payHint:
      "You pay ShipShop on your network. The recipient gets ShipShop e-money — one balance, whether Airtel, Orange or Vodacom.",
    searchRecipient: "Name, shop or number",
    youRecharge: "You are topping up",
    myNumbers: "My e-money numbers",
    saveNumbers: "Save numbers",
    sendPay: "Request payment",
    confirmPay: "Confirm deposit",
    ussdHint: "Send the amount to the ShipShop till number, then confirm.",
    forYou: "for you",
    vodacom: "Vodacom M-Pesa",
    orange: "Orange Money",
    airtel: "Airtel Money",
    emoneyPhone: "Your number on this network",
    fromBalance: "ShipShop balance",
    sendFromBalance: "Send from my balance",
    balanceHint:
      "No network: ShipShop debits your balance and credits the recipient.",
    transferOk: "Transfer complete",
    verifyState: "Check status",
    connectionLost: "Connection lost — checking the payment, not sending again.",
    expiredPay: "Timed out — start a new request.",
    txnRefund: "Refund",
    txnPurchase: "Purchase",
    txnReceived: "Received",
    txnSent: "Sent",
    txnAdjustment: "Adjustment",
    heldChip: "Funds held",
  },
  shopExtra: {
    followerOne: "follower",
    followerOther: "followers",
  },
  wanted: {
    tab: "Wanted",
    title: "Looking for",
    empty: "No open requests. Post what you need.",
    budget: "Max budget",
    newShop: "New / shop",
    used: "Used",
    publishWanted: "I’m looking",
    publishSell: "Sell",
    publishChooser: "What do you want to do?",
    iHaveIt: "I have this",
    accept: "Accept and add to cart",
    accepted: "Offer accepted — open the cart to pay",
    contact: "Message",
    myRequests: "My requests",
    alreadyInShop: "Already in shops",
    guestHint: "Sign in to post a request",
    overBudget: "Over budget",
    addProduct: "Add another product",
    removeProduct: "Remove",
    productN: "Product",
    publishMany: "Publish requests",
  },
  montage: {
    title: "Edit",
    hint: "The file stays in the browser until you publish. Only the product’s 1-minute clip is saved — the original is discarded. Product video audio is muted.",
    music: "Music / sound",
    none: "No music",
    analyze: "Detect objects",
    analyzing: "Analyzing…",
    blur: "Hide object",
    stampLogo: "Stamp logo",
    stampPrice: "Stamp price",
    eraser: "Eraser",
    apply: "Apply",
    skip: "Skip",
    needLogo: "Add your shop logo first",
    noSuggestions: "Nothing detected — sample the background then erase",
    importDevice: "Import music or video",
    importing: "Importing…",
    maxOneMinute: "1 minute on the product",
    clipWindow: "Clip (1 min)",
    clipPlay: "Play clip",
    clipPause: "Pause",
    clipHint: "Drag to choose which minute plays. Listen before publishing.",
    importOk: "Sound imported — pick 1 minute",
    undo: "Undo",
    pickColor: "Eyedropper (background color)",
    brush: "Eraser size",
    reset: "Original image",
    select: "Select",
    autoFill: "Auto fill (nearby pixels)",
    searchOnline: "Search online",
    searchPlaceholder: "Name or title (e.g. rumba, news)",
    searching: "Searching…",
    searchEmpty: "No public-domain sound found — try another title",
    searchHint:
      "No file on this device? Search a title: public-domain clips (Internet Archive), not pirate downloads.",
    tempOnly: "Temporary — deleted after publishing",
    fetchOnline: "Use this sound",
    slidesTitle: "Images over 1 minute",
    slidesHint:
      "Up to 12 images play across the soundtrack minute. Fewer images stay longer. Pick each frame’s motion.",
    changeMotion: "Motion",
    motionZoomIn: "Zoom in",
    motionZoomOut: "Zoom out",
    motionPanLeft: "Pan left",
    motionPanRight: "Pan right",
    motionPanUp: "Pan up",
  },
  publish: {
    titleProduct: "Title (product)",
    titlePlaceholder: "iPhone 15 Pro Max 256GB",
    shop: "Shop",
    media: "Images / videos",
  },
  orderStatus: {
    PAID: "Paid and held",
    ASSIGNED: "Courier assigned",
    FULFILLING: "Preparing",
    OUT_FOR_DELIVERY: "On the way",
    READY_FOR_PICKUP: "Ready for pickup",
    AWAITING_CONFIRM: "Confirm receipt",
    PICKED_UP: "Picked up",
    DELIVERED: "Delivered",
    FAILED: "Failed",
    REFUNDED: "Refunded",
    CANCELLED: "Cancelled",
  },
};

const pt: Messages = {
  nav: {
    home: "Início",
    discover: "Descobrir",
    publish: "Publicar",
    sellVideo: "Vender",
    messages: "Mensagens",
    cart: "Carrinho",
    profile: "Perfil",
    wallet: "Carteira",
    notifications: "Notificações",
  },
  auth: {
    login: "Entrar",
    register: "Registar",
    loginTitle: "Entrar",
    loginHint: "Aceda à carteira e às lojas",
    email: "E-mail",
    emailOptional: "E-mail (opcional)",
    emailInvalid: "E-mail inválido",
    identifier: "E-mail ou telemóvel",
    phone: "Telemóvel",
    phoneInvalid: "Número inválido para este país",
    phoneTaken: "Este número já está em uso",
    password: "Palavra-passe",
    name: "Nome",
    nameInvalid: "Indica o teu nome (mín. 2 caracteres)",
    submit: "Entrar",
    submitting: "A entrar…",
    noAccount: "Ainda não tem conta?",
    createAccount: "Criar conta",
    welcome: "Bem-vindo à ShipShop",
    failed: "Não foi possível entrar",
    registerTitle: "Criar uma conta",
    registerHint: "Obrigatório para comprar e vender na ShipShop",
    registerSubmit: "Registar",
    registerSubmitting: "A criar…",
    hasAccount: "Já tem conta?",
    registerWelcome: "Conta criada — carteira pronta",
    registerFailed: "Não foi possível registar",
    accountDisabled: "Conta desativada — conteúdo proibido",
    forgotLink: "Esqueceu a palavra-passe?",
    forgotTitle: "Repor palavra-passe",
    forgotHint: "Use e-mail ou telemóvel para receber um código OTP",
    forgotOtpHint: "Valide o OTP e escolha uma nova palavra-passe",
    sendOtp: "Enviar código OTP",
    sendingOtp: "A enviar código…",
    otpSent: "Código OTP enviado (válido por 10 minutos)",
    otpCode: "Código OTP",
    otpInvalid: "Código OTP inválido",
    otpExpired: "OTP expirado — peça um novo código",
    newPassword: "Nova palavra-passe",
    confirmPassword: "Confirmar palavra-passe",
    passwordMismatch: "As palavras-passe não coincidem",
    resetPassword: "Atualizar palavra-passe",
    resetting: "A atualizar…",
    resendOtp: "Enviar novamente",
    resetDone: "Palavra-passe atualizada — entre novamente",
    resetRequestFailed: "Não foi possível enviar o OTP",
    resetConfirmFailed: "Não foi possível repor a palavra-passe",
    phoneTakenHelp: "Este número já tem conta. Recupere com OTP.",
    goForgotPassword: "Repor palavra-passe",
  },
  media: {
    nsfwRejected: "Média recusado — conteúdo sexual explícito proibido",
    moderationUnavailable: "Moderação indisponível — tente mais tarde",
  },
  settings: {
    appearance: "Aparência",
    languageAndTheme: "Idioma e tema",
    appearanceHint: "Tema e idioma da aplicação",
    language: "Idioma",
    languageHint: "Francês, inglês ou português",
    theme: "Tema",
    themeHint: "Claro ou escuro",
    themeLight: "Claro",
    themeDark: "Escuro",
    languageUpdated: "Idioma: português",
    themeUpdated: "Tema guardado",
    logout: "Terminar sessão",
  },
  hours: {
    title: "Horário da loja",
    hint: "Opcional. Indique os dias, a abertura e o fecho, ou fique sempre disponível. O cliente vê isto nas encomendas.",
    always: "Sempre disponível",
    scheduled: "Dias e horas",
    start: "Abertura",
    end: "Fecho",
    days: "Dias de abertura",
    closeAt: "Fecha",
    openDays: "Dias",
    saved: "Horário guardado",
    saveFailed: "Não foi possível guardar",
    shop: "Loja",
    d0: "Dom",
    d1: "Seg",
    d2: "Ter",
    d3: "Qua",
    d4: "Qui",
    d5: "Sex",
    d6: "Sáb",
  },
  common: {
    back: "Voltar",
    close: "Fechar",
    loading: "A carregar",
    cancel: "Cancelar",
    save: "Guardar",
    next: "Seguinte",
    see: "Ver",
    copyImpossible: "Não foi possível copiar",
    kinshasa: "Kinshasa",
  },
  feed: {
    tabFollowing: "A seguir",
    tabForYou: "Para ti",
    tabWanted: "Procuro",
    loginToFollowTitle: "Entre para ver quem segue",
    loginToFollowHint:
      "Siga lojas, goste, compre ou partilhe — tudo aparece aqui.",
    emptyFollowingTitle: "Nada em A seguir",
    emptyFollowingHint:
      "Aqui: novidades das lojas que segue, mais gostos, compras, entregas e partilhas.",
    exploreForYou: "Explorar Para ti",
    emptyForYouTitle: "Ainda sem anúncios",
    emptyForYouHint: "Seja o primeiro a publicar na ShipShop",
    moneyProtected: "Dinheiro protegido",
    like: "Gosto",
    msg: "Msg",
    comments: "Comentários",
    commentsTitle: "Comentários",
    commentPlaceholder: "Escrever um comentário…",
    commentEmpty: "Seja o primeiro a comentar",
    commentFailed: "Não foi possível comentar",
    commentSend: "Enviar",
    share: "Partilhar",
    messageSeller: "Mensagem ao vendedor",
    likeFailed: "Não foi possível gostar",
    likeSent: "Gosto enviado ao vendedor",
    likeRemoved: "Gosto removido — mensagem ao vendedor cancelada",
    conversationFailed: "Não foi possível abrir a conversa",
    newListing: "Novo",
  },
  discover: {
    searchPlaceholder: "Pesquisar produto, vendedor…",
    categoriesHeading: "Categorias",
    trendsHeading: "Tendências em Kinshasa",
    featuredHeading: "Em destaque",
    videoHeading: "Videos e som",
    budgetHeading: "Pequeno preco",
    resultsHeading: "Todos os produtos",
    emptyResults: "Sem resultados",
    nearMe: "Perto de mim",
    challengeHeading: "Desafio do dia",
    challengeMission: "Missão",
    challengePulse: "Agora",
    storiesHeading: "Stories de parceiros",
    challengeJoin: "Eu topo",
    challengeJoinPlus: "+1 Eu topo",
    challengeJoined: "Feito",
    participants: "participante",
    participantsOther: "participantes",
    seeAll: "Ver tudo",
    videoOfMoment: "Vídeo do momento",
    views: "visualizações",
  },
  shop: {
    notFound: "Loja não encontrada",
    backToFeed: "Voltar ao feed",
    ref: "ref.",
    productOne: "produto",
    productOther: "produtos",
    contactUnpublished: "Contacto não publicado",
    seeAddress: "Ver morada",
    copyLink: "Copiar link",
    share: "Partilhar",
    message: "Mensagem",
    logo: "Logótipo da loja",
    logoHint: "Imagem quadrada — visível com o nome da loja",
    logoSaved: "Logótipo guardado",
    changeLogo: "Alterar logótipo",
    currency: "Moeda",
    currencyHint: "Moeda apresentada nesta loja",
    linkCopied: "Link da loja copiado",
    coordinates: "Coordenadas",
    openInMaps: "Abrir no Maps →",
    searchPlaceholder: "Pesquisar um produto…",
    filterAll: "Tudo",
    emptyTitle: "Sem produtos",
    emptyFilter: "Sem resultados para este filtro",
    emptyNone: "Esta loja ainda não tem anúncios ativos",
    interestedIn: "Olá, estou interessado em",
    messageFailed: "Não foi possível enviar a mensagem",
    discoverShop: "Descubra",
  },
  product: {
    payFromWallet: "Pagamento a partir do saldo pré-pago",
    likes: "gostos",
    comments: "comentários",
    commentAria: "Comentários",
    color: "Cor",
    size: "Tamanho",
    sold: "Esgotado",
    unavailable: "Indisponível",
    addToCart: "Adicionar ao carrinho",
    adding: "A adicionar…",
    payNow: "Pagar agora",
    processing: "A processar…",
    contactSeller: "Contactar o vendedor",
    likeAria: "Gostar",
    messageAria: "Mensagem ao vendedor",
    insufficientTitle: "Saldo insuficiente",
    topUpCta: "Carregar a carteira",
    onShipShop: "na ShipShop",
    manageOwn: "O seu produto",
    edit: "Editar",
    archive: "Arquivar",
    republish: "Republicar",
    delete: "Eliminar",
    editTitle: "Editar produto",
    save: "Guardar",
    cancel: "Cancelar",
    archived: "Produto arquivado",
    republished: "Produto republicado",
    deleted: "Produto eliminado",
    updated: "Produto atualizado",
    deleteConfirm: "Eliminar definitivamente este produto?",
    deleteBlocked: "Ligado a um pagamento — arquive em vez disso",
  },
  buy: {
    cta: "Comprar",
    payPhone: "Pagar no telefone",
    loginTitle: "Entra para comprar",
    loginHint: "Ficas neste vídeo — voltas já a seguir.",
    phoneRequired: "Indica um número com indicativo",
    gpsRequired: "Partilha o GPS para entregar aqui",
    payFailed: "Compra impossível",
    buyOk: "Pago e bloqueado — o vendedor recebe quando confirmares",
    realVideo: "Vídeo do artigo real",
    needMore: "Precisas de",
    topUpHint: "Carrega aqui, sem sair da compra.",
    heldLine: "Pagas. Bloqueamos. O vendedor recebe quando confirmares.",
    confirmUssd: "Validei no telefone",
    topUpFailed: "Carregamento impossível",
    topUpOk: "Conta carregada",
    held: "Pago e bloqueado",
    onTheWay: "A caminho",
    readyPickup: "Pronto para retirar",
    sellerPaid: "Recebido, vendedor pago",
    firstSaleHint: "Primeira venda: lê o QR e entrega o pacote.",
    zoomHint: "Aperta ou toca duas vezes para ampliar",
    zoomOpen: "Ampliar a foto",
    zoomClose: "Fechar o zoom",
    stock: "Stock",
    addCart: "Adicionar ao carrinho",
    addedCart: "No carrinho — pagas num toque",
    keepScrolling: "Continuar a ver",
    shopQr: "QR desta loja",
    qrUntilLast:
      "Cada artigo tem o seu QR. Quando esta loja o entrega, esse QR termina e só esse produto é pago após confirmação.",
    pickItem: "Qual artigo entregas agora?",
    goCart: "Ir ao carrinho",
    payUseCart: "Já há um artigo no carrinho — paga tudo num toque no carrinho",
    alreadyInCart: "Já no carrinho",
  },
  cart: {
    title: "Carrinho",
    guestHint: "Entre para ver o seu carrinho",
    itemOne: "artigo",
    itemOther: "artigos",
    empty: "O seu carrinho está vazio",
    discover: "Descobrir",
    unavailable: "Já não disponível",
    confirmPurchase: "Confirmar compra",
    cancelCart: "Limpar carrinho",
    removeAria: "Remover do carrinho",
    payOneClick: "Pagar num toque",
    perShopQr: "Cada loja recebe só os seus artigos — um QR para validar.",
    insufficient: "Saldo insuficiente — recarregue a sua carteira",
  },
  share: {
    aria: "Partilhar",
    copyLink: "Copiar link",
    moreApps: "Mais apps",
    copied: "Link ShipShop copiado",
    copyFailed: "Não foi possível copiar",
  },
  follow: {
    follow: "Seguir",
    following: "A seguir",
    subscribe: "Subscrever",
    subscribed: "Subscrito",
    failed: "Não foi possível seguir",
  },
  categories: {
    Tech: "Tech",
    Mode: "Moda",
    Maison: "Casa",
    Gaming: "Gaming",
    Beauté: "Beleza",
    Auto: "Auto",
    Livres: "Livros",
    Sport: "Desporto",
  },
  messages: {
    title: "Mensagens",
    empty: "Sem conversas. Abra uma loja e toque no ícone Mensagens.",
    emptyHint: "Para escrever a um novo vendedor, abra a loja.",
    urgent: "Urgente",
    writePlaceholder: "Escrever uma mensagem…",
    ackPlaceholder: "Responder para acusar a urgência…",
    guestHint: "Entre para ver as suas mensagens",
  },
  notifications: {
    title: "Notificações",
    empty: "Sem mensagens por agora",
    refresh: "Atualizar",
    seeAll: "Ver todas as mensagens",
    hint: "Novas mensagens — atualização automática a cada 25 s",
    noPreview: "Nova conversa",
    tabMessages: "Mensagens",
    tabComments: "Comentários",
    commentsEmpty: "Sem comentários nos seus produtos",
    commentsHint: "Mensagens e comentários não lidos",
  },
  wallet: {
    title: "A minha carteira",
    guestHint: "Entre para gerir o seu saldo",
    topUpSimulated: "Carregar",
    history: "Histórico",
    emptyHistory: "Sem transações",
    currency: "Moeda",
    amount: "Montante",
    tabMe: "Eu",
    tabSomeone: "Alguém",
    payHint:
      "Paga a ShipShop na sua rede. O beneficiário recebe e-money ShipShop — um só saldo, Airtel, Orange ou Vodacom.",
    searchRecipient: "Nome, loja ou número",
    youRecharge: "Está a carregar",
    myNumbers: "Os meus números e-money",
    saveNumbers: "Guardar números",
    sendPay: "Pedir pagamento",
    confirmPay: "Confirmar depósito",
    ussdHint: "Envie o montante para o número ShipShop, depois confirme.",
    forYou: "para si",
    vodacom: "Vodacom M-Pesa",
    orange: "Orange Money",
    airtel: "Airtel Money",
    emoneyPhone: "O seu número nesta rede",
    fromBalance: "Saldo ShipShop",
    sendFromBalance: "Enviar do meu saldo",
    balanceHint:
      "Sem rede: a ShipShop debita o seu saldo e credita o beneficiário.",
    transferOk: "Transferência concluída",
    verifyState: "Verificar estado",
    connectionLost: "Ligação interrompida — a verificar o pagamento, sem reenviar.",
    expiredPay: "Prazo esgotado — inicie um novo pedido.",
    txnRefund: "Reembolso",
    txnPurchase: "Compra",
    txnReceived: "Recebido",
    txnSent: "Enviado",
    txnAdjustment: "Ajuste",
    heldChip: "Dinheiro bloqueado",
  },
  shopExtra: {
    followerOne: "seguidor",
    followerOther: "seguidores",
  },
  wanted: {
    tab: "Procuro",
    title: "Procuro",
    empty: "Nenhum pedido aberto. Publique o que procura.",
    budget: "Orçamento máx.",
    newShop: "Novo / loja",
    used: "Usado",
    publishWanted: "Procuro",
    publishSell: "Vender",
    publishChooser: "O que quer fazer?",
    iHaveIt: "Tenho isto",
    accept: "Aceitar e pôr no carrinho",
    accepted: "Oferta aceite — abra o carrinho para pagar",
    contact: "Escrever",
    myRequests: "Os meus pedidos",
    alreadyInShop: "Já nas lojas",
    guestHint: "Entre para publicar um pedido",
    overBudget: "Acima do orçamento",
    addProduct: "Adicionar outro produto",
    removeProduct: "Remover",
    productN: "Produto",
    publishMany: "Publicar os pedidos",
  },
  montage: {
    title: "Montagem",
    hint: "O ficheiro fica no navegador até publicar. Só o excerto de 1 minuto do produto é guardado — o original é apagado. Se o vídeo já tiver som, fica mudo.",
    music: "Música / som",
    none: "Sem música",
    analyze: "Detetar objetos",
    analyzing: "A analisar…",
    blur: "Ocultar objeto",
    stampLogo: "Carimbo do logótipo",
    stampPrice: "Carimbo do preço",
    eraser: "Borracha",
    apply: "Aplicar",
    skip: "Saltar",
    needLogo: "Adicione primeiro o logótipo da loja",
    noSuggestions: "Nada detetado — escolha a cor de fundo e apague",
    importDevice: "Importar música ou vídeo",
    importing: "A importar…",
    maxOneMinute: "1 minuto no produto",
    clipWindow: "Excerto (1 min)",
    clipPlay: "Ouvir o excerto",
    clipPause: "Pausa",
    clipHint: "Arraste para escolher o minuto. Ouça antes de publicar.",
    importOk: "Som importado — escolha 1 minuto",
    undo: "Desfazer",
    pickColor: "Conta-gotas (cor de fundo)",
    brush: "Tamanho da borracha",
    reset: "Imagem original",
    select: "Selecionar",
    autoFill: "Fundo auto (pixels à volta)",
    searchOnline: "Procurar online",
    searchPlaceholder: "Nome ou título (ex. rumba, notícias)",
    searching: "A procurar…",
    searchEmpty: "Nenhum som livre encontrado — tente outro título",
    searchHint:
      "Sem ficheiro no aparelho? Procure um título: excertos de domínio público (Internet Archive), sem descargas pirata.",
    tempOnly: "Temporário — apagado após publicar",
    fetchOnline: "Usar este som",
    slidesTitle: "Imagens em 1 minuto",
    slidesHint:
      "Até 12 imagens percorrem o minuto de som. Poucas imagens ficam mais tempo. Escolha o movimento de cada vista.",
    changeMotion: "Animação",
    motionZoomIn: "Zoom in",
    motionZoomOut: "Zoom out",
    motionPanLeft: "Travelling esquerda",
    motionPanRight: "Travelling direita",
    motionPanUp: "Travelling cima",
  },
  publish: {
    titleProduct: "Título (produto)",
    titlePlaceholder: "iPhone 15 Pro Max 256GB",
    shop: "Loja",
    media: "Imagens / vídeos",
  },
  orderStatus: {
    PAID: "Pago e bloqueado",
    ASSIGNED: "Estafeta atribuído",
    FULFILLING: "A preparar",
    OUT_FOR_DELIVERY: "A caminho",
    READY_FOR_PICKUP: "Pronto para retirar",
    AWAITING_CONFIRM: "Confirma a receção",
    PICKED_UP: "Levantado",
    DELIVERED: "Entregue",
    FAILED: "Falhou",
    REFUNDED: "Reembolsado",
    CANCELLED: "Cancelado",
  },
};

export const dictionaries: Record<UserLocale, Messages> = {
  fr,
  en,
  pt,
};
