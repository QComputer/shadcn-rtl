// Active English/Arabic registry; Persian source copy lives in content.js and app.js.
export const translations = {
  en: {
    direction: "ltr",
    locale: "en",
    site: {
      name: "Damoon Hotel",
      eyebrow: "Hospitality in Shahrekord",
      tagline: "Quiet moments in the heart of Shahrekord",
      description: "Explore accommodation and plan a stay at Damoon Hotel in Shahrekord.",
      city: "Shahrekord",
      phone: "+983832261988",
      phoneDisplay: "+98 38 3226 1988",
      address: "Shahrekord, North 12 Moharram Street, Basij Square",
      mapUrl: "https://www.waze.com/live-map/directions?to=place.w.33358147.333319329.15567976",
      imageNote: "Concept image used to illustrate the site layout; not an actual hotel photo.",
      nav: [
        ["/", "Home"], ["/rooms", "Rooms and suites"], ["/facilities", "Guest services"], ["/virtual-tour", "Virtual tour"],
      ],
    },
    rooms: {
      single: { title: "Single room", description: "Single room category; confirm exact capacity and in-room details with reception.", image: "/assets/room-concept-1.webp" },
      double: { title: "Double room", description: "Double room category; confirm exact capacity and in-room details with reception.", image: "/assets/room-concept-2.webp" },
      "suite-3-bed": { title: "Suite", description: "Suite category; confirm exact capacity and in-room details with reception.", image: "/assets/room-concept-3.webp" },
      "suite-4-5-bed": { title: "Suite", description: "Suite category; confirm exact capacity and in-room details with reception.", image: "/assets/lobby-concept.webp" },
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
        title: "Stay and hospitality in Shahrekord", intro: "Welcome to Damoon Hotel", text: "Damoon Hotel welcomes guests to 31 accommodation units in Shahrekord: 20 rooms and 11 suites. Explore the accommodation categories and contact reception to plan your stay.",
        actions: [["/rooms", "View rooms"], ["/contact", "Contact and coordination"]],
        sections: [
          { heading: "Your accommodation", text: "Browse the room and suite categories. Details for each unit will be added after hotel confirmation.", link: "/rooms", label: "Explore the rooms", note: "Concept image; not an actual photo." },
          { heading: "Guest comfort", text: "Contact reception to ask about services available during your stay.", link: "/facilities", label: "Guest services" },
          { heading: "Plan your stay", text: "Check-in is from 14:00 and check-out is by 12:00 noon.", link: "/policies", label: "Stay information" },
          { heading: "Virtual tour", text: "Get to know Damoon through its virtual-tour service. Online display on this site is being prepared.", link: "/virtual-tour", label: "Damoon virtual tour", note: "Concept image; not a tour view." },
        ],
      },
      "/rooms": {
        title: "Rooms and suites", intro: "Accommodation spaces", text: "Damoon Hotel has 31 accommodation units: 20 rooms and 11 suites. This page lists the accommodation categories; exact capacity, in-room amenities, rates, and availability are not shown.",
        sections: [
          { ...{ heading: "Single room", text: "Single room category; confirm exact capacity and in-room details with reception." }, link: "/rooms/single", label: "Details", note: "Concept image; not an actual room photo." },
          { heading: "Double room", text: "Double room category; confirm exact capacity and in-room details with reception.", link: "/rooms/double", label: "Details", note: "Concept image; not an actual room photo." },
          { heading: "Suite", text: "Suite category; confirm exact capacity and in-room details with reception.", link: "/rooms/suite-3-bed", label: "Details", note: "Concept image; not an actual room photo." },
          { heading: "Suite", text: "Suite category; confirm exact capacity and in-room details with reception.", link: "/rooms/suite-4-5-bed", label: "Details", note: "Concept image; not an actual room photo." },
        ],
      },
      "/restaurant": {
        title: "Guest dining information", intro: "Dining information for hotel guests", text: "Damoon Hotel does not currently operate a restaurant or banquet hall. The large dining hall for complimentary guest breakfast is under preparation and is not yet operational.", actions: [["/rooms", "Explore accommodation"], ["/contact", "Contact reception"]],
        sections: [
          { heading: "Guest breakfast hall", text: "The large hall for complimentary guest breakfast is under preparation and is not yet open. Ask reception about services available for your travel dates.", link: "/contact", label: "Ask reception" },
          { heading: "Plan a stay", text: "Browse accommodation categories and contact reception to coordinate your stay.", link: "/rooms", label: "Explore accommodation" },
        ],
      },
      "/cafe": {
        title: "In-room refreshments", intro: "Refreshments for guests in their rooms", text: "Damoon Hotel has no standalone café or café seating area. Café-style refreshments are served to hotel guests in their rooms; contact reception for details during your stay.", actions: [["/contact", "Contact reception"]],
        sections: [{ heading: "In-room service", text: "Refreshment service is for hotel guests in their rooms. There is no separate café venue.", link: "/contact", label: "Contact reception" }],
      },
      "/facilities": {
        title: "Hotel facilities", intro: "Facilities and services", text: "Contact reception to ask which services are available, their hours, and which facilities are available in a particular room.", actions: [["/contact", "Contact details"]],
        sections: [
          { heading: "Reception and services", text: "Ask reception which services are currently available and their hours." },
          { heading: "Guest breakfast hall", text: "The large hall for complimentary guest breakfast is under preparation and is not yet operational. Ask reception about current services.", link: "/restaurant", label: "Dining information" },
          { heading: "In-room refreshments", text: "Café-style refreshments are served to guests in their rooms. The hotel has no separate café or café seating area.", link: "/cafe", label: "In-room service" },
          { heading: "Parking", text: "Contact reception in advance to ask whether parking is available and about arrangements for your visit.", link: "/contact", label: "Contact reception" },
        ],
      },
      "/gallery": { title: "Damoon Hotel gallery", intro: "Image gallery", text: "The images below are design concepts and do not show the actual hotel or its current condition. They will be replaced with approved photos when available.", gallery: true },
      "/about": {
        title: "About Damoon Hotel", intro: "About the hotel", text: "Damoon Hotel in Shahrekord has 31 accommodation units: 20 rooms and 11 suites. Contact reception to coordinate your stay and ask about guest services.", actions: [["/contact", "Contact the hotel"]],
        sections: [
          { heading: "A warm welcome", text: "Damoon aims to offer warm, friendly, and calm hospitality, so guests can feel at ease and at home throughout their stay." },
          { heading: "Staying at Damoon", text: "The site lists single and double rooms and three-, four-, and five-bed suites. Ask reception to confirm capacity, in-room amenities, and current rates.", link: "/rooms", label: "Browse accommodation" },
          { heading: "Check-in and check-out", text: "Check-in is from 14:00 and check-out is by 12:00 noon.", link: "/policies", label: "Stay information" },
        ],
      },
      "/contact": {
        title: "Contact Damoon Hotel", intro: "Contact us to coordinate your stay", text: "Contact reception to coordinate accommodation or ask about guest services. Damoon is in Shahrekord, North 12 Moharram Street, Basij Square.",
        sections: [
          { heading: "Coordinate your stay", text: "When you call, share your arrival and departure dates, number of guests, and preferred accommodation category. Reception can confirm capacity, rates, and availability.", link: "/rooms", label: "Browse accommodation" },
          { heading: "Hotel address", text: "Damoon Hotel is in Shahrekord, North 12 Moharram Street, Basij Square. Use the map button to view directions." },
        ],
      },
      "/policies": {
        title: "Stay information and privacy", intro: "Stay information and privacy", text: "Check-in is from 14:00 and check-out is by 12:00 noon. Contact reception about other stay arrangements.",
        sections: [
          { heading: "Check-in and check-out", text: "Check-in is from 14:00 and check-out is by 12:00 noon." },
          { heading: "Dates and guests", text: "Date and guest selections on this site are for planning only; they do not reserve or hold a room, and online payment is not available. Contact reception to finalize a stay." },
          { heading: "Booking coordination", text: "Contact reception to ask about rates, availability, changes or cancellations, and required documents. Confirm the information for your travel dates.", link: "/contact", label: "Contact reception" },
          { heading: "Privacy", text: "Your display theme and color choice are saved in your browser. Selected dates, guest counts, and children’s ages are carried in the page address and current browser session. Anyone you share the link with can see these selections. In this phase, the site does not submit personal contact details or payments." },
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
          { heading: "Stay timing", text: "Check-in is from 14:00 and check-out is by 12:00 noon. Contact reception to confirm capacity, rates, and availability for your dates.", link: "/policies", label: "Check-in and check-out information" },
        { heading: "Hotel facilities", text: "Ask reception which facilities and services are currently available in this room and their hours.", link: "/facilities", label: "View facilities" },
      ],
      textSuffix: "Ask reception to confirm exact capacity, in-room amenities, rates, and availability for your dates.",
      action: ["/contact", "Contact us to coordinate"],
      imageNote: "Concept image; not an actual room photo.",
    },
    ui: {
      skipToMain: "Skip to main content", mainMenu: "Main menu", mobileMenu: "Mobile menu", appearanceSettings: "Appearance settings", choosePalette: "Choose a color palette", contactHotel: "Contact the hotel", openMenu: "Open menu", closeMenu: "Close menu", footerLinks: "Footer links", breadcrumb: "Breadcrumb", detailsMore: "More details", generalHotel: "Damoon Hotel", additionalInformation: "More information", coordinateWithHotel: "Coordinate with the hotel", pageNotFound: "Page not found", pageNotFoundText: "The page address may have changed.", backHome: "Back to home", reception: "Reception", callReception: "Call reception", directions: "View directions", checkIn: "Check-in", checkOut: "Check-out", guests: "Guests", room: "Room", rooms: "Rooms", restaurant: "Dining information", cafe: "In-room refreshments", facilities: "Guest services", gallery: "Gallery", aboutDamoon: "About Damoon", contact: "Contact", policies: "Stay information and privacy", virtualTour: "Virtual tour", conceptImage: "Concept image", conceptGallery: "Concept gallery", referenceImages: "Reference images", zoomConceptImage: "Enlarge concept image", closeImageViewer: "Close image viewer", previousImage: "Previous image", nextImage: "Next image", datePlanningOnly: "Dates are for planning and coordination only; confirm room, rate, and availability with reception.", stayPlanning: "Plan your stay", selectStayDates: "Select your stay dates", selectArrivalDate: "Select check-in date", selectDepartureDate: "Select check-out date", selectGuestCount: "Number of guests", guestCount: "{count} guests", bookingSubmit: "Continue to stay coordination", bookingSummary: "Current selection", contactForStay: "Contact us to coordinate this stay", calendar: "Calendar", closeCalendar: "Close calendar", previousMonth: "Previous month", nextMonth: "Next month", chooseArrivalFirst: "Choose your check-in date first.", chooseDepartureNext: "Now choose your check-out date.", arrivalCannotBePast: "Check-in date cannot be in the past.", departureAfterArrival: "Check-out date must be after check-in.", selectBothDates: "Select check-in and check-out dates first.", noOnlineBooking: "Online booking and payment are not available.", imageNotActual: "Concept image; not an actual hotel photo.", imageNotTour: "Concept image; not a view from the virtual tour.", imageCount: "{current} of {total}", colorPalette: "Color palette", switchToDark: "Switch to dark theme", switchToLight: "Switch to light theme",
      noscript: "JavaScript is required to display this page.", selectDate: "Select date", guestCountOne: "{count} guest", guestCountOther: "{count} guests", homeSubtitle: "A welcoming stay in Shahrekord", guestComfort: "Guest comfort", unitCount: "31 accommodation units", unitBreakdown: "20 rooms · 11 suites", checkInLabel: "Check-in", checkOutLabel: "Check-out", homeLead: "Damoon Hotel has 31 accommodation units: 20 rooms and 11 suites. Contact reception to plan your stay.", homeShortcuts: "Quick links", roomSpaces: "Accommodation spaces", restaurantShort: "For a pleasant meal", tourShort: "Explore the spaces", calmStay: "A calm stay and pleasant moments", homeIntro: "Damoon Hotel in Shahrekord welcomes guests and their stay plans. Contact reception to coordinate your visit.", aboutMore: "More about the hotel", accommodationSpaces: "Accommodation spaces", aPlaceToRest: "A place to rest", browseRooms: "Browse Damoon Hotel’s accommodation categories and contact us to find an option for your plans.", conceptCaption: "Concept image", viewSpaces: "View spaces", forYourStay: "For your stay", hotelSpaces: "Hotel spaces", planYourStay: "Plan your stay", contactCoordination: "Contact the hotel to coordinate", footerReception: "Reception", homeEyebrow: "A calm stay in Shahrekord", notFound: "Page not found", notFoundText: "The page address may have changed.", paletteNames: { hermes: "Cream and orange", forest: "Light natural green", wood: "Wood brown" }, adults: "Adults", adultsCount: "{count} adults", adultsCountOne: "{count} adult", adultsCountOther: "{count} adults", children: "Children", childAge: "Child {index} age", childAgeRequired: "Enter a valid age (0-17) for each child.", selectRoom: "Select room", pricePerNight: "Per night", totalPrice: "Total", nightsCount: "{count} nights", nightsCountOne: "{count} night", nightsCountOther: "{count} nights", guestDetails: "Guest details", fullName: "Full name", phone: "Phone number", email: "Email (optional)", policyAcceptance: "I have read and accept the cancellation policy.", policyRequired: "You must accept the cancellation policy to continue.", holdRoom: "Reserve this room", holdUnavailable: "Hold service is unavailable right now.", holdCreated: "Room held successfully.", holdReference: "Reference", holdExpires: "Hold expires", backToOptions: "Back to options", invalidContact: "Enter your full name and a valid phone number.", searching: "Checking availability...",
    },
  },
  ar: {
    direction: "rtl",
    locale: "ar",
    site: {
      name: "فندق دامون",
      eyebrow: "ضيافة في شهركرد",
      tagline: "لحظات هادئة في قلب شهركرد",
      description: "تعرّف على أماكن الإقامة وخطط لإقامتك في فندق دامون بمدينة شهركرد.",
      city: "شهركرد",
      phone: "+983832261988",
      phoneDisplay: "+98 38 3226 1988",
      address: "شهركرد، شارع 12 محرم الشمالي، ساحة بسيج",
      mapUrl: "https://www.waze.com/live-map/directions?to=place.w.33358147.333319329.15567976",
      imageNote: "صورة تصورية لتوضيح تصميم الموقع؛ وليست صورة حقيقية للفندق.",
      nav: [
        ["/", "الرئيسية"], ["/rooms", "الغرف والأجنحة"], ["/facilities", "خدمات الضيوف"], ["/virtual-tour", "الجولة الافتراضية"],
      ],
    },
    rooms: {
      single: { title: "غرفة مفردة", description: "فئة غرفة مفردة؛ يرجى تأكيد السعة الدقيقة والتجهيزات مع الاستقبال.", image: "/assets/room-concept-1.webp" },
      double: { title: "غرفة مزدوجة", description: "فئة غرفة مزدوجة؛ يرجى تأكيد السعة الدقيقة والتجهيزات مع الاستقبال.", image: "/assets/room-concept-2.webp" },
      "suite-3-bed": { title: "جناح", description: "فئة جناح؛ يرجى تأكيد السعة الدقيقة والتجهيزات مع الاستقبال.", image: "/assets/room-concept-3.webp" },
      "suite-4-5-bed": { title: "جناح", description: "فئة جناح؛ يرجى تأكيد السعة الدقيقة والتجهيزات مع الاستقبال.", image: "/assets/lobby-concept.webp" },
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
        title: "الإقامة والضيافة في شهركرد", intro: "مرحباً بكم في فندق دامون", text: "يضم فندق دامون في شهركرد ٣١ وحدة إقامة: ٢٠ غرفة و١١ جناحاً. استكشفوا فئات الإقامة وتواصلوا مع الاستقبال للتخطيط لإقامتكم.",
        actions: [["/rooms", "استعراض الغرف"], ["/contact", "التواصل والتنسيق"]],
        sections: [
          { heading: "أماكن الإقامة", text: "استعرضوا فئات الغرف والأجنحة. ستُضاف تفاصيل كل وحدة بعد تأكيد الفندق.", link: "/rooms", label: "التعرّف على الغرف", note: "صورة تصورية؛ وليست صورة حقيقية." },
          { heading: "راحة الضيوف", text: "تواصلوا مع الاستقبال للاستفسار عن الخدمات المتاحة خلال الإقامة.", link: "/facilities", label: "خدمات الضيوف" },
          { heading: "خططوا لإقامتكم", text: "تسجيل الدخول من الساعة ١٤:٠٠ وتسجيل المغادرة حتى الساعة ١٢:٠٠ ظهراً.", link: "/policies", label: "معلومات الإقامة" },
          { heading: "الجولة الافتراضية", text: "تعرّفوا على دامون من خلال خدمة الجولة الافتراضية. يجري إعداد عرضها عبر الموقع.", link: "/virtual-tour", label: "جولة دامون الافتراضية", note: "صورة تصورية؛ وليست مشهداً من الجولة." },
        ],
      },
      "/rooms": {
        title: "الغرف والأجنحة", intro: "أماكن الإقامة", text: "يضم فندق دامون ٣١ وحدة إقامة: ٢٠ غرفة و١١ جناحاً. تعرض هذه الصفحة فئات الإقامة، ولا تعرض السعة الدقيقة أو التجهيزات أو الأسعار أو التوفر.",
        sections: [
          { heading: "غرفة مفردة", text: "فئة غرفة مفردة؛ يرجى تأكيد السعة الدقيقة والتجهيزات مع الاستقبال.", link: "/rooms/single", label: "التفاصيل", note: "صورة تصورية؛ وليست صورة حقيقية للغرفة." },
          { heading: "غرفة مزدوجة", text: "فئة غرفة مزدوجة؛ يرجى تأكيد السعة الدقيقة والتجهيزات مع الاستقبال.", link: "/rooms/double", label: "التفاصيل", note: "صورة تصورية؛ وليست صورة حقيقية للغرفة." },
          { heading: "جناح", text: "فئة جناح؛ يرجى تأكيد السعة الدقيقة والتجهيزات مع الاستقبال.", link: "/rooms/suite-3-bed", label: "التفاصيل", note: "صورة تصورية؛ وليست صورة حقيقية للغرفة." },
          { heading: "جناح", text: "فئة جناح؛ يرجى تأكيد السعة الدقيقة والتجهيزات مع الاستقبال.", link: "/rooms/suite-4-5-bed", label: "التفاصيل", note: "صورة تصورية؛ وليست صورة حقيقية للغرفة." },
        ],
      },
      "/restaurant": {
        title: "معلومات الطعام لضيوف الفندق", intro: "معلومات الطعام والضيافة", text: "لا يوجد في فندق دامون مطعم أو قاعة مناسبات عاملة. القاعة الكبيرة المخصصة لإفطار الضيوف المجاني قيد التجهيز ولم يبدأ تشغيلها بعد.", actions: [["/rooms", "استعراض أماكن الإقامة"], ["/contact", "التواصل مع الاستقبال"]],
        sections: [
          { heading: "قاعة إفطار الضيوف", text: "القاعة الكبيرة المخصصة لإفطار الضيوف المجاني قيد التجهيز ولم تُفتح بعد. اسألوا الاستقبال عن الخدمات المتاحة في موعد السفر.", link: "/contact", label: "استفسروا من الاستقبال" },
          { heading: "التخطيط للإقامة", text: "استعرضوا فئات الإقامة وتواصلوا مع الاستقبال للتنسيق.", link: "/rooms", label: "استعراض أماكن الإقامة" },
        ],
      },
      "/cafe": {
        title: "الضيافة داخل غرف الضيوف", intro: "خدمة المرطبات داخل الغرفة", text: "لا توجد في فندق دامون مساحة مقهى مستقلة أو أماكن جلوس للمقهى. تُقدّم المرطبات للضيوف داخل غرفهم؛ تواصلوا مع الاستقبال لمعرفة التفاصيل خلال الإقامة.", actions: [["/contact", "التواصل مع الاستقبال"]],
        sections: [{ heading: "خدمة داخل الغرفة", text: "تُقدّم المرطبات لضيوف الفندق داخل غرفهم، ولا توجد مساحة مقهى منفصلة.", link: "/contact", label: "التواصل مع الاستقبال" }],
      },
      "/facilities": {
        title: "مرافق الفندق", intro: "المرافق والخدمات", text: "تواصلوا مع الاستقبال للاستفسار عن الخدمات المتاحة حالياً وساعاتها والمرافق المتوفرة في غرفة معينة.", actions: [["/contact", "معلومات التواصل"]],
        sections: [
          { heading: "الاستقبال والخدمات", text: "اسألوا الاستقبال عن الخدمات المتاحة حالياً وساعات عملها." },
          { heading: "قاعة إفطار الضيوف", text: "القاعة الكبيرة لإفطار الضيوف المجاني قيد التجهيز ولم يبدأ تشغيلها بعد. اسألوا الاستقبال عن الخدمات المتاحة حالياً.", link: "/restaurant", label: "معلومات الطعام والضيافة" },
          { heading: "المرطبات داخل الغرفة", text: "تُقدّم المرطبات للضيوف داخل غرفهم. لا توجد مساحة مقهى مستقلة أو أماكن جلوس للمقهى.", link: "/cafe", label: "خدمة داخل الغرفة" },
          { heading: "مواقف السيارات", text: "تواصلوا مع الاستقبال مسبقاً للاستفسار عن إمكانية توفر مواقف للسيارات وترتيباتها في موعد زيارتكم.", link: "/contact", label: "التواصل مع الاستقبال" },
        ],
      },
      "/gallery": { title: "معرض صور فندق دامون", intro: "معرض الصور", text: "الصور أدناه تصاميم توضيحية ولا تعرض الفندق الحقيقي أو حالته الحالية. ستُستبدل بصور معتمدة عند توفرها.", gallery: true },
      "/about": {
        title: "عن فندق دامون", intro: "عن الفندق", text: "يقع فندق دامون في شهركرد ويضم ٣١ وحدة إقامة: ٢٠ غرفة و١١ جناحاً. تواصلوا مع الاستقبال لتنسيق الإقامة والاستفسار عن خدمات الضيوف.", actions: [["/contact", "التواصل مع الفندق"]],
        sections: [
          { heading: "ضيافة دافئة", text: "تسعى دامون إلى تقديم ضيافة دافئة وودودة وهادئة، ليشعر الضيف بالراحة وكأنه في بيته الثاني طوال مدة إقامته." },
          { heading: "الإقامة في دامون", text: "يعرض الموقع فئات الغرف والأجنحة. اسألوا الاستقبال لتأكيد السعة الدقيقة وتجهيزات الوحدة والأسعار الحالية.", link: "/rooms", label: "استعراض أماكن الإقامة" },
          { heading: "تسجيل الدخول والمغادرة", text: "تسجيل الدخول من الساعة ١٤:٠٠ وتسجيل المغادرة حتى الساعة ١٢:٠٠ ظهراً.", link: "/policies", label: "معلومات الإقامة" },
        ],
      },
      "/contact": {
        title: "التواصل مع فندق دامون", intro: "تواصلوا معنا لتنسيق الإقامة", text: "تواصلوا مع الاستقبال لتنسيق الإقامة أو الاستفسار عن خدمات الضيوف. يقع دامون في شهركرد، شارع 12 محرم الشمالي، ساحة بسيج.",
        sections: [
          { heading: "تنسيق الإقامة", text: "عند الاتصال، اذكروا تاريخي الوصول والمغادرة وعدد الضيوف وفئة الإقامة المطلوبة. يمكن للاستقبال تأكيد السعة والأسعار والتوفر.", link: "/rooms", label: "استعراض أماكن الإقامة" },
          { heading: "عنوان الفندق", text: "يقع فندق دامون في شهركرد، شارع 12 محرم الشمالي، ساحة بسيج. استخدموا زر الخريطة لعرض الاتجاهات." },
        ],
      },
      "/policies": {
        title: "معلومات الإقامة والخصوصية", intro: "معلومات الإقامة والخصوصية", text: "تسجيل الدخول من الساعة ١٤:٠٠ وتسجيل المغادرة حتى الساعة ١٢:٠٠ ظهراً. تواصلوا مع الاستقبال بشأن ترتيبات الإقامة الأخرى.",
        sections: [
          { heading: "تسجيل الدخول والمغادرة", text: "تسجيل الدخول من الساعة ١٤:٠٠ وتسجيل المغادرة حتى الساعة ١٢:٠٠ ظهراً." },
          { heading: "التواريخ والضيوف", text: "اختيار التاريخ وعدد الضيوف على الموقع للتخطيط فقط؛ فهو لا يحجز غرفة ولا يحتفظ بها، كما أن الدفع عبر الإنترنت غير متاح. تواصلوا مع الاستقبال لإتمام الإقامة." },
          { heading: "تنسيق الحجز", text: "تواصلوا مع الاستقبال للاستفسار عن الأسعار والتوفر والتغيير أو الإلغاء والوثائق المطلوبة. أكّدوا المعلومات الخاصة بتواريخ سفركم.", link: "/contact", label: "التواصل مع الاستقبال" },
          { heading: "الخصوصية", text: "يُحفظ مظهر العرض واختيار الألوان في متصفحكم. وتُنقل التواريخ وأعداد الضيوف وأعمار الأطفال المختارة عبر عنوان الصفحة وجلسة المتصفح الحالية. يمكن لمن تشاركون معه الرابط رؤية هذه الاختيارات. في هذه المرحلة، لا يرسل الموقع بيانات الاتصال الشخصية أو المدفوعات." },
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
          { heading: "مواعيد الإقامة", text: "تسجيل الدخول من الساعة ١٤:٠٠ وتسجيل المغادرة حتى الساعة ١٢:٠٠ ظهراً. تواصلوا مع الاستقبال لتأكيد السعة والأسعار والتوفر في تواريخكم.", link: "/policies", label: "معلومات الدخول والمغادرة" },
        { heading: "مرافق الفندق", text: "اسألوا الاستقبال عن المرافق والخدمات المتاحة حالياً في هذه الغرفة وعن ساعات عملها.", link: "/facilities", label: "عرض المرافق" },
      ],
      textSuffix: "اسألوا الاستقبال لتأكيد السعة وتجهيزات الغرفة والأسعار والتوفر في تواريخكم.",
      action: ["/contact", "التواصل للتنسيق"],
      imageNote: "صورة تصورية؛ وليست صورة حقيقية للغرفة.",
    },
    ui: {
      skipToMain: "انتقل إلى المحتوى الرئيسي", mainMenu: "القائمة الرئيسية", mobileMenu: "قائمة الهاتف", appearanceSettings: "إعدادات المظهر", choosePalette: "اختيار لوحة الألوان", contactHotel: "التواصل مع الفندق", openMenu: "فتح القائمة", closeMenu: "إغلاق القائمة", footerLinks: "روابط التذييل", breadcrumb: "مسار الصفحة", detailsMore: "مزيد من التفاصيل", generalHotel: "فندق دامون", additionalInformation: "معلومات إضافية", coordinateWithHotel: "التنسيق مع الفندق", pageNotFound: "الصفحة غير موجودة", pageNotFoundText: "ربما تغير عنوان الصفحة.", backHome: "العودة إلى الرئيسية", reception: "الاستقبال", callReception: "الاتصال بالاستقبال", directions: "عرض الاتجاهات", checkIn: "تسجيل الدخول", checkOut: "تسجيل المغادرة", guests: "الضيوف", room: "غرفة", rooms: "الغرف", restaurant: "معلومات الطعام والضيافة", cafe: "المرطبات داخل الغرفة", facilities: "خدمات الضيوف", gallery: "المعرض", aboutDamoon: "عن دامون", contact: "التواصل", policies: "معلومات الإقامة والخصوصية", virtualTour: "الجولة الافتراضية", conceptImage: "صورة تصورية", conceptGallery: "معرض تصوري", referenceImages: "صور مرجعية", zoomConceptImage: "تكبير الصورة التصورية", closeImageViewer: "إغلاق عارض الصور", previousImage: "الصورة السابقة", nextImage: "الصورة التالية", datePlanningOnly: "اختيار التواريخ للتخطيط والتنسيق فقط؛ أكّدوا الغرفة والسعر والتوفر مع الاستقبال.", stayPlanning: "التخطيط للإقامة", selectStayDates: "اختاروا تواريخ الإقامة", selectArrivalDate: "اختيار تاريخ تسجيل الدخول", selectDepartureDate: "اختيار تاريخ تسجيل المغادرة", selectGuestCount: "عدد الضيوف", guestCount: "{count} ضيوف", bookingSubmit: "المتابعة لتنسيق الإقامة", bookingSummary: "الاختيار الحالي", contactForStay: "تواصلوا معنا لتنسيق هذه الإقامة", calendar: "التقويم", closeCalendar: "إغلاق التقويم", previousMonth: "الشهر السابق", nextMonth: "الشهر التالي", chooseArrivalFirst: "اختاروا أولاً تاريخ تسجيل الدخول.", chooseDepartureNext: "اختاروا الآن تاريخ تسجيل المغادرة.", arrivalCannotBePast: "لا يمكن أن يكون تاريخ الدخول في الماضي.", departureAfterArrival: "يجب أن يكون تاريخ المغادرة بعد تاريخ الدخول.", selectBothDates: "اختاروا أولاً تاريخي الدخول والمغادرة.", noOnlineBooking: "الحجز والدفع عبر الإنترنت غير متاحين.", imageNotActual: "صورة تصورية؛ وليست صورة حقيقية للفندق.", imageNotTour: "صورة تصورية؛ وليست مشهداً من الجولة الافتراضية.", imageCount: "{current} من {total}", colorPalette: "لوحة الألوان", switchToDark: "التبديل إلى المظهر الداكن", switchToLight: "التبديل إلى المظهر الفاتح",
      noscript: "يلزم تفعيل جافاسكريبت لعرض هذه الصفحة.", selectDate: "اختيار التاريخ", guestCountZero: "{count} ضيف", guestCountOne: "{count} ضيف", guestCountTwo: "{count} ضيفان", guestCountFew: "{count} ضيوف", guestCountMany: "{count} ضيفاً", guestCountOther: "{count} ضيف", homeSubtitle: "إقامة مرحّبة في شهركرد", guestComfort: "راحة الضيوف", unitCount: "٣١ وحدة إقامة", unitBreakdown: "٢٠ غرفة · ١١ جناحاً", checkInLabel: "تسجيل الدخول", checkOutLabel: "تسجيل المغادرة", homeLead: "يضم فندق دامون ٣١ وحدة إقامة: ٢٠ غرفة و١١ جناحاً. تواصلوا مع الاستقبال للتخطيط لإقامتكم.", homeShortcuts: "روابط سريعة", roomSpaces: "أماكن الإقامة", restaurantShort: "لوجبة طيبة", tourShort: "استكشفوا المساحات", calmStay: "إقامة هادئة ولحظات طيبة", homeIntro: "يرحب فندق دامون في شهركرد بضيوفه. تواصلوا مع الاستقبال لتنسيق الإقامة.", aboutMore: "المزيد عن الفندق", accommodationSpaces: "أماكن الإقامة", aPlaceToRest: "مكان للراحة", browseRooms: "استعرضوا فئات الإقامة في فندق دامون وتواصلوا معنا لاختيار ما يناسب خططكم.", conceptCaption: "صورة تصورية", viewSpaces: "استعراض المساحات", forYourStay: "لإقامتكم", hotelSpaces: "مساحات الفندق", planYourStay: "خططوا لإقامتكم", contactCoordination: "تواصلوا مع الفندق للتنسيق", footerReception: "الاستقبال", homeEyebrow: "إقامة هادئة في شهركرد", notFound: "الصفحة غير موجودة", notFoundText: "ربما تغير عنوان الصفحة.", paletteNames: { hermes: "كريمي وبرتقالي", forest: "أخضر طبيعي فاتح", wood: "بني خشبي" }, adults: "البالغون", adultsCount: "{count} بالغين", adultsCountOne: "{count} بالغ", adultsCountOther: "{count} بالغين", children: "الأطفال", childAge: "عمر الطفل {index}", childAgeRequired: "أدخل عمراً صالحاً (0-17) لكل طفل.", selectRoom: "اختيار الغرفة", pricePerNight: "لكل ليلة", totalPrice: "الإجمالي", nightsCount: "{count} ليالٍ", nightsCountOne: "{count} ليلة", nightsCountOther: "{count} ليالٍ", guestDetails: "بيانات الضيف", fullName: "الاسم الكامل", phone: "رقم الهاتف", email: "البريد الإلكتروني (اختياري)", policyAcceptance: "لقد قرأت سياسة الإلغاء وأوافق عليها.", policyRequired: "يجب قبول سياسة الإلغاء للمتابعة.", holdRoom: "حجز هذه الغرفة مؤقتاً", holdUnavailable: "خدمة الحجز المؤقت غير متاحة حالياً.", holdCreated: "تم حجز الغرفة مؤقتاً بنجاح.", holdReference: "المرجع", holdExpires: "تنتهي صلاحية الحجز", backToOptions: "العودة إلى الخيارات", invalidContact: "أدخل اسمك الكامل ورقم هاتف صالحاً.", searching: "جارٍ التحقق من التوفر...",
    },
  },
};

export default translations;
