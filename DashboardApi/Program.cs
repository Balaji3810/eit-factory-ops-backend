using System.Text.Json;
using Dapper;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("Postgres")
    ?? throw new InvalidOperationException("Connection string 'Postgres' is missing.");

var allowedOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>()
    ?? ["http://localhost:3000", "http://localhost:5173"];

builder.Services.AddCors(options =>
{
    options.AddPolicy("ReactApp", policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

app.UseCors("ReactApp");

app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));

app.MapGet("/api/dashboard", async (
    Guid tenantId,
    Guid? plantId,
    Guid? lineId,
    Guid? machineId,
    int days = 45) =>
{
    if (tenantId == Guid.Empty)
    {
        return Results.BadRequest(new { error = "tenantId is required." });
    }

    if (days is < 1 or > 365)
    {
        return Results.BadRequest(new { error = "days must be between 1 and 365." });
    }

    await using var connection = new NpgsqlConnection(connectionString);

    const string sql = """
        SELECT public.get_dashboard_data(
            @tenantId,
            @plantId,
            @lineId,
            @machineId,
            @days
        )::text;
    """;

    var json = await connection.QuerySingleOrDefaultAsync<string>(sql, new
    {
        tenantId,
        plantId,
        lineId,
        machineId,
        days,
    });

    if (string.IsNullOrWhiteSpace(json))
    {
        return Results.NotFound(new { error = "No dashboard data returned." });
    }

    using var document = JsonDocument.Parse(json);
    return Results.Json(document.RootElement.Clone());
});

app.Run();
