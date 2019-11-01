﻿using Microsoft.EntityFrameworkCore.Migrations;

namespace Karaoke.Migrations
{
    public partial class INIT : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Snippet",
                columns: table => new
                {
                    Id = table.Column<int>(nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Title = table.Column<string>(nullable: true),
                    Channel = table.Column<string>(nullable: true),
                    ChannelId = table.Column<string>(nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Snippet", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SongId",
                columns: table => new
                {
                    Id = table.Column<int>(nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    VideoId = table.Column<string>(nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SongId", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Songs",
                columns: table => new
                {
                    Id = table.Column<int>(nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    SongIdId = table.Column<int>(nullable: true),
                    SnippetId = table.Column<int>(nullable: true),
                    OnQueue = table.Column<bool>(nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Songs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Songs_Snippet_SnippetId",
                        column: x => x.SnippetId,
                        principalTable: "Snippet",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Songs_SongId_SongIdId",
                        column: x => x.SongIdId,
                        principalTable: "SongId",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Songs_SnippetId",
                table: "Songs",
                column: "SnippetId");

            migrationBuilder.CreateIndex(
                name: "IX_Songs_SongIdId",
                table: "Songs",
                column: "SongIdId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Songs");

            migrationBuilder.DropTable(
                name: "Snippet");

            migrationBuilder.DropTable(
                name: "SongId");
        }
    }
}
