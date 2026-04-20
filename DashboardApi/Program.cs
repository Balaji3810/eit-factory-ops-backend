using System.Text.Json;
using Dapper;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("Postgres")
    ?? throw new InvalidOperationException("Connection string 'Postgres' is missing.");

// ✅ FIX: Allow ALL origins (POC safe)
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

builder.WebHost.UseUrls("http://0.0.0.0:8080");

var app = builder.Build();

// ✅ APPLY CORS
app.UseCors("AllowAll");

app.MapGet("/", () => Results.Ok(new { message = "Dashboard API is running" }));

app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));

app.MapGet("/api/dashboard", async (
    Guid tenantId,
    Guid? plantId,
    Guid? lineId,
    Guid? machineId,
    int days = 45) =>
{
    if (tenantId == Guid.Empty)
        return Results.BadRequest(new { error = "tenantId is required." });

    if (days is < 1 or > 365)
        return Results.BadRequest(new { error = "days must be between 1 and 365." });

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
        days
    });

    if (string.IsNullOrWhiteSpace(json))
        return Results.NotFound(new { error = "No dashboard data returned." });

    try
    {
        using var doc = JsonDocument.Parse(json);
        return Results.Json(doc.RootElement.Clone());
    }
    catch (JsonException)
    {
        return Results.Problem("Database function returned invalid JSON.");
    }
});

app.Run();