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
};

export const dictionaries: Record<UserLocale, Messages> = {
  fr: {
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
      welcome: "Bienvenue sur Chip Shop",
      failed: "Connexion impossible",
      registerTitle: "Créer un compte",
      registerHint: "Obligatoire pour acheter et vendre sur Chip Shop",
      registerSubmit: "S'inscrire",
      registerSubmitting: "Création…",
      hasAccount: "Déjà un compte ?",
      registerWelcome: "Compte créé — portefeuille prêt",
      registerFailed: "Inscription impossible",
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
  },
  en: {
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
      welcome: "Welcome to Chip Shop",
      failed: "Sign-in failed",
      registerTitle: "Create an account",
      registerHint: "Required to buy and sell on Chip Shop",
      registerSubmit: "Sign up",
      registerSubmitting: "Creating…",
      hasAccount: "Already have an account?",
      registerWelcome: "Account created — wallet ready",
      registerFailed: "Sign-up failed",
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
  },
  pt: {
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
      welcome: "Bem-vindo à Chip Shop",
      failed: "Não foi possível entrar",
      registerTitle: "Criar uma conta",
      registerHint: "Obrigatório para comprar e vender na Chip Shop",
      registerSubmit: "Registar",
      registerSubmitting: "A criar…",
      hasAccount: "Já tem conta?",
      registerWelcome: "Conta criada — carteira pronta",
      registerFailed: "Não foi possível registar",
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
      languageUpdated: "Idioma: português de Portugal",
      themeUpdated: "Tema guardado",
      logout: "Terminar sessão",
    },
  },
};
