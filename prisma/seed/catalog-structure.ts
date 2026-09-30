/** Структура каталога по утверждённому макету: категории, подкатегории, характеристики, метки, таблицы размеров */

type V = { slug: string; ru: string; kk: string; hex?: string };

export const ATTRIBUTES: {
  code: string;
  ru: string;
  kk: string;
  type: "SELECT" | "MULTISELECT" | "COLOR";
  display: "CHECKBOX" | "CHIPS" | "SWATCH";
  axis: boolean;
  unit?: string;
  values: V[];
}[] = [
  {
    code: "gender",
    ru: "Пол",
    kk: "Жынысы",
    type: "MULTISELECT",
    display: "CHECKBOX",
    axis: false,
    values: [
      { slug: "girls", ru: "Девочкам", kk: "Қыздарға" },
      { slug: "boys", ru: "Мальчикам", kk: "Ұлдарға" },
      { slug: "unisex", ru: "Унисекс", kk: "Унисекс" },
      { slug: "women", ru: "Женский", kk: "Әйелдерге" },
    ],
  },
  {
    code: "age",
    ru: "Возраст",
    kk: "Жасы",
    type: "MULTISELECT",
    display: "CHECKBOX",
    axis: false,
    values: [
      { slug: "0-1", ru: "0–1 год", kk: "0–1 жас" },
      { slug: "1-3", ru: "1–3 года", kk: "1–3 жас" },
      { slug: "3-7", ru: "3–7 лет", kk: "3–7 жас" },
      { slug: "7-12", ru: "7–12 лет", kk: "7–12 жас" },
    ],
  },
  {
    code: "size",
    ru: "Размер (рост)",
    kk: "Өлшем (бойы)",
    type: "SELECT",
    display: "CHIPS",
    axis: true,
    unit: "см",
    values: [50, 56, 62, 68, 74, 80, 86, 92, 98, 100, 104, 110, 116, 120, 122, 128, 134, 140, 146, 152, 158, 164].map((n) => ({
      slug: String(n),
      ru: String(n),
      kk: String(n),
    })),
  },
  {
    code: "size_age",
    ru: "Размер (возраст)",
    kk: "Өлшем (жасы)",
    type: "SELECT",
    display: "CHIPS",
    axis: true,
    values: [
      { slug: "0-3m", ru: "0–3 мес", kk: "0–3 ай" },
      { slug: "3-6m", ru: "3–6 мес", kk: "3–6 ай" },
      { slug: "6-9m", ru: "6–9 мес", kk: "6–9 ай" },
      { slug: "9-12m", ru: "9–12 мес", kk: "9–12 ай" },
      ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => ({
        slug: `${n}y`,
        ru: `${n} ${n === 1 ? "год" : n < 5 ? "года" : "лет"}`,
        kk: `${n} жас`,
      })),
    ],
  },
  {
    code: "size_adult",
    ru: "Размер (взрослый)",
    kk: "Өлшем (ересек)",
    type: "SELECT",
    display: "CHIPS",
    axis: true,
    values: ["XS", "S", "M", "L", "XL", "XXL", "42", "44", "46", "48", "50", "52", "54"].map((s) => ({ slug: s.toLowerCase(), ru: s, kk: s })),
  },
  {
    code: "shoe_size",
    ru: "Размер обуви",
    kk: "Аяқ киім өлшемі",
    type: "SELECT",
    display: "CHIPS",
    axis: true,
    values: Array.from({ length: 25 }, (_, i) => 16 + i).map((n) => ({ slug: String(n), ru: String(n), kk: String(n) })),
  },
  {
    code: "color",
    ru: "Цвет",
    kk: "Түсі",
    type: "COLOR",
    display: "SWATCH",
    axis: true,
    values: [
      { slug: "white", ru: "Белый", kk: "Ақ", hex: "#FFFFFF" },
      { slug: "milk", ru: "Молочный", kk: "Сүт түсті", hex: "#F4EDE1" },
      { slug: "beige", ru: "Бежевый", kk: "Беж", hex: "#DCC7A8" },
      { slug: "sand", ru: "Песочный", kk: "Құм түсті", hex: "#C9AE8B" },
      { slug: "grey", ru: "Серый", kk: "Сұр", hex: "#A9ABA7" },
      { slug: "powder", ru: "Пудровый", kk: "Ақшыл қызғылт", hex: "#E8B8B8" },
      { slug: "pink", ru: "Розовый", kk: "Қызғылт", hex: "#E79AA6" },
      { slug: "sage", ru: "Шалфей", kk: "Шалфей түсті", hex: "#7FA68A" },
      { slug: "mint", ru: "Мятный", kk: "Жалбыз түсті", hex: "#BFE0CF" },
      { slug: "green", ru: "Зелёный", kk: "Жасыл", hex: "#4F7F5A" },
      { slug: "light-blue", ru: "Голубой", kk: "Көгілдір", hex: "#A9C8E0" },
      { slug: "blue", ru: "Синий", kk: "Көк", hex: "#3E5C8A" },
      { slug: "lavender", ru: "Лавандовый", kk: "Лаванда түсті", hex: "#C3B5DC" },
      { slug: "yellow", ru: "Жёлтый", kk: "Сары", hex: "#F1D37A" },
      { slug: "brown", ru: "Коричневый", kk: "Қоңыр", hex: "#8B6547" },
      { slug: "red", ru: "Красный", kk: "Қызыл", hex: "#C4524F" },
      { slug: "black", ru: "Чёрный", kk: "Қара", hex: "#2F3430" },
    ],
  },
  {
    code: "season",
    ru: "Сезон",
    kk: "Маусым",
    type: "MULTISELECT",
    display: "CHECKBOX",
    axis: false,
    values: [
      { slug: "summer", ru: "Лето", kk: "Жаз" },
      { slug: "demi", ru: "Демисезон", kk: "Демисезон" },
      { slug: "winter", ru: "Зима", kk: "Қыс" },
      { slug: "all", ru: "Всесезон", kk: "Барлық маусым" },
    ],
  },
  {
    code: "material",
    ru: "Материал",
    kk: "Материалы",
    type: "MULTISELECT",
    display: "CHECKBOX",
    axis: false,
    values: [
      { slug: "cotton", ru: "Хлопок", kk: "Мақта" },
      { slug: "muslin", ru: "Муслин", kk: "Муслин" },
      { slug: "knit", ru: "Трикотаж", kk: "Трикотаж" },
      { slug: "fleece", ru: "Флис", kk: "Флис" },
      { slug: "bamboo", ru: "Бамбук", kk: "Бамбук" },
      { slug: "linen", ru: "Лён", kk: "Зығыр" },
      { slug: "wool", ru: "Шерсть", kk: "Жүн" },
      { slug: "velour", ru: "Велюр", kk: "Велюр" },
      { slug: "silicone", ru: "Силикон", kk: "Силикон" },
      { slug: "plastic", ru: "Пластик", kk: "Пластик" },
      { slug: "wood", ru: "Дерево", kk: "Ағаш" },
      { slug: "glass", ru: "Стекло", kk: "Шыны" },
      { slug: "ceramic", ru: "Керамика", kk: "Керамика" },
    ],
  },
  {
    code: "volume",
    ru: "Объём",
    kk: "Көлемі",
    type: "SELECT",
    display: "CHIPS",
    axis: true,
    unit: "мл",
    values: [50, 100, 150, 200, 250, 300, 400, 500].map((n) => ({ slug: String(n), ru: `${n} мл`, kk: `${n} мл` })),
  },
];

type Sub = { slug: string; ru: string; kk: string; icon: string; attributes: string[] };

export const CATEGORIES: {
  slug: string;
  ru: string;
  kk: string;
  icon: string;
  hero: { titleRu: string; titleKk: string; textRu: string; textKk: string; scriptRu: string; scriptKk: string };
  sizeChart?: string;
  children: Sub[];
}[] = [
  {
    slug: "dlya-mam",
    ru: "Для мам",
    kk: "Аналарға",
    icon: "heart",
    hero: {
      titleRu: "Для мам",
      titleKk: "Аналарға",
      textRu: "Забота о себе — это тоже забота о своей семье",
      textKk: "Өзіңізге қамқорлық — отбасыңызға да қамқорлық",
      scriptRu: "Ты заслуживаешь заботы",
      scriptKk: "Сіз қамқорлыққа лайықсыз",
    },
    sizeChart: "moms",
    children: [
      { slug: "odezhda-dlya-mam", ru: "Одежда для мам", kk: "Аналарға арналған киім", icon: "shirt", attributes: ["size_adult", "color", "season", "material"] },
      { slug: "dlya-kormleniya", ru: "Для кормления", kk: "Емізуге арналған", icon: "milk", attributes: ["size_adult", "color", "material"] },
      { slug: "sumka-v-roddom", ru: "Сумка в роддом", kk: "Перзентханаға сөмке", icon: "briefcase", attributes: ["color"] },
      { slug: "uhod-dlya-mam", ru: "Уход и красота", kk: "Күтім және сұлулық", icon: "sparkles", attributes: ["volume"] },
      { slug: "aksessuary-dlya-mam", ru: "Аксессуары", kk: "Аксессуарлар", icon: "gem", attributes: ["color", "material"] },
    ],
  },
  {
    slug: "dlya-detey",
    ru: "Для детей",
    kk: "Балаларға",
    icon: "baby",
    hero: {
      titleRu: "Для детей",
      titleKk: "Балаларға",
      textRu: "Всё самое лучшее для ваших малышей",
      textKk: "Бөбектеріңізге ең жақсысы",
      scriptRu: "Счастье в маленьких моментах",
      scriptKk: "Бақыт — кішкентай сәттерде",
    },
    sizeChart: "kids",
    children: [
      { slug: "detskaya-odezhda", ru: "Одежда", kk: "Киім", icon: "shirt", attributes: ["gender", "age", "size", "size_age", "color", "season", "material"] },
      { slug: "igrushki", ru: "Игрушки", kk: "Ойыншықтар", icon: "toy", attributes: ["age", "color", "material"] },
      { slug: "kormlenie", ru: "Кормление", kk: "Тамақтандыру", icon: "milk", attributes: ["age", "volume", "color", "material"] },
      { slug: "gigiena-i-uhod", ru: "Гигиена и уход", kk: "Гигиена және күтім", icon: "droplets", attributes: ["age", "volume"] },
      { slug: "dlya-sna", ru: "Для сна", kk: "Ұйқыға арналған", icon: "moon", attributes: ["color", "material", "season"] },
      { slug: "transport", ru: "Транспорт", kk: "Балалар көлігі", icon: "stroller", attributes: ["age", "color"] },
    ],
  },
  {
    slug: "dlya-doma",
    ru: "Для дома",
    kk: "Үйге",
    icon: "home",
    hero: {
      titleRu: "Для дома",
      titleKk: "Үйге",
      textRu: "Уют в каждой детали для вашего дома",
      textKk: "Үйіңізге әр бөлшекте жайлылық",
      scriptRu: "Дом — там, где уют",
      scriptKk: "Үй — жайлылық бар жерде",
    },
    children: [
      { slug: "tekstil", ru: "Текстиль", kk: "Тоқыма", icon: "layers", attributes: ["color", "material"] },
      { slug: "dekor", ru: "Декор", kk: "Декор", icon: "flower", attributes: ["color", "material"] },
      { slug: "hranenie", ru: "Хранение", kk: "Сақтау", icon: "box", attributes: ["color", "material"] },
      { slug: "kuhnya", ru: "Кухня", kk: "Ас үй", icon: "cooking-pot", attributes: ["color", "material", "volume"] },
      { slug: "osveschenie", ru: "Освещение", kk: "Жарықтандыру", icon: "lamp", attributes: ["color"] },
    ],
  },
  {
    slug: "dlya-sebya",
    ru: "Для себя",
    kk: "Өзіңізге",
    icon: "flower",
    hero: {
      titleRu: "Для себя",
      titleKk: "Өзіңізге",
      textRu: "Забота о себе — это тоже забота о своей семье",
      textKk: "Өзіңізге қамқорлық — отбасыңызға да қамқорлық",
      scriptRu: "Красивая и счастливая",
      scriptKk: "Әдемі әрі бақытты",
    },
    children: [
      { slug: "uhod-za-litsom", ru: "Уход за лицом", kk: "Бет күтімі", icon: "sparkles", attributes: ["volume"] },
      { slug: "uhod-za-telom", ru: "Уход за телом", kk: "Дене күтімі", icon: "droplets", attributes: ["volume"] },
      { slug: "volosy", ru: "Волосы", kk: "Шаш күтімі", icon: "wind", attributes: ["volume"] },
      { slug: "dekor-i-aromat", ru: "Декор и аромат", kk: "Декор және хош иіс", icon: "flame", attributes: ["volume", "color"] },
      { slug: "aksessuary", ru: "Аксессуары", kk: "Аксессуарлар", icon: "gem", attributes: ["color", "material"] },
      { slug: "podarki", ru: "Подарки", kk: "Сыйлықтар", icon: "gift", attributes: [] },
    ],
  },
];

export const BADGES = [
  { code: "hit", ru: "Хит", kk: "Хит", style: "SAGE" as const, sortOrder: 1 },
  { code: "new", ru: "Новинка", kk: "Жаңа", style: "POWDER" as const, sortOrder: 2 },
  { code: "bestseller", ru: "Бестселлер", kk: "Бестселлер", style: "SAGE" as const, sortOrder: 3 },
  { code: "top", ru: "Топ продаж", kk: "Топ сатылым", style: "SAGE" as const, sortOrder: 4 },
];

export const SIZE_CHARTS = {
  kids: {
    ru: "Детская одежда",
    kk: "Балалар киімі",
    noteRu: "Измерьте рост ребёнка без обуви и выберите ближайший больший размер.",
    noteKk: "Баланың бойын аяқ киімсіз өлшеп, ең жақын үлкен өлшемді таңдаңыз.",
    columns: [
      { ru: "Размер (рост, см)", kk: "Өлшем (бойы, см)" },
      { ru: "Возраст", kk: "Жасы" },
      { ru: "Обхват груди, см", kk: "Кеуде айналымы, см" },
      { ru: "Обхват талии, см", kk: "Бел айналымы, см" },
    ],
    rows: [
      ["50", "0–1 мес", "34", "34"],
      ["56", "1–2 мес", "38", "38"],
      ["62", "2–3 мес", "40", "40"],
      ["68", "3–6 мес", "44", "44"],
      ["74", "6–9 мес", "46", "46"],
      ["80", "9–12 мес", "48", "47"],
      ["86", "1–1,5 года", "50", "48"],
      ["92", "1,5–2 года", "52", "50"],
      ["98", "2–3 года", "54", "51"],
      ["104", "3–4 года", "56", "52"],
      ["110", "4–5 лет", "58", "53"],
      ["116", "5–6 лет", "60", "54"],
      ["122", "6–7 лет", "62", "55"],
      ["128", "7–8 лет", "64", "57"],
      ["134", "8–9 лет", "66", "58"],
      ["140", "9–10 лет", "68", "60"],
      ["146", "10–11 лет", "72", "62"],
      ["152", "11–12 лет", "76", "64"],
    ],
  },
  moms: {
    ru: "Одежда для мам",
    kk: "Аналарға арналған киім",
    noteRu: "Во время беременности ориентируйтесь на обхват груди и бёдер.",
    noteKk: "Жүктілік кезінде кеуде мен жамбас айналымына қараңыз.",
    columns: [
      { ru: "Размер", kk: "Өлшем" },
      { ru: "RU", kk: "RU" },
      { ru: "Обхват груди, см", kk: "Кеуде айналымы, см" },
      { ru: "Обхват бёдер, см", kk: "Жамбас айналымы, см" },
    ],
    rows: [
      ["XS", "40–42", "80–84", "86–90"],
      ["S", "42–44", "84–88", "90–94"],
      ["M", "44–46", "88–92", "94–98"],
      ["L", "46–48", "92–96", "98–102"],
      ["XL", "48–50", "96–100", "102–106"],
      ["XXL", "50–52", "100–104", "106–110"],
    ],
  },
  shoes: {
    ru: "Детская обувь",
    kk: "Балалар аяқ киімі",
    noteRu: "Длина стопы + 0,5–1 см на рост ноги.",
    noteKk: "Табан ұзындығы + аяқтың өсуіне 0,5–1 см.",
    columns: [
      { ru: "Размер", kk: "Өлшем" },
      { ru: "Длина стопы, см", kk: "Табан ұзындығы, см" },
    ],
    rows: Array.from({ length: 15 }, (_, i) => [String(16 + i), (10 + i * 0.65).toFixed(1).replace(".", ",")]),
  },
} as const;
