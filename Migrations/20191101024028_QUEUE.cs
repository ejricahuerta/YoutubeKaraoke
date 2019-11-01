using Microsoft.EntityFrameworkCore.Migrations;

namespace Karaoke.Migrations
{
    public partial class QUEUE : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "OnQueue",
                table: "Songs",
                nullable: false,
                defaultValue: false);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "OnQueue",
                table: "Songs");
        }
    }
}
