using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WheelOfArtemis.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPickLaunch : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Launch",
                table: "RoundPicks",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            // Before this migration every launch picked exactly one person.
            migrationBuilder.Sql("UPDATE \"RoundPicks\" SET \"Launch\" = \"Sequence\";");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Launch",
                table: "RoundPicks");
        }
    }
}
