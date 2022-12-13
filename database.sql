CREATE TABLE "Account" (
	"id" serial NOT NULL,
	"number" VARCHAR(255) NOT NULL,
	"balance" FLOAT NOT NULL,
	"is_payment_account" BOOLEAN NOT NULL,
	"user_id" integer NOT NULL,
	"uuid" VARCHAR(255) NOT NULL UNIQUE,
	CONSTRAINT "Account_pk" PRIMARY KEY ("id")
) WITH (
  OIDS=FALSE
);



CREATE TABLE "User" (
	"id" serial NOT NULL,
	"user_name" VARCHAR(255) NOT NULL,
	"password" VARCHAR(255) NOT NULL,
	"email" VARCHAR(255) NOT NULL,
	"phone" VARCHAR(255) NOT NULL,
	"name" VARCHAR(255) NOT NULL,
	"role_id" integer NOT NULL,
	CONSTRAINT "User_pk" PRIMARY KEY ("id")
) WITH (
  OIDS=FALSE
);



CREATE TABLE "Transfer" (
	"id" serial NOT NULL,
	"type_id" integer NOT NULL,
	"account_uuid" VARCHAR(255) NOT NULL UNIQUE,
	"receiver_account_uuid" VARCHAR(255) NOT NULL UNIQUE,
	"created_at" TIMESTAMP NOT NULL,
	"note" VARCHAR(255) NOT NULL,
	"amount" integer NOT NULL,
	"is_paid_by_receiver" BOOLEAN NOT NULL,
	CONSTRAINT "Transfer_pk" PRIMARY KEY ("id")
) WITH (
  OIDS=FALSE
);



CREATE TABLE "Role" (
	"id" serial NOT NULL,
	"name" VARCHAR(255) NOT NULL,
	CONSTRAINT "Role_pk" PRIMARY KEY ("id")
) WITH (
  OIDS=FALSE
);



CREATE TABLE "Receiver" (
	"reminiscent_name" VARCHAR(255) NOT NULL,
	"id" serial,
	"user_id" integer NOT NULL,
	"account_number" VARCHAR(255) NOT NULL,
	"bank_id" integer NOT NULL,
	CONSTRAINT "Receiver_pk" PRIMARY KEY ("id")
) WITH (
  OIDS=FALSE
);



CREATE TABLE "TransferType" (
	"id" serial NOT NULL,
	"name" VARCHAR(255) NOT NULL UNIQUE,
	CONSTRAINT "TransferType_pk" PRIMARY KEY ("id")
) WITH (
  OIDS=FALSE
);



CREATE TABLE "DebtReminder" (
	"account_id" integer NOT NULL,
	"id" serial NOT NULL,
	"amount" integer NOT NULL,
	"note" VARCHAR(255) NOT NULL,
	"user_id" integer NOT NULL,
	"isPaid" BOOLEAN NOT NULL,
	CONSTRAINT "DebtReminder_pk" PRIMARY KEY ("id")
) WITH (
  OIDS=FALSE
);



CREATE TABLE "Bank" (
	"id" serial NOT NULL,
	"name" VARCHAR(255) NOT NULL,
	"host" VARCHAR(255),
	CONSTRAINT "Bank_pk" PRIMARY KEY ("id")
) WITH (
  OIDS=FALSE
);



CREATE TABLE "OTP" (
	"id" serial NOT NULL,
	"otp" VARCHAR(255) NOT NULL UNIQUE,
	"expired_at" TIMESTAMP NOT NULL,
	"transfer_id" integer NOT NULL,
	CONSTRAINT "OTP_pk" PRIMARY KEY ("id")
) WITH (
  OIDS=FALSE
);



CREATE TABLE "RefreshToken" (
	"id" serial NOT NULL,
	"secret_key" text NOT NULL,
	"expired_at" TIMESTAMP NOT NULL,
	"user_id" integer NOT NULL,
	CONSTRAINT "RefreshToken_pk" PRIMARY KEY ("id")
) WITH (
  OIDS=FALSE
);



ALTER TABLE "Account" ADD CONSTRAINT "Account_fk0" FOREIGN KEY ("user_id") REFERENCES "User"("id");

ALTER TABLE "User" ADD CONSTRAINT "User_fk0" FOREIGN KEY ("role_id") REFERENCES "Role"("id");

ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_fk0" FOREIGN KEY ("type_id") REFERENCES "TransferType"("id");


ALTER TABLE "Receiver" ADD CONSTRAINT "Receiver_fk0" FOREIGN KEY ("user_id") REFERENCES "User"("id");
ALTER TABLE "Receiver" ADD CONSTRAINT "Receiver_fk1" FOREIGN KEY ("bank_id") REFERENCES "Bank"("id");


ALTER TABLE "DebtReminder" ADD CONSTRAINT "DebtReminder_fk0" FOREIGN KEY ("account_id") REFERENCES "Account"("id");
ALTER TABLE "DebtReminder" ADD CONSTRAINT "DebtReminder_fk1" FOREIGN KEY ("user_id") REFERENCES "User"("id");


ALTER TABLE "OTP" ADD CONSTRAINT "OTP_fk0" FOREIGN KEY ("transfer_id") REFERENCES "Transfer"("id");

ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_fk0" FOREIGN KEY ("user_id") REFERENCES "User"("id");

INSERT INTO public."Role"("name") VALUES('Admin');
INSERT INTO public."Role"("name") VALUES('Customer');
INSERT INTO public."Role"("name") VALUES('Employee');

insert into public."Bank"("name", "host") VALUES('SNEW Bank', '');

insert into public."TransferType"("name") values('Transaction to receive money');
insert into public."TransferType"("name") values('Transfer transaction');
insert into public."TransferType" ("name") values('Debt reminder payment');