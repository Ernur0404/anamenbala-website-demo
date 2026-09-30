/**
 * Хранилище файлов. Сейчас — локальный диск (UPLOAD_DIR), в продакшне папка монтируется в контейнер
 * и раздаётся Caddy. Интерфейс позволяет добавить S3-совместимое хранилище без изменения остального кода.
 */
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../env";

export interface Storage {
  put(key: string, data: Buffer): Promise<void>;
  removePrefix(prefix: string): Promise<void>;
}

class LocalStorage implements Storage {
  private root = path.resolve(/*turbopackIgnore: true*/ env().UPLOAD_DIR);

  private resolve(key: string) {
    const target = path.resolve(this.root, key);
    if (!target.startsWith(this.root + path.sep)) throw new Error("Недопустимый путь файла");
    return target;
  }

  async put(key: string, data: Buffer) {
    const target = this.resolve(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);
  }

  async removePrefix(prefix: string) {
    await rm(this.resolve(prefix), { recursive: true, force: true });
  }
}

let instance: Storage | null = null;

export function storage(): Storage {
  if (!instance) {
    if (env().STORAGE_DRIVER === "s3") {
      throw new Error("S3-хранилище не подключено: задайте STORAGE_DRIVER=local или добавьте драйвер S3");
    }
    instance = new LocalStorage();
  }
  return instance;
}
