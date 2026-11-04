export const CATEGORIES = [
  { id: "Tech", label: "Tech", fill: "bg-[#0A84FF]", gradient: "bg-[#0A84FF]" },
  { id: "Mode", label: "Mode", fill: "bg-[#FF375F]", gradient: "bg-[#FF375F]" },
  {
    id: "Maison",
    label: "Maison",
    fill: "bg-[#64D2FF]",
    gradient: "bg-[#64D2FF]",
  },
  {
    id: "Gaming",
    label: "Gaming",
    fill: "bg-[#5E5CE6]",
    gradient: "bg-[#5E5CE6]",
  },
  {
    id: "Beauté",
    label: "Beauté",
    fill: "bg-[#BF5AF2]",
    gradient: "bg-[#BF5AF2]",
  },
  { id: "Auto", label: "Auto", fill: "bg-[#636366]", gradient: "bg-[#636366]" },
  {
    id: "Livres",
    label: "Livres",
    fill: "bg-[#FF9F0A]",
    gradient: "bg-[#FF9F0A]",
  },
  {
    id: "Sport",
    label: "Sport",
    fill: "bg-[#30D158]",
    gradient: "bg-[#30D158]",
  },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];
