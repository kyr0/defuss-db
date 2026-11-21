import { openMemory } from 'defuss-db'
interface LogEvent { id: string; time: Date }
const db = await openMemory()
try {
  const events = db.collection<LogEvent>('events')
  await events.createIndex({ name: 'byTime', fields: ['time'], order: ['desc'] })
  await events.put({ id: 'one', time: new Date() })
  console.log(await events.countByIndex('byTime'))
} finally { await db.close() }
