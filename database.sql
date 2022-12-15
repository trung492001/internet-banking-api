CREATE TABLE "Accounts" (
	"id" serial NOT NULL,
	"number" VARCHAR(255) NOT NULL,
	"balance" FLOAT NOT NULL,
	"is_payment_account" BOOLEAN NOT NULL,
	"user_id" integer NOT NULL,
	"uuid" VARCHAR(255) NOT NULL UNIQUE,
	CONSTRAINT "Accounts_pk" PRIMARY KEY ("id")
) WITH (
  OIDS=FALSE
);



CREATE TABLE "Users" (
	"id" serial NOT NULL,
	"user_name" VARCHAR(255) NOT NULL,
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
	"uuid" VARCHAR(255) NOT NULL,
	"type_id" integer NOT NULL,
	"source_account_uuid" VARCHAR(255) NOT NULL,
	"destination_account_uuid" VARCHAR(255) NOT NULL,
	"created_at" TIMESTAMP NOT NULL,
	"note" VARCHAR(255) NOT NULL,
	"amount" integer NOT NULL,
	"is_paid_by_receiver" BOOLEAN NOT NULL,
	"status_id" integer NOT NULL,
	"code" VARCHAR(255) NOT NULL UNIQUE,
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



CREATE TABLE "TransferTypes" (
	"id" serial NOT NULL,
	"name" VARCHAR(255) NOT NULL UNIQUE,
	CONSTRAINT "TransferTypes_pk" PRIMARY KEY ("id")
) WITH (
  OIDS=FALSE
);



CREATE TABLE "DebtReminders" (
	"account_id" integer NOT NULL,
	"id" serial NOT NULL,
	"amount" integer NOT NULL,
	"note" VARCHAR(255) NOT NULL,
	"user_id" integer NOT NULL,
	"isPaid" BOOLEAN NOT NULL,
	CONSTRAINT "DebtReminders_pk" PRIMARY KEY ("id")
) WITH (
  OIDS=FALSE
);



CREATE TABLE "Banks" (
	"id" serial NOT NULL,
	"name" VARCHAR(255) NOT NULL,
	"host" VARCHAR(255),
	CONSTRAINT "Banks_pk" PRIMARY KEY ("id")
) WITH (
  OIDS=FALSE
);



CREATE TABLE "OTPs" (
	"id" serial NOT NULL,
	"otp" VARCHAR(255) NOT NULL UNIQUE,
	"expired_at" TIMESTAMP NOT NULL,
	"transaction_id" integer NOT NULL,
	CONSTRAINT "OTPs_pk" PRIMARY KEY ("id")
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

ALTER TABLE "Transactions" ADD CONSTRAINT "Transactions_fk0" FOREIGN KEY ("type_id") REFERENCES "TransferTypes"("id") ON DELETE CASCADE;
ALTER TABLE "Transactions" ADD CONSTRAINT "Transactions_fk1" FOREIGN KEY ("status_id") REFERENCES "TransactionStatuses"("id") ON DELETE CASCADE;


ALTER TABLE "Receivers" ADD CONSTRAINT "Receivers_fk0" FOREIGN KEY ("user_id") REFERENCES "Users"("id") ON DELETE CASCADE;
ALTER TABLE "Receivers" ADD CONSTRAINT "Receivers_fk1" FOREIGN KEY ("bank_id") REFERENCES "Banks"("id") ON DELETE CASCADE;


ALTER TABLE "DebtReminders" ADD CONSTRAINT "DebtReminders_fk0" FOREIGN KEY ("account_id") REFERENCES "Accounts"("id") ON DELETE CASCADE;
ALTER TABLE "DebtReminders" ADD CONSTRAINT "DebtReminders_fk1" FOREIGN KEY ("user_id") REFERENCES "Users"("id") ON DELETE CASCADE;


ALTER TABLE "OTPs" ADD CONSTRAINT "OTPs_fk0" FOREIGN KEY ("transaction_id") REFERENCES "Transactions"("id") ON DELETE CASCADE;

ALTER TABLE "RefreshTokens" ADD CONSTRAINT "RefreshTokens_fk0" FOREIGN KEY ("user_id") REFERENCES "Users"("id") ON DELETE CASCADE;


INSERT INTO public."Roles"("name") VALUES('Admin');
INSERT INTO public."Roles"("name") VALUES('Customer');
INSERT INTO public."Roles"("name") VALUES('Employee');

insert into public."Banks"("name", "host") VALUES('SNEW Bank', '');

insert into public."TransferTypes"("name") values('Transaction to receive money');
insert into public."TransferTypes"("name") values('Transfer transaction');
insert into public."TransferTypes" ("name") values('Debt reminder payment');

insert into public."TransactionStatuses"("name") values('Pending');
insert into public."TransactionStatuses"("name") values('Fail');
insert into public."TransactionStatuses"("name") values('Success');