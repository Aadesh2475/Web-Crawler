# Phase 4: Global Entity Knowledge Base
# Pre-seeded static metadata for global companies, leaders, and organizations

ENTITY_DB = {
    # ─── BIG TECH ──────────────────────────────────────────────────────────────
    "OpenAI": {
        "type": "ORG", "sector": "AI / Research",
        "market_cap": "$157B", "employees": "3,000+", "users": "200M+",
        "ceo": "Sam Altman", "founded": 2015, "country": "USA",
        "hq": "San Francisco, CA",
        "services": ["ChatGPT", "GPT-4o API", "DALL·E 3", "Sora", "Codex"],
        "categories": ["Technology", "Artificial Intelligence", "Finance"]
    },
    "Microsoft": {
        "type": "ORG", "sector": "Technology",
        "market_cap": "$3.1T", "employees": "228,000+", "users": "1.4B+",
        "ceo": "Satya Nadella", "founded": 1975, "country": "USA",
        "hq": "Redmond, WA",
        "services": ["Azure", "Office 365", "Teams", "Xbox", "Bing AI", "LinkedIn"],
        "categories": ["Technology", "Finance", "Geopolitics"]
    },
    "NVIDIA": {
        "type": "ORG", "sector": "Semiconductors",
        "market_cap": "$2.8T", "employees": "36,000+", "users": "Millions",
        "ceo": "Jensen Huang", "founded": 1993, "country": "USA",
        "hq": "Santa Clara, CA",
        "services": ["GeForce GPUs", "CUDA", "H100", "DGX Systems", "DLSS"],
        "categories": ["Technology", "Artificial Intelligence", "Finance"]
    },
    "Apple": {
        "type": "ORG", "sector": "Consumer Electronics",
        "market_cap": "$3.4T", "employees": "164,000+", "users": "2B+",
        "ceo": "Tim Cook", "founded": 1976, "country": "USA",
        "hq": "Cupertino, CA",
        "services": ["iPhone", "Mac", "App Store", "Apple Intelligence", "iCloud"],
        "categories": ["Technology", "Finance", "Geopolitics"]
    },
    "Google": {
        "type": "ORG", "sector": "Technology",
        "market_cap": "$2.0T", "employees": "182,000+", "users": "4B+",
        "ceo": "Sundar Pichai", "founded": 1998, "country": "USA",
        "hq": "Mountain View, CA",
        "services": ["Search", "YouTube", "Android", "Gemini AI", "Google Cloud"],
        "categories": ["Technology", "Artificial Intelligence", "Finance"]
    },
    "Meta": {
        "type": "ORG", "sector": "Social Media",
        "market_cap": "$1.4T", "employees": "71,000+", "users": "3.5B+",
        "ceo": "Mark Zuckerberg", "founded": 2004, "country": "USA",
        "hq": "Menlo Park, CA",
        "services": ["Facebook", "Instagram", "WhatsApp", "Llama AI", "Ray-Ban Meta"],
        "categories": ["Technology", "Artificial Intelligence", "Finance"]
    },
    "Amazon": {
        "type": "ORG", "sector": "E-commerce / Cloud",
        "market_cap": "$2.1T", "employees": "1.5M+", "users": "300M+",
        "ceo": "Andy Jassy", "founded": 1994, "country": "USA",
        "hq": "Seattle, WA",
        "services": ["AWS", "Prime", "Alexa", "Bedrock AI", "Kindle"],
        "categories": ["Technology", "Finance", "Geopolitics"]
    },
    "Tesla": {
        "type": "ORG", "sector": "Automotive / Energy",
        "market_cap": "$600B", "employees": "140,000+", "users": "6M+ vehicles",
        "ceo": "Elon Musk", "founded": 2003, "country": "USA",
        "hq": "Austin, TX",
        "services": ["Model S/3/X/Y", "Cybertruck", "Powerwall", "FSD", "Supercharger"],
        "categories": ["Technology", "Finance", "Climate Change"]
    },
    "SpaceX": {
        "type": "ORG", "sector": "Aerospace",
        "market_cap": "$210B", "employees": "13,000+", "users": "N/A",
        "ceo": "Elon Musk", "founded": 2002, "country": "USA",
        "hq": "Hawthorne, CA",
        "services": ["Falcon 9", "Starship", "Starlink", "Dragon", "Crew missions"],
        "categories": ["Technology", "Geopolitics", "Artificial Intelligence"]
    },
    "Anthropic": {
        "type": "ORG", "sector": "AI Safety / Research",
        "market_cap": "$61B", "employees": "1,000+", "users": "10M+",
        "ceo": "Dario Amodei", "founded": 2021, "country": "USA",
        "hq": "San Francisco, CA",
        "services": ["Claude 3.5", "Claude API", "Constitution AI"],
        "categories": ["Artificial Intelligence", "Technology"]
    },
    "DeepMind": {
        "type": "ORG", "sector": "AI Research",
        "market_cap": "Part of Alphabet", "employees": "2,500+", "users": "Researchers",
        "ceo": "Demis Hassabis", "founded": 2010, "country": "UK",
        "hq": "London, UK",
        "services": ["AlphaFold", "Gemini", "AlphaCode", "AlphaGo"],
        "categories": ["Artificial Intelligence", "Health", "Technology"]
    },
    "Alphabet": {
        "type": "ORG", "sector": "Internet Content",
        "market_cap": "$2.1T", "employees": "182,000+", "users": "4B+",
        "ceo": "Sundar Pichai", "founded": 2015, "country": "USA",
        "hq": "Mountain View, CA",
        "services": ["Google Search", "YouTube", "Android", "Google Cloud", "Waymo"],
        "categories": ["Technology", "Artificial Intelligence", "Finance"]
    },
    "Berkshire Hathaway": {
        "type": "ORG", "sector": "Conglomerate",
        "market_cap": "$880B+", "employees": "396,000+", "users": "N/A",
        "ceo": "Warren Buffett", "founded": 1839, "country": "USA",
        "hq": "Omaha, NE",
        "services": ["Insurance", "Railroads", "Utilities", "Manufacturing", "Retail"],
        "categories": ["Finance", "Geopolitics"]
    },
    "Broadcom": {
        "type": "ORG", "sector": "Semiconductors",
        "market_cap": "$600B+", "employees": "20,000+", "users": "Enterprise",
        "ceo": "Hock Tan", "founded": 1991, "country": "USA",
        "hq": "San Jose, CA",
        "services": ["Semiconductor components", "Infrastructure software", "VMware"],
        "categories": ["Technology", "Finance"]
    },
    "Eli Lilly": {
        "type": "ORG", "sector": "Pharmaceuticals",
        "market_cap": "$700B+", "employees": "43,000+", "users": "Millions",
        "ceo": "David Ricks", "founded": 1876, "country": "USA",
        "hq": "Indianapolis, IN",
        "services": ["Mounjaro", "Zepbound", "Trulicity", "Humalog"],
        "categories": ["Health", "Finance"]
    },
    "TSMC": {
        "type": "ORG", "sector": "Semiconductors",
        "market_cap": "$750B+", "employees": "73,000+", "users": "B2B",
        "ceo": "C.C. Wei", "founded": 1987, "country": "Taiwan",
        "hq": "Hsinchu, Taiwan",
        "services": ["Silicon wafer manufacturing", "Advanced node chips"],
        "categories": ["Technology", "Geopolitics", "Finance"]
    },
    "JPMorgan Chase": {
        "type": "ORG", "sector": "Banking",
        "market_cap": "$570B+", "employees": "300,000+", "users": "Millions",
        "ceo": "Jamie Dimon", "founded": 2000, "country": "USA",
        "hq": "New York, NY",
        "services": ["Retail Banking", "Investment Banking", "Asset Management"],
        "categories": ["Finance", "Geopolitics"]
    },
    "Visa": {
        "type": "ORG", "sector": "Financial Services",
        "market_cap": "$550B+", "employees": "28,000+", "users": "3B+",
        "ceo": "Ryan McInerney", "founded": 1958, "country": "USA",
        "hq": "San Francisco, CA",
        "services": ["Payment Network", "Credit Cards", "Debit Cards", "Fintech"],
        "categories": ["Finance", "Technology"]
    },
    "ASML": {
        "type": "ORG", "sector": "Semiconductors",
        "market_cap": "$380B+", "employees": "42,000+", "users": "Enterprise",
        "ceo": "Christophe Fouquet", "founded": 1984, "country": "Netherlands",
        "hq": "Veldhoven, Netherlands",
        "services": ["Photolithography systems", "EUV lithography machines"],
        "categories": ["Technology", "Geopolitics", "Finance"]
    },
    "Oracle": {
        "type": "ORG", "sector": "Software",
        "market_cap": "$340B+", "employees": "164,000+", "users": "Enterprise",
        "ceo": "Safra Catz", "founded": 1977, "country": "USA",
        "hq": "Austin, TX",
        "services": ["Database Software", "Cloud Infrastructure", "Enterprise ERP"],
        "categories": ["Technology", "Finance"]
    },
    "Tencent": {
        "type": "ORG", "sector": "Internet Content",
        "market_cap": "$400B+", "employees": "100,000+", "users": "1.3B+",
        "ceo": "Pony Ma", "founded": 1998, "country": "China",
        "hq": "Shenzhen, China",
        "services": ["WeChat", "QQ", "Tencent Games", "Tencent Video"],
        "categories": ["Technology", "Finance", "Geopolitics"]
    },
    "UnitedHealth Group": {
        "type": "ORG", "sector": "Healthcare",
        "market_cap": "$450B+", "employees": "440,000+", "users": "150M+",
        "ceo": "Andrew Witty", "founded": 1977, "country": "USA",
        "hq": "Minnetonka, MN",
        "services": ["Health Insurance", "Optum Health Services", "Pharmacy benefits"],
        "categories": ["Health", "Finance"]
    },
    "Walmart": {
        "type": "ORG", "sector": "Retail",
        "market_cap": "$480B+", "employees": "2.1M+", "users": "250M+ weekly",
        "ceo": "Doug McMillon", "founded": 1962, "country": "USA",
        "hq": "Bentonville, AR",
        "services": ["Hypermarkets", "E-commerce", "Sam's Club", "Walmart+"],
        "categories": ["Finance", "Geopolitics"]
    },
    "Mastercard": {
        "type": "ORG", "sector": "Financial Services",
        "market_cap": "$430B+", "employees": "33,000+", "users": "3B+",
        "ceo": "Michael Miebach", "founded": 1966, "country": "USA",
        "hq": "Purchase, NY",
        "services": ["Payment Network", "Credit Cards", "Debit Cards", "Data Analytics"],
        "categories": ["Finance", "Technology"]
    },
    # ─── PHARMA / HEALTH ───────────────────────────────────────────────────────
    "Pfizer": {
        "type": "ORG", "sector": "Pharmaceuticals",
        "market_cap": "$160B", "employees": "88,000+", "users": "Billions",
        "ceo": "Albert Bourla", "founded": 1849, "country": "USA",
        "hq": "New York, NY",
        "services": ["COVID-19 Vaccine", "Paxlovid", "Lipitor", "Eliquis"],
        "categories": ["Health", "Finance", "Geopolitics"]
    },
    "Moderna": {
        "type": "ORG", "sector": "Biotechnology",
        "market_cap": "$20B", "employees": "4,800+", "users": "Millions",
        "ceo": "Stéphane Bancel", "founded": 2010, "country": "USA",
        "hq": "Cambridge, MA",
        "services": ["mRNA COVID Vaccine", "Flu mRNA", "Cancer Vaccines"],
        "categories": ["Health", "Artificial Intelligence", "Finance"]
    },
    "Johnson & Johnson": {
        "type": "ORG", "sector": "Healthcare",
        "market_cap": "$380B", "employees": "133,000+", "users": "Billions",
        "ceo": "Joaquin Duato", "founded": 1886, "country": "USA",
        "hq": "New Brunswick, NJ",
        "services": ["Janssen", "Band-Aid", "Tylenol", "Medical Devices"],
        "categories": ["Health", "Finance"]
    },
    # ─── FINANCE ───────────────────────────────────────────────────────────────
    "BlackRock": {
        "type": "ORG", "sector": "Asset Management",
        "market_cap": "$130B", "employees": "21,000+", "users": "$10T AUM",
        "ceo": "Larry Fink", "founded": 1988, "country": "USA",
        "hq": "New York, NY",
        "services": ["iShares ETFs", "Aladdin Platform", "ESG Investing"],
        "categories": ["Finance", "Geopolitics"]
    },
    "Goldman Sachs": {
        "type": "ORG", "sector": "Investment Banking",
        "market_cap": "$170B", "employees": "45,000+", "users": "Institutional",
        "ceo": "David Solomon", "founded": 1869, "country": "USA",
        "hq": "New York, NY",
        "services": ["Investment Banking", "Marcus", "Asset Management"],
        "categories": ["Finance", "Geopolitics"]
    },
    # ─── GEOPOLITICS / GLOBAL ──────────────────────────────────────────────────
    "NATO": {
        "type": "ORG", "sector": "Military Alliance",
        "market_cap": "N/A", "employees": "6,600+ staff", "users": "32 nations",
        "ceo": "Mark Rutte (Secretary General)", "founded": 1949, "country": "International",
        "hq": "Brussels, Belgium",
        "services": ["Collective Defence", "Crisis Management", "Cooperative Security"],
        "categories": ["Geopolitics", "Technology"]
    },
    "United Nations": {
        "type": "ORG", "sector": "International Organization",
        "market_cap": "N/A", "employees": "44,000+", "users": "193 member states",
        "ceo": "António Guterres (Secretary-General)", "founded": 1945, "country": "International",
        "hq": "New York, NY",
        "services": ["UNICEF", "WHO", "Climate Accords", "Peacekeeping"],
        "categories": ["Geopolitics", "Climate Change", "Health"]
    },
    "IMF": {
        "type": "ORG", "sector": "International Finance",
        "market_cap": "N/A", "employees": "2,700+", "users": "190 countries",
        "ceo": "Kristalina Georgieva", "founded": 1944, "country": "International",
        "hq": "Washington, DC",
        "services": ["Economic Surveillance", "Loans", "Technical Assistance"],
        "categories": ["Finance", "Geopolitics"]
    },
    # ─── ENERGY / CLIMATE ──────────────────────────────────────────────────────
    "Saudi Aramco": {
        "type": "ORG", "sector": "Oil & Gas",
        "market_cap": "$1.8T", "employees": "70,000+", "users": "Global",
        "ceo": "Amin H. Nasser", "founded": 1933, "country": "Saudi Arabia",
        "hq": "Dhahran, Saudi Arabia",
        "services": ["Crude Oil", "Natural Gas", "Petrochemicals", "Renewables"],
        "categories": ["Finance", "Geopolitics", "Climate Change"]
    },
    "BP": {
        "type": "ORG", "sector": "Energy",
        "market_cap": "$96B", "employees": "87,000+", "users": "Global",
        "ceo": "Murray Auchincloss", "founded": 1909, "country": "UK",
        "hq": "London, UK",
        "services": ["Oil", "Natural Gas", "Solar", "Wind", "EV Charging"],
        "categories": ["Climate Change", "Finance", "Geopolitics"]
    },
    # ─── KEY PEOPLE ─────────────────────────────────────────────────────────────
    "Elon Musk": {
        "type": "PERSON", "sector": "Technology / Finance",
        "role": "CEO of Tesla, SpaceX, xAI; Owner of X",
        "companies": ["Tesla", "SpaceX", "xAI", "X (Twitter)", "The Boring Company"],
        "net_worth": "$180B+", "country": "USA",
        "categories": ["Technology", "Finance", "Geopolitics", "Artificial Intelligence"]
    },
    "Sam Altman": {
        "type": "PERSON", "sector": "Artificial Intelligence",
        "role": "CEO of OpenAI",
        "companies": ["OpenAI"],
        "net_worth": "$2B+", "country": "USA",
        "categories": ["Artificial Intelligence", "Technology"]
    },
    "Sundar Pichai": {
        "type": "PERSON", "sector": "Technology",
        "role": "CEO of Alphabet / Google",
        "companies": ["Google", "DeepMind"],
        "net_worth": "$1.3B+", "country": "USA",
        "categories": ["Technology", "Artificial Intelligence"]
    },
    "Jensen Huang": {
        "type": "PERSON", "sector": "Semiconductors",
        "role": "CEO & Co-founder of NVIDIA",
        "companies": ["NVIDIA"],
        "net_worth": "$100B+", "country": "USA",
        "categories": ["Technology", "Artificial Intelligence", "Finance"]
    },
    "Mark Zuckerberg": {
        "type": "PERSON", "sector": "Social Media",
        "role": "CEO of Meta",
        "companies": ["Meta", "Instagram", "WhatsApp"],
        "net_worth": "$190B+", "country": "USA",
        "categories": ["Technology", "Artificial Intelligence"]
    },
    "Satya Nadella": {
        "type": "PERSON", "sector": "Technology",
        "role": "CEO of Microsoft",
        "companies": ["Microsoft"],
        "net_worth": "$1.2B+", "country": "USA",
        "categories": ["Technology", "Artificial Intelligence", "Finance"]
    },
    "Tim Cook": {
        "type": "PERSON", "sector": "Technology",
        "role": "CEO of Apple",
        "companies": ["Apple"],
        "net_worth": "$2B+", "country": "USA",
        "categories": ["Technology", "Finance"]
    },
    "Jeff Bezos": {
        "type": "PERSON", "sector": "E-Commerce / Aerospace",
        "role": "Founder of Amazon; Founder of Blue Origin",
        "companies": ["Amazon", "Blue Origin", "Washington Post"],
        "net_worth": "$200B+", "country": "USA",
        "categories": ["Technology", "Finance", "Geopolitics"]
    },
    "Vladimir Putin": {
        "type": "PERSON", "sector": "Geopolitics",
        "role": "President of Russia",
        "companies": [],
        "net_worth": "Estimated $200B+", "country": "Russia",
        "categories": ["Geopolitics", "Finance"]
    },
    "Xi Jinping": {
        "type": "PERSON", "sector": "Geopolitics",
        "role": "President of China & General Secretary of CCP",
        "companies": [],
        "net_worth": "N/A", "country": "China",
        "categories": ["Geopolitics", "Finance", "Technology"]
    },
    "Narendra Modi": {
        "type": "PERSON", "sector": "Geopolitics",
        "role": "Prime Minister of India",
        "companies": [],
        "net_worth": "N/A", "country": "India",
        "categories": ["Geopolitics", "Technology", "Finance"]
    },
}
