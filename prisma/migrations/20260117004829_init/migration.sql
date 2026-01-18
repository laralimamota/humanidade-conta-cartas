-- CreateEnum
CREATE TYPE "CardType" AS ENUM ('BLACK', 'WHITE');

-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('WAITING', 'PICKING', 'JUDGING', 'ROUND_END', 'GAME_END');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cards" (
    "id" TEXT NOT NULL,
    "type" "CardType" NOT NULL,
    "text" TEXT NOT NULL,
    "pick" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "games" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(6) NOT NULL,
    "status" "GameStatus" NOT NULL DEFAULT 'WAITING',
    "current_round" INTEGER NOT NULL DEFAULT 0,
    "points_to_win" INTEGER NOT NULL DEFAULT 7,
    "host_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_players" (
    "id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "hand" JSONB NOT NULL DEFAULT '[]',
    "is_ready" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "game_players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rounds" (
    "id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "round_number" INTEGER NOT NULL,
    "black_card_id" TEXT NOT NULL,
    "czar_id" TEXT NOT NULL,
    "winner_id" TEXT,

    CONSTRAINT "rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "round_submissions" (
    "id" TEXT NOT NULL,
    "round_id" TEXT NOT NULL,
    "game_player_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "round_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "round_submission_cards" (
    "id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "card_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "round_submission_cards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "games_code_key" ON "games"("code");

-- CreateIndex
CREATE UNIQUE INDEX "game_players_game_id_user_id_key" ON "game_players"("game_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "rounds_game_id_round_number_key" ON "rounds"("game_id", "round_number");

-- CreateIndex
CREATE UNIQUE INDEX "round_submissions_round_id_game_player_id_key" ON "round_submissions"("round_id", "game_player_id");

-- CreateIndex
CREATE UNIQUE INDEX "round_submission_cards_submission_id_card_id_key" ON "round_submission_cards"("submission_id", "card_id");

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_black_card_id_fkey" FOREIGN KEY ("black_card_id") REFERENCES "cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_czar_id_fkey" FOREIGN KEY ("czar_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "round_submissions" ADD CONSTRAINT "round_submissions_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "round_submissions" ADD CONSTRAINT "round_submissions_game_player_id_fkey" FOREIGN KEY ("game_player_id") REFERENCES "game_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "round_submissions" ADD CONSTRAINT "round_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "round_submission_cards" ADD CONSTRAINT "round_submission_cards_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "round_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "round_submission_cards" ADD CONSTRAINT "round_submission_cards_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
