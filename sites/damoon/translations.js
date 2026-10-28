// Prepared translation registry for later app integration. This module is not wired into rendering yet.
export const translations = {
  en: {
    direction: "ltr",
    locale: "en",
    site: {
      name: "Damoon Hotel",
      eyebrow: "Hospitality in Shahrekord",
      tagline: "Quiet moments in the heart of Shahrekord",
      description: "Plan your stay or gathering at Damoon Hotel.",
      city: "Shahrekord",
      phone: "+983832261988",
      phoneDisplay: "+98 38 3226 1988",
      address: "Shahrekord, North 12 Moharram Street, Basij Square",
      mapUrl: "https://www.waze.com/live-map/directions?to=place.w.33358147.333319329.15567976",
      imageNote: "Concept image used to illustrate the site layout; not an actual hotel photo.",
      nav: [
        ["/", "Home"], ["/rooms", "Rooms and suites"], ["/restaurant", "Restaurant"], ["/cafe", "Café"], ["/virtual-tour", "Virtual tour"],
      ],
    },
    rooms: {
      single: { title: "Single room", description: "The single-room category is listed for stays planned for one guest.", image: "/assets/room-concept-1.webp" },
      double: { title: "Double room", description: "The double-room category is listed for stays planned for two guests.", image: "/assets/room-concept-2.webp" },
      "suite-3-bed": { title: "Three-bed suite", description: "The three-bed suite is one of Damoon’s listed accommodation categories.", image: "/assets/room-concept-3.webp" },
      "suite-4-5-bed": { title: "Four- and five-bed suites", description: "Four- and five-bed suites are listed under these accommodation categories.", image: "/assets/lobby-concept.webp" },
    },
    gallery: [
      { src: "/assets/architecture-concept.webp", alt: "Concept architectural illustration for the page layout" },
      { src: "/assets/lobby-concept.webp", alt: "Concept lobby illustration, not a hotel photo" },
      { src: "/assets/room-concept-1.webp", alt: "Concept room illustration, not a hotel photo" },
      { src: "/assets/room-concept-2.webp", alt: "Concept accommodation illustration, not a hotel photo" },
      { src: "/assets/room-concept-3.webp", alt: "Concept suite illustration, not a hotel photo" },
      { src: "/assets/gallery-concept-1.webp", alt: "Concept image for the site gallery" },
    ],
    pages: {
      "/": {
        title: "Stay and hospitality in Shahrekord", intro: "Welcome to Damoon Hotel", text: "Explore the accommodation spaces, restaurant, and café at Damoon Hotel.",
        actions: [["/rooms", "View rooms"], ["/contact", "Contact and coordination"]],
        sections: [
          { heading: "Your accommodation", text: "Browse the room and suite categories. Details for each unit will be added after hotel confirmation.", link: "/rooms", label: "Explore the rooms", note: "Concept image; not an actual photo." },
          { heading: "Hotel restaurant", text: "The hotel restaurant is ready. Contact the hotel to coordinate and ask for current information.", link: "/restaurant", label: "About the restaurant", note: "Concept image; not a restaurant photo." },
          { heading: "Luxury café", text: "The hotel café is in progress. Opening and service information will be shared when available.", link: "/cafe", label: "See current status", note: "Concept image; not a café photo.", badge: "In progress" },
          { heading: "Virtual tour", text: "Get to know Damoon through its virtual-tour service. Online display on this site is being prepared.", link: "/virtual-tour", label: "Damoon virtual tour", note: "Concept image; not a tour view." },
        ],
      },
      "/rooms": {
        title: "Rooms and suites", intro: "Accommodation spaces", text: "This page lists the accommodation categories. Capacity, in-room amenities, rates, and availability are not displayed until confirmed.",
        sections: [
          { ...{ heading: "Single room", text: "The single-room category is listed for stays planned for one guest." }, link: "/rooms/single", label: "Details", note: "Concept image; not an actual room photo." },
          { heading: "Double room", text: "The double-room category is listed for stays planned for two guests.", link: "/rooms/double", label: "Details", note: "Concept image; not an actual room photo." },
          { heading: "Three-bed suite", text: "The three-bed suite is one of Damoon’s listed accommodation categories.", link: "/rooms/suite-3-bed", label: "Details", note: "Concept image; not an actual room photo." },
          { heading: "Four- and five-bed suites", text: "Four- and five-bed suites are listed under these accommodation categories.", link: "/rooms/suite-4-5-bed", label: "Details", note: "Concept image; not an actual room photo." },
        ],
      },
      "/restaurant": {
        title: "Damoon Hotel restaurant", intro: "The hotel restaurant is ready", text: "The Damoon Hotel restaurant is ready. Contact reception for the menu, opening hours, and visit coordination; these details are not published on the site.", actions: [["/contact", "Contact details"]],
        sections: [
          { heading: "Plan your visit", text: "Before visiting, ask the hotel about opening hours and current arrangements.", link: "/contact", label: "Contact reception" },
          { heading: "Hotel breakfast", text: "Free buffet breakfast is a listed hotel service. Contact reception to ask when it is served.", link: "/facilities", label: "View facilities" },
        ],
      },
      "/cafe": {
        title: "Damoon Hotel café", intro: "Luxury café in progress", text: "The luxury café at Damoon Hotel is in progress. An opening date, menu, and opening hours have not been announced for publication.", badge: "In progress", actions: [["/contact", "Contact the hotel"]],
        sections: [{ heading: "Café status", text: "The luxury café is in progress. Contact the hotel for a status update; opening and service details will be updated after an official announcement.", link: "/contact", label: "Contact details" }],
      },
      "/facilities": {
        title: "Hotel facilities", intro: "Facilities and services", text: "Listed Damoon Hotel facilities include 24-hour reception, internet, an elevator, taxi service, parking, and free buffet breakfast. Contact reception with questions about services or facilities in a particular room.", actions: [["/contact", "Contact details"]],
        sections: [
          { heading: "Reception and services", text: "Reception is available 24 hours a day. Internet, an elevator, and taxi service are also listed; ask reception how to use these services." },
          { heading: "Breakfast and restaurant", text: "Free buffet breakfast is a listed service, and the hotel restaurant is ready. Call ahead to ask about breakfast service, the menu, and restaurant hours.", link: "/restaurant", label: "Restaurant information" },
          { heading: "Parking", text: "Parking is available at the hotel. Capacity has not been stated; contact reception in advance to check arrangements for your visit.", link: "/contact", label: "Contact reception" },
        ],
      },
      "/gallery": { title: "Damoon Hotel gallery", intro: "Image gallery", text: "The images below are design concepts and do not show the actual hotel or its current condition. They will be replaced with approved photos when available.", gallery: true },
      "/about": {
        title: "About Damoon Hotel", intro: "About the hotel", text: "Damoon Hotel is in Shahrekord. This site introduces its accommodation categories, listed facilities, and the current status of its restaurant and café. Contact reception to coordinate your plans.", actions: [["/contact", "Contact the hotel"]],
        sections: [
          { heading: "Staying at Damoon", text: "The site lists single and double rooms and three-, four-, and five-bed suites. Ask reception to confirm capacity, in-room amenities, and current rates.", link: "/rooms", label: "Browse accommodation" },
          { heading: "Services and timing", text: "Hotel reception is available around the clock. Check-in is at 14:00 and check-out is at 12:00; contact the hotel about your plans before travelling.", link: "/facilities", label: "Explore facilities" },
        ],
      },
      "/contact": {
        title: "Contact Damoon Hotel", intro: "Contact us to coordinate your plans", text: "Contact reception to coordinate a stay, ask about facilities, or plan a restaurant visit. Damoon is in Shahrekord, North 12 Moharram Street, Basij Square.",
        sections: [
          { heading: "Coordinate your stay", text: "When you call, share your arrival and departure dates, number of guests, and preferred accommodation category. Reception can confirm capacity, rates, and availability.", link: "/rooms", label: "Browse accommodation" },
          { heading: "Hotel address", text: "Damoon Hotel is in Shahrekord, North 12 Moharram Street, Basij Square. Use the map button to view directions." },
        ],
      },
      "/policies": {
        title: "Stay information and privacy", intro: "Stay information and privacy", text: "Check-in is at 14:00 and check-out is at 12:00. Contact reception before making plans if you have questions about other stay or booking arrangements.",
        sections: [
          { heading: "Check-in and check-out", text: "Check-in is at 14:00 and check-out is at 12:00. If your plans require different times, ask reception whether coordination is possible; a change is not guaranteed." },
          { heading: "Dates and guests", text: "Date and guest selections on this site are for planning only; they do not reserve or hold a room, and online payment is not available. Contact reception to finalize a stay." },
          { heading: "Booking coordination", text: "Contact reception to ask about rates, availability, changes or cancellations, and required documents. Confirm the information for your travel dates.", link: "/contact", label: "Contact reception" },
          { heading: "Privacy", text: "Your display theme and color selection are saved in your browser. Selected dates and guest count are kept in the current browser session and page address; this version has no form for submitting personal information or payment." },
        ],
      },
      "/virtual-tour": {
        title: "Damoon Hotel virtual tour", intro: "Virtual tour", text: "Damoon offers a virtual-tour service. Online display on this site is being prepared; browse the rooms page to learn about accommodation categories.", badge: "Online display in preparation", actions: [["/contact", "Contact the hotel"]],
        sections: [{ heading: "Explore Damoon’s spaces", text: "The tour will be available from this page once its viewer is ready. Images in this site gallery are concepts and do not show the actual virtual tour.", link: "/contact", label: "Contact the hotel" }],
      },
    },
    roomDetails: {
      shared: [
        { heading: "Before choosing", text: "The category name alone does not specify the layout, beds, or in-room amenities. When you call, share your guest count and needs so reception can check suitable options.", link: "/contact", label: "Ask reception" },
        { heading: "Stay timing", text: "Check-in is at 14:00 and check-out is at 12:00. Contact the hotel directly to confirm capacity, rates, and availability for your dates.", link: "/policies", label: "Check-in and check-out information" },
        { heading: "Hotel facilities", text: "Listed general facilities include 24-hour reception, internet, an elevator, taxi service, parking, and free buffet breakfast. Ask reception whether a specific facility is available in this room.", link: "/facilities", label: "View facilities" },
      ],
      textSuffix: "Ask reception to confirm exact capacity, in-room amenities, rates, and availability for your dates.",
      action: ["/contact", "Contact to coordinate"],
      imageNote: "Concept image; not an actual room photo.",
    },
    ui: {
      skipToMain: "Skip to main content", mainMenu: "Main menu", mobileMenu: "Mobile menu", appearanceSettings: "Appearance settings", choosePalette: "Choose a color palette", contactHotel: "Contact the hotel", openMenu: "Open menu", closeMenu: "Close menu", footerLinks: "Footer links", breadcrumb: "Breadcrumb", detailsMore: "More details", generalHotel: "Damoon Hotel", additionalInformation: "More information", coordinateWithHotel: "Coordinate with the hotel", pageNotFound: "Page not found", pageNotFoundText: "The page address may have changed.", backHome: "Back to home", reception: "Reception", callReception: "Call reception", directions: "View directions", checkIn: "Check-in", checkOut: "Check-out", guests: "Guests", room: "Room", rooms: "Rooms", restaurant: "Restaurant", cafe: "Café", facilities: "Facilities", gallery: "Gallery", aboutDamoon: "About Damoon", contact: "Contact", policies: "Stay information and privacy", virtualTour: "Virtual tour", conceptImage: "Concept image", conceptGallery: "Concept gallery", referenceImages: "Reference images", zoomConceptImage: "Enlarge concept image", closeImageViewer: "Close image viewer", previousImage: "Previous image", nextImage: "Next image", datePlanningOnly: "Date selection is for stay coordination; online booking is not available.", stayPlanning: "Plan your stay", selectStayDates: "Select your stay dates", selectArrivalDate: "Select check-in date", selectDepartureDate: "Select check-out date", selectGuestCount: "Number of guests", guestCount: "{count} guests", bookingSubmit: "Continue to coordinate", bookingSummary: "Current selection", contactForStay: "Contact us to coordinate this stay", calendar: "Calendar", closeCalendar: "Close calendar", previousMonth: "Previous month", nextMonth: "Next month", chooseArrivalFirst: "Choose your check-in date first.", chooseDepartureNext: "Now choose your check-out date.", arrivalCannotBePast: "Check-in date cannot be in the past.", departureAfterArrival: "Check-out date must be after check-in.", selectBothDates: "Select check-in and check-out dates first.", noOnlineBooking: "Online booking and payment are not available.", imageNotActual: "Concept image; not an actual hotel photo.", imageNotTour: "Concept image; not a view from the virtual tour.", imageCount: "{current} of {total}", colorPalette: "Color palette", switchToDark: "Switch to dark theme", switchToLight: "Switch to light theme",
      noscript: "JavaScript is required to display this page.", selectDate: "Select date", guestCountOne: "{count} guest", guestCountOther: "{count} guests", homeSubtitle: "Stay and hospitality in Shahrekord", homeLead: "Explore Damoon’s spaces for your stay and gatherings, and contact us to coordinate.", homeShortcuts: "Quick links", roomSpaces: "Accommodation spaces", restaurantShort: "For a pleasant meal", tourShort: "Explore the spaces", calmStay: "A calm stay and pleasant moments", homeIntro: "Damoon Hotel in Shahrekord welcomes your stay and gathering plans. Explore the hotel spaces and contact us to coordinate.", aboutMore: "More about the hotel", accommodationSpaces: "Accommodation spaces", aPlaceToRest: "A place to rest", browseRooms: "Browse Damoon Hotel’s accommodation categories and contact us to find an option for your plans.", conceptCaption: "Concept image", viewSpaces: "View spaces", forYourStay: "For your stay", hotelSpaces: "Hotel spaces", planYourStay: "Plan your stay", contactCoordination: "Contact the hotel to coordinate", footerReception: "Reception", homeEyebrow: "A calm stay in Shahrekord", notFound: "Page not found", notFoundText: "The page address may have changed.", paletteNames: { hermes: "Cream and orange", forest: "Light natural green", wood: "Wood brown" },
    },
  },
  ar: {
    direction: "rtl",
    locale: "ar",
    site: {
      name: "فندق دامون",
      eyebrow: "ضيافة في شهركرد",
      tagline: "لحظات هادئة في قلب شهركرد",
      description: "خطط لإقامتك أو لقائك في فندق دامون.",
      city: "شهركرد",
      phone: "+983832261988",
      phoneDisplay: "+98 38 3226 1988",
      address: "شهركرد، شارع 12 محرم الشمالي، ساحة بسيج",
      mapUrl: "https://www.waze.com/live-map/directions?to=place.w.33358147.333319329.15567976",
      imageNote: "صورة تصورية لتوضيح تصميم الموقع؛ وليست صورة حقيقية للفندق.",
      nav: [
        ["/", "الرئيسية"], ["/rooms", "الغرف والأجنحة"], ["/restaurant", "المطعم"], ["/cafe", "المقهى"], ["/virtual-tour", "الجولة الافتراضية"],
      ],
    },
    rooms: {
      single: { title: "غرفة بسرير واحد", description: "فئة الغرفة بسرير واحد مدرجة للإقامة المخطط لها لضيف واحد.", image: "/assets/room-concept-1.webp" },
      double: { title: "غرفة بسريرين", description: "فئة الغرفة بسريرين مدرجة للإقامة المخطط لها لضيفين.", image: "/assets/room-concept-2.webp" },
      "suite-3-bed": { title: "جناح بثلاثة أسرّة", description: "الجناح بثلاثة أسرّة إحدى فئات الإقامة المدرجة في دامون.", image: "/assets/room-concept-3.webp" },
      "suite-4-5-bed": { title: "أجنحة بأربعة أو خمسة أسرّة", description: "الأجنحة بأربعة أو خمسة أسرّة مدرجة ضمن فئات الإقامة بهذه التسمية.", image: "/assets/lobby-concept.webp" },
    },
    gallery: [
      { src: "/assets/architecture-concept.webp", alt: "رسم معماري تصوري لتصميم الصفحة" },
      { src: "/assets/lobby-concept.webp", alt: "تصميم تصوري للردهة، وليس صورة للفندق" },
      { src: "/assets/room-concept-1.webp", alt: "تصميم تصوري لغرفة، وليس صورة للفندق" },
      { src: "/assets/room-concept-2.webp", alt: "تصميم تصوري لمساحة إقامة، وليس صورة للفندق" },
      { src: "/assets/room-concept-3.webp", alt: "تصميم تصوري لجناح، وليس صورة للفندق" },
      { src: "/assets/gallery-concept-1.webp", alt: "صورة تصورية لمعرض الموقع" },
    ],
    pages: {
      "/": {
        title: "الإقامة والضيافة في شهركرد", intro: "مرحباً بكم في فندق دامون", text: "تعرّفوا على أماكن الإقامة والمطعم والمقهى في فندق دامون.",
        actions: [["/rooms", "استعراض الغرف"], ["/contact", "التواصل والتنسيق"]],
        sections: [
          { heading: "أماكن الإقامة", text: "استعرضوا فئات الغرف والأجنحة. ستُضاف تفاصيل كل وحدة بعد تأكيد الفندق.", link: "/rooms", label: "التعرّف على الغرف", note: "صورة تصورية؛ وليست صورة حقيقية." },
          { heading: "مطعم الفندق", text: "مطعم الفندق جاهز. تواصلوا مع الفندق للتنسيق والاستفسار عن المعلومات الحالية.", link: "/restaurant", label: "عن المطعم", note: "صورة تصورية؛ وليست صورة للمطعم." },
          { heading: "مقهى فاخر", text: "يجري استكمال مقهى الفندق. ستُعلن معلومات الافتتاح والخدمات عند توفرها.", link: "/cafe", label: "عرض الحالة الحالية", note: "صورة تصورية؛ وليست صورة للمقهى.", badge: "قيد الاستكمال" },
          { heading: "الجولة الافتراضية", text: "تعرّفوا على دامون من خلال خدمة الجولة الافتراضية. يجري إعداد عرضها عبر الموقع.", link: "/virtual-tour", label: "جولة دامون الافتراضية", note: "صورة تصورية؛ وليست مشهداً من الجولة." },
        ],
      },
      "/rooms": {
        title: "الغرف والأجنحة", intro: "أماكن الإقامة", text: "تعرض هذه الصفحة فئات الإقامة. لا تُعرض السعة أو تجهيزات الغرف أو الأسعار أو التوفر قبل تأكيدها.",
        sections: [
          { heading: "غرفة بسرير واحد", text: "فئة الغرفة بسرير واحد مدرجة للإقامة المخطط لها لضيف واحد.", link: "/rooms/single", label: "التفاصيل", note: "صورة تصورية؛ وليست صورة حقيقية للغرفة." },
          { heading: "غرفة بسريرين", text: "فئة الغرفة بسريرين مدرجة للإقامة المخطط لها لضيفين.", link: "/rooms/double", label: "التفاصيل", note: "صورة تصورية؛ وليست صورة حقيقية للغرفة." },
          { heading: "جناح بثلاثة أسرّة", text: "الجناح بثلاثة أسرّة إحدى فئات الإقامة المدرجة في دامون.", link: "/rooms/suite-3-bed", label: "التفاصيل", note: "صورة تصورية؛ وليست صورة حقيقية للغرفة." },
          { heading: "أجنحة بأربعة أو خمسة أسرّة", text: "الأجنحة بأربعة أو خمسة أسرّة مدرجة ضمن فئات الإقامة بهذه التسمية.", link: "/rooms/suite-4-5-bed", label: "التفاصيل", note: "صورة تصورية؛ وليست صورة حقيقية للغرفة." },
        ],
      },
      "/restaurant": {
        title: "مطعم فندق دامون", intro: "مطعم الفندق جاهز", text: "مطعم فندق دامون جاهز. تواصلوا مع الاستقبال للاستفسار عن قائمة الطعام وساعات العمل وتنسيق الزيارة؛ فهذه التفاصيل غير منشورة على الموقع.", actions: [["/contact", "معلومات التواصل"]],
        sections: [
          { heading: "تنسيق الزيارة", text: "قبل الزيارة، استفسروا من الفندق عن ساعات العمل والترتيبات الحالية.", link: "/contact", label: "التواصل مع الاستقبال" },
          { heading: "إفطار الفندق", text: "الإفطار بنظام البوفيه مجاني ومن الخدمات المدرجة للفندق. تواصلوا مع الاستقبال لمعرفة موعد تقديمه.", link: "/facilities", label: "عرض المرافق" },
        ],
      },
      "/cafe": {
        title: "مقهى فندق دامون", intro: "مقهى فاخر قيد الاستكمال", text: "يجري استكمال المقهى الفاخر في فندق دامون. لم يُعلن للنشر عن موعد الافتتاح أو قائمة الطعام أو ساعات العمل.", badge: "قيد الاستكمال", actions: [["/contact", "التواصل مع الفندق"]],
        sections: [{ heading: "حالة المقهى", text: "يجري استكمال المقهى الفاخر. تواصلوا مع الفندق للاستفسار عن الحالة؛ وستُحدّث تفاصيل الافتتاح والخدمات بعد الإعلان الرسمي.", link: "/contact", label: "معلومات التواصل" }],
      },
      "/facilities": {
        title: "مرافق الفندق", intro: "المرافق والخدمات", text: "تشمل مرافق فندق دامون المدرجة استقبالاً على مدار 24 ساعة، وإنترنت، ومصعداً، وخدمة سيارات الأجرة، ومواقف للسيارات، وإفطاراً مجانياً بنظام البوفيه. تواصلوا مع الاستقبال للاستفسار عن الخدمات أو مرافق غرفة معينة.", actions: [["/contact", "معلومات التواصل"]],
        sections: [
          { heading: "الاستقبال والخدمات", text: "الاستقبال متاح على مدار الساعة. كما أُدرج الإنترنت والمصعد وخدمة سيارات الأجرة؛ اسألوا الاستقبال عن طريقة استخدام هذه الخدمات." },
          { heading: "الإفطار والمطعم", text: "الإفطار المجاني بنظام البوفيه من الخدمات المدرجة، ومطعم الفندق جاهز. اتصلوا مسبقاً للاستفسار عن موعد الإفطار وقائمة الطعام وساعات المطعم.", link: "/restaurant", label: "معلومات المطعم" },
          { heading: "مواقف السيارات", text: "تتوفر مواقف للسيارات في الفندق. لم تُعلن السعة؛ تواصلوا مع الاستقبال مسبقاً للتحقق من ترتيبات زيارتكم.", link: "/contact", label: "التواصل مع الاستقبال" },
        ],
      },
      "/gallery": { title: "معرض صور فندق دامون", intro: "معرض الصور", text: "الصور أدناه تصاميم توضيحية ولا تعرض الفندق الحقيقي أو حالته الحالية. ستُستبدل بصور معتمدة عند توفرها.", gallery: true },
      "/about": {
        title: "عن فندق دامون", intro: "عن الفندق", text: "يقع فندق دامون في شهركرد. يعرّف هذا الموقع بفئات الإقامة والمرافق المدرجة والحالة الحالية للمطعم والمقهى. تواصلوا مع الاستقبال لتنسيق خططكم.", actions: [["/contact", "التواصل مع الفندق"]],
        sections: [
          { heading: "الإقامة في دامون", text: "يعرض الموقع غرفاً بسرير واحد أو سريرين وأجنحة بثلاثة أو أربعة أو خمسة أسرّة. اسألوا الاستقبال لتأكيد السعة وتجهيزات الغرفة والأسعار الحالية.", link: "/rooms", label: "استعراض أماكن الإقامة" },
          { heading: "الخدمات والمواعيد", text: "الاستقبال متاح على مدار الساعة. تسجيل الدخول الساعة 14:00 وتسجيل المغادرة الساعة 12:00؛ تواصلوا مع الفندق بشأن خططكم قبل السفر.", link: "/facilities", label: "التعرّف على المرافق" },
        ],
      },
      "/contact": {
        title: "التواصل مع فندق دامون", intro: "تواصلوا معنا لتنسيق خططكم", text: "تواصلوا مع الاستقبال لتنسيق الإقامة أو الاستفسار عن المرافق أو التخطيط لزيارة المطعم. يقع دامون في شهركرد، شارع 12 محرم الشمالي، ساحة بسيج.",
        sections: [
          { heading: "تنسيق الإقامة", text: "عند الاتصال، اذكروا تاريخي الوصول والمغادرة وعدد الضيوف وفئة الإقامة المطلوبة. يمكن للاستقبال تأكيد السعة والأسعار والتوفر.", link: "/rooms", label: "استعراض أماكن الإقامة" },
          { heading: "عنوان الفندق", text: "يقع فندق دامون في شهركرد، شارع 12 محرم الشمالي، ساحة بسيج. استخدموا زر الخريطة لعرض الاتجاهات." },
        ],
      },
      "/policies": {
        title: "معلومات الإقامة والخصوصية", intro: "معلومات الإقامة والخصوصية", text: "تسجيل الدخول الساعة 14:00 وتسجيل المغادرة الساعة 12:00. تواصلوا مع الاستقبال قبل التخطيط إذا كانت لديكم أسئلة عن ترتيبات الإقامة أو الحجز الأخرى.",
        sections: [
          { heading: "تسجيل الدخول والمغادرة", text: "تسجيل الدخول الساعة 14:00 وتسجيل المغادرة الساعة 12:00. إذا تطلبت خططكم مواعيد مختلفة، اسألوا الاستقبال عن إمكانية التنسيق؛ ولا يُضمن تغيير الموعد." },
          { heading: "التواريخ والضيوف", text: "اختيار التاريخ وعدد الضيوف على الموقع للتخطيط فقط؛ فهو لا يحجز غرفة ولا يحتفظ بها، كما أن الدفع عبر الإنترنت غير متاح. تواصلوا مع الاستقبال لإتمام الإقامة." },
          { heading: "تنسيق الحجز", text: "تواصلوا مع الاستقبال للاستفسار عن الأسعار والتوفر والتغيير أو الإلغاء والوثائق المطلوبة. أكّدوا المعلومات الخاصة بتواريخ سفركم.", link: "/contact", label: "التواصل مع الاستقبال" },
          { heading: "الخصوصية", text: "يُحفظ المظهر اللوني للموقع في متصفحكم. وتُحفظ التواريخ وعدد الضيوف المختار في جلسة المتصفح الحالية وعنوان الصفحة؛ ولا يتضمن هذا الإصدار نموذجاً لإرسال المعلومات الشخصية أو الدفع." },
        ],
      },
      "/virtual-tour": {
        title: "الجولة الافتراضية لفندق دامون", intro: "الجولة الافتراضية", text: "يقدم دامون خدمة الجولة الافتراضية. يجري إعداد عرضها عبر هذا الموقع؛ ويمكنكم استعراض صفحة الغرف للتعرّف على فئات الإقامة.", badge: "يجري إعداد العرض عبر الإنترنت", actions: [["/contact", "التواصل مع الفندق"]],
        sections: [{ heading: "استكشفوا أماكن دامون", text: "ستتوفر الجولة من هذه الصفحة بعد تجهيز العارض. صور معرض الموقع تصاميم توضيحية ولا تعرض الجولة الافتراضية الحقيقية.", link: "/contact", label: "التواصل مع الفندق" }],
      },
    },
    roomDetails: {
      shared: [
        { heading: "قبل الاختيار", text: "لا يحدد اسم الفئة وحده التصميم أو الأسرّة أو تجهيزات الغرفة. عند الاتصال، اذكروا عدد الضيوف واحتياجاتكم ليتمكن الاستقبال من التحقق من الخيارات المناسبة.", link: "/contact", label: "استفسروا من الاستقبال" },
        { heading: "مواعيد الإقامة", text: "تسجيل الدخول الساعة 14:00 وتسجيل المغادرة الساعة 12:00. تواصلوا مباشرة مع الفندق لتأكيد السعة والأسعار والتوفر في تواريخكم.", link: "/policies", label: "معلومات الدخول والمغادرة" },
        { heading: "مرافق الفندق", text: "تشمل المرافق العامة المدرجة استقبالاً على مدار الساعة وإنترنت ومصعداً وخدمة سيارات الأجرة ومواقف وإفطاراً مجانياً بنظام البوفيه. اسألوا الاستقبال عما إذا كانت مرفق معين متاحاً في هذه الغرفة.", link: "/facilities", label: "عرض المرافق" },
      ],
      textSuffix: "اسألوا الاستقبال لتأكيد السعة وتجهيزات الغرفة والأسعار والتوفر في تواريخكم.",
      action: ["/contact", "التواصل للتنسيق"],
      imageNote: "صورة تصورية؛ وليست صورة حقيقية للغرفة.",
    },
    ui: {
      skipToMain: "انتقل إلى المحتوى الرئيسي", mainMenu: "القائمة الرئيسية", mobileMenu: "قائمة الهاتف", appearanceSettings: "إعدادات المظهر", choosePalette: "اختيار لوحة الألوان", contactHotel: "التواصل مع الفندق", openMenu: "فتح القائمة", closeMenu: "إغلاق القائمة", footerLinks: "روابط التذييل", breadcrumb: "مسار الصفحة", detailsMore: "مزيد من التفاصيل", generalHotel: "فندق دامون", additionalInformation: "معلومات إضافية", coordinateWithHotel: "التنسيق مع الفندق", pageNotFound: "الصفحة غير موجودة", pageNotFoundText: "ربما تغير عنوان الصفحة.", backHome: "العودة إلى الرئيسية", reception: "الاستقبال", callReception: "الاتصال بالاستقبال", directions: "عرض الاتجاهات", checkIn: "تسجيل الدخول", checkOut: "تسجيل المغادرة", guests: "الضيوف", room: "غرفة", rooms: "الغرف", restaurant: "المطعم", cafe: "المقهى", facilities: "المرافق", gallery: "المعرض", aboutDamoon: "عن دامون", contact: "التواصل", policies: "معلومات الإقامة والخصوصية", virtualTour: "الجولة الافتراضية", conceptImage: "صورة تصورية", conceptGallery: "معرض تصوري", referenceImages: "صور مرجعية", zoomConceptImage: "تكبير الصورة التصورية", closeImageViewer: "إغلاق عارض الصور", previousImage: "الصورة السابقة", nextImage: "الصورة التالية", datePlanningOnly: "اختيار التاريخ للتنسيق بشأن الإقامة؛ الحجز عبر الإنترنت غير متاح.", stayPlanning: "التخطيط للإقامة", selectStayDates: "اختاروا تواريخ الإقامة", selectArrivalDate: "اختيار تاريخ تسجيل الدخول", selectDepartureDate: "اختيار تاريخ تسجيل المغادرة", selectGuestCount: "عدد الضيوف", guestCount: "{count} ضيوف", bookingSubmit: "المتابعة للتنسيق", bookingSummary: "الاختيار الحالي", contactForStay: "تواصلوا معنا لتنسيق هذه الإقامة", calendar: "التقويم", closeCalendar: "إغلاق التقويم", previousMonth: "الشهر السابق", nextMonth: "الشهر التالي", chooseArrivalFirst: "اختاروا أولاً تاريخ تسجيل الدخول.", chooseDepartureNext: "اختاروا الآن تاريخ تسجيل المغادرة.", arrivalCannotBePast: "لا يمكن أن يكون تاريخ الدخول في الماضي.", departureAfterArrival: "يجب أن يكون تاريخ المغادرة بعد تاريخ الدخول.", selectBothDates: "اختاروا أولاً تاريخي الدخول والمغادرة.", noOnlineBooking: "الحجز والدفع عبر الإنترنت غير متاحين.", imageNotActual: "صورة تصورية؛ وليست صورة حقيقية للفندق.", imageNotTour: "صورة تصورية؛ وليست مشهداً من الجولة الافتراضية.", imageCount: "{current} من {total}", colorPalette: "لوحة الألوان", switchToDark: "التبديل إلى المظهر الداكن", switchToLight: "التبديل إلى المظهر الفاتح",
      noscript: "يلزم تفعيل جافاسكريبت لعرض هذه الصفحة.", selectDate: "اختيار التاريخ", guestCountZero: "{count} ضيف", guestCountOne: "{count} ضيف", guestCountTwo: "{count} ضيفان", guestCountFew: "{count} ضيوف", guestCountMany: "{count} ضيفاً", guestCountOther: "{count} ضيف", homeSubtitle: "الإقامة والضيافة في شهركرد", homeLead: "استكشفوا مساحات دامون للإقامة واللقاءات، وتواصلوا معنا للتنسيق.", homeShortcuts: "روابط سريعة", roomSpaces: "أماكن الإقامة", restaurantShort: "لوجبة طيبة", tourShort: "استكشفوا المساحات", calmStay: "إقامة هادئة ولحظات طيبة", homeIntro: "يرحب فندق دامون في شهركرد بخطط إقامتكم ولقاءاتكم. استكشفوا مساحات الفندق وتواصلوا معنا للتنسيق.", aboutMore: "المزيد عن الفندق", accommodationSpaces: "أماكن الإقامة", aPlaceToRest: "مكان للراحة", browseRooms: "استعرضوا فئات الإقامة في فندق دامون وتواصلوا معنا لاختيار ما يناسب خططكم.", conceptCaption: "صورة تصورية", viewSpaces: "استعراض المساحات", forYourStay: "لإقامتكم", hotelSpaces: "مساحات الفندق", planYourStay: "خططوا لإقامتكم", contactCoordination: "تواصلوا مع الفندق للتنسيق", footerReception: "الاستقبال", homeEyebrow: "إقامة هادئة في شهركرد", notFound: "الصفحة غير موجودة", notFoundText: "ربما تغير عنوان الصفحة.", paletteNames: { hermes: "كريمي وبرتقالي", forest: "أخضر طبيعي فاتح", wood: "بني خشبي" },
    },
  },
};

export default translations;
