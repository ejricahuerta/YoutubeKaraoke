using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Karaoke.Hubs;
using Karaoke.Models;
using Karaoke.Services;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.HttpsPolicy;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Karaoke {
    public class Startup {
        public Startup (IConfiguration configuration) {
            Configuration = configuration;
        }

        public IConfiguration Configuration { get; }

        // This method gets called by the runtime. Use this method to add services to the container.
        public void ConfigureServices (IServiceCollection services) {
            services.AddSingleton<YoutubeService> ();
            services.AddTransient<IKaraokeService, KaraokeService> ();
            services.AddSingleton<YoutubeHub> ();
            services.AddDbContext<KaraokeContext> ();

            services.Configure<CookiePolicyOptions> (options => {
                // This lambda determines whether user consent for non-essential cookies is needed for a given request.
                options.CheckConsentNeeded = context => true;
                options.MinimumSameSitePolicy = SameSiteMode.None;
            });

            services.AddMvc ().SetCompatibilityVersion (CompatibilityVersion.Version_2_2);
            services.AddCors (options => options.AddPolicy ("CorsPolicy",
                builder => {
                    builder.AllowAnyMethod ().AllowAnyHeader ()
                        .WithOrigins ("http://localhost:5000", "http://192.168.2.166:5000")
                        .AllowCredentials ();
                }));
            services.AddSignalR ();
        }

        // This method gets called by the runtime. Use this method to configure the HTTP request pipeline.
        public void Configure (IApplicationBuilder app, IHostingEnvironment env) {
            if (env.IsDevelopment ()) {
                app.UseDeveloperExceptionPage ();
            } else {
                app.UseExceptionHandler ("/Error");
            }

            app.UseStaticFiles ();
            app.UseCookiePolicy ();
            app.UseCors ("CorsPolicy");

            app.UseSignalR (routes => {
                routes.MapHub<YoutubeHub> ("/hub");
            });
            app.UseMvc ();
        }
    }
}