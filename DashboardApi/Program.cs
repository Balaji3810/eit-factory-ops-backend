using System.Text.Json;
using Dapper;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("Postgres")
    ?? throw new InvalidOperationException("Connection string 'Postgres' is missing.");

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

app.UseCors("AllowAll");

app.MapGet("/", () => Results.Ok(new { message = "Dashboard API is running" }));
app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));

static IResult ParseJsonPayload(string? json, string notFoundMessage)
{
    if (string.IsNullOrWhiteSpace(json))
        return Results.NotFound(new { error = notFoundMessage });

    try
    {
        using var doc = JsonDocument.Parse(json);
        return Results.Json(doc.RootElement.Clone());
    }
    catch (JsonException)
    {
        return Results.Problem("Database function returned invalid JSON.");
    }
}

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
        SELECT eit.get_dashboard_data(
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

    return ParseJsonPayload(json, "No dashboard data returned.");
});

app.MapGet("/api/analytics", async (
    Guid tenantId,
    string dateFrom,
    string dateTo) =>
{
    if (tenantId == Guid.Empty)
        return Results.BadRequest(new { error = "tenantId is required." });

    await using var connection = new NpgsqlConnection(connectionString);

    const string sql = """
        SELECT eit.get_oee_analytics_dashboard(
            @tenantId,
            CAST(@dateFrom AS date),
            CAST(@dateTo AS date)
        )::text;
    """;

    var json = await connection.QuerySingleOrDefaultAsync<string>(sql, new
    {
        tenantId,
        dateFrom,
        dateTo
    });

    return ParseJsonPayload(json, "No analytics data returned...");
});

app.MapGet("/api/line-audit", async (
    Guid tenantId,
    Guid? plantId,
    Guid? lineId,
    Guid? machineId,
    string? date,
    string? shiftStart,
    string? shiftEnd) =>
{
    if (tenantId == Guid.Empty)
        return Results.BadRequest(new { error = "tenantId is required." });

    await using var connection = new NpgsqlConnection(connectionString);

    const string sql = """
        SELECT eit.get_line_audit_dashboard(
            @tenantId,
            @plantId,
            @lineId,
            @machineId,
            CAST(@date AS date),
            COALESCE(CAST(@shiftStart AS time), TIME '06:00'),
            COALESCE(CAST(@shiftEnd AS time), TIME '14:00')
        )::text;
    """;

    var json = await connection.QuerySingleOrDefaultAsync<string>(sql, new
    {
        tenantId,
        plantId,
        lineId,
        machineId,
        date,
        shiftStart,
        shiftEnd
    });

    return ParseJsonPayload(json, "No line audit data returned.");
});

app.Run();
