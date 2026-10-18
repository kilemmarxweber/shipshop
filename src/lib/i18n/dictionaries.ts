import type { UserLocale } from "@/lib/user-locale";

export type Messages = {
  nav: {
    home: string;
    discover: string;
    publish: string;
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
    password: string;
    name: string;
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
    emptyResults: string;
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
};

const fr: Messages = {
  nav: {
    home: "Accueil",
    discover: "Découvrir",
    publish: "Publier",
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
    password: "Mot de passe",
    name: "Nom",
    submit: "Se connecter",
    submitting: "Connexion…",
    noAccount: "Pas encore de compte ?",
    createAccount: "Créer un compte",
    welcome: "Bienvenue sur ShipShop",
    failed: "Connexion impossible",
    registerTitle: "Créer un compte",
    registerHint: "Obligatoire pour acheter et vendre sur ShipShop",
    registerSubmit: "S'inscrire",
    registerSubmitting: "Création…",
    hasAccount: "Déjà un compte ?",
    registerWelcome: "Compte créé — portefeuille prêt",
    registerFailed: "Inscription impossible",
    accountDisabled: "Compte désactivé — contenu interdit",
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
    moneyProtected: "Argent protégé",
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
    emptyResults: "Aucun résultat",
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
    payFromWallet: "Paiement depuis solde prépayé",
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
};

const en: Messages = {
  nav: {
    home: "Home",
    discover: "Discover",
    publish: "Sell",
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
    password: "Password",
    name: "Name",
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
    emptyResults: "No results",
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
};

const pt: Messages = {
  nav: {
    home: "Início",
    discover: "Descobrir",
    publish: "Publicar",
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
    password: "Palavra-passe",
    name: "Nome",
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
    emptyResults: "Sem resultados",
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
};

export const dictionaries: Record<UserLocale, Messages> = {
  fr,
  en,
  pt,
};
