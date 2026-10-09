using Yarp.ReverseProxy.Configuration;

namespace WheelOfArtemis.Api.Hosting;

/// <summary>
/// The .NET app is the single entry point. In Development it forwards page requests to the
/// Next.js dev server (keeping hot reload); otherwise it serves the static Next.js export from wwwroot.
/// </summary>
public static class FrontendHostingExtensions
{
    private const string ClusterId = "frontend";

    public static IServiceCollection AddFrontend(this IServiceCollection services, IHostEnvironment env, IConfiguration config)
    {
        if (!env.IsDevelopment())
        {
            return services;
        }

        var devServerUrl = config["Frontend:DevServerUrl"]
            ?? throw new InvalidOperationException("Frontend:DevServerUrl is required in Development.");

        services.AddReverseProxy().LoadFromMemory(
            [
                new RouteConfig
                {
                    RouteId = "frontend",
                    ClusterId = ClusterId,
                    // Lowest priority, so API, health and OpenAPI endpoints always win.
                    Order = int.MaxValue,
                    Match = new RouteMatch { Path = "{**catch-all}" },
                    // Keep the browser's Host header, so Next.js sees same-origin requests (HMR, dev assets).
                    Transforms = [new Dictionary<string, string> { ["RequestHeaderOriginalHost"] = "true" }],
                },
            ],
            [
                new ClusterConfig
                {
                    ClusterId = ClusterId,
                    Destinations = new Dictionary<string, DestinationConfig>
                    {
                        ["next-dev"] = new() { Address = devServerUrl },
                    },
                },
            ]);

        return services;
    }

    public static void UseFrontendStaticFiles(this WebApplication app)
    {
        if (app.Environment.IsDevelopment())
        {
            return;
        }

        app.UseDefaultFiles();
        app.UseStaticFiles();
    }

    public static void MapFrontend(this WebApplication app)
    {
        if (app.Environment.IsDevelopment())
        {
            app.MapReverseProxy();
            return;
        }

        // Every page is pre-rendered by the static export, so unknown paths get Next.js' own 404 page.
        app.MapFallback(async context =>
        {
            context.Response.StatusCode = StatusCodes.Status404NotFound;
            context.Response.ContentType = "text/html";
            await context.Response.SendFileAsync(app.Environment.WebRootFileProvider.GetFileInfo("404.html"));
        });
    }
}
