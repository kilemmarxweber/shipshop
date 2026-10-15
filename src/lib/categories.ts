export const CATEGORIES = [
  { id: "Tech", label: "Tech", gradient: "from-blue-600 to-violet-600" },
  { id: "Mode", label: "Mode", gradient: "from-pink-500 to-amber-500" },
  { id: "Maison", label: "Maison", gradient: "from-emerald-500 to-cyan-500" },
  { id: "Gaming", label: "Gaming", gradient: "from-red-500 to-violet-600" },
  { id: "Beauté", label: "Beauté", gradient: "from-pink-400 to-rose-400" },
  { id: "Auto", label: "Auto", gradient: "from-slate-500 to-slate-700" },
  { id: "Livres", label: "Livres", gradient: "from-amber-400 to-orange-500" },
  { id: "Sport", label: "Sport", gradient: "from-emerald-500 to-lime-400" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];
