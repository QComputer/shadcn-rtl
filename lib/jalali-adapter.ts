import dayjs from "dayjs";
import jalaliday from "jalaliday";

dayjs.extend(jalaliday);

export const toJalali = (date: Date) => dayjs(date).calendar("jalali");