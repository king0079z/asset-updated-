/**
 * Run with: npx ts-node --project tsconfig.json scripts/fix-image-urls.ts
 * Or:        npx tsx scripts/fix-image-urls.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function isValidUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const t = url.trim();
  if (!t) return false;
  // Reject both literal CRLF and URL-encoded CRLF (%0D, %0A, %0D%0A)
  if (/[\r\n\t]/.test(t) || /%0[DA]/i.test(t)) return false;
  try {
    const p = new URL(t);
    return p.protocol === "http:" || p.protocol === "https:";
  } catch { return false; }
}

async function main() {
  const assets = await prisma.asset.findMany({
    where: { imageUrl: { not: null } },
    select: { id: true, name: true, imageUrl: true },
  });

  const broken = assets.filter(a => !isValidUrl(a.imageUrl));
  console.log(`Found ${assets.length} assets with imageUrl, ${broken.length} have broken URLs`);

  if (broken.length > 0) {
    broken.forEach(a => console.log(`  - ${a.name} (${a.id}): "${a.imageUrl}"`));
    const result = await prisma.asset.updateMany({
      where: { id: { in: broken.map(a => a.id) } },
      data: { imageUrl: null },
    });
    console.log(`Cleared ${result.count} broken imageUrl values`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
