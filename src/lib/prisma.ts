import { PrismaClient } from '@prisma/client'

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
//
// Learn more: 
// https://pris.ly/d/help/next-js-best-practices

const prismaClientSingleton = () => {
  return new PrismaClient()
}

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

// Always reuse the global client — prevents connection pool exhaustion on Vercel serverless
const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()
globalThis.prismaGlobal = prisma

export default prisma