#:sdk Aspire.AppHost.Sdk@13.4.6
#:package Aspire.Hosting.JavaScript@*
#:package Aspire.Hosting.Redis@*
#:package Aspire.Hosting.MongoDB@*

#pragma warning disable ASPIREJAVASCRIPT001

var builder = DistributedApplication.CreateBuilder(args);

var redis = builder.AddRedis("redis");
var mongodb = builder.AddMongoDB("mongodb")
    .WithImage("mongo", "7")
    .WithLifetime(ContainerLifetime.Session)
    .AddDatabase("sumire");
var api = builder
    .AddJavaScriptApp("api", "../../servers/api", runScriptName: "dev")
    .WithHttpEndpoint(env: "PORT")
    .WithExternalHttpEndpoints()
    .WithReference(redis).WaitFor(redis)
    .WithReference(mongodb).WaitFor(mongodb)
    // MongoDB 的 ConnectionStrings__mongodb 本身是合法 mongodb:// URL，Redis 由 WithReference 注入 REDIS_URI
    .WithEnvironment("SESSION_SECRET", "dev-secret")
    .WithEnvironment("BACKDOOR_USERNAME", "supersumire")
    // 初始超管密码 salamander 的 bcrypt 哈希（开发用）
    .WithEnvironment("BACKDOOR_PASSWORD_HASH", "$2a$10$9.VeFEc2sm0u6oMKeio0L.0/7hxQIq54iqCkmlr0C5eHPRhgTKnii");

var bookstore = builder
    .AddNextJsApp("bookstore", "../../apps/bookstore", runScriptName: "dev")
    .WithPnpm()
    .WithHttpEndpoint(env: "PORT")
    .WithExternalHttpEndpoints()
    .WithReference(api)
    .WithEnvironment("NEXT_PUBLIC_API_BASE_URL", api.GetEndpoint("http"));

// api 的 CORS 白名单引用 bookstore 端点（声明在 bookstore 之后）
api.WithEnvironment("CORS_ORIGINS", bookstore.GetEndpoint("http"));

builder.Build().Run();
