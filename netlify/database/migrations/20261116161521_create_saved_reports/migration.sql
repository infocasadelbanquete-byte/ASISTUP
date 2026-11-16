CREATE TABLE "saved_reports" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"date" text NOT NULL,
	"content" text NOT NULL,
	"type" text NOT NULL,
	"month" text,
	"year" text
);
