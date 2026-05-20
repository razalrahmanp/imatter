import { execSync } from "child_process";

export default async function globalSetup() {
  // Start the test PostgreSQL container
  execSync("docker compose -f docker-compose.test.yml up -d --wait", {
    stdio: "inherit",
  });

  // Run migrations against the test DB
  process.env["TEST_DATABASE_URL"] =
    "postgresql://test:test@localhost:5433/teashop_test";

  execSync("npm run migrate:test", { stdio: "inherit" });
}
