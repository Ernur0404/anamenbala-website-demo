import { notFound } from "next/navigation";

/** Любой неизвестный адрес внутри витрины → страница 404 в оформлении магазина */
export default function CatchAll() {
  notFound();
}
