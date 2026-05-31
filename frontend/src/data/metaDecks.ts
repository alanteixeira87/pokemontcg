export type MetaDeckCard = {
  name: string;
  quantity: number;
  role: "Pokemon" | "Treinador" | "Energia";
};

export type MetaDeck = {
  id: string;
  name: string;
  archetype: string;
  format: string;
  metaShare: string;
  sourceLabel: string;
  sourceUrl: string;
  updatedAt: string;
  notes: string;
  cards: MetaDeckCard[];
};

export const metaDecks: MetaDeck[] = [
  {
    id: "dragapult",
    name: "Dragapult ex",
    archetype: "Controle / spread",
    format: "Standard TEF-POR",
    metaShare: "42.74%",
    sourceLabel: "Limitless TCG - Top Decks",
    sourceUrl: "https://limitlesstcg.com/decks/284",
    updatedAt: "2026-05-31",
    notes: "Arquétipo mais jogado no recorte atual da Limitless. Lista visual baseada no núcleo competitivo e staples recorrentes.",
    cards: [
      { name: "Dreepy", quantity: 4, role: "Pokemon" },
      { name: "Drakloak", quantity: 4, role: "Pokemon" },
      { name: "Dragapult ex", quantity: 3, role: "Pokemon" },
      { name: "Duskull", quantity: 2, role: "Pokemon" },
      { name: "Dusclops", quantity: 1, role: "Pokemon" },
      { name: "Dusknoir", quantity: 1, role: "Pokemon" },
      { name: "Munkidori", quantity: 1, role: "Pokemon" },
      { name: "Budew", quantity: 1, role: "Pokemon" },
      { name: "Arven", quantity: 4, role: "Treinador" },
      { name: "Iono", quantity: 3, role: "Treinador" },
      { name: "Boss's Orders", quantity: 2, role: "Treinador" },
      { name: "Professor's Research", quantity: 1, role: "Treinador" },
      { name: "Buddy-Buddy Poffin", quantity: 4, role: "Treinador" },
      { name: "Ultra Ball", quantity: 4, role: "Treinador" },
      { name: "Rare Candy", quantity: 4, role: "Treinador" },
      { name: "Earthen Vessel", quantity: 2, role: "Treinador" },
      { name: "Counter Catcher", quantity: 2, role: "Treinador" },
      { name: "Super Rod", quantity: 2, role: "Treinador" },
      { name: "Night Stretcher", quantity: 2, role: "Treinador" },
      { name: "Technical Machine: Evolution", quantity: 1, role: "Treinador" },
      { name: "Artazon", quantity: 2, role: "Treinador" },
      { name: "Basic Psychic Energy", quantity: 8, role: "Energia" },
      { name: "Basic Fire Energy", quantity: 2, role: "Energia" }
    ]
  },
  {
    id: "raging-bolt",
    name: "Raging Bolt ex",
    archetype: "Ataque explosivo",
    format: "Standard TEF-POR",
    metaShare: "7.30%",
    sourceLabel: "Limitless TCG - Top Decks",
    sourceUrl: "https://limitlesstcg.com/decks/280",
    updatedAt: "2026-05-31",
    notes: "Deck agressivo com aceleração por Ogerpon e muita compra para fechar nocautes grandes.",
    cards: [
      { name: "Raging Bolt ex", quantity: 3, role: "Pokemon" },
      { name: "Teal Mask Ogerpon ex", quantity: 4, role: "Pokemon" },
      { name: "Sandy Shocks ex", quantity: 1, role: "Pokemon" },
      { name: "Squawkabilly ex", quantity: 1, role: "Pokemon" },
      { name: "Fezandipiti ex", quantity: 1, role: "Pokemon" },
      { name: "Latias ex", quantity: 1, role: "Pokemon" },
      { name: "Professor's Research", quantity: 4, role: "Treinador" },
      { name: "Iono", quantity: 2, role: "Treinador" },
      { name: "Boss's Orders", quantity: 2, role: "Treinador" },
      { name: "Sada's Vitality", quantity: 4, role: "Treinador" },
      { name: "Ultra Ball", quantity: 4, role: "Treinador" },
      { name: "Nest Ball", quantity: 4, role: "Treinador" },
      { name: "Earthen Vessel", quantity: 4, role: "Treinador" },
      { name: "Energy Retrieval", quantity: 3, role: "Treinador" },
      { name: "Superior Energy Retrieval", quantity: 2, role: "Treinador" },
      { name: "Switch Cart", quantity: 2, role: "Treinador" },
      { name: "Pal Pad", quantity: 1, role: "Treinador" },
      { name: "PokéStop", quantity: 3, role: "Treinador" },
      { name: "Basic Grass Energy", quantity: 7, role: "Energia" },
      { name: "Basic Fighting Energy", quantity: 5, role: "Energia" },
      { name: "Basic Lightning Energy", quantity: 2, role: "Energia" }
    ]
  },
  {
    id: "gholdengo",
    name: "Gholdengo ex",
    archetype: "Combo / compra",
    format: "Standard SVI-PFL",
    metaShare: "Histórico forte",
    sourceLabel: "Limitless TCG - Deck Overview",
    sourceUrl: "https://www.limitlesstcg.com/decks/267",
    updatedAt: "2026-05-31",
    notes: "Arquétipo com histórico de tops regionais e internacionais; útil para identificar staples e peças repetidas de venda.",
    cards: [
      { name: "Gimmighoul", quantity: 4, role: "Pokemon" },
      { name: "Gholdengo ex", quantity: 4, role: "Pokemon" },
      { name: "Dudunsparce", quantity: 2, role: "Pokemon" },
      { name: "Dunsparce", quantity: 2, role: "Pokemon" },
      { name: "Fezandipiti ex", quantity: 1, role: "Pokemon" },
      { name: "Radiant Greninja", quantity: 1, role: "Pokemon" },
      { name: "Professor's Research", quantity: 3, role: "Treinador" },
      { name: "Iono", quantity: 3, role: "Treinador" },
      { name: "Boss's Orders", quantity: 2, role: "Treinador" },
      { name: "Ciphermaniac's Codebreaking", quantity: 2, role: "Treinador" },
      { name: "Ultra Ball", quantity: 4, role: "Treinador" },
      { name: "Nest Ball", quantity: 4, role: "Treinador" },
      { name: "Earthen Vessel", quantity: 4, role: "Treinador" },
      { name: "Superior Energy Retrieval", quantity: 4, role: "Treinador" },
      { name: "Energy Retrieval", quantity: 2, role: "Treinador" },
      { name: "Super Rod", quantity: 2, role: "Treinador" },
      { name: "PokéStop", quantity: 3, role: "Treinador" },
      { name: "Basic Metal Energy", quantity: 10, role: "Energia" },
      { name: "Basic Psychic Energy", quantity: 3, role: "Energia" }
    ]
  },
  {
    id: "rockets-mewtwo",
    name: "Rocket's Mewtwo ex",
    archetype: "Controle / pressão",
    format: "Standard TEF-POR",
    metaShare: "4.79%",
    sourceLabel: "Limitless TCG - Top Decks",
    sourceUrl: "https://limitlesstcg.com/decks/337",
    updatedAt: "2026-05-31",
    notes: "Arquétipo recente do meta, indicado para visualizar peças de Rocket e staples repetidas.",
    cards: [
      { name: "Rocket's Mewtwo ex", quantity: 3, role: "Pokemon" },
      { name: "Rocket's Wobbuffet", quantity: 2, role: "Pokemon" },
      { name: "Rocket's Meowth", quantity: 2, role: "Pokemon" },
      { name: "Rocket's Persian ex", quantity: 2, role: "Pokemon" },
      { name: "Munkidori", quantity: 1, role: "Pokemon" },
      { name: "Fezandipiti ex", quantity: 1, role: "Pokemon" },
      { name: "Arven", quantity: 4, role: "Treinador" },
      { name: "Iono", quantity: 3, role: "Treinador" },
      { name: "Boss's Orders", quantity: 2, role: "Treinador" },
      { name: "Professor's Research", quantity: 2, role: "Treinador" },
      { name: "Ultra Ball", quantity: 4, role: "Treinador" },
      { name: "Nest Ball", quantity: 4, role: "Treinador" },
      { name: "Buddy-Buddy Poffin", quantity: 4, role: "Treinador" },
      { name: "Earthen Vessel", quantity: 2, role: "Treinador" },
      { name: "Night Stretcher", quantity: 2, role: "Treinador" },
      { name: "Counter Catcher", quantity: 2, role: "Treinador" },
      { name: "Bravery Charm", quantity: 2, role: "Treinador" },
      { name: "Team Rocket's Factory", quantity: 2, role: "Treinador" },
      { name: "Basic Psychic Energy", quantity: 10, role: "Energia" },
      { name: "Basic Darkness Energy", quantity: 6, role: "Energia" }
    ]
  },
  {
    id: "festival-lead",
    name: "Festival Lead",
    archetype: "Single Prize / agressivo",
    format: "Standard TEF-POR",
    metaShare: "4.95%",
    sourceLabel: "Limitless TCG - Top Decks",
    sourceUrl: "https://limitlesstcg.com/decks/336",
    updatedAt: "2026-05-31",
    notes: "Deck barato e popular para procura de peças repetidas em grande quantidade.",
    cards: [
      { name: "Dipplin", quantity: 4, role: "Pokemon" },
      { name: "Applin", quantity: 4, role: "Pokemon" },
      { name: "Thwackey", quantity: 4, role: "Pokemon" },
      { name: "Grookey", quantity: 4, role: "Pokemon" },
      { name: "Poltchageist", quantity: 2, role: "Pokemon" },
      { name: "Sinistcha", quantity: 2, role: "Pokemon" },
      { name: "Bug Catching Set", quantity: 4, role: "Treinador" },
      { name: "Buddy-Buddy Poffin", quantity: 4, role: "Treinador" },
      { name: "Ultra Ball", quantity: 4, role: "Treinador" },
      { name: "Nest Ball", quantity: 3, role: "Treinador" },
      { name: "Iono", quantity: 3, role: "Treinador" },
      { name: "Boss's Orders", quantity: 2, role: "Treinador" },
      { name: "Professor's Research", quantity: 2, role: "Treinador" },
      { name: "Festival Grounds", quantity: 4, role: "Treinador" },
      { name: "Technical Machine: Evolution", quantity: 2, role: "Treinador" },
      { name: "Super Rod", quantity: 2, role: "Treinador" },
      { name: "Basic Grass Energy", quantity: 10, role: "Energia" }
    ]
  },
  {
    id: "alakazam",
    name: "Alakazam",
    archetype: "Controle / banco",
    format: "Standard TEF-POR",
    metaShare: "4.13%",
    sourceLabel: "Limitless TCG - Top Decks",
    sourceUrl: "https://limitlesstcg.com/decks/350",
    updatedAt: "2026-05-31",
    notes: "Arquétipo de controle do ranking atual da Limitless, bom para rastrear peças específicas e staples.",
    cards: [
      { name: "Abra", quantity: 4, role: "Pokemon" },
      { name: "Kadabra", quantity: 1, role: "Pokemon" },
      { name: "Alakazam ex", quantity: 3, role: "Pokemon" },
      { name: "Klefki", quantity: 2, role: "Pokemon" },
      { name: "Mimikyu", quantity: 1, role: "Pokemon" },
      { name: "Budew", quantity: 1, role: "Pokemon" },
      { name: "Rotom V", quantity: 1, role: "Pokemon" },
      { name: "Pidgey", quantity: 2, role: "Pokemon" },
      { name: "Pidgeot ex", quantity: 2, role: "Pokemon" },
      { name: "Arven", quantity: 4, role: "Treinador" },
      { name: "Iono", quantity: 3, role: "Treinador" },
      { name: "Boss's Orders", quantity: 2, role: "Treinador" },
      { name: "Rare Candy", quantity: 4, role: "Treinador" },
      { name: "Buddy-Buddy Poffin", quantity: 4, role: "Treinador" },
      { name: "Ultra Ball", quantity: 4, role: "Treinador" },
      { name: "Counter Catcher", quantity: 2, role: "Treinador" },
      { name: "Technical Machine: Devolution", quantity: 1, role: "Treinador" },
      { name: "Super Rod", quantity: 2, role: "Treinador" },
      { name: "Night Stretcher", quantity: 1, role: "Treinador" },
      { name: "Pal Pad", quantity: 1, role: "Treinador" },
      { name: "Switch", quantity: 1, role: "Treinador" },
      { name: "Artazon", quantity: 2, role: "Treinador" },
      { name: "Basic Psychic Energy", quantity: 9, role: "Energia" },
      { name: "Double Turbo Energy", quantity: 3, role: "Energia" }
    ]
  }
];
