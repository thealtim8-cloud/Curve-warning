/* Curve Guide 8.0: curated car facts (hand-checked, kept short and conservative; no invented stats).
   Model entries: [regex on the normalised model name, facts]. Make entries: facts used when no model matches. */
window.CG_CAR_FACTS = {
  makes: {
    'toyota': ['Japanese carmaker; Toyota Motor Co. was set up in 1937.', 'Based in Toyota City, Aichi, Japan.', 'Known for the Toyota Production System ("lean", just-in-time manufacturing).'],
    'honda': ['Japanese company founded by Soichiro Honda in 1948.', 'Started with motorcycles and has been the world\'s biggest motorcycle maker for decades.', 'Its first production car, the T360 mini truck, came out in 1963.'],
    'lexus': ['Toyota\'s luxury brand, launched in 1989.', 'Its first models were the LS 400 and ES 250.', 'Lexus cars are mainly built in Japan.'],
    'hyundai': ['South Korean carmaker founded in 1967.', 'Its first home-grown model was the Pony (1975).', 'Based in Seoul, South Korea.'],
    'kia': ['South Korean carmaker; started in 1944 making bicycle parts.', 'Part of the Hyundai Motor Group since 1998.', 'Based in Seoul, South Korea.'],
    'nissan': ['Japanese carmaker; the Nissan name has been used since 1934.', 'Headquartered in Yokohama, Japan.', 'Its Leaf (2010) was one of the first mass-market electric cars.'],
    'mercedes-benz': ['German brand; Karl Benz\'s 1886 Patent-Motorwagen is seen as the first practical car.', 'The Mercedes-Benz name dates from the 1926 Daimler and Benz merger.', 'Headquartered in Stuttgart, Germany.'],
    'bmw': ['German company founded in 1916, first making aircraft engines.', 'Headquartered in Munich, Germany.', 'Its first car arrived in 1929.'],
    'ford': ['American carmaker founded by Henry Ford in 1903.', 'The Model T (1908) put America on wheels.', 'Ford introduced the moving assembly line for cars in 1913.'],
    'peugeot': ['French brand; the Peugeot family business dates back to 1810.', 'Peugeot Automobile Nigeria (PAN) was set up in Kaduna in 1972.', 'Part of Stellantis since 2021.'],
    'innoson (ivm)': ['Nigerian carmaker: Innoson Vehicle Manufacturing, based in Nnewi, Anambra State.', 'Founded by Nigerian industrialist Innocent Chukwuma.', 'Builds cars, SUVs, pickups and buses for the Nigerian market.'],
    'bajaj': ['Indian company (Bajaj Auto), founded in 1945, based in Pune.', 'Its RE three-wheeler is the well-known "Keke" in Nigeria.', 'Boxer motorcycles are a common sight on Nigerian roads.'],
    'yutong': ['Chinese bus maker based in Zhengzhou, Henan.', 'One of the world\'s largest bus manufacturers.', 'Its roots go back to 1963.'],
    'volkswagen': ['German carmaker founded in 1937, based in Wolfsburg.', 'The Beetle sold more than 21 million units.', 'The name means "people\'s car".'],
    'mitsubishi': ['Japanese carmaker; Mitsubishi Motors became a separate company in 1970.', 'Known for the Pajero and L200 pickup.', 'Part of the Renault-Nissan-Mitsubishi Alliance.'],
    'mazda': ['Japanese carmaker based in Hiroshima, founded in 1920.', 'Famous for the rotary (Wankel) engine.', 'The MX-5 roadster is one of the best-selling two-seat sports cars ever.'],
    'suzuki': ['Japanese company from Hamamatsu, founded in 1909.', 'It started out making weaving looms.', 'Known for small cars and motorcycles.'],
    'land rover': ['British brand; the first Land Rover appeared in 1948.', 'Known for off-road SUVs like the Defender and Range Rover.', 'Owned by India\'s Tata Motors since 2008.'],
    'jeep': ['American brand that grew out of the World War II military Jeep (1941).', 'Known for the Wrangler and Grand Cherokee.', 'Part of Stellantis.'],
    'chevrolet': ['American brand founded in 1911 by Louis Chevrolet and William Durant.', 'Part of General Motors.', 'Famous for the Corvette and Camaro.'],
    'volvo': ['Swedish carmaker founded in 1927.', 'Volvo engineer Nils Bohlin invented the three-point seat belt in 1959.', 'Owned by China\'s Geely since 2010.'],
    'audi': ['German carmaker based in Ingolstadt.', 'The four rings stand for the 1932 Auto Union of four companies.', 'Part of the Volkswagen Group.'],
    'renault': ['French carmaker founded in 1899.', 'Based near Paris (Boulogne-Billancourt).', 'Owns the Dacia brand.'],
    'porsche': ['German sports-car maker founded in 1931, based in Stuttgart.', 'The 911 has been made since 1964.', 'Part of the Volkswagen Group.'],
    'subaru': ['Japanese carmaker.', 'Its logo shows the Pleiades star cluster ("Subaru" in Japanese).', 'Known for all-wheel drive and boxer engines.'],
    'acura': ['Honda\'s luxury brand, launched in 1986 in North America.', 'One of the first Japanese luxury car brands.', 'Known for the NSX sports car.'],
    'infiniti': ['Nissan\'s luxury brand, launched in 1989.', 'Known for the QX SUVs.', 'Based in Yokohama, Japan.'],
    'tesla': ['American electric-car company founded in 2003.', 'Its first car was the Roadster (2008).', 'Model Y became one of the world\'s best-selling cars.'],
    'geely': ['Chinese carmaker based in Hangzhou.', 'Has owned Volvo Cars since 2010.', 'Founded by Li Shufu.'],
    'opel': ['German brand from Rüsselsheim; began as a sewing-machine maker in 1862.', 'Built its first car in 1899.', 'Part of Stellantis.'],
    'fiat': ['Italian carmaker founded in Turin in 1899.', 'The name stands for Fabbrica Italiana Automobili Torino.', 'Part of Stellantis.'],
    'isuzu': ['Japanese maker best known for trucks and diesel engines.', 'Known for the D-Max pickup.', 'Based in Yokohama, Japan.'],
    'tata': ['Indian company; part of the Tata Group.', 'Owns Jaguar Land Rover since 2008.', 'Known in Africa for trucks and buses.'],
    'yamaha': ['Japanese company; Yamaha Motor was founded in 1955.', 'Its first motorcycle was the YA-1.', 'Shares its tuning-fork logo with Yamaha musical instruments.'],
    'honda motorcycles': ['Honda began with motorcycles in 1948.', 'The Super Cub is the best-selling motor vehicle in history (over 100 million).', 'Honda has been the world\'s biggest motorcycle maker for decades.'],
    'tvs': ['Indian motorcycle and scooter maker (TVS Motor).', 'Its Apache and King three-wheeler are common in Africa.', 'Based in Chennai, India.']
  },
  models: {
    'toyota': [
      [/^camry/, ['First launched in 1982.', 'The name comes from the Japanese word "kanmuri" (crown).', 'For most years since the late 1990s it has been America\'s best-selling car.']],
      [/^corolla/, ['First launched in 1966.', 'The best-selling car nameplate in the world, over 50 million sold.', 'Corolla means "small crown" in Latin.']],
      [/^hilux/, ['First launched in 1968.', 'Famous for surviving BBC Top Gear\'s attempts to destroy one.', 'One of the most common pickups in Africa.']],
      [/^sienna/, ['First launched in 1997 (1998 model year).', 'Built in Princeton, Indiana, USA.', 'Since the 2021 model it comes only as a hybrid.']],
      [/^rav ?4/, ['First launched in 1994.', 'Often called one of the first compact crossover SUVs.', 'RAV4 stands for "Recreational Activity Vehicle: 4-wheel drive".']],
      [/^highlander/, ['First launched in 2000 (2001 model year).', 'A mid-size three-row SUV.', 'Called the Kluger in Japan and Australia.']],
      [/^land ?cruiser|^prado/, ['The Land Cruiser name dates from 1954.', 'One of Toyota\'s longest-running models.', 'Known for toughness on bad roads.']],
      [/^venza/, ['First launched in 2008 (2009 model year).', 'A crossover between a car and an SUV.', 'Returned in 2020 as a hybrid-only model.']],
      [/^avalon/, ['First launched in 1994.', 'Toyota\'s large front-wheel-drive sedan.', 'Was built in Georgetown, Kentucky, USA.']]
    ],
    'honda': [
      [/^accord/, ['First launched in 1976.', 'In 1982 it became the first Japanese car built in the USA (Marysville, Ohio).', 'One of Honda\'s best-selling models.']],
      [/^civic/, ['First launched in 1972.', 'Its CVCC engine met strict 1970s US emission rules without a catalytic converter.', 'One of Honda\'s best-selling models worldwide.']],
      [/^cr-?v/, ['First launched in 1995.', 'Honda\'s compact SUV.', 'One of the world\'s best-selling SUVs.']],
      [/^pilot/, ['First launched in 2002 (2003 model year).', 'A three-row mid-size SUV.', 'Built in the USA.']],
      [/^odyssey/, ['First launched in 1994.', 'Honda\'s family minivan.', 'The North American version is built in Alabama, USA.']]
    ],
    'lexus': [
      [/^rx/, ['First launched in 1998 (RX 300).', 'The RX 400h (2005) was the first luxury hybrid SUV.', 'Lexus\'s best-selling model in many markets.']],
      [/^es/, ['Launched in 1989, one of the first two Lexus models.', 'Shares its basic design with the Toyota Camry/Avalon.', 'A comfort-focused mid-size sedan.']],
      [/^gx/, ['First launched in 2002.', 'Related to the Toyota Land Cruiser Prado.', 'A body-on-frame SUV built for rough roads.']],
      [/^lx/, ['First launched in 1996.', 'Lexus\'s flagship SUV, related to the Toyota Land Cruiser.', 'Built in Japan.']],
      [/^is/, ['First launched in 1998 (1999 in Europe).', 'Lexus\'s compact sports sedan.', 'Rear-wheel drive in most versions.']]
    ],
    'hyundai': [
      [/^elantra/, ['First launched in 1990.', 'Sold as the "Lantra" in some markets in the 1990s.', 'Hyundai\'s compact sedan.']],
      [/^tucson/, ['First launched in 2004.', 'Named after the city of Tucson, Arizona.', 'Hyundai\'s compact SUV.']],
      [/^sonata/, ['First launched in 1985.', 'Hyundai\'s mid-size sedan.', 'One of Hyundai\'s longest-running names.']],
      [/^santa ?fe/, ['First launched in 2000.', 'A mid-size family SUV.', 'Named after Santa Fe, New Mexico.']]
    ],
    'kia': [
      [/^sportage/, ['First launched in 1993.', 'Kia\'s compact SUV.', 'One of Kia\'s best-selling models.']],
      [/^rio/, ['First launched in 2000.', 'Kia\'s small car.', 'Sold in many countries worldwide.']],
      [/^sorento/, ['First launched in 2002.', 'Kia\'s mid-size SUV.', 'Offered with three rows of seats.']]
    ],
    'nissan': [
      [/^altima/, ['First sold in 1992 (1993 model year).', 'Nissan\'s mid-size sedan.', 'Built in the USA.']],
      [/^pathfinder/, ['First launched in 1985 (1986 model year).', 'Nissan\'s family SUV.', 'Later generations have three rows of seats.']],
      [/^patrol/, ['First launched in 1951.', 'Nissan\'s large off-road SUV.', 'Known for toughness in desert and rough-road use.']],
      [/^sunny/, ['First launched in 1966.', 'A small, economical family car.', 'Sold as the Sentra in the Americas.']],
      [/^almera/, ['First launched in 1995.', 'A small family car.', 'Sold in Europe, Asia and Africa.']]
    ],
    'mercedes-benz': [
      [/^c( ?-? ?class|\s?\d{2,3})/, ['The C-Class launched in 1993, replacing the 190.', 'Mercedes-Benz\'s compact executive car.', 'One of the brand\'s best-selling models.']],
      [/^e( ?-? ?class|\s?\d{2,3})/, ['The E-Class name has been used since 1993.', 'Its family line goes back to the W123 and W124 of the 1970s and 80s.', 'Mercedes-Benz\'s mid-size executive car.']],
      [/^(ml|m-? ?class|gle)/, ['The M-Class (now GLE) launched in 1997.', 'The first Mercedes-Benz built in the USA (Alabama).', 'A mid-size luxury SUV.']]
    ],
    'bmw': [
      [/^3( ?series|\d{2})/, ['The 3 Series launched in 1975.', 'BMW\'s best-selling model.', 'A compact executive sedan, rear-wheel drive in most versions.']],
      [/^5( ?series|\d{2})/, ['The 5 Series launched in 1972.', 'It was the first BMW to use the "Series" naming.', 'BMW\'s mid-size executive sedan.']]
    ],
    'ford': [
      [/^f-? ?150|^f-series/, ['Part of the F-Series, launched in 1948.', 'America\'s best-selling truck for over 40 years.', 'Full-size pickup.']],
      [/^focus/, ['First launched in 1998.', 'Ford\'s compact family car.', 'European Car of the Year 1999.']],
      [/^explorer/, ['First launched in 1990 (1991 model year).', 'One of the SUVs that made SUVs popular in the 1990s.', 'Three rows of seats.']],
      [/^mustang/, ['First launched in 1964.', 'The original "pony car".', 'One of Ford\'s longest-running names.']],
      [/^escape/, ['First launched in 2000.', 'Ford\'s compact SUV, called Kuga in Europe.', 'Offered as a hybrid since 2004.']]
    ],
    'peugeot': [
      [/^504/, ['First launched in 1968.', 'European Car of the Year 1969.', 'Assembled by PAN in Kaduna and a classic Nigerian car and taxi.']],
      [/^406/, ['First launched in 1995.', 'A mid-size family car.', 'Starred as the taxi in the French film "Taxi" (1998).']]
    ],
    'bajaj': [
      [/^re|keke/, ['The Bajaj RE is the three-wheeler Nigerians call "Keke".', '"Keke NAPEP" comes from the National Poverty Eradication Programme.', 'Made by Bajaj Auto in India.']],
      [/^boxer/, ['A simple, rugged commuter motorcycle from Bajaj Auto, India.', 'Very common for commercial "okada" use in Nigeria.', 'Known for low running costs.']]
    ]
  }
};
