import { relations } from "drizzle-orm/relations";
import { users, postsTable } from "./schema";

export const postsTableRelations = relations(postsTable, ({one}) => ({
	user: one(users, {
		fields: [postsTable.userId],
		references: [users.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	postsTables: many(postsTable),
}));