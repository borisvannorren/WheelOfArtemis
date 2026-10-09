using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;

namespace WheelOfArtemis.Api.Hosting;

/// <summary>
/// One shared username and password (HTTP Basic authentication) for the whole app, so only the team can see
/// names and pairings when it is hosted on the network. Enabled when SharedPassword:Username and
/// SharedPassword:Password are configured; local development leaves them empty.
/// </summary>
public static partial class SharedPasswordExtensions
{
    public static void UseSharedPassword(this WebApplication app)
    {
        var username = app.Configuration["SharedPassword:Username"];
        var password = app.Configuration["SharedPassword:Password"];

        if (string.IsNullOrEmpty(username) || string.IsNullOrEmpty(password))
        {
            if (!app.Environment.IsDevelopment())
            {
                LogNoSharedPassword(app.Logger);
            }

            return;
        }

        var expected = Encoding.UTF8.GetBytes($"{username}:{password}");

        app.Use(async (context, next) =>
        {
            // The health check stays open, so monitoring works without credentials. It reveals nothing about the team.
            if (context.Request.Path.StartsWithSegments("/health") || HasValidCredentials(context.Request, expected))
            {
                await next(context);
                return;
            }

            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            context.Response.Headers.WWWAuthenticate = "Basic realm=\"Wheel of Artemis\", charset=\"UTF-8\"";
        });
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "No shared password configured: the app is open to anyone who can reach it.")]
    private static partial void LogNoSharedPassword(ILogger logger);

    private static bool HasValidCredentials(HttpRequest request, byte[] expected)
    {
        if (!AuthenticationHeaderValue.TryParse(request.Headers.Authorization, out var header)
            || !string.Equals(header.Scheme, "Basic", StringComparison.OrdinalIgnoreCase)
            || header.Parameter is null)
        {
            return false;
        }

        var buffer = new byte[header.Parameter.Length];
        if (!Convert.TryFromBase64String(header.Parameter, buffer, out var length))
        {
            return false;
        }

        return CryptographicOperations.FixedTimeEquals(buffer.AsSpan(0, length), expected);
    }
}
