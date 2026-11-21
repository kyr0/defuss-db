import { openMemory } from 'defuss-db'
interface Price { id: string; eur: number }
const utc = (month: number, day: number) =>
  new Date(Date.UTC(2026, month - 1, day))
const db = await openMemory()
const prices = await db.ensureCollection<Price>('prices', {
  $trackHistory: true,
})
await prices.at(utc(1, 1)).put({ id: 'plan', eur: 100 })
await prices.at(utc(2, 1)).put({ id: 'plan', eur: 120 })
const before = (await db.stats()).revision
await prices.update('plan', { eur: 110 }, { $historic: utc(1, 15) })
const past = prices.at(utc(1, 20), { $asOfRevision: before })
const price = (await past.get('plan'))?.eur // 100
await db.close()
