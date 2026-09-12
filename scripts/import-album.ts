/**
 * Imports a football album into the catalog (D29) from two files in data/albums/:
 *   <album>.json  the album's data: code, name, product line, edition dates, team codes
 *   <album>.txt   its checklist, the text of CromosRepes' «marcar faltas» page, without marks
 *
 *   npm run import:album -- liga-2025-26-megacracks
 *
 * Idempotent: running it again updates the cards in place.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pool } from "../src/db/client";
import { importAlbum, type AlbumMeta } from "../src/lib/albums/import";

async function main() {
  const album = process.argv[2];
  if (!album) {
    console.error("Uso: npm run import:album -- <álbum>   (lee data/albums/<álbum>.json y .txt)");
    process.exit(1);
  }
  const dir = join(process.cwd(), "data/albums");
  const meta = JSON.parse(readFileSync(join(dir, `${album}.json`), "utf8")) as AlbumMeta;
  const checklist = readFileSync(join(dir, `${album}.txt`), "utf8");

  const result = await importAlbum(meta, checklist);
  console.log(`${meta.name}: ${result.cards} cartas en el catálogo (${meta.code}).`);
  for (const [series, n] of Object.entries(result.bySeries)) console.log(`  ${series}: ${n}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
