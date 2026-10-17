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
    share: string;
    messageSeller: string;
    likeFailed: string;
    likeSent: string;
    likeRemoved: string;
    conversationFailed: string;
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
  };
  wallet: {
    title: string;
    guestHint: string;
    topUpSimulated: string;
    history: string;
    emptyHistory: string;
  };
  shopExtra: {
    followerOne: string;
    followerOther: string;
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
    share: "Partager",
    messageSeller: "Message au vendeur",
    likeFailed: "Impossible d'aimer",
    likeSent: "Like envoyé au vendeur",
    likeRemoved: "Like retiré — message vendeur annulé",
    conversationFailed: "Impossible d'ouvrir la conversation",
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
    empty: "Aucune conversation. Touchez l'icône message sur un produit.",
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
  },
  wallet: {
    title: "Mon portefeuille",
    guestHint: "Connectez-vous pour gérer votre solde",
    topUpSimulated: "Recharger (simulé)",
    history: "Historique",
    emptyHistory: "Aucune transaction",
  },
  shopExtra: {
    followerOne: "abonné",
    followerOther: "abonnés",
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
    share: "Share",
    messageSeller: "Message seller",
    likeFailed: "Could not like",
    likeSent: "Like sent to seller",
    likeRemoved: "Like removed — seller message cancelled",
    conversationFailed: "Could not open conversation",
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
    empty: "No conversations yet. Tap the message icon on a product.",
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
  },
  wallet: {
    title: "My wallet",
    guestHint: "Sign in to manage your balance",
    topUpSimulated: "Top up (simulated)",
    history: "History",
    emptyHistory: "No transactions",
  },
  shopExtra: {
    followerOne: "follower",
    followerOther: "followers",
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
    share: "Partilhar",
    messageSeller: "Mensagem ao vendedor",
    likeFailed: "Não foi possível gostar",
    likeSent: "Gosto enviado ao vendedor",
    likeRemoved: "Gosto removido — mensagem ao vendedor cancelada",
    conversationFailed: "Não foi possível abrir a conversa",
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
    empty: "Sem conversas. Toque no ícone de mensagem num produto.",
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
  },
  wallet: {
    title: "A minha carteira",
    guestHint: "Entre para gerir o seu saldo",
    topUpSimulated: "Carregar (simulado)",
    history: "Histórico",
    emptyHistory: "Sem transações",
  },
  shopExtra: {
    followerOne: "seguidor",
    followerOther: "seguidores",
  },
};

export const dictionaries: Record<UserLocale, Messages> = {
  fr,
  en,
  pt,
};
