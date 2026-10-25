# News service deployment

Copy `settings.example.json` to `settings.json` before deployment. Configure `allowedOrigins` for your administration site and `setupTokenHash` for the one-time bootstrap token. `settings.json` is machine-specific and excluded from Git; keep your existing deployed settings.

Without a local settings file the example configuration is loaded and bootstrap remains disabled. Deploy this function with its existing environment variables. See `docs/OPERATIONS-ADMIN.md` and `docs/PRODUCT-ANALYTICS.md` in the repository for administration and analytics setup.
