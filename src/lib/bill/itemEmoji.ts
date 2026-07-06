// Name → emoji matcher for receipt line items. Pure lookup, zero model calls —
// cosmetic but makes the claim list scannable (IDEAS §4). First matching rule
// wins, so brands come before generic keywords ("Almaza" hits 🍺 before any
// food word could). Keep patterns lowercase; names are lowercased once.

const RULES: Array<[pattern: RegExp, emoji: string]> = [
  // Beer brands common on Lebanese receipts
  [/almaza|jupiler|jupiiler|maes|beirut beer|961|heineken|corona|stella|amstel|budweiser|carlsberg|efes|lindemans|leffe|duvel|chimay|mongzo|hoegaarden/, '🍺'],
  // Spirits & brands
  [/arak|chivas|johnnie|jack daniel|jameson|whisk|bourbon|scotch|cognac|captain morgan|bacardi|rum\b/, '🥃'],
  [/vodka|gin\b|tequila|martini|margarita|mojito|negroni|spritz|sangria|midori|sour\b|cocktail|daiquiri|cosmopolitan|pina colada/, '🍸'],
  [/wine|merlot|cabernet|chardonnay|sauvignon|rose\b|rosé|ksara|kefraya|musar|satyr/, '🍷'],
  [/prosecco|champagne|sparkling/, '🥂'],
  [/beer|pils|lager|draft|draught|stout|ipa\b/, '🍺'],
  // Lebanese food
  [/hummus|hommos|moutabal|mutabbal|baba ghanouj|labneh/, '🥣'],
  [/tabbouleh|taboule|fattoush|fatoush|rocca|salad/, '🥗'],
  [/shawarma|taouk|tawook|wrap\b|saj\b/, '🌯'],
  [/kibbeh|kebbe|kafta|kofta|kebab|skewer|sujuk|makanek/, '🍢'],
  [/manoushe|manouche|mankoushe|manakish|man'oushe|zaatar|za'atar/, '🫓'],
  [/falafel/, '🧆'],
  [/halloumi|haloumi|cheese/, '🧀'],
  [/grape leaves|warak/, '🍃'],
  // Generic food
  [/burger/, '🍔'],
  [/pizza/, '🍕'],
  [/pasta|spaghetti|penne|tagliatelle|fettuccine|linguine|ravioli|lasagna/, '🍝'],
  [/fries|frites|potato|wedges/, '🍟'],
  [/sandwich|panini|club\b|sub\b|toast/, '🥪'],
  [/steak|beef|entrecote|filet|ribeye|tenderloin/, '🥩'],
  [/chicken|poulet|wings|nuggets/, '🍗'],
  [/salmon|fish|seabass|sea bass|hamour|tuna|calamari|octopus/, '🐟'],
  [/shrimp|prawn|scampi/, '🍤'],
  [/sushi|maki|nigiri|sashimi/, '🍣'],
  [/soup|lentil|chorba/, '🍲'],
  [/rice|risotto|biryani/, '🍚'],
  [/egg|omelet/, '🍳'],
  [/croissant|pastry/, '🥐'],
  // Dessert
  [/cake|cheesecake|brownie|fondant|tiramisu|tart\b/, '🍰'],
  [/ice cream|glace|gelato|sundae|booza/, '🍨'],
  [/chocolate|choco/, '🍫'],
  [/knefe|knafeh|kunafa|baklava|maamoul|halawa/, '🍮'],
  [/fruit|watermelon|mango|strawberry|banana|banaan/, '🍓'],
  // Drinks (non-alcoholic) — no \b around digit-leading terms ("7up")
  [/espresso|cappuccino|latte|americano|coffee|nescafe|mocha|macchiato|turkish/, '☕'],
  [/\btea\b|matcha|chai/, '🍵'],
  [/juice|lemonade|jallab|smoothie|passion fruit/, '🧃'],
  [/pepsi|cola|coke|7up|seven up|7 up|sprite|fanta|miranda|mirinda|soda|tonic|red bull|energy/, '🥤'],
  [/water|aqua|sohat|tannourine|perrier|san pellegrino/, '💧'],
  [/shisha|arguile|argileh|hookah/, '💨'],
]

/** Emoji for a line-item name, or null when nothing matches (render nothing). */
export function itemEmoji(name: string): string | null {
  const lower = name.toLowerCase()
  for (const [pattern, emoji] of RULES) {
    if (pattern.test(lower)) return emoji
  }
  return null
}
