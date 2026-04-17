# Factory Ops Dashboard - Integrated Runnable Project

## Frontend
```bash
npm install
npm run dev
```
Frontend runs on `http://localhost:5173`

## Backend
```bash
cd DashboardApi
dotnet run
```
API runs on `http://localhost:5115`

## API checks
- `http://localhost:5115/api/health`
- `http://localhost:5115/api/dashboard?tenantId=11111111-1111-1111-1111-111111111111&days=45`

## Notes
- Vite proxy is configured to forward `/api` to `http://localhost:5115`
- Update PostgreSQL connection settings in `DashboardApi/appsettings.json` or `appsettings.Development.json`
