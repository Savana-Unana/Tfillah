buttonOptions = [];
let dropdownOptions = [];
let slideCombos = {};
let buttonBackgroundById = {};
let dropdownBackgroundById = {};

const getById = (id) => document.getElementById(id);

const slideImageElement = getById("slideImage");
const slideNumberElement = getById("slideNumber");
const slideCounterElement = getById("counter");
const slideTitleElement = getById("slideTitle");
const slideLogoElement = getById("slideLogo");
const slideshowElement = getById("slideshow");

const siddurSlot1Element = getById("siddur1");
const siddurSlot4Element = getById("siddur4");
const siddurSlot2Element = getById("siddur2");
const siddurSlot3Element = getById("siddur3");
const allSiddurElements = [siddurSlot1Element, siddurSlot4Element, siddurSlot2Element, siddurSlot3Element];

const setButtons = document.querySelectorAll(".set-btn");
const previousButton = getById("prevBtn");
const nextButton = getById("nextBtn");
const fullscreenButton = getById("fullscreenBtn");

let currentSetId = "";
let currentDayId = "";
let currentSlideIndex = 0;
let currentSlideEntry = null;
let hasRenderedAtLeastOnce = false;
let slideTransitionTimeout = null;
let controlsHideTimeout = null;

const savedStateStorageKey = "tfillahSlideshowState";
const parshaApiBaseUrl = "https://www.hebcal.com/hebcal";
const holidayApiBaseUrl = "https://www.hebcal.com/hebcal";
const zmanimApiBaseUrl = "https://www.hebcal.com/zmanim";
const shabbatZipCode = "33150";

let siddurSettings = {
  siddur1: { ashkenazi: "", sephardic: "" },
  siddur2: "",
  siddur3: "",
  siddur4: ""
};

let brandingSettings = { title: "", logo: "" };
let parshaEntries = [];
let selectedParshaName = "";
let activeParshaLabel = "";
let activeHolidayFlags = {
  chanukah: false,
  roshChodesh: false,
  succos: false,
  fastDay: false,
  shabbat: false,
  fools: false,
  belated: false
};
const parshaNameAliases = {
  Vaera: "Va'era",
  Vayera: "Vayeira",
  "Chayei Sara": "Chayei Sarah",
  Toldot: "Toledot",
  Shmini: "Shemini",
  "Achrei Mot": "Acharei Mot",
  Bamidbar: "Bemidbar",
  Nasso: "Naso",
  "Sh'lach": "Shelach",
  Vaetchanan: "Va'etchanan"
};
const hanukkahTorahNameByHolidayTitle = {
  "chanukah: 2 candles": "Chanukah Day 1",
  "chanukah: 3 candles": "Chanukah Day 2",
  "chanukah: 4 candles": "Chanukah Day 3",
  "chanukah: 5 candles": "Chanukah Day 4",
  "chanukah: 6 candles": "Chanukah Day 5",
  "chanukah: 7 candles": "Chanukah Day 6",
  "chanukah: 8 candles": "Chanukah Day 7",
  "chanukah: 8th day": "Chanukah Day 8",
  "hanukkah: 2 candles": "Chanukah Day 1",
  "hanukkah: 3 candles": "Chanukah Day 2",
  "hanukkah: 4 candles": "Chanukah Day 3",
  "hanukkah: 5 candles": "Chanukah Day 4",
  "hanukkah: 6 candles": "Chanukah Day 5",
  "hanukkah: 7 candles": "Chanukah Day 6",
  "hanukkah: 8 candles": "Chanukah Day 7",
  "hanukkah: 8th day": "Chanukah Day 8"
};

const toText = (value) => String(value ?? "").trim();
const setDisplay = (element, showElement) => {
  element.style.display = showElement ? "block" : "none";
};

const holidayIds = ["chanukah", "roshChodesh", "succos", "fastDay", "shabbat", "purim", "fools", "belated"];

const clampSlideIndex = (index, length) => {
  if (!Number.isInteger(index) || length <= 0) return 0;
  return Math.max(0, Math.min(index, length - 1));
};

const readSavedState = () => {
  const rawState = localStorage.getItem(savedStateStorageKey);
  if (!rawState) return null;

  const parsedState = JSON.parse(rawState);
  return parsedState && typeof parsedState === "object" ? parsedState : null;
};

const saveState = () => {
  localStorage.setItem(
    savedStateStorageKey,
    JSON.stringify({
      button: currentSetId,
      index: currentSlideIndex
    })
  );
};

const showControls = () => {
  document.body.classList.add("controls-visible");
  clearTimeout(controlsHideTimeout);
  controlsHideTimeout = setTimeout(() => {
    document.body.classList.remove("controls-visible");
    controlsHideTimeout = null;
  }, 1800);
};

const hideControlsSoon = () => {
  clearTimeout(controlsHideTimeout);
  controlsHideTimeout = setTimeout(() => {
    document.body.classList.remove("controls-visible");
    controlsHideTimeout = null;
  }, 220);
};

const requestFullscreen = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.();
  }
};

const getComboEntries = (combos, setId, dayId) => {
  if (!combos || typeof combos !== "object") return [];

  const setEntry = combos[setId] || combos.all;
  if (Array.isArray(setEntry)) return setEntry;
  if (!setEntry || typeof setEntry !== "object") return [];

  const dayEntry = setEntry[dayId] || setEntry.all;
  return Array.isArray(dayEntry) ? dayEntry : [];
};

const createEmptyHolidayFlags = () => ({
  chanukah: false,
  roshChodesh: false,
  succos: false,
  fastDay: false,
  shabbat: false,
  purim: false,
  fools: false,
  belated: false
});

const normalizeHolidayKey = (value) => {
  const rawValue = toText(value).toLowerCase();
  const isNegated = /^null[\s_-]/.test(rawValue);
  const baseValue = rawValue.replace(/^null[\s_-]+/, "");
  const normalized = baseValue.replace(/[\s_-]+/g, "");

  let holidayKey = "";
  if (["chanukah", "hanukkah"].includes(normalized)) holidayKey = "chanukah";
  else if (["roshchodesh", "roshhodesh"].includes(normalized)) holidayKey = "roshChodesh";
  else if (["succos", "sukkos", "succot", "sukkot"].includes(normalized)) holidayKey = "succos";
  else if (["fast", "fastday", "fastdays", "taanit", "taanit", "tzom"].includes(normalized)) holidayKey = "fastDay";
  else if (["shabbat", "shabbos"].includes(normalized)) holidayKey = "shabbat";
  else if (["purim", "shushanpurim"].includes(normalized)) holidayKey = "purim";
  else if (["fools", "aprilfools", "aprilfool"].includes(normalized)) holidayKey = "fools";
  else if (["belated"].includes(normalized)) holidayKey = "belated";

  return holidayKey ? { key: holidayKey, negated: isNegated } : null;
};

const getRequestedHolidayKeys = (entry) => {
  if (!entry || typeof entry !== "object") return [];

  const requestedValues = []
    .concat(entry.holiday || [])
    .concat(entry.holidays || [])
    .concat(entry.holidayType || [])
    .concat(entry.holidayTypes || []);

  const normalizedRules = requestedValues.map(normalizeHolidayKey).filter(Boolean);
  return normalizedRules.filter(
    (rule, index, rules) => index === rules.findIndex((candidate) => candidate.key === rule.key && candidate.negated === rule.negated)
  );
};

const isHolidayEntryActive = (entry) => {
  const requestedHolidayKeys = getRequestedHolidayKeys(entry);
  if (activeHolidayFlags.shabbat) {
    return requestedHolidayKeys.some((rule) => rule.key === "shabbat" && !rule.negated);
  }
  if (!requestedHolidayKeys.length) return true;
  return requestedHolidayKeys.every((rule) =>
    rule.negated ? !activeHolidayFlags[rule.key] : !!activeHolidayFlags[rule.key]
  );
};

const getBaseSlidesForCurrentSelection = () =>
  getComboEntries(slideCombos, currentSetId, currentDayId).filter(isHolidayEntryActive);

const getSlidesForCurrentSelection = () => getBaseSlidesForCurrentSelection();

const getLabelById = (options, id) => options.find((option) => option.id === id)?.label || id;

const normalizeSlideEntry = (entry) => {
  if (Array.isArray(entry)) {
    return { slides: entry, background: "", name: "", title: "", logo: undefined, details: "", url: "" };
  }

  if (entry && typeof entry === "object") {
    const slides = Array.isArray(entry.slides)
      ? entry.slides
      : Array.isArray(entry.images)
      ? entry.images
      : [entry];

    return {
      slides,
      background: entry.background || "",
      name: entry.name || "",
      title: entry.title || "",
      logo: Object.prototype.hasOwnProperty.call(entry, "logo") ? entry.logo : undefined,
      details: toText(entry.details),
      url: toText(entry.url || entry.link)
    };
  }

  return { slides: [entry], background: "", name: "", title: "", logo: undefined, details: "", url: "" };
};

const getBackgroundForEntry = (entry) =>
  entry?.background || dropdownBackgroundById[currentDayId] || buttonBackgroundById[currentSetId] || "";

const getDefaultTitle = () =>
  [getLabelById(buttonOptions, currentSetId), getLabelById(dropdownOptions, currentDayId)]
    .filter(Boolean)
    .join(" | ");

const getDefaultSlideName = (slideIndex) => {
  const setLabel = getLabelById(buttonOptions, currentSetId) || currentSetId || "Set";
  const dayLabel = getLabelById(dropdownOptions, currentDayId) || currentDayId || "Day";
  return `${setLabel} ${dayLabel} ${slideIndex + 1}`;
};

const getSlideTitle = (entry, slideIndex = currentSlideIndex) => {
  const explicitTitle = toText(entry?.title);
  if (explicitTitle) return explicitTitle;

  const setLabel = getLabelById(buttonOptions, currentSetId) || currentSetId || "Set";
  const dayLabel = getLabelById(dropdownOptions, currentDayId) || currentDayId || "Day";
  const dayShort = dayLabel.slice(0, 3);
  const formattedDay = dayShort ? `${dayShort[0].toUpperCase()}${dayShort.slice(1).toLowerCase()}` : "Day";
  return `${setLabel}-${formattedDay}-${slideIndex + 1}`;
};

const getSlideName = (entry, slideIndex) => {
  const explicitName = toText(entry?.name);
  if (explicitName) return explicitName;

  return getDefaultSlideName(slideIndex);
};

const getAnnouncementUrl = (entry) => {
  const rawUrl = toText(entry?.url || entry?.details);
  if (!rawUrl) return "";

  try {
    return new URL(rawUrl, window.location.href).href;
  } catch {
    return "";
  }
};

const hasVisibleSlideText = (value) => {
  const text = toText(value);
  return text && text.toUpperCase() !== "N/A";
};

const isTorahEntry = (slides) => slides.some((value) => toText(value).toUpperCase() === "TORAH");

const parseParshaEntries = (items) =>
  Array.isArray(items)
    ? items
        .map((item) => ({
          name: toText(item?.name),
          ashkenazPage: toText(item?.ashkenaz_page),
          sephardiPage: toText(item?.sephardi_page),
          chabadPage: toText(item?.Chabad),
          translatedPage: toText(item?.translated)
        }))
        .filter((item) => item.name)
    : [];

const normalizeParshaName = (value) =>
  toText(value)
    .replace(/^Parashat\s+/i, "")
    .replace(/[’']/g, "'")
    .replace(/[‐‑–—]/g, "-")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ");

const applyParshaAlias = (name) => parshaNameAliases[normalizeParshaName(name)] || normalizeParshaName(name);

const findParshaEntryByName = (name) => {
  const normalizedName = applyParshaAlias(name);
  if (!normalizedName) return null;

  const exactMatch = parshaEntries.find((entry) => normalizeParshaName(entry.name) === normalizedName);
  if (exactMatch) return exactMatch;

  const combinedMatch = normalizedName
    .split("-")
    .map((part) => applyParshaAlias(part))
    .find((part) => part);

  if (!combinedMatch) return null;
  return parshaEntries.find((entry) => normalizeParshaName(entry.name) === combinedMatch) || null;
};

const getSelectedParsha = () => parshaEntries.find((entry) => entry.name === selectedParshaName) || null;

const getTorahSlidesForSelectedParsha = () => {
  const parsha = getSelectedParsha();
  if (!parsha) return null;

  if (currentSetId === "mixed") {
    return [parsha.ashkenazPage, parsha.sephardiPage, parsha.chabadPage, parsha.translatedPage];
  }

  if (currentSetId === "ashkenazi") {
    return [parsha.ashkenazPage, parsha.chabadPage, parsha.translatedPage];
  }

  if (currentSetId === "sephardic") {
    return [parsha.sephardiPage, parsha.chabadPage, parsha.translatedPage];
  }

  return null;
};

const formatDateForApi = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatMonthDay = (date) => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}-${day}`;
};

const addDays = (date, days) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
};

const normalizeDateOverride = (value) => {
  const match = toText(value).match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return "";

  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
};

const getDateTimeOverride = () => {
  const params = new URLSearchParams(window.location.search);
  const rawDateTime =
    toText(params.get("datetime")) || toText(params.get("dt")) || toText(params.get("dateTime")) || "";

  if (!rawDateTime) return "";

  const parsedDate = new Date(rawDateTime);
  return Number.isNaN(parsedDate.getTime()) ? "" : rawDateTime;
};

const weekdayByIndex = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const getEffectiveNow = () => {
  const overrideDateTime = getDateTimeOverride();
  if (overrideDateTime) {
    const parsedDateTime = new Date(overrideDateTime);
    return Number.isNaN(parsedDateTime.getTime()) ? new Date() : parsedDateTime;
  }

  const params = new URLSearchParams(window.location.search);
  const overrideDate = normalizeDateOverride(params.get("date"));
  if (!overrideDate) {
    return new Date();
  }

  const parsedDate = new Date(`${overrideDate}T12:00:00`);
  return Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
};

const resolveCurrentDayId = () => {
  if (activeHolidayFlags.chanukah) {
    return "monday";
  }

  const params = new URLSearchParams(window.location.search);
  const dayOverride = toText(params.get("day")).toLowerCase();
  if (dayOverride && dropdownOptions.some((option) => option.id === dayOverride)) {
    return dayOverride;
  }

  const derivedDay = weekdayByIndex[getEffectiveNow().getDay()] || "";
  if (derivedDay === "sunday" || derivedDay === "saturday") {
    return "monday";
  }
  if (dropdownOptions.some((option) => option.id === derivedDay)) {
    return derivedDay;
  }

  return "";
};

const resolveCurrentParsha = async () => {
  const today = getEffectiveNow();
  const start = formatDateForApi(today);
  const end = formatDateForApi(addDays(today, 21));
  const requestUrl = `${parshaApiBaseUrl}?v=1&cfg=json&start=${start}&end=${end}&s=on&i=off&maj=off&min=off&mod=off&nx=off&mf=off&ss=off&c=off&leyning=off`;

  const response = await fetch(requestUrl);
  if (!response.ok) {
    throw new Error(`Parsha lookup failed with status ${response.status}`);
  }

  const data = await response.json();
  const parshaItems = Array.isArray(data?.items) ? data.items.filter((item) => item?.category === "parashat") : [];
  if (!parshaItems.length) return null;

  const upcomingParsha = parshaItems.find((item) => toText(item?.date) >= start) || parshaItems[0];
  const lookupName = normalizeParshaName(upcomingParsha?.title);
  const matchedEntry = findParshaEntryByName(lookupName);

  return {
    entry: matchedEntry,
    label: lookupName
  };
};

const resolveCurrentTorahReading = async () => {
  const today = getEffectiveNow();
  const date = formatDateForApi(today);
  const requestUrl = `${holidayApiBaseUrl}?v=1&cfg=json&start=${date}&end=${date}&maj=on&min=on&mod=on&nx=on&mf=on&ss=off&c=off&geo=none&M=on&s=off`;

  try {
    const response = await fetch(requestUrl);
    if (response.ok) {
      const data = await response.json();
      const items = Array.isArray(data?.items) ? data.items : [];
      const hanukkahItem = items.find((item) => {
        const title = normalizeHolidayTitle(item?.title || item?.title_orig);
        return title.includes("chanukah") || title.includes("hanukkah");
      });

      if (hanukkahItem) {
        const holidayTitle = normalizeHolidayTitle(hanukkahItem?.title || hanukkahItem?.title_orig);
        const hanukkahName = hanukkahTorahNameByHolidayTitle[holidayTitle];
        const matchedEntry = hanukkahName ? findParshaEntryByName(hanukkahName) : null;

        if (matchedEntry) {
          return {
            entry: matchedEntry,
            label: matchedEntry.name
          };
        }
      }

      const isRoshChodesh = items.some((item) => normalizeHolidayTitle(item?.title || item?.title_orig) === "rosh chodesh");
      if (isRoshChodesh) {
        const matchedEntry = findParshaEntryByName("Rosh Chodesh");
        if (matchedEntry) {
          return {
            entry: matchedEntry,
            label: matchedEntry.name
          };
        }
      }
    }
  } catch {
    // Fall back to the weekly parsha lookup below.
  }

  return resolveCurrentParsha();
};

const normalizeHolidayTitle = (value) =>
  toText(value)
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[‐‑–—]/g, "-")
    .replace(/\s+/g, " ");

const resolveActiveHolidays = async () => {
  const today = getEffectiveNow();
  const date = formatDateForApi(today);
  const monthDay = formatMonthDay(today);
  const requestUrl = `${holidayApiBaseUrl}?v=1&cfg=json&start=${date}&end=${date}&maj=on&min=on&mod=on&nx=on&mf=on&ss=off&c=off&geo=none&M=on&s=off`;

  const response = await fetch(requestUrl);
  if (!response.ok) {
    throw new Error(`Holiday lookup failed with status ${response.status}`);
  }

  const zmanimUrl = `${zmanimApiBaseUrl}?cfg=json&im=1&zip=${encodeURIComponent(shabbatZipCode)}&dt=${encodeURIComponent(
    today.toISOString()
  )}`;
  const zmanimResponse = await fetch(zmanimUrl);
  if (!zmanimResponse.ok) {
    throw new Error(`Zmanim lookup failed with status ${zmanimResponse.status}`);
  }

  const data = await response.json();
  const zmanimData = await zmanimResponse.json();
  const items = Array.isArray(data?.items) ? data.items : [];
  const nextHolidayFlags = createEmptyHolidayFlags();

  if (zmanimData?.status?.isAssurBemlacha === true) {
    nextHolidayFlags.shabbat = true;
  }

  items.forEach((item) => {
    const title = normalizeHolidayTitle(item?.title || item?.title_orig);
    const category = toText(item?.category).toLowerCase();
    const subcategory = toText(item?.subcat).toLowerCase();

    if (category === "roshchodesh") {
      nextHolidayFlags.roshChodesh = true;
    }

    if (subcategory === "fast") {
      nextHolidayFlags.fastDay = true;
    }

    if (title.includes("shabbat") || title.includes("shabbos")) {
      nextHolidayFlags.shabbat = true;
    }

    if (title.includes("chanukah") || title.includes("hanukkah")) {
      nextHolidayFlags.chanukah = true;
    }

    if (title.includes("purim")) {
      nextHolidayFlags.purim = true;
    }

    if (["sukkot", "sukkos", "succot", "succos"].some((term) => title.includes(term))) {
      nextHolidayFlags.succos = true;
    }
  });

  if (monthDay === "04-01") {
    nextHolidayFlags.fools = true;
  }

  if (monthDay === "12-11") {
    nextHolidayFlags.belated = true;
  }

  return nextHolidayFlags;
};

const setSlideTitle = (titleText) => {
  const title = toText(titleText);
  slideTitleElement.textContent = title;
  setDisplay(slideTitleElement, !!title);
};

const setSlideLogo = (logoSource) => {
  const source = toText(logoSource);
  if (source) {
    slideLogoElement.src = source;
    setDisplay(slideLogoElement, true);
    return;
  }
  slideLogoElement.removeAttribute("src");
  setDisplay(slideLogoElement, false);
};

const updateNavigationButtonLabels = () => {
  const slidesForSelection = getSlidesForCurrentSelection();
  if (!slidesForSelection.length) {
    previousButton.textContent = "Prev";
    previousButton.setAttribute("aria-label", "Previous slide");
    nextButton.textContent = "Next";
    nextButton.setAttribute("aria-label", "Next slide");
    return;
  }

  const previousIndex = (currentSlideIndex - 1 + slidesForSelection.length) % slidesForSelection.length;
  const nextIndex = (currentSlideIndex + 1) % slidesForSelection.length;
  const previousEntry = normalizeSlideEntry(slidesForSelection[previousIndex]);
  const nextEntry = normalizeSlideEntry(slidesForSelection[nextIndex]);
  const previousSlideName = getSlideName(previousEntry, previousIndex);
  const nextSlideName = getSlideName(nextEntry, nextIndex);

  previousButton.textContent = previousSlideName || "Prev";
  previousButton.setAttribute("aria-label", previousSlideName ? `Previous slide: ${previousSlideName}` : "Previous slide");
  nextButton.textContent = nextSlideName || "Next";
  nextButton.setAttribute("aria-label", nextSlideName ? `Next slide: ${nextSlideName}` : "Next slide");
};

const setSiddurImage = (imageElement, imageSource) => {
  if (imageSource) {
    imageElement.src = imageSource;
    setDisplay(imageElement, true);
    return;
  }
  imageElement.removeAttribute("src");
  setDisplay(imageElement, false);
};

const isValidPageNumber = (value) => {
  if (value == null) return false;
  if (typeof value === "number") return Number.isFinite(value);

  const text = toText(value);
  return text && text.toUpperCase() !== "N/A" && /^\d+(\s*-\s*\d+)?$/.test(text);
};

const getActiveSiddurSlots = () => {
  const siddur1Source = siddurSettings.siddur1?.[currentSetId] || "";
  const siddur2Source = siddurSettings.siddur2 || "";
  const siddur3Source = siddurSettings.siddur3 || "";
  const siddur4Source = siddurSettings.siddur4 || "";

  if (currentSetId === "mixed") {
    return [
      { element: siddurSlot1Element, source: siddur1Source },
      { element: siddurSlot4Element, source: siddur4Source },
      { element: siddurSlot2Element, source: siddur2Source },
      { element: siddurSlot3Element, source: siddur3Source }
    ];
  }

  if (currentSetId === "ashkenazi" || currentSetId === "sephardic") {
    return [
      { element: siddurSlot1Element, source: siddur1Source },
      { element: siddurSlot2Element, source: siddur2Source },
      { element: siddurSlot3Element, source: siddur3Source }
    ];
  }

  return [];
};

const positionSiddursOverSlideDigits = (activeSiddurSlots) => {
  const slideDigitElements = Array.from(slideNumberElement.querySelectorAll(".slide-digit"));
  const slideshowRect = slideshowElement.getBoundingClientRect();

  activeSiddurSlots.forEach(({ element, slotIndex }) => {
    const digitElement = slideDigitElements[slotIndex];
    if (!digitElement || element.style.display === "none") return;

    const digitRect = digitElement.getBoundingClientRect();
    element.style.left = `${digitRect.left - slideshowRect.left + digitRect.width / 2}px`;
  });
};

const clearAllSiddurs = () => {
  allSiddurElements.forEach((element) => setSiddurImage(element, ""));
};

const renderCurrentSlide = () => {
  const slidesForSelection = getSlidesForCurrentSelection();

  if (!slidesForSelection.length) {
    currentSlideEntry = null;
    slideImageElement.removeAttribute("src");
    setDisplay(slideImageElement, false);
    slideNumberElement.textContent = "0 0 0";
    slideCounterElement.textContent = "0 / 0";

    const fallbackBackground = getBackgroundForEntry(null);
    slideshowElement.style.backgroundImage = fallbackBackground ? `url('${fallbackBackground}')` : "";
    slideshowElement.classList.remove("is-clickable");

    setSlideTitle(getDefaultTitle());
    setSlideLogo(brandingSettings.logo);
    clearAllSiddurs();
    updateNavigationButtonLabels();
    saveState();
    return;
  }

  currentSlideIndex = clampSlideIndex(currentSlideIndex, slidesForSelection.length);

  const currentEntry = normalizeSlideEntry(slidesForSelection[currentSlideIndex]);
  currentSlideEntry = currentEntry;
  let slideValues = Array.isArray(currentEntry.slides) ? currentEntry.slides : [currentEntry.slides];
  const entryIsTorah = isTorahEntry(slideValues);

  if (entryIsTorah) {
    const parshaSlides = getTorahSlidesForSelectedParsha();
    if (parshaSlides?.length) {
      slideValues = parshaSlides;
    }
  }

  const slideTextValues = slideValues.map((value) => toText(value));

  slideImageElement.removeAttribute("src");
  setDisplay(slideImageElement, false);

  slideNumberElement.innerHTML = slideTextValues
    .map((value) => {
      const showValue = hasVisibleSlideText(value);
      const className = showValue ? "slide-digit" : "slide-digit is-empty";
      return `<span class="${className}">${showValue ? value : ""}</span>`;
    })
    .join("");

  slideCounterElement.textContent = `${currentSlideIndex + 1} / ${slidesForSelection.length}`;

  const backgroundImage = getBackgroundForEntry(currentEntry);
  slideshowElement.style.backgroundImage = backgroundImage ? `url('${backgroundImage}')` : "";
  slideshowElement.classList.toggle("is-clickable", !!getAnnouncementUrl(currentEntry));

  const baseTitle = getSlideTitle(currentEntry, currentSlideIndex);
  const parshaTitle = activeParshaLabel || selectedParshaName;
  const isParshaReadingSlide = backgroundImage === "backgrounds/30.png";
  const isAshkenaziWeekdayParshaReading = currentSetId === "ashkenazi" && ["monday", "thursday"].includes(currentDayId);
  const titleText = entryIsTorah && parshaTitle
    ? isParshaReadingSlide
      ? `Parsha: ${parshaTitle}`
      : `${baseTitle} : ${parshaTitle}`
    : baseTitle;
  slideTitleElement.classList.toggle("is-parsha-reading", entryIsTorah && isParshaReadingSlide && !!parshaTitle);
  slideTitleElement.classList.toggle(
    "is-parsha-reading-ashkenazi-weekday",
    entryIsTorah && isParshaReadingSlide && !!parshaTitle && isAshkenaziWeekdayParshaReading
  );
  setSlideTitle(titleText);
  setSlideLogo(currentEntry.logo !== undefined ? currentEntry.logo : brandingSettings.logo);

  const siddurSlots = getActiveSiddurSlots();
  const slotCount = siddurSlots.length;
  const renderedSiddurSlots = [];
  const activeSlotElements = new Set(siddurSlots.map((slot) => slot.element));

  allSiddurElements.forEach((element) => {
    element.style.removeProperty("--slot-index");
    element.style.removeProperty("--slot-count");
    element.style.removeProperty("left");

    if (!activeSlotElements.has(element)) {
      setSiddurImage(element, "");
    }
  });

  siddurSlots.forEach(({ element, source }, slotIndex) => {
    const validSource = isValidPageNumber(slideValues[slotIndex]) ? source : "";
    setSiddurImage(element, validSource);
    if (!validSource) return;

    element.style.setProperty("--slot-index", slotIndex);
    element.style.setProperty("--slot-count", slotCount);
    renderedSiddurSlots.push({ element, slotIndex });
  });

  requestAnimationFrame(() => positionSiddursOverSlideDigits(renderedSiddurSlots));
  updateNavigationButtonLabels();
  saveState();
};

const updateSlide = ({ animate = true } = {}) => {
  const shouldAnimate = animate && hasRenderedAtLeastOnce;
  clearTimeout(slideTransitionTimeout);

  if (!shouldAnimate) {
    slideshowElement.classList.remove("transitioning");
    renderCurrentSlide();
    hasRenderedAtLeastOnce = true;
    return;
  }

  slideshowElement.classList.add("transitioning");
  slideTransitionTimeout = setTimeout(() => {
    renderCurrentSlide();
    requestAnimationFrame(() => slideshowElement.classList.remove("transitioning"));
    slideTransitionTimeout = null;
  }, 130);
};

const updateActiveSetButton = () => {
  setButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.set === currentSetId);
  });
  slideshowElement.classList.toggle("is-mixed", currentSetId === "mixed");
};

const ensureCurrentDayIsValid = () => {
  if (slideCombos[currentSetId]?.[currentDayId]) return;

  const availableDays = Object.keys(slideCombos[currentSetId] || {});
  currentDayId = availableDays[0] || dropdownOptions[0]?.id || "";
};

const changeSet = (setId) => {
  if (!slideCombos[setId]) return;
  currentSetId = setId;
  currentSlideIndex = 0;
  ensureCurrentDayIsValid();
  updateActiveSetButton();
  updateSlide();
};

slideshowElement.addEventListener("click", (event) => {
  if (event.target.closest(".nav")) return;

  const announcementUrl = getAnnouncementUrl(currentSlideEntry);
  if (!announcementUrl) return;

  window.open(announcementUrl, "_blank", "noopener,noreferrer");
});

const stepSlide = (direction) => {
  const slidesForSelection = getSlidesForCurrentSelection();
  if (!slidesForSelection.length) return;

  currentSlideIndex = (currentSlideIndex + direction + slidesForSelection.length) % slidesForSelection.length;
  updateSlide();
};

setButtons.forEach((button) => {
  button.addEventListener("click", () => changeSet(button.dataset.set));
});

previousButton.addEventListener("click", () => stepSlide(-1));
nextButton.addEventListener("click", () => stepSlide(1));

fullscreenButton.addEventListener("click", () => {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    requestFullscreen();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") stepSlide(-1);
  if (event.key === "ArrowRight") stepSlide(1);

  if (event.key === " " || event.code === "Space" || event.key === "Spacebar") {
    event.preventDefault();
    stepSlide(1);
  }
});

window.addEventListener("resize", () => {
  updateSlide({ animate: false });
});

document.addEventListener("mousemove", (event) => {
  if (event.clientY <= 80) showControls();
  else hideControlsSoon();
});

document.addEventListener(
  "touchstart",
  (event) => {
    if (event.touches?.[0] && event.touches[0].clientY <= 90) {
      showControls();
    }
  },
  { passive: true }
);

document.addEventListener("click", requestFullscreen, { once: true });
document.addEventListener("keydown", requestFullscreen, { once: true });
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement) requestFullscreen();
});

requestFullscreen();

const parseOptions = (items) =>
  Array.isArray(items)
    ? items.map((item) => ({
        id: typeof item === "string" ? item : item.id || item.value || "",
        label: typeof item === "string" ? item : item.label || item.id || item.value || "",
        background: typeof item === "string" ? "" : item.background || ""
      }))
    : [];

const initializeFromSlidesData = async () => {
  setButtons.forEach((button) => {
    button.disabled = !slideCombos[button.dataset.set];
  });

  selectedParshaName = parshaEntries[0]?.name || "";
  activeParshaLabel = selectedParshaName;

  try {
    const currentParsha = await resolveCurrentTorahReading();
    if (currentParsha?.entry?.name) {
      selectedParshaName = currentParsha.entry.name;
      activeParshaLabel = currentParsha.entry.name;
    }
    if (!currentParsha?.entry?.name && currentParsha?.label) {
      activeParshaLabel = currentParsha.label;
    } else if (!currentParsha?.entry?.name) {
      activeParshaLabel = selectedParshaName;
    }
  } catch {
    activeParshaLabel = selectedParshaName;
  }

  const savedState = readSavedState();
  const firstAvailableSet = buttonOptions[0]?.id || Object.keys(slideCombos)[0] || "";
  const savedSet = typeof savedState?.button === "string" ? savedState.button : "";

  currentSetId = slideCombos[savedSet] ? savedSet : firstAvailableSet;
  currentDayId = resolveCurrentDayId() || dropdownOptions[0]?.id || "";

  ensureCurrentDayIsValid();
  currentSlideIndex = clampSlideIndex(savedState?.index, getSlidesForCurrentSelection().length);
  updateActiveSetButton();
  updateSlide();
};

Promise.all([
  fetch("slides.json").then((response) => response.json()),
  fetch("parsha.json")
    .then((response) => response.json())
    .catch(() => []),
  resolveActiveHolidays().catch(() => createEmptyHolidayFlags())
])
  .then(async ([slidesData, parshaData, holidayFlags]) => {
    buttonOptions = parseOptions(slidesData.buttons);
    dropdownOptions = parseOptions(slidesData.dropdowns);

    buttonBackgroundById = buttonOptions.reduce((map, option) => {
      if (option.id && option.background) map[option.id] = option.background;
      return map;
    }, {});

    dropdownBackgroundById = dropdownOptions.reduce((map, option) => {
      if (option.id && option.background) map[option.id] = option.background;
      return map;
    }, {});

    slideCombos = slidesData.combos || {};
    siddurSettings = {
      siddur1: slidesData.siddurs?.siddur1 || { ashkenazi: "", sephardic: "" },
      siddur2: slidesData.siddurs?.siddur2 || "",
      siddur3: slidesData.siddurs?.siddur3 || "",
      siddur4: slidesData.siddurs?.siddur4 || ""
    };
    brandingSettings = {
      title: slidesData.branding?.title || "",
      logo: slidesData.branding?.logo || ""
    };
    parshaEntries = parseParshaEntries(parshaData);
    activeHolidayFlags = holidayFlags;

    if (buttonOptions.length) {
      const labelBySetId = new Map(buttonOptions.map((option) => [option.id, option.label]));
      setButtons.forEach((button) => {
        const label = labelBySetId.get(button.dataset.set);
        if (label) button.textContent = label;
      });
    }

    await initializeFromSlidesData();
  })
  .catch(() => {
    buttonOptions = [];
    dropdownOptions = [];
    slideCombos = {};
    parshaEntries = [];
    activeHolidayFlags = createEmptyHolidayFlags();
    updateSlide();
  });
