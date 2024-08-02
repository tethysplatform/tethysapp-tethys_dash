const CNRFCEnsembleBaseUrl = "https://www.cnrfc.noaa.gov/images/ensembles/";
const CDECGuidancePlotBaseUrl = "https://cdec.water.ca.gov/guidance_plots/";
export const CNRFCOptions = [
  {
    value: {
      baseURL: CNRFCEnsembleBaseUrl,
      plotName: ".ens_accum10day.png",
    },
    label: "10-Day Accumulated Volume",
  },
  {
    value: {
      baseURL: CNRFCEnsembleBaseUrl,
      plotName: ".ens_boxwhisker.png",
    },
    label: "10-Day Maximum Flow Probability",
  },
  {
    value: {
      baseURL: CNRFCEnsembleBaseUrl,
      plotName: ".ens_10day.png",
    },
    label: "Daily Maximum Flow Probability",
  },
  {
    value: {
      baseURL: CNRFCEnsembleBaseUrl,
      plotName: ".ens_monthly.png",
    },
    label: "Monthly Volume Exceedance",
  },
  {
    value: {
      baseURL: CNRFCEnsembleBaseUrl,
      plotName: ".ens_4x5day.png",
    },
    label: "5 Day Volume Exceedance Levels",
  },
  {
    value: "River Forecast Plot",
    label: "River Forecast Plot",
  },
  {
    value: "HEFS Plot",
    label: "HEFS Plot",
  },
  {
    value: "Impact Statements",
    label: "Impact Statements",
  },
  {
    value: {
      fullURL:
        "https://www.cnrfc.noaa.gov/images/dailyBriefing/dailyBriefing.png",
    },
    label: "Daily Briefing",
  },
];

export const CW3EOptions = [
  {
    value: "AR Landfall",
    label: "AR Landfall",
  },
  {
    value: "10-Day Mean QPF Table",
    label: "10-Day Mean QPF Table",
  },
  {
    value: "10-Day Accumulated Ensemble QPF",
    label: "10-Day Accumulated Ensemble QPF",
  },
  {
    value: "10-Day 6-Hour Ensemble QPF",
    label: "10-Day 6-Hour Ensemble QPF",
  },
];

export const USACEOptions = [
  {
    value: "Hourly Time Series",
    label: "Hourly Time Series",
  },
];

export const OtherOptions = [
  {
    value: "Custom Image",
    label: "Custom Image",
  },
  {
    value: "Text",
    label: "Text",
  },
];

export const AllDataOptions = [
  { label: "CNRFC", options: CNRFCOptions },
  { label: "CW3E", options: CW3EOptions },
  { label: "USACE", options: USACEOptions },
  { label: "Other", options: OtherOptions },
];

export const USACELocations = [
  {
    value: "sha",
    label: "Shasta Dam & Lake Shasta",
  },
  {
    value: "blb",
    label: "Black Butte Dam & Lake",
  },
  {
    value: "oro",
    label: "Oroville Dam & Lake Oroville",
  },
  {
    value: "bul",
    label: "New Bullards Bar Dam & Lake",
  },
  {
    value: "eng",
    label: "Englebright Lake",
  },
  {
    value: "inv",
    label: "Indian Valley Dam & Reservoir",
  },
  {
    value: "fol",
    label: "Folsom Dam & Lake",
  },
  {
    value: "cmn",
    label: "Camanche Dam & Reservoir",
  },
  {
    value: "nhg",
    label: "New Hogan Dam & Lake",
  },
  {
    value: "frm",
    label: "Farmington Dam & Reservoir",
  },
  {
    value: "nml",
    label: "New Melones Dam & Lake",
  },
  {
    value: "tul",
    label: "Tulloch Dam & Reservoir",
  },
  {
    value: "dnp",
    label: "Don Pedro Dam & Lake",
  },
  {
    value: "exc",
    label: "New Exchequer Dam, Lake McClure",
  },
  {
    value: "lbn",
    label: "Los Banos Detention Reservoir",
  },
  {
    value: "bur",
    label: "Burns Dam & Reservoir",
  },
  {
    value: "bar",
    label: "Bear Dam & Reservoir",
  },
  {
    value: "own",
    label: "Owens Dam & Reservoir",
  },
  {
    value: "mar",
    label: "Mariposa Dam & Reservoir",
  },
  {
    value: "buc",
    label: "Buchanan Dam, H.V. Eastman Lake",
  },
  {
    value: "hid",
    label: "Hidden Dam, Hensley Lake",
  },
  {
    value: "mil",
    label: "Friant Dam, Millerton Lake",
  },
  {
    value: "bdc",
    label: "Big Dry Creek Dam & Reservoir",
  },
  {
    value: "pnf",
    label: "Pine Flat Dam & Lake",
  },
  {
    value: "trm",
    label: "Terminus Dam, Lake Kaweah",
  },
  {
    value: "scc",
    label: "Schafer Dam, Success Lake",
  },
  {
    value: "isb",
    label: "Isabella Dam & Lake Isabella",
  },
  {
    value: "coy",
    label: "Coyote Valley Dam, Lake Mendocino",
  },
  {
    value: "wrs",
    label: "Warm Springs Dam, Lake Sonoma",
  },
  {
    value: "dlv",
    label: "Del Valle Dam & Reservoir",
  },
  {
    value: "mrt",
    label: "Martis Creek Dam & Lake",
  },
  {
    value: "prs",
    label: "Prosser Creek Dam & Reservoir",
  },
  {
    value: "stp",
    label: "Stampede Dam & Reservoir",
  },
  {
    value: "boc",
    label: "Boca Dam & Reservoir",
  },
];

export const CNRFCGauges = [
  {
    label: "North Coast",
    options: [
      {
        label: "CREC1 - SMITH RIVER - JEDEDIAH SMITH SP NEAR CRESCENT CITY",
        value: "CREC1",
      },
      { label: "FTDC1 - SMITH RIVER - DOCTOR FINE BRIDGE", value: "FTDC1" },
      { label: "ORIC1 - REDWOOD CREEK - ORICK", value: "ORIC1" },
      { label: "ARCC1 - MAD RIVER - ARCATA", value: "ARCC1" },
      { label: "PLBC1 - EEL RIVER - LAKE PILLSBURY", value: "PLBC1" },
      { label: "DOSC1 - MIDDLE FORK EEL RIVER - DOS RIOS", value: "DOSC1" },
      { label: "FTSC1 - EEL RIVER - FORT SEWARD", value: "FTSC1" },
      { label: "LEGC1 - SOUTH FORK EEL RIVER - LEGGETT", value: "LEGC1" },
      { label: "MRNC1 - SOUTH FORK EEL RIVER - MIRANDA", value: "MRNC1" },
      { label: "SCOC1 - EEL RIVER - SCOTIA", value: "SCOC1" },
      { label: "BRGC1 - VAN DUZEN RIVER - BRIDGEVILLE", value: "BRGC1" },
      { label: "FRNC1 - EEL RIVER - FERNBRIDGE", value: "FRNC1" },
      { label: "BLKC1 - REDWOOD CREEK - BLUE LAKE", value: "BLKC1" },
      { label: "MAUC1 - MAD RIVER - ABOVE RUTH RESERVOIR", value: "MAUC1" },
      { label: "ETTC1 - MATTOLE RIVER - ETTERSBURG", value: "ETTC1" },
      { label: "MTOC1 - MATTOLE RIVER - PETROLIA", value: "MTOC1" },
      { label: "FTBC1 - NOYO RIVER - FORT BRAGG", value: "FTBC1" },
    ],
  },
  {
    label: "Klamath",
    options: [
      { label: "WKAO3 - WILLIAMSON RIVER - KLAMATH AGENCY", value: "WKAO3" },
      { label: "BTYO3 - SPRAGUE RIVER - BEATTY", value: "BTYO3" },
      { label: "SCNO3 - SYCAN RIVER - BEATTY", value: "SCNO3" },
      { label: "CHSO3 - SPRAGUE RIVER - CHILOQUIN", value: "CHSO3" },
      { label: "WMSO3 - WILLIAMSON RIVER - CHILOQUIN", value: "WMSO3" },
      {
        label: "KLAO3 - KLAMATH RIVER - UPPER KLAMATH LAKE AT KLAMATH FALLS",
        value: "KLAO3",
      },
      { label: "KEOO3 - KLAMATH RIVER - KENO", value: "KEOO3" },
      {
        label: "BOYO3 - KLAMATH RIVER - BELOW JC BOYLE POWER PLANT",
        value: "BOYO3",
      },
      { label: "IRGC1 - KLAMATH RIVER - IRON GATE", value: "IRGC1" },
      { label: "CKEC1 - LOST RIVER - CLEAR LAKE", value: "CKEC1" },
      { label: "GERO3 - MILLER CREEK - GERBER RESERVOIR", value: "GERO3" },
      { label: "YREC1 - SHASTA RIVER - YREKA", value: "YREC1" },
      { label: "FTJC1 - SCOTT RIVER - FORT JONES", value: "FTJC1" },
      { label: "SEIC1 - KLAMATH RIVER - SEIAD VALLEY", value: "SEIC1" },
      { label: "HAPC1 - INDIAN CREEK - HAPPY CAMP", value: "HAPC1" },
      { label: "SBRC1 - SALMON RIVER - SOMES BAR", value: "SBRC1" },
      { label: "ONSC1 - KLAMATH RIVER - ORLEANS", value: "ONSC1" },
      { label: "TCCC1 - TRINITY RIVER - ABOVE COFFEE CREEK", value: "TCCC1" },
      { label: "CEGC1 - TRINITY RIVER - TRINITY LAKE", value: "CEGC1" },
      { label: "TRJC1 - TRINITY RIVER - JUNCTION CITY", value: "TRJC1" },
      {
        label: "TRNC1 - TRINITY RIVER - ABOVE NORTH FORK TRINITY RIVER",
        value: "TRNC1",
      },
      { label: "BURC1 - TRINITY RIVER - BURNT RANCH", value: "BURC1" },
      { label: "HYMC1 - SOUTH FORK TRINITY RIVER - HYAMPOM", value: "HYMC1" },
      { label: "HOOC1 - TRINITY RIVER - HOOPA", value: "HOOC1" },
      { label: "KLMC1 - KLAMATH RIVER - KLAMATH", value: "KLMC1" },
    ],
  },
  {
    label: "Russian/Napa",
    options: [
      { label: "NVRC1 - NAVARRO RIVER - NAVARRO", value: "NVRC1" },
      { label: "UKAC1 - RUSSIAN RIVER - UKIAH", value: "UKAC1" },
      {
        label: "LAMC1 - EAST FORK RUSSIAN RIVER - LAKE MENDOCINO",
        value: "LAMC1",
      },
      { label: "HOPC1 - RUSSIAN RIVER - HOPLAND", value: "HOPC1" },
      { label: "CDLC1 - RUSSIAN RIVER - CLOVERDALE", value: "CDLC1" },
      { label: "BSCC1 - BIG SULPHUR CREEK - CLOVERDALE", value: "BSCC1" },
      { label: "GEYC1 - RUSSIAN RIVER - GEYSERVILLE", value: "GEYC1" },
      { label: "RMKC1 - MAACAMA CREEK - KELLOGG", value: "RMKC1" },
      { label: "HEAC1 - RUSSIAN RIVER - HEALDSBURG", value: "HEAC1" },
      { label: "WSDC1 - DRY CREEK - LAKE SONOMA", value: "WSDC1" },
      { label: "SSAC1 - SANTA ROSA CREEK - SANTA ROSA", value: "SSAC1" },
      { label: "CTIC1 - LAGUNA DE SANTA ROSA - COATI", value: "CTIC1" },
      { label: "LSEC1 - LAGUNA DE SANTA ROSA - SEBASTOPOL", value: "LSEC1" },
      { label: "MWEC1 - MARK WEST CREEK - MIRABEL HEIGHTS", value: "MWEC1" },
      { label: "RIOC1 - RUSSIAN RIVER - HACIENDA BRIDGE", value: "RIOC1" },
      { label: "GUEC1 - RUSSIAN RIVER - GUERNEVILLE", value: "GUEC1" },
      {
        label: "RROC1 - RUSSIAN RIVER - HIGHWAY 1 BRIDGE NEAR JENNER",
        value: "RROC1",
      },
      { label: "SHEC1 - NAPA RIVER - SAINT HELENA", value: "SHEC1" },
      { label: "APCC1 - NAPA RIVER - NAPA", value: "APCC1" },
      { label: "GRCC1 - GARCIA RIVER - POINT ARENA", value: "GRCC1" },
      { label: "GSRC1 - SOUTH FORK GUALALA RIVER - SEA RANCH", value: "GSRC1" },
    ],
  },
  {
    label: "Salinas/Pajaro",
    options: [
      { label: "PRBC1 - SALINAS RIVER - PASO ROBLES", value: "PRBC1" },
      { label: "ESRC1 - ESTRELLA RIVER - ESTRELLA", value: "ESRC1" },
      { label: "NBYC1 - NACIMIENTO RIVER - SAPAQUE", value: "NBYC1" },
      { label: "NACC1 - NACIMIENTO RIVER - LAKE NACIMIENTO", value: "NACC1" },
      { label: "LWDC1 - SAN ANTONIO RIVER - LOCKWOOD", value: "LWDC1" },
      { label: "SNRC1 - SAN ANTONIO RIVER - LAKE SAN ANTONIO", value: "SNRC1" },
      { label: "BRDC1 - SALINAS RIVER - BRADLEY", value: "BRDC1" },
      { label: "KCYC1 - SAN LORENZO CREEK - KING CITY", value: "KCYC1" },
      { label: "SDDC1 - SALINAS RIVER - SOLEDAD", value: "SDDC1" },
      { label: "SOLC1 - ARROYO SECO - SOLEDAD", value: "SOLC1" },
      { label: "CHLC1 - SALINAS RIVER - CHUALAR", value: "CHLC1" },
      { label: "SPRC1 - SALINAS RIVER - SPRECKELS", value: "SPRC1" },
      { label: "BSRC1 - BIG SUR RIVER - BIG SUR", value: "BSRC1" },
      { label: "RDRC1 - CARMEL RIVER - ROBLES DEL RIO", value: "RDRC1" },
      { label: "PIIC1 - SAN BENITO RIVER - WILLOW CREEK", value: "PIIC1" },
      { label: "TESC1 - TRES PINOS CREEK - TRES PINOS", value: "TESC1" },
      {
        label: "HOSC1 - SAN BENITO RIVER - HOSPITAL ROAD BRIDGE NEAR HOLLISTER",
        value: "HOSC1",
      },
      { label: "PHOC1 - PACHECO CREEK - DUNNEVILLE", value: "PHOC1" },
      { label: "CBRC1 - LLAGAS CREEK - CHESBRO RESERVOIR", value: "CBRC1" },
      { label: "UVRC1 - UVAS CREEK - UVAS RESERVOIR", value: "UVRC1" },
      { label: "AROC1 - PAJARO RIVER - CHITTENDEN", value: "AROC1" },
      { label: "BTEC1 - SAN LORENZO RIVER - BIG TREES", value: "BTEC1" },
    ],
  },
  {
    label: "South Bay",
    options: [
      { label: "COYC1 - COYOTE CREEK - COYOTE RESERVOIR", value: "COYC1" },
      { label: "ANDC1 - COYOTE CREEK - ANDERSON RESERVOIR", value: "ANDC1" },
      {
        label: "UPCC1 - UPPER PENITENCIA CREEK - PIEDMOND ROAD",
        value: "UPCC1",
      },
      {
        label: "CMIC1 - COYOTE CREEK - MILPITAS AT HIGHWAY 237",
        value: "CMIC1",
      },
      { label: "ALRC1 - ALAMITOS CREEK - ALMADEN RESERVOIR", value: "ALRC1" },
      { label: "CADC1 - CALERO CREEK - CALERO RESERVOIR", value: "CADC1" },
      {
        label: "GUAC1 - GUADALUPE CREEK - GUADALUPE RESERVOIR",
        value: "GUAC1",
      },
      {
        label: "GUDC1 - GUADALUPE RIVER - SAN JOSE AT ALMADEN EXPRESSWAY",
        value: "GUDC1",
      },
      { label: "LVKC1 - ARROYO VALLE - DEL VALLE RESERVOIR", value: "LVKC1" },
      { label: "LESC1 - LOS GATOS CREEK - LAKE ELSMAN", value: "LESC1" },
      {
        label: "LEXC1 - LOS GATOS CREEK - LEXINGTON RESERVOIR",
        value: "LEXC1",
      },
      { label: "AHOC1 - ARROYO HONDO - SAN JOSE", value: "AHOC1" },
      { label: "CVQC1 - ARROYO HONDO - CALAVERAS RESERVOIR", value: "CVQC1" },
      { label: "MPTC1 - ALAMEDA CREEK - ABOVE DIVERSION DAM", value: "MPTC1" },
      {
        label: "ANOC1 - SAN ANTONIO CREEK - SAN ANTONIO RESERVOIR",
        value: "ANOC1",
      },
      { label: "ALQC1 - ALAMO CANAL - PLEASANTON", value: "ALQC1" },
      { label: "ADLC1 - ARROYO DE LA LAGUNA - VERONA", value: "ADLC1" },
      { label: "AWEC1 - ALAMEDA CREEK - SUNOL", value: "AWEC1" },
      { label: "NILC1 - ALAMEDA CREEK - NILES", value: "NILC1" },
      { label: "LRZC1 - SAN LORENZO CREEK - HAYWARD", value: "LRZC1" },
      {
        label: "STDC1 - STEVENS CREEK - STEVENS CREEK RESERVOIR",
        value: "STDC1",
      },
      {
        label: "SFCC1 - SAN FRANCISQUITO CREEK - STANFORD UNIVERSITY",
        value: "SFCC1",
      },
      { label: "CYTC1 - COYOTE CREEK - MADRONE", value: "CYTC1" },
      { label: "CYEC1 - COYOTE CREEK - EDENVALE", value: "CYEC1" },
      {
        label: "GSJC1 - GUADALUPE RIVER - SAN JOSE AT US HIGHWAY 101",
        value: "GSJC1",
      },
      { label: "ACSC1 - SAN ANTONIO CREEK - SUNOL", value: "ACSC1" },
    ],
  },
  {
    label: "Southern California",
    options: [
      { label: "SSQC1 - SISQUOC RIVER - SISQUOC", value: "SSQC1" },
      { label: "GARC1 - SISQUOC RIVER - GAREY", value: "GARC1" },
      { label: "CYBC1 - CUYAMA RIVER - BUCKHORN", value: "CYBC1" },
      { label: "HSAC1 - HUASNA RIVER - ARROYO GRANDE", value: "HSAC1" },
      { label: "TWDC1 - CUYAMA RIVER - TWITCHELL RESERVOIR", value: "TWDC1" },
      { label: "LLYC1 - SANTA YNEZ RIVER - LOS LAURELES", value: "LLYC1" },
      { label: "CCHC1 - SANTA YNEZ RIVER - LAKE CACHUMA", value: "CCHC1" },
      { label: "SLUC1 - SALSIPUEDES CREEK - LOMPOC", value: "SLUC1" },
      { label: "NRWC1 - SANTA YNEZ RIVER - NARROWS", value: "NRWC1" },
      { label: "VRVC1 - VENTURA RIVER - FOSTER PARK", value: "VRVC1" },
      { label: "SCPC1 - SANTA CLARA RIVER - PIRU", value: "SCPC1" },
      { label: "SESC1 - SESPE CREEK - FILLMORE", value: "SESC1" },
      { label: "VCAC1 - SANTA CLARA RIVER - VICTORIA AVENUE", value: "VCAC1" },
      {
        label: "CLLC1 - CALLEGUAS CREEK - CSU CHANNEL ISLANDS",
        value: "CLLC1",
      },
      { label: "PYMC1 - PIRU CREEK - PYRAMID LAKE", value: "PYMC1" },
      { label: "LKPC1 - PIRU CREEK - LAKE PIRU", value: "LKPC1" },
      { label: "EFBC1 - CASTAIC CREEK - ELDERBERRY FOREBAY", value: "EFBC1" },
      { label: "CSKC1 - CASTAIC CREEK - CASTAIC LAKE", value: "CSKC1" },
      {
        label: "BTJC1 - BIG TUJUNGA CREEK - BIG TUJUNGA RESERVOIR",
        value: "BTJC1",
      },
      { label: "HANC1 - TUJUNGA WASH - HANSEN RESERVOIR", value: "HANC1" },
      {
        label: "SRWC1 - SANTA ANA RIVER - SEVEN OAKS RESERVOIR",
        value: "SRWC1",
      },
      { label: "TIMC1 - SAN TIMOTEO CREEK - LOMA LINDA", value: "TIMC1" },
      { label: "YTLC1 - LYTLE CREEK - COLTON", value: "YTLC1" },
      {
        label: "SREC1 - SANTA ANA RIVER - SAN BERNARDINO AT E STREET",
        value: "SREC1",
      },
      { label: "KNBC1 - CAJON CREEK - KEENBROOK", value: "KNBC1" },
      {
        label: "MWXC1 - SANTA ANA RIVER - MUNICIPAL WATER DISTRICT CROSSING",
        value: "MWXC1",
      },
      { label: "TSLC1 - TEMESCAL CREEK - CORONA", value: "TSLC1" },
      { label: "ADOC1 - SANTA ANA RIVER - PRADO RESERVOIR", value: "ADOC1" },
      { label: "CJKC1 - CAJON CREEK - KEENBROOK", value: "CJKC1" },
    ],
  },
  {
    label: "San Diego/Inland",
    options: [
      { label: "TEKC1 - TEMECULA CREEK - AGUANGA", value: "TEKC1" },
      { label: "VLKC1 - TEMECULA CREEK - VAIL LAKE", value: "VLKC1" },
      { label: "MUTC1 - MURRIETA CREEK - TEMECULA", value: "MUTC1" },
      { label: "SMHC1 - SANTA MARGARITA RIVER - TEMECULA", value: "SMHC1" },
      { label: "YDRC1 - SANTA MARGARITA - YSIDORA", value: "YDRC1" },
      { label: "HAWC1 - SAN LUIS REY RIVER - LAKE HENSHAW", value: "HAWC1" },
      {
        label: "SUDC1 - SANTA YSABEL CREEK - SUTHERNLAND RESERVOIR",
        value: "SUDC1",
      },
      { label: "HODC1 - SAN DIEGUITO RIVER - LAKE HODGES", value: "HODC1" },
      {
        label: "SHRC1 - SAN LUIS REY RIVER - SHEARER CROSSING",
        value: "SHRC1",
      },
      { label: "SLOC1 - SAN LUIS REY RIVER - OCEANSIDE", value: "SLOC1" },
      {
        label: "ELPC1 - SAN DIEGO RIVER - EL CAPITAN RESERVOIR",
        value: "ELPC1",
      },
      {
        label: "SVIC1 - SAN VINCENTE CREEK - SAN VICENTE RESERVOIR",
        value: "SVIC1",
      },
      { label: "FSNC1 - SAN DIEGO RIVER - FASHION VALLEY", value: "FSNC1" },
      { label: "BRTC1 - COTTONWOOD CREEK - BARRETT LAKE", value: "BRTC1" },
      { label: "PCNC1 - PALM CANYON CREEK - PALM SPRINGS", value: "PCNC1" },
      { label: "WWIC1 - WHITEWATER RIVER - RANCHO MIRAGE", value: "WWIC1" },
      { label: "DEPC1 - DEEP CREEK - PALM DESERT", value: "DEPC1" },
      { label: "WTIC1 - WHITEWATER RIVER - INDIO", value: "WTIC1" },
      { label: "DKHC1 - DEEP CREEK - HESPERIA", value: "DKHC1" },
      {
        label: "SVWC1 - WEST FORK MOJAVE RIVER - SILVERWOOD LAKE",
        value: "SVWC1",
      },
      { label: "WFMC1 - WEST FORK MOJAVE RIVER - HESPERIA", value: "WFMC1" },
      {
        label: "MVDC1 - MOJAVE RIVER - MOJAVE FORKS RESERVOIR",
        value: "MVDC1",
      },
      { label: "MVVC1 - MOJAVE RIVER - VICTORVILLE", value: "MVVC1" },
      { label: "MBRC1 - MOJAVE RIVER - BARSTOW", value: "MBRC1" },
      { label: "YDRC1 - SANTA MARGARITA RIVER - YSIDORA", value: "YDRC1" },
      { label: "ZNRC1 - NEW RIVER - WESTMORLAND", value: "ZNRC1" },
    ],
  },
  {
    label: "Upper Sacramento",
    options: [
      { label: "PLYC1 - SOUTH FORK PIT RIVER - LIKELY", value: "PLYC1" },
      { label: "CNBC1 - PIT RIVER - CANBY", value: "CNBC1" },
      { label: "PITC1 - PIT RIVER - MONTGOMERY CREEK", value: "PITC1" },
      { label: "MMCC1 - MCCLOUD RIVER - MCCLOUD", value: "MMCC1" },
      { label: "MSSC1 - MCCLOUD RIVER - SHASTA LAKE", value: "MSSC1" },
      { label: "DLTC1 - SACRAMENTO RIVER - DELTA", value: "DLTC1" },
      { label: "SHDC1 - SACRAMENTO RIVER - SHASTA LAKE", value: "SHDC1" },
      { label: "WHSC1 - CLEAR CREEK - WHISKEYTOWN RESERVOIR", value: "WHSC1" },
      { label: "RDGC1 - CLEAR CREEK - IGO", value: "RDGC1" },
      { label: "CWCC1 - COW CREEK - MILLVILLE", value: "CWCC1" },
      { label: "COTC1 - BATTLE CREEK - COTTONWOOD", value: "COTC1" },
      { label: "CWAC1 - COTTONWOOD CREEK - COTTONWOOD", value: "CWAC1" },
      { label: "BDBC1 - SACRAMENTO RIVER - BEND BRIDGE", value: "BDBC1" },
      { label: "RDBC1 - SACRAMENTO RIVER - RED BLUFF", value: "RDBC1" },
      { label: "MLMC1 - MILL CREEK - LOS MOLINOS", value: "MLMC1" },
      { label: "EDCC1 - ELDER CREEK - PASKENTA", value: "EDCC1" },
      { label: "TEHC1 - SACRAMENTO RIVER - TEHAMA BRIDGE", value: "TEHC1" },
      { label: "TCRC1 - THOMES CREEK - PASKENTA", value: "TCRC1" },
      { label: "DCVC1 - DEER CREEK - VINA", value: "DCVC1" },
      {
        label: "VWBC1 - SACRAMENTO RIVER - VINA WOODSON BRIDGE",
        value: "VWBC1",
      },
      { label: "HAMC1 - SACRAMENTO RIVER - HAMILTON CITY", value: "HAMC1" },
      { label: "HKCC1 - BIG CHICO CREEK - CHICO", value: "HKCC1" },
      {
        label: "EPRC1 - LITTLE STONY CREEK - EAST PARK RESERVOIR",
        value: "EPRC1",
      },
      { label: "SGEC1 - STONY CREEK - STONY GORGE RESERVOIR", value: "SGEC1" },
      { label: "BLBC1 - STONY CREEK - BLACK BUTTE RESERVOIR", value: "BLBC1" },
      { label: "ORFC1 - SACRAMENTO RIVER - ORD FERRY", value: "ORFC1" },
      { label: "BTCC1 - SACRAMENTO RIVER - BUTTE CITY", value: "BTCC1" },
      { label: "CLSC1 - SACRAMENTO RIVER - MOULTON WEIR", value: "CLSC1" },
      { label: "CLAC1 - SACRAMENTO RIVER - COLUSA WEIR", value: "CLAC1" },
      { label: "CLUC1 - SACRAMENTO RIVER - COLUSA BRIDGE", value: "CLUC1" },
      { label: "BKCC1 - BUTTE CREEK - CHICO", value: "BKCC1" },
      { label: "TISC1 - SACRAMENTO RIVER - TISDALE WEIR", value: "TISC1" },
      { label: "WLKC1 - SACRAMENTO RIVER - WILKINS SLOUGH", value: "WLKC1" },
    ],
  },
  {
    label: "Lower Sacramento",
    options: [
      { label: "FMWC1 - SACRAMENTO RIVER - FREMONT WEIR", value: "FMWC1" },
      { label: "NCOC1 - FEATHER RIVER - NICOLAUS", value: "NCOC1" },
      { label: "VONC1 - SACRAMENTO RIVER - VERONA", value: "VONC1" },
      {
        label: "SAMC1 - AMERICAN RIVER - SACRAMENTO AT H STREET",
        value: "SAMC1",
      },
      {
        label: "SACC1 - SACRAMENTO RIVER - SACRAMENTO AT I STREET",
        value: "SACC1",
      },
      { label: "RVBC1 - SACRAMENTO RIVER - RIO VISTA", value: "RVBC1" },
      { label: "LSBC1 - YOLO BYPASS - LISBON", value: "LSBC1" },
      {
        label: "VNCC1 - SACRAMENTO RIVER DELTA - VENICE ISLAND",
        value: "VNCC1",
      },
      { label: "ATIC1 - SACRAMENTO RIVER DELTA - ANTIOCH", value: "ATIC1" },
      {
        label: "MLIC1 - SACRAMENTO RIVER DELTA - MALLARD ISLAND",
        value: "MLIC1",
      },
    ],
  },
  {
    label: "Feather/Yuba",
    options: [
      {
        label: "PLLC1 - NORTH FORK FEATHER RIVER - PRATTVILLE",
        value: "PLLC1",
      },
      { label: "IIFC1 - INDIAN CREEK - INDIAN FALLS", value: "IIFC1" },
      { label: "SCBC1 - SPANISH CREEK - KEDDIE", value: "SCBC1" },
      {
        label: "NFEC1 - NORTH FORK FEATHER RIVER - EAST BRANCH",
        value: "NFEC1",
      },
      { label: "MFTC1 - MIDDLE FORK FEATHER RIVER - PORTOLA", value: "MFTC1" },
      { label: "ANTC1 - INDIAN CREEK - ANTELOPE LAKE", value: "ANTC1" },
      { label: "DVSC1 - BIG GRIZZLY CREEK - LAKE DAVIS", value: "DVSC1" },
      {
        label: "FHDC1 - LITTLE LAST CHANCE CREEK - FRENCHMAN LAKE",
        value: "FHDC1",
      },
      { label: "MRMC1 - MIDDLE FORK FEATHER RIVER - MERRIMAC", value: "MRMC1" },
      { label: "WBGC1 - WEST BRANCH FEATHER RIVER - MAGALIA", value: "WBGC1" },
      { label: "ORDC1 - FEATHER RIVER - LAKE OROVILLE", value: "ORDC1" },
      { label: "YUBC1 - FEATHER RIVER - YUBA CITY", value: "YUBC1" },
      { label: "GYRC1 - NORTH YUBA RIVER - GOODYEARS BAR", value: "GYRC1" },
      {
        label: "NBBC1 - NORTH FORK YUBA RIVER - NEW BULLARDS BAR RESERVOIR",
        value: "NBBC1",
      },
      {
        label: "JKRC1 - MIDDLE FORK YUBA RIVER - JACKSON MEADOWS RESERVOIR",
        value: "JKRC1",
      },
      { label: "OURC1 - MIDDLE FORK YUBA RIVER - OUR HOUSE", value: "OURC1" },
      { label: "FOCC1 - FORDYCE CREEK - FORDYCE LAKE", value: "FOCC1" },
      {
        label: "SUAC1 - SOUTH FORK YUBA RIVER - LAKE SPAULDING",
        value: "SUAC1",
      },
      { label: "BWKC1 - CANYON CREEK - BOWMAN RESERVOIR", value: "BWKC1" },
      { label: "JNSC1 - SOUTH FORK YUBA RIVER - JONES BAR", value: "JNSC1" },
      { label: "DCSC1 - DEER CREEK - SMARTSVILLE", value: "DCSC1" },
      { label: "DMCC1 - DRY CREEK - MERLE COLLINS RESERVOIR", value: "DMCC1" },
      { label: "SOVC1 - DEER CREEK - SCOTTS FLAT RESERVOIR", value: "SOVC1" },
      { label: "ROLC1 - BEAR RIVER - ROLLINS LAKE", value: "ROLC1" },
      { label: "CFWC1 - BEAR RIVER - CAMP FAR WEST RESERVOIR", value: "CFWC1" },
      { label: "HLEC1 - YUBA RIVER - ENGLEBRIGHT RESERVOIR", value: "HLEC1" },
      { label: "MRYC1 - YUBA RIVER - MARYSVILLE", value: "MRYC1" },
      { label: "GRIC1 - FEATHER RIVER - GRIDLEY", value: "GRIC1" },
      { label: "FBLC1 - FEATHER RIVER - BOYDS LANDING", value: "FBLC1" },
      { label: "BRWC1 - BEAR RIVER - WHEATLAND", value: "BRWC1" },
      { label: "NCOC1 - FEATHER RIVER - NICOLAUS", value: "NCOC1" },
      { label: "DRMC1 - BUTTE CREEK - DURHAM", value: "DRMC1" },
      { label: "RCVC1 - CHEROKEE CANAL - RICHVALE", value: "RCVC1" },
      { label: "HCTC1 - SOUTH FORK HONCUT CREEK - BANGOR", value: "HCTC1" },
      {
        label: "GYRC1 - NORTH FORK YUBA RIVER - GOODYEARS BAR",
        value: "GYRC1",
      },
      { label: "LOCC1 - OREGON CREEK - BELOW LOG CABIN DAM", value: "LOCC1" },
      { label: "DCWC1 - DRY CREEK - WHEATLAND", value: "DCWC1" },
    ],
  },
  {
    label: "Cache/Putah",
    options: [
      { label: "MUPC1 - MIDDLE CREEK - UPPER LAKE", value: "MUPC1" },
      { label: "SKPC1 - SCOTTS CREEK - LAKEPORT", value: "SKPC1" },
      { label: "KCVC1 - KELSEY CREEK - KELSEYVILLE", value: "KCVC1" },
      { label: "CLKC1 - CLEAR LAKE - LAKEPORT", value: "CLKC1" },
      {
        label: "HOUC1 - NORTH FORK CACHE CREEK - HOUGH SPRINGS",
        value: "HOUC1",
      },
      {
        label: "INVC1 - NORTH FORK CACHE CREEK - INDIAN VALLEY RESERVOIR",
        value: "INVC1",
      },
      { label: "HCHC1 - BEAR CREEK - HOLSTEN CHIMNEY CANYON", value: "HCHC1" },
      { label: "RMSC1 - CACHE CREEK - RUMSEY", value: "RMSC1" },
      { label: "YLOC1 - CACHE CREEK - YOLO", value: "YLOC1" },
      { label: "PCGC1 - PUTAH CREEK - GUENOC", value: "PCGC1" },
      { label: "LBEC1 - PUTAH CREEK - LAKE BERRYESSA", value: "LBEC1" },
    ],
  },
  {
    label: "American",
    options: [
      {
        label: "NFDC1 - NORTH FORK AMERICAN RIVER - NORTH FORK DAM",
        value: "NFDC1",
      },
      {
        label: "FMDC1 - MIDDLE FORK AMERICAN RIVER - FRENCH MEADOWS RESERVOIR",
        value: "FMDC1",
      },
      {
        label:
          "MFPC1 - MIDDLE FORK AMERICAN RIVER - ABOVE MIDDLE FORK POWERHOUSE",
        value: "MFPC1",
      },
      { label: "LNLC1 - GERLE CREEK - LOON LAKE", value: "LNLC1" },
      { label: "RUFC1 - RUBICON RIVER - FORESTHILL", value: "RUFC1" },
      {
        label: "NMFC1 - NORTH FORK OF MIDDLE FORK AMERICAN RIVER - FORESTHILL",
        value: "NMFC1",
      },
      {
        label: "SPYC1 - PILOT CREEK - ABOVE STUMPY MEADOWS RESERVOIR",
        value: "SPYC1",
      },
      { label: "RBBC1 - RUBICON RIVER - ROCKBOUND LAKE", value: "RBBC1" },
      { label: "HLLC1 - RUBICON RIVER - HELL HOLE RESERVOIR", value: "HLLC1" },
      {
        label: "MFAC1 - MIDDLE FORK AMERICAN RIVER - FORESTHILL",
        value: "MFAC1",
      },
      { label: "AKYC1 - SOUTH FORK AMERICAN RIVER - KYBURZ", value: "AKYC1" },
      {
        label: "UNVC1 - SILVER CREEK - UNION VALLEY RESERVOIR",
        value: "UNVC1",
      },
      {
        label: "ICHC1 - SOUTH FORK SILVER CREEK - ICE HOUSE RESERVOIR",
        value: "ICHC1",
      },
      { label: "SVCC1 - SILVER CREEK - CAMINO RESERVOIR", value: "SVCC1" },
      {
        label: "CBAC1 - SOUTH FORK AMERICAN RIVER - CHILI BAR RESERVOIR",
        value: "CBAC1",
      },
      { label: "FOLC1 - AMERICAN RIVER - FOLSOM LAKE", value: "FOLC1" },
      {
        label: "CBAC1 - SOUTH FORK AMERICAN RIVER - PLACERVILLE",
        value: "CBAC1",
      },
    ],
  },
  {
    label: "Water Supply Indicies",
    options: [
      {
        label: "SACC0 - SACRAMENTO VALLEY - WATER RESOURCES INDEX",
        value: "SACC0",
      },
      {
        label: "VNSC0 - SAN JOAQUIN VALLEY - WATER RESOURCES INDEX",
        value: "VNSC0",
      },
      {
        label: "MLIC0 - CENTRAL VALLEY - WATER RESOURCES INDEX",
        value: "MLIC0",
      },
    ],
  },
  {
    label: "Tulare",
    options: [
      { label: "KKVC1 - KERN RIVER - FAIRVIEW DAM", value: "KKVC1" },
      { label: "KRVC1 - KERN RIVER - KERNVILLE", value: "KRVC1" },
      { label: "SKRC1 - SOUTH FORK KERN RIVER - ONYX", value: "SKRC1" },
      { label: "ISAC1 - KERN RIVER - LAKE ISABELLA", value: "ISAC1" },
      { label: "DKCC1 - DEER CREEK - FOUNTAIN SPRINGS", value: "DKCC1" },
      {
        label: "TVRC1 - SOUTH FORK TULE RIVER - RESERVATION BOUNDARY",
        value: "TVRC1",
      },
      { label: "SCSC1 - TULE RIVER - LAKE SUCCESS", value: "SCSC1" },
      { label: "KTRC1 - KAWEAH RIVER - THREE RIVERS", value: "KTRC1" },
      { label: "TMDC1 - KAWEAH RIVER - LAKE KAWEAH", value: "TMDC1" },
      { label: "DLMC1 - DRY CREEK - LEMONCOVE", value: "DLMC1" },
      {
        label: "KGPC1 - SOUTH FORK KINGS RIVER - ABOVE BOYDEN CAVERN",
        value: "KGPC1",
      },
      { label: "PFTC1 - KINGS RIVER - PINE FLAT RESERVOIR", value: "PFTC1" },
      { label: "MLPC1 - MILL CREEK - PIEDRA", value: "MLPC1" },
    ],
  },
  {
    label: "San Joaquin",
    options: [
      { label: "WARC1 - WARTHAN CREEK - COALINGA", value: "WARC1" },
      { label: "LGCC1 - LOS GATOS CREEK - COALINGA", value: "LGCC1" },
      { label: "LGAC1 - LOS GATOS CREEK - EL DORADO AVENUE", value: "LGAC1" },
      {
        label: "PNEC1 - PANOCHE CREEK - INTERSTATE 5 OVERCROSSING",
        value: "PNEC1",
      },
      {
        label: "LBDC1 - LOS BANOS CREEK - LOS BANOS RESERVOIR",
        value: "LBDC1",
      },
      {
        label: "FRAC1 - SAN JOAQUIN RIVER - MILLERTON RESERVOIR",
        value: "FRAC1",
      },
      { label: "LTDC1 - LITTLE DRY CREEK - FRIANT", value: "LTDC1" },
      { label: "HIDC1 - FRESNO RIVER - HENSLEY LAKE", value: "HIDC1" },
      {
        label: "BHNC1 - CHOWCHILLA RIVER - BUCHANAN RESERVOIR",
        value: "BHNC1",
      },
      { label: "MPAC1 - MARIPOSA CREEK - MARIPOSA RESERVOIR", value: "MPAC1" },
      { label: "OWCC1 - OWENS CREEK - OWENS RESERVOIR", value: "OWCC1" },
      { label: "BCKC1 - BEAR CREEK - BEAR RESERVOIR", value: "BCKC1" },
      { label: "BNCC1 - BURNS CREEK - BURNS CREEK RESERVOIR", value: "BNCC1" },
      { label: "MEEC1 - BEAR CREEK - MCKEE ROAD", value: "MEEC1" },
      { label: "HPIC1 - MERCED RIVER - HAPPY ISLES", value: "HPIC1" },
      {
        label: "POHC1 - MERCED RIVER - YOSEMITE AT POHONO BRIDGE",
        value: "POHC1",
      },
      { label: "EXQC1 - MERCED RIVER - EXCHEQUER RESERVOIR", value: "EXQC1" },
      { label: "DSNC1 - DRY CREEK - SNELLING", value: "DSNC1" },
      { label: "STVC1 - MERCED RIVER - STEVINSON", value: "STVC1" },
      { label: "OREC1 - ORESTIMBA CREEK - NEWMAN", value: "OREC1" },
      { label: "NWMC1 - SAN JOAQUIN RIVER - NEWMAN", value: "NWMC1" },
      { label: "PATC1 - SAN JOAQUIN RIVER - PATTERSON", value: "PATC1" },
      { label: "PTTC1 - DEL PUERTO CREEK - PATTERSON", value: "PTTC1" },
      {
        label: "HETC1 - TUOLUMNE RIVER - HETCH HETCHY RESERVOIR",
        value: "HETC1",
      },
      { label: "LNRC1 - ELEANOR CREEK - LAKE ELEANOR", value: "LNRC1" },
      { label: "CHVC1 - CHERRY CREEK - CHERRY LAKE", value: "CHVC1" },
      {
        label: "NDPC1 - TUOLUMNE RIVER - NEW DON PEDRO RESERVOIR",
        value: "NDPC1",
      },
      { label: "DCMC1 - DRY CREEK - MODESTO", value: "DCMC1" },
      { label: "MDSC1 - TUOLUMNE RIVER - MODESTO", value: "MDSC1" },
      {
        label: "NSWC1 - HIGHLAND CREEK - NEW SPICER MEADOWS RESERVOIR",
        value: "NSWC1",
      },
      {
        label: "NDVC1 - NORTH FORK STANISLAUS RIVER - DIVERSION DAM",
        value: "NDVC1",
      },
      { label: "AVYC1 - NORTH FORK STANISLAUS RIVER - AVERY", value: "AVYC1" },
      {
        label: "NMSC1 - STANISLAUS RIVER - NEW MELONES RESERVOIR",
        value: "NMSC1",
      },
      { label: "OBBC1 - STANISLAUS RIVER - ORANGE BLOSSOM", value: "OBBC1" },
      { label: "RIPC1 - STANISLAUS RIVER - RIPON", value: "RIPC1" },
      { label: "VNSC1 - SAN JOAQUIN RIVER - VERNALIS", value: "VNSC1" },
      {
        label: "HPIC1 - MERCED RIVER - YOSEMITE NP AT HAPPY ISLES",
        value: "HPIC1",
      },
      {
        label: "POHC1 - MERCED RIVER - YOSEMITE NP AT POHONO BRIDGE",
        value: "POHC1",
      },
      { label: "MOSC1 - SAN JOAQUIN RIVER - MOSSDALE", value: "MOSC1" },
      { label: "GVAC1 - SAN JOAQUIN RIVER - GRAVELLY FORD", value: "GVAC1" },
      { label: "JAMC1 - JAMES BYPASS - SAN JOAQUIN", value: "JAMC1" },
      { label: "SJMC1 - SAN JOAQUIN RIVER - MENDOTA", value: "SJMC1" },
      { label: "CHBC1 - CHOWCHILLA BYPASS - RIPPERDAN", value: "CHBC1" },
      { label: "ELNC1 - EASTSIDE BYPASS - EL NIDO", value: "ELNC1" },
      { label: "SSTC1 - SAN JOAQUIN RIVER - STEVINSON", value: "SSTC1" },
      { label: "CRDC1 - SAN JOAQUIN RIVER - CROWS LANDING", value: "CRDC1" },
    ],
  },
  {
    label: "North San Joaquin",
    options: [
      { label: "MSGC1 - MORMON SLOUGH - BELLOTA", value: "MSGC1" },
      {
        label: "FRGC1 - LITTLEJOHNS CREEK - FARMINGTON RESERVOIR",
        value: "FRGC1",
      },
      {
        label: "NHGC1 - CALAVERAS RIVER - NEW HOGAN RESERVOIR",
        value: "NHGC1",
      },
      { label: "CMPC1 - MOKELUMNE RIVER - PARDEE RESERVOIR", value: "CMPC1" },
      {
        label: "SOSC1 - MIDDLE FORK COSUMNES RIVER - SOMERSET",
        value: "SOSC1",
      },
      {
        label: "EDOC1 - NORTH FORK COSUMNES RIVER - EL DORADO",
        value: "EDOC1",
      },
      { label: "MHBC1 - COSUMNES RIVER - MICHIGAN BAR", value: "MHBC1" },
      { label: "MCNC1 - COSUMNES RIVER - MCCONNELL", value: "MCNC1" },
      { label: "THTC1 - MOKELUMNE RIVER - BENSON'S FERRY", value: "THTC1" },
    ],
  },
  {
    label: "East Sierra",
    options: [
      { label: "SUSC1 - SUSAN RIVER - SUSANVILLE", value: "SUSC1" },
      { label: "TAHC1 - LAKE TAHOE INFLOW - TAHOE BASIN", value: "TAHC1" },
      { label: "THLC1 - LAKE TAHOE - TAHOE CITY", value: "THLC1" },
      { label: "TRCC1 - TRUCKEE RIVER - TRUCKEE", value: "TRCC1" },
      { label: "DNRC1 - DONNER CREEK - DONNER LAKE", value: "DNRC1" },
      { label: "MTSC1 - MARTIS CREEK - MARTIS CREEK LAKE", value: "MTSC1" },
      { label: "PSRC1 - PROSSER CREEK - PROSSER RESERVOIR", value: "PSRC1" },
      {
        label: "ILAC1 - INDEPENDENCE CREEK - INDEPENDENCE LAKE",
        value: "ILAC1",
      },
      { label: "SGNC1 - SAGEHEN CREEK - TRUCKEE", value: "SGNC1" },
      {
        label: "STPC1 - LITTLE TRUCKEE RIVER - STAMPEDE RESERVOIR",
        value: "STPC1",
      },
      {
        label: "BCAC1 - LITTLE TRUCKEE RIVER - BOCA RESERVOIR",
        value: "BCAC1",
      },
      { label: "FARC1 - TRUCKEE RIVER - FARAD", value: "FARC1" },
      { label: "TRRN2 - TRUCKEE RIVER - RENO", value: "TRRN2" },
      { label: "LWON2 - STEAMBOAT CREEK - LITTLE WASHOE LAKE", value: "LWON2" },
      { label: "SCRN2 - STEAMBOAT CREEK - STEAMBOAT", value: "SCRN2" },
      { label: "SCWN2 - STEAMBOAT CREEK - SPARKS", value: "SCWN2" },
      { label: "VISN2 - TRUCKEE RIVER - VISTA", value: "VISN2" },
      { label: "TBDN2 - TRUCKEE RIVER - BELOW DERBY DAM", value: "TBDN2" },
      { label: "WADN2 - TRUCKEE RIVER - WADSWORTH", value: "WADN2" },
      { label: "WOOC1 - WEST FORK CARSON RIVER - WOODFORDS", value: "WOOC1" },
      {
        label: "CEMC1 - EAST FORK CARSON RIVER - MARKLEEVILLE",
        value: "CEMC1",
      },
      {
        label: "GRDN2 - EAST FORK CARSON RIVER - GARDNERVILLE",
        value: "GRDN2",
      },
      { label: "STWN2 - CARSON RIVER - CARSON CITY", value: "STWN2" },
      { label: "FTCN2 - CARSON RIVER - FORT CHURCHILL", value: "FTCN2" },
      {
        label:
          "WWBC1 - WEST WALKER RIVER - BELOW LITTLE WALKER RIVER NEAR COLEVILLE",
        value: "WWBC1",
      },
      { label: "TOPN2 - WEST WALKER RIVER - TOPAZ LAKE", value: "TOPN2" },
      { label: "HOYN2 - WEST WALKER RIVER - HOYE BRIDGE", value: "HOYN2" },
      { label: "WWHN2 - WEST WALKER RIVER - HUDSON", value: "WWHN2" },
      {
        label: "BPRC1 - EAST WALKER RIVER - BRIDGEPORT RESERVOIR",
        value: "BPRC1",
      },
      {
        label: "EWSN2 - EAST WALKER RIVER - ABOVE STROSNIDER DITCH",
        value: "EWSN2",
      },
      { label: "MASN2 - WALKER RIVER - MASON AT SNYDER LANE", value: "MASN2" },
      { label: "NIXN2 - TRUCKEE RIVER - NIXON", value: "NIXN2" },
      { label: "WALN2 - WALKER RIVER - WABUSKA", value: "WALN2" },
    ],
  },
  {
    label: "Humboldt",
    options: [
      {
        label: "MHSN2 - MARYS RIVER - ABOVE HOT SPRINGS CREEK",
        value: "MHSN2",
      },
      { label: "LCLN2 - LAMOILLE CREEK - LAMOILLE", value: "LCLN2" },
      {
        label: "DEVN2 - NORTH FORK HUMBOLDT RIVER - DEVILS GATE",
        value: "DEVN2",
      },
      { label: "HREN2 - HUMBOLDT RIVER - ELKO", value: "HREN2" },
      {
        label: "DIXN2 - SOUTH FORK HUMBOLDT RIVER - DIXIE CREEK",
        value: "DIXN2",
      },
      { label: "HRCN2 - HUMBOLDT RIVER - CARLIN", value: "HRCN2" },
      { label: "PALN2 - HUMBOLDT RIVER - PALISADE", value: "PALN2" },
      { label: "ROCN2 - ROCK CREEK - BATTLE MOUNTAIN", value: "ROCN2" },
      { label: "HBMN2 - HUMBOLDT RIVER - BATTLE MOUNTAIN", value: "HBMN2" },
      { label: "CMSN2 - HUMBOLDT RIVER - COMUS", value: "CMSN2" },
      { label: "MARN2 - MARTIN CREEK - PARADISE VALLEY", value: "MARN2" },
      { label: "HRIN2 - HUMBOLDT RIVER - IMLAY", value: "HRIN2" },
      { label: "MDCN2 - MCDERMITT CREEK - MCDERMITT", value: "MDCN2" },
      {
        label: "SFHN2 - SOUTH FORK HUMBOLDT RIVER - ABOVE TENMILE CREEK",
        value: "SFHN2",
      },
      {
        label: "LHPN2 - LITTLE HUMBOLDT CREEK - PARADISE VALLEY",
        value: "LHPN2",
      },
    ],
  },
];

const ARLandfallBaseUrl = "https://cw3e.ucsd.edu/images/";
export const ARLandfallModelOptions = [
  {
    value: ARLandfallBaseUrl + "gefs/v12/LFT/US-west/GEFS_LandfallTool",
    label: "GFS Ensemble",
  },
  {
    value:
      ARLandfallBaseUrl +
      "ECMWF/ensemble/LandfallTool/US-west/ECMWF_LandfallTool",
    label: "ECMWF EPS",
  },
  {
    value:
      ARLandfallBaseUrl +
      "ECMWF/ensemble/LandfallTool/US-west/ECMWF-GEFS_LandfallTool",
    label: "ECMWF minus GFS",
  },
  {
    value:
      ARLandfallBaseUrl + "wwrf/images/ensemble/LFT/US-west/W-WRF_LandfallTool",
    label: "West-WRF Ensemble",
  },
];

export const ARLandfallModelTypeOptions = [
  {
    value: "_control",
    label: "Control IVT magnitude",
  },
  {
    value: "_ensemble_mean",
    label: "Ensemble mean magnitude",
  },
  {
    value: "_150",
    label: "Probability of IVT >150 kg/m/s",
  },
  {
    value: "_250",
    label: "Probability of IVT >250 kg/m/s",
  },
  {
    value: "_500",
    label: "Probability of IVT >500 kg/m/s",
  },
  {
    value: "_750",
    label: "Probability of IVT >750 kg/m/s",
  },
  {
    value: "_Vectors_150",
    label: "IVT >150 kg/m/s with Vectors",
  },
  {
    value: "_Vectors_250",
    label: "IVT >250 kg/m/s with Vectors",
  },
  {
    value: "_Vectors_500",
    label: "IVT >500 kg/m/s with Vectors",
  },
  {
    value: "_Vectors_750",
    label: "IVT >750 kg/m/s with Vectors",
  },
];

export const ARLandfallModelLocationOptions = [
  {
    value: "_coast",
    label: "Coastal",
  },
  {
    value: "_foothills",
    label: "Foothills",
  },
  {
    value: "_inland",
    label: "Inland",
  },
  {
    value: "_intwest",
    label: "Interior West",
  },
];
