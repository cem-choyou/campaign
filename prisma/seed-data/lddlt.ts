// Demo campaign reproduced from docs/templates/modele-campagne.xlsx (LDDLT plan).
// From lot 2 on, the seed will go through the real Excel importer instead.

const FRAME = "https://next.frame.io/share/0ab5a1c0-22f4-402e-a05a-05ef61c0e567/view";
const MEDIA = [
  `${FRAME}/9e42da5c-f9b9-451f-8959-6012c18de372`,
  `${FRAME}/4bca616d-c6b8-46b5-9936-5996b6e7781d`,
  `${FRAME}/6da21d6f-a4c3-4378-bb8f-f6ce430b5c6d`,
  `${FRAME}/7422aabf-ec75-4b45-840e-d7f03796fd52`,
  `${FRAME}/5b065daa-49f0-4b8f-a3da-08dc115f8e01`,
  `${FRAME}/8e2dee3b-2506-4ce8-872d-b69107ebc363`,
];

export const LDDLT_CAMPAIGN = {
  name: "Promotion vidéo LDDLT",
  startDate: "2026-10-05",
  endDate: "2026-11-13",
  objective:
    "Faire connaître la vidéo LDDLT auprès des décideurs IT et générer des vues qualifiées.",
  audience: "DSI et responsables IT d'entreprises de 200 à 2 000 salariés.",
  keyMessage: "Une transformation numérique réussit quand les équipes métier sont embarquées.",
  callToAction: "Regarder la vidéo complète sur YouTube.",
  brief:
    "Six semaines pour promouvoir la vidéo LDDLT : une capsule par semaine sur la page LinkedIn, une capsule relayée par Anne Laure depuis son profil, et un Short YouTube qui renvoie vers la vidéo longue. Ton expert mais accessible, concret, sans jargon marketing.",
};

export type SeedContent = {
  code: string;
  type: "LONG_VIDEO" | "CAPSULE" | "SHORT";
  title: string;
  mediaUrl: string | null;
  parent?: string;
};

export const LDDLT_CONTENTS: SeedContent[] = [
  { code: "VID-LONG", type: "LONG_VIDEO", title: "Vidéo longue LDDLT", mediaUrl: null },
  ...MEDIA.map((url, i) => ({
    code: `CAP${i + 1}`,
    type: "CAPSULE" as const,
    title: `Capsule ${i + 1}`,
    mediaUrl: url,
  })),
  ...MEDIA.map((url, i) => ({
    code: `SHORT${i + 1}`,
    type: "SHORT" as const,
    title: `Short ${i + 1}`,
    mediaUrl: url,
    parent: "VID-LONG",
  })),
];

export type SeedPost = {
  week: number;
  dayOffset: number; // 0 = Monday
  time: string;
  publisher: "page" | "youtube" | "anne-laure";
  format: "VIDEO_POST" | "SHORT";
  content: string;
  linkTo?: string;
  angle?: string;
};

/** Planning tab of the model: Monday page capsule, Wednesday Anne Laure, Thursday Short. */
export const LDDLT_POSTS: SeedPost[] = [1, 2, 3, 4, 5, 6].flatMap((week) => [
  {
    week,
    dayOffset: 0,
    time: "09:00",
    publisher: "page" as const,
    format: "VIDEO_POST" as const,
    content: `CAP${week}`,
  },
  {
    week,
    dayOffset: 2,
    time: "09:00",
    publisher: "anne-laure" as const,
    format: "VIDEO_POST" as const,
    content: `CAP${7 - week}`,
  },
  {
    week,
    dayOffset: 3,
    time: "09:00",
    publisher: "youtube" as const,
    format: "SHORT" as const,
    content: `SHORT${week}`,
    linkTo: "VID-LONG",
    angle: "Extrait qui donne envie de voir la vidéo longue",
  },
]);
