import { notFound } from "next/navigation";

/** Неизвестный адрес внутри админки — страница «не найдено» в оформлении панели */
export default function AdminCatchAll() {
  notFound();
}
