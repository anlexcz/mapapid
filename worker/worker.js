export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    const incoming = new URL(request.url);
    if (incoming.pathname !== "/" && incoming.pathname !== "/vehicles") {
      return new Response("Not found", { status: 404, headers: corsHeaders });
    }

    try {
      const upstream = new URL("https://api.golemio.cz/v2/vehiclepositions");
      incoming.searchParams.forEach((value, key) => upstream.searchParams.append(key, value));

      const response = await fetch(upstream, {
        headers: {
          "X-Access-Token": env.GOLEMIO_API_KEY,
          "Accept": "application/json",
        },
      });

      const body = await response.text();
      return new Response(body, {
        status: response.status,
        headers: {
          ...corsHeaders,
          "Content-Type": response.headers.get("Content-Type") || "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=10",
        },
      });
    } catch (error) {
      return new Response(JSON.stringify({
        error: "MapaPID proxy error",
        message: error instanceof Error ? error.message : String(error),
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
      });
    }
  },
};
