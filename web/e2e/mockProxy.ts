// A host that can't resolve, so a test that forgets to mock the proxy fails
// loudly instead of silently reaching the real Worker.
export const MOCK_PROXY_URL = "https://hunch8-proxy.invalid/";
