ALTER TABLE `app_users` ADD `subscriptionBilling` enum('monthly','yearly') DEFAULT 'monthly' NOT NULL;--> statement-breakpoint
ALTER TABLE `app_users` ADD `stripeCustomerId` varchar(128);--> statement-breakpoint
ALTER TABLE `app_users` ADD `stripeSubscriptionId` varchar(128);