"""Shared pytest fixtures for the backend test suite.

The `_reset_rate_limiter` autouse fixture below is applied to every test in
this directory. Without it, slowapi's in-memory rate-limit storage accumulates
across tests, causing spurious 429s:

- The 10/min per-IP limit on /public/* (public-booking) accumulates across
  the 7 new public-booking tests, causing later tests to fail.
- The 5/min LOGIN_RATE_LIMIT on /auth/login (set in .env as "5/minute",
  which overrides the test's "100/minute" because main.py:3 uses
  load_dotenv(override=True)) accumulates across TestAuthEndpoints,
  causing test_me_authenticated to fail with 429 in the full suite.

Originally introduced in B-8 (f2a86b6) as a local fixture in test_api.py,
reverted in b02ce05 along with the admin-paths-as-public approach.
Reintroduced here at the directory level so it applies to ALL test files
in backend/tests/ (test_api.py, test_endpoints.py, test_deps.py,
test_jwt_secret_startup.py), not just test_api.py.

To investigate, run a single test in isolation:
    pytest tests/test_endpoints.py::TestAuthEndpoints::test_me_authenticated -v
(works) vs the full suite failing because of accumulated rate-limit state.
"""

import pytest


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    """Reset slowapi's in-memory rate-limit storage after every test."""
    yield
    from app.main import limiter
    limiter.reset()
