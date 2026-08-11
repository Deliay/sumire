#:sdk Aspire.AppHost.Sdk@13.4.6
#:package Aspire.Hosting.JavaScript@*

#pragma warning disable ASPIREJAVASCRIPT001

var builder = DistributedApplication.CreateBuilder(args);

var bookstore = builder
    .AddNextJsApp("bookstore", "../../apps/bookstore", runScriptName: "dev")
    .WithPnpm()
    .WithHttpEndpoint(env: "PORT")
    .WithExternalHttpEndpoints();

builder.Build().Run();
