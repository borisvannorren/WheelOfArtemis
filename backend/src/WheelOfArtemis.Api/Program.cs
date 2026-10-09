using Microsoft.EntityFrameworkCore;
using Scalar.AspNetCore;
using WheelOfArtemis.Api.Data;
using WheelOfArtemis.Api.Features.Rounds;
using WheelOfArtemis.Api.Features.TeamMembers;
using WheelOfArtemis.Api.Hosting;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();
builder.Services.AddValidation();
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Default")));
builder.Services.AddSingleton(new SpinPlanner(Random.Shared));
builder.Services.AddHealthChecks().AddDbContextCheck<AppDbContext>();
builder.Services.AddFrontend(builder.Environment, builder.Configuration);

var app = builder.Build();

await app.MigrateDatabaseAsync();

app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseFrontendStaticFiles();
// Route after the static files middleware, so "/" is served as index.html instead of matching the frontend fallback.
app.UseRouting();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}

app.MapHealthChecks("/health");

var api = app.MapGroup("/api");
api.MapTeamMemberEndpoints();
api.MapRoundEndpoints();
// Unknown API routes return a 404 instead of falling through to the frontend.
api.MapFallback(() => TypedResults.NotFound());

app.MapFrontend();

await app.RunAsync();
