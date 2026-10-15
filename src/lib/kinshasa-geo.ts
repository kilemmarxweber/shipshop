/** 24 communes de Kinshasa + quartiers / avenues usuels. */

export type KinshasaCommuneSeed = {
  name: string;
  quartiers: string[];
  avenues: string[];
};

export const KINSHASA_CITY = "Kinshasa";

export const KINSHASA_COMMUNES: KinshasaCommuneSeed[] = [
  {
    name: "Gombe",
    quartiers: ["Gombe", "Royal", "Golf", "Haut Commandement"],
    avenues: [
      "du Port",
      "des Aviateurs",
      "Colonel Mondjiba",
      "Lukusa",
      "Roi Baudouin",
      "de la Justice",
      "Wagenia",
      "Haut Commandement",
      "Tchad",
      "Équateur",
    ],
  },
  {
    name: "Barumbu",
    quartiers: ["Barumbu", "Tshimpi", "Ndolo"],
    avenues: ["Flambeau", "Itaga", "Wangata", "Kasa-Vubu", "Bolobo"],
  },
  {
    name: "Kinshasa",
    quartiers: ["Cité", "Ndolo", "Aéroport"],
    avenues: ["Kasa-Vubu", "Bokassa", "de la Libération", "Kabinda"],
  },
  {
    name: "Lingwala",
    quartiers: ["Lingwala", "La Voix du Peuple"],
    avenues: ["Kasa-Vubu", "de la Victoire", "Démocratie", "Équateur"],
  },
  {
    name: "Kintambo",
    quartiers: ["Kintambo", "Camp Kokolo", "Utex"],
    avenues: ["Kasa-Vubu", "du 24 Novembre", "Liberation", "Kintambo Magasin"],
  },
  {
    name: "Kasa-Vubu",
    quartiers: ["Kasa-Vubu", "Yolo", "Anciens Combattants"],
    avenues: ["Kasa-Vubu", "Pierre Mulele", "Kimbangu", "Victoire"],
  },
  {
    name: "Kalamu",
    quartiers: ["Matonge", "Kalamu", "Yolo-Nord", "Yolo-Sud", "Pinzi"],
    avenues: [
      "Kasa-Vubu",
      "Victoire",
      "Lumumba",
      "Kimbangu",
      "Bongolo",
      "Kalamu",
    ],
  },
  {
    name: "Ngiri-Ngiri",
    quartiers: ["Ngiri-Ngiri", "Zamba"],
    avenues: ["Kasa-Vubu", "Kimbangu", "Ngiri-Ngiri"],
  },
  {
    name: "Bandalungwa",
    quartiers: ["Bandalungwa", "Makelele", "Righini"],
    avenues: ["Kasa-Vubu", "Pierre Mulele", "Makelele", "Inga"],
  },
  {
    name: "Selembao",
    quartiers: ["Selembao", "Camp Mbinza", "Mbanza-Lemba"],
    avenues: ["By-Pass", "Selembao", "Université"],
  },
  {
    name: "Bumbu",
    quartiers: ["Bumbu", "Ateliers"],
    avenues: ["By-Pass", "Kasa-Vubu", "Bumbu"],
  },
  {
    name: "Makala",
    quartiers: ["Makala", "Mabulu"],
    avenues: ["By-Pass", "Kasa-Vubu", "Makala"],
  },
  {
    name: "Ngaba",
    quartiers: ["Ngaba"],
    avenues: ["By-Pass", "Université", "Ngaba"],
  },
  {
    name: "Limete",
    quartiers: ["Industriel", "Résidentiel", "Kingabwa", "Salongo", "Marché"],
    avenues: [
      "Lumumba",
      "des Poids Lourds",
      "Salongo",
      "Kingabwa",
      "By-Pass",
      "de l'Université",
    ],
  },
  {
    name: "Matete",
    quartiers: ["Matete", "Sans-Fil"],
    avenues: ["By-Pass", "Matete", "Sainte Thérèse"],
  },
  {
    name: "Lemba",
    quartiers: ["Lemba", "Righini", "Livulu", "Commercial", "Echangeur"],
    avenues: [
      "de l'Université",
      "By-Pass",
      "Lemba",
      "Livulu",
      "Righini",
      "Croix-Rouge",
    ],
  },
  {
    name: "Ngaliema",
    quartiers: [
      "Joli Parc",
      "Binza Pigeon",
      "Binza Ozone",
      "Mont Fleury",
      "Djelo Binza",
      "Kinsuka",
      "Ma Campagne",
    ],
    avenues: [
      "du 30 Juin",
      "de la Libération",
      "By-Pass",
      "Kinsuka",
      "Lukusa",
      "Colonel Mondjiba",
      "Côteaux",
    ],
  },
  {
    name: "Mont-Ngafula",
    quartiers: ["Mont-Ngafula", "Mitendi", "Kimwenza", "Righini", "Kimbondo"],
    avenues: ["By-Pass", "Université", "Kimwenza", "Mitendi"],
  },
  {
    name: "Kisenso",
    quartiers: ["Kisenso", "Mission"],
    avenues: ["By-Pass", "Kisenso", "N'djili"],
  },
  {
    name: "Masina",
    quartiers: ["Masina", "Sans Fil", "Pelé", "Mafuta", "Sans-Fil"],
    avenues: ["By-Pass", "Lumumba", "Masina", "Pelé"],
  },
  {
    name: "Ndjili",
    quartiers: [
      "Quartier 1",
      "Quartier 2",
      "Quartier 3",
      "Quartier 4",
      "Quartier 5",
      "Quartier 6",
      "Quartier 7",
      "Quartier 8",
      "Quartier 9",
      "Quartier 10",
      "Quartier 11",
      "Quartier 12",
      "Quartier 13",
    ],
    avenues: ["By-Pass", "Lumumba", "Ndjili", "Aéroport"],
  },
  {
    name: "Kimbanseke",
    quartiers: ["Kingasani", "Biyela", "Mfidi", "Kiswishi", "Ngampani"],
    avenues: ["By-Pass", "Kimbanseke", "Kingasani", "Lumumba"],
  },
  {
    name: "Nsele",
    quartiers: ["Nsele", "Dumu", "Menkao", "Kingakati"],
    avenues: ["By-Pass", "Nsele", "Aéroport", "Menkao"],
  },
  {
    name: "Maluku",
    quartiers: ["Maluku", "Kingakati", "Mbankana"],
    avenues: ["By-Pass", "Maluku", "Mbankana"],
  },
];

export function geoSlug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function isKinshasaCity(name: string | null | undefined): boolean {
  return geoSlug(name ?? "") === "kinshasa";
}

export function geoCityId(name: string): string {
  return `geo-city-${geoSlug(name)}`;
}

export function geoCommuneId(city: string, commune: string): string {
  return `geo-commune-${geoSlug(city)}-${geoSlug(commune)}`;
}

export function geoQuartierId(
  city: string,
  commune: string,
  quartier: string,
): string {
  return `geo-quartier-${geoSlug(city)}-${geoSlug(commune)}-${geoSlug(quartier)}`;
}
