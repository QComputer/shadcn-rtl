"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Room = { id: string; code: string; floor: string | null; isOutOfService: boolean; isActive: boolean };
type Amenity = { id: string; key: string; label: string; isActive?: boolean };
type RoomType = {
  id: string; slug: string; name: string; description: string | null; maxAdults: number;
  maxChildren: number; maxOccupancy: number; beds: unknown; rooms: Room[]; amenities: Amenity[];
  physicalCapacity: { configuredRooms: number; sellableRooms: number | null };
};
type RatePlan = {
  id: string; roomTypeId: string; code: string; name: string; currency: string;
  baseNightlyRate: string; minNights: number | null; maxNights: number | null;
  isRefundable: boolean; validFrom: string | null; validTo: string | null; cancellationPolicyId: string | null;
  nightlyRates: Array<{ id: string; from: string; to: string; nightlyRate: string | null; minNights: number | null; maxNights: number | null }>;
};
type CancellationPolicy = { id: string; key: string; name: string; freeCancellationCutoffHours: number; fullCancellationRetention: number; isActive: boolean; version: number };
type InventoryNight = {
  id: string; roomTypeId: string; date: string; allotment: number; booked: number;
  held: number; outOfService: number; available: number | null; closedToArrival: boolean; closedToDeparture: boolean;
};
type RoomBoard = {
  dates: string[];
  rooms: Array<{ id: string; code: string; roomTypeId: string; isOutOfService: boolean; nights: Array<{ date: string; status: "VACANT" | "OUT_OF_SERVICE" | "RESERVED" | "OCCUPIED" | "OUT_OF_SERVICE_CONFLICT" | "MAINTENANCE" | "MAINTENANCE_CONFLICT"; reference: string | null }> }>;
  unassignedReservationNights: number;
};
type MaintenanceBlock = { id: string; roomId: string; roomCode: string; from: string; to: string; reason: string };
type OperationsData = {
  property: { id: string; name: string; slug: string; timezone: string; currency: string };
  range: { from: string; to: string; nights: number };
  roomTypes: RoomType[];
  amenities: Amenity[];
  ratePlans: RatePlan[];
  inventory: InventoryNight[];
  maintenanceStatus: { state: "AVAILABLE" } | { state: "UNAVAILABLE"; code: "HOTEL_MAINTENANCE_SCHEMA_NOT_READY" };
  roomBoard: RoomBoard | null;
  maintenanceBlocks: MaintenanceBlock[] | null;
  manualRoomManagementEnabled: boolean;
  cancellationPolicies: CancellationPolicy[];
};
type AvailabilityPreview = {
  inventoryReserved: false;
  nights: string[];
  options: Array<{
    roomType: { id: string; name: string; capacity: { maxAdults: number; maxChildren: number; maxOccupancy: number } };
    ratePlan: { id: string; name: string; currency: string };
    nights: string[];
    nightlyRates: string[];
    totalRate: string;
    availableRoomCount: number;
    isAvailable: boolean;
    unavailableNights: Array<{ date: string; reason: string }>;
  }>;
  rejected: Array<{ roomTypeId: string; reason: string }>;
};

const labels = {
  fa: {
    title: "عملیات هتل", maintenanceUnavailable: "داده تعمیرات قابل بررسی نیست؛ ظرفیت فروش و تخصیص اتاق غیرفعال است تا طرح‌واره تعمیرات آماده شود.", availabilityUnknown: "نامشخص",
    loading: "در حال بارگذاری…", loadError: "اطلاعات عملیات بارگذاری نشد.", saveError: "ذخیره انجام نشد.",
    roomTypes: "انواع اتاق", rooms: "اتاق‌های فیزیکی", roomBoard: "وضعیت روزانه اتاق‌ها", boardDate: "تاریخ", boardRoom: "اتاق", vacant: "خالی", reserved: "رزروشده", occupied: "اشغال‌شده", unassigned: "شب رزرو بدون تخصیص اتاق فیزیکی", outOfServiceNote: "علامت خارج از سرویس برای همه تاریخ‌های نمایش‌داده‌شده اعمال می‌شود.", outOfServiceConflict: "تخصیص فعال با علامت خارج از سرویس", maintenance: "تعمیرات زمان‌بندی‌شده", maintenanceConflict: "تعمیرات با رزرو فعال تداخل دارد", maintenanceInvalid: "تاریخ پایان باید بعد از تاریخ شروع باشد و دلیل تعمیرات را وارد کنید.", maintenanceFrom: "شروع (شامل)", maintenanceTo: "پایان (غیرشامل)", maintenanceReason: "دلیل تعمیرات", createMaintenance: "ثبت تعمیرات", releaseMaintenance: "پایان تعمیرات", maintenanceGateClosed: "ثبت و پایان تعمیرات تا تأیید بهره‌برداری غیرفعال است.", rates: "نرخ‌ها", inventory: "ظرفیت شبانه",
    add: "افزودن", save: "ذخیره", update: "ذخیره تغییرات", cancel: "لغو ویرایش", edit: "ویرایش",
    slug: "شناسه نوع اتاق", name: "نام", description: "توضیحات", adults: "بزرگسالان", children: "کودکان", occupancy: "ظرفیت کل", beds: "تخت", bedKind: "نوع تخت", bedCount: "تعداد", bedKinds: { single: "یک‌نفره", double: "دو‌نفره", queen: "کوئین", king: "کینگ", sofa: "مبل تخت‌خواب‌شو", bunk: "دوطبقه", crib: "تخت کودک" }, amenities: "امکانات تأییدشده", amenityKey: "شناسه امکان", amenityLabel: "نام امکان", addAmenity: "افزودن امکان", saveAmenities: "ذخیره امکانات نوع اتاق", noAmenities: "امکانی ثبت نشده است؛ فقط موارد تأییدشده هتل را اضافه کنید.",
    roomType: "نوع اتاق", code: "کد اتاق", floor: "طبقه", unavailable: "خارج از سرویس", active: "فعال", room: "اتاق",
    planCode: "کد طرح نرخ", planName: "نام طرح", baseRate: "نرخ پایه (تومان)", createPlan: "ایجاد طرح نرخ", editPlan: "ویرایش طرح نرخ", updatePlan: "ذخیره نرخ طرح", planValidity: "اعتبار طرح",
    policies: "قوانین لغو", policyKey: "شناسه قانون لغو", policyName: "نام قانون لغو", cutoff: "مهلت لغو رایگان (ساعت)", retention: "میزان کسر در لغو دیرهنگام (۰ تا ۱)", createPolicy: "ثبت قانون لغو", selectPolicy: "قانون لغو را انتخاب کنید", noPolicy: "قانون لغو تنظیم نشده؛ نرخ به مسیر رزرو مهمان متصل نمی‌شود.", inactivePolicy: "غیرفعال", policyRequired: "برای قابل رزرو شدن نرخ، یک قانون لغو فعال ایجاد و به طرح نرخ متصل کنید.",
    from: "از (شامل)", to: "تا (غیرشامل)", nightlyRate: "نرخ شبانه (تومان)", saveNightly: "ذخیره نرخ این بازه",
    date: "تاریخ شب", allotment: "ظرفیت کل", allotmentDelta: "تغییر ظرفیت", outDelta: "تغییر خارج از سرویس", reason: "دلیل ثبت", initialize: "ساخت شب‌های ظرفیتِ موجودنیست", adjust: "ثبت تغییر ظرفیت", refresh: "بارگذاری دوباره",
    available: "قابل فروش", booked: "رزروشده", held: "در انتظار", oos: "خارج از سرویس", none: "رکوردی موجود نیست.", errorPrefix: "خطا:", saved: "تغییر ذخیره شد.", range: "بازه نمایش", load: "نمایش بازه",
    bedsError: "تخت را انتخاب کنید و تعداد معتبر وارد کنید.", deltasError: "حداقل یک تغییر ظرفیت یا خارج از سرویس وارد کنید.",
    setupIncomplete: "این پیش‌نمایش فقط با داده‌های تأییدشده مدیر قابل رزرو است؛ نمونه یا نرخ و ظرفیت فرضی جایگزین نمی‌شود.", noRoomsConfigured: "هنوز نوع اتاقی پیکربندی نشده است.", noRateConfigured: "برای این نوع اتاق طرح نرخ فعالی ثبت نشده است.", noInventoryConfigured: "برای بخشی از بازه، ظرفیت شبانه ثبت نشده است؛ آن شب‌ها قابل رزرو نیستند.",
    previewTitle: "پیش‌نمایش مهمان (فقط مالک)", previewButton: "بررسی موجودی و قیمت", previewDemo: "پیش‌نمایش داده‌های نمایشی و پیکربندی فعلی است؛ نرخ، ظرفیت و سیاست‌ها تا زمان تأیید مالک هتل اطلاعات قطعی نیستند.", previewNoMutation: "این بررسی فقط‌خواندنی است و هیچ رزرو، نگهداشت اتاق، پرداخت یا تغییری در موجودی ایجاد نمی‌کند.", previewPublicGate: "نمایش عمومی و رزرو مهمان همچنان به انتشار و تأییدهای عمومی نیاز دارد.", previewOccupancy: "تعداد مهمانان", previewAdults: "بزرگسالان", previewChildren: "کودکان", previewChildAge: "سن کودک", previewResult: "نتیجه برای پیکربندی فعلی", previewUnavailable: "برای این اقامت قابل فروش نیست", previewOutOfService: "اتاق‌های فعال این نوع برای شب‌های مشخص‌شده خارج از سرویس هستند.", previewFullCapacity: "ظرفیت قابل فروش در یکی از شب‌های اقامت تکمیل شده است.", previewNoRooms: "برای این بازه گزینه‌ای با اتاق، نرخ و موجودی کامل پیکربندی‌شده پیدا نشد.", previewMissingRooms: "برای نمایش اتاق، ابتدا نوع اتاق و ظرفیت فیزیکی را پیکربندی کنید.", previewNoPhysicalRooms: "برای این نوع اتاق، اتاق فیزیکی فعال و خارج از سرویس نبودن پیکربندی نشده است.", previewMissingRates: "برای اتاق پیکربندی‌شده نرخ فعال برای همه شب‌ها ثبت نشده است.", previewRateGap: "هیچ نرخ تأییدشده‌ای تمام شب‌های انتخابی را پوشش نمی‌دهد.", previewMissingInventory: "برای اتاق پیکربندی‌شده موجودی همه شب‌ها ثبت نشده است.", previewOccupancyMismatch: "ظرفیت اتاق با تعداد مهمانان انتخاب‌شده سازگار نیست.", previewInvalidDates: "تاریخ خروج باید بعد از ورود باشد و اقامت نمی‌تواند بیش از ۳۱ شب باشد.", previewFailed: "پیش‌نمایش بارگذاری نشد؛ پس از بررسی تاریخ و ظرفیت دوباره تلاش کنید.", previewPerNight: "نرخ هر شب", previewTotal: "مجموع اقامت", previewAvailableRooms: "اتاق قابل فروش در تمام شب‌ها", previewCapacity: "ظرفیت", previewRetry: "تلاش دوباره", previewDates: "تاریخ اقامت از بازه بالا استفاده می‌کند.",
  },
  en: {
    title: "Hotel operations", maintenanceUnavailable: "Maintenance data cannot be verified. Sellable availability and room assignment are unavailable until the maintenance schema is ready.", availabilityUnknown: "Unknown",
    loading: "Loading…", loadError: "Could not load operations.", saveError: "Save failed.",
    roomTypes: "Room types", rooms: "Physical rooms", roomBoard: "Daily room board", boardDate: "Date", boardRoom: "Room", vacant: "Vacant", reserved: "Reserved", occupied: "Occupied", unassigned: "Reservation nights without a physical room assignment", outOfServiceNote: "The out-of-service flag applies to every displayed date.", outOfServiceConflict: "Active allocation conflicts with out-of-service flag", maintenance: "Scheduled maintenance", maintenanceConflict: "Maintenance conflicts with an active reservation", maintenanceInvalid: "End date must be after the start date, and a reason is required.", maintenanceFrom: "Start (inclusive)", maintenanceTo: "End (exclusive)", maintenanceReason: "Maintenance reason", createMaintenance: "Schedule maintenance", releaseMaintenance: "Release maintenance", maintenanceGateClosed: "Maintenance changes are disabled until operations are approved.", rates: "Rates", inventory: "Nightly inventory",
    add: "Add", save: "Save", update: "Save changes", cancel: "Cancel edit", edit: "Edit",
    slug: "Room type slug", name: "Name", description: "Description", adults: "Adults", children: "Children", occupancy: "Max occupancy", beds: "Bed", bedKind: "Bed type", bedCount: "Count", bedKinds: { single: "Single", double: "Double", queen: "Queen", king: "King", sofa: "Sofa bed", bunk: "Bunk", crib: "Crib" }, amenities: "Verified amenities", amenityKey: "Amenity key", amenityLabel: "Amenity name", addAmenity: "Add amenity", saveAmenities: "Save room type amenities", noAmenities: "No amenities are listed. Add only hotel-confirmed amenities.",
    roomType: "Room type", code: "Room code", floor: "Floor", unavailable: "Out of service", active: "Active", room: "Room",
    planCode: "Rate plan code", planName: "Rate plan name", baseRate: "Base nightly rate (Toman)", createPlan: "Create rate plan", editPlan: "Edit rate plan", updatePlan: "Save rate plan", planValidity: "Plan validity",
    policies: "Cancellation policies", policyKey: "Cancellation policy key", policyName: "Cancellation policy name", cutoff: "Free cancellation cutoff (hours)", retention: "Late cancellation retention (0 to 1)", createPolicy: "Create cancellation policy", selectPolicy: "Select a cancellation policy", noPolicy: "No cancellation policy is configured; this rate cannot be used in the guest reservation flow.", inactivePolicy: "Inactive", policyRequired: "Create and attach an active cancellation policy before this rate can be reserved by guests.",
    from: "From (inclusive)", to: "To (exclusive)", nightlyRate: "Nightly rate (Toman)", saveNightly: "Save nightly-rate range",
    date: "Night date", allotment: "Allotment", allotmentDelta: "Allotment change", outDelta: "Out-of-service change", reason: "Reason", initialize: "Initialize missing nights", adjust: "Save inventory adjustment", refresh: "Reload",
    available: "Available", booked: "Booked", held: "Held", oos: "Out of service", none: "No records yet.", errorPrefix: "Error:", saved: "Changes saved.", range: "Date range", load: "Load range",
    bedsError: "Choose a bed type and enter a valid count.", deltasError: "Enter a non-zero allotment or out-of-service change.",
    setupIncomplete: "This preview uses manager-confirmed data only; no sample price or assumed inventory is substituted.", noRoomsConfigured: "No room type has been configured yet.", noRateConfigured: "This room type has no active rate plan.", noInventoryConfigured: "Nightly inventory is missing for part of the selected range; those nights cannot be reserved.",
    previewTitle: "Guest availability preview (owner only)", previewButton: "Check availability and rates", previewDemo: "This preview uses current demo/configuration data. Rates, capacity, and policies are not confirmed hotel information until the owner approves them.", previewNoMutation: "Read-only: this check creates no reservation, room hold, payment, or inventory change.", previewPublicGate: "Public display and guest booking still require publication and their normal approvals.", previewOccupancy: "Guests", previewAdults: "Adults", previewChildren: "Children", previewChildAge: "Child age", previewResult: "Result for current configuration", previewUnavailable: "Not sellable for this stay", previewOutOfService: "All active physical rooms of this type are out of service for the listed nights.", previewFullCapacity: "Sellable capacity is exhausted for at least one night of this stay.", previewNoRooms: "No option has a complete configured room, rate, and inventory for this stay.", previewMissingRooms: "Configure room types before guest rooms can be previewed.", previewNoPhysicalRooms: "No active, in-service physical room is configured for this room type.", previewMissingRates: "No active rate plan exists for this room type.", previewRateGap: "No confirmed rate covers every selected night.", previewMissingInventory: "Nightly inventory is missing for one or more nights.", previewOccupancyMismatch: "The selected guest count exceeds this room type's capacity.", previewInvalidDates: "Check-out must be after check-in; a stay can be at most 31 nights.", previewFailed: "Could not load the preview. Check the dates and occupancy, then retry.", previewPerNight: "Nightly rates", previewTotal: "Stay total", previewAvailableRooms: "Rooms sellable across all nights", previewCapacity: "Capacity", previewRetry: "Retry preview", previewDates: "Stay dates use the range above.",
  },
  ar: {
    title: "عمليات الفندق", maintenanceUnavailable: "تعذر التحقق من بيانات الصيانة. التوفر القابل للبيع وتخصيص الغرف غير متاحين حتى تصبح بنية الصيانة جاهزة.", availabilityUnknown: "غير معروف",
    loading: "جارٍ التحميل…", loadError: "تعذر تحميل العمليات.", saveError: "تعذر الحفظ.",
    roomTypes: "أنواع الغرف", rooms: "الغرف الفعلية", roomBoard: "حالة الغرف اليومية", boardDate: "التاريخ", boardRoom: "الغرفة", vacant: "شاغرة", reserved: "محجوزة", occupied: "مشغولة", unassigned: "ليالي حجز بلا تخصيص غرفة فعلية", outOfServiceNote: "تُطبّق علامة خارج الخدمة على جميع التواريخ المعروضة.", outOfServiceConflict: "تخصيص نشط يتعارض مع علامة خارج الخدمة", maintenance: "الصيانة المجدولة", maintenanceConflict: "تتعارض الصيانة مع حجز نشط", maintenanceInvalid: "يجب أن يكون تاريخ النهاية بعد البداية وإدخال سبب الصيانة.", maintenanceFrom: "البداية (شاملة)", maintenanceTo: "النهاية (غير شاملة)", maintenanceReason: "سبب الصيانة", createMaintenance: "جدولة الصيانة", releaseMaintenance: "إنهاء الصيانة", maintenanceGateClosed: "تغييرات الصيانة معطلة حتى اعتماد التشغيل.", rates: "الأسعار", inventory: "مخزون الليالي",
    add: "إضافة", save: "حفظ", update: "حفظ التغييرات", cancel: "إلغاء التعديل", edit: "تعديل",
    slug: "معرّف نوع الغرفة", name: "الاسم", description: "الوصف", adults: "البالغون", children: "الأطفال", occupancy: "السعة القصوى", beds: "السرير", bedKind: "نوع السرير", bedCount: "العدد", bedKinds: { single: "مفرد", double: "مزدوج", queen: "كوين", king: "كينغ", sofa: "سرير أريكة", bunk: "طابقي", crib: "سرير أطفال" }, amenities: "المرافق المؤكدة", amenityKey: "معرّف المرفق", amenityLabel: "اسم المرفق", addAmenity: "إضافة مرفق", saveAmenities: "حفظ مرافق نوع الغرفة", noAmenities: "لا توجد مرافق مسجلة؛ أضف المرافق المؤكدة للفندق فقط.",
    roomType: "نوع الغرفة", code: "رمز الغرفة", floor: "الطابق", unavailable: "خارج الخدمة", active: "نشطة", room: "غرفة",
    planCode: "رمز خطة السعر", planName: "اسم الخطة", baseRate: "السعر الأساسي لليلة (تومان)", createPlan: "إنشاء خطة سعر", editPlan: "تعديل خطة السعر", updatePlan: "حفظ خطة السعر", planValidity: "صلاحية الخطة",
    policies: "سياسات الإلغاء", policyKey: "معرّف سياسة الإلغاء", policyName: "اسم سياسة الإلغاء", cutoff: "مهلة الإلغاء المجاني (ساعات)", retention: "الاقتطاع عند الإلغاء المتأخر (من ٠ إلى ١)", createPolicy: "إنشاء سياسة إلغاء", selectPolicy: "اختر سياسة إلغاء", noPolicy: "لم يتم إعداد سياسة إلغاء؛ لا يمكن استخدام هذا السعر في مسار حجز الضيوف.", inactivePolicy: "غير نشطة", policyRequired: "أنشئ سياسة إلغاء نشطة واربطها بخطة السعر قبل أن يتمكن الضيف من الحجز.",
    from: "من (شامل)", to: "إلى (غير شامل)", nightlyRate: "سعر الليلة (تومان)", saveNightly: "حفظ أسعار الفترة",
    date: "تاريخ الليلة", allotment: "السعة", allotmentDelta: "تغيير السعة", outDelta: "تغيير خارج الخدمة", reason: "سبب التغيير", initialize: "إنشاء الليالي المفقودة", adjust: "حفظ تعديل المخزون", refresh: "إعادة التحميل",
    available: "متاح", booked: "محجوز", held: "معلّق", oos: "خارج الخدمة", none: "لا توجد سجلات.", errorPrefix: "خطأ:", saved: "تم حفظ التغييرات.", range: "الفترة", load: "عرض الفترة",
    bedsError: "اختر نوع السرير وأدخل عددًا صالحًا.", deltasError: "أدخل تغييرًا غير صفري في السعة أو خارج الخدمة.",
    setupIncomplete: "تستخدم هذه المعاينة البيانات التي أكدها المدير فقط؛ لا يتم استبدال الأسعار أو السعة ببيانات افتراضية.", noRoomsConfigured: "لم يتم إعداد أي نوع غرفة بعد.", noRateConfigured: "لا توجد خطة أسعار فعالة لهذا النوع من الغرف.", noInventoryConfigured: "المخزون الليلي مفقود لبعض الفترة المحددة؛ لا يمكن حجز تلك الليالي.",
    previewTitle: "معاينة توفر الضيوف (للمالك فقط)", previewButton: "فحص التوفر والأسعار", previewDemo: "تستخدم هذه المعاينة بيانات العرض والإعدادات الحالية. الأسعار والسعة والسياسات ليست معلومات مؤكدة حتى يعتمدها مالك الفندق.", previewNoMutation: "للقراءة فقط: لا تنشئ هذه المعاينة حجزًا أو تعليق غرفة أو دفعة أو تغييرًا في المخزون.", previewPublicGate: "يظل العرض العام وحجز الضيوف بحاجة إلى النشر والموافقات المعتادة.", previewOccupancy: "عدد الضيوف", previewAdults: "البالغون", previewChildren: "الأطفال", previewChildAge: "عمر الطفل", previewResult: "النتيجة وفق الإعدادات الحالية", previewUnavailable: "غير قابل للبيع خلال هذه الإقامة", previewOutOfService: "الغرف الفعلية النشطة من هذا النوع خارج الخدمة في الليالي المحددة.", previewFullCapacity: "اكتملت السعة القابلة للبيع في ليلة واحدة على الأقل من الإقامة.", previewNoRooms: "لم يتم العثور على خيار يحتوي على غرفة وسعر ومخزون مكتمل لكل ليالي الإقامة.", previewMissingRooms: "أعدّ أنواع الغرف قبل معاينة الغرف للضيف.", previewNoPhysicalRooms: "لا توجد غرفة فعلية نشطة وخارج الخدمة لهذا النوع.", previewMissingRates: "لا توجد خطة سعر فعالة لنوع الغرفة.", previewRateGap: "لا يوجد سعر مؤكد يغطي جميع الليالي المحددة.", previewMissingInventory: "مخزون الليالي غير متوفر لليلة واحدة أو أكثر.", previewOccupancyMismatch: "عدد الضيوف المحدد يتجاوز سعة نوع الغرفة.", previewInvalidDates: "يجب أن يكون تسجيل المغادرة بعد الوصول وألا تتجاوز الإقامة ٣١ ليلة.", previewFailed: "تعذر تحميل المعاينة. تحقق من التواريخ وعدد الضيوف ثم أعد المحاولة.", previewPerNight: "أسعار الليالي", previewTotal: "إجمالي الإقامة", previewAvailableRooms: "الغرف المتاحة للبيع طوال الليالي", previewCapacity: "السعة", previewRetry: "إعادة المحاولة", previewDates: "تستخدم تواريخ الإقامة الفترة أعلاه.",
  },
} as const;

function dateInTimezone(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function addDays(date: string, count: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + count);
  return value.toISOString().slice(0, 10);
}
function idempotencyKey() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function HotelOperationsWorkspace({ organizationId, propertyId, propertyName, propertyTimezone, locale, canPreviewAvailability }: {
  organizationId: string; propertyId: string; propertyName: string; propertyTimezone: string; locale: string; canPreviewAvailability: boolean;
}) {
  const text = labels[locale as keyof typeof labels] ?? labels.fa;
  const baseUrl = useMemo(() => `/api/organizations/${encodeURIComponent(organizationId)}/hotels/${encodeURIComponent(propertyId)}`, [organizationId, propertyId]);
  const initialFrom = useMemo(() => dateInTimezone(propertyTimezone), [propertyTimezone]);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(() => addDays(initialFrom, 7));
  const [data, setData] = useState<OperationsData | null>(null);
  const [dataRange, setDataRange] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState<AvailabilityPreview | null>(null);
  const [previewSignature, setPreviewSignature] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewAdults, setPreviewAdults] = useState("2");
  const [previewChildAges, setPreviewChildAges] = useState<string[]>([]);
  const previewRequest = useRef<AbortController | null>(null);
  const previewSequence = useRef(0);
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [typeSlug, setTypeSlug] = useState("");
  const [typeName, setTypeName] = useState("");
  const [typeDescription, setTypeDescription] = useState("");
  const [typeAdults, setTypeAdults] = useState("2");
  const [typeChildren, setTypeChildren] = useState("0");
  const [typeOccupancy, setTypeOccupancy] = useState("2");
  const [typeBedKind, setTypeBedKind] = useState("queen");
  const [typeBedCount, setTypeBedCount] = useState("1");
  const [preservedBeds, setPreservedBeds] = useState<Array<Record<string, unknown>>>([]);
  const [selectedAmenityIds, setSelectedAmenityIds] = useState<string[]>([]);
  const [amenityKey, setAmenityKey] = useState("");
  const [amenityLabel, setAmenityLabel] = useState("");
  const [roomTypeId, setRoomTypeId] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [roomFloor, setRoomFloor] = useState("");
  const [roomUnavailable, setRoomUnavailable] = useState(false);
  const [roomActive, setRoomActive] = useState(true);
  const [planTypeId, setPlanTypeId] = useState("");
  const [editingRatePlanId, setEditingRatePlanId] = useState<string | null>(null);
  const [planCode, setPlanCode] = useState("");
  const [planName, setPlanName] = useState("");
  const [baseRate, setBaseRate] = useState("");
  const [ratePolicyId, setRatePolicyId] = useState("");
  const [policyKey, setPolicyKey] = useState("");
  const [policyName, setPolicyName] = useState("");
  const [policyCutoff, setPolicyCutoff] = useState("48");
  const [policyRetention, setPolicyRetention] = useState("0");
  const [ratePlanId, setRatePlanId] = useState("");
  const [rateFrom, setRateFrom] = useState(initialFrom);
  const [rateTo, setRateTo] = useState(() => addDays(initialFrom, 1));
  const [nightlyRate, setNightlyRate] = useState("");
  const [inventoryTypeId, setInventoryTypeId] = useState("");
  const [inventoryDate, setInventoryDate] = useState(initialFrom);
  const [allotment, setAllotment] = useState("1");
  const [inventoryFrom, setInventoryFrom] = useState(initialFrom);
  const [inventoryTo, setInventoryTo] = useState(() => addDays(initialFrom, 7));
  const [allotmentDelta, setAllotmentDelta] = useState("0");
  const [outDelta, setOutDelta] = useState("0");
  const [reason, setReason] = useState("");
  const [maintenanceRoomId, setMaintenanceRoomId] = useState("");
  const [maintenanceFrom, setMaintenanceFrom] = useState(initialFrom);
  const [maintenanceTo, setMaintenanceTo] = useState(() => addDays(initialFrom, 1));
  const [maintenanceReason, setMaintenanceReason] = useState("");
  const pendingIdempotency = useRef<{ signature: string; key: string } | null>(null);
  const rangeKey = `${from}|${to}`;
  const previewNightCount = (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86_400_000;
  const previewDatesValid = /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) && Number.isInteger(previewNightCount) && previewNightCount >= 1 && previewNightCount <= 31;
  const currentPreviewSignature = `${from}|${to}|${previewAdults}|${previewChildAges.join(",")}`;
  const activePreview = previewSignature === currentPreviewSignature ? preview : null;
  const activeData = dataRange === rangeKey ? data : null;
  const isLoading = loading || (dataRange !== rangeKey && !error);
  const roomTypesWithoutRates = activeData?.roomTypes.filter((room) => !activeData.ratePlans.some((plan) => plan.roomTypeId === room.id)) ?? [];
  const roomTypesWithoutFullInventory = activeData?.roomTypes.filter((room) => activeData.inventory.filter((night) => night.roomTypeId === room.id).length < activeData.range.nights) ?? [];
  const roomTypesWithoutSellablePhysicalRooms = activeData?.roomTypes.filter((room) => room.physicalCapacity.configuredRooms > 0 && room.physicalCapacity.sellableRooms === 0) ?? [];

  useEffect(() => () => { previewSequence.current += 1; previewRequest.current?.abort(); }, []);

  const load = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(`${baseUrl}/operations?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { cache: "no-store", credentials: "same-origin", signal });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.error || text.loadError);
    if (!signal?.aborted) {
      setData(body as OperationsData);
      setDataRange(`${from}|${to}`);
      setError("");
      setRoomTypeId((current) => current || (body.roomTypes[0]?.id ?? ""));
      setPlanTypeId((current) => current || (body.roomTypes[0]?.id ?? ""));
      setInventoryTypeId((current) => current || (body.roomTypes[0]?.id ?? ""));
      setRatePlanId((current) => current || (body.ratePlans[0]?.id ?? ""));
    }
  }, [baseUrl, from, text.loadError, to]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => load(controller.signal)).catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : text.loadError); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [load, text.loadError]);

  async function reload() {
    setLoading(true);
    setDataRange(null);
    setError("");
    try { await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : text.loadError); }
    finally { setLoading(false); }
  }

  async function loadAvailabilityPreview() {
    previewRequest.current?.abort();
    const controller = new AbortController();
    previewRequest.current = controller;
    const sequence = ++previewSequence.current;
    setPreviewLoading(true);
    setPreviewError("");
    setPreview(null);
    setPreviewSignature(null);
    try {
      const query = new URLSearchParams({ checkIn: from, checkOut: to, adults: previewAdults, children: String(previewChildAges.length), childAges: previewChildAges.join(",") });
      const response = await fetch(`${baseUrl}/availability-preview?${query}`, { cache: "no-store", credentials: "same-origin", signal: controller.signal });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || text.previewFailed);
      if (!controller.signal.aborted && sequence === previewSequence.current) {
        setPreview(body as AvailabilityPreview);
        setPreviewSignature(`${from}|${to}|${previewAdults}|${previewChildAges.join(",")}`);
      }
    } catch (cause) {
      if (!controller.signal.aborted && sequence === previewSequence.current) {
        setPreview(null);
        setPreviewError(cause instanceof Error && cause.message !== "Unauthorized" ? cause.message : text.previewFailed);
      }
    } finally {
      if (sequence === previewSequence.current) setPreviewLoading(false);
    }
  }

  async function mutate(path: string, method: string, payload: unknown, idempotent = false) {
    setError(""); setNotice(""); setBusy(true);
    try {
      const signature = JSON.stringify([baseUrl, path, payload]);
      if (idempotent && pendingIdempotency.current?.signature !== signature) {
        pendingIdempotency.current = { signature, key: idempotencyKey() };
      }
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        credentials: "same-origin",
        headers: { "content-type": "application/json", ...(idempotent ? { "idempotency-key": pendingIdempotency.current!.key } : {}) },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error === "ROOM_MAINTENANCE_CONFLICT" ? text.maintenanceConflict : body?.error || text.saveError);
      setDataRange(null);
      await load();
      if (idempotent) pendingIdempotency.current = null;
      setNotice(text.saved);
      return body;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : text.saveError);
      return null;
    } finally { setBusy(false); }
  }

  function startTypeEdit(item: RoomType) {
    setEditingTypeId(item.id); setTypeSlug(item.slug); setTypeName(item.name); setTypeDescription(item.description ?? "");
    setTypeAdults(String(item.maxAdults)); setTypeChildren(String(item.maxChildren)); setTypeOccupancy(String(item.maxOccupancy));
    const beds = Array.isArray(item.beds) ? item.beds.filter((bed): bed is Record<string, unknown> => Boolean(bed) && typeof bed === "object") : [];
    const first = beds[0];
    setTypeBedKind(typeof first?.kind === "string" ? first.kind : "queen");
    setTypeBedCount(String(typeof first?.count === "number" ? first.count : 1));
    setPreservedBeds(beds.slice(1));
    setSelectedAmenityIds(item.amenities.map((amenity) => amenity.id));
  }
  function resetTypeForm() {
    setEditingTypeId(null); setTypeSlug(""); setTypeName(""); setTypeDescription(""); setTypeAdults("2"); setTypeChildren("0"); setTypeOccupancy("2"); setTypeBedKind("queen"); setTypeBedCount("1"); setPreservedBeds([]); setSelectedAmenityIds([]);
  }
  async function saveType(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const count = Number(typeBedCount);
    if (!Number.isInteger(count) || count < 1) { setError(text.bedsError); return; }
    const currentBeds = activeData?.roomTypes.find((item) => item.id === editingTypeId)?.beds;
    const previous = Array.isArray(currentBeds) ? currentBeds.filter((bed): bed is Record<string, unknown> => Boolean(bed) && typeof bed === "object") : [];
    const beds = [{ ...(previous[0] ?? {}), kind: typeBedKind, count }, ...preservedBeds];
    const payload = { name: typeName, description: typeDescription, maxAdults: Number(typeAdults), maxChildren: Number(typeChildren), maxOccupancy: Number(typeOccupancy), beds };
    const result = await mutate(`/room-types${editingTypeId ? `/${encodeURIComponent(editingTypeId)}` : ""}`, editingTypeId ? "PATCH" : "POST", editingTypeId ? payload : { ...payload, slug: typeSlug });
    const roomTypeId = editingTypeId ?? result?.roomType?.id;
    if (result && roomTypeId) {
      setEditingTypeId(roomTypeId);
      const linked = await mutate(`/room-types/${encodeURIComponent(roomTypeId)}/amenities`, "PUT", { amenityIds: selectedAmenityIds });
      if (linked) resetTypeForm();
    }
  }
  async function createAmenity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await mutate("/amenities", "POST", { key: amenityKey, label: amenityLabel });
    if (result?.amenity?.id) {
      setSelectedAmenityIds((ids) => ids.includes(result.amenity.id) ? ids : [...ids, result.amenity.id]);
      setAmenityKey("");
      setAmenityLabel("");
    }
  }
  function startRoomEdit(room: Room, parentRoomTypeId: string) {
    setEditingRoomId(room.id); setRoomTypeId(parentRoomTypeId); setRoomCode(room.code); setRoomFloor(room.floor ?? ""); setRoomUnavailable(room.isOutOfService); setRoomActive(room.isActive);
  }
  function resetRoomForm() { setEditingRoomId(null); setRoomCode(""); setRoomFloor(""); setRoomUnavailable(false); setRoomActive(true); }
  async function saveRoom(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = { roomTypeId, code: roomCode, floor: roomFloor || null, isOutOfService: roomUnavailable, ...(editingRoomId ? { isActive: roomActive } : {}) };
    const result = await mutate(`/rooms${editingRoomId ? `/${encodeURIComponent(editingRoomId)}` : ""}`, editingRoomId ? "PATCH" : "POST", payload);
    if (result) resetRoomForm();
  }
  async function createMaintenance(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!maintenanceRoomId || maintenanceTo <= maintenanceFrom || !maintenanceReason.trim()) {
      setError(text.maintenanceInvalid);
      return;
    }
    const result = await mutate("/maintenance", "POST", { roomId: maintenanceRoomId, from: maintenanceFrom, to: maintenanceTo, reason: maintenanceReason.trim(), idempotencyKey: idempotencyKey() });
    if (result) setMaintenanceReason("");
  }
  async function releaseMaintenance(blockId: string) {
    await mutate(`/maintenance/${encodeURIComponent(blockId)}/release`, "POST", {});
  }
  async function createRatePlan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const path = editingRatePlanId ? `/rate-plans/${encodeURIComponent(editingRatePlanId)}` : "/rate-plans";
    const payload = {
      ...(editingRatePlanId ? {} : { roomTypeId: planTypeId }),
      code: planCode,
      name: planName,
      baseNightlyRate: baseRate,
      ...(ratePolicyId ? { cancellationPolicyId: ratePolicyId } : {}),
    };
    const result = await mutate(path, editingRatePlanId ? "PATCH" : "POST", payload);
    if (result?.ratePlan?.id) setRatePlanId(result.ratePlan.id);
    if (result) resetRatePlanForm();
  }
  function startRatePlanEdit(plan: RatePlan) {
    setEditingRatePlanId(plan.id);
    setPlanTypeId(plan.roomTypeId);
    setPlanCode(plan.code);
    setPlanName(plan.name);
    setBaseRate(plan.baseNightlyRate);
    setRatePolicyId(plan.cancellationPolicyId ?? "");
  }
  function resetRatePlanForm() {
    setEditingRatePlanId(null);
    setPlanCode("");
    setPlanName("");
    setBaseRate("");
    setRatePolicyId("");
  }
  async function createCancellationPolicy(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const retention = Number(policyRetention);
    if (!Number.isFinite(retention) || retention < 0 || retention > 1) { setError(text.saveError); return; }
    const result = await mutate("/cancellation-policies", "POST", { key: policyKey, name: policyName, freeCancellationCutoffHours: Number(policyCutoff), fullCancellationRetention: retention });
    if (result?.policy?.id) setRatePolicyId(result.policy.id);
  }
  async function saveNightlyRate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await mutate(`/rate-plans/${encodeURIComponent(ratePlanId)}/nightly-rates`, "PUT", { from: rateFrom, to: rateTo, nightlyRate });
  }
  async function initializeInventory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await mutate("/inventory/initialize", "POST", { roomTypeId: inventoryTypeId, from: inventoryFrom, to: inventoryTo, allotment: Number(allotment), reason }, true);
  }
  async function adjustInventory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (Number(allotmentDelta) === 0 && Number(outDelta) === 0) { setError(text.deltasError); return; }
    await mutate("/inventory/adjustments", "POST", { roomTypeId: inventoryTypeId, date: inventoryDate, allotmentDelta: Number(allotmentDelta), outOfServiceDelta: Number(outDelta), reason }, true);
  }

  return <div className="min-w-0 max-w-full space-y-6 [overflow-wrap:anywhere]" dir={locale === "fa" || locale === "ar" ? "rtl" : "ltr"}>
    <header className="space-y-2"><h1 className="text-2xl font-bold">{text.title}</h1><h2 className="text-lg font-semibold">{propertyName}</h2><p className="text-xs text-muted-foreground">{propertyTimezone}</p></header>
    <section className="rounded-xl border bg-card p-4">
      <h2 className="font-semibold">{text.range}</h2>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm"><span>{text.from}</span><Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label className="space-y-1 text-sm"><span>{text.to}</span><Input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
        <Button type="button" variant="outline" disabled={loading} onClick={() => void reload()}>{text.load}</Button>
      </div>
      {error ? <p role="alert" className="mt-3 text-sm text-destructive">{text.errorPrefix} {error}</p> : null}
      {notice ? <p role="status" className="mt-3 text-sm text-green-700">{notice}</p> : null}
      {isLoading ? <p className="mt-3 text-sm" role="status">{text.loading}</p> : null}
      {activeData ? <div className="mt-3 space-y-1 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" role="status"><p>{text.setupIncomplete}</p>{activeData.roomTypes.length === 0 ? <p>{text.noRoomsConfigured}</p> : null}{roomTypesWithoutRates.map((room) => <p key={`rate:${room.id}`}>{room.name}: {text.noRateConfigured}</p>)}{roomTypesWithoutFullInventory.map((room) => <p key={`inventory:${room.id}`}>{room.name}: {text.noInventoryConfigured}</p>)}</div> : null}
      {canPreviewAvailability ? <section className="mt-4 space-y-3 rounded-lg border p-3" aria-labelledby="guest-availability-preview-title">
        <div><h3 id="guest-availability-preview-title" className="font-semibold">{text.previewTitle}</h3><p className="mt-1 text-sm text-amber-800">{text.previewDemo}</p><p className="mt-1 text-sm text-muted-foreground">{text.previewNoMutation} {text.previewPublicGate}</p><p className="mt-1 text-xs text-muted-foreground">{text.previewDates}</p></div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={text.previewAdults} value={previewAdults} setValue={setPreviewAdults} type="number" required />
          <Field label={text.previewChildren} value={String(previewChildAges.length)} setValue={(value) => {
            const count = Number(value);
            if (!Number.isInteger(count) || count < 0 || count > 8) return;
            setPreviewChildAges((current) => Array.from({ length: count }, (_, index) => current[index] ?? "0"));
          }} type="number" />
          {previewChildAges.map((age, index) => <Field key={`preview-child-${index}`} label={`${text.previewChildAge} ${index + 1}`} value={age} setValue={(value) => setPreviewChildAges((current) => current.map((item, itemIndex) => itemIndex === index ? value : item))} type="number" />)}
        </div>
        <Button type="button" variant="outline" disabled={previewLoading || loading || !activeData || activeData.maintenanceStatus.state !== "AVAILABLE" || !previewDatesValid || !/^([1-9]|1[0-2])$/.test(previewAdults) || previewChildAges.some((age) => !/^(0|[1-9]|1[0-7])$/.test(age))} onClick={() => void loadAvailabilityPreview()}>{previewLoading ? text.loading : previewError ? text.previewRetry : text.previewButton}</Button>
        {activeData?.maintenanceStatus.state === "UNAVAILABLE" ? <p role="status" className="text-sm text-amber-800 dark:text-amber-200">{text.maintenanceUnavailable}</p> : null}
        {!previewDatesValid ? <p className="text-sm text-destructive">{text.previewInvalidDates}</p> : null}
        {previewError ? <p role="alert" className="text-sm text-destructive">{text.previewFailed}</p> : null}
        {activePreview ? <div role="status" aria-label={text.previewResult} className="space-y-3">
          <p className="text-sm font-medium">{text.previewResult}: {activePreview.nights[0]} – {activePreview.nights.at(-1) ?? to} · {activePreview.nights.length} {locale === "en" ? "nights" : "شب"} · {text.previewOccupancy}: {previewAdults} {text.previewAdults}, {previewChildAges.length} {text.previewChildren}</p>
          {activePreview.options.length === 0 ? <div className="space-y-1 rounded-md bg-muted p-3 text-sm"><p>{text.previewNoRooms}</p>{activeData?.roomTypes.length === 0 ? <p>{text.previewMissingRooms}</p> : null}{roomTypesWithoutSellablePhysicalRooms.map((room) => <p key={`physical:${room.id}`}>{room.name}: {text.previewNoPhysicalRooms}</p>)}{roomTypesWithoutRates.length ? <p>{text.previewMissingRates}</p> : null}{roomTypesWithoutFullInventory.length ? <p>{text.previewMissingInventory}</p> : null}{activePreview.rejected.filter((item) => item.reason === "NO_APPLICABLE_RATE_PLAN").map((item) => <p key={`rate-gap:${item.roomTypeId}`}>{activeData?.roomTypes.find((room) => room.id === item.roomTypeId)?.name}: {text.previewRateGap}</p>)}{activePreview.rejected.filter((item) => item.reason.startsWith("OCCUPANCY_")).map((item) => <p key={`occupancy:${item.roomTypeId}`}>{activeData?.roomTypes.find((room) => room.id === item.roomTypeId)?.name}: {text.previewOccupancyMismatch}</p>)}</div> : null}
          <ul className="grid gap-3 lg:grid-cols-2">{activePreview.options.map((option) => <li key={`${option.roomType.id}:${option.ratePlan.id}`} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><h4 className="font-semibold">{option.roomType.name}</h4><p className="text-sm text-muted-foreground">{option.ratePlan.name} · {text.previewCapacity}: {option.roomType.capacity.maxAdults} {text.previewAdults}, {option.roomType.capacity.maxChildren} {text.previewChildren} ({option.roomType.capacity.maxOccupancy} {locale === "en" ? "total" : "نفر در مجموع"})</p></div><p className="text-sm font-medium">{option.availableRoomCount} {text.previewAvailableRooms}</p></div>
            <ul className="mt-2 space-y-1 text-sm">{option.nights.map((night, index) => <li key={`${option.roomType.id}:${night}`} className="flex justify-between gap-3"><time dateTime={night} dir="ltr">{night}</time><span>{text.previewPerNight}: {option.nightlyRates[index] ?? "—"} {option.ratePlan.currency}</span></li>)}</ul>
            <p className="mt-2 text-sm font-semibold">{text.previewTotal}: {option.totalRate} {option.ratePlan.currency}</p>
            {!option.isAvailable ? <p className="mt-2 text-sm text-amber-800">{text.previewUnavailable}: {option.unavailableNights.map((item) => item.date).join(", ")} {option.availableRoomCount < 1 ? `· ${roomTypesWithoutSellablePhysicalRooms.some((room) => room.id === option.roomType.id) ? text.previewOutOfService : text.previewFullCapacity}` : ""}</p> : null}
          </li>)}</ul>
        </div> : null}
      </section> : null}
    </section>

    <section className="space-y-4 rounded-xl border bg-card p-4">
      <h2 className="text-lg font-semibold">{text.roomTypes}</h2>
      <ul className="grid gap-2 sm:grid-cols-2">{(activeData?.roomTypes ?? []).map((item) => <li key={item.id} className="flex min-w-0 items-center justify-between gap-2 rounded-lg border p-3"><span className="min-w-0 break-all">{item.name} <span className="text-xs text-muted-foreground">({item.slug})</span></span><Button type="button" variant="outline" size="sm" onClick={() => startTypeEdit(item)}>{text.edit}</Button></li>)}</ul>
      {!activeData?.roomTypes.length ? <p className="text-sm text-muted-foreground">{text.none}</p> : null}
      <form onSubmit={saveType} className="grid gap-3 sm:grid-cols-2">
        {!editingTypeId ? <Field label={text.slug} value={typeSlug} setValue={setTypeSlug} required /> : null}
        <Field label={text.name} value={typeName} setValue={setTypeName} required />
        <Field label={text.description} value={typeDescription} setValue={setTypeDescription} />
        <Field label={text.adults} value={typeAdults} setValue={setTypeAdults} type="number" required />
        <Field label={text.children} value={typeChildren} setValue={setTypeChildren} type="number" required />
        <Field label={text.occupancy} value={typeOccupancy} setValue={setTypeOccupancy} type="number" required />
        <label className="space-y-1 text-sm"><span>{text.bedKind}</span><select className="h-10 min-w-0 w-full rounded-md border bg-background px-3" value={typeBedKind} onChange={(event) => setTypeBedKind(event.target.value)}><option value="single">{text.bedKinds.single}</option><option value="double">{text.bedKinds.double}</option><option value="queen">{text.bedKinds.queen}</option><option value="king">{text.bedKinds.king}</option><option value="sofa">{text.bedKinds.sofa}</option><option value="bunk">{text.bedKinds.bunk}</option><option value="crib">{text.bedKinds.crib}</option></select></label>
        <Field label={text.bedCount} value={typeBedCount} setValue={setTypeBedCount} type="number" required />
        {editingTypeId && preservedBeds.length ? <p className="text-xs text-muted-foreground sm:col-span-2">{text.beds}: {preservedBeds.map((bed) => `${String(bed.kind ?? "bed")} × ${String(bed.count ?? 1)}`).join(", ")}</p> : null}
        <fieldset className="space-y-2 rounded-md border p-3 sm:col-span-2"><legend className="px-1 text-sm font-medium">{text.amenities}</legend>{(activeData?.amenities ?? []).length ? <div className="grid gap-2 sm:grid-cols-2">{activeData!.amenities.map((amenity) => <label key={amenity.id} className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={selectedAmenityIds.includes(amenity.id)} onChange={(event) => setSelectedAmenityIds((ids) => event.target.checked ? [...ids, amenity.id] : ids.filter((id) => id !== amenity.id))} />{amenity.label}</label>)}</div> : <p className="text-xs text-muted-foreground">{text.noAmenities}</p>}</fieldset>
        <div className="flex gap-2"><Button type="submit" disabled={busy || !typeName}>{editingTypeId ? text.update : text.add}</Button>{editingTypeId ? <Button type="button" variant="outline" onClick={resetTypeForm}>{text.cancel}</Button> : null}</div>
      </form>
      <form onSubmit={createAmenity} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2"><Field label={text.amenityKey} value={amenityKey} setValue={setAmenityKey} required /><Field label={text.amenityLabel} value={amenityLabel} setValue={setAmenityLabel} required /><Button type="submit" disabled={busy || !amenityKey.trim() || !amenityLabel.trim()}>{text.addAmenity}</Button></form>
    </section>

    <section className="space-y-4 rounded-xl border bg-card p-4">
      <h2 className="text-lg font-semibold">{text.rooms}</h2>
      <div className="space-y-2">
        <h3 className="font-medium">{text.roomBoard}</h3>
        <p className="text-xs text-muted-foreground">{text.outOfServiceNote}</p>
        {activeData?.maintenanceStatus.state === "UNAVAILABLE" ? <p role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100">{text.maintenanceUnavailable}</p> : null}
        {activeData?.roomBoard?.unassignedReservationNights ? <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" role="status">{activeData.roomBoard.unassignedReservationNights} {text.unassigned}</p> : null}
        {activeData?.maintenanceStatus.state === "AVAILABLE" ? <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-max text-right text-sm">
            <thead><tr><th scope="col" className="sticky right-0 bg-muted p-2">{text.boardDate}</th>{(activeData.roomBoard?.rooms ?? []).map((room) => <th scope="col" key={room.id} className="whitespace-nowrap p-2">{text.boardRoom} {room.code}</th>)}</tr></thead>
            <tbody>{(activeData.roomBoard?.dates ?? []).map((date) => <tr key={date} className="border-t"><th scope="row" className="sticky right-0 whitespace-nowrap bg-background p-2" dir="ltr">{date}</th>{(activeData.roomBoard?.rooms ?? []).map((room) => {
              const cell = room.nights.find((night) => night.date === date);
              const status = cell?.status ?? "VACANT";
              const label = status === "MAINTENANCE_CONFLICT" ? text.maintenanceConflict : status === "MAINTENANCE" ? text.maintenance : status === "OUT_OF_SERVICE_CONFLICT" ? text.outOfServiceConflict : status === "OUT_OF_SERVICE" ? text.unavailable : status === "OCCUPIED" ? text.occupied : status === "RESERVED" ? text.reserved : text.vacant;
              const color = status === "MAINTENANCE_CONFLICT" || status === "OUT_OF_SERVICE_CONFLICT" ? "bg-destructive text-destructive-foreground" : status === "MAINTENANCE" ? "bg-violet-100 text-violet-950" : status === "OUT_OF_SERVICE" || status === "OCCUPIED" ? "bg-muted text-muted-foreground" : status === "RESERVED" ? "bg-amber-100 text-amber-950" : "bg-emerald-100 text-emerald-950";
              return <td key={room.id} className="p-2"><span className={`inline-flex rounded px-2 py-1 text-xs ${color}`} aria-label={`${room.code}: ${label}`} title={cell?.reference ? `${label} · ${cell.reference}` : label}>{label}</span></td>;
            })}</tr>)}</tbody>
          </table>
        </div> : null}
        {activeData?.maintenanceStatus.state === "AVAILABLE" && !activeData.roomBoard?.rooms.length ? <p className="text-sm text-muted-foreground">{text.none}</p> : null}
      </div>
      <div className="space-y-3 rounded-lg border p-3">
        <h3 className="font-medium">{text.maintenance}</h3>
        {activeData?.maintenanceStatus.state === "UNAVAILABLE" ? <p className="text-sm text-amber-800 dark:text-amber-200" role="status">{text.maintenanceUnavailable}</p> : !activeData?.manualRoomManagementEnabled ? <p className="text-sm text-muted-foreground" role="status">{text.maintenanceGateClosed}</p> : <form onSubmit={createMaintenance} className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm"><span>{text.room}</span><select className="h-10 min-w-0 w-full rounded-md border bg-background px-3" value={maintenanceRoomId} onChange={(event) => setMaintenanceRoomId(event.target.value)} required><option value="">{text.room}</option>{(activeData?.roomTypes ?? []).flatMap((type) => type.rooms.filter((room) => room.isActive).map((room) => <option key={room.id} value={room.id}>{room.code} · {type.name}</option>))}</select></label>
          <Field label={text.maintenanceFrom} value={maintenanceFrom} setValue={setMaintenanceFrom} type="date" required />
          <Field label={text.maintenanceTo} value={maintenanceTo} setValue={setMaintenanceTo} type="date" required />
          <Field label={text.maintenanceReason} value={maintenanceReason} setValue={setMaintenanceReason} required />
          <Button type="submit" disabled={busy || !maintenanceRoomId || !maintenanceReason.trim() || maintenanceTo <= maintenanceFrom}>{text.createMaintenance}</Button>
        </form>}
        {activeData?.maintenanceStatus.state === "UNAVAILABLE" ? <p role="status" className="text-sm text-amber-800 dark:text-amber-200">{text.maintenanceUnavailable}</p> : <><ul className="space-y-2 text-sm">{(activeData?.maintenanceBlocks ?? []).map((block) => <li key={block.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2"><span>{block.roomCode} · <time dir="ltr">{block.from}</time> – <time dir="ltr">{block.to}</time> · {block.reason}</span>{activeData?.manualRoomManagementEnabled ? <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void releaseMaintenance(block.id)}>{text.releaseMaintenance}</Button> : null}</li>)}</ul>
        {activeData?.maintenanceBlocks?.length === 0 ? <p className="text-sm text-muted-foreground">{text.none}</p> : null}</>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">{(activeData?.roomTypes ?? []).map((type) => <div key={type.id} className="rounded-lg border p-3"><h3 className="font-medium">{type.name}</h3><ul className="mt-2 space-y-2 text-sm">{type.rooms.map((room) => <li key={room.id} className="flex items-center justify-between gap-2"><span>{room.code}{room.floor ? ` · ${room.floor}` : ""}{room.isOutOfService ? ` · ${text.unavailable}` : ""}</span><Button type="button" size="sm" variant="ghost" onClick={() => startRoomEdit(room, type.id)}>{text.edit}</Button></li>)}</ul>{type.rooms.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">{text.none}</p> : null}</div>)}</div>
      <form onSubmit={saveRoom} className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm"><span>{text.roomType}</span><select className="h-10 min-w-0 w-full rounded-md border bg-background px-3" value={roomTypeId} onChange={(event) => setRoomTypeId(event.target.value)} required>{(activeData?.roomTypes ?? []).map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label>
        <Field label={text.code} value={roomCode} setValue={setRoomCode} required />
        <Field label={text.floor} value={roomFloor} setValue={setRoomFloor} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={roomUnavailable} onChange={(event) => setRoomUnavailable(event.target.checked)} />{text.unavailable}</label>
        {editingRoomId ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={roomActive} onChange={(event) => setRoomActive(event.target.checked)} />{text.active}</label> : null}
        <div className="flex gap-2"><Button type="submit" disabled={busy || !roomTypeId || !roomCode}>{editingRoomId ? text.update : text.add}</Button>{editingRoomId ? <Button type="button" variant="outline" onClick={resetRoomForm}>{text.cancel}</Button> : null}</div>
      </form>
    </section>

    <section className="space-y-4 rounded-xl border bg-card p-4">
      <h2 className="text-lg font-semibold">{text.rates}</h2>
      <ul className="space-y-2 text-sm">{(activeData?.ratePlans ?? []).map((plan) => <li key={plan.id} className="rounded-lg border p-3"><div className="flex flex-wrap items-start justify-between gap-2"><h3 className="font-medium">{plan.name} · {plan.baseNightlyRate} {plan.currency}</h3><Button type="button" size="sm" variant="outline" aria-label={`${text.editPlan}: ${plan.name}`} onClick={() => startRatePlanEdit(plan)}>{text.editPlan}</Button></div>{plan.validFrom || plan.validTo ? <p className="mt-1 text-xs text-muted-foreground">{text.planValidity}: {plan.validFrom ?? "—"} – {plan.validTo ?? "—"}</p> : null}{!plan.cancellationPolicyId ? <p className="mt-1 text-xs text-amber-700">{text.noPolicy}</p> : null}<ul className="mt-2 text-xs text-muted-foreground">{plan.nightlyRates.map((rate) => <li key={rate.id}>{rate.from} – {rate.to}: {rate.nightlyRate ?? "—"}</li>)}</ul></li>)}</ul>
      <div className="rounded-lg border p-3">
        <h3 className="font-medium">{text.policies}</h3>
        <ul className="my-2 space-y-1 text-sm">{(activeData?.cancellationPolicies ?? []).map((policy) => <li key={policy.id}>{policy.name} · {policy.freeCancellationCutoffHours}h · {policy.fullCancellationRetention}{policy.isActive ? "" : ` · ${text.inactivePolicy}`}</li>)}</ul>
        <form onSubmit={createCancellationPolicy} className="grid gap-3 sm:grid-cols-2">
          <Field label={text.policyKey} value={policyKey} setValue={setPolicyKey} required />
          <Field label={text.policyName} value={policyName} setValue={setPolicyName} required />
          <Field label={text.cutoff} value={policyCutoff} setValue={setPolicyCutoff} type="number" required />
          <Field label={text.retention} value={policyRetention} setValue={setPolicyRetention} type="number" required />
          <Button type="submit" disabled={busy || !policyKey || !policyName}>{text.createPolicy}</Button>
        </form>
      </div>
      <form onSubmit={createRatePlan} className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm"><span>{text.roomType}</span><select className="h-10 min-w-0 w-full rounded-md border bg-background px-3" value={planTypeId} onChange={(event) => setPlanTypeId(event.target.value)} required>{(activeData?.roomTypes ?? []).map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label>
        <Field label={text.planCode} value={planCode} setValue={setPlanCode} required /><Field label={text.planName} value={planName} setValue={setPlanName} required /><Field label={text.baseRate} value={baseRate} setValue={setBaseRate} type="number" required />
        <label className="space-y-1 text-sm"><span>{text.policies}</span><select className="h-10 min-w-0 w-full rounded-md border bg-background px-3" value={ratePolicyId} onChange={(event) => setRatePolicyId(event.target.value)} required={!editingRatePlanId}><option value="">{text.selectPolicy}</option>{(activeData?.cancellationPolicies ?? []).filter((policy) => policy.isActive).map((policy) => <option key={policy.id} value={policy.id}>{policy.name}</option>)}</select></label>
        {!editingRatePlanId ? <p className="text-xs text-muted-foreground sm:col-span-2">{text.policyRequired}</p> : null}
        <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy || !planTypeId || !baseRate || (!editingRatePlanId && !ratePolicyId)}>{editingRatePlanId ? text.updatePlan : text.createPlan}</Button>{editingRatePlanId ? <Button type="button" variant="outline" onClick={resetRatePlanForm}>{text.cancel}</Button> : null}</div>
      </form>
      <form onSubmit={saveNightlyRate} className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm"><span>{text.planName}</span><select className="h-10 min-w-0 w-full rounded-md border bg-background px-3" value={ratePlanId} onChange={(event) => setRatePlanId(event.target.value)} required>{(activeData?.ratePlans ?? []).map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · {plan.code}</option>)}</select></label>
        <Field label={text.from} value={rateFrom} setValue={setRateFrom} type="date" required /><Field label={text.to} value={rateTo} setValue={setRateTo} type="date" required /><Field label={text.nightlyRate} value={nightlyRate} setValue={setNightlyRate} type="number" required />
        <Button type="submit" disabled={busy || !ratePlanId || !nightlyRate}>{text.saveNightly}</Button>
      </form>
    </section>

    <section className="space-y-4 rounded-xl border bg-card p-4">
      <h2 className="text-lg font-semibold">{text.inventory}</h2>
      <form onSubmit={initializeInventory} className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm"><span>{text.roomType}</span><select className="h-10 min-w-0 w-full rounded-md border bg-background px-3" value={inventoryTypeId} onChange={(event) => setInventoryTypeId(event.target.value)} required>{(activeData?.roomTypes ?? []).map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label>
        <Field label={text.from} value={inventoryFrom} setValue={setInventoryFrom} type="date" required /><Field label={text.to} value={inventoryTo} setValue={setInventoryTo} type="date" required /><Field label={text.allotment} value={allotment} setValue={setAllotment} type="number" required /><Field label={text.reason} value={reason} setValue={setReason} required />
        <Button type="submit" disabled={busy || !inventoryTypeId}>{text.initialize}</Button>
      </form>
      <form onSubmit={adjustInventory} className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm"><span>{text.roomType}</span><select className="h-10 min-w-0 w-full rounded-md border bg-background px-3" value={inventoryTypeId} onChange={(event) => setInventoryTypeId(event.target.value)} required>{(activeData?.roomTypes ?? []).map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label>
        <Field label={text.date} value={inventoryDate} setValue={setInventoryDate} type="date" required /><Field label={text.allotmentDelta} value={allotmentDelta} setValue={setAllotmentDelta} type="number" required /><Field label={text.outDelta} value={outDelta} setValue={setOutDelta} type="number" required /><Field label={text.reason} value={reason} setValue={setReason} required />
        <Button type="submit" disabled={busy || !inventoryTypeId || (Number(allotmentDelta) === 0 && Number(outDelta) === 0)}>{text.adjust}</Button>
      </form>
      <div className="overflow-x-auto"><table className="w-full text-right text-sm"><thead><tr><th className="p-2">{text.date}</th><th className="p-2">{text.roomType}</th><th className="p-2">{text.allotment}</th><th className="p-2">{text.booked}</th><th className="p-2">{text.held}</th><th className="p-2">{text.oos}</th><th className="p-2">{text.available}</th></tr></thead><tbody>{(activeData?.inventory ?? []).map((night) => <tr key={night.id} className="border-t"><td className="p-2" dir="ltr">{night.date}</td><td className="p-2">{activeData?.roomTypes.find((item) => item.id === night.roomTypeId)?.name ?? "—"}</td><td className="p-2">{night.allotment}</td><td className="p-2">{night.booked}</td><td className="p-2">{night.held}</td><td className="p-2">{night.outOfService}</td><td className="p-2">{night.available ?? text.availabilityUnknown}</td></tr>)}</tbody></table></div>
      {!activeData?.inventory.length ? <p className="text-sm text-muted-foreground">{text.none}</p> : null}
    </section>
  </div>;
}

function Field({ label, value, setValue, type = "text", required = false }: {
  label: string; value: string; setValue: (value: string) => void; type?: string; required?: boolean;
}) {
  const id = useId();
  return <div className="space-y-1"><Label htmlFor={id}>{label}</Label><Input id={id} type={type} step={type === "number" ? "1" : undefined} value={value} onChange={(event) => setValue(event.target.value)} required={required} /></div>;
}
