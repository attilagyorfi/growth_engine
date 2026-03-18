ALTER TABLE `client_profiles` MODIFY COLUMN `website` varchar(500);--> statement-breakpoint
ALTER TABLE `client_profiles` MODIFY COLUMN `industry` varchar(255);--> statement-breakpoint
ALTER TABLE `client_profiles` MODIFY COLUMN `description` text;--> statement-breakpoint
ALTER TABLE `client_profiles` MODIFY COLUMN `brandVoice` json;--> statement-breakpoint
ALTER TABLE `client_profiles` MODIFY COLUMN `contentPillars` json;--> statement-breakpoint
ALTER TABLE `client_profiles` MODIFY COLUMN `socialAccounts` json;--> statement-breakpoint
ALTER TABLE `content_posts` MODIFY COLUMN `hashtags` json;--> statement-breakpoint
ALTER TABLE `leads` MODIFY COLUMN `tags` json;--> statement-breakpoint
ALTER TABLE `strategies` MODIFY COLUMN `goals` json;--> statement-breakpoint
ALTER TABLE `strategies` MODIFY COLUMN `weeklyPlans` json;--> statement-breakpoint
ALTER TABLE `strategies` MODIFY COLUMN `kpis` json;