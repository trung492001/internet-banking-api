CREATE TABLE "Accounts" (
	"id" serial NOT NULL,
	"number" VARCHAR(255) NOT NULL,
	"balance" FLOAT NOT NULL,
	"is_payment_account" BOOLEAN NOT NULL,
	"user_id" integer NOT NULL,
	CONSTRAINT "Accounts_pk" PRIMARY KEY ("id")
) WITH (
  OIDS=FALSE
);



CREATE TABLE "Users" (
	"id" serial NOT NULL,
	"username" VARCHAR(255) NOT NULL,
	"password" VARCHAR(255) NOT NULL,
	"email" VARCHAR(255) NOT NULL,
	"phone" VARCHAR(255) NOT NULL,
	"name" VARCHAR(255) NOT NULL,
	"role_id" integer NOT NULL,
	CONSTRAINT "Users_pk" PRIMARY KEY ("id")
) WITH (
  OIDS=FALSE
);



CREATE TABLE "Transactions" (
	"id" serial NOT NULL,
	"source_account_number" VARCHAR(255) NOT NULL,
	"source_owner_name" VARCHAR(255) NOT NULL,
	"source_bank_id" integer,
	"destination_account_number" VARCHAR(255) NOT NULL,
	"destination_owner_name" VARCHAR(255) NOT NULL,
	"destination_bank_id" integer,
	"created_at" TIMESTAMP NOT NULL,
	"note" VARCHAR(255) NOT NULL,
	"amount" integer NOT NULL,
	"fee" integer NOT NULL,
	"fee_is_paid_by_receiver" BOOLEAN NOT NULL,
	"debt_reminder_id" integer,
	"status_id" integer NOT NULL,
	"code" VARCHAR(255) NOT NULL UNIQUE,
	"signature" text,
	"response_data" text,
	CONSTRAINT "Transactions_pk" PRIMARY KEY ("id")
) WITH (
  OIDS=FALSE
);



CREATE TABLE "Roles" (
	"id" serial NOT NULL,
	"name" VARCHAR(255) NOT NULL,
	CONSTRAINT "Roles_pk" PRIMARY KEY ("id")
) WITH (
  OIDS=FALSE
);



CREATE TABLE "Receivers" (
	"reminiscent_name" VARCHAR(255) NOT NULL,
	"id" serial,
	"user_id" integer NOT NULL,
	"account_number" VARCHAR(255) NOT NULL,
	"bank_id" integer,
	CONSTRAINT "Receivers_pk" PRIMARY KEY ("id")
) WITH (
  OIDS=FALSE
);



CREATE TABLE "DebtReminders" (
	"source_account_number" VARCHAR(255) NOT NULL,
	"source_owner_name" VARCHAR(255) NOT NULL,
	"destination_account_number" VARCHAR(255) NOT NULL,
	"destination_owner_name" VARCHAR(255) NOT NULL,
	"id" serial NOT NULL,
	"amount" integer NOT NULL,
	"note" VARCHAR(255) NOT NULL,
	"isPaid" BOOLEAN NOT NULL,
	"created_at" TIMESTAMP NOT NULL,
	CONSTRAINT "DebtReminders_pk" PRIMARY KEY ("id")
) WITH (
  OIDS=FALSE
);



CREATE TABLE "Banks" (
	"id" serial NOT NULL,
	"name" VARCHAR(255) NOT NULL,
	"key" text,
	"host" VARCHAR(255),
	CONSTRAINT "Banks_pk" PRIMARY KEY ("id")
) WITH (
  OIDS=FALSE
);



CREATE TABLE "TransactionOTPs" (
	"id" serial NOT NULL,
	"otp" VARCHAR(255) NOT NULL UNIQUE,
	"expired_at" TIMESTAMP NOT NULL,
	"transaction_id" integer NOT NULL,
	CONSTRAINT "TransactionOTPs_pk" PRIMARY KEY ("id")
) WITH (
  OIDS=FALSE
);

CREATE TABLE "ResetPasswordOTPs" (
	"id" serial NOT NULL,
	"otp" VARCHAR(255) NOT NULL UNIQUE,
	"expired_at" TIMESTAMP NOT NULL,
	"user_id" integer NOT NULL,
	CONSTRAINT "ResetPasswordOTPs_pk" PRIMARY KEY ("id")
) WITH (
  OIDS=FALSE
);



CREATE TABLE "RefreshTokens" (
	"id" serial NOT NULL,
	"secret_key" text NOT NULL,
	"expired_at" TIMESTAMP NOT NULL,
	"user_id" integer NOT NULL,
	CONSTRAINT "RefreshTokens_pk" PRIMARY KEY ("id")
) WITH (
  OIDS=FALSE
);



CREATE TABLE "TransactionStatuses" (
	"id" serial NOT NULL,
	"name" VARCHAR(255) NOT NULL,
	CONSTRAINT "TransactionStatuses_pk" PRIMARY KEY ("id")
) WITH (
  OIDS=FALSE
);



ALTER TABLE "Accounts" ADD CONSTRAINT "Accounts_fk0" FOREIGN KEY ("user_id") REFERENCES "Users"("id") ON DELETE CASCADE;

ALTER TABLE "Users" ADD CONSTRAINT "Users_fk0" FOREIGN KEY ("role_id") REFERENCES "Roles"("id") ON DELETE CASCADE;

ALTER TABLE "Transactions" ADD CONSTRAINT "Transactions_fk0" FOREIGN KEY ("status_id") REFERENCES "TransactionStatuses"("id") ON DELETE CASCADE;
ALTER TABLE "Transactions" ADD CONSTRAINT "Transactions_fk1" FOREIGN KEY ("debt_reminder_id") REFERENCES "DebtReminders"("id") ON DELETE CASCADE;
ALTER TABLE "Transactions" ADD CONSTRAINT "Transactions_fk2" FOREIGN KEY ("source_bank_id") REFERENCES "Banks"("id") ON DELETE CASCADE;
ALTER TABLE "Transactions" ADD CONSTRAINT "Transactions_fk3" FOREIGN KEY ("destination_bank_id") REFERENCES "Banks"("id") ON DELETE CASCADE;

ALTER TABLE "Receivers" ADD CONSTRAINT "Receivers_fk0" FOREIGN KEY ("user_id") REFERENCES "Users"("id") ON DELETE CASCADE;
ALTER TABLE "Receivers" ADD CONSTRAINT "Receivers_fk1" FOREIGN KEY ("bank_id") REFERENCES "Banks"("id") ON DELETE CASCADE;

ALTER TABLE "TransactionOTPs" ADD CONSTRAINT "TransactionOTPs_fk0" FOREIGN KEY ("transaction_id") REFERENCES "Transactions"("id") ON DELETE CASCADE;

ALTER TABLE "ResetPasswordOTPs" ADD CONSTRAINT "ResetPasswordOTPs_fk0" FOREIGN KEY ("user_id") REFERENCES "Users"("id") ON DELETE CASCADE;

ALTER TABLE "RefreshTokens" ADD CONSTRAINT "RefreshTokens_fk0" FOREIGN KEY ("user_id") REFERENCES "Users"("id") ON DELETE CASCADE;


INSERT INTO public."Roles"("name") VALUES('Admin');
INSERT INTO public."Roles"("name") VALUES('Customer');
INSERT INTO public."Roles"("name") VALUES('Employee');

insert into public."Banks"("name", "key", "host") VALUES('SNEW', '', '');

insert into public."TransactionStatuses"("name") values('Pending');
insert into public."TransactionStatuses"("name") values('Fail');
insert into public."TransactionStatuses"("name") values('Success');