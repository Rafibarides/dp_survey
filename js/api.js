(function () {
  function config() {
    return window.APP_CONFIG || {};
  }

  function assertConfigured() {
    if (!config().SCRIPT_URL) {
      throw new Error("SCRIPT_URL is not set in js/config.js");
    }
  }

  async function request(action, payload = {}, method = "GET") {
    assertConfigured();
    const scriptUrl = config().SCRIPT_URL;

    if (method === "GET") {
      const url = new URL(scriptUrl);
      url.searchParams.set("action", action);
      Object.entries(payload).forEach(([k, v]) => {
        url.searchParams.set(k, typeof v === "string" ? v : JSON.stringify(v));
      });
      const res = await fetch(url.toString(), { method: "GET", redirect: "follow" });
      if (!res.ok) throw new Error("Request failed");
      return res.json();
    }

    // text/plain avoids a CORS preflight against Apps Script
    const res = await fetch(scriptUrl, {
      method: "POST",
      redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, ...payload }),
    });
    if (!res.ok) throw new Error("Request failed");
    return res.json();
  }

  window.API = {
    submitResponse(data) {
      return request("submit", data, "POST");
    },
    getCompare(rankedIds) {
      return request("compare", { ranked: rankedIds.join(",") }, "GET");
    },
    getAdminStats() {
      return request("admin", { key: config().ADMIN_KEY }, "GET");
    },
    isConfigured() {
      return Boolean(config().SCRIPT_URL);
    },
  };
})();
