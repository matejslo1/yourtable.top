-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('superadmin', 'owner', 'admin', 'manager', 'staff');

-- CreateEnum
CREATE TYPE "TableShape" AS ENUM ('square', 'round', 'rectangle');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('HOLD', 'PENDING', 'CONFIRMED', 'SEATED', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'EXPIRED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "ReservationSource" AS ENUM ('online', 'walk_in', 'phone', 'manual');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('none', 'deposit', 'paid', 'refunded');

-- CreateEnum
CREATE TYPE "AssignedBy" AS ENUM ('auto', 'manual');

-- CreateEnum
CREATE TYPE "WaitlistStatus" AS ENUM ('waiting', 'offered', 'accepted', 'expired');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('confirmation', 'reminder', 'cancellation', 'review_request', 'waitlist_offer');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('email', 'sms');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('pending', 'sent', 'failed', 'delivered');

-- CreateEnum
CREATE TYPE "VoucherStatus" AS ENUM ('active', 'used', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "VoucherType" AS ENUM ('digital', 'physical');

-- CreateEnum
CREATE TYPE "DeliveryMethod" AS ENUM ('email', 'print', 'pickup', 'delivery');

-- CreateEnum
CREATE TYPE "VoucherTransactionType" AS ENUM ('purchase', 'redemption', 'refund');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "address" TEXT NOT NULL,
    "phone" VARCHAR(50),
    "email" VARCHAR(255) NOT NULL,
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'Europe/Ljubljana',
    "settings" JSONB NOT NULL DEFAULT '{"languages":["sl","en"],"currency":"EUR","notificationsEnabled":true,"bookingWidgetEnabled":true}',
    "stripe_account_id" VARCHAR(100),
    "logo_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "supabase_user_id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'staff',
    "permissions" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "floor_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "layout_config" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "floor_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_tables" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "floor_plan_id" UUID NOT NULL,
    "label" VARCHAR(50) NOT NULL,
    "min_seats" INTEGER NOT NULL,
    "max_seats" INTEGER NOT NULL,
    "join_group" VARCHAR(50),
    "join_priority" INTEGER NOT NULL DEFAULT 0,
    "position_x" DOUBLE PRECISION NOT NULL,
    "position_y" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL DEFAULT 80,
    "height" DOUBLE PRECISION NOT NULL DEFAULT 80,
    "shape" "TableShape" NOT NULL DEFAULT 'square',
    "is_combinable" BOOLEAN NOT NULL DEFAULT false,
    "is_vip" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "restaurant_tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "table_adjacency" (
    "table_a_id" UUID NOT NULL,
    "table_b_id" UUID NOT NULL,
    "can_join" BOOLEAN NOT NULL DEFAULT true,
    "join_max_seats" INTEGER,
    CONSTRAINT "table_adjacency_pkey" PRIMARY KEY ("table_a_id","table_b_id")
);

-- CreateTable
CREATE TABLE "guests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "tags" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "visit_count" INTEGER NOT NULL DEFAULT 0,
    "no_show_count" INTEGER NOT NULL DEFAULT 0,
    "is_blacklisted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "guests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "guest_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "time" VARCHAR(5) NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "party_size" INTEGER NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'HOLD',
    "source" "ReservationSource" NOT NULL DEFAULT 'manual',
    "offer_id" UUID,
    "notes" TEXT,
    "internal_notes" TEXT,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'none',
    "payment_intent_id" VARCHAR(255),
    "cancellation_fee" DECIMAL(10,2),
    "cancellation_reason" TEXT,
    "hold_expires_at" TIMESTAMPTZ,
    "hold_session_token" VARCHAR(100),
    "version" INTEGER NOT NULL DEFAULT 1,
    "assigned_by" "AssignedBy" NOT NULL DEFAULT 'auto',
    "no_show_fee_charged" BOOLEAN NOT NULL DEFAULT false,
    "source_ip" VARCHAR(45),
    "confirmed_at" TIMESTAMPTZ,
    "cancelled_at" TIMESTAMPTZ,
    "reminder_sent_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservation_tables" (
    "reservation_id" UUID NOT NULL,
    "table_id" UUID NOT NULL,
    CONSTRAINT "reservation_tables_pkey" PRIMARY KEY ("reservation_id","table_id")
);

-- CreateTable
CREATE TABLE "seating_config" (
    "tenant_id" UUID NOT NULL,
    "hold_ttl_seconds" INTEGER NOT NULL DEFAULT 420,
    "max_join_tables" INTEGER NOT NULL DEFAULT 3,
    "auto_confirm" BOOLEAN NOT NULL DEFAULT true,
    "no_show_timeout_min" INTEGER NOT NULL DEFAULT 15,
    "cancellation_fee_hours" INTEGER NOT NULL DEFAULT 24,
    "scoring_weights" JSONB NOT NULL DEFAULT '{"waste":1.0,"join":1.0,"vip":1.0,"zone":0.5}',
    "default_duration_min" INTEGER NOT NULL DEFAULT 90,
    "max_party_size" INTEGER NOT NULL DEFAULT 12,
    "min_advance_hours" INTEGER NOT NULL DEFAULT 2,
    "max_advance_days" INTEGER NOT NULL DEFAULT 60,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "seating_config_pkey" PRIMARY KEY ("tenant_id")
);

-- CreateTable
CREATE TABLE "operating_hours" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "open_time" VARCHAR(5) NOT NULL,
    "close_time" VARCHAR(5) NOT NULL,
    "last_reservation" VARCHAR(5) NOT NULL,
    "is_closed" BOOLEAN NOT NULL DEFAULT false,
    "slot_duration_min" INTEGER NOT NULL DEFAULT 30,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "operating_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "special_dates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "is_closed" BOOLEAN NOT NULL DEFAULT false,
    "custom_hours" JSONB,
    "note" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "special_dates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waitlist" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "guest_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "time" VARCHAR(5) NOT NULL,
    "party_size" INTEGER NOT NULL,
    "status" "WaitlistStatus" NOT NULL DEFAULT 'waiting',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "offered_at" TIMESTAMPTZ,
    "expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "waitlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "reservation_id" UUID,
    "type" "NotificationType" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "recipient" VARCHAR(255) NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'pending',
    "sent_at" TIMESTAMPTZ,
    "template_data" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "user_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" UUID NOT NULL,
    "changes" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vouchers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "initial_value" DECIMAL(10,2) NOT NULL,
    "remaining_value" DECIMAL(10,2) NOT NULL,
    "status" "VoucherStatus" NOT NULL DEFAULT 'active',
    "type" "VoucherType" NOT NULL DEFAULT 'digital',
    "delivery_method" "DeliveryMethod" NOT NULL DEFAULT 'email',
    "dedication" TEXT,
    "recipient_name" VARCHAR(255),
    "recipient_email" VARCHAR(255),
    "recipient_phone" VARCHAR(50),
    "recipient_address" TEXT,
    "buyer_name" VARCHAR(255) NOT NULL,
    "buyer_email" VARCHAR(255) NOT NULL,
    "pdf_url" TEXT,
    "qr_code" TEXT,
    "payment_intent_id" VARCHAR(255),
    "valid_from" DATE NOT NULL,
    "valid_until" DATE NOT NULL,
    "order_id" VARCHAR(50),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voucher_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "voucher_id" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "type" "VoucherTransactionType" NOT NULL,
    "performed_by" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "voucher_transactions_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");
CREATE UNIQUE INDEX "users_supabase_user_id_key" ON "users"("supabase_user_id");
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");
CREATE INDEX "users_supabase_user_id_idx" ON "users"("supabase_user_id");
CREATE UNIQUE INDEX "users_tenant_id_email_key" ON "users"("tenant_id", "email");
CREATE INDEX "floor_plans_tenant_id_idx" ON "floor_plans"("tenant_id");
CREATE UNIQUE INDEX "restaurant_tables_floor_plan_id_label_key" ON "restaurant_tables"("floor_plan_id", "label");
CREATE INDEX "restaurant_tables_floor_plan_id_idx" ON "restaurant_tables"("floor_plan_id");
CREATE UNIQUE INDEX "guests_tenant_id_email_key" ON "guests"("tenant_id", "email");
CREATE INDEX "guests_tenant_id_idx" ON "guests"("tenant_id");
CREATE INDEX "guests_tenant_id_phone_idx" ON "guests"("tenant_id", "phone");
CREATE INDEX "reservations_tenant_id_date_idx" ON "reservations"("tenant_id", "date");
CREATE INDEX "reservations_tenant_id_status_idx" ON "reservations"("tenant_id", "status");
CREATE INDEX "reservations_hold_expires_at_idx" ON "reservations"("hold_expires_at");
CREATE INDEX "reservations_guest_id_idx" ON "reservations"("guest_id");
CREATE INDEX "reservation_tables_table_id_idx" ON "reservation_tables"("table_id");
CREATE UNIQUE INDEX "operating_hours_tenant_id_day_of_week_key" ON "operating_hours"("tenant_id", "day_of_week");
CREATE INDEX "operating_hours_tenant_id_idx" ON "operating_hours"("tenant_id");
CREATE UNIQUE INDEX "special_dates_tenant_id_date_key" ON "special_dates"("tenant_id", "date");
CREATE INDEX "special_dates_tenant_id_idx" ON "special_dates"("tenant_id");
CREATE INDEX "waitlist_tenant_id_date_idx" ON "waitlist"("tenant_id", "date");
CREATE INDEX "waitlist_tenant_id_status_idx" ON "waitlist"("tenant_id", "status");
CREATE INDEX "notifications_tenant_id_idx" ON "notifications"("tenant_id");
CREATE INDEX "notifications_reservation_id_idx" ON "notifications"("reservation_id");
CREATE INDEX "audit_logs_tenant_id_created_at_idx" ON "audit_logs"("tenant_id", "created_at");
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");
CREATE UNIQUE INDEX "vouchers_tenant_id_code_key" ON "vouchers"("tenant_id", "code");
CREATE INDEX "vouchers_tenant_id_idx" ON "vouchers"("tenant_id");
CREATE INDEX "voucher_transactions_voucher_id_idx" ON "voucher_transactions"("voucher_id");

-- Foreign Keys
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "floor_plans" ADD CONSTRAINT "floor_plans_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "restaurant_tables" ADD CONSTRAINT "restaurant_tables_floor_plan_id_fkey" FOREIGN KEY ("floor_plan_id") REFERENCES "floor_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "table_adjacency" ADD CONSTRAINT "table_adjacency_table_a_id_fkey" FOREIGN KEY ("table_a_id") REFERENCES "restaurant_tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "table_adjacency" ADD CONSTRAINT "table_adjacency_table_b_id_fkey" FOREIGN KEY ("table_b_id") REFERENCES "restaurant_tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "guests" ADD CONSTRAINT "guests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "guests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservation_tables" ADD CONSTRAINT "reservation_tables_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reservation_tables" ADD CONSTRAINT "reservation_tables_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "restaurant_tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "seating_config" ADD CONSTRAINT "seating_config_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "operating_hours" ADD CONSTRAINT "operating_hours_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "special_dates" ADD CONSTRAINT "special_dates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "waitlist" ADD CONSTRAINT "waitlist_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "waitlist" ADD CONSTRAINT "waitlist_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "guests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "voucher_transactions" ADD CONSTRAINT "voucher_transactions_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "vouchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
