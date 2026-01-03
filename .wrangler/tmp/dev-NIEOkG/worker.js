var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-i82COs/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// worker.js
var SNAPLOGIC_URL = "https://emea.snaplogic.com/api/1/rest/slsched/feed/ptnrIWConnect/Accelerator/Initial/01_WM.SL_Initialization_API";
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "3600"
};
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders
    }
  });
}
__name(jsonResponse, "jsonResponse");
function errorResponse(message, status = 400) {
  return jsonResponse({ error: message }, status);
}
__name(errorResponse, "errorResponse");
var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: corsHeaders
      });
    }
    if (pathname.startsWith("/api/")) {
      return handleAPIRequest(request, env, pathname);
    }
    if (request.method === "GET" && pathname === "/upload") {
      return new Response(
        JSON.stringify({
          message: "This endpoint only accepts POST requests",
          usage: "Send a POST request with your file data to /upload",
          worker: "wmtoslnew"
        }),
        {
          status: 405,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Allow": "POST, OPTIONS"
          }
        }
      );
    }
    if (request.method === "POST" && pathname === "/upload") {
      try {
        const apiToken = env.SNAPLOGIC_API_TOKEN || env.API_TOKEN;
        if (!apiToken) {
          return new Response(
            JSON.stringify({
              error: "API token not configured",
              message: "SNAPLOGIC_API_TOKEN environment variable is not set in Cloudflare Worker settings"
            }),
            {
              status: 500,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
              }
            }
          );
        }
        const snapLogicUrl = env.SNAPLOGIC_URL || SNAPLOGIC_URL;
        const contentType = request.headers.get("Content-Type") || "";
        const body = await request.arrayBuffer();
        const snapLogicRequest = new Request(snapLogicUrl, {
          method: "POST",
          headers: {
            "Content-Type": contentType,
            "Authorization": `Bearer ${apiToken}`,
            "Content-Length": body.byteLength.toString()
          },
          body
        });
        try {
          const response = await fetch(snapLogicRequest, {
            // Set a longer timeout for large file uploads (5 minutes)
            signal: AbortSignal.timeout(3e5)
          });
          const responseData = await response.arrayBuffer();
          const responseText = new TextDecoder().decode(responseData);
          return new Response(responseData, {
            status: response.status,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Content-Type": "application/json"
              // Force JSON content-type
            }
          });
        } catch (fetchError) {
          console.error("SnapLogic request failed:", fetchError);
          return new Response(
            JSON.stringify({
              error: "SnapLogic request failed",
              message: fetchError.message || "Failed to connect to SnapLogic API",
              details: fetchError.name === "AbortError" ? "Request timeout (exceeded 5 minutes)" : void 0
            }),
            {
              status: 500,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
              }
            }
          );
        }
      } catch (error) {
        console.error("Proxy error:", error);
        return new Response(
          JSON.stringify({
            error: "Proxy server error",
            message: error.message || "Unknown error occurred"
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            }
          }
        );
      }
    }
    return new Response("Not Found", {
      status: 404,
      headers: corsHeaders
    });
  }
};
async function handleAPIRequest(request, env, pathname) {
  const db = env.DB;
  if (!db) {
    return errorResponse("Database not configured. Please set up D1 database.", 500);
  }
  if (pathname === "/api/users/login" && request.method === "POST") {
    try {
      const { email, password } = await request.json();
      if (!email || !password) {
        return errorResponse("Email and password are required", 400);
      }
      const user = await db.prepare(
        "SELECT * FROM users WHERE LOWER(email) = LOWER(?)"
      ).bind(email).first();
      if (!user || user.password !== password) {
        return errorResponse("Invalid email or password", 401);
      }
      const projects = await db.prepare(
        `SELECT p.id, p.name, p.description 
         FROM projects p 
         INNER JOIN user_projects up ON p.id = up.project_id 
         WHERE up.user_id = ?`
      ).bind(user.id).all();
      let permissions = [];
      try {
        permissions = JSON.parse(user.permissions || "[]");
      } catch (e) {
        permissions = [];
      }
      const { password: _, ...userWithoutPassword } = user;
      return jsonResponse({
        success: true,
        user: {
          ...userWithoutPassword,
          permissions,
          projects: projects.results || []
        },
        token: `token-${user.id}-${Date.now()}`
      });
    } catch (error) {
      console.error("Login error:", error);
      return errorResponse("Login failed: " + error.message, 500);
    }
  }
  if (pathname === "/api/users" && request.method === "GET") {
    try {
      const users = await db.prepare("SELECT id, email, name, role, avatar, department, permissions, created_at, updated_at FROM users ORDER BY id").all();
      const usersWithProjects = await Promise.all(
        users.results.map(async (user) => {
          const projects = await db.prepare(
            `SELECT p.id, p.name, p.description 
             FROM projects p 
             INNER JOIN user_projects up ON p.id = up.project_id 
             WHERE up.user_id = ?`
          ).bind(user.id).all();
          let permissions = [];
          try {
            permissions = JSON.parse(user.permissions || "[]");
          } catch (e) {
            permissions = [];
          }
          return {
            ...user,
            permissions,
            projects: projects.results || []
          };
        })
      );
      return jsonResponse({ users: usersWithProjects });
    } catch (error) {
      console.error("Get users error:", error);
      return errorResponse("Failed to fetch users: " + error.message, 500);
    }
  }
  if (pathname === "/api/users" && request.method === "POST") {
    try {
      const { email, password, name, role, department, permissions, projects } = await request.json();
      if (!email || !password || !name) {
        return errorResponse("Email, password, and name are required", 400);
      }
      const existing = await db.prepare("SELECT id FROM users WHERE LOWER(email) = LOWER(?)").bind(email).first();
      if (existing) {
        return errorResponse("User with this email already exists", 409);
      }
      const permissionsJson = JSON.stringify(permissions || []);
      const result = await db.prepare(
        "INSERT INTO users (email, password, name, role, department, permissions) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(
        email,
        password,
        name,
        role || "User",
        department || "",
        permissionsJson
      ).run();
      const userId = result.meta.last_row_id;
      if (projects && projects.length > 0) {
        for (const projectId of projects) {
          await db.prepare("INSERT OR IGNORE INTO user_projects (user_id, project_id) VALUES (?, ?)").bind(userId, projectId).run();
        }
      }
      return jsonResponse({ success: true, id: userId }, 201);
    } catch (error) {
      console.error("Create user error:", error);
      return errorResponse("Failed to create user: " + error.message, 500);
    }
  }
  if (pathname.startsWith("/api/users/") && request.method === "PUT") {
    try {
      const userId = parseInt(pathname.split("/")[3]);
      if (!userId) {
        return errorResponse("Invalid user ID", 400);
      }
      const { email, password, name, role, department, permissions, projects } = await request.json();
      const updates = [];
      const values = [];
      if (email) {
        const existing = await db.prepare("SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id != ?").bind(email, userId).first();
        if (existing) {
          return errorResponse("Email already in use", 409);
        }
        updates.push("email = ?");
        values.push(email);
      }
      if (password) {
        updates.push("password = ?");
        values.push(password);
      }
      if (name) {
        updates.push("name = ?");
        values.push(name);
      }
      if (role) {
        updates.push("role = ?");
        values.push(role);
      }
      if (department !== void 0) {
        updates.push("department = ?");
        values.push(department);
      }
      if (permissions) {
        updates.push("permissions = ?");
        values.push(JSON.stringify(permissions));
      }
      updates.push("updated_at = CURRENT_TIMESTAMP");
      values.push(userId);
      if (updates.length > 1) {
        await db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).bind(...values).run();
      }
      if (projects !== void 0) {
        await db.prepare("DELETE FROM user_projects WHERE user_id = ?").bind(userId).run();
        if (projects.length > 0) {
          for (const projectId of projects) {
            await db.prepare("INSERT INTO user_projects (user_id, project_id) VALUES (?, ?)").bind(userId, projectId).run();
          }
        }
      }
      return jsonResponse({ success: true });
    } catch (error) {
      console.error("Update user error:", error);
      return errorResponse("Failed to update user: " + error.message, 500);
    }
  }
  if (pathname.startsWith("/api/users/") && request.method === "DELETE") {
    try {
      const userId = parseInt(pathname.split("/")[3]);
      if (!userId) {
        return errorResponse("Invalid user ID", 400);
      }
      await db.prepare("DELETE FROM users WHERE id = ?").bind(userId).run();
      return jsonResponse({ success: true });
    } catch (error) {
      console.error("Delete user error:", error);
      return errorResponse("Failed to delete user: " + error.message, 500);
    }
  }
  if (pathname === "/api/projects" && request.method === "GET") {
    try {
      const projects = await db.prepare("SELECT * FROM projects ORDER BY id").all();
      return jsonResponse({ projects: projects.results || [] });
    } catch (error) {
      console.error("Get projects error:", error);
      return errorResponse("Failed to fetch projects: " + error.message, 500);
    }
  }
  if (pathname === "/api/projects" && request.method === "POST") {
    try {
      const { name, description } = await request.json();
      if (!name) {
        return errorResponse("Project name is required", 400);
      }
      const result = await db.prepare(
        "INSERT INTO projects (name, description) VALUES (?, ?)"
      ).bind(name, description || "").run();
      return jsonResponse({ success: true, id: result.meta.last_row_id }, 201);
    } catch (error) {
      console.error("Create project error:", error);
      return errorResponse("Failed to create project: " + error.message, 500);
    }
  }
  return errorResponse("API endpoint not found", 404);
}
__name(handleAPIRequest, "handleAPIRequest");

// ../../.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-i82COs/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// ../../.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-i82COs/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map
