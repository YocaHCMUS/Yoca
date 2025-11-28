// Storage Service: Handles file system operations for temporary data storage
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import dayjs from "dayjs";

export class Storage {
  static async saveText(filePath: string, data: string) {
    const dir = dirname(filePath);
    await mkdir(dir, { recursive: true });
    await writeFile(filePath, data, "utf-8");
  }

  static async saveJson(filePath: string, data: unknown) {
    const dir = dirname(filePath);
    await mkdir(dir, { recursive: true });
    await writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
  }

  static generateTimestamp() {
    return dayjs().format("YYYY-MM-DD HH-MM-SS");
  }
}
