import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const rooms = sqliteTable('game_rooms', {
 id:text('id').primaryKey(), version:integer('version').notNull(), data:text('data').notNull(),
 updated:integer('updated').notNull(), seenA:integer('seen_a').notNull().default(0), seenB:integer('seen_b').notNull().default(0)
});
