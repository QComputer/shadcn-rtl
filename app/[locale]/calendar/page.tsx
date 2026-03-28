"use client";

import { useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import faLocale from "@fullcalendar/core/locales/fa";

import dayjs from "dayjs";
import jalaliday from "jalaliday";

dayjs.extend(jalaliday);

export default function CalendarPage() {
  const [events, setEvents] = useState([
    {
      id: "1",
      title: "مشاوره اولیه",
      start: "2026-03-28T10:00",
      end: "2026-03-28T11:00",
    },
    {
      id: "2",
      title: "ویزیت بیمار",
      start: "2026-03-29T14:00",
      end: "2026-03-29T15:00",
    },
  ]);

  const [modal, setModal] = useState({
    open: false,
    date: "",
    jalali: "",
  });

  function onDateClick(info: any) {
    const realDate = info.date.marker;
    const j = dayjs(realDate).calendar("jalali");

    setModal({
      open: true,
      date: realDate,
      jalali: j.format("YYYY/MM/DD"),
    });
  }

  function addAppointment(e: any) {
    e.preventDefault();

    const form = new FormData(e.target);
    const title = form.get("title") as string;
    const time = form.get("time") as string;

    const start = dayjs(modal.date).hour(Number(time.split(":")[0])).minute(Number(time.split(":")[1]));

    setEvents((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        title,
        start: start.toISOString(),
        end: start.add(1, "hour").toISOString(),
      },
    ]);

    setModal({ open: false, date: "", jalali: "" });
  }

  return (
    <div style={{ direction: "rtl", padding: "20px" }}>
      <h1 style={{ fontSize: "24px", marginBottom: "20px" }}>
        مدیریت نوبت‌ها
      </h1>

      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        locale={faLocale}
        selectable={true}
        editable={true}
        events={events}
        dateClick={onDateClick}
        height="auto"
        firstDay={6}
        buttonText={{
          today: "امروز",
          month: "ماه",
          week: "هفته",
          day: "روز",
          prev: "قبلی",
          next: "بعدی",
        }}
        dayHeaderFormat={(info) => {
          const d = info.date.marker;  // Already a native Date
          return dayjs(d).calendar("jalali").format("dddd");
        }}

        titleFormat={(info) => {
          const d = info.date.marker;  // ZonedMarker → toDate() works
          return dayjs(d).calendar("jalali").format("MMMM YYYY");
        }}
      />

      {/* Appointment modal */}
      {modal.open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setModal({ open: false, date: "", jalali: "" })}
        >
          <div
            style={{
              background: "white",
              padding: "20px",
              borderRadius: "12px",
              width: "360px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginBottom: "10px" }}>ثبت نوبت جدید</h2>
            <p style={{ marginBottom: "20px", color: "#555" }}>
              تاریخ انتخاب‌شده: {modal.jalali}
            </p>

            <form onSubmit={addAppointment}>
              <label style={{ display: "block", marginBottom: "10px" }}>
                عنوان نوبت:
                <input
                  type="text"
                  name="title"
                  required
                  style={{
                    width: "100%",
                    marginTop: "6px",
                    padding: "8px",
                    borderRadius: "6px",
                    border: "1px solid #ccc",
                  }}
                />
              </label>

              <label style={{ display: "block", marginBottom: "20px" }}>
                ساعت:
                <input
                  type="time"
                  name="time"
                  required
                  style={{
                    width: "100%",
                    marginTop: "6px",
                    padding: "8px",
                    borderRadius: "6px",
                    border: "1px solid #ccc",
                  }}
                />
              </label>

              <button
                type="submit"
                style={{
                  width: "100%",
                  padding: "10px",
                  background: "#0d6efd",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                ثبت نوبت
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
